import { NextResponse } from 'next/server';
import { db, dbReady } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { generateSlug, ensureUniqueSlug, invalidateTenantCache } from '@/lib/tenant';
import { invalidateConfigCache } from '@/lib/constants';
import { getPlanQuotaDefaults } from '@/lib/commercial-plan-catalog';
import { deriveSubscriptionUnitAmount } from '@/lib/platform-billing';
import {
  publicRegistrationIntentPayloadSchema,
  publicRegistrationVerificationSchema,
} from '@/lib/public-registration-contract';
import {
  calculatePublicTrialEnd,
  getPublicOnboardingSettings,
  hashPublicVerificationToken,
} from '@/lib/public-onboarding';

class PublicVerificationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'PublicVerificationError';
  }
}

function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

function isPrismaUniqueError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: unknown }).code === 'P2002'
  );
}

export async function POST(request: Request) {
  const settings = getPublicOnboardingSettings();
  if (!settings.enabled) {
    return NextResponse.json(
      {
        error: "Inscription restaurant désactivée. Contactez l'équipe KFM Delice.",
        code: 'PUBLIC_REGISTRATION_DISABLED',
      },
      { status: 403 },
    );
  }

  const limit = await rateLimit(`public-registration-verify:${clientIp(request)}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: 'Trop de tentatives de vérification. Réessayez dans une minute.',
        code: 'PUBLIC_REGISTRATION_VERIFY_RATE_LIMITED',
      },
      { status: 429 },
    );
  }

  try {
    await dbReady;
    const validation = publicRegistrationVerificationSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        {
          error: validation.error.issues[0]?.message || 'Token de vérification invalide',
          code: 'PUBLIC_REGISTRATION_VERIFY_VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    const tokenHash = hashPublicVerificationToken(validation.data.token);
    const intent = await db.publicRegistrationIntent.findUnique({ where: { tokenHash } });
    if (!intent) {
      return NextResponse.json(
        {
          error: 'Ce lien de vérification est invalide ou a déjà été utilisé.',
          code: 'PUBLIC_REGISTRATION_VERIFY_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    const now = new Date();
    if (intent.expiresAt.getTime() <= now.getTime()) {
      await db.publicRegistrationIntent.deleteMany({
        where: { id: intent.id, tokenHash },
      }).catch(() => undefined);
      return NextResponse.json(
        {
          error: 'Ce lien de vérification a expiré. Recommencez votre inscription.',
          code: 'PUBLIC_REGISTRATION_VERIFY_EXPIRED',
        },
        { status: 410 },
      );
    }

    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(intent.payload);
    } catch {
      throw new PublicVerificationError(
        'PUBLIC_REGISTRATION_INTENT_INVALID',
        'La demande d’inscription ne peut pas être vérifiée. Recommencez votre inscription.',
        409,
      );
    }
    const payloadValidation = publicRegistrationIntentPayloadSchema.safeParse(rawPayload);
    if (!payloadValidation.success) {
      throw new PublicVerificationError(
        'PUBLIC_REGISTRATION_INTENT_INVALID',
        'La demande d’inscription ne peut pas être vérifiée. Recommencez votre inscription.',
        409,
      );
    }
    const data = payloadValidation.data;

    const baseSlug = data.slug || generateSlug(data.restaurantName);
    const slug = await ensureUniqueSlug(baseSlug);
    const quotas = getPlanQuotaDefaults(data.trialPlan);
    const { unitAmount } = deriveSubscriptionUnitAmount({
      plan: data.trialPlan,
      billingCycle: 'monthly',
    });
    const trialEnd = calculatePublicTrialEnd(now, data.trialDays);
    const trialEndsAt = trialEnd.toISOString();

    const result = await db.$transaction(async (tx) => {
      // Conditional claim: only one concurrent verifier can transition this
      // exact pending intent. Any later failure rolls the claim back to pending.
      const claim = await tx.publicRegistrationIntent.updateMany({
        where: {
          id: intent.id,
          tokenHash,
          status: 'pending',
          expiresAt: { gt: now },
        },
        data: { status: 'processing' },
      });
      if (claim.count !== 1) {
        throw new PublicVerificationError(
          'PUBLIC_REGISTRATION_VERIFY_ALREADY_PROCESSING',
          'Cette demande de vérification est déjà en cours ou a déjà été consommée.',
          409,
        );
      }

      // Re-check at consumption time. Another account may have been created for
      // this identity after the email was sent but before the user clicked it.
      const existingAdmins = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Admin" WHERE LOWER("email") = LOWER(${data.ownerEmail}) LIMIT 1
      `;
      if (existingAdmins.length > 0) {
        throw new PublicVerificationError(
          'PUBLIC_REGISTRATION_EMAIL_EXISTS',
          'Un compte existe déjà avec cet email. Connectez-vous avec ce compte.',
          409,
        );
      }

      const account = await tx.account.create({
        data: {
          name: data.restaurantName,
          ownerName: data.ownerName,
          ownerEmail: data.ownerEmail,
          ownerPhone: data.ownerPhone || '',
          status: 'trial',
          plan: data.trialPlan,
          maxRestaurants: quotas.maxRestaurants,
          maxSecondaryRestaurants: quotas.maxSecondaryRestaurants,
          maxAdmins: quotas.maxAdmins,
          maxUsers: quotas.maxUsers,
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
          plan: data.trialPlan,
          status: 'trial',
          trialEndsAt,
          ownerEmail: data.ownerEmail,
          ownerName: data.ownerName,
          ownerPhone: data.ownerPhone || '',
          accountId: account.id,
          type: 'principal',
        },
      });

      await tx.restaurantConfig.create({ data: { restaurantId: restaurant.id } });

      const admin = await tx.admin.create({
        data: {
          email: data.ownerEmail,
          password: intent.passwordHash,
          name: data.ownerName,
          role: 'admin',
          status: 'active',
          restaurantId: restaurant.id,
          accountId: account.id,
          canCreateRestaurant: true,
          restaurantCreationLimit: quotas.maxSecondaryRestaurants,
          restaurantsCreatedCount: 0,
          mustChangePassword: false,
        },
      });

      const subscription = await tx.platformSubscription.create({
        data: {
          accountId: account.id,
          plan: data.trialPlan,
          billingCycle: 'monthly',
          status: 'trialing',
          currency: 'GNF',
          unitAmount,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
          nextBillingAt: trialEnd,
          provider: 'manual',
        },
      });

      await tx.publicRegistrationIntent.delete({ where: { id: intent.id } });
      return { account, restaurant, admin, subscription };
    });

    invalidateTenantCache();
    invalidateConfigCache();

    await logAudit({
      actorId: result.admin.id,
      actorType: 'admin',
      action: 'public_trial_registration_verified',
      entityType: 'Account',
      entityId: result.account.id,
      accountId: result.account.id,
      restaurantId: result.restaurant.id,
      after: {
        trialPlan: data.trialPlan,
        trialDays: data.trialDays,
        trialEndsAt,
        subscriptionId: result.subscription.id,
        emailVerified: true,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      loginRequired: true,
      loginUrl: '/admin/login?verified=1',
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
      },
      trial: {
        plan: data.trialPlan,
        days: data.trialDays,
        endsAt: trialEndsAt,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof PublicVerificationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (isPrismaUniqueError(error)) {
      return NextResponse.json(
        {
          error: 'Un compte ou un restaurant utilisant déjà ces informations existe.',
          code: 'PUBLIC_REGISTRATION_CONFLICT',
        },
        { status: 409 },
      );
    }
    console.error('[register-restaurant/verify POST]', error);
    return NextResponse.json(
      { error: 'Erreur lors de la vérification. Veuillez réessayer.' },
      { status: 500 },
    );
  }
}
