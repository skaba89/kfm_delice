import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin"])) return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });

    const results: Array<{ action: string; status: string; details?: string }> = [];

    const restaurants = await db.restaurant.findMany({ select: { id: true, name: true, slug: true } });
    results.push({ action: "list restaurants", status: "ok", details: JSON.stringify(restaurants.map(r => ({ id: r.id, slug: r.slug, name: r.name }))) });

    const correctRestaurant = restaurants.find(r => r.slug === "kfm-delice");
    if (!correctRestaurant) {
      return NextResponse.json({ error: "Restaurant with slug 'kfm-delice' not found. Run fix-slugs first.", results }, { status: 400 });
    }
    results.push({ action: "correct restaurant", status: "ok", details: `id=${correctRestaurant.id} slug=${correctRestaurant.slug}` });

    const staleRestaurantIds = restaurants.filter(r => r.id !== correctRestaurant.id).map(r => r.id);
    if (staleRestaurantIds.length === 0) {
      results.push({ action: "no stale restaurants", status: "ok", details: "Nothing to fix" });
      return NextResponse.json({ ok: true, message: "No fix needed", results });
    }
    results.push({ action: "stale restaurant ids", status: "ok", details: JSON.stringify(staleRestaurantIds) });

    const moveTable = async (model: keyof typeof db, label: string) => {
      try {
        // @ts-expect-error dynamic model access
        const res = await db[model].updateMany({ where: { restaurantId: { in: staleRestaurantIds } }, data: { restaurantId: correctRestaurant.id } });
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

    return NextResponse.json({
      ok: true,
      message: "Admin restaurantId fixed — all data moved to correct restaurant",
      correctRestaurantId: correctRestaurant.id,
      results,
    });
  } catch (error) {
    console.error("[admin/fix-admin-restaurant]", error);
    return NextResponse.json({ error: "Erreur serveur", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
