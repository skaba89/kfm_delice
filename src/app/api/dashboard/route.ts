import { db, getRestaurantId } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth";

// Combined dashboard endpoint — returns ALL admin data in a single request
// This replaces 11 separate API calls with 1, dramatically reducing page load time
export async function GET(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const rid = await getRestaurantId();
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

    // ─── Stats queries (DB-level, no full table scans) ──────────────
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
      db.reservation.count({ where: { restaurantId: rid, date: today } }),
      db.reservation.count({ where: { restaurantId: rid, status: "pending" } }),
      db.order.count({ where: { restaurantId: rid } }),
      db.order.count({ where: { restaurantId: rid, status: { in: ["pending", "preparing", "ready", "delivering"] } } }),
      db.order.count({ where: { restaurantId: rid, orderType: "delivery" } }),
      db.order.count({ where: { restaurantId: rid, orderType: "delivery", status: "delivering" } }),
      db.order.count({ where: { restaurantId: rid, orderType: "dine_in" } }),
      db.order.count({ where: { restaurantId: rid, orderType: "takeaway" } }),
      db.driver.count({ where: { restaurantId: rid, status: "available" } }),
      db.driver.count({ where: { restaurantId: rid } }),
      db.review.count({ where: { restaurantId: rid } }),
      db.review.aggregate({ where: { restaurantId: rid }, _avg: { rating: true } }),
      db.order.findMany({
        where: { restaurantId: rid, createdAt: { gte: new Date(today) }, status: { not: "cancelled" } },
        select: { total: true, deliveryFee: true },
      }),
      db.order.aggregate({
        where: { restaurantId: rid, orderType: "delivery", status: "delivered" },
        _sum: { deliveryFee: true },
      }),
      db.reservation.findMany({
        where: { restaurantId: rid },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, customerName: true, date: true, time: true, guests: true, zone: true, status: true },
      }),
      db.menuItem.findMany({
        where: { restaurantId: rid },
        select: { name: true, price: true, category: true },
      }),
    ]);

    const todayRevenue = todayOrderStats.reduce((sum, o) => sum + o.total + (o.deliveryFee || 0), 0);
    const avgRating = reviewAgg._avg.rating ? Math.round(reviewAgg._avg.rating * 10) / 10 : 0;
    const deliveryRevenue = deliveryRevenueAgg._sum.deliveryFee || 0;

    // Popular dishes from recent orders
    const recentOrders = await db.order.findMany({
      where: { restaurantId: rid, status: { not: "cancelled" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { items: true },
    });
    const dishCounts: Record<string, number> = {};
    recentOrders.forEach((o) => {
      try {
        const items = JSON.parse(o.items) as { name: string; qty: number }[];
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
    const todayOrdersByHour = await db.order.findMany({
      where: { restaurantId: rid, createdAt: { gte: new Date(today) }, status: { not: "cancelled" } },
      select: { createdAt: true },
    });
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
    const [
      reservations, menuItems, orders, drivers, reviews,
      staff, admins, invoices, quotes, expenses,
    ] = await Promise.all([
      db.reservation.findMany({
        where: { restaurantId: rid },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      db.menuItem.findMany({
        where: { restaurantId: rid },
        orderBy: { order: "asc" },
        take: 1000,
      }),
      db.order.findMany({
        where: { restaurantId: rid },
        orderBy: { createdAt: "desc" },
        include: { driver: true },
        take: 1000,
      }),
      db.driver.findMany({
        where: { restaurantId: rid },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      db.review.findMany({
        where: { restaurantId: rid },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      db.staff.findMany({
        where: { restaurantId: rid },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      db.admin.findMany({
        orderBy: { createdAt: "desc" },
        take: 1000,
        select: { id: true, email: true, name: true, role: true, status: true, createdAt: true, updatedAt: true },
      }),
      db.invoice.findMany({
        where: { restaurantId: rid },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      db.quote.findMany({
        where: { restaurantId: rid },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      db.expense.findMany({
        where: { restaurantId: rid },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
    ]);

    return NextResponse.json({
      stats,
      reservations,
      menuItems,
      orders,
      drivers,
      reviews,
      staff,
      admins,
      invoices,
      quotes,
      expenses,
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
