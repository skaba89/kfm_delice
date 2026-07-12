import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * DELETE /api/platform/restaurants/[id]
 * Delete a restaurant and all its related data (cascade).
 * Platform admin only.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Accès plateforme requis" }, { status: 403 });
    }

    const { id } = await params;

    // Verify the restaurant exists
    const restaurant = await db.restaurant.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, accountId: true, type: true },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
    }

    // Prevent deleting the last principal restaurant of an account
    // (only if the account still has other restaurants)
    if (restaurant.accountId && restaurant.type === "principal") {
      const otherRestaurants = await db.restaurant.count({
        where: {
          accountId: restaurant.accountId,
          id: { not: id },
        },
      });
      if (otherRestaurants > 0) {
        return NextResponse.json(
          { error: "Supprimez d'abord les restaurants secondaires de ce compte avant de supprimer le restaurant principal." },
          { status: 400 }
        );
      }
    }

    // Delete the restaurant (cascade will handle related data)
    await db.restaurant.delete({ where: { id } });

    // Audit log
    await logAudit({
      actorId: admin.id,
      actorType: "platform_admin",
      action: "restaurant_deleted",
      entityType: "Restaurant",
      entityId: id,
      accountId: restaurant.accountId,
      before: { name: restaurant.name, slug: restaurant.slug },
      request,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Restaurant "${restaurant.name}" supprimé avec toutes ses données`,
    });
  } catch (error) {
    console.error("[platform/restaurants/[id]] DELETE error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * GET /api/platform/restaurants/[id]
 * Get detailed info about a specific restaurant.
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

    const { id } = await params;

    const restaurant = await db.restaurant.findUnique({
      where: { id },
      include: {
        config: { select: { primaryColor: true, logo: true } },
        _count: {
          select: {
            orders: true,
            customers: true,
            admins: true,
            menuItems: true,
          },
        },
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
    }

    return NextResponse.json({ data: restaurant });
  } catch (error) {
    console.error("[platform/restaurants/[id]] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
