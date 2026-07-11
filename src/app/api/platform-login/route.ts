import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword, generateToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { verifyTwoFactorCode, verifyBackupCode, removeBackupCode } from "@/lib/two-factor";
import { jwtVerify, SignJWT } from "jose";

// ────────────────────────────────────────────────────────────────
// Platform Admin Login — super-admin for SaaS platform management
// Supports 2FA TOTP: if 2FA is enabled, returns a tempToken that
// must be exchanged for a real token via the twoFactorCode field.
// ────────────────────────────────────────────────────────────────

const DEV_FALLBACK_SECRET = "kfm-delice-dev-secret-change-in-prod";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return new TextEncoder().encode(secret);
  return new TextEncoder().encode(DEV_FALLBACK_SECRET);
}

export async function POST(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const { allowed } = await rateLimit(clientIp, 5, 60000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans une minute." },
      { status: 429 }
    );
  }

  try {
    await dbReady;

    const body = await request.json();
    const { email, password, tempToken, twoFactorCode } = body;

    // ── Step 2: Verify 2FA code with tempToken ──────────────────
    if (tempToken && twoFactorCode) {
      // Verify the temp token
      let tempPayload: { id: string; email: string; type: string };
      try {
        const { payload } = await jwtVerify(tempToken, getJwtSecret());
        if (payload.type !== "platform_2fa_temp") {
          return NextResponse.json({ error: "Token invalide" }, { status: 401 });
        }
        tempPayload = payload as unknown as { id: string; email: string; type: string };
      } catch {
        return NextResponse.json({ error: "Token expiré ou invalide" }, { status: 401 });
      }

      // Fetch the platform admin with 2FA fields
      const admin = await db.platformAdmin.findUnique({
        where: { id: tempPayload.id },
        select: {
          id: true, email: true, name: true, role: true, status: true,
          twoFactorEnabled: true, twoFactorSecret: true, twoFactorBackupCodes: true,
        },
      });

      if (!admin || !admin.twoFactorEnabled) {
        return NextResponse.json({ error: "2FA non activée" }, { status: 400 });
      }

      // Try TOTP code first
      let verified = false;
      if (admin.twoFactorSecret) {
        verified = verifyTwoFactorCode(admin.twoFactorSecret, twoFactorCode);
      }

      // If TOTP failed, try backup code
      if (!verified && admin.twoFactorBackupCodes) {
        const backupIndex = verifyBackupCode(twoFactorCode, admin.twoFactorBackupCodes);
        if (backupIndex >= 0) {
          verified = true;
          const updatedHashes = removeBackupCode(admin.twoFactorBackupCodes, backupIndex);
          await db.platformAdmin.update({
            where: { id: admin.id },
            data: { twoFactorBackupCodes: updatedHashes },
          });
        }
      }

      if (!verified) {
        return NextResponse.json({ error: "Code 2FA invalide" }, { status: 401 });
      }

      // Generate the real platform token
      const token = generateToken({
        id: admin.id,
        email: admin.email,
        role: admin.role,
        type: "platform_admin",
      });

      await logAudit({
        actorId: admin.id,
        actorType: "platform_admin",
        action: "platform_login_success",
        entityType: "PlatformAdmin",
        entityId: admin.id,
        request,
      }).catch(() => {});

      return NextResponse.json({
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        token,
      });
    }

    // ── Step 1: Check email + password ──────────────────────────
    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }

    const platformAdmin = await db.platformAdmin.findUnique({
      where: { email },
      select: {
        id: true, email: true, password: true, name: true, role: true, status: true,
        twoFactorEnabled: true, twoFactorSecret: true,
      },
    });

    if (!platformAdmin) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, platformAdmin.password);
    if (!isValid) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    if (platformAdmin.status === "inactive") {
      return NextResponse.json({ error: "Compte désactivé" }, { status: 403 });
    }

    // ── If 2FA is enabled, return a temp token ──────────────────
    if (platformAdmin.twoFactorEnabled && platformAdmin.twoFactorSecret) {
      // Generate a short-lived temp token (5 minutes) for 2FA verification
      const tempToken = await new SignJWT({
        id: platformAdmin.id,
        email: platformAdmin.email,
        type: "platform_2fa_temp",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(getJwtSecret());

      return NextResponse.json({
        requiresTwoFactor: true,
        tempToken,
        message: "Entrez le code à 6 chiffres de votre app d'authentification.",
      });
    }

    // ── No 2FA: return token directly ───────────────────────────
    const token = generateToken({
      id: platformAdmin.id,
      email: platformAdmin.email,
      role: platformAdmin.role,
      type: "platform_admin",
    });

    await logAudit({
      actorId: platformAdmin.id,
      actorType: "platform_admin",
      action: "platform_login_success",
      entityType: "PlatformAdmin",
      entityId: platformAdmin.id,
      request,
    }).catch(() => {});

    return NextResponse.json({
      id: platformAdmin.id,
      email: platformAdmin.email,
      name: platformAdmin.name,
      role: platformAdmin.role,
      token,
    });
  } catch (error) {
    console.error("[platform-login] Error:", error);
    return NextResponse.json({ error: "Erreur de connexion" }, { status: 500 });
  }
}
