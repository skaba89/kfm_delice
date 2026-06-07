import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) return NextResponse.json([]);

    const reservations = await db.reservation.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(reservations);
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

    const reservation = await db.reservation.create({
      data: { ...data, restaurantId: restaurant.id },
    });
    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, status } = await request.json();
    const reservation = await db.reservation.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json(reservation);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
