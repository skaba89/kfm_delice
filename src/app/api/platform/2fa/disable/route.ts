import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";
import { verifyTwoFactorCode, verifyBackupCode, removeBackupCode } from "@/lib/two-factor";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/platform/2fa/disable
 * Disables 2FA after verifying either a TOTP code or a backup code.
 *
 * Body: { code: string } — can be a TOTP code OR a backup code
 */
export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Accès plateforme requis" }, { status: 403 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: "Code requis" }, { status: 400 });
    }

    const platformAdmin = await db.platformAdmin.findUnique({
      where: { id: admin.id },
      select: {
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!platformAdmin?.twoFactorEnabled) {
      return NextResponse.json({ error: "2FA n'est pas activée" }, { status: 400 });
    }

    // Try TOTP code first
    let verified = false;
    if (platformAdmin.twoFactorSecret) {
      verified = verifyTwoFactorCode(platformAdmin.twoFactorSecret, code);
    }

    // If TOTP failed, try backup code
    if (!verified && platformAdmin.twoFactorBackupCodes) {
      const backupIndex = verifyBackupCode(code, platformAdmin.twoFactorBackupCodes);
      if (backupIndex >= 0) {
        verified = true;
        // Remove the used backup code
        const updatedHashes = removeBackupCode(
          platformAdmin.twoFactorBackupCodes,
          backupIndex
        );
        await db.platformAdmin.update({
          where: { id: admin.id },
          data: { twoFactorBackupCodes: updatedHashes },
        });
      }
    }

    if (!verified) {
      return NextResponse.json(
        { error: "Code invalide" },
        { status: 400 }
      );
    }

    // Disable 2FA
    await db.platformAdmin.update({
      where: { id: admin.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      },
    });

    // Audit log
    await logAudit({
      actorId: admin.id,
      actorType: "platform_admin",
      action: "2fa_disabled",
      entityType: "PlatformAdmin",
      entityId: admin.id,
      request,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "2FA désactivée",
    });
  } catch (error) {
    console.error("[2fa/disable] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
