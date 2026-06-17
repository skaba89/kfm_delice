import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { driverSchema, driverPatchSchema } from "@/lib/validations";
import { parsePagination, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";

// All methods: Admin/Manager auth required
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);
    const { sortBy, sortOrder } = parseSorting(sp, ['createdAt', 'name', 'rating', 'totalDeliveries', 'status'] as const, 'createdAt');
    const search = parseSearch(sp);
    const statusFilter = parseStatusFilter(sp, ['available', 'busy', 'offline']);
    const vehicleFilter = parseStatusFilter(sp, ['moto', 'velo', 'voiture'], 'vehicle');

    const restaurantId = admin.restaurantId;

    // Build WHERE clause for raw SQL
    const conditions: string[] = ['d.restaurantId = ?'];
    const params: unknown[] = [restaurantId];
    if (statusFilter) { conditions.push('d.status = ?'); params.push(statusFilter); }
    if (vehicleFilter) { conditions.push('d.vehicle = ?'); params.push(vehicleFilter); }
    if (search) {
      conditions.push('(d.name LIKE ? OR d.email LIKE ? OR d.phone LIKE ? OR d.zone LIKE ?)');
      const likeSearch = `%${search}%`;
      params.push(likeSearch, likeSearch, likeSearch, likeSearch);
    }
    const whereClause = conditions.join(' AND ');

    // Validate sort column to prevent SQL injection
    const validSortCols = ['createdAt', 'name', 'rating', 'totalDeliveries', 'status'];
    const safeSortBy = validSortCols.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Count — explicitly convert BigInt to Number for JSON serialization
    const countResult = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM Driver d WHERE ${whereClause}`,
      ...params
    );
    const total = countResult[0] ? Number(countResult[0].count) : 0;

    // Fetch data — use explicit column list to avoid missing column errors
    const offset = (page - 1) * limit;
    const rawDrivers = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT d.id, d.email, d.password, d.name, d.phone, d.vehicle, d.status,
        d.rating, d.totalDeliveries, d.zone,
        COALESCE(d.lat, 0) as lat, COALESCE(d.lng, 0) as lng,
        COALESCE(d.currentOrderId, '') as currentOrderId,
        COALESCE(d.mustChangePassword, 0) as mustChangePassword,
        d.restaurantId, d.createdAt, d.updatedAt
      FROM Driver d WHERE ${whereClause}
      ORDER BY d.${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?`,
      ...params, limit, offset
    );
    // Convert BigInt fields to Number for JSON serialization
    const drivers = rawDrivers.map(d => bigIntToNumber(d));

    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: drivers,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error("[drivers] GET error:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Erreur serveur", details: errorMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validation = driverSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const restaurantId = admin.restaurantId;
    const driver = await db.driver.create({
      data: { ...validation.data, restaurantId },
    });
    return NextResponse.json(driver, { status: 201 });
  } catch (error) {
    console.error("[drivers] POST error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validation = driverPatchSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { id, currentOrderId, ...data } = validation.data;
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    // Scope update to admin's restaurant
    const existing = await db.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT id FROM Driver WHERE id = ? AND restaurantId = ?',
      id, admin.restaurantId
    );
    if (!existing[0]) return NextResponse.json({ error: "Livreur introuvable" }, { status: 404 });

    const updateData: Record<string, unknown> = { ...data };
    if (currentOrderId !== undefined) updateData.currentOrderId = currentOrderId;

    // Use raw SQL for update to avoid schema mismatch
    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(updateData)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
    if (setClauses.length === 0) {
      return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
    }
    values.push(id);
    await db.$executeRawUnsafe(
      `UPDATE Driver SET ${setClauses.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      ...values
    );

    // Fetch updated driver
    const updated = await db.$queryRawUnsafe<Array<{
      id: string; email: string; name: string; phone: string; vehicle: string;
      status: string; rating: number; totalDeliveries: number; zone: string;
      lat: number; lng: number; currentOrderId: string; restaurantId: string;
    }>>(
      `SELECT id, email, name, phone, vehicle, status, rating, totalDeliveries, zone,
        COALESCE(lat, 0) as lat, COALESCE(lng, 0) as lng,
        COALESCE(currentOrderId, '') as currentOrderId, restaurantId
      FROM Driver WHERE id = ?`, id
    );

    return NextResponse.json(updated[0] || { id });
  } catch (error) {
    console.error("[drivers] PATCH error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await request.json();
    await db.$executeRawUnsafe(
      'DELETE FROM Driver WHERE id = ? AND restaurantId = ?',
      id, admin.restaurantId
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[drivers] DELETE error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
