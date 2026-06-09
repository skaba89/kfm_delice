import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateDriver } from "@/lib/auth";

// GET /api/driver-me — Get current driver profile
export async function GET(request: Request) {
  try {
    const driverAuth = await authenticateDriver(request);
    if (!driverAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const driver = await db.driver.findUnique({
      where: { id: driverAuth.id },
      include: { orders: { where: { status: { in: ["picking_up", "delivering"] } }, take: 1, orderBy: { createdAt: "desc" } } },
    });

    if (!driver) return NextResponse.json({ error: "Livreur non trouvé" }, { status: 404 });

    return NextResponse.json({
      id: driver.id,
      email: driver.email,
      name: driver.name,
      phone: driver.phone,
      vehicle: driver.vehicle,
      status: driver.status,
      rating: driver.rating,
      totalDeliveries: driver.totalDeliveries,
      zone: driver.zone,
      lat: driver.lat,
      lng: driver.lng,
      currentOrderId: driver.currentOrderId,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/driver-me — Update driver profile (status, GPS position)
export async function PATCH(request: Request) {
  try {
    const driverAuth = await authenticateDriver(request);
    if (!driverAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.status) updateData.status = body.status;
    if (body.lat !== undefined) updateData.lat = body.lat;
    if (body.lng !== undefined) updateData.lng = body.lng;
    if (body.zone) updateData.zone = body.zone;
    updateData.lastLocationUpdate = new Date();

    const driver = await db.driver.update({
      where: { id: driverAuth.id },
      data: updateData,
    });

    // Also update the order's driver coordinates if there's an active delivery
    if ((body.lat || body.lng) && driver.currentOrderId) {
      await db.order.update({
        where: { id: driver.currentOrderId },
        data: { driverLat: body.lat || 0, driverLng: body.lng || 0 },
      });
    }

    // WebSocket: broadcast driver location update (for admin map and customer tracking)
    try {
      const { broadcastToType } = await import('@/lib/websocket-server');
      const { WSEvents } = await import('@/lib/ws-events');
      if (body.lat || body.lng) {
        broadcastToType('admin', WSEvents.DRIVER_LOCATION_UPDATE, { driverId: driverAuth.id, lat: driver.lat, lng: driver.lng, currentOrderId: driver.currentOrderId });
        broadcastToType('customer', WSEvents.TRACKING_UPDATE, { driverId: driverAuth.id, lat: driver.lat, lng: driver.lng, orderId: driver.currentOrderId });
      }
      if (body.status) {
        broadcastToType('admin', WSEvents.DRIVER_STATUS_CHANGED, { driverId: driverAuth.id, status: driver.status });
      }
    } catch (e) { /* WS not available, fall back to polling */ }

    return NextResponse.json({
      id: driver.id,
      email: driver.email,
      name: driver.name,
      phone: driver.phone,
      vehicle: driver.vehicle,
      status: driver.status,
      rating: driver.rating,
      totalDeliveries: driver.totalDeliveries,
      zone: driver.zone,
      lat: driver.lat,
      lng: driver.lng,
      currentOrderId: driver.currentOrderId,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
