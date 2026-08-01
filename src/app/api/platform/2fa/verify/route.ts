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
 * Verifies the TOTP code and enables 2FA.
 *
 * Mission 7: The secret is already stored ENCRYPTED in the DB (from /setup).
 * The client only sends the 6-digit code — not the secret. The server
 * loads the encrypted secret from the DB, decrypts it, and verifies the code.
 *
 * Body: { code: string }
 */
export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Accès plateforme requis" }, { status: 403 });
    }

    const body = await request.json();
    const { code } = body as { code?: string };

    if (!code) {
      return NextResponse.json(
        { error: "Code requis" },
        { status: 400 }
      );
    }

    // ── Mission 7: Load the ENCRYPTED secret from DB (not from client) ──
    const adminRecord = await db.platformAdmin.findUnique({
      where: { id: admin.id },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!adminRecord?.twoFactorSecret) {
      return NextResponse.json(
        { error: "Aucun secret 2FA en attente. Appelez /setup d'abord." },
        { status: 400 }
      );
    }
    if (adminRecord.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA déjà activée" },
        { status: 400 }
      );
    }

    // Verify the TOTP code against the ENCRYPTED secret (decrypted internally)
    const isValid = verifyTwoFactorCode(adminRecord.twoFactorSecret, code);
    if (!isValid) {
      return NextResponse.json(
        { error: "Code invalide. Vérifiez que votre app affiche le bon code." },
        { status: 400 }
      );
    }

    // Generate backup codes
    const { codes, hashes } = generateBackupCodes();

    // Enable 2FA — the encrypted secret is already stored, just flip the flag
    await db.platformAdmin.update({
      where: { id: admin.id },
      data: {
        twoFactorEnabled: true,
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
