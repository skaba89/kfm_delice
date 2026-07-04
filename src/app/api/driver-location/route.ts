import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateDriver, hasRole } from "@/lib/auth";
import { driverLocationPatchSchema } from "@/lib/validations";

// PATCH /api/driver-location — Update driver GPS position (Admin or Driver auth)
export async function PATCH(request: Request) {
  try {
    await dbReady;
    // Support both admin and driver authentication
    const admin = await authenticateAdmin(request);
    const driverAuth = !admin ? await authenticateDriver(request) : null;
    if (!admin && !driverAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (admin && !hasRole(admin.role, ["admin", "manager", "delivery_manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validation = driverLocationPatchSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { driverId, lat, lng, orderId, status } = validation.data;
    // If admin is calling, they must specify a driverId AND that driver
    // must belong to the admin's restaurant (multi-tenant isolation).
    // If driver is calling, they can only update their own location.
    let targetDriverId: string | undefined;
    if (driverAuth) {
      targetDriverId = driverAuth.id;
    } else if (admin) {
      targetDriverId = driverId;
      if (!targetDriverId) {
        return NextResponse.json({ error: "driverId requis" }, { status: 400 });
      }
      // ── Multi-tenant isolation ────────────────────────────────
      // Verify the target driver belongs to the admin's restaurant.
      const targetDriver = await db.driver.findFirst({
        where: { id: targetDriverId, restaurantId: admin.restaurantId },
        select: { id: true },
      });
      if (!targetDriver) {
        return NextResponse.json({ error: "Livreur introuvable" }, { status: 404 });
      }
    }
    if (!targetDriverId) return NextResponse.json({ error: "driverId requis" }, { status: 400 });

    const updateData: Record<string, unknown> = { lat, lng, lastLocationUpdate: new Date() };
    if (status !== undefined) updateData.status = status;
    if (orderId !== undefined) updateData.currentOrderId = orderId || "";

    const driver = await db.driver.update({
      where: { id: targetDriverId },
      data: updateData,
    });

    // Also update the order's driver coordinates if there's an active order
    if (orderId && lat !== undefined && lng !== undefined) {
      await db.order.updateMany({
        where: { id: orderId, driverId: targetDriverId },
        data: { driverLat: lat, driverLng: lng },
      });
    }

    return NextResponse.json(bigIntToNumber(driver));
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
    if (admin && !hasRole(admin.role, ["admin", "manager", "delivery_manager"])) {
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
      return NextResponse.json(bigIntToNumber(driver));
    }

    if (driverId) {
      const driver = await db.driver.findUnique({
        where: { id: driverId },
        select: { id: true, name: true, phone: true, lat: true, lng: true, status: true, vehicle: true, currentOrderId: true, lastLocationUpdate: true },
      });
      if (!driver) return NextResponse.json({ error: "Livreur non trouvé" }, { status: 404 });
      return NextResponse.json(bigIntToNumber(driver));
    }

    // All drivers with locations (admin only)
    const restaurantId = admin?.restaurantId || driverAuth?.restaurantId;
    const drivers = await db.driver.findMany({
      where: { restaurantId },
      select: { id: true, name: true, phone: true, lat: true, lng: true, status: true, vehicle: true, currentOrderId: true, lastLocationUpdate: true },
    });
    return NextResponse.json(bigIntToNumber(drivers));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
