import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole, PERMISSION_GROUPS } from "@/lib/auth";
import { buildTableQrUrl } from "@/lib/table-qr";
import { logAudit } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ────────────────────────────────────────────────────────────────
// GET /api/tables/[id]/qr — return QR token + URL for a table
// ────────────────────────────────────────────────────────────────
export async function GET(request: Request, ctx: RouteContext) {
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
    const table = await db.restaurantTable.findFirst({
      where: { id, restaurantId: admin.restaurantId },
      select: {
        id: true,
        name: true,
        number: true,
        qrToken: true,
        qrVersion: true,
        qrEnabled: true,
        qrGeneratedAt: true,
        scanCount: true,
        lastScannedAt: true,
      },
    });
    if (!table) {
      return NextResponse.json({ error: "Table introuvable" }, { status: 404 });
    }

    // Audit download
    await logAudit({
      actorId: admin.id,
      actorType: "admin",
      action: "table_qr_download",
      entityType: "RestaurantTable",
      entityId: id,
      restaurantId: admin.restaurantId,
      after: { qrVersion: table.qrVersion },
      request,
    }).catch(() => {});

    return NextResponse.json({
      id: table.id,
      name: table.name,
      number: table.number,
      qrToken: table.qrToken,
      qrVersion: table.qrVersion,
      qrEnabled: table.qrEnabled,
      qrUrl: buildTableQrUrl(table.qrToken, new URL(request.url).origin),
      qrGeneratedAt: table.qrGeneratedAt,
      scanCount: table.scanCount,
      lastScannedAt: table.lastScannedAt,
    });
  } catch (error) {
    console.error("[tables:qr:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
