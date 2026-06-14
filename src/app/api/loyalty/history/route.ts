import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateCustomer } from "@/lib/auth";
import { parsePagination, prismaSkip, prismaTake } from "@/lib/pagination";

// GET: Customer points history (requires customer auth)
export async function GET(request: Request) {
  try {
    const customer = await authenticateCustomer(request);
    if (!customer) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);

    const [history, total] = await Promise.all([
      db.loyaltyPointsHistory.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        skip: prismaSkip(page, limit),
        take: prismaTake(limit),
      }),
      db.loyaltyPointsHistory.count({
        where: { customerId: customer.id },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: history,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
