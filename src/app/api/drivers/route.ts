import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { commercialFeatureGate } from "@/lib/commercial-feature-gate";
import { driverSchema, driverPatchSchema } from "@/lib/validations";
import { parsePagination, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";
import { Prisma } from "@prisma/client";

// All methods: Admin/Manager auth required
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager", "delivery_manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const featureGate = await commercialFeatureGate(admin.restaurantId, 'drivers');
    if (featureGate) return featureGate;

    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);
    const { sortBy, sortOrder } = parseSorting(sp, ['createdAt', 'name', 'rating', 'totalDeliveries', 'status'] as const, 'createdAt');
    const search = parseSearch(sp);
    const statusFilter = parseStatusFilter(sp, ['available', 'busy', 'offline']);
    const vehicleFilter = parseStatusFilter(sp, ['moto', 'velo', 'voiture'], 'vehicle');

    const restaurantId = admin.restaurantId;
    const where: Prisma.DriverWhereInput = { restaurantId };
    if (statusFilter) where.status = statusFilter;
    if (vehicleFilter) where.vehicle = vehicleFilter;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { zone: { contains: search } },
      ];
    }

    const [drivers, total] = await Promise.all([
      db.driver.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.driver.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: bigIntToNumber(drivers),
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
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "delivery_manager"])) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const featureGate = await commercialFeatureGate(admin.restaurantId, 'drivers');
    if (featureGate) return featureGate;
    const validation = driverSchema.safeParse(await request.json());
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    const driver = await db.driver.create({ data: { ...validation.data, restaurantId: admin.restaurantId } });
    return NextResponse.json(bigIntToNumber(driver), { status: 201 });
  } catch (error) {
    console.error("[drivers] POST error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "delivery_manager"])) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const featureGate = await commercialFeatureGate(admin.restaurantId, 'drivers');
    if (featureGate) return featureGate;
    const validation = driverPatchSchema.safeParse(await request.json());
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0]?.message || "Données invalides" }, { status: 400 });

    const { id, currentOrderId, ...data } = validation.data;
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    const existing = await db.driver.findFirst({ where: { id, restaurantId: admin.restaurantId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Livreur introuvable" }, { status: 404 });

    const updateData: Record<string, unknown> = { ...data };
    if (currentOrderId !== undefined) updateData.currentOrderId = currentOrderId;
    if (Object.keys(updateData).length === 0) return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });

    const updated = await db.driver.update({ where: { id }, data: updateData });
    return NextResponse.json(bigIntToNumber(updated));
  } catch (error) {
    console.error("[drivers] PATCH error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "delivery_manager"])) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const featureGate = await commercialFeatureGate(admin.restaurantId, 'drivers');
    if (featureGate) return featureGate;

    const url = new URL(request.url);
    let id: string | undefined = url.searchParams.get("id") || undefined;
    if (!id) { try { id = (await request.json())?.id; } catch { /* empty body */ } }
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    const existing = await db.driver.findFirst({ where: { id, restaurantId: admin.restaurantId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Livreur introuvable" }, { status: 404 });
    await db.driver.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[drivers] DELETE error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
