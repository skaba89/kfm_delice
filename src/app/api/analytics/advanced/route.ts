import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";

// GET /api/analytics/advanced — advanced analytics dashboard data
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "accountant"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    // Revenue last 7 days (daily breakdown)
    const last7DaysOrders = await db.order.findMany({
      where: {
        restaurantId: admin.restaurantId,
        createdAt: { gte: startOfWeek },
        status: { not: "cancelled" },
      },
      select: { total: true, tip: true, platformCommission: true, createdAt: true, orderType: true, items: true },
      orderBy: { createdAt: "asc" },
    });

    const dailyRevenue: Array<{ date: string; revenue: number; orders: number }> = [];
    const dayMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of last7DaysOrders) {
      const dayKey = new Date(o.createdAt).toISOString().slice(0, 10);
      const existing = dayMap.get(dayKey) || { revenue: 0, orders: 0 };
      existing.revenue += Number(o.total) + Number(o.tip);
      existing.orders += 1;
      dayMap.set(dayKey, existing);
    }
    for (const [date, data] of dayMap) {
      dailyRevenue.push({ date, ...data });
    }

    // Order type breakdown
    const orderTypes = { dine_in: 0, takeaway: 0, delivery: 0 };
    for (const o of last7DaysOrders) {
      orderTypes[o.orderType as keyof typeof orderTypes] = (orderTypes[o.orderType as keyof typeof orderTypes] || 0) + 1;
    }

    // Top selling items (by frequency in orders)
    const allItems = last7DaysOrders.map(o => {
      try { return JSON.parse(o.items as string) as Array<{ name: string; qty?: number }>; }
      catch { return []; }
    }).flat();
    const itemCounts = new Map<string, number>();
    for (const item of allItems) {
      itemCounts.set(item.name, (itemCounts.get(item.name) || 0) + (item.qty || 1));
    }
    const topItems = Array.from(itemCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Margins (Reco 2) — average margin across menu
    const menuItems = await db.menuItem.findMany({
      where: { restaurantId: admin.restaurantId, available: true },
      select: { price: true, ingredientCost: true },
    });
    const margins = menuItems.map(m => {
      const price = Number(m.price);
      const cost = Number(m.ingredientCost || 0);
      return { price, cost, margin: price - cost, marginPercent: price > 0 ? ((price - cost) / price) * 100 : 0 };
    });
    const avgMargin = margins.length > 0
      ? margins.reduce((sum, m) => sum + m.marginPercent, 0) / margins.length
      : 0;

    // Hourly distribution (peak hours)
    const hourlyOrders = new Array(24).fill(0);
    for (const o of last7DaysOrders) {
      const hour = new Date(o.createdAt).getHours();
      hourlyOrders[hour]++;
    }
    const peakHours = hourlyOrders
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // This month totals
    const monthOrders = await db.order.count({
      where: {
        restaurantId: admin.restaurantId,
        createdAt: { gte: startOfMonth },
        status: { not: "cancelled" },
      },
    });
    const monthRevenue = last7DaysOrders
      .filter(o => new Date(o.createdAt) >= startOfMonth)
      .reduce((sum, o) => sum + Number(o.total) + Number(o.tip), 0);

    return NextResponse.json({
      dailyRevenue,
      orderTypes,
      topItems,
      peakHours,
      avgMargin: Math.round(avgMargin * 10) / 10,
      monthOrders,
      monthRevenue,
      totalTips: last7DaysOrders.reduce((s, o) => s + Number(o.tip), 0),
      totalCommission: last7DaysOrders.reduce((s, o) => s + Number(o.platformCommission || 0), 0),
    });
  } catch (error) {
    console.error("[analytics/advanced:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
