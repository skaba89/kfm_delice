import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) return NextResponse.json([]);
    const reviews = await db.review.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(reviews);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) return NextResponse.json({ error: "Aucun restaurant" }, { status: 400 });
    const review = await db.review.create({ data: { ...data, restaurantId: restaurant.id } });
    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    await db.review.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
