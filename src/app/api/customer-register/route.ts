import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, phone, address } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Nom, email et mot de passe requis" }, { status: 400 });
    }

    const existing = await db.customer.findFirst({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
    }

    const customer = await db.customer.create({
      data: {
        email,
        password,
        name,
        phone: phone || "",
        address: address || "",
        loyaltyPoints: 100,
        totalOrders: 0,
        totalSpent: 0,
        status: "active",
      },
    });

    return NextResponse.json({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      loyaltyPoints: customer.loyaltyPoints,
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      status: customer.status,
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur lors de l'inscription" }, { status: 500 });
  }
}
