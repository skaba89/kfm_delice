import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateDriver } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/orders/[id]/reject
 * Conditionally rejects only a still-active proposal belonging to this driver
 * and restaurant. A late/replayed rejection cannot clear a newer assignment.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbReady;
    const driverAuth = await authenticateDriver(request);
    if (!driverAuth) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { id: orderId } = await params;
    const rejected = await db.order.updateMany({
      where: {
        id: orderId,
        restaurantId: driverAuth.restaurantId,
        proposedToDriverId: driverAuth.id,
        assignmentStatus: "proposed",
        driverId: null,
        status: "ready",
      },
      data: {
        assignmentStatus: "rejected",
        proposedToDriverId: null,
        proposedAt: null,
      },
    });

    if (rejected.count !== 1) {
      return NextResponse.json(
        { error: "Cette proposition n'est plus disponible", code: "PROPOSAL_CHANGED" },
        { status: 409 }
      );
    }

    await logAudit({
      actorId: driverAuth.id,
      actorType: "driver",
      action: "delivery_rejected",
      entityType: "Order",
      entityId: orderId,
      restaurantId: driverAuth.restaurantId,
      request,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Livraison refusée. Elle sera proposée à un autre livreur.",
    });
  } catch (error) {
    console.error("[orders/reject] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
