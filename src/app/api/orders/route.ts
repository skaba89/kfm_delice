import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) return NextResponse.json([]);
    const orders = await db.order.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: "desc" },
      include: { driver: true },
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
    const order = await db.order.create({
      data: { ...data, restaurantId: restaurant.id },
    });
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, driverId, ...data } = await request.json();
    const updateData: Record<string, unknown> = { ...data };
    if (driverId !== undefined) updateData.driverId = driverId || null;
    const order = await db.order.update({ where: { id }, data: updateData });
    // Update driver status if assigned
    if (driverId) {
      await db.driver.update({ where: { id: driverId }, data: { status: "busy" } });
    }
    // If order delivered or cancelled, free up driver
    if (data.status === "delivered" || data.status === "cancelled") {
      const existingOrder = await db.order.findUnique({ where: { id } });
      if (existingOrder?.driverId) {
        await db.driver.update({ where: { id: existingOrder.driverId }, data: { status: "available" } });
        await db.driver.update({ where: { id: existingOrder.driverId }, data: { totalDeliveries: { increment: 1 } } });
      }
    }
    return NextResponse.json(order);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
