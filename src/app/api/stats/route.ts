import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";

// Default stats response for empty/error states
const EMPTY_STATS = {
  todayReservations: 0, pendingReservations: 0, todayRevenue: 0,
  totalOrders: 0, activeOrders: 0, avgRating: 0, totalReviews: 0,
  popularDishes: [] as { name: string; count: number; price: number; category: string }[],
  recentReservations: [] as { id: string; customerName: string; date: string; time: string; guests: number; zone: string; status: string }[],
  deliveryOrders: 0, activeDeliveries: 0, availableDrivers: 0, totalDrivers: 0,
  deliveryRevenue: 0, dineInOrders: 0, takeawayOrders: 0,
  ordersByHour: [] as { hour: string; count: number }[],
  deliveryFee: 0, minDelivery: 0,
  menuCount: 0, staffCount: 0, customerCount: 0, adminCount: 0,
  pendingInvoices: 0, sentQuotes: 0, expenseCount: 0, pendingPayments: 0,
};

// Safe raw SQL count — returns 0 if table doesn't exist or query fails
async function safeCount(query: string, params: unknown[] = []): Promise<number> {
  try {
    const result = await db.$queryRawUnsafe<Array<{ count: bigint }>>(query, ...params);
    return result[0] ? Number(result[0].count) : 0;
  } catch {
    return 0;
  }
}

// Safe raw SQL query — returns empty array if table doesn't exist or query fails
// Also converts BigInt to Number for JSON serialization
async function safeQuery<T>(query: string, params: unknown[] = []): Promise<T[]> {
  try {
    const results = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(query, ...params);
    return results.map(r => bigIntToNumber(r) as T);
  } catch {
    return [] as T[];
  }
}

// GET: Admin/Manager auth required
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const rid = admin.restaurantId;
    const today = new Date().toISOString().split("T")[0];

    // Get restaurant info via raw SQL to avoid schema mismatch
    const restaurants = await safeQuery<{ deliveryFee: number; minDelivery: number }>(
      "SELECT deliveryFee, minDelivery FROM Restaurant WHERE id = ?",
      [rid]
    );
    const restaurant = restaurants[0];
    if (!restaurant) {
      return NextResponse.json(EMPTY_STATS);
    }

    // ─── Counts via raw SQL (safe against missing columns) ────────
    const [
      todayReservations,
      pendingReservations,
      totalOrders,
      activeOrders,
      deliveryOrders,
      activeDeliveries,
      dineInOrders,
      takeawayOrders,
      availableDrivers,
      totalDrivers,
      totalReviews,
      menuCount,
      staffCount,
      customerCount,
      adminCount,
      pendingInvoices,
      sentQuotes,
      expenseCount,
      pendingPayments,
    ] = await Promise.all([
      safeCount("SELECT COUNT(*) as count FROM Reservation WHERE restaurantId = ? AND date = ?", [rid, today]),
      safeCount("SELECT COUNT(*) as count FROM Reservation WHERE restaurantId = ? AND status = 'pending'", [rid]),
      safeCount("SELECT COUNT(*) as count FROM `Order` WHERE restaurantId = ?", [rid]),
      safeCount("SELECT COUNT(*) as count FROM `Order` WHERE restaurantId = ? AND status IN ('pending', 'preparing', 'ready', 'delivering')", [rid]),
      safeCount("SELECT COUNT(*) as count FROM `Order` WHERE restaurantId = ? AND orderType = 'delivery'", [rid]),
      safeCount("SELECT COUNT(*) as count FROM `Order` WHERE restaurantId = ? AND orderType = 'delivery' AND status = 'delivering'", [rid]),
      safeCount("SELECT COUNT(*) as count FROM `Order` WHERE restaurantId = ? AND orderType = 'dine_in'", [rid]),
      safeCount("SELECT COUNT(*) as count FROM `Order` WHERE restaurantId = ? AND orderType = 'takeaway'", [rid]),
      safeCount("SELECT COUNT(*) as count FROM Driver WHERE restaurantId = ? AND status = 'available'", [rid]),
      safeCount("SELECT COUNT(*) as count FROM Driver WHERE restaurantId = ?", [rid]),
      safeCount("SELECT COUNT(*) as count FROM Review WHERE restaurantId = ?", [rid]),
      safeCount("SELECT COUNT(*) as count FROM MenuItem WHERE restaurantId = ?", [rid]),
      safeCount("SELECT COUNT(*) as count FROM Staff WHERE restaurantId = ?", [rid]),
      safeCount("SELECT COUNT(*) as count FROM Customer WHERE restaurantId = ?", [rid]),
      safeCount("SELECT COUNT(*) as count FROM Admin WHERE restaurantId = ?", [rid]),
      safeCount("SELECT COUNT(*) as count FROM Invoice WHERE restaurantId = ? AND status = 'pending'", [rid]),
      safeCount("SELECT COUNT(*) as count FROM Quote WHERE restaurantId = ? AND status = 'sent'", [rid]),
      safeCount("SELECT COUNT(*) as count FROM Expense WHERE restaurantId = ?", [rid]),
      safeCount("SELECT COUNT(*) as count FROM Payment WHERE restaurantId = ? AND status = 'pending'", [rid]),
    ]);

    // ─── Revenue & ratings via raw SQL ────────────────────────────
    const todayOrderStats = await safeQuery<{ total: number; deliveryFee: number }>(
      "SELECT total, deliveryFee FROM `Order` WHERE restaurantId = ? AND createdAt >= ? AND status != 'cancelled'",
      [rid, today]
    );
    const todayRevenue = todayOrderStats.reduce((sum, o) => sum + o.total + (o.deliveryFee || 0), 0);

    const deliveryRevenueResult = await safeQuery<{ total: number }>(
      "SELECT COALESCE(SUM(deliveryFee), 0) as total FROM `Order` WHERE restaurantId = ? AND orderType = 'delivery' AND status = 'delivered'",
      [rid]
    );
    const deliveryRevenue = Number(deliveryRevenueResult[0]?.total ?? 0);

    const reviewAggResult = await safeQuery<{ avgRating: number | null }>(
      "SELECT AVG(rating) as avgRating FROM Review WHERE restaurantId = ?",
      [rid]
    );
    const avgRating = reviewAggResult[0]?.avgRating ? Math.round(reviewAggResult[0].avgRating * 10) / 10 : 0;

    // ─── Recent reservations via raw SQL ──────────────────────────
    const recentReservations = await safeQuery<{ id: string; customerName: string; date: string; time: string; guests: number; zone: string; status: string }>(
      "SELECT id, customerName, date, time, guests, zone, status FROM Reservation WHERE restaurantId = ? ORDER BY createdAt DESC LIMIT 5",
      [rid]
    );

    // ─── Popular dishes ───────────────────────────────────────────
    const menuItems = await safeQuery<{ name: string; price: number; category: string }>(
      "SELECT name, price, category FROM MenuItem WHERE restaurantId = ?",
      [rid]
    );

    const recentOrders = await safeQuery<{ items: string }>(
      "SELECT items FROM `Order` WHERE restaurantId = ? AND status != 'cancelled' ORDER BY createdAt DESC LIMIT 200",
      [rid]
    );
    const dishCounts: Record<string, number> = {};
    recentOrders.forEach((o) => {
      try {
        // Accept both `qty` and `quantity` (see orders/route.ts for the same fix)
        const items = JSON.parse(o.items) as { name: string; price: number; qty?: number; quantity?: number }[];
        items.forEach((item) => {
          const qty = item.qty ?? item.quantity ?? 1;
          if (item.name) dishCounts[item.name] = (dishCounts[item.name] || 0) + qty;
        });
      } catch { /* skip */ }
    });
    const popularDishes = Object.entries(dishCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => {
        const mi = menuItems.find((m) => m.name === name);
        return { name, count, price: mi?.price || 0, category: mi?.category || "" };
      });

    // ─── Orders by hour ───────────────────────────────────────────
    const todayOrdersByHour = await safeQuery<{ createdAt: string }>(
      "SELECT createdAt FROM `Order` WHERE restaurantId = ? AND createdAt >= ? AND status != 'cancelled'",
      [rid, today]
    );
    const ordersByHour: { hour: string; count: number }[] = [];
    for (let h = 11; h <= 22; h++) {
      const hStr = `${h.toString().padStart(2, "0")}`;
      const count = todayOrdersByHour.filter(o => new Date(o.createdAt).getHours() === h).length;
      ordersByHour.push({ hour: `${hStr}:00`, count });
    }

    return NextResponse.json({
      todayReservations, pendingReservations, todayRevenue,
      totalOrders, activeOrders, avgRating,
      totalReviews, popularDishes, recentReservations,
      deliveryOrders, activeDeliveries, availableDrivers, totalDrivers,
      deliveryRevenue, dineInOrders, takeawayOrders, ordersByHour,
      deliveryFee: restaurant.deliveryFee,
      minDelivery: restaurant.minDelivery,
      menuCount, staffCount, customerCount, adminCount,
      pendingInvoices, sentQuotes, expenseCount, pendingPayments,
    });
  } catch (error) {
    console.error("[stats] Error:", error);
    // Return empty stats instead of 500 so the dashboard can still render
    return NextResponse.json(EMPTY_STATS);
  }
}
