import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword, generateToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { driverLoginSchema } from "@/lib/validations";
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
    const validation = driverLoginSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, password } = validation.data;

    // Resolve tenant from request to scope driver lookup
    const restaurantId = await getRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
    }

    // Use Prisma client — works on both SQLite and PostgreSQL.
    // Driver has @@unique([email, restaurantId]) so findFirst is the right call.
    const driver = await db.driver.findFirst({
      where: { email, restaurantId },
      include: { restaurant: { select: { slug: true } } },
    });
    if (!driver || !driver.password) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, driver.password);
    if (!isValid) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    const restaurantSlug = driver.restaurant?.slug || "";

    // Generate JWT token with tenant context
    const token = generateToken({
      id: driver.id,
      email: driver.email,
      role: "driver",
      type: "driver",
      restaurantId: driver.restaurantId,
      restaurantSlug,
    });

    return NextResponse.json({
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
      token,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur de connexion" }, { status: 500 });
  }
}
