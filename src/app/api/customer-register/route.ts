import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { hashPassword, generateToken } from "@/lib/auth";
import { customerRegisterSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Rate limiting — check before any other logic
  const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const { success, remaining } = rateLimit(clientIp, 5, 60000);
  if (!success) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans une minute." },
      {
        status: 429,
        headers: { "Retry-After": "60", "X-RateLimit-Remaining": String(remaining) },
      }
    );
  }

  try {
    const body = await request.json();

    // Validate input
    const validation = customerRegisterSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, password, name, phone, address } = validation.data;

    const existing = await db.customer.findFirst({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
    }

    // Hash password before storing
    const hashedPassword = await hashPassword(password);

    const customer = await db.customer.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone: phone || "",
        address: address || "",
        loyaltyPoints: 100,
        totalOrders: 0,
        totalSpent: 0,
        status: "active",
      },
    });

    // Generate JWT token
    const token = generateToken({ id: customer.id, email: customer.email, role: "customer", type: "customer" });

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
      token,
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur lors de l'inscription" }, { status: 500 });
  }
}
