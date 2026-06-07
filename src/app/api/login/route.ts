import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body?.email;
    const password = body?.password;

    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }

    const admin = await db.admin.findFirst({ where: { email } });
    if (!admin || admin.password !== password) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    if (admin.status === "inactive") {
      return NextResponse.json({ error: "Compte désactivé. Contactez l'administrateur." }, { status: 403 });
    }

    return NextResponse.json({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      status: admin.status,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur de connexion" }, { status: 500 });
  }
}
