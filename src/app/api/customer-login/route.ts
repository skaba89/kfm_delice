import { db, dbReady } from "@/lib/db";
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

  const steps: string[] = [];

  try {
    steps.push("dbReady");
    await dbReady;

    steps.push("parse-body");
    const body = await request.json();

    steps.push("validate");
    const validation = loginSchema.safeParse(body);
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

    steps.push("find-customer");
    // Try WITHOUT include first — if the relation is broken, this will still work
    let customer;
    try {
      customer = await db.customer.findFirst({
        where: { email, restaurantId },
        include: { restaurant: { select: { slug: true } } },
      });
    } catch (includeErr) {
      // Fallback: query without include (relation may be broken in DB)
      console.error("[customer-login] findFirst with include failed, trying without:", includeErr);
      const basicCustomer = await db.customer.findFirst({
        where: { email, restaurantId },
      });
      if (basicCustomer) {
        const restaurant = await db.restaurant.findUnique({
          where: { id: basicCustomer.restaurantId },
          select: { slug: true },
        });
        customer = { ...basicCustomer, restaurant };
      }
    }

    if (!customer) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    steps.push("verify-password");
    const isValid = await verifyPassword(password, customer.password);
    if (!isValid) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    if (customer.status === "inactive") {
      return NextResponse.json({ error: "Compte désactivé. Contactez le restaurant." }, { status: 403 });
    }

    steps.push("generate-token");
    const restaurantSlug = customer.restaurant?.slug || "";
    const token = generateToken({
      id: customer.id,
      email: customer.email,
      role: "customer",
      type: "customer",
      restaurantId: customer.restaurantId,
      restaurantSlug,
    });

    steps.push("done");

    return NextResponse.json({
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
      token,
    });
  } catch (error) {
    console.error("[customer-login] Error:", error);
    const errMsg = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json(
      {
        error: "Erreur de connexion",
        ...(process.env.NODE_ENV !== "production" ? { debug: errMsg } : {}),
      },
      { status: 500 }
    );
  }
}
