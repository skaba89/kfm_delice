import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole, PERMISSION_GROUPS } from "@/lib/auth";
import { buildTableQrUrl } from "@/lib/table-qr";
import { logAudit } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ────────────────────────────────────────────────────────────────
// PATCH /api/tables/[id] — update table name/number/capacity/zone/status/active
// ────────────────────────────────────────────────────────────────
export async function PATCH(request: Request, ctx: RouteContext) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, PERMISSION_GROUPS.MENU_MANAGE)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = await request.json();
    const { name, number, capacity, zone, status, active, qrEnabled } = body as {
      name?: string;
      number?: string;
      capacity?: number;
      zone?: string;
      status?: string;
      active?: boolean;
      qrEnabled?: boolean;
    };

    // Fetch + multi-tenant isolation check
    const existing = await db.restaurantTable.findFirst({
      where: { id, restaurantId: admin.restaurantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Table introuvable" }, { status: 404 });
    }

    // If number is being changed, ensure uniqueness in the restaurant
    if (number && number !== existing.number) {
      const conflict = await db.restaurantTable.findFirst({
        where: {
          restaurantId: admin.restaurantId,
          number: number.trim(),
          NOT: { id },
        },
        select: { id: true },
      });
      if (conflict) {
        return NextResponse.json(
          { error: `Une table avec le numéro "${number}" existe déjà` },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (typeof name === "string" && name.trim().length > 0) updateData.name = name.trim();
    if (typeof number === "string" && number.trim().length > 0) updateData.number = number.trim();
    if (typeof capacity === "number" && capacity > 0) updateData.capacity = capacity;
    if (typeof zone === "string") updateData.zone = zone.trim();
    if (typeof status === "string") updateData.status = status;
    if (typeof active === "boolean") updateData.active = active;
    if (typeof qrEnabled === "boolean") updateData.qrEnabled = qrEnabled;

    const before = {
      name: existing.name,
      number: existing.number,
      capacity: existing.capacity,
      zone: existing.zone,
      status: existing.status,
      active: existing.active,
      qrEnabled: existing.qrEnabled,
    };

    const updated = await db.restaurantTable.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      actorId: admin.id,
      actorType: "admin",
      action: "table_update",
      entityType: "RestaurantTable",
      entityId: id,
      restaurantId: admin.restaurantId,
      before,
      after: updateData,
      request,
    }).catch(() => {});

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      number: updated.number,
      capacity: updated.capacity,
      zone: updated.zone,
      status: updated.status,
      active: updated.active,
      qrEnabled: updated.qrEnabled,
      qrVersion: updated.qrVersion,
      qrUrl: buildTableQrUrl(updated.qrToken, new URL(request.url).origin),
      scanCount: updated.scanCount,
      lastScannedAt: updated.lastScannedAt,
    });
  } catch (error) {
    console.error("[tables:PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────────
// DELETE /api/tables/[id] — soft-delete (active=false) if orders exist,
//                            hard delete otherwise.
// ────────────────────────────────────────────────────────────────
export async function DELETE(request: Request, ctx: RouteContext) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, PERMISSION_GROUPS.MENU_MANAGE)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await ctx.params;

    const existing = await db.restaurantTable.findFirst({
      where: { id, restaurantId: admin.restaurantId },
      include: { _count: { select: { orders: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Table introuvable" }, { status: 404 });
    }

    if (existing._count.orders > 0) {
      // Soft-delete: keep history, but disable
      await db.restaurantTable.update({
        where: { id },
        data: { active: false, qrEnabled: false },
      });
      await logAudit({
        actorId: admin.id,
        actorType: "admin",
        action: "table_disable",
        entityType: "RestaurantTable",
        entityId: id,
        restaurantId: admin.restaurantId,
        before: { active: existing.active, qrEnabled: existing.qrEnabled },
        after: { active: false, qrEnabled: false },
        request,
      }).catch(() => {});
      return NextResponse.json({
        ok: true,
        mode: "soft",
        message: "Table désactivée (commandes existantes conservées)",
      });
    }

    // Hard delete — no orders reference this table
    await db.restaurantTable.delete({ where: { id } });
    await logAudit({
      actorId: admin.id,
      actorType: "admin",
      action: "table_delete",
      entityType: "RestaurantTable",
      entityId: id,
      restaurantId: admin.restaurantId,
      before: { name: existing.name, number: existing.number },
      request,
    }).catch(() => {});

    return NextResponse.json({ ok: true, mode: "hard" });
  } catch (error) {
    console.error("[tables:DELETE]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
