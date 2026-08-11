import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { authenticateEntitledDriver } from "@/lib/driver-feature-auth";
import { commercialFeatureGate } from "@/lib/commercial-feature-gate";
import { driverLocationPatchSchema } from "@/lib/validations";

const DRIVER_STATUSES = new Set(["available", "busy", "offline"]);
const DRIVER_LOCATION_SELECT = {
  id: true,
  name: true,
  phone: true,
  lat: true,
  lng: true,
  status: true,
  vehicle: true,
  currentOrderId: true,
  lastLocationUpdate: true,
} as const;

// PATCH /api/driver-location — Update driver GPS position (Admin or Driver auth)
export async function PATCH(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    const driverAuth = !admin ? await authenticateEntitledDriver(request) : null;
    if (!admin && !driverAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (admin && !hasRole(admin.role, ["admin", "manager", "delivery_manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (admin) {
      const featureDenied = await commercialFeatureGate(admin.restaurantId, "drivers");
      if (featureDenied) return featureDenied;
    }

    const validation = driverLocationPatchSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { driverId, lat, lng, orderId, status } = validation.data;
    if (status !== undefined && !DRIVER_STATUSES.has(status)) {
      return NextResponse.json({ error: "Statut livreur invalide" }, { status: 400 });
    }

    let targetDriverId: string;
    let restaurantId: string;

    if (driverAuth) {
      // A driver can never select another driver through a query/body id.
      if (driverId && driverId !== driverAuth.id) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      targetDriverId = driverAuth.id;
      restaurantId = driverAuth.restaurantId;
    } else {
      if (!admin || !driverId) {
        return NextResponse.json({ error: "driverId requis" }, { status: 400 });
      }
      const targetDriver = await db.driver.findFirst({
        where: { id: driverId, restaurantId: admin.restaurantId },
        select: { id: true },
      });
      if (!targetDriver) {
        return NextResponse.json({ error: "Livreur introuvable" }, { status: 404 });
      }
      targetDriverId = targetDriver.id;
      restaurantId = admin.restaurantId;
    }

    const updateData: Record<string, unknown> = { lat, lng, lastLocationUpdate: new Date() };
    if (status !== undefined) updateData.status = status;
    if (orderId !== undefined) updateData.currentOrderId = orderId || "";

    const updated = await db.driver.updateMany({
      where: { id: targetDriverId, restaurantId },
      data: updateData,
    });
    if (updated.count !== 1) {
      return NextResponse.json({ error: "Livreur introuvable" }, { status: 404 });
    }

    // Order coordinates are also tenant + driver scoped. A malicious orderId
    // cannot mutate another restaurant's delivery.
    if (orderId && lat !== undefined && lng !== undefined) {
      await db.order.updateMany({
        where: { id: orderId, restaurantId, driverId: targetDriverId },
        data: { driverLat: lat, driverLng: lng },
      });
    }

    const driver = await db.driver.findFirst({
      where: { id: targetDriverId, restaurantId },
      select: DRIVER_LOCATION_SELECT,
    });
    if (!driver) return NextResponse.json({ error: "Livreur introuvable" }, { status: 404 });

    return NextResponse.json(bigIntToNumber(driver));
  } catch (error) {
    console.error("[driver-location:PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/driver-location?driverId=xxx — Get driver current location (Admin or Driver auth)
export async function GET(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    const driverAuth = !admin ? await authenticateEntitledDriver(request) : null;
    if (!admin && !driverAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (admin && !hasRole(admin.role, ["admin", "manager", "delivery_manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (admin) {
      const featureDenied = await commercialFeatureGate(admin.restaurantId, "drivers");
      if (featureDenied) return featureDenied;
    }

    const driverId = new URL(request.url).searchParams.get("driverId");

    if (driverAuth) {
      if (driverId && driverId !== driverAuth.id) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      const driver = await db.driver.findFirst({
        where: { id: driverAuth.id, restaurantId: driverAuth.restaurantId },
        select: DRIVER_LOCATION_SELECT,
      });
      if (!driver) return NextResponse.json({ error: "Livreur non trouvé" }, { status: 404 });
      return NextResponse.json(bigIntToNumber(driver));
    }

    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    if (driverId) {
      const driver = await db.driver.findFirst({
        where: { id: driverId, restaurantId: admin.restaurantId },
        select: DRIVER_LOCATION_SELECT,
      });
      if (!driver) return NextResponse.json({ error: "Livreur non trouvé" }, { status: 404 });
      return NextResponse.json(bigIntToNumber(driver));
    }

    const drivers = await db.driver.findMany({
      where: { restaurantId: admin.restaurantId },
      select: DRIVER_LOCATION_SELECT,
    });
    return NextResponse.json(bigIntToNumber(drivers));
  } catch (error) {
    console.error("[driver-location:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
