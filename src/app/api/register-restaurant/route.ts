import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { hashPassword, generateToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { generateSlug, ensureUniqueSlug, invalidateTenantCache } from "@/lib/tenant";
import { invalidateConfigCache } from "@/lib/constants";
import { validatePassword } from "@/lib/password-policy";
import { getPlanQuotaDefaults } from "@/lib/commercial-plan-catalog";
import { deriveSubscriptionUnitAmount } from "@/lib/platform-billing";
import {
  calculatePublicTrialEnd,
  getPublicOnboardingSettings,
  normalizePublicOwnerEmail,
} from "@/lib/public-onboarding";
import { z } from "zod";

const optionalEmailSchema = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().email("Email du restaurant invalide").max(254).optional(),
);

const registerRestaurantSchema = z.object({
  restaurantName: z.string().trim().min(2, "Nom du restaurant requis (min 2 caractères)").max(120),
  slug: z.string().trim().min(2, "Slug requis").max(80)
    .regex(/^[a-z0-9-]+$/, "Slug: lettres minuscules, chiffres et tirets uniquement")
    .optional(),
  tagline: z.string().trim().max(160).optional(),
  phone: z.string().trim().min(3, "Téléphone du restaurant requis").max(40),
  whatsapp: z.string().trim().max(40).optional(),
  email: optionalEmailSchema,
  address: z.string().trim().max(300).optional(),
  currency: z.enum(["GNF", "XOF", "EUR", "USD"]).default("GNF"),
  locale: z.enum(["fr", "en"]).default("fr"),
  ownerName: z.string().trim().min(2, "Nom du propriétaire requis").max(120),
  ownerEmail: z.string().trim().email("Email du propriétaire invalide").max(254),
  ownerPassword: z.string().min(6, "Mot de passe requis").max(128),
  ownerPhone: z.string().trim().max(40).optional(),
}).strict();

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

function isPrismaUniqueError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && (error as { code?: unknown }).code === "P2002"
  );
}

export async function GET() {
  const settings = getPublicOnboardingSettings();
  return NextResponse.json({
    enabled: settings.enabled,
    trialPlan: settings.trialPlan,
    trialDays: settings.trialDays,
  });
}

export async function POST(request: Request) {
  const settings = getPublicOnboardingSettings();
  if (!settings.enabled) {
    return NextResponse.json(
      {
        error: "Inscription restaurant désactivée. Contactez l'équipe KFM Delice.",
        code: "PUBLIC_REGISTRATION_DISABLED",
      },
      { status: 403 },
    );
  }

  const { allowed } = await rateLimit(`public-registration:${clientIp(request)}`, 3, 60_000);
  if (!allowed) {
    return NextResponse.json(
      {
        error: "Trop de tentatives d'inscription. Réessayez dans une minute.",
        code: "PUBLIC_REGISTRATION_RATE_LIMITED",
      },
      { status: 429 },
    );
  }

  try {
    await dbReady;
    const validation = registerRestaurantSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        {
          error: validation.error.issues[0]?.message || "Données invalides",
          code: "PUBLIC_REGISTRATION_VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const data = validation.data;
    const ownerEmail = normalizePublicOwnerEmail(data.ownerEmail);
    const passwordCheck = validatePassword(data.ownerPassword);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.errors[0], code: "PUBLIC_REGISTRATION_WEAK_PASSWORD" },
        { status: 400 },
      );
    }

    // Cross-provider and case-insensitive. The public path must not create
    // Test@example.com and test@example.com as two independent identities.
    const existingAdmins = await db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Admin" WHERE LOWER("email") = LOWER(${ownerEmail}) LIMIT 1
    `;
    if (existingAdmins.length > 0) {
      return NextResponse.json(
        {
          error: "Un compte existe déjà avec cet email. Connectez-vous ou utilisez un autre email.",
          code: "PUBLIC_REGISTRATION_EMAIL_EXISTS",
        },
        { status: 409 },
      );
    }

    const baseSlug = data.slug || generateSlug(data.restaurantName);
    const slug = await ensureUniqueSlug(baseSlug);
    const hashedPassword = await hashPassword(data.ownerPassword);
    const now = new Date();
    const trialEnd = calculatePublicTrialEnd(now, settings.trialDays);
    const trialEndsAt = trialEnd.toISOString();
    const quotas = getPlanQuotaDefaults(settings.trialPlan);
    const { unitAmount } = deriveSubscriptionUnitAmount({
      plan: settings.trialPlan,
      billingCycle: "monthly",
    });

    // Account, principal restaurant, owner admin, config and billing ledger are
    // one atomic onboarding unit. A failure at any step rolls everything back.
    const result = await db.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name: data.restaurantName,
          ownerName: data.ownerName,
          ownerEmail,
          ownerPhone: data.ownerPhone || "",
          status: "trial",
          plan: settings.trialPlan,
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
          tagline: data.tagline || "",
          phone: data.phone,
          whatsapp: data.whatsapp || data.phone,
          email: data.email || "",
          address: data.address || "",
          hours: "Lun-Dim : 11h00 - 23h00",
          currency: data.currency,
          locale: data.locale,
          // Account.plan is authoritative. Restaurant.plan is only a
          // compatibility shadow for legacy readers.
          plan: settings.trialPlan,
          status: "trial",
          trialEndsAt,
          ownerEmail,
          ownerName: data.ownerName,
          ownerPhone: data.ownerPhone || "",
          accountId: account.id,
          type: "principal",
        },
      });

      await tx.restaurantConfig.create({
        data: { restaurantId: restaurant.id },
      });

      const admin = await tx.admin.create({
        data: {
          email: ownerEmail,
          password: hashedPassword,
          name: data.ownerName,
          role: "admin",
          status: "active",
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
          plan: settings.trialPlan,
          billingCycle: "monthly",
          status: "trialing",
          currency: "GNF",
          unitAmount,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
          nextBillingAt: trialEnd,
          provider: "manual",
        },
      });

      return { account, restaurant, admin, subscription };
    });

    invalidateTenantCache();
    invalidateConfigCache();

    await logAudit({
      actorId: result.admin.id,
      actorType: "admin",
      action: "public_trial_registration",
      entityType: "Account",
      entityId: result.account.id,
      accountId: result.account.id,
      restaurantId: result.restaurant.id,
      after: {
        trialPlan: settings.trialPlan,
        trialDays: settings.trialDays,
        trialEndsAt,
        restaurantId: result.restaurant.id,
        subscriptionId: result.subscription.id,
      },
      request,
    });

    const token = generateToken({
      id: result.admin.id,
      email: result.admin.email,
      role: result.admin.role,
      type: "admin",
      restaurantId: result.restaurant.id,
      restaurantSlug: result.restaurant.slug,
      tokenVersion: result.admin.tokenVersion,
    });

    return NextResponse.json({
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
      trial: {
        plan: settings.trialPlan,
        days: settings.trialDays,
        endsAt: trialEndsAt,
      },
      admin: {
        id: result.admin.id,
        email: result.admin.email,
        name: result.admin.name,
        role: result.admin.role,
      },
      token,
    }, { status: 201 });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json(
        {
          error: "Un compte ou un restaurant utilisant déjà ces informations existe.",
          code: "PUBLIC_REGISTRATION_CONFLICT",
        },
        { status: 409 },
      );
    }
    console.error("[register-restaurant POST]", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du restaurant. Veuillez réessayer." },
      { status: 500 },
    );
  }
}
