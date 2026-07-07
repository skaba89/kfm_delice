import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth";

// GET — Get current admin's account info + restaurants + quotas
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    if (!admin.accountId) {
      return NextResponse.json({ error: "Aucun compte associé" }, { status: 404 });
    }

    const account = await db.account.findUnique({
      where: { id: admin.accountId },
      include: {
        restaurants: { select: { id: true, name: true, slug: true, type: true, status: true, plan: true } },
      },
    });

    if (!account) return NextResponse.json({ error: "Compte non trouvé" }, { status: 404 });

    const restaurantCount = account.restaurants.length;
    const secondaryCount = account.restaurants.filter(r => r.type === "secondary").length;

    return NextResponse.json(bigIntToNumber({
      account: {
        id: account.id,
        name: account.name,
        status: account.status,
        plan: account.plan,
      },
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        canCreateRestaurant: admin.canCreateRestaurant,
        restaurantCreationLimit: admin.restaurantCreationLimit,
        restaurantsCreatedCount: admin.restaurantsCreatedCount,
      },
      restaurants: account.restaurants,
      quotas: {
        maxRestaurants: account.maxRestaurants,
        usedRestaurants: restaurantCount,
        remainingRestaurants: Math.max(0, account.maxRestaurants - restaurantCount),
        maxSecondaryRestaurants: account.maxSecondaryRestaurants,
        usedSecondaryRestaurants: secondaryCount,
        remainingSecondaryRestaurants: Math.max(0, account.maxSecondaryRestaurants - secondaryCount),
        maxAdmins: account.maxAdmins,
        maxUsers: account.maxUsers,
      },
    }));
  } catch (error) {
    console.error("[account/me GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
