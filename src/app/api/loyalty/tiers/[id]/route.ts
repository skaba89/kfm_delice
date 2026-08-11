import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole, PERMISSION_GROUPS } from "@/lib/auth";
import { commercialFeatureGate } from "@/lib/commercial-feature-gate";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ────────────────────────────────────────────────────────────────
// DELETE /api/loyalty/tiers/[id] — delete a custom tier
// ────────────────────────────────────────────────────────────────
export async function DELETE(request: Request, ctx: RouteContext) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, PERMISSION_GROUPS.LOYALTY_MANAGE)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const featureGate = await commercialFeatureGate(admin.restaurantId, 'loyalty');
    if (featureGate) return featureGate;

    const { id } = await ctx.params;
    const existing = await db.loyaltyTier.findFirst({
      where: { id, restaurantId: admin.restaurantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Palier introuvable" }, { status: 404 });
    }

    await db.loyaltyTier.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[loyalty/tiers:DELETE]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
