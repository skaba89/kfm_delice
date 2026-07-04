import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { parseJsonField } from "@/lib/parse-json";

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

// GET: Admin/Manager auth required
//
// All queries use the Prisma client (not raw SQL) so they work on both
// SQLite and PostgreSQL. Raw SQL like `FROM Order` fails on PostgreSQL
// because:
//   - `Order` is a reserved keyword and must be quoted as `"Order"`
//   - Unquoted identifiers are folded to lowercase
// Prisma handles quoting automatically.
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager", "accountant"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const rid = admin.restaurantId;
    const today = new Date().toISOString().split("T")[0];

    // Get restaurant info
    const restaurant = await db.restaurant.findUnique({
      where: { id: rid },
      select: { id: true, deliveryFee: true, minDelivery: true },
    });
    if (!restaurant) {
      return NextResponse.json(EMPTY_STATS);
    }

    // ─── Counts via Prisma ────────────────────────────────────────
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
      db.reservation.count({ where: { restaurantId: rid, date: today } }),
      db.reservation.count({ where: { restaurantId: rid, status: 'pending' } }),
      db.order.count({ where: { restaurantId: rid } }),
      db.order.count({ where: { restaurantId: rid, status: { in: ['pending', 'preparing', 'ready', 'delivering'] } } }),
      db.order.count({ where: { restaurantId: rid, orderType: 'delivery' } }),
      db.order.count({ where: { restaurantId: rid, orderType: 'delivery', status: 'delivering' } }),
      db.order.count({ where: { restaurantId: rid, orderType: 'dine_in' } }),
      db.order.count({ where: { restaurantId: rid, orderType: 'takeaway' } }),
      db.driver.count({ where: { restaurantId: rid, status: 'available' } }),
      db.driver.count({ where: { restaurantId: rid } }),
      db.review.count({ where: { restaurantId: rid } }),
      db.menuItem.count({ where: { restaurantId: rid } }),
      db.staff.count({ where: { restaurantId: rid } }),
      db.customer.count({ where: { restaurantId: rid } }),
      db.admin.count({ where: { restaurantId: rid } }),
      db.invoice.count({ where: { restaurantId: rid, status: 'pending' } }),
      db.quote.count({ where: { restaurantId: rid, status: 'sent' } }),
      db.expense.count({ where: { restaurantId: rid } }),
      db.payment.count({ where: { restaurantId: rid, status: 'pending' } }),
    ]);

    // ─── Revenue & ratings ────────────────────────────────────────
    // Note: createdAt is a DateTime, so we compare against a Date object
    // (not the string `today`). Using a string worked accidentally on
    // SQLite due to TEXT storage, but PostgreSQL with TIMESTAMP requires
    // a proper Date comparison.
    const todayStartDate = new Date(today + 'T00:00:00.000Z');
    const todayOrders = await db.order.findMany({
      where: {
        restaurantId: rid,
        createdAt: { gte: todayStartDate },
        status: { not: 'cancelled' },
      },
      select: { total: true, deliveryFee: true },
    });
    const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total) + Number(o.deliveryFee || 0), 0);

    const deliveredDeliveryOrders = await db.order.aggregate({
      where: { restaurantId: rid, orderType: 'delivery', status: 'delivered' },
      _sum: { deliveryFee: true },
    });
    const deliveryRevenue = Number(deliveredDeliveryOrders._sum.deliveryFee ?? 0);

    const reviewAgg = await db.review.aggregate({
      where: { restaurantId: rid },
      _avg: { rating: true },
    });
    const avgRating = reviewAgg._avg.rating ? Math.round(reviewAgg._avg.rating * 10) / 10 : 0;

    // ─── Recent reservations ──────────────────────────────────────
    const recentReservationsRaw = await db.reservation.findMany({
      where: { restaurantId: rid },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, customerName: true, date: true, time: true, guests: true, zone: true, status: true },
    });
    const recentReservations = recentReservationsRaw.map((r) => ({
      id: r.id,
      customerName: r.customerName,
      date: r.date,
      time: r.time,
      guests: r.guests,
      zone: r.zone,
      status: r.status,
    }));

    // ─── Popular dishes ───────────────────────────────────────────
    const menuItems = await db.menuItem.findMany({
      where: { restaurantId: rid },
      select: { name: true, price: true, category: true },
    });

    const recentOrders = await db.order.findMany({
      where: { restaurantId: rid, status: { not: 'cancelled' } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { items: true },
    });
    const dishCounts: Record<string, number> = {};
    recentOrders.forEach((o) => {
      try {
        const items = parseJsonField(o.items, []) as { name: string; price: number; qty?: number; quantity?: number }[];
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
        return {
          name,
          count,
          price: mi ? Number(mi.price) : 0,
          category: mi?.category || "",
        };
      });

    // ─── Orders by hour ───────────────────────────────────────────
    const todayOrdersForHours = await db.order.findMany({
      where: {
        restaurantId: rid,
        createdAt: { gte: todayStartDate },
        status: { not: 'cancelled' },
      },
      select: { createdAt: true },
    });
    const ordersByHour: { hour: string; count: number }[] = [];
    for (let h = 11; h <= 22; h++) {
      const hStr = `${h.toString().padStart(2, "0")}`;
      const count = todayOrdersForHours.filter(o => new Date(o.createdAt).getHours() === h).length;
      ordersByHour.push({ hour: `${hStr}:00`, count });
    }

    return NextResponse.json({
      todayReservations, pendingReservations, todayRevenue,
      totalOrders, activeOrders, avgRating,
      totalReviews, popularDishes, recentReservations,
      deliveryOrders, activeDeliveries, availableDrivers, totalDrivers,
      deliveryRevenue, dineInOrders, takeawayOrders, ordersByHour,
      deliveryFee: Number(restaurant.deliveryFee),
      minDelivery: Number(restaurant.minDelivery),
      menuCount, staffCount, customerCount, adminCount,
      pendingInvoices, sentQuotes, expenseCount, pendingPayments,
    });
  } catch (error) {
    console.error("[stats] Error:", error);
    // Return empty stats instead of 500 so the dashboard can still render
    return NextResponse.json(EMPTY_STATS);
  }
}
