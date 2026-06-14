import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { trackingSchema } from "@/lib/validations";
import { getRestaurantId } from "@/lib/tenant";

// GET /api/tracking?orderId=xxx  — Customer tracking endpoint
// GET /api/tracking?phone=xxx    — Find orders by phone
// Public (anyone can track by order ID or phone)
export async function GET(request: Request) {
  try {
    await dbReady;
    const { searchParams } = new URL(request.url);
    const queryParams = {
      orderId: searchParams.get("orderId") || undefined,
      phone: searchParams.get("phone") || undefined,
    };

    // Validate query params
    const validation = trackingSchema.safeParse(queryParams);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Paramètres invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { orderId, phone } = validation.data;

    const restaurantId = await getRestaurantId(request);
    if (!restaurantId) return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });

    if (orderId) {
      const order = await db.order.findFirst({
        where: { id: orderId, restaurantId },
        include: { driver: true },
      });
      if (!order) return NextResponse.json({ error: "Commande non trouvée" }, { status: 404 });
      return NextResponse.json(order);
    }

    if (phone) {
      const orders = await db.order.findMany({
        where: { phone, restaurantId, orderType: "delivery" },
        orderBy: { createdAt: "desc" },
        include: { driver: true },
        take: 10,
      });
      return NextResponse.json(orders);
    }

    // All active delivery orders (for admin dashboard)
    const activeOrders = await db.order.findMany({
      where: {
        restaurantId,
        orderType: "delivery",
        status: { in: ["pending", "confirmed", "preparing", "ready", "picking_up", "delivering"] },
      },
      orderBy: { createdAt: "desc" },
      include: { driver: true },
    });
    return NextResponse.json(activeOrders);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
