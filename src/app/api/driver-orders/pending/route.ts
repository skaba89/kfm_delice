import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateEntitledDriver } from "@/lib/driver-feature-auth";

/**
 * GET /api/driver-orders/pending
 * Returns deliveries proposed to the authenticated driver that are
 * waiting for accept/reject.
 *
 * Also checks for expired proposals (older than 60 seconds → auto-expire).
 */
export async function GET(request: Request) {
  try {
    await dbReady;
    const driverAuth = await authenticateEntitledDriver(request);
    if (!driverAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Auto-expire proposals older than 60 seconds, always inside this tenant.
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    await db.order.updateMany({
      where: {
        restaurantId: driverAuth.restaurantId,
        proposedToDriverId: driverAuth.id,
        assignmentStatus: "proposed",
        proposedAt: { lt: sixtySecondsAgo },
      },
      data: {
        assignmentStatus: "expired",
        proposedToDriverId: null,
        proposedAt: null,
      },
    }).catch(() => {});

    // Find pending proposals for this driver inside their tenant only.
    const pendingOrders = await db.order.findMany({
      where: {
        restaurantId: driverAuth.restaurantId,
        proposedToDriverId: driverAuth.id,
        assignmentStatus: "proposed",
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            lat: true,
            lng: true,
          },
        },
      },
      orderBy: { proposedAt: "desc" },
      take: 5,
    });

    const result = pendingOrders.map((order) => {
      const items = typeof order.items === "string"
        ? JSON.parse(order.items)
        : order.items;

      const proposedAt = order.proposedAt ? new Date(order.proposedAt).getTime() : 0;
      const elapsedSeconds = Math.floor((Date.now() - proposedAt) / 1000);
      const remainingSeconds = Math.max(0, 60 - elapsedSeconds);

      return {
        id: order.id,
        orderType: order.orderType,
        customerName: order.customerName,
        phone: order.phone,
        deliveryAddress: order.deliveryAddress,
        total: Number(order.total),
        deliveryFee: Number(order.deliveryFee),
        items: Array.isArray(items) ? items : [],
        itemsCount: Array.isArray(items) ? items.length : 0,
        status: order.status,
        proposedAt: order.proposedAt,
        remainingSeconds,
        restaurant: {
          name: order.restaurant.name,
          address: order.restaurant.address,
          phone: order.restaurant.phone,
          lat: order.restaurant.lat,
          lng: order.restaurant.lng,
        },
      };
    });

    return NextResponse.json({
      data: result,
      count: result.length,
    });
  } catch (error) {
    console.error("[driver-orders/pending] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
