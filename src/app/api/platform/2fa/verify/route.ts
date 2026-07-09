import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";
import {
  verifyTwoFactorCode,
  generateBackupCodes,
} from "@/lib/two-factor";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/platform/2fa/verify
 * Verifies the TOTP code and enables 2FA by saving the secret + backup codes.
 *
 * Body: { secret: string, code: string }
 */
export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Accès plateforme requis" }, { status: 403 });
    }

    const body = await request.json();
    const { secret, code } = body;

    if (!secret || !code) {
      return NextResponse.json(
        { error: "Secret et code requis" },
        { status: 400 }
      );
    }

    // Verify the TOTP code against the provided secret
    const isValid = verifyTwoFactorCode(secret, code);
    if (!isValid) {
      return NextResponse.json(
        { error: "Code invalide. Vérifiez que votre app affiche le bon code." },
        { status: 400 }
      );
    }

    // Generate backup codes
    const { codes, hashes } = generateBackupCodes();

    // Save secret + backup codes + enable 2FA
    await db.platformAdmin.update({
      where: { id: admin.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        twoFactorBackupCodes: hashes,
      },
    });

    // Audit log (non-blocking)
    await logAudit({
      actorId: admin.id,
      actorType: "platform_admin",
      action: "2fa_enabled",
      entityType: "PlatformAdmin",
      entityId: admin.id,
      request,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      backupCodes: codes,
      message: "2FA activée. Conservez vos codes de secours en lieu sûr.",
    });
  } catch (error) {
    console.error("[2fa/verify] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
