import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) {
      return NextResponse.json({
        todayReservations: 0, pendingReservations: 0, todayRevenue: 0,
        totalOrders: 0, activeOrders: 0, avgRating: 0, totalReviews: 0,
        popularDishes: [], recentReservations: [],
        deliveryOrders: 0, activeDeliveries: 0, availableDrivers: 0, totalDrivers: 0,
        deliveryRevenue: 0, dineInOrders: 0, takeawayOrders: 0,
        ordersByHour: [],
      });
    }

    const rid = restaurant.id;
    const today = new Date().toISOString().split("T")[0];

    const [reservations, orders, reviews, menuItems, drivers] = await Promise.all([
      db.reservation.findMany({ where: { restaurantId: rid } }),
      db.order.findMany({ where: { restaurantId: rid }, include: { driver: true } }),
      db.review.findMany({ where: { restaurantId: rid } }),
      db.menuItem.findMany({ where: { restaurantId: rid } }),
      db.driver.findMany({ where: { restaurantId: rid } }),
    ]);

    const todayReservations = reservations.filter((r) => r.date === today).length;
    const pendingReservations = reservations.filter((r) => r.status === "pending").length;
    const todayOrders = orders.filter((o) => new Date(o.createdAt).toISOString().split("T")[0] === today && o.status !== "cancelled");
    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total + (o.deliveryFee || 0), 0);
    const activeOrders = orders.filter((o) => ["pending", "preparing", "ready", "delivering"].includes(o.status)).length;
    const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

    // Delivery stats
    const deliveryOrders = orders.filter(o => o.orderType === "delivery").length;
    const activeDeliveries = orders.filter(o => o.orderType === "delivery" && o.status === "delivering").length;
    const availableDrivers = drivers.filter(d => d.status === "available").length;
    const totalDrivers = drivers.length;
    const deliveryRevenue = orders.filter(o => o.orderType === "delivery" && o.status === "delivered").reduce((s, o) => s + o.deliveryFee, 0);
    const dineInOrders = orders.filter(o => o.orderType === "dine_in").length;
    const takeawayOrders = orders.filter(o => o.orderType === "takeaway").length;

    // Popular dishes
    const dishCounts: Record<string, number> = {};
    orders.forEach((o) => {
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

    const recentReservations = reservations.slice(0, 5).map((r) => ({
      id: r.id, customerName: r.customerName, date: r.date, time: r.time,
      guests: r.guests, zone: r.zone, status: r.status,
    }));

    // Orders by hour (for chart)
    const ordersByHour: { hour: string; count: number }[] = [];
    for (let h = 11; h <= 22; h++) {
      const hStr = `${h.toString().padStart(2, "0")}`;
      const count = todayOrders.filter(o => {
        const oh = new Date(o.createdAt).getHours();
        return oh === h;
      }).length;
      ordersByHour.push({ hour: `${hStr}:00`, count });
    }

    return NextResponse.json({
      todayReservations, pendingReservations, todayRevenue,
      totalOrders: orders.length, activeOrders, avgRating: Math.round(avgRating * 10) / 10,
      totalReviews: reviews.length, popularDishes, recentReservations,
      deliveryOrders, activeDeliveries, availableDrivers, totalDrivers,
      deliveryRevenue, dineInOrders, takeawayOrders, ordersByHour,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
