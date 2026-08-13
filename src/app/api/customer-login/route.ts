import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { getRestaurantId } from "@/lib/tenant";
import { issueTokenPair, setRefreshTokenCookie } from "@/lib/refresh-token";

export async function POST(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const { allowed, remaining } = await rateLimit(clientIp, 5, 60000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans une minute." },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": String(remaining) } }
    );
  }

  try {
    await dbReady;
    const body = await request.json();
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;
    const restaurantId = await getRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
    }

    const customer = await db.customer.findFirst({
      where: { email, restaurantId },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        phone: true,
        address: true,
        loyaltyPoints: true,
        totalOrders: true,
        totalSpent: true,
        status: true,
        mustChangePassword: true,
        restaurantId: true,
        tokenVersion: true,
        restaurant: { select: { slug: true } },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    if (!(await verifyPassword(password, customer.password))) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    if (customer.status === "inactive") {
      return NextResponse.json({ error: "Compte désactivé. Contactez le restaurant." }, { status: 403 });
    }

    const restaurantSlug = customer.restaurant?.slug || "";
    const tokenPair = await issueTokenPair({
      userId: customer.id,
      userType: "customer",
      email: customer.email,
      role: "customer",
      restaurantId: customer.restaurantId,
      restaurantSlug,
      tokenVersion: customer.tokenVersion,
    });

    const response = NextResponse.json({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      loyaltyPoints: customer.loyaltyPoints,
      totalOrders: customer.totalOrders,
      totalSpent: Number(customer.totalSpent),
      status: customer.status,
      mustChangePassword: customer.mustChangePassword ?? false,
      restaurantId: customer.restaurantId,
      restaurantSlug,
      token: tokenPair.accessToken,
      refreshTokenExpiresAt: tokenPair.expiresAt.toISOString(),
    });
    setRefreshTokenCookie(response, tokenPair.refreshToken, tokenPair.expiresAt);
    return response;
  } catch (error) {
    console.error("[customer-login] Error:", error);
    return NextResponse.json(
      {
        error: "Erreur de connexion",
        ...(process.env.NODE_ENV !== "production" && error instanceof Error ? { debug: error.message } : {}),
      },
      { status: 500 }
    );
  }
}
