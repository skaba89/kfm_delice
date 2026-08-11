import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { commercialFeatureGate } from "@/lib/commercial-feature-gate";
import { staffSchema, staffPatchSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter, buildSearchWhere } from "@/lib/pagination";

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

    const featureGate = await commercialFeatureGate(admin.restaurantId, 'staff');
    if (featureGate) return featureGate;

    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);
    const { sortBy, sortOrder } = parseSorting(sp, ['createdAt', 'name', 'role', 'status'] as const, 'createdAt');
    const search = parseSearch(sp);
    const roleFilter = parseStatusFilter(sp, ['cuisinier', 'commis', 'patissier', 'serveur', 'barman', 'sommelier', 'receptionniste', 'gerant', 'caissier', 'plongeur', 'securite', 'voiturier', 'maintenance', 'dj', 'animateur'], 'role');
    const statusFilter = parseStatusFilter(sp, ['active', 'inactive', 'on_leave']);

    const restaurantId = admin.restaurantId;
    const where = {
      restaurantId,
      ...(roleFilter && { role: roleFilter }),
      ...(statusFilter && { status: statusFilter }),
      ...(search && buildSearchWhere(search, ['name', 'phone', 'role'])),
    };
    const [staff, total] = await Promise.all([
      db.staff.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: prismaSkip(page, limit),
        take: prismaTake(limit),
      }),
      db.staff.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: bigIntToNumber(staff),
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
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

    const featureGate = await commercialFeatureGate(admin.restaurantId, 'staff');
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = staffSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const restaurantId = admin.restaurantId;
    const staff = await db.staff.create({
      data: { ...validation.data, restaurantId },
    });
    return NextResponse.json(bigIntToNumber(staff), { status: 201 });
  } catch (error) {
    console.error(error);
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

    const featureGate = await commercialFeatureGate(admin.restaurantId, 'staff');
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = staffPatchSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { id, ...data } = validation.data;
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const existing = await db.staff.findFirst({ where: { id, restaurantId: admin.restaurantId } });
    if (!existing) return NextResponse.json({ error: "Personnel introuvable" }, { status: 404 });

    const staff = await db.staff.update({ where: { id }, data });
    return NextResponse.json(bigIntToNumber(staff));
  } catch (error) {
    console.error(error);
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

    const featureGate = await commercialFeatureGate(admin.restaurantId, 'staff');
    if (featureGate) return featureGate;

    const url = new URL(request.url);
    let id: string | undefined = url.searchParams.get("id") || undefined;
    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch { /* empty body, ignore */ }
    }
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }
    await db.staff.deleteMany({ where: { id, restaurantId: admin.restaurantId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
