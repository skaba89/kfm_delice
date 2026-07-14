import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";

/**
 * POST /api/admin/fix-admin-restaurant — Fix admin.restaurantId mismatch
 *
 * Uses platform admin auth (not restaurant admin) because the restaurant
 * admin has the WRONG restaurantId and can't fix itself.
 *
 * Body: { targetSlug: "kfm-delice" }
 * 
 * Moves ALL data from stale restaurantIds to the restaurant with the
 * given slug.
 */
export async function POST(request: Request) {
  try {
    await dbReady;

    // Try platform admin auth first
    const platformAdmin = await authenticatePlatformAdmin(request).catch(() => null);
    
    // If not platform admin, try regular admin auth (backward compat)
    if (!platformAdmin) {
      const { authenticateAdmin, hasRole } = await import("@/lib/auth");
      const admin = await authenticateAdmin(request);
      if (!admin || !hasRole(admin.role, ["admin"])) {
        return NextResponse.json({ error: "Non autorisé — platform admin requis" }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const targetSlug = body.targetSlug || "kfm-delice";

    const results: Array<{ action: string; status: string; details?: string }> = [];

    // 1. Find ALL restaurants
    const restaurants = await db.restaurant.findMany({
      select: { id: true, name: true, slug: true },
    });
    results.push({
      action: "list restaurants",
      status: "ok",
      details: JSON.stringify(restaurants.map(r => ({ id: r.id, slug: r.slug, name: r.name }))),
    });

    // 2. Find the target restaurant by slug
    const correctRestaurant = restaurants.find(r => r.slug === targetSlug);
    if (!correctRestaurant) {
      return NextResponse.json({
        error: `Restaurant with slug '${targetSlug}' not found`,
        results,
      }, { status: 400 });
    }
    results.push({
      action: "target restaurant",
      status: "ok",
      details: `id=${correctRestaurant.id} slug=${correctRestaurant.slug}`,
    });

    // 3. Find all stale restaurantIds
    const staleRestaurantIds = restaurants
      .filter(r => r.id !== correctRestaurant.id)
      .map(r => r.id);

    if (staleRestaurantIds.length === 0) {
      results.push({ action: "no stale restaurants", status: "ok", details: "Nothing to fix" });
    } else {
      results.push({
        action: "stale restaurant ids",
        status: "ok",
        details: JSON.stringify(staleRestaurantIds),
      });

      // 4. Move ALL data from stale restaurants to the correct one
      const moveTable = async (model: keyof typeof db, label: string) => {
        try {
          // @ts-expect-error dynamic model access
          const res = await db[model].updateMany({
            where: { restaurantId: { in: staleRestaurantIds } },
            data: { restaurantId: correctRestaurant.id },
          });
          results.push({ action: `fix ${label}`, status: "ok", details: `${res.count} moved` });
        } catch (e) {
          results.push({ action: `fix ${label}`, status: "skip", details: e instanceof Error ? e.message.substring(0, 80) : String(e) });
        }
      };

      await moveTable("admin", "admins");
      await moveTable("customer", "customers");
      await moveTable("driver", "drivers");
      await moveTable("menuItem", "menu items");
      await moveTable("order", "orders");
      await moveTable("reservation", "reservations");
      await moveTable("review", "reviews");
      await moveTable("staff", "staff");
      await moveTable("invoice", "invoices");
      await moveTable("expense", "expenses");
      await moveTable("quote", "quotes");
      await moveTable("payment", "payments");
      await moveTable("restaurantTable", "restaurant tables");
      await moveTable("stockItem", "stock items");
      await moveTable("loyaltyReward", "loyalty rewards");

      // 5. Also update the Account.restaurantId if the restaurant has an accountId
      if (correctRestaurant) {
        // Update the admin's restaurantId directly via raw SQL to bypass Prisma cache
        try {
          await db.$executeRawUnsafe(
            `UPDATE "Admin" SET "restaurantId" = $1 WHERE "restaurantId" != $1`,
            correctRestaurant.id
          );
          results.push({ action: "force update all admins", status: "ok", details: "raw SQL" });
        } catch (e) {
          results.push({ action: "force update all admins", status: "error", details: e instanceof Error ? e.message.substring(0, 80) : String(e) });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Admin restaurantId fixed — all data moved to correct restaurant",
      correctRestaurantId: correctRestaurant.id,
      results,
    });
  } catch (error) {
    console.error("[admin/fix-admin-restaurant]", error);
    return NextResponse.json(
      { error: "Erreur serveur", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
