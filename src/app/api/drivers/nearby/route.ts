import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { commercialFeatureGate } from "@/lib/commercial-feature-gate";
import { haversineDistance, sortByDistance } from "@/lib/geo";

/**
 * GET /api/drivers/nearby?lat=X&lng=Y&radius=Z
 * Find available drivers within the delivery radius.
 *
 * Admin/Manager only. Returns drivers sorted by distance (nearest first).
 * Only includes drivers with status "available" and valid GPS coordinates.
 */
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager", "delivery_manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const featureDenied = await commercialFeatureGate(admin.restaurantId, "drivers");
    if (featureDenied) return featureDenied;

    const sp = new URL(request.url).searchParams;
    const lat = parseFloat(sp.get("lat") || "0");
    const lng = parseFloat(sp.get("lng") || "0");

    if (!lat || !lng) {
      return NextResponse.json({ error: "Coordonnées lat/lng requises" }, { status: 400 });
    }

    // Get restaurant's delivery radius (default 10km)
    const restaurant = await db.restaurant.findUnique({
      where: { id: admin.restaurantId },
      select: { deliveryRadiusKm: true, lat: true, lng: true },
    });

    const radiusKm = restaurant?.deliveryRadiusKm || 10;

    // Find all available drivers for this restaurant
    const drivers = await db.driver.findMany({
      where: {
        restaurantId: admin.restaurantId,
        status: "available",
        lat: { not: 0 },
        lng: { not: 0 },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicle: true,
        rating: true,
        totalDeliveries: true,
        zone: true,
        lat: true,
        lng: true,
        lastLocationUpdate: true,
        currentOrderId: true,
      },
    });

    // Filter by radius and sort by distance
    const nearbyDrivers = sortByDistance(drivers, lat, lng)
      .filter((d) => d.distanceKm <= radiusKm)
      .map((d) => {
        const converted = bigIntToNumber(d) as Record<string, unknown>;
        return {
          ...converted,
          distanceKm: Math.round(d.distanceKm * 100) / 100,
          isRecent: Date.now() - new Date(d.lastLocationUpdate).getTime() < 5 * 60 * 1000,
        };
      });

    return NextResponse.json({
      data: nearbyDrivers,
      radiusKm,
      center: { lat, lng },
      total: nearbyDrivers.length,
    });
  } catch (error) {
    console.error("[drivers/nearby] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
