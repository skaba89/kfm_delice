import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateCustomer } from "@/lib/auth";

// POST /api/customer/reorder — reorder a past order
// Body: { orderId: "..." }
// Creates a new order with the same items (prices recalculated server-side)
export async function POST(request: Request) {
  try {
    await dbReady;
    const customer = await authenticateCustomer(request);
    if (!customer) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { orderId } = body as { orderId?: string };
    if (!orderId) return NextResponse.json({ error: "orderId requis" }, { status: 400 });

    // Fetch the original order — must belong to this customer
    const original = await db.order.findFirst({
      where: { id: orderId, customerId: customer.id },
      select: { items: true, orderType: true, restaurantId: true, paymentMethod: true, deliveryAddress: true },
    });
    if (!original) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

    // Parse items from the original order
    let items: Array<{ name: string; price: number; qty?: number }> = [];
    try { items = JSON.parse(original.items as string); } catch { return NextResponse.json({ error: "Items invalides" }, { status: 400 }); }
    if (items.length === 0) return NextResponse.json({ error: "Aucun article à réordonner" }, { status: 400 });

    // Recalculate prices from DB (never trust stored prices)
    const menuItems = await db.menuItem.findMany({
      where: { restaurantId: original.restaurantId, available: true },
      select: { name: true, price: true },
    });
    let total = 0;
    const verifiedItems = items.map(item => {
      const dbItem = menuItems.find(m => m.name === item.name);
      const price = dbItem ? Number(dbItem.price) : (item.price || 0);
      const qty = item.qty ?? 1;
      total += price * qty;
      return { ...item, qty, price };
    });

    const order = await db.order.create({
      data: {
        items: JSON.stringify(verifiedItems),
        total,
        orderType: original.orderType,
        customerName: customer.name,
        paymentMethod: original.paymentMethod,
        deliveryAddress: original.deliveryAddress,
        restaurantId: original.restaurantId,
        customerId: customer.id,
      },
    });

    return NextResponse.json({ ok: true, orderId: order.id, total }, { status: 201 });
  } catch (error) {
    console.error("[reorder:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
