import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const admin = await db.admin.findFirst({ where: { email } });
    if (!admin || admin.password !== password) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }
    return NextResponse.json({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur de connexion" }, { status: 500 });
  }
}
