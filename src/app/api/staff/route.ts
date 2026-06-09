import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { staffSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake } from "@/lib/pagination";

// All methods: Admin/Manager auth required
export async function GET(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { page, limit } = parsePagination(new URL(request.url).searchParams);

    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });

    const where = { restaurantId: restaurant.id };
    const [staff, total] = await Promise.all([
      db.staff.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: prismaSkip(page, limit),
        take: prismaTake(limit),
      }),
      db.staff.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: staff,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validation = staffSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
    const staff = await db.staff.create({
      data: { ...validation.data, restaurantId: restaurant.id },
    });
    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validation = staffSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { id, ...data } = validation.data;
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const staff = await db.staff.update({ where: { id }, data });
    return NextResponse.json(staff);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await request.json();
    await db.staff.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
