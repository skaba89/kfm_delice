import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole, PERMISSION_GROUPS } from "@/lib/auth";
import { rotateTableQrToken } from "@/lib/table-qr";
import { logAudit } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ────────────────────────────────────────────────────────────────
// POST /api/tables/[id]/qr/rotate — rotate the QR token
//
// Generates a new opaque token, atomically replaces the old one, and
// increments qrVersion. The old token is immediately invalid (DB
// lookup returns null). The new token is returned so the admin can
// print the new QR code.
// ────────────────────────────────────────────────────────────────
export async function POST(request: Request, ctx: RouteContext) {
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
      select: { id: true, qrToken: true, qrVersion: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Table introuvable" }, { status: 404 });
    }

    const before = { qrToken: existing.qrToken, qrVersion: existing.qrVersion };

    const rotated = await rotateTableQrToken(id, admin.restaurantId);

    await logAudit({
      actorId: admin.id,
      actorType: "admin",
      action: "table_qr_rotate",
      entityType: "RestaurantTable",
      entityId: id,
      restaurantId: admin.restaurantId,
      before,
      after: { qrVersion: rotated.newVersion },
      request,
    }).catch(() => {});

    return NextResponse.json({
      id,
      qrVersion: rotated.newVersion,
      qrToken: rotated.newToken,
      qrUrl: rotated.newUrl,
      message: "QR code régénéré. L'ancien QR code est désormais invalide.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[tables:qr:rotate]", msg);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
