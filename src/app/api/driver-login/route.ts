import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword, generateToken } from "@/lib/auth";
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
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }

    const driver = await db.driver.findFirst({ where: { email } });
    if (!driver || !driver.password) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, driver.password);
    if (!isValid) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    // Generate JWT token with driver type
    const token = generateToken({ id: driver.id, email: driver.email, role: "driver", type: "driver" });

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
      currentOrderId: driver.currentOrderId,
      lat: driver.lat,
      lng: driver.lng,
      token,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur de connexion" }, { status: 500 });
  }
}
