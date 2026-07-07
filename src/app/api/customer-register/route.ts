import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { hashPassword, generateToken } from "@/lib/auth";
import { customerRegisterSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { getRestaurantId } from "@/lib/tenant";

export async function POST(request: Request) {
  // Rate limiting — check before any other logic
  const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const { allowed, remaining } = await rateLimit(clientIp, 5, 60000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans une minute." },
      {
        status: 429,
        headers: { "Retry-After": "60", "X-RateLimit-Remaining": String(remaining) },
      }
    );
  }

  try {
    await dbReady;
    const body = await request.json();

    // Validate input
    const validation = customerRegisterSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, password, name, phone, address } = validation.data;

    // Resolve tenant from request
    const restaurantId = await getRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
    }

    const existing = await db.customer.findFirst({ where: { email, restaurantId } });
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
    }

    // Hash password before storing
    const hashedPassword = await hashPassword(password);

    // Get restaurant slug for JWT
    const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } });

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
        restaurantId,
      },
    });

    // Generate JWT token with tenant context
    const token = generateToken({ id: customer.id, email: customer.email, role: "customer", type: "customer", restaurantId, restaurantSlug: restaurant?.slug || "" });

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
      restaurantId: customer.restaurantId,
      restaurantSlug: restaurant?.slug || "",
      token,
    }, { status: 201 });
  } catch (error) {
    console.error("[customer-register] Error:", error);
    const errMsg = error instanceof Error ? error.message : "Erreur inconnue";
    // TEMPORARY: expose error in all envs to diagnose the 500 on Render
    return NextResponse.json(
      {
        error: "Erreur lors de l'inscription",
        debug: errMsg,
      },
      { status: 500 }
    );
  }
}
