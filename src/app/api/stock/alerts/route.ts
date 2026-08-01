import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";

// GET /api/stock/alerts — list low-stock items with auto-suggestions
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "kitchen", "staff"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const items = await db.stockItem.findMany({
      where: { restaurantId: admin.restaurantId, autoAlert: true },
      orderBy: { name: "asc" },
    });

    // Filter items below threshold and build suggestions
    const alerts = items
      .filter(item => item.quantity <= item.minThreshold)
      .map(item => {
        const shortfall = item.minThreshold - item.quantity;
        const suggestedQty = Math.ceil(shortfall * 2); // suggest double the shortfall
        const estimatedCost = suggestedQty * Number(item.unitCost);
        return {
          id: item.id,
          name: item.name,
          sku: item.sku,
          currentQty: item.quantity,
          unit: item.unit,
          minThreshold: item.minThreshold,
          shortfall,
          suggestedOrderQty: suggestedQty,
          unitCost: Number(item.unitCost),
          estimatedCost,
          supplier: item.supplier,
          category: item.category,
        };
      });

    const totalEstimatedCost = alerts.reduce((sum, a) => sum + a.estimatedCost, 0);

    return NextResponse.json({
      data: alerts,
      count: alerts.length,
      totalEstimatedCost,
      summary: alerts.length === 0
        ? "Tous les stocks sont au-dessus du seuil minimum ✅"
        : `${alerts.length} article(s) en rupture ou proche de la rupture`,
    });
  } catch (error) {
    console.error("[stock/alerts:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
