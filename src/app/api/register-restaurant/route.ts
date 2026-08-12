import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { validatePassword } from "@/lib/password-policy";
import { isPlatformEmailDeliveryConfigured, sendPlatformEmail } from "@/lib/platform-email";
import { publicRegistrationRequestSchema } from "@/lib/public-registration-contract";
import {
  calculateVerificationExpiry,
  escapePublicEmailHtml,
  generatePublicVerificationToken,
  getPublicOnboardingSettings,
  hashPublicIdentityKey,
  hashPublicVerificationToken,
  normalizePublicOwnerEmail,
} from "@/lib/public-onboarding";

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

function resolveVerificationBaseUrl(request: Request): string | null {
  const configured = process.env.PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (process.env.NODE_ENV !== "production" || parsed.protocol === "https:") return parsed.origin;
    } catch {
      return null;
    }
  }

  if (process.env.NODE_ENV === "production") return null;
  return new URL(request.url).origin;
}

function buildVerificationEmail(params: {
  ownerName: string;
  restaurantName: string;
  verificationUrl: string;
  expiresAt: Date;
}) {
  const ownerName = escapePublicEmailHtml(params.ownerName);
  const restaurantName = escapePublicEmailHtml(params.restaurantName);
  const verificationUrl = escapePublicEmailHtml(params.verificationUrl);
  const expiresAt = escapePublicEmailHtml(params.expiresAt.toLocaleString("fr-FR", { timeZone: "UTC" }));

  return {
    subject: "Confirmez votre email pour créer votre compte KFM Delice",
    html: `<!doctype html>
<html lang="fr">
<body style="margin:0;background:#f5f5f4;font-family:Arial,sans-serif;color:#1c1917">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:14px;padding:32px">
    <h1 style="margin-top:0;color:#ea580c">Confirmez votre adresse email</h1>
    <p>Bonjour ${ownerName},</p>
    <p>Vous avez demandé la création du restaurant <strong>${restaurantName}</strong> sur KFM Delice.</p>
    <p>Aucun compte SaaS ni restaurant n’a encore été créé. Confirmez votre email pour poursuivre :</p>
    <p style="margin:28px 0">
      <a href="${verificationUrl}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:700">Confirmer mon email</a>
    </p>
    <p style="font-size:13px;color:#78716c">Ce lien expire le ${expiresAt} UTC. Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.</p>
  </div>
</body>
</html>`,
  };
}

export async function GET() {
  const settings = getPublicOnboardingSettings();
  return NextResponse.json({
    enabled: settings.enabled,
    trialPlan: settings.trialPlan,
    trialDays: settings.trialDays,
    verificationRequired: true,
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

  if (!isPlatformEmailDeliveryConfigured()) {
    return NextResponse.json(
      {
        error: "La vérification email n’est pas disponible. Contactez l’équipe KFM Delice.",
        code: "PUBLIC_REGISTRATION_EMAIL_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  const baseUrl = resolveVerificationBaseUrl(request);
  if (!baseUrl) {
    return NextResponse.json(
      {
        error: "Configuration URL publique invalide pour la vérification email.",
        code: "PUBLIC_REGISTRATION_URL_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  const ip = clientIp(request);
  const ipLimit = await rateLimit(`public-registration:${ip}`, 3, 60_000);
  if (!ipLimit.allowed) {
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
    const validation = publicRegistrationRequestSchema.safeParse(await request.json());
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
    const emailLimit = await rateLimit(
      `public-registration-email:${hashPublicIdentityKey(ownerEmail)}`,
      3,
      15 * 60_000,
    );
    if (!emailLimit.allowed) {
      return NextResponse.json(
        {
          error: "Trop de demandes de vérification pour cet email. Réessayez plus tard.",
          code: "PUBLIC_REGISTRATION_EMAIL_RATE_LIMITED",
        },
        { status: 429 },
      );
    }

    const passwordCheck = validatePassword(data.ownerPassword);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.errors[0], code: "PUBLIC_REGISTRATION_WEAK_PASSWORD" },
        { status: 400 },
      );
    }

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

    const now = new Date();
    const verificationToken = generatePublicVerificationToken();
    const tokenHash = hashPublicVerificationToken(verificationToken);
    const expiresAt = calculateVerificationExpiry(now, settings.verificationTtlMinutes);
    const passwordHash = await hashPassword(data.ownerPassword);
    const payload = JSON.stringify({
      ...data,
      ownerEmail,
      ownerPassword: undefined,
      trialPlan: settings.trialPlan,
      trialDays: settings.trialDays,
    });

    const intent = await db.publicRegistrationIntent.upsert({
      where: { ownerEmail },
      create: {
        ownerEmail,
        tokenHash,
        payload,
        passwordHash,
        status: "pending",
        expiresAt,
      },
      update: {
        tokenHash,
        payload,
        passwordHash,
        status: "pending",
        expiresAt,
      },
    });

    const verificationUrl = `${baseUrl}/onboard/verify?token=${encodeURIComponent(verificationToken)}`;
    const email = buildVerificationEmail({
      ownerName: data.ownerName,
      restaurantName: data.restaurantName,
      verificationUrl,
      expiresAt,
    });
    const delivery = await sendPlatformEmail({
      to: ownerEmail,
      subject: email.subject,
      html: email.html,
    });

    if (!delivery.success) {
      // Delete only the exact token created by this request. A concurrent resend
      // may already have replaced it with a newer token and must not be removed.
      await db.publicRegistrationIntent.deleteMany({
        where: { id: intent.id, tokenHash },
      }).catch(() => undefined);
      return NextResponse.json(
        {
          error: "Impossible d’envoyer l’email de vérification. Réessayez plus tard.",
          code: "PUBLIC_REGISTRATION_EMAIL_DELIVERY_FAILED",
        },
        { status: 503 },
      );
    }

    await logAudit({
      actorId: `public:${hashPublicIdentityKey(ownerEmail).slice(0, 16)}`,
      actorType: "public",
      action: "public_registration_verification_sent",
      entityType: "PublicRegistrationIntent",
      entityId: intent.id,
      after: {
        trialPlan: settings.trialPlan,
        trialDays: settings.trialDays,
        expiresAt: expiresAt.toISOString(),
        provider: delivery.provider,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      verificationRequired: true,
      ownerEmail,
      expiresAt: expiresAt.toISOString(),
    }, { status: 202 });
  } catch (error) {
    console.error("[register-restaurant POST]", error);
    return NextResponse.json(
      { error: "Erreur lors de la préparation de l'inscription. Veuillez réessayer." },
      { status: 500 },
    );
  }
}
