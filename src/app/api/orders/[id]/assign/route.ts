import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { haversineDistance } from "@/lib/geo";
import { logAudit } from "@/lib/audit";

const PROPOSAL_TTL_MS = 60 * 1000;
const OPEN_ASSIGNMENT_STATES = ["none", "rejected", "expired"];

/**
 * POST /api/orders/[id]/assign
 * Proposes an already READY delivery to one available driver. Proposal writes
 * are compare-and-swap guarded so a live proposal/assignment cannot be
 * overwritten by a concurrent admin request.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "delivery_manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const cutoff = new Date(Date.now() - PROPOSAL_TTL_MS);

    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId: admin.restaurantId },
      select: {
        id: true,
        orderType: true,
        status: true,
        driverId: true,
        assignmentStatus: true,
        proposedAt: true,
      },
    });
    if (!order) return NextResponse.json({ error: "Commande non trouvée" }, { status: 404 });
    if (order.orderType !== "delivery") {
      return NextResponse.json({ error: "Cette commande n'est pas une livraison" }, { status: 400 });
    }
    if (order.status !== "ready") {
      return NextResponse.json(
        { error: `La commande doit être prête avant attribution (statut: ${order.status})`, code: "ORDER_NOT_READY_FOR_DELIVERY" },
        { status: 409 }
      );
    }
    if (order.driverId) {
      return NextResponse.json(
        { error: "Cette commande possède déjà un livreur", code: "ORDER_ALREADY_ASSIGNED" },
        { status: 409 }
      );
    }
    if (order.assignmentStatus === "proposed" && order.proposedAt && order.proposedAt >= cutoff) {
      return NextResponse.json(
        { error: "Une proposition de livraison est déjà active", code: "DELIVERY_PROPOSAL_IN_FLIGHT" },
        { status: 409 }
      );
    }

    const restaurant = await db.restaurant.findUnique({
      where: { id: admin.restaurantId },
      select: { lat: true, lng: true, deliveryRadiusKm: true },
    });
    const radiusKm = restaurant?.deliveryRadiusKm || 10;
    const restLat = restaurant?.lat || 9.5092;
    const restLng = restaurant?.lng || -13.7122;

    const activeProposals = await db.order.findMany({
      where: {
        restaurantId: admin.restaurantId,
        assignmentStatus: "proposed",
        proposedAt: { gte: cutoff },
        proposedToDriverId: { not: null },
        id: { not: orderId },
      },
      select: { proposedToDriverId: true },
    });
    const busyByProposal = new Set(
      activeProposals.map((p) => p.proposedToDriverId).filter((id): id is string => Boolean(id))
    );

    let target: {
      id: string;
      name: string;
      phone: string;
      vehicle: string;
      lat: number;
      lng: number;
    } | null = null;
    let distanceKm: number | null = null;
    let nearbyCount = 0;

    if (typeof body.driverId === "string" && body.driverId.trim()) {
      const driver = await db.driver.findFirst({
        where: {
          id: body.driverId.trim(),
          restaurantId: admin.restaurantId,
          status: "available",
          currentOrderId: "",
        },
        select: { id: true, name: true, phone: true, vehicle: true, lat: true, lng: true },
      });
      if (!driver || busyByProposal.has(driver.id)) {
        return NextResponse.json({ error: "Livreur non disponible" }, { status: 404 });
      }
      target = driver;
      distanceKm = haversineDistance(driver.lat, driver.lng, restLat, restLng);
    } else {
      const availableDrivers = await db.driver.findMany({
        where: {
          restaurantId: admin.restaurantId,
          status: "available",
          currentOrderId: "",
          lat: { not: 0 },
          lng: { not: 0 },
        },
        select: { id: true, name: true, phone: true, vehicle: true, lat: true, lng: true },
      });

      const candidates = availableDrivers
        .filter((driver) => !busyByProposal.has(driver.id))
        .map((driver) => ({ driver, distanceKm: haversineDistance(driver.lat, driver.lng, restLat, restLng) }))
        .filter(({ distanceKm }) => distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      nearbyCount = candidates.length;
      if (candidates.length === 0) {
        return NextResponse.json(
          { success: false, error: `Aucun livreur disponible dans un rayon de ${radiusKm}km`, nearbyCount: 0, radiusKm },
          { status: 404 }
        );
      }
      target = candidates[0].driver;
      distanceKm = candidates[0].distanceKm;
    }

    const proposed = await db.order.updateMany({
      where: {
        id: orderId,
        restaurantId: admin.restaurantId,
        orderType: "delivery",
        status: "ready",
        driverId: null,
        OR: [
          { assignmentStatus: { in: OPEN_ASSIGNMENT_STATES } },
          { assignmentStatus: "proposed", proposedAt: { lt: cutoff } },
          { assignmentStatus: "proposed", proposedAt: null },
        ],
      },
      data: {
        assignmentStatus: "proposed",
        proposedToDriverId: target.id,
        proposedAt: new Date(),
      },
    });

    if (proposed.count !== 1) {
      return NextResponse.json(
        { error: "L'attribution a changé simultanément. Rechargez puis réessayez.", code: "DELIVERY_ASSIGNMENT_CONFLICT" },
        { status: 409 }
      );
    }

    await logAudit({
      actorId: admin.id,
      actorType: "admin",
      action: "delivery_assigned",
      entityType: "Order",
      entityId: orderId,
      restaurantId: admin.restaurantId,
      after: {
        driverId: target.id,
        driverName: target.name,
        ...(distanceKm !== null ? { distanceKm: Math.round(distanceKm * 100) / 100 } : {}),
      },
      request,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Livraison proposée à ${target.name}`,
      driver: bigIntToNumber(target),
      ...(distanceKm !== null ? { distanceKm: Math.round(distanceKm * 100) / 100 } : {}),
      nearbyCount,
      radiusKm,
    });
  } catch (error) {
    console.error("[orders/assign] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
