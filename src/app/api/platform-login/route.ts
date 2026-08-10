import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { verifyTwoFactorCode, verifyBackupCode, removeBackupCode } from "@/lib/two-factor";
import { jwtVerify, SignJWT } from "jose";
import { issueTokenPair, setRefreshTokenCookie } from "@/lib/refresh-token";

const DEV_FALLBACK_SECRET = "kfm-delice-dev-secret-change-in-prod";
const TEMP_ISSUER = "kfm-delice";
const TEMP_AUDIENCE = "kfm-delice-platform-2fa";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET manquant ou trop court en production");
  }
  return new TextEncoder().encode(DEV_FALLBACK_SECRET);
}

async function createPlatformSession(admin: {
  id: string;
  email: string;
  name: string;
  role: string;
  tokenVersion: number;
}, request: Request) {
  const tokenPair = await issueTokenPair({
    userId: admin.id,
    userType: "platform_admin",
    email: admin.email,
    role: admin.role,
    tokenVersion: admin.tokenVersion,
  });

  await logAudit({
    actorId: admin.id,
    actorType: "platform_admin",
    action: "platform_login_success",
    entityType: "PlatformAdmin",
    entityId: admin.id,
    request,
  }).catch(() => {});

  const response = NextResponse.json({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    token: tokenPair.accessToken,
    refreshTokenExpiresAt: tokenPair.expiresAt.toISOString(),
  });
  setRefreshTokenCookie(response, tokenPair.refreshToken, tokenPair.expiresAt);
  return response;
}

export async function POST(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const { allowed } = await rateLimit(clientIp, 5, 60000);
  if (!allowed) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans une minute." }, { status: 429 });
  }

  try {
    await dbReady;
    const body = await request.json();
    const { email, password, tempToken, twoFactorCode } = body;

    if (tempToken && twoFactorCode) {
      let tempPayload: { id: string; email: string; type: string };
      try {
        const { payload } = await jwtVerify(tempToken, getJwtSecret(), {
          issuer: TEMP_ISSUER,
          audience: TEMP_AUDIENCE,
        });
        if (payload.type !== "platform_2fa_temp") {
          return NextResponse.json({ error: "Token invalide" }, { status: 401 });
        }
        tempPayload = payload as unknown as { id: string; email: string; type: string };
      } catch {
        return NextResponse.json({ error: "Token expiré ou invalide" }, { status: 401 });
      }

      const admin = await db.platformAdmin.findUnique({
        where: { id: tempPayload.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          tokenVersion: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
          twoFactorBackupCodes: true,
        },
      });

      if (!admin || admin.status === "inactive" || !admin.twoFactorEnabled) {
        return NextResponse.json({ error: "Compte ou 2FA invalide" }, { status: 403 });
      }

      let verified = false;
      if (admin.twoFactorSecret) {
        verified = verifyTwoFactorCode(admin.twoFactorSecret, twoFactorCode);
      }

      if (!verified && admin.twoFactorBackupCodes) {
        const backupIndex = verifyBackupCode(twoFactorCode, admin.twoFactorBackupCodes);
        if (backupIndex >= 0) {
          verified = true;
          await db.platformAdmin.update({
            where: { id: admin.id },
            data: { twoFactorBackupCodes: removeBackupCode(admin.twoFactorBackupCodes, backupIndex) },
          });
        }
      }

      if (!verified) {
        return NextResponse.json({ error: "Code 2FA invalide" }, { status: 401 });
      }

      return createPlatformSession(admin, request);
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }

    const platformAdmin = await db.platformAdmin.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        role: true,
        status: true,
        tokenVersion: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!platformAdmin || !(await verifyPassword(password, platformAdmin.password))) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    if (platformAdmin.status === "inactive") {
      return NextResponse.json({ error: "Compte désactivé" }, { status: 403 });
    }

    if (platformAdmin.twoFactorEnabled && platformAdmin.twoFactorSecret) {
      const tempToken = await new SignJWT({
        id: platformAdmin.id,
        email: platformAdmin.email,
        type: "platform_2fa_temp",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer(TEMP_ISSUER)
        .setAudience(TEMP_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(getJwtSecret());

      return NextResponse.json({
        requiresTwoFactor: true,
        tempToken,
        message: "Entrez le code à 6 chiffres de votre app d'authentification.",
      });
    }

    return createPlatformSession(platformAdmin, request);
  } catch (error) {
    console.error("[platform-login] Error:", error);
    return NextResponse.json({ error: "Erreur de connexion" }, { status: 500 });
  }
}
