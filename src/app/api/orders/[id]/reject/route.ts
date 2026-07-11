import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateDriver } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/orders/[id]/reject
 * Driver rejects a delivery that was proposed to them.
 *
 * Resets the order's assignment so it can be proposed to another driver.
 * Sets:
 * - order.assignmentStatus = "rejected"
 * - order.proposedToDriverId = null
 * - order.proposedAt = null
 *
 * The admin can then re-assign to another driver.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbReady;
    const driverAuth = await authenticateDriver(request);
    if (!driverAuth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id: orderId } = await params;

    // Verify the order was proposed to THIS driver
    const order = await db.order.findFirst({
      where: { id: orderId, proposedToDriverId: driverAuth.id },
    });

    if (!order) {
      return NextResponse.json({
        error: "Cette livraison ne vous a pas été proposée",
      }, { status: 403 });
    }

    if (order.assignmentStatus !== "proposed") {
      return NextResponse.json({
        error: "Cette livraison n'est plus en attente de réponse",
      }, { status: 400 });
    }

    // Reject the delivery
    await db.order.update({
      where: { id: orderId },
      data: {
        assignmentStatus: "rejected",
        proposedToDriverId: null,
        proposedAt: null,
      },
    });

    await logAudit({
      actorId: driverAuth.id,
      actorType: "driver",
      action: "delivery_rejected",
      entityType: "Order",
      entityId: orderId,
      restaurantId: order.restaurantId,
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
