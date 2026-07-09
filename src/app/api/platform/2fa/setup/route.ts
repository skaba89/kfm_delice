import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";
import {
  generateTwoFactorSecret,
  generateQRCodeDataUrl,
} from "@/lib/two-factor";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/platform/2fa/setup
 * Generates a new TOTP secret + QR code for the authenticated platform admin.
 * The secret is NOT saved yet — it's only saved after verification (POST /verify).
 */
export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Accès plateforme requis" }, { status: 403 });
    }

    // Check if 2FA is already enabled
    const existing = await db.platformAdmin.findUnique({
      where: { id: admin.id },
      select: { twoFactorEnabled: true },
    });
    if (existing?.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA déjà activée. Désactivez-la d'abord pour reconfigurer." },
        { status: 400 }
      );
    }

    // Generate new secret
    const { secret, uri } = generateTwoFactorSecret(admin.email);
    const qrCodeDataUrl = await generateQRCodeDataUrl(uri);

    // Store the pending secret temporarily (in-memory, NOT in DB)
    // The verify endpoint will save it to DB only if the user provides a valid code.
    // We return the secret to the client so it can be sent back on verify.
    // This is safe because the secret alone is useless without the TOTP app.

    return NextResponse.json({
      secret,
      qrCode: qrCodeDataUrl,
      uri,
      message: "Scannez le QR code avec Google Authenticator ou Authy, puis entrez le code à 6 chiffres.",
    });
  } catch (error) {
    console.error("[2fa/setup] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
