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

  const steps: string[] = [];

  try {
    steps.push("dbReady");
    await dbReady;

    steps.push("parse-body");
    const body = await request.json();
    steps.push("validate");
    const validation = driverLoginSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, password } = validation.data;

    steps.push("get-restaurant-id");
    const restaurantId = await getRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json(
        { error: "Restaurant non trouvé", debug: `steps=${steps.join(",")}; slug-header=${request.headers.get("x-restaurant-slug") || "(none)"}` },
        { status: 404 }
      );
    }

    steps.push("find-driver");
    // Try WITHOUT include first — if the relation is broken, this will still work
    let driver;
    try {
      driver = await db.driver.findFirst({
        where: { email, restaurantId },
        include: { restaurant: { select: { slug: true } } },
      });
    } catch (includeErr) {
      console.error("[driver-login] findFirst with include failed, trying without:", includeErr);
      const basicDriver = await db.driver.findFirst({
        where: { email, restaurantId },
      });
      if (basicDriver) {
        const restaurant = await db.restaurant.findUnique({
          where: { id: basicDriver.restaurantId },
          select: { slug: true },
        });
        driver = { ...basicDriver, restaurant };
      }
    }

    if (!driver || !driver.password) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    steps.push("verify-password");
    const isValid = await verifyPassword(password, driver.password);
    if (!isValid) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    steps.push("generate-token");
    const restaurantSlug = driver.restaurant?.slug || "";
    const token = generateToken({
      id: driver.id,
      email: driver.email,
      role: "driver",
      type: "driver",
      restaurantId: driver.restaurantId,
      restaurantSlug,
    });

    steps.push("done");

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
    console.error("[driver-login] Error:", error);
    const errMsg = error instanceof Error ? error.message : "Erreur inconnue";
    const errStack = error instanceof Error ? error.stack?.split("\n").slice(0, 3).join(" | ") : "";
    return NextResponse.json(
      {
        error: "Erreur de connexion",
        debug: `steps=${steps.join(",")}`,
        errorDetail: errMsg,
        errorStack: errStack,
      },
      { status: 500 }
    );
  }
}
