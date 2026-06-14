import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateDriver } from "@/lib/auth";
import { parsePagination, prismaSkip, prismaTake } from "@/lib/pagination";
import { driverOrderPatchSchema } from "@/lib/validations";

// GET /api/driver-orders — Get orders assigned to the logged-in driver
export async function GET(request: Request) {
  try {
    await dbReady;
    const driverAuth = await authenticateDriver(request);
    if (!driverAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { page, limit } = parsePagination(new URL(request.url).searchParams);

    const restaurantId = driverAuth.restaurantId;
    if (!restaurantId) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });

    // Get all orders assigned to this driver, or delivery orders that are unassigned
    const where = {
      restaurantId,
      orderType: "delivery" as const,
      OR: [
        { driverId: driverAuth.id },
        { status: { in: ["ready", "picking_up"] }, driverId: null },
      ],
    };

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: prismaSkip(page, limit),
        take: prismaTake(limit),
      }),
      db.order.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: orders,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/driver-orders — Driver updates an order status or accepts an order
export async function PATCH(request: Request) {
  try {
    await dbReady;
    const driverAuth = await authenticateDriver(request);
    if (!driverAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const validation = driverOrderPatchSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { orderId, status, lat, lng } = validation.data;

    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: "Commande non trouvée" }, { status: 404 });

    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;
    }

    // If accepting an order (assigning self)
    if (status === "picking_up" || status === "delivering") {
      updateData.driverId = driverAuth.id;
    }

    // If delivering, update GPS coords
    if (lat !== undefined && lng !== undefined) {
      updateData.driverLat = lat;
      updateData.driverLng = lng;
    }

    // If delivered, increment driver's totalDeliveries
    if (status === "delivered") {
      await db.driver.update({
        where: { id: driverAuth.id },
        data: {
          totalDeliveries: { increment: 1 },
          status: "available",
          currentOrderId: "",
        },
      });
    }

    // If picking up, mark driver as busy
    if (status === "picking_up") {
      await db.driver.update({
        where: { id: driverAuth.id },
        data: { status: "busy", currentOrderId: orderId },
      });
    }

    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: updateData,
    });

    // WebSocket: broadcast order and driver status changes
    try {
      const { broadcastToType, sendToUser } = await import('@/lib/websocket-server');
      const { WSEvents } = await import('@/lib/ws-events');
      // Notify admin of order status change
      broadcastToType('admin', WSEvents.ORDER_STATUS_CHANGED, { orderId: updatedOrder.id, status: updatedOrder.status, driverId: driverAuth.id });
      // Notify customer of tracking update
      broadcastToType('customer', WSEvents.TRACKING_UPDATE, { orderId: updatedOrder.id, status: updatedOrder.status });
      // Notify admin of driver status change
      broadcastToType('admin', WSEvents.DRIVER_STATUS_CHANGED, { driverId: driverAuth.id, status: status === 'delivered' ? 'available' : (status === 'picking_up' ? 'busy' : undefined) });
    } catch (e) { /* WS not available, fall back to polling */ }

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
