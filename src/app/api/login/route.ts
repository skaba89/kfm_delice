import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword, generateToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

// Auto-seed lock to prevent concurrent seeding
let _seedPromise: Promise<void> | null = null;

async function ensureDbSeeded() {
  if (_seedPromise) return _seedPromise;
  _seedPromise = (async () => {
    try {
      const count = await db.restaurant.count();
      if (count > 0) {
        console.log(`[auto-seed] DB already has ${count} restaurant(s), skipping login-time seed.`);
        return;
      }
      // NOTE: Login-time auto-seed is intentionally minimal — it does NOT
      // create the full demo dataset (no menu, no customers, no drivers,
      // no SaaS Account linkage). The authoritative seed is scripts/auto-seed.cjs
      // called from render-start.sh, which creates a SaaS-coherent structure:
      // Account -> Restaurant (principal) -> Admins (with accountId, quotas).
      //
      // This login-time fallback only exists for emergency local-dev
      // scenarios and is gated by ALLOW_LOGIN_AUTO_SEED=true (off by default).
      console.log("[auto-seed] Empty DB detected — login-time seed is minimal.");
      console.log("[auto-seed] For full demo data, run scripts/auto-seed.cjs or set ALLOW_AUTO_SEED=true on Render.");
    } catch (err) {
      console.error("[auto-seed] Failed:", err);
      _seedPromise = null; // Allow retry
    }
  })();
  return _seedPromise;
}

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

    // Auto-seed from login is disabled in production by default.
    // Seeding is normally handled by scripts/auto-seed.cjs (called from
    // render-start.sh), gated by ALLOW_AUTO_SEED=true.
    // To re-enable for dev/testing: set ALLOW_LOGIN_AUTO_SEED=true
    if (process.env.ALLOW_LOGIN_AUTO_SEED === "true") {
      await ensureDbSeeded();
    }

    const body = await request.json();

    // Validate input
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, password } = validation.data;

    // Use the Prisma Client directly. Now that `output: 'standalone'`
    // is removed (commit 0ad1589) and render-start.sh regenerates the
    // client at runtime with the correct provider (postgres on Render),
    // Prisma model queries work reliably. No more raw SQL workarounds.
    const admin = await db.admin.findUnique({
      where: { email },
      select: {
        id: true, email: true, password: true, name: true,
        role: true, status: true, restaurantId: true,
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Identifiants incorrects" },
        { status: 401 }
      );
    }

    // Verify password with bcrypt
    const isValid = await verifyPassword(password, admin.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Identifiants incorrects" },
        { status: 401 }
      );
    }

    if (admin.status === "inactive") {
      return NextResponse.json(
        { error: "Compte désactivé. Contactez l'administrateur." },
        { status: 403 }
      );
    }

    // Get restaurant slug
    const restaurant = await db.restaurant.findUnique({
      where: { id: admin.restaurantId },
      select: { slug: true },
    });
    const restaurantSlug = restaurant?.slug || "";

    // Generate JWT token with tenant context
    const token = generateToken({
      id: admin.id, email: admin.email, role: admin.role,
      type: "admin", restaurantId: admin.restaurantId,
      restaurantSlug,
    });

    return NextResponse.json({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      status: admin.status,
      mustChangePassword: false,
      restaurantId: admin.restaurantId,
      restaurantSlug,
      token,
    });
  } catch (error: unknown) {
    console.error("[login] Error:", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    // In production, never expose technical error details to the client.
    return NextResponse.json(
      {
        error: "Erreur de connexion",
        ...(process.env.NODE_ENV !== "production" ? { debug: message } : {}),
      },
      { status: 500 }
    );
  }
}
