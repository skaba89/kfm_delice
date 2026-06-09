import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateCustomer, hasRole } from "@/lib/auth";
import { reviewSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake } from "@/lib/pagination";

// GET: Public
export async function GET(request: Request) {
  try {
    const { page, limit } = parsePagination(new URL(request.url).searchParams);

    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });

    const where = { restaurantId: restaurant.id };
    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
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

    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) return NextResponse.json({ error: "Aucun restaurant" }, { status: 400 });

    // Use authenticated customer's name
    const review = await db.review.create({
      data: { ...validation.data, customerName: customer.name, restaurantId: restaurant.id },
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
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await request.json();
    await db.review.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
