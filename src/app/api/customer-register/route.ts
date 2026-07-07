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

  // Step-by-step diagnostic — each step logs its name so we can see
  // exactly where the 500 occurs when the debug field is returned.
  const steps: string[] = [];

  try {
    steps.push("dbReady");
    await dbReady;

    steps.push("parse-body");
    const body = await request.json();

    steps.push("validate");
    const validation = customerRegisterSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, password, name, phone, address } = validation.data;

    steps.push("get-restaurant-id");
    const restaurantId = await getRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json(
        { error: "Restaurant non trouvé", debug: `steps=${steps.join(",")}; slug-header=${request.headers.get("x-restaurant-slug") || "(none)"}` },
        { status: 404 }
      );
    }

    steps.push("check-existing");
    const existing = await db.customer.findFirst({ where: { email, restaurantId } });
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
    }

    steps.push("hash-password");
    const hashedPassword = await hashPassword(password);

    steps.push("find-restaurant");
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true },
    });

    steps.push("create-customer");
    const customer = await db.customer.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone: phone || "",
        address: address || "",
        loyaltyPoints: 100,
        totalOrders: 0,
        totalSpent: BigInt(0),
        status: "active",
        restaurantId,
      },
    });

    steps.push("generate-token");
    const token = generateToken({
      id: customer.id,
      email: customer.email,
      role: "customer",
      type: "customer",
      restaurantId,
      restaurantSlug: restaurant?.slug || "",
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
      restaurantId: customer.restaurantId,
      restaurantSlug: restaurant?.slug || "",
      token,
    }, { status: 201 });
  } catch (error) {
    console.error("[customer-register] Error:", error);
    const errMsg = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json(
      {
        error: "Erreur lors de l'inscription",
        ...(process.env.NODE_ENV !== "production" ? { debug: errMsg } : {}),
      },
      { status: 500 }
    );
  }
}
