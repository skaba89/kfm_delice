import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateDriver, hasRole } from "@/lib/auth";

// PATCH /api/driver-location — Update driver GPS position (Admin or Driver auth)
export async function PATCH(request: Request) {
  try {
    // Support both admin and driver authentication
    const admin = await authenticateAdmin(request);
    const driverAuth = !admin ? await authenticateDriver(request) : null;
    if (!admin && !driverAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (admin && !hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { driverId, lat, lng, orderId, status } = await request.json();
    const targetDriverId = driverAuth ? driverAuth.id : driverId;
    if (!targetDriverId) return NextResponse.json({ error: "driverId requis" }, { status: 400 });

    const updateData: Record<string, unknown> = { lat, lng, lastLocationUpdate: new Date() };
    if (status) updateData.status = status;
    if (orderId !== undefined) updateData.currentOrderId = orderId || "";

    const driver = await db.driver.update({
      where: { id: targetDriverId },
      data: updateData,
    });

    // Also update the order's driver coordinates if there's an active order
    if (orderId && lat && lng) {
      await db.order.updateMany({
        where: { id: orderId, driverId: targetDriverId },
        data: { driverLat: lat, driverLng: lng },
      });
    }

    return NextResponse.json(driver);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/driver-location?driverId=xxx — Get driver current location (Admin or Driver auth)
export async function GET(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    const driverAuth = !admin ? await authenticateDriver(request) : null;
    if (!admin && !driverAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (admin && !hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get("driverId");

    // If driver is authenticated, only allow viewing their own location (or all if admin)
    if (driverAuth && !admin) {
      const targetId = driverId || driverAuth.id;
      const driver = await db.driver.findUnique({
        where: { id: targetId },
        select: { id: true, name: true, phone: true, lat: true, lng: true, status: true, vehicle: true, currentOrderId: true, lastLocationUpdate: true },
      });
      if (!driver) return NextResponse.json({ error: "Livreur non trouvé" }, { status: 404 });
      return NextResponse.json(driver);
    }

    if (driverId) {
      const driver = await db.driver.findUnique({
        where: { id: driverId },
        select: { id: true, name: true, phone: true, lat: true, lng: true, status: true, vehicle: true, currentOrderId: true, lastLocationUpdate: true },
      });
      if (!driver) return NextResponse.json({ error: "Livreur non trouvé" }, { status: 404 });
      return NextResponse.json(driver);
    }

    // All drivers with locations (admin only)
    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) return NextResponse.json([]);
    const drivers = await db.driver.findMany({
      where: { restaurantId: restaurant.id },
      select: { id: true, name: true, phone: true, lat: true, lng: true, status: true, vehicle: true, currentOrderId: true, lastLocationUpdate: true },
    });
    return NextResponse.json(drivers);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
