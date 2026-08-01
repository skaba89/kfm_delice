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

    // Generate new secret — Mission 7: returns both plaintext + encrypted
    const { secret, encryptedSecret, uri } = generateTwoFactorSecret(admin.email);
    const qrCodeDataUrl = await generateQRCodeDataUrl(uri);

    // Mission 7: Store the ENCRYPTED secret in DB immediately as "pending".
    // The verify endpoint will set twoFactorEnabled=true after the user
    // provides a valid code. This prevents the plaintext secret from
    // being transmitted back-and-forth between client and server.
    // The plaintext is returned ONCE here so the user can scan the QR.
    await db.platformAdmin.update({
      where: { id: admin.id },
      data: {
        twoFactorSecret: encryptedSecret, // AES-256-GCM encrypted
        twoFactorEnabled: false, // not enabled until verified
      },
    });

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
