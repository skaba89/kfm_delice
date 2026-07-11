import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { haversineDistance } from "@/lib/geo";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/orders/[id]/assign
 * Propose a delivery order to nearby available drivers.
 *
 * Admin/Manager: triggers the assignment — finds nearby drivers within
 * the restaurant's delivery radius and proposes to the nearest one.
 *
 * The driver receives the proposal on their dashboard and can accept/reject.
 *
 * Body: { driverId?: string } — if driverId is provided, assign directly
 *       (skip nearby search). Otherwise auto-find nearest available driver.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager", "delivery_manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));

    // Fetch the order
    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId: admin.restaurantId },
    });

    if (!order) {
      return NextResponse.json({ error: "Commande non trouvée" }, { status: 404 });
    }

    if (order.orderType !== "delivery") {
      return NextResponse.json({ error: "Cette commande n'est pas une livraison" }, { status: 400 });
    }

    if (order.status !== "ready" && order.status !== "pending" && order.status !== "confirmed" && order.status !== "preparing") {
      return NextResponse.json({ error: `Commande non assignable (statut: ${order.status})` }, { status: 400 });
    }

    // Get restaurant info for GPS + radius
    const restaurant = await db.restaurant.findUnique({
      where: { id: admin.restaurantId },
      select: { lat: true, lng: true, deliveryRadiusKm: true, name: true, address: true },
    });

    const radiusKm = restaurant?.deliveryRadiusKm || 10;
    const restLat = restaurant?.lat || 9.5092;
    const restLng = restaurant?.lng || -13.7122;

    // If driverId is specified, assign directly
    if (body.driverId) {
      const driver = await db.driver.findFirst({
        where: {
          id: body.driverId,
          restaurantId: admin.restaurantId,
          status: "available",
        },
      });

      if (!driver) {
        return NextResponse.json({ error: "Livreur non disponible" }, { status: 404 });
      }

      await db.order.update({
        where: { id: orderId },
        data: {
          assignmentStatus: "proposed",
          proposedToDriverId: driver.id,
          proposedAt: new Date(),
          status: "ready",
        },
      });

      await logAudit({
        actorId: admin.id,
        actorType: "admin",
        action: "delivery_assigned",
        entityType: "Order",
        entityId: orderId,
        restaurantId: admin.restaurantId,
        after: { driverId: driver.id, driverName: driver.name },
        request,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Livraison proposée à ${driver.name}`,
        driver: bigIntToNumber({
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          vehicle: driver.vehicle,
        }),
      });
    }

    // Auto-find nearest available driver within radius
    const availableDrivers = await db.driver.findMany({
      where: {
        restaurantId: admin.restaurantId,
        status: "available",
        lat: { not: 0 },
        lng: { not: 0 },
        currentOrderId: "",
      },
    });

    if (availableDrivers.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Aucun livreur disponible actuellement",
        nearbyCount: 0,
      }, { status: 404 });
    }

    // Calculate distances and find nearest within radius
    const driversWithDistance = availableDrivers
      .map((d) => ({
        driver: d,
        distanceKm: haversineDistance(d.lat, d.lng, restLat, restLng),
      }))
      .filter((d) => d.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (driversWithDistance.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Aucun livreur dans un rayon de ${radiusKm}km`,
        nearbyCount: 0,
        radiusKm,
      }, { status: 404 });
    }

    // Propose to the nearest driver
    const nearest = driversWithDistance[0];
    await db.order.update({
      where: { id: orderId },
      data: {
        assignmentStatus: "proposed",
        proposedToDriverId: nearest.driver.id,
        proposedAt: new Date(),
        status: "ready",
        deliveryLat: restLat,
        deliveryLng: restLng,
      },
    });

    await logAudit({
      actorId: admin.id,
      actorType: "admin",
      action: "delivery_assigned",
      entityType: "Order",
      entityId: orderId,
      restaurantId: admin.restaurantId,
      after: {
        driverId: nearest.driver.id,
        driverName: nearest.driver.name,
        distanceKm: Math.round(nearest.distanceKm * 100) / 100,
      },
      request,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Livraison proposée à ${nearest.driver.name} (${Math.round(nearest.distanceKm * 100) / 100}km)`,
      driver: bigIntToNumber({
        id: nearest.driver.id,
        name: nearest.driver.name,
        phone: nearest.driver.phone,
        vehicle: nearest.driver.vehicle,
        lat: nearest.driver.lat,
        lng: nearest.driver.lng,
      }),
      distanceKm: Math.round(nearest.distanceKm * 100) / 100,
      nearbyCount: driversWithDistance.length,
      radiusKm,
    });
  } catch (error) {
    console.error("[orders/assign] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
