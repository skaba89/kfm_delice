import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword, generateToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

// ────────────────────────────────────────────────────────────────
// Platform Admin Login — super-admin for SaaS platform management
// ────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const { allowed } = await rateLimit(clientIp, 5, 60000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans une minute." },
      { status: 429 }
    );
  }

  try {
    await dbReady;

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }

    // Use Prisma client — works on both SQLite and PostgreSQL.
    // Raw SQL `FROM PlatformAdmin` fails on PostgreSQL due to identifier
    // case-folding; Prisma quotes identifiers correctly.
    const platformAdmin = await db.platformAdmin.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, name: true, role: true, status: true },
    });
    if (!platformAdmin) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, platformAdmin.password);
    if (!isValid) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    if (platformAdmin.status === "inactive") {
      return NextResponse.json({ error: "Compte désactivé" }, { status: 403 });
    }

    const token = generateToken({
      id: platformAdmin.id,
      email: platformAdmin.email,
      role: platformAdmin.role,
      type: "platform_admin",
    });

    // Audit log: platform admin login success (non-blocking)
    await logAudit({
      actorId: platformAdmin.id,
      actorType: "platform_admin",
      action: "platform_login_success",
      entityType: "PlatformAdmin",
      entityId: platformAdmin.id,
      request,
    }).catch(() => { /* non-blocking */ });

    return NextResponse.json({
      id: platformAdmin.id,
      email: platformAdmin.email,
      name: platformAdmin.name,
      role: platformAdmin.role,
      token,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur de connexion" }, { status: 500 });
  }
}
