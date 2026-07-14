import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";

/**
 * GET /api/platform/accounts/[id]/admins
 * List all admins linked to a specific SaaS account.
 * Platform admin only. Never returns password hashes.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Accès plateforme requis" }, { status: 403 });
    }

    const { id: accountId } = await params;

    const admins = await db.admin.findMany({
      where: { accountId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        accountId: true,
        restaurantId: true,
        canCreateRestaurant: true,
        restaurantCreationLimit: true,
        restaurantsCreatedCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: admins });
  } catch (error) {
    console.error("[platform/accounts/[id]/admins] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
