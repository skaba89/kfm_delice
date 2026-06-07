import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body?.email;
    const password = body?.password;

    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }

    const customer = await db.customer.findFirst({ where: { email } });
    if (!customer || customer.password !== password) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    if (customer.status === "inactive") {
      return NextResponse.json({ error: "Compte désactivé. Contactez le restaurant." }, { status: 403 });
    }

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
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur de connexion" }, { status: 500 });
  }
}
