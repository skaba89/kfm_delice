import { db, bigIntToNumber } from "@/lib/db";
import { getRestaurantId } from "@/lib/tenant";
import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth";
import { parseJsonField } from "@/lib/parse-json";

// Combined dashboard endpoint — returns ALL admin data in a single request
// This replaces 11 separate API calls with 1, dramatically reducing page load time
export async function GET(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const rid = await getRestaurantId(request);
    if (!rid) {
      // Return empty dashboard data instead of 404 — prevents client crashes
      return NextResponse.json({
        stats: {
          todayReservations: 0, pendingReservations: 0, todayRevenue: 0,
          totalOrders: 0, activeOrders: 0, avgRating: 0, totalReviews: 0,
          popularDishes: [], recentReservations: [],
          deliveryOrders: 0, activeDeliveries: 0, availableDrivers: 0,
          totalDrivers: 0, deliveryRevenue: 0, dineInOrders: 0, takeawayOrders: 0,
          ordersByHour: [],
        },
        reservations: [], menuItems: [], orders: [], drivers: [],
        reviews: [], staff: [], admins: [], invoices: [], quotes: [], expenses: [],
      });
    }

    const today = new Date().toISOString().split("T")[0];

    // ─── Helper: safe query wrapper ──────────────────────────────
    // If a query fails (e.g. missing column), return a fallback value
    // instead of crashing the entire dashboard. This makes the endpoint
    // resilient to partial schema mismatches during migration.
    async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
      try { return await fn(); } catch (e) { console.warn("[dashboard] query failed:", e instanceof Error ? e.message : String(e)); return fallback; }
    }

    // ─── Stats queries (DB-level, no full table scans) ──────────────
    // Each query is wrapped in safeQuery so a single failure doesn't
    // crash the entire dashboard.
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
      reviewAgg,
      todayOrderStats,
      deliveryRevenueAgg,
      recentReservations,
      menuItemsForPopular,
    ] = await Promise.all([
      safeQuery(() => db.reservation.count({ where: { restaurantId: rid, date: today } }), 0),
      safeQuery(() => db.reservation.count({ where: { restaurantId: rid, status: "pending" } }), 0),
      safeQuery(() => db.order.count({ where: { restaurantId: rid } }), 0),
      safeQuery(() => db.order.count({ where: { restaurantId: rid, status: { in: ["pending", "preparing", "ready", "delivering"] } } }), 0),
      safeQuery(() => db.order.count({ where: { restaurantId: rid, orderType: "delivery" } }), 0),
      safeQuery(() => db.order.count({ where: { restaurantId: rid, orderType: "delivery", status: "delivering" } }), 0),
      safeQuery(() => db.order.count({ where: { restaurantId: rid, orderType: "dine_in" } }), 0),
      safeQuery(() => db.order.count({ where: { restaurantId: rid, orderType: "takeaway" } }), 0),
      safeQuery(() => db.driver.count({ where: { restaurantId: rid, status: "available" } }), 0),
      safeQuery(() => db.driver.count({ where: { restaurantId: rid } }), 0),
      safeQuery(() => db.review.count({ where: { restaurantId: rid } }), 0),
      safeQuery(() => db.review.aggregate({ where: { restaurantId: rid }, _avg: { rating: true } }), { _avg: { rating: null } }),
      safeQuery(() => db.order.findMany({
        where: { restaurantId: rid, createdAt: { gte: new Date(today) }, status: { not: "cancelled" } },
        select: { total: true, deliveryFee: true },
      }), []),
      safeQuery(() => db.order.aggregate({
        where: { restaurantId: rid, orderType: "delivery", status: "delivered" },
        _sum: { deliveryFee: true },
      }), { _sum: { deliveryFee: null } }),
      safeQuery(() => db.reservation.findMany({
        where: { restaurantId: rid },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, customerName: true, date: true, time: true, guests: true, zone: true, status: true },
      }), []),
      safeQuery(() => db.menuItem.findMany({
        where: { restaurantId: rid },
        select: { name: true, price: true, category: true },
      }), []),
    ]);

    // Convert BigInt → Number for arithmetic. On SQLite these fields are
    // `number` (Int) and Number() is a no-op. On PostgreSQL they are
    // `bigint` and Number() is required for `+` to work correctly
    // (otherwise bigint + bigint = bigint, which would silently truncate).
    const todayRevenue = todayOrderStats.reduce(
      (sum, o) => sum + Number(o.total) + Number(o.deliveryFee || 0),
      0
    );
    const avgRating = reviewAgg._avg.rating ? Math.round(reviewAgg._avg.rating * 10) / 10 : 0;
    const deliveryRevenue = Number(deliveryRevenueAgg._sum.deliveryFee || 0);

    // Popular dishes from recent orders
    const recentOrders = await safeQuery(() => db.order.findMany({
      where: { restaurantId: rid, status: { not: "cancelled" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { items: true },
    }), [] as { items: unknown }[]);
    const dishCounts: Record<string, number> = {};
    recentOrders.forEach((o) => {
      try {
        const items = parseJsonField(o.items, []) as { name: string; qty: number }[];
        items.forEach((item) => { dishCounts[item.name] = (dishCounts[item.name] || 0) + item.qty; });
      } catch { /* skip */ }
    });
    const popularDishes = Object.entries(dishCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => {
        const mi = menuItemsForPopular.find((m) => m.name === name);
        return { name, count, price: mi?.price || 0, category: mi?.category || "" };
      });

    // Orders by hour for today
    const todayOrdersByHour = await safeQuery(() => db.order.findMany({
      where: { restaurantId: rid, createdAt: { gte: new Date(today) }, status: { not: "cancelled" } },
      select: { createdAt: true },
    }), [] as { createdAt: Date }[]);
    const ordersByHour: { hour: string; count: number }[] = [];
    for (let h = 11; h <= 22; h++) {
      const hStr = `${h.toString().padStart(2, "0")}`;
      const count = todayOrdersByHour.filter(o => new Date(o.createdAt).getHours() === h).length;
      ordersByHour.push({ hour: `${hStr}:00`, count });
    }

    const stats = {
      todayReservations, pendingReservations, todayRevenue,
      totalOrders, activeOrders, avgRating,
      totalReviews, popularDishes, recentReservations,
      deliveryOrders, activeDeliveries, availableDrivers, totalDrivers,
      deliveryRevenue, dineInOrders, takeawayOrders, ordersByHour,
    };

    // ─── Data lists (with limit=1000 for admin view) ───────────────
    // Each list is wrapped in safeQuery so a single table failure
    // (e.g. StockItem not created yet) doesn't crash the entire dashboard.
    const [
      reservations, menuItems, orders, drivers, reviews,
      staff, admins, invoices, quotes, expenses,
    ] = await Promise.all([
      safeQuery(() => db.reservation.findMany({ where: { restaurantId: rid }, orderBy: { createdAt: "desc" }, take: 1000 }), []),
      safeQuery(() => db.menuItem.findMany({ where: { restaurantId: rid }, orderBy: { order: "asc" }, take: 1000 }), []),
      safeQuery(() => db.order.findMany({ where: { restaurantId: rid }, orderBy: { createdAt: "desc" }, include: { driver: true }, take: 1000 }), []),
      safeQuery(() => db.driver.findMany({ where: { restaurantId: rid }, orderBy: { createdAt: "desc" }, take: 1000 }), []),
      safeQuery(() => db.review.findMany({ where: { restaurantId: rid }, orderBy: { createdAt: "desc" }, take: 1000 }), []),
      safeQuery(() => db.staff.findMany({ where: { restaurantId: rid }, orderBy: { createdAt: "desc" }, take: 1000 }), []),
      safeQuery(() => db.admin.findMany({ orderBy: { createdAt: "desc" }, take: 1000, select: { id: true, email: true, name: true, role: true, status: true, createdAt: true, updatedAt: true } }), []),
      safeQuery(() => db.invoice.findMany({ where: { restaurantId: rid }, orderBy: { createdAt: "desc" }, take: 1000 }), []),
      safeQuery(() => db.quote.findMany({ where: { restaurantId: rid }, orderBy: { createdAt: "desc" }, take: 1000 }), []),
      safeQuery(() => db.expense.findMany({ where: { restaurantId: rid }, orderBy: { createdAt: "desc" }, take: 1000 }), []),
    ]);

    return NextResponse.json({
      // bigIntToNumber wraps all BigInt fields in nested Prisma objects
      // (orders, drivers, invoices, quotes, expenses, menuItems) for JSON
      // serialization. On SQLite these are already number (no-op); on
      // PostgreSQL they are bigint and JSON.stringify would throw without
      // this conversion.
      stats,
      reservations: bigIntToNumber(reservations),
      menuItems: bigIntToNumber(menuItems),
      orders: bigIntToNumber(orders),
      drivers: bigIntToNumber(drivers),
      reviews: bigIntToNumber(reviews),
      staff: bigIntToNumber(staff),
      admins: bigIntToNumber(admins),
      invoices: bigIntToNumber(invoices),
      quotes: bigIntToNumber(quotes),
      expenses: bigIntToNumber(expenses),
    });
  } catch (error) {
    console.error(`[API GET /api/dashboard]`, error);
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json(
      { error: "Erreur serveur", detail: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 }
    );
  }
}
