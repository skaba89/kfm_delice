import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateDriver } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/orders/[id]/accept
 * Driver accepts a delivery that was proposed to them.
 *
 * Sets:
 * - order.driverId = driver.id
 * - order.status = "picking_up"
 * - order.assignmentStatus = "accepted"
 * - driver.status = "busy"
 * - driver.currentOrderId = order.id
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
        error: `Cette livraison a déjà été ${order.assignmentStatus === "accepted" ? "acceptée" : "refusée"}`,
      }, { status: 400 });
    }

    // Verify driver is still available
    const driver = await db.driver.findUnique({
      where: { id: driverAuth.id },
      select: { status: true, currentOrderId: true },
    });

    if (driver?.status === "busy" || driver?.currentOrderId) {
      return NextResponse.json({
        error: "Vous avez déjà une livraison en cours",
      }, { status: 400 });
    }

    // Accept the delivery — transactional
    await db.$transaction([
      // Update the order
      db.order.update({
        where: { id: orderId },
        data: {
          driverId: driverAuth.id,
          assignmentStatus: "accepted",
          status: "picking_up",
        },
      }),
      // Mark the driver as busy
      db.driver.update({
        where: { id: driverAuth.id },
        data: {
          status: "busy",
          currentOrderId: orderId,
        },
      }),
    ]);

    await logAudit({
      actorId: driverAuth.id,
      actorType: "driver",
      action: "delivery_accepted",
      entityType: "Order",
      entityId: orderId,
      restaurantId: order.restaurantId,
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
