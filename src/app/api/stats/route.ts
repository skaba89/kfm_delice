import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) {
      return NextResponse.json({
        todayReservations: 0,
        pendingReservations: 0,
        todayRevenue: 0,
        totalOrders: 0,
        activeOrders: 0,
        avgRating: 0,
        totalReviews: 0,
        popularDishes: [],
        recentReservations: [],
      });
    }

    const rid = restaurant.id;
    const today = new Date().toISOString().split("T")[0];

    const [reservations, orders, reviews, menuItems] = await Promise.all([
      db.reservation.findMany({ where: { restaurantId: rid } }),
      db.order.findMany({ where: { restaurantId: rid } }),
      db.review.findMany({ where: { restaurantId: rid } }),
      db.menuItem.findMany({ where: { restaurantId: rid } }),
    ]);

    const todayReservations = reservations.filter((r) => r.date === today).length;
    const pendingReservations = reservations.filter((r) => r.status === "pending").length;
    const todayRevenue = orders
      .filter((o) => {
        const oDate = new Date(o.createdAt).toISOString().split("T")[0];
        return oDate === today && o.status !== "cancelled";
      })
      .reduce((sum, o) => sum + o.total, 0);
    const activeOrders = orders.filter((o) => ["pending", "preparing", "ready"].includes(o.status)).length;
    const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

    // Popular dishes by order count
    const dishCounts: Record<string, number> = {};
    orders.forEach((o) => {
      try {
        const items = JSON.parse(o.items) as { name: string; price: number; qty: number }[];
        items.forEach((item) => {
          dishCounts[item.name] = (dishCounts[item.name] || 0) + item.qty;
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

    const recentReservations = reservations.slice(0, 5).map((r) => ({
      id: r.id,
      customerName: r.customerName,
      date: r.date,
      time: r.time,
      guests: r.guests,
      zone: r.zone,
      status: r.status,
    }));

    return NextResponse.json({
      todayReservations,
      pendingReservations,
      todayRevenue,
      totalOrders: orders.length,
      activeOrders,
      avgRating: Math.round(avgRating * 10) / 10,
      totalReviews: reviews.length,
      popularDishes,
      recentReservations,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
