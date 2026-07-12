import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole, PERMISSION_GROUPS } from "@/lib/auth";
import { generateUniqueTableQrToken, buildTableQrUrl } from "@/lib/table-qr";
import { logAudit } from "@/lib/audit";

// ────────────────────────────────────────────────────────────────
// GET /api/tables — list tables for the authenticated admin's restaurant
// ────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, [...PERMISSION_GROUPS.MENU_READ, "admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const sp = new URL(request.url).searchParams;
    const includeInactive = sp.get("includeInactive") === "true";

    const where: { restaurantId: string; active?: boolean } = {
      restaurantId: admin.restaurantId,
    };
    if (!includeInactive) where.active = true;

    const tables = await db.restaurantTable.findMany({
      where,
      orderBy: [{ zone: "asc" }, { number: "asc" }],
    });

    return NextResponse.json({
      data: tables.map((t) => ({
        id: t.id,
        name: t.name,
        number: t.number,
        capacity: t.capacity,
        zone: t.zone,
        status: t.status,
        active: t.active,
        qrEnabled: t.qrEnabled,
        qrVersion: t.qrVersion,
        qrUrl: buildTableQrUrl(t.qrToken, new URL(request.url).origin),
        scanCount: t.scanCount,
        lastScannedAt: t.lastScannedAt,
        qrGeneratedAt: t.qrGeneratedAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[tables:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────────
// POST /api/tables — create a new table for the authenticated admin's restaurant
// ────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, PERMISSION_GROUPS.MENU_MANAGE)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { name, number, capacity, zone } = body as {
      name?: string;
      number?: string;
      capacity?: number;
      zone?: string;
    };

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Nom de table requis" }, { status: 400 });
    }
    if (!number || typeof number !== "string" || number.trim().length === 0) {
      return NextResponse.json({ error: "Numéro de table requis" }, { status: 400 });
    }

    // Check uniqueness within this restaurant
    const existing = await db.restaurantTable.findFirst({
      where: { restaurantId: admin.restaurantId, number: number.trim() },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Une table avec le numéro "${number}" existe déjà dans ce restaurant` },
        { status: 409 }
      );
    }

    const qrToken = await generateUniqueTableQrToken();
    const table = await db.restaurantTable.create({
      data: {
        restaurantId: admin.restaurantId,
        name: name.trim(),
        number: number.trim(),
        capacity: typeof capacity === "number" && capacity > 0 ? capacity : 4,
        zone: typeof zone === "string" ? zone.trim() : "",
        qrToken,
        qrEnabled: true,
        qrGeneratedAt: new Date(),
      },
    });

    // Audit
    await logAudit({
      actorId: admin.id,
      actorType: "admin",
      action: "table_create",
      entityType: "RestaurantTable",
      entityId: table.id,
      restaurantId: admin.restaurantId,
      after: { name: table.name, number: table.number, zone: table.zone },
      request,
    }).catch(() => {});

    return NextResponse.json({
      id: table.id,
      name: table.name,
      number: table.number,
      capacity: table.capacity,
      zone: table.zone,
      status: table.status,
      active: table.active,
      qrEnabled: table.qrEnabled,
      qrVersion: table.qrVersion,
      qrUrl: buildTableQrUrl(table.qrToken, new URL(request.url).origin),
      qrToken: table.qrToken,
    }, { status: 201 });
  } catch (error) {
    console.error("[tables:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
