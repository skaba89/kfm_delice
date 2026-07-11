import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAny } from "@/lib/auth";

/**
 * GET /api/orders/track/[id]
 * Real-time order tracking for customers.
 *
 * Returns:
 * - Order status + timeline
 * - Driver position (lat/lng) if assigned + delivering
 * - Driver info (name, vehicle, phone)
 * - Restaurant info (name, address, lat/lng)
 * - Estimated delivery time
 *
 * Auth: customer (own orders) or admin (restaurant orders) or public with orderId
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbReady;
    const { id: orderId } = await params;

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            phone: true,
            vehicle: true,
            rating: true,
            lat: true,
            lng: true,
            lastLocationUpdate: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            lat: true,
            lng: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Commande non trouvée" }, { status: 404 });
    }

    // Build timeline
    const timeline = buildTimeline(order.status, order.createdAt, order.updatedAt);

    // Driver position (only during picking_up/delivering)
    const showDriverPosition =
      order.driver &&
      (order.status === "picking_up" || order.status === "delivering");

    return NextResponse.json({
      id: order.id,
      status: order.status,
      orderType: order.orderType,
      customerName: order.customerName,
      total: Number(order.total),
      items: typeof order.items === "string" ? JSON.parse(order.items) : order.items,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      timeline,
      driver: showDriverPosition
        ? {
            name: order.driver!.name,
            phone: order.driver!.phone,
            vehicle: order.driver!.vehicle,
            rating: order.driver!.rating,
            lat: order.driver!.lat,
            lng: order.driver!.lng,
            lastUpdate: order.driver!.lastLocationUpdate,
          }
        : null,
      restaurant: {
        name: order.restaurant.name,
        address: order.restaurant.address,
        phone: order.restaurant.phone,
        lat: order.restaurant.lat,
        lng: order.restaurant.lng,
      },
      deliveryAddress: order.deliveryAddress,
      tableNumber: order.tableNumber,
    });
  } catch (error) {
    console.error("[orders/track] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

function buildTimeline(status: string, createdAt: Date, updatedAt: Date) {
  const steps = [
    { key: "pending", label: "Commande reçue", icon: "📋", done: false },
    { key: "confirmed", label: "Confirmée", icon: "✅", done: false },
    { key: "preparing", label: "En préparation", icon: "👨‍🍳", done: false },
    { key: "ready", label: "Prête", icon: "🍽️", done: false },
    { key: "picking_up", label: "Récupération", icon: "📦", done: false },
    { key: "delivering", label: "En livraison", icon: "🛵", done: false },
    { key: "delivered", label: "Livrée", icon: "🎉", done: false },
  ];

  const statusOrder = ["pending", "confirmed", "preparing", "ready", "picking_up", "delivering", "delivered", "cancelled"];
  const currentIdx = statusOrder.indexOf(status);

  // Mark all steps before current as done
  steps.forEach((step, idx) => {
    step.done = idx < currentIdx;
  });

  // Mark current step as active (not done unless it's delivered)
  if (currentIdx >= 0 && currentIdx < steps.length) {
    if (status === "delivered") {
      steps[steps.length - 1].done = true;
    }
  }

  // For dine_in/takeaway, simplify timeline
  if (status === "cancelled") {
    return [{ key: "cancelled", label: "Annulée", icon: "❌", done: true }];
  }

  return steps;
}
