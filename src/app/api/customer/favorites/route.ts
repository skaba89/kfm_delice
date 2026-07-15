import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateCustomer } from "@/lib/auth";

// GET /api/customer/favorites — list customer's favorite items
export async function GET(request: Request) {
  try {
    await dbReady;
    const customer = await authenticateCustomer(request);
    if (!customer) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const c = await db.customer.findUnique({
      where: { id: customer.id },
      select: { favoriteItemIds: true, restaurantId: true },
    });
    if (!c) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    let ids: string[] = [];
    try { ids = JSON.parse(c.favoriteItemIds || "[]"); } catch { ids = []; }

    if (ids.length === 0) return NextResponse.json({ data: [] });

    const items = await db.menuItem.findMany({
      where: { id: { in: ids }, restaurantId: c.restaurantId },
    });
    return NextResponse.json({ data: items });
  } catch (error) {
    console.error("[favorites:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/customer/favorites — toggle a favorite item
// Body: { itemId: "..." }
export async function POST(request: Request) {
  try {
    await dbReady;
    const customer = await authenticateCustomer(request);
    if (!customer) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { itemId } = body as { itemId?: string };
    if (!itemId) return NextResponse.json({ error: "itemId requis" }, { status: 400 });

    const c = await db.customer.findUnique({
      where: { id: customer.id },
      select: { favoriteItemIds: true },
    });
    if (!c) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    let ids: string[] = [];
    try { ids = JSON.parse(c.favoriteItemIds || "[]"); } catch { ids = []; }

    if (ids.includes(itemId)) {
      ids = ids.filter(id => id !== itemId); // remove
    } else {
      ids.push(itemId); // add
    }

    await db.customer.update({
      where: { id: customer.id },
      data: { favoriteItemIds: JSON.stringify(ids) },
    });

    return NextResponse.json({ ok: true, favoriteIds: ids });
  } catch (error) {
    console.error("[favorites:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
