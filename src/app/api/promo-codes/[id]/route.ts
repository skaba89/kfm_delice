import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole, PERMISSION_GROUPS } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ────────────────────────────────────────────────────────────────
// PATCH /api/promo-codes/[id] — update a promo code
// ────────────────────────────────────────────────────────────────
export async function PATCH(request: Request, ctx: RouteContext) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, PERMISSION_GROUPS.LOYALTY_MANAGE)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = await request.json();

    // Multi-tenant isolation
    const existing = await db.promoCode.findFirst({
      where: { id, restaurantId: admin.restaurantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Code promo introuvable" }, { status: 404 });
    }

    // If code is being changed, ensure uniqueness
    if (body.code && body.code !== existing.code) {
      const normalizedCode = String(body.code).trim().toUpperCase();
      const conflict = await db.promoCode.findFirst({
        where: {
          restaurantId: admin.restaurantId,
          code: normalizedCode,
          NOT: { id },
        },
        select: { id: true },
      });
      if (conflict) {
        return NextResponse.json(
          { error: `Le code "${normalizedCode}" existe déjà` },
          { status: 409 }
        );
      }
      body.code = normalizedCode;
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      "code", "description", "discountType", "discountValue",
      "minOrderTotal", "maxUses", "maxUsesPerUser", "active",
      "startsAt", "expiresAt",
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "startsAt" || field === "expiresAt") {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const updated = await db.promoCode.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      actorId: admin.id,
      actorType: "admin",
      action: "promocode_update",
      entityType: "PromoCode",
      entityId: id,
      restaurantId: admin.restaurantId,
      before: { code: existing.code, active: existing.active },
      after: updateData,
      request,
    }).catch(() => {});

    return NextResponse.json(bigIntToNumber(updated));
  } catch (error) {
    console.error("[promo-codes:PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────────
// DELETE /api/promo-codes/[id] — delete a promo code
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

    const { id } = await ctx.params;
    const existing = await db.promoCode.findFirst({
      where: { id, restaurantId: admin.restaurantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Code promo introuvable" }, { status: 404 });
    }

    await db.promoCode.delete({ where: { id } });

    await logAudit({
      actorId: admin.id,
      actorType: "admin",
      action: "promocode_delete",
      entityType: "PromoCode",
      entityId: id,
      restaurantId: admin.restaurantId,
      before: { code: existing.code },
      request,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[promo-codes:DELETE]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
