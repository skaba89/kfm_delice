import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword, generateToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
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
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, password } = validation.data;

    const admin = await db.admin.findFirst({ where: { email } });
    if (!admin) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    // Verify password with bcrypt
    const isValid = await verifyPassword(password, admin.password);
    if (!isValid) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    if (admin.status === "inactive") {
      return NextResponse.json({ error: "Compte désactivé. Contactez l'administrateur." }, { status: 403 });
    }

    // Generate JWT token
    const token = generateToken({ id: admin.id, email: admin.email, role: admin.role, type: "admin" });

    return NextResponse.json({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      status: admin.status,
      token,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur de connexion" }, { status: 500 });
  }
}
