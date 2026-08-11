import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateDriver } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

class DeliveryAcceptConflict extends Error {
  constructor(public readonly code: "DRIVER_BUSY" | "PROPOSAL_CHANGED") {
    super(code);
  }
}

/**
 * POST /api/orders/[id]/accept
 * Atomically claims a READY proposal for the authenticated driver.
 * A driver cannot win two concurrent proposals: the driver availability update
 * is conditional and rolls back with the order claim if either CAS fails.
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

    let restaurantId = driverAuth.restaurantId;
    try {
      const claimed = await db.$transaction(async (tx) => {
        const proposal = await tx.order.findFirst({
          where: {
            id: orderId,
            restaurantId: driverAuth.restaurantId,
            proposedToDriverId: driverAuth.id,
            assignmentStatus: "proposed",
            status: "ready",
            driverId: null,
          },
          select: { id: true, restaurantId: true },
        });
        if (!proposal) throw new DeliveryAcceptConflict("PROPOSAL_CHANGED");
        restaurantId = proposal.restaurantId;

        const driverClaim = await tx.driver.updateMany({
          where: {
            id: driverAuth.id,
            restaurantId: driverAuth.restaurantId,
            status: "available",
            currentOrderId: "",
          },
          data: { status: "busy", currentOrderId: orderId },
        });
        if (driverClaim.count !== 1) throw new DeliveryAcceptConflict("DRIVER_BUSY");

        const orderClaim = await tx.order.updateMany({
          where: {
            id: orderId,
            restaurantId: driverAuth.restaurantId,
            proposedToDriverId: driverAuth.id,
            assignmentStatus: "proposed",
            status: "ready",
            driverId: null,
          },
          data: {
            driverId: driverAuth.id,
            assignmentStatus: "accepted",
            status: "picking_up",
            proposedToDriverId: null,
            proposedAt: null,
          },
        });
        if (orderClaim.count !== 1) throw new DeliveryAcceptConflict("PROPOSAL_CHANGED");

        return true;
      });
      if (!claimed) throw new DeliveryAcceptConflict("PROPOSAL_CHANGED");
    } catch (error) {
      if (error instanceof DeliveryAcceptConflict) {
        if (error.code === "DRIVER_BUSY") {
          return NextResponse.json(
            { error: "Vous avez déjà une livraison en cours", code: error.code },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: "Cette proposition n'est plus disponible", code: error.code },
          { status: 409 }
        );
      }
      throw error;
    }

    await logAudit({
      actorId: driverAuth.id,
      actorType: "driver",
      action: "delivery_accepted",
      entityType: "Order",
      entityId: orderId,
      restaurantId,
      request,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Livraison acceptée ! Récupérez la commande au restaurant.",
      orderId,
      status: "picking_up",
    });
  } catch (error) {
    console.error("[orders/accept] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
