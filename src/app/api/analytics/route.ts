import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateAdmin, hasRole } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    if (!hasRole(admin.role, ['admin', 'manager'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) return NextResponse.json({ error: 'Restaurant non trouvé' }, { status: 404 });

    const rid = restaurant.id;

    // ─── Time boundaries ──────────────────────────────────────
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = thisMonthStart;

    // ─── DB-level queries (no full table scans) ───────────────
    const [
      recentOrders,
      ordersByTypeRaw,
      reviewAgg,
      reviewCount,
      thisMonthAgg,
      lastMonthAgg,
      revenueByPaymentCash,
      revenueByPaymentOrange,
      revenueByPaymentMtn,
      revenueByPaymentCard,
      deliveredOrders,
      // For top dishes — limit to last 500 orders (JSON parsing needed)
      recentOrdersForDishes,
    ] = await Promise.all([
      // Revenue by day (last 7 days) — only select needed fields
      db.order.findMany({
        where: { restaurantId: rid, createdAt: { gte: sevenDaysAgo }, status: { not: 'cancelled' } },
        select: { createdAt: true, total: true },
      }),
      // Orders by type — DB-level counts
      db.order.groupBy({
        by: ['orderType'],
        where: { restaurantId: rid, status: { not: 'cancelled' } },
        _count: { orderType: true },
      }),
      // Avg rating
      db.review.aggregate({ where: { restaurantId: rid }, _avg: { rating: true } }),
      // Review count
      db.review.count({ where: { restaurantId: rid } }),
      // This month revenue
      db.order.aggregate({
        where: { restaurantId: rid, createdAt: { gte: thisMonthStart }, status: { not: 'cancelled' } },
        _sum: { total: true }, _count: true,
      }),
      // Last month revenue
      db.order.aggregate({
        where: { restaurantId: rid, createdAt: { gte: lastMonthStart, lt: lastMonthEnd }, status: { not: 'cancelled' } },
        _sum: { total: true }, _count: true,
      }),
      // Revenue by payment method — use aggregation instead of loading all orders
      db.order.aggregate({ where: { restaurantId: rid, paymentMethod: 'cash', status: { not: 'cancelled' } }, _sum: { total: true } }),
      db.order.aggregate({ where: { restaurantId: rid, paymentMethod: 'orange_money', status: { not: 'cancelled' } }, _sum: { total: true } }),
      db.order.aggregate({ where: { restaurantId: rid, paymentMethod: 'mtn_money', status: { not: 'cancelled' } }, _sum: { total: true } }),
      db.order.aggregate({ where: { restaurantId: rid, paymentMethod: 'card', status: { not: 'cancelled' } }, _sum: { total: true } }),
      // Delivered orders for avg delivery time (select only needed fields)
      db.order.findMany({
        where: { restaurantId: rid, status: 'delivered', orderType: 'delivery' },
        select: { createdAt: true, updatedAt: true },
      }),
      // Top dishes — last 500 non-cancelled orders (JSON parsing needed)
      db.order.findMany({
        where: { restaurantId: rid, status: { not: 'cancelled' } },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: { items: true },
      }),
    ]);

    // ─── Revenue by day (last 7 days) ─────────────────────────
    const revenueByDay = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dayStr = date.toISOString().split('T')[0];
      const dayOrders = recentOrders.filter(o => o.createdAt.toISOString().split('T')[0] === dayStr);
      return { date: dayStr, revenue: dayOrders.reduce((sum, o) => sum + o.total, 0), count: dayOrders.length };
    });

    // ─── Top selling dishes (JSON parsing — limited dataset) ──
    const dishSales: Record<string, { name: string; qty: number; revenue: number }> = {};
    recentOrdersForDishes.forEach(order => {
      try {
        const items = JSON.parse(order.items || '[]') as { name: string; price: number; qty: number }[];
        items.forEach(item => {
          if (!dishSales[item.name]) dishSales[item.name] = { name: item.name, qty: 0, revenue: 0 };
          dishSales[item.name].qty += item.qty;
          dishSales[item.name].revenue += item.price * item.qty;
        });
      } catch { /* skip malformed items */ }
    });
    const topDishes = Object.values(dishSales).sort((a, b) => b.qty - a.qty).slice(0, 10);

    // ─── Orders by type ───────────────────────────────────────
    const ordersByType = {
      dine_in: ordersByTypeRaw.find(g => g.orderType === 'dine_in')?._count.orderType ?? 0,
      takeaway: ordersByTypeRaw.find(g => g.orderType === 'takeaway')?._count.orderType ?? 0,
      delivery: ordersByTypeRaw.find(g => g.orderType === 'delivery')?._count.orderType ?? 0,
    };

    // ─── Orders by hour (all-time, only select createdAt) ─────
    const allOrderDates = await db.order.findMany({
      where: { restaurantId: rid, status: { not: 'cancelled' } },
      select: { createdAt: true },
    });
    const ordersByHour = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: allOrderDates.filter(o => new Date(o.createdAt).getHours() === h).length,
    }));

    // ─── Revenue by payment ───────────────────────────────────
    const revenueByPayment = {
      cash: revenueByPaymentCash._sum.total || 0,
      orange_money: revenueByPaymentOrange._sum.total || 0,
      mtn_money: revenueByPaymentMtn._sum.total || 0,
      card: revenueByPaymentCard._sum.total || 0,
    };

    // ─── Avg delivery time ────────────────────────────────────
    const avgDeliveryMinutes = deliveredOrders.length > 0
      ? deliveredOrders.reduce((sum, o) => sum + (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 60000, 0) / deliveredOrders.length
      : 0;

    const avgRating = reviewAgg._avg.rating ? Math.round(reviewAgg._avg.rating * 10) / 10 : 0;

    return NextResponse.json({
      revenueByDay,
      topDishes,
      ordersByType,
      ordersByHour,
      revenueByPayment,
      avgDeliveryMinutes: Math.round(avgDeliveryMinutes),
      avgRating,
      reviewCount,
      thisMonthRevenue: thisMonthAgg._sum.total || 0,
      lastMonthRevenue: lastMonthAgg._sum.total || 0,
      thisMonthOrders: thisMonthAgg._count,
      lastMonthOrders: lastMonthAgg._count,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
