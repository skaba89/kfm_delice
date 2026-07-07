import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth";

// GET — Get quota info for the current admin's account
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
      include: { _count: { select: { restaurants: true } } },
    });

    if (!account) return NextResponse.json({ error: "Compte non trouvé" }, { status: 404 });

    const restaurants = await db.restaurant.findMany({
      where: { accountId: admin.accountId },
      select: { type: true },
    });

    const usedRestaurants = restaurants.length;
    const usedSecondaryRestaurants = restaurants.filter(r => r.type === "secondary").length;

    return NextResponse.json({
      maxRestaurants: account.maxRestaurants,
      usedRestaurants,
      remainingRestaurants: Math.max(0, account.maxRestaurants - usedRestaurants),
      maxSecondaryRestaurants: account.maxSecondaryRestaurants,
      usedSecondaryRestaurants,
      remainingSecondaryRestaurants: Math.max(0, account.maxSecondaryRestaurants - usedSecondaryRestaurants),
      status: account.status,
      plan: account.plan,
    });
  } catch (error) {
    console.error("[account/quota GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
