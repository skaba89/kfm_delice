import { NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { authenticateAdmin, hasRole } from "@/lib/auth";

// All methods: Admin/Manager auth required
// GET /api/stock — list stock items, optionally filtered by category or low-stock
export async function GET(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "staff", "kitchen"]))
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const restaurantId = admin.restaurantId;
    const sp = new URL(request.url).searchParams;
    const category = sp.get("category");
    const lowStockOnly = sp.get("lowStock") === "1";

    const items = await prisma.stockItem.findMany({
      where: {
        restaurantId,
        ...(category ? { category } : {}),
      },
      orderBy: [{ name: "asc" }],
      include: { _count: { select: { movements: true } } },
    });

    // Compute status: 'ok' | 'low' | 'out'
    const enriched = items
      .map((it) => ({
        ...it,
        status: it.quantity <= 0 ? "out" : it.quantity <= it.minThreshold ? "low" : "ok",
      }))
      .filter((it) => (lowStockOnly ? it.status !== "ok" : true));

    // Summary metrics
    const totalValue = items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);
    const lowCount = items.filter((it) => it.quantity > 0 && it.quantity <= it.minThreshold).length;
    const outCount = items.filter((it) => it.quantity <= 0).length;

    // Recent movements (last 50)
    const movements = await prisma.stockMovement.findMany({
      where: { restaurantId },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      include: { stockItem: { select: { name: true, unit: true } } },
    });

    return NextResponse.json({
      items: enriched,
      movements,
      summary: {
        totalItems: items.length,
        totalValue,
        lowCount,
        outCount,
      },
    });
  } catch (e) {
    console.error("[stock GET]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/stock — create new stock item
export async function POST(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager"]))
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const restaurantId = admin.restaurantId;
    const body = await request.json();
    const { name, sku, category, quantity, unit, minThreshold, unitCost, supplier, notes } = body;
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    }

    const item = await prisma.stockItem.create({
      data: {
        name: name.trim(),
        sku: String(sku || ""),
        category: String(category || "general"),
        quantity: Number(quantity) || 0,
        unit: String(unit || "unité"),
        minThreshold: Number(minThreshold) || 0,
        unitCost: Number(unitCost) || 0,
        supplier: String(supplier || ""),
        notes: String(notes || ""),
        restaurantId,
        lastRestocked: Number(quantity) > 0 ? new Date().toISOString() : "",
      },
    });

    // Initial movement record if quantity > 0
    if (Number(quantity) > 0) {
      await prisma.stockMovement.create({
        data: {
          stockItemId: item.id,
          type: "in",
          quantity: Number(quantity),
          reason: "Stock initial",
          actor: admin.email || "admin",
          restaurantId,
        },
      });
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    console.error("[stock POST]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/stock — update item fields OR record a movement (in/out/adjust/waste)
export async function PATCH(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager"]))
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await request.json();
    const { id, action, ...data } = body;
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    // ── Multi-tenant isolation ──────────────────────────────────
    // findUnique by id only would let an admin of restaurant A modify
    // stock of restaurant B by guessing a UUID. findFirst by id AND
    // restaurantId enforces tenant scoping.
    const existing = await prisma.stockItem.findFirst({
      where: { id, restaurantId: admin.restaurantId },
    });
    if (!existing) return NextResponse.json({ error: "Article introuvable" }, { status: 404 });

    // Action = record a stock movement
    if (action === "movement") {
      const { type, quantity, reason } = data;
      if (!["in", "out", "adjust", "waste"].includes(type)) {
        return NextResponse.json({ error: "Type de mouvement invalide" }, { status: 400 });
      }
      const qty = Number(quantity);
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: "Quantité invalide" }, { status: 400 });
      }

      // Compute new quantity
      let newQty = existing.quantity;
      if (type === "in") newQty = existing.quantity + qty;
      else if (type === "out") newQty = Math.max(0, existing.quantity - qty);
      else if (type === "waste") newQty = Math.max(0, existing.quantity - qty);
      else if (type === "adjust") newQty = qty; // adjust sets absolute value

      const [updated, movement] = await prisma.$transaction([
        prisma.stockItem.update({
          where: { id },
          data: {
            quantity: newQty,
            lastRestocked: type === "in" ? new Date().toISOString() : existing.lastRestocked,
          },
        }),
        prisma.stockMovement.create({
          data: {
            stockItemId: id,
            type,
            quantity: qty,
            reason: String(reason || ""),
            actor: admin.email || "admin",
            restaurantId: existing.restaurantId,
          },
        }),
      ]);

      return NextResponse.json({ item: updated, movement });
    }

    // Default: update item fields
    const allowedFields = ["name", "sku", "category", "quantity", "unit", "minThreshold", "unitCost", "supplier", "notes"];
    const updateData: Record<string, unknown> = {};
    for (const f of allowedFields) {
      if (f in data) updateData[f] = data[f];
    }
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
    }

    const updated = await prisma.stockItem.update({ where: { id }, data: updateData });
    return NextResponse.json({ item: updated });
  } catch (e) {
    console.error("[stock PATCH]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/stock — delete a stock item
export async function DELETE(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager"]))
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const sp = new URL(request.url).searchParams;
    const id = sp.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    // ── Multi-tenant isolation: scope delete to admin's restaurant.
    // deleteMany returns { count: N } — if N === 0, the item either
    // didn't exist or belonged to another restaurant (we return 404
    // either way, without leaking which one).
    const result = await prisma.stockItem.deleteMany({
      where: { id, restaurantId: admin.restaurantId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Article introuvable" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[stock DELETE]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
