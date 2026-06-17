import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateCustomer, hasRole } from "@/lib/auth";
import { getRestaurantId } from "@/lib/tenant";
import { reviewSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter, buildSearchWhere } from "@/lib/pagination";

// GET: Public
export async function GET(request: Request) {
  try {
    await dbReady;
    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);
    const { sortBy, sortOrder } = parseSorting(sp, ['createdAt', 'rating', 'customerName'] as const, 'createdAt');
    const search = parseSearch(sp);
    const ratingFilter = parseStatusFilter(sp, ['1', '2', '3', '4', '5'], 'rating');

    const restaurantId = await getRestaurantId(request);
    if (!restaurantId) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });

    const where = {
      restaurantId,
      ...(ratingFilter && { rating: parseInt(ratingFilter) }),
      ...(search && buildSearchWhere(search, ['customerName', 'comment'])),
    };
    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        include: { customer: { select: { id: true, name: true, email: true } } },
        skip: prismaSkip(page, limit),
        take: prismaTake(limit),
      }),
      db.review.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: reviews,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Customer auth required (link review to customer ID)
export async function POST(request: Request) {
  try {
    await dbReady;
    const customer = await authenticateCustomer(request);
    if (!customer) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const validation = reviewSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    // Use customer's restaurantId for tenant scoping
    const restaurantId = customer.restaurantId;
    if (!restaurantId) return NextResponse.json({ error: "Aucun restaurant" }, { status: 400 });

    // Use authenticated customer's name and set customerId FK
    const review = await db.review.create({
      data: { ...validation.data, customerName: customer.name, customerId: customer.id, restaurantId },
    });
    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE: Admin/Manager auth required
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
    // Scope delete to admin's restaurant
    await db.review.deleteMany({ where: { id, restaurantId: admin.restaurantId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
