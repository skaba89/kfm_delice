import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateCustomer } from "@/lib/auth";

// GET /api/customer/favorites — list customer's favorite items
// Mission 9: Uses normalized CustomerFavorite model (not JSON string).
export async function GET(request: Request) {
  try {
    await dbReady;
    const customer = await authenticateCustomer(request);
    if (!customer) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // Load favorites from the normalized table, scoped to the customer's restaurant
    const favorites = await db.customerFavorite.findMany({
      where: { customerId: customer.id, restaurantId: customer.restaurantId },
      include: {
        menuItem: {
          select: {
            id: true, name: true, price: true, image: true, category: true,
            available: true, badge: true, popular: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const items = favorites.map(f => f.menuItem).filter(m => m !== null);
    return NextResponse.json({ data: items });
  } catch (error) {
    console.error("[favorites:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/customer/favorites — toggle a favorite item
// Body: { itemId: "..." }
// Mission 9:
//   - Requires authentication (no publicApiFetch).
//   - Refuses items belonging to another restaurant.
//   - Uses CustomerFavorite with @@unique([customerId, menuItemId]).
//   - Returns errors instead of swallowing them.
export async function POST(request: Request) {
  try {
    await dbReady;
    const customer = await authenticateCustomer(request);
    if (!customer) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { itemId } = body as { itemId?: string };
    if (!itemId) {
      return NextResponse.json({ error: "itemId requis" }, { status: 400 });
    }

    // ── Verify the menu item belongs to the customer's restaurant ──
    const menuItem = await db.menuItem.findFirst({
      where: { id: itemId, restaurantId: customer.restaurantId },
      select: { id: true, name: true },
    });
    if (!menuItem) {
      return NextResponse.json(
        { error: "Article introuvable dans ce restaurant", code: "ITEM_NOT_FOUND" },
        { status: 404 }
      );
    }

    // ── Check if already favorited ──
    const existing = await db.customerFavorite.findUnique({
      where: {
        customerId_menuItemId: { customerId: customer.id, menuItemId: itemId },
      },
    });

    if (existing) {
      // Remove (toggle off)
      await db.customerFavorite.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({ ok: true, favorited: false, itemId });
    }

    // Add (toggle on)
    await db.customerFavorite.create({
      data: {
        customerId: customer.id,
        menuItemId: itemId,
        restaurantId: customer.restaurantId,
      },
    });
    return NextResponse.json({ ok: true, favorited: true, itemId });
  } catch (error) {
    console.error("[favorites:POST]", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour des favoris" },
      { status: 500 }
    );
  }
}

// DELETE /api/customer/favorites — remove a favorite
// Body: { itemId: "..." }
export async function DELETE(request: Request) {
  try {
    await dbReady;
    const customer = await authenticateCustomer(request);
    if (!customer) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const sp = new URL(request.url).searchParams;
    const itemId = sp.get("itemId");
    if (!itemId) {
      return NextResponse.json({ error: "itemId requis" }, { status: 400 });
    }

    // Verify ownership + restaurant scope
    const favorite = await db.customerFavorite.findFirst({
      where: { customerId: customer.id, menuItemId: itemId, restaurantId: customer.restaurantId },
    });
    if (!favorite) {
      return NextResponse.json({ error: "Favori introuvable" }, { status: 404 });
    }

    await db.customerFavorite.delete({ where: { id: favorite.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[favorites:DELETE]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
