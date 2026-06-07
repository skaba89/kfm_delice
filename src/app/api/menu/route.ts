import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) return NextResponse.json([]);

    const items = await db.menuItem.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(items);
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

    const item = await db.menuItem.create({
      data: { ...data, restaurantId: restaurant.id },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...data } = await request.json();
    const item = await db.menuItem.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    await db.menuItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
