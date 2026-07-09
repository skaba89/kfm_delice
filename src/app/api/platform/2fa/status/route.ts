import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";

/**
 * GET /api/platform/2fa/status
 * Returns whether 2FA is enabled for the authenticated platform admin.
 */
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Accès plateforme requis" }, { status: 403 });
    }

    const platformAdmin = await db.platformAdmin.findUnique({
      where: { id: admin.id },
      select: { twoFactorEnabled: true },
    });

    return NextResponse.json({
      enabled: platformAdmin?.twoFactorEnabled ?? false,
    });
  } catch (error) {
    console.error("[2fa/status] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
