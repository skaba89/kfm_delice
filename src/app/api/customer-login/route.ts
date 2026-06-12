import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword, generateToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
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
    const body = await request.json();

    // Validate input
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, password } = validation.data;

    // Resolve tenant from request to scope customer lookup
    const restaurantId = await getRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
    }

    const customer = await db.customer.findFirst({ where: { email, restaurantId }, include: { restaurant: { select: { slug: true } } } });
    if (!customer) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    // Verify password with bcrypt
    const isValid = await verifyPassword(password, customer.password);
    if (!isValid) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    if (customer.status === "inactive") {
      return NextResponse.json({ error: "Compte désactivé. Contactez le restaurant." }, { status: 403 });
    }

    // Generate JWT token with tenant context
    const token = generateToken({ id: customer.id, email: customer.email, role: "customer", type: "customer", restaurantId: customer.restaurantId, restaurantSlug: customer.restaurant?.slug || "" });

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
      restaurantSlug: customer.restaurant?.slug || "",
      token,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur de connexion" }, { status: 500 });
  }
}
