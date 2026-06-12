import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";

// GET: Admin/Manager auth required
export async function GET(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const rid = admin.restaurantId;
    const restaurant = await db.restaurant.findUnique({ where: { id: rid }, select: { deliveryFee: true, minDelivery: true } });
    if (!restaurant) {
      return NextResponse.json({
        todayReservations: 0, pendingReservations: 0, todayRevenue: 0,
        totalOrders: 0, activeOrders: 0, avgRating: 0, totalReviews: 0,
        popularDishes: [], recentReservations: [],
        deliveryOrders: 0, activeDeliveries: 0, availableDrivers: 0, totalDrivers: 0,
        deliveryRevenue: 0, dineInOrders: 0, takeawayOrders: 0,
        ordersByHour: [],
        menuCount: 0, staffCount: 0, customerCount: 0, adminCount: 0,
        pendingInvoices: 0, sentQuotes: 0, expenseCount: 0, pendingPayments: 0,
      });
    }

    const today = new Date().toISOString().split("T")[0];

    // ─── DB-level counts (no full table scan) ──────────────────
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
      menuItems,
      // Badge counts (avoid loading full arrays just for sidebar badges)
      menuCount,
      staffCount,
      customerCount,
      adminCount,
      pendingInvoices,
      sentQuotes,
      expenseCount,
      pendingPayments,
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
      // Today's non-cancelled orders: sum of total + deliveryFee
      db.order.findMany({
        where: { restaurantId: rid, createdAt: { gte: new Date(today) }, status: { not: "cancelled" } },
        select: { total: true, deliveryFee: true },
      }),
      // Delivery revenue: sum of deliveryFee for delivered orders
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
      // Badge counts — efficient DB-level counts for sidebar
      db.menuItem.count({ where: { restaurantId: rid } }),
      db.staff.count({ where: { restaurantId: rid } }),
      db.customer.count({ where: { restaurantId: rid } }),
      db.admin.count({ where: { restaurantId: rid } }),
      db.invoice.count({ where: { restaurantId: rid, status: "pending" } }),
      db.quote.count({ where: { restaurantId: rid, status: "sent" } }),
      db.expense.count({ where: { restaurantId: rid } }),
      db.payment.count({ where: { restaurantId: rid, status: "pending" } }),
    ]);

    const todayRevenue = todayOrderStats.reduce((sum, o) => sum + o.total + (o.deliveryFee || 0), 0);
    const avgRating = reviewAgg._avg.rating ? Math.round(reviewAgg._avg.rating * 10) / 10 : 0;
    const deliveryRevenue = deliveryRevenueAgg._sum.deliveryFee || 0;

    // ─── Popular dishes (needs JSON parsing — small dataset from recent orders) ──
    const recentOrders = await db.order.findMany({
      where: { restaurantId: rid, status: { not: "cancelled" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { items: true },
    });
    const dishCounts: Record<string, number> = {};
    recentOrders.forEach((o) => {
      try {
        const items = JSON.parse(o.items) as { name: string; price: number; qty: number }[];
        items.forEach((item) => { dishCounts[item.name] = (dishCounts[item.name] || 0) + item.qty; });
      } catch { /* skip */ }
    });
    const popularDishes = Object.entries(dishCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => {
        const mi = menuItems.find((m) => m.name === name);
        return { name, count, price: mi?.price || 0, category: mi?.category || "" };
      });

    // ─── Orders by hour (for today's chart) ───────────────────
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

    return NextResponse.json({
      todayReservations, pendingReservations, todayRevenue,
      totalOrders, activeOrders, avgRating,
      totalReviews, popularDishes, recentReservations,
      deliveryOrders, activeDeliveries, availableDrivers, totalDrivers,
      deliveryRevenue, dineInOrders, takeawayOrders, ordersByHour,
      deliveryFee: restaurant.deliveryFee,
      minDelivery: restaurant.minDelivery,
      // Badge counts for sidebar (avoid loading full arrays just for counts)
      menuCount, staffCount, customerCount, adminCount,
      pendingInvoices, sentQuotes, expenseCount, pendingPayments,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
