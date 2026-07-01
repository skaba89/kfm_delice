import { NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { authenticateDriver } from "@/lib/auth";

// GET /api/driver-earnings — earnings summary for the authenticated driver
// Returns: totalEarnings, commissionRate, today/week/month breakdown, last 50 paid orders
export async function GET(request: Request) {
  try {
    const driver = await authenticateDriver(request);
    if (!driver) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // Driver profile (commission rate, total earnings)
    const profile = await prisma.driver.findUnique({
      where: { id: driver.id },
      select: {
        id: true,
        name: true,
        commissionRate: true,
        totalEarnings: true,
        totalDeliveries: true,
        rating: true,
      },
    });
    if (!profile) return NextResponse.json({ error: "Livreur introuvable" }, { status: 404 });

    // Date ranges
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setMonth(monthStart.getMonth() - 1);

    // All delivered orders by this driver
    const deliveredOrders = await prisma.order.findMany({
      where: {
        driverId: driver.id,
        status: "delivered",
      },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        total: true,
        deliveryFee: true,
        driverEarning: true,
        orderType: true,
        customerName: true,
        updatedAt: true,
        createdAt: true,
      },
      take: 100,
    });

    // Aggregate by period based on updatedAt (when delivery was completed)
    const todayOrders = deliveredOrders.filter(o => new Date(o.updatedAt) >= todayStart);
    const weekOrders = deliveredOrders.filter(o => new Date(o.updatedAt) >= weekStart);
    const monthOrders = deliveredOrders.filter(o => new Date(o.updatedAt) >= monthStart);

    const sum = (arr: typeof deliveredOrders) => arr.reduce((s, o) => s + (o.driverEarning || 0), 0);

    // Daily earnings for last 14 days (chart)
    const dailyEarnings: { date: string; earnings: number; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const dStart = new Date(now);
      dStart.setDate(dStart.getDate() - i);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(dStart);
      dEnd.setHours(23, 59, 59, 999);
      const dayOrders = deliveredOrders.filter(o =>
        new Date(o.updatedAt) >= dStart && new Date(o.updatedAt) <= dEnd
      );
      dailyEarnings.push({
        date: dStart.toISOString().split("T")[0],
        earnings: dayOrders.reduce((s, o) => s + (o.driverEarning || 0), 0),
        count: dayOrders.length,
      });
    }

    return NextResponse.json({
      profile,
      summary: {
        total: profile.totalEarnings,
        today: sum(todayOrders),
        week: sum(weekOrders),
        month: sum(monthOrders),
        todayCount: todayOrders.length,
        weekCount: weekOrders.length,
        monthCount: monthOrders.length,
      },
      dailyEarnings,
      recentOrders: deliveredOrders.slice(0, 50),
    });
  } catch (e) {
    console.error("[driver-earnings GET]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
