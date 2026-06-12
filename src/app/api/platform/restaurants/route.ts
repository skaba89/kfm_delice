import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";
import { z } from "zod";

// ────────────────────────────────────────────────────────────────
// GET /api/platform/restaurants — List all restaurants (platform admin)
// ────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Accès plateforme requis" }, { status: 403 });
    }

    const restaurants = await db.restaurant.findMany({
      orderBy: { createdAt: "desc" },
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

    // Calculate stats
    const totalRestaurants = restaurants.length;
    const activeRestaurants = restaurants.filter((r) => r.status === "active").length;
    const trialRestaurants = restaurants.filter((r) => r.status === "trial").length;

    // Revenue estimation based on plans
    const planPrices: Record<string, number> = {
      free: 0,
      starter: 50000,
      pro: 150000,
      enterprise: 500000,
    };
    const totalRevenue = restaurants
      .filter((r) => r.status === "active" || r.status === "trial")
      .reduce((sum, r) => sum + (planPrices[r.plan] || 0), 0);

    return NextResponse.json({
      data: restaurants,
      stats: { totalRestaurants, activeRestaurants, trialRestaurants, totalRevenue },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────────
// PATCH /api/platform/restaurants — Update restaurant status/plan
// ────────────────────────────────────────────────────────────────

const platformPatchSchema = z.object({
  id: z.string().min(1, "ID requis"),
  status: z.enum(["active", "trial", "suspended", "cancelled"]).optional(),
  plan: z.enum(["free", "starter", "pro", "enterprise"]).optional(),
});

export async function PATCH(request: Request) {
  try {
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Accès plateforme requis" }, { status: 403 });
    }

    const body = await request.json();
    const validation = platformPatchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const { id, ...data } = validation.data;

    const restaurant = await db.restaurant.update({
      where: { id },
      data,
    });

    // Invalidate caches
    const { invalidateConfigCache } = await import("@/lib/constants");
    const { invalidateTenantCache } = await import("@/lib/tenant");
    invalidateConfigCache(restaurant.slug);
    invalidateTenantCache(restaurant.slug);

    return NextResponse.json(restaurant);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
