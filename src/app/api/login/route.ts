import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword, generateToken, hashPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

// Auto-seed lock to prevent concurrent seeding
let _seedPromise: Promise<void> | null = null;

async function ensureDbSeeded() {
  if (_seedPromise) return _seedPromise;
  _seedPromise = (async () => {
    try {
      // Use raw SQL to check if DB is empty (avoid schema mismatch)
      const countResult = await db.$queryRawUnsafe<Array<{ count: bigint }>>("SELECT COUNT(*) as count FROM Restaurant");
      const count = Number(countResult[0]?.count ?? 0);
      if (count === 0) {
        console.log("[auto-seed] Empty DB detected, seeding on first login...");
        const { hashSync } = await import("bcryptjs");

        // Create restaurant
        const restaurant = await db.restaurant.create({
          data: {
            name: "KFM Delice", slug: "kfm-delice", tagline: "L'Art du Goût Guinéen",
            description: "Restaurant gastronomique au cœur de Conakry.",
            phone: "+224 622 34 56 78", whatsapp: "+224 622 34 56 78",
            email: "reservation@kfm-delice.com",
            address: "Almamya, Corniche Nord, Conakry, Guinée",
            hours: "Lun-Dim : 11h00 - 23h00", rating: 4.9, tables: 25,
            deliveryFee: 5000, minDelivery: 15000,
            deliveryZones: "Kaloum:Dixinn:Matam:Matoto",
            plan: "pro", status: "active", currency: "GNF", locale: "fr",
            ownerEmail: "admin@kfm-delice.com", ownerName: "Admin KFM Delice",
          },
        });

        // Create restaurant config
        await db.restaurantConfig.create({
          data: {
            restaurantId: restaurant.id,
            heroImage: "/images/kfm-hero.png",
            primaryColor: "#ea580c", accentColor: "#f97316",
            menuCategories: JSON.stringify([
              { id: "entrees", name: "Entrées" },
              { id: "plats", name: "Plats Principaux" },
              { id: "mer", name: "Fruits de Mer" },
              { id: "desserts", name: "Desserts" },
              { id: "boissons", name: "Boissons" },
            ]),
            features: JSON.stringify({
              delivery: true, reservations: true, reviews: true, loyalty: true,
              pos: true, invoices: true, quotes: true, expenses: true, staff: true, drivers: true,
            }),
            openingHours: JSON.stringify({ open: 11, close: 23, timezone: "Africa/Conakry" }),
            socialLinks: JSON.stringify({ facebook: "", instagram: "", twitter: "" }),
          },
        });

        // Create admin user
        await db.admin.create({
          data: {
            email: "admin@kfm-delice.com",
            password: hashSync("kfm2024", 10),
            name: "Admin KFM Delice",
            role: "admin",
            status: "active",
            restaurantId: restaurant.id,
          },
        });

        // Create manager
        await db.admin.create({
          data: {
            email: "manager@kfm-delice.com",
            password: hashSync("manager2024", 10),
            name: "Aminata Diallo",
            role: "manager",
            status: "active",
            restaurantId: restaurant.id,
          },
        });

        console.log("[auto-seed] Database seeded successfully on first login!");
      }
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
    // Ensure DB is seeded before attempting login
    await ensureDbSeeded();

    const body = await request.json();

    // Validate input
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, password } = validation.data;

    // Use raw query to avoid schema mismatch issues (e.g., missing mustChangePassword column)
    const admins = await db.$queryRaw<Array<{
      id: string; email: string; password: string; name: string;
      role: string; status: string; restaurantId: string;
    }>>`SELECT id, email, password, name, role, status, restaurantId FROM Admin WHERE email = ${email} LIMIT 1`;

    const admin = admins[0];
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

    // Get restaurant slug — use raw SQL to avoid schema mismatch
    const restaurantRows = await db.$queryRawUnsafe<Array<{ slug: string }>>(
      'SELECT slug FROM Restaurant WHERE id = ?', admin.restaurantId
    );
    const restaurantSlug = restaurantRows[0]?.slug || "";

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
    return NextResponse.json(
      { error: "Erreur de connexion", debug: message },
      { status: 500 }
    );
  }
}
