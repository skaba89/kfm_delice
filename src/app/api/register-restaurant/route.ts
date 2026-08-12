import { Prisma } from '@prisma/client';
import { db, dbReady, bigIntToNumber } from '@/lib/db';
import { NextResponse } from 'next/server';
import { hashPassword, generateToken } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { validatePassword } from '@/lib/password-policy';
import { rateLimit } from '@/lib/rate-limit';
import { generateSlug, ensureUniqueSlug } from '@/lib/tenant';
import {
  getPlanMonthlyPriceGnf,
  getPlanQuotaDefaults,
  type CommercialPlan,
} from '@/lib/commercial-plan-catalog';
import { z } from 'zod';

// ────────────────────────────────────────────────────────────────
// Restaurant Registration / Account-first SaaS onboarding API
// Public registration remains disabled by default. If explicitly enabled,
// the server — never the client — chooses the trial plan and creates the
// complete Account + principal Restaurant + Admin + Config + Billing hierarchy
// atomically. No automatic invoicing/charge is scheduled during the trial.
// ────────────────────────────────────────────────────────────────

const PUBLIC_TRIAL_PLANS = new Set<CommercialPlan>(['free', 'starter', 'pro']);
const DEFAULT_PUBLIC_TRIAL_PLAN: CommercialPlan = 'starter';
const DEFAULT_PUBLIC_TRIAL_DAYS = 14;
const MAX_PUBLIC_TRIAL_DAYS = 60;

class PublicRegistrationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicRegistrationConfigurationError';
  }
}

const registerRestaurantSchema = z.object({
  restaurantName: z.string().trim().min(2, 'Nom du restaurant requis (min 2 caractères)').max(120),
  slug: z.string().trim().min(2, 'Slug requis').max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug: lettres minuscules, chiffres et tirets uniquement')
    .optional(),
  tagline: z.string().trim().max(180).optional(),
  phone: z.string().trim().min(1, 'Téléphone du restaurant requis').max(40),
  whatsapp: z.string().trim().max(40).optional(),
  email: z.string().trim().email('Email du restaurant invalide').max(320).optional(),
  address: z.string().trim().max(500).optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, 'Devise invalide').default('GNF'),
  locale: z.string().trim().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, 'Locale invalide').default('fr'),

  ownerName: z.string().trim().min(2, 'Nom du propriétaire requis').max(120),
  ownerEmail: z.string().trim().email('Email du propriétaire invalide').max(320),
  ownerPassword: z.string().min(6, 'Mot de passe requis').max(128),
  ownerPhone: z.string().trim().max(40).optional(),
}).strict();

function getPublicRegistrationTrialPlan(): CommercialPlan {
  const configured = (process.env.PUBLIC_REGISTRATION_TRIAL_PLAN || DEFAULT_PUBLIC_TRIAL_PLAN).trim().toLowerCase();
  if (!PUBLIC_TRIAL_PLANS.has(configured as CommercialPlan)) {
    throw new PublicRegistrationConfigurationError(
      'PUBLIC_REGISTRATION_TRIAL_PLAN doit être free, starter ou pro. Enterprise/custom sont interdits pour une inscription publique.',
    );
  }
  return configured as CommercialPlan;
}

function getPublicRegistrationTrialDays(): number {
  const raw = process.env.PUBLIC_REGISTRATION_TRIAL_DAYS;
  if (!raw) return DEFAULT_PUBLIC_TRIAL_DAYS;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PUBLIC_TRIAL_DAYS) {
    throw new PublicRegistrationConfigurationError(
      `PUBLIC_REGISTRATION_TRIAL_DAYS doit être un entier entre 1 et ${MAX_PUBLIC_TRIAL_DAYS}.`,
    );
  }
  return parsed;
}

export async function POST(request: Request) {
  if (process.env.ENABLE_PUBLIC_RESTAURANT_REGISTRATION !== 'true') {
    return NextResponse.json(
      { error: "Inscription restaurant désactivée. Contactez l'équipe KFM Delice." },
      { status: 403 },
    );
  }

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const { allowed } = await rateLimit(clientIp, 3, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives d'inscription. Réessayez dans une minute." },
      { status: 429 },
    );
  }

  try {
    await dbReady;
    const validation = registerRestaurantSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        {
          error: validation.error.issues[0]?.message || 'Données invalides',
          code: 'PUBLIC_REGISTRATION_VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    const data = validation.data;
    const passwordCheck = validatePassword(data.ownerPassword);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.errors[0], code: 'PUBLIC_REGISTRATION_PASSWORD_POLICY' },
        { status: 400 },
      );
    }

    const trialPlan = getPublicRegistrationTrialPlan();
    const trialDays = getPublicRegistrationTrialDays();
    const quotaDefaults = getPlanQuotaDefaults(trialPlan);
    const monthlyPrice = getPlanMonthlyPriceGnf(trialPlan);
    if (monthlyPrice === null) {
      throw new PublicRegistrationConfigurationError(
        'Le plan public sélectionné ne possède pas de tarif catalogue exploitable.',
      );
    }

    const existingAdmin = await db.admin.findFirst({
      where: { email: data.ownerEmail },
      select: { id: true },
    });
    if (existingAdmin) {
      return NextResponse.json(
        {
          error: 'Un compte existe déjà avec cet email. Connectez-vous ou utilisez un autre email.',
          code: 'PUBLIC_REGISTRATION_EMAIL_EXISTS',
        },
        { status: 409 },
      );
    }

    const baseSlug = data.slug || generateSlug(data.restaurantName);
    const slug = await ensureUniqueSlug(baseSlug);
    const hashedPassword = await hashPassword(data.ownerPassword);
    const trialStartedAt = new Date();
    const trialEndDate = new Date(trialStartedAt.getTime() + trialDays * 24 * 60 * 60 * 1000);
    const trialEndsAt = trialEndDate.toISOString();

    const result = await db.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name: data.restaurantName,
          ownerName: data.ownerName,
          ownerEmail: data.ownerEmail,
          ownerPhone: data.ownerPhone || '',
          status: 'trial',
          plan: trialPlan,
          maxRestaurants: quotaDefaults.maxRestaurants,
          maxSecondaryRestaurants: quotaDefaults.maxSecondaryRestaurants,
          maxAdmins: quotaDefaults.maxAdmins,
          maxUsers: quotaDefaults.maxUsers,
          trialEndsAt,
        },
      });

      const restaurant = await tx.restaurant.create({
        data: {
          name: data.restaurantName,
          slug,
          tagline: data.tagline || '',
          phone: data.phone,
          whatsapp: data.whatsapp || data.phone,
          email: data.email || '',
          address: data.address || '',
          hours: 'Lun-Dim : 11h00 - 23h00',
          currency: data.currency,
          locale: data.locale,
          // Account.plan is authoritative; this is only its compatibility shadow.
          plan: trialPlan,
          status: 'trial',
          trialEndsAt,
          ownerEmail: data.ownerEmail,
          ownerName: data.ownerName,
          ownerPhone: data.ownerPhone || '',
          accountId: account.id,
          type: 'principal',
        },
      });

      const admin = await tx.admin.create({
        data: {
          email: data.ownerEmail,
          password: hashedPassword,
          name: data.ownerName,
          role: 'admin',
          status: 'active',
          restaurantId: restaurant.id,
          accountId: account.id,
          canCreateRestaurant: quotaDefaults.maxSecondaryRestaurants > 0,
          restaurantCreationLimit: quotaDefaults.maxSecondaryRestaurants,
          restaurantsCreatedCount: 0,
        },
      });

      await tx.restaurantConfig.create({
        data: {
          restaurantId: restaurant.id,
          primaryColor: '#ea580c',
          accentColor: '#f97316',
          menuCategories: JSON.stringify([
            { id: 'entrees', name: 'Entrées' },
            { id: 'plats', name: 'Plats Principaux' },
            { id: 'desserts', name: 'Desserts' },
            { id: 'boissons', name: 'Boissons' },
          ]),
          // Feature entitlements are resolved from Account.plan by the central
          // commercial catalog. Do not persist a second pricing matrix here.
          features: '{}',
          openingHours: JSON.stringify({
            open: 11,
            close: 23,
            timezone: 'Africa/Conakry',
          }),
        },
      });

      const subscription = await tx.platformSubscription.create({
        data: {
          accountId: account.id,
          plan: trialPlan,
          billingCycle: 'monthly',
          status: 'trialing',
          currency: 'GNF',
          unitAmount: BigInt(monthlyPrice),
          currentPeriodStart: trialStartedAt,
          currentPeriodEnd: trialEndDate,
          // Deliberately null: public signup grants an evaluation period but does
          // not constitute consent to automatic recurring billing or collection.
          nextBillingAt: null,
          provider: 'manual',
        },
      });

      return { account, restaurant, admin, subscription };
    });

    await logAudit({
      actorId: result.admin.id,
      actorType: 'self_service_admin',
      action: 'public_registration',
      entityType: 'Account',
      entityId: result.account.id,
      accountId: result.account.id,
      restaurantId: result.restaurant.id,
      after: {
        plan: trialPlan,
        status: 'trial',
        trialDays,
        restaurantId: result.restaurant.id,
        adminId: result.admin.id,
        subscriptionId: result.subscription.id,
        subscriptionStatus: result.subscription.status,
      },
      request,
    });

    const token = generateToken({
      id: result.admin.id,
      email: result.admin.email,
      role: result.admin.role,
      type: 'admin',
      restaurantId: result.restaurant.id,
      restaurantSlug: result.restaurant.slug,
    });

    return NextResponse.json(bigIntToNumber({
      success: true,
      account: {
        id: result.account.id,
        plan: result.account.plan,
        status: result.account.status,
        trialEndsAt: result.account.trialEndsAt,
      },
      restaurant: {
        id: result.restaurant.id,
        name: result.restaurant.name,
        slug: result.restaurant.slug,
        plan: result.account.plan,
        status: result.restaurant.status,
        trialEndsAt: result.restaurant.trialEndsAt,
      },
      subscription: {
        id: result.subscription.id,
        plan: result.subscription.plan,
        status: result.subscription.status,
        billingCycle: result.subscription.billingCycle,
        unitAmount: result.subscription.unitAmount,
        nextBillingAt: result.subscription.nextBillingAt,
      },
      admin: {
        id: result.admin.id,
        email: result.admin.email,
        name: result.admin.name,
        role: result.admin.role,
      },
      token,
    }), { status: 201 });
  } catch (error) {
    if (error instanceof PublicRegistrationConfigurationError) {
      console.error('[register-restaurant configuration]', error.message);
      return NextResponse.json(
        {
          error: 'Configuration de l’inscription publique invalide. Contactez l’équipe KFM Delice.',
          code: 'PUBLIC_REGISTRATION_CONFIGURATION_ERROR',
        },
        { status: 503 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'Un compte utilise déjà cet email ou ce slug. Rechargez la page puis réessayez.',
          code: 'PUBLIC_REGISTRATION_CONFLICT',
        },
        { status: 409 },
      );
    }
    console.error('[register-restaurant POST]', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du restaurant. Veuillez réessayer.' },
      { status: 500 },
    );
  }
}
