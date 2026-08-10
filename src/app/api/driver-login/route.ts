import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { driverLoginSchema } from "@/lib/validations";
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
    const validation = driverLoginSchema.safeParse(body);
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

    const driver = await db.driver.findFirst({
      where: { email, restaurantId },
      include: { restaurant: { select: { slug: true } } },
    });

    if (!driver || !driver.password) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    if (!(await verifyPassword(password, driver.password))) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    if (driver.status === "inactive") {
      return NextResponse.json({ error: "Compte livreur désactivé" }, { status: 403 });
    }

    const restaurantSlug = driver.restaurant?.slug || "";
    const tokenPair = await issueTokenPair({
      userId: driver.id,
      userType: "driver",
      email: driver.email,
      role: "driver",
      restaurantId: driver.restaurantId,
      restaurantSlug,
    });

    const response = NextResponse.json({
      id: driver.id,
      email: driver.email,
      name: driver.name,
      phone: driver.phone,
      vehicle: driver.vehicle,
      status: driver.status,
      rating: driver.rating,
      totalDeliveries: driver.totalDeliveries,
      zone: driver.zone,
      currentOrderId: driver.currentOrderId || "",
      mustChangePassword: driver.mustChangePassword ?? false,
      lat: driver.lat,
      lng: driver.lng,
      restaurantId: driver.restaurantId,
      restaurantSlug,
      token: tokenPair.accessToken,
      refreshTokenExpiresAt: tokenPair.expiresAt.toISOString(),
    });
    setRefreshTokenCookie(response, tokenPair.refreshToken, tokenPair.expiresAt);
    return response;
  } catch (error) {
    console.error("[driver-login] Error:", error);
    return NextResponse.json(
      {
        error: "Erreur de connexion",
        ...(process.env.NODE_ENV !== "production" && error instanceof Error ? { debug: error.message } : {}),
      },
      { status: 500 }
    );
  }
}
