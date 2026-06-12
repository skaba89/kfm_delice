import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { menuItemSchema, menuItemPatchSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch } from "@/lib/pagination";
import { Prisma } from "@prisma/client";
import { getRestaurantId } from "@/lib/tenant";

// GET: Public (no auth needed)
export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);
    const category = sp.get("category");
    const { sortBy, sortOrder } = parseSorting(sp, ['order', 'price', 'name', 'createdAt'] as const, 'order', 'asc');
    const search = parseSearch(sp);

    const restaurantId = await getRestaurantId(request);
    if (!restaurantId) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });

    const where: Prisma.MenuItemWhereInput = {
      restaurantId,
      ...(category && { category }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { description: { contains: search } },
          { badge: { contains: search } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      db.menuItem.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: prismaSkip(page, limit),
        take: prismaTake(limit),
      }),
      db.menuItem.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: items,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Admin/Manager only
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
    const validation = menuItemSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    // Use admin.restaurantId from authenticated admin — prefer over getRestaurantId for admin routes
    const restaurantId = admin.restaurantId;
    if (!restaurantId) return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });

    const item = await db.menuItem.create({
      data: { ...validation.data, restaurantId },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH: Admin/Manager only
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
    const validation = menuItemPatchSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { id, ...data } = validation.data;
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const item = await db.menuItem.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE: Admin/Manager only
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
    await db.menuItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
