import { NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { authenticateAdmin, hasRole } from "@/lib/auth";

// All methods: Admin/Manager/Staff auth required (kitchen staff can access)
// GET /api/kitchen — fetch kitchen queue (orders in pending/preparing/ready status)
//                  + production stats
export async function GET(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "staff", "kitchen"]))
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const restaurantId = admin.restaurantId;
    const sp = new URL(request.url).searchParams;
    const statsOnly = sp.get("stats") === "1";

    // Production stats: today + last 7 days breakdown
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Today's production: count orders by status today
    const todayOrders = await prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: todayStart, lte: todayEnd },
        status: { in: ["pending", "preparing", "ready", "delivering", "delivered"] },
      },
      select: { id: true, status: true, createdAt: true, items: true, orderType: true },
    });

    // Pending queue (waiting for kitchen to start)
    const pendingQueue = await prisma.order.findMany({
      where: { restaurantId, status: "pending" },
      orderBy: [{ createdAt: "asc" }],
      include: { _count: { select: { payments: true } } },
    });

    // Preparing queue (in progress)
    const preparingQueue = await prisma.order.findMany({
      where: { restaurantId, status: "preparing" },
      orderBy: [{ createdAt: "asc" }],
      include: { _count: { select: { payments: true } } },
    });

    // Ready queue (waiting for pickup/serving)
    const readyQueue = await prisma.order.findMany({
      where: { restaurantId, status: "ready" },
      orderBy: [{ createdAt: "asc" }],
      include: { _count: { select: { payments: true } } },
    });

    // Compute average prep time from orders that went pending → preparing → ready
    // Use updatedAt - createdAt for delivered orders today
    const deliveredToday = await prisma.order.findMany({
      where: {
        restaurantId,
        status: "delivered",
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      select: { createdAt: true, updatedAt: true },
    });
    const prepTimesMin = deliveredToday
      .map((o) => (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 60000)
      .filter((m) => m > 0 && m < 240); // sanity filter: 0-4h
    const avgPrepTimeMin = prepTimesMin.length > 0
      ? Math.round(prepTimesMin.reduce((a, b) => a + b, 0) / prepTimesMin.length)
      : 0;

    // Last 7 days daily counts (for chart)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const last7 = await prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: sevenDaysAgo },
        status: { in: ["delivered", "ready", "delivering"] },
      },
      select: { createdAt: true, status: true },
    });
    const dailyCounts: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dEnd = new Date(d);
      dEnd.setHours(23, 59, 59, 999);
      const count = last7.filter((o) =>
        new Date(o.createdAt) >= d && new Date(o.createdAt) <= dEnd
      ).length;
      dailyCounts.push({
        date: d.toISOString().split("T")[0],
        count,
      });
    }

    // Top dishes produced today (parse items JSON)
    const dishCountMap: Record<string, { name: string; qty: number }> = {};
    for (const o of todayOrders) {
      try {
        const items = JSON.parse(o.items);
        if (Array.isArray(items)) {
          for (const it of items) {
            const key = it.name || it.id || "unknown";
            if (!dishCountMap[key]) dishCountMap[key] = { name: key, qty: 0 };
            dishCountMap[key].qty += Number(it.quantity) || 1;
          }
        }
      } catch {}
    }
    const topDishes = Object.values(dishCountMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    if (statsOnly) {
      return NextResponse.json({
        summary: {
          totalToday: todayOrders.length,
          pending: pendingQueue.length,
          preparing: preparingQueue.length,
          ready: readyQueue.length,
          deliveredToday: deliveredToday.length,
          avgPrepTimeMin,
        },
        dailyCounts,
        topDishes,
      });
    }

    return NextResponse.json({
      queues: {
        pending: pendingQueue,
        preparing: preparingQueue,
        ready: readyQueue,
      },
      summary: {
        totalToday: todayOrders.length,
        pending: pendingQueue.length,
        preparing: preparingQueue.length,
        ready: readyQueue.length,
        deliveredToday: deliveredToday.length,
        avgPrepTimeMin,
      },
      dailyCounts,
      topDishes,
    });
  } catch (e) {
    console.error("[kitchen GET]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/kitchen — update order status (kitchen workflow)
// Body: { orderId, action } where action in: 'start' (pending→preparing), 'finish' (preparing→ready), 'cancel' (any→cancelled)
export async function PATCH(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "staff", "kitchen"]))
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await request.json();
    const { orderId, action } = body;
    if (!orderId || !action) {
      return NextResponse.json({ error: "orderId et action requis" }, { status: 400 });
    }

    // ── Multi-tenant isolation ──────────────────────────────────
    // Verify the order belongs to the admin's restaurant BEFORE updating.
    // Without this, a kitchen staff of restaurant A could mark any order
    // of restaurant B as 'ready' or 'cancelled' by guessing an order UUID.
    const existing = await prisma.order.findFirst({
      where: { id: orderId, restaurantId: admin.restaurantId },
    });
    if (!existing) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

    let newStatus: string;
    switch (action) {
      case "start": // pending → preparing
        if (existing.status !== "pending") {
          return NextResponse.json({ error: "La commande n'est pas en attente" }, { status: 400 });
        }
        newStatus = "preparing";
        break;
      case "finish": // preparing → ready
        if (existing.status !== "preparing") {
          return NextResponse.json({ error: "La commande n'est pas en préparation" }, { status: 400 });
        }
        newStatus = "ready";
        break;
      case "cancel": // any active → cancelled
        if (["delivered", "cancelled"].includes(existing.status)) {
          return NextResponse.json({ error: "Commande déjà terminée" }, { status: 400 });
        }
        newStatus = "cancelled";
        break;
      case "recall": // ready → preparing (kitchen recalled the order)
        if (existing.status !== "ready") {
          return NextResponse.json({ error: "La commande n'est pas prête" }, { status: 400 });
        }
        newStatus = "preparing";
        break;
      case "serve": // ready → delivered (dine_in: served at table)
        if (existing.status !== "ready") {
          return NextResponse.json({ error: "La commande n'est pas prête" }, { status: 400 });
        }
        if (existing.orderType !== "dine_in") {
          return NextResponse.json({ error: "Action réservée aux commandes sur place" }, { status: 400 });
        }
        newStatus = "delivered";
        break;
      case "pickup": // ready → delivered (takeaway: customer picked up)
        if (existing.status !== "ready") {
          return NextResponse.json({ error: "La commande n'est pas prête" }, { status: 400 });
        }
        if (existing.orderType !== "takeaway") {
          return NextResponse.json({ error: "Action réservée aux commandes à emporter" }, { status: 400 });
        }
        newStatus = "delivered";
        break;
      case "handover": // ready → delivering (delivery: handed over to driver)
        if (existing.status !== "ready") {
          return NextResponse.json({ error: "La commande n'est pas prête" }, { status: 400 });
        }
        if (existing.orderType !== "delivery") {
          return NextResponse.json({ error: "Action réservée aux commandes en livraison" }, { status: 400 });
        }
        newStatus = "delivering";
        break;
      default:
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    return NextResponse.json({ order: updated });
  } catch (e) {
    console.error("[kitchen PATCH]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
