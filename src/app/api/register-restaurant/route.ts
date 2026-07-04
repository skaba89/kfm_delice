import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { hashPassword, generateToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { generateSlug, ensureUniqueSlug } from "@/lib/tenant";
import { z } from "zod";

// ────────────────────────────────────────────────────────────────
// Restaurant Registration / Onboarding API
// Creates a new restaurant + admin account + default config
// ────────────────────────────────────────────────────────────────

const registerRestaurantSchema = z.object({
  // Restaurant info
  restaurantName: z.string().min(2, "Nom du restaurant requis (min 2 caractères)"),
  slug: z.string().min(2, "Slug requis").regex(/^[a-z0-9-]+$/, "Slug: lettres minuscules, chiffres et tirets uniquement").optional(),
  tagline: z.string().optional(),
  phone: z.string().min(1, "Téléphone du restaurant requis"),
  whatsapp: z.string().optional(),
  email: z.string().email("Email du restaurant invalide").optional(),
  address: z.string().optional(),
  currency: z.string().default("GNF"),
  locale: z.string().default("fr"),

  // Owner/Admin info
  ownerName: z.string().min(2, "Nom du propriétaire requis"),
  ownerEmail: z.string().email("Email du propriétaire invalide"),
  ownerPassword: z.string().min(6, "Mot de passe requis (min 6 caractères)"),
  ownerPhone: z.string().optional(),

  // Plan
  plan: z.enum(["free", "starter", "pro", "enterprise"]).default("free"),
});

export async function POST(request: Request) {
  // ── Gate: public restaurant registration is disabled by default ──
  // In the future SaaS architecture, only the platform super-admin will
  // create restaurants. For now, this gate prevents uncontrolled public
  // creation of restaurants + admin accounts.
  // To enable for demo: set ENABLE_PUBLIC_RESTAURANT_REGISTRATION=true
  if (process.env.ENABLE_PUBLIC_RESTAURANT_REGISTRATION !== "true") {
    return NextResponse.json(
      { error: "Inscription restaurant désactivée. Contactez l'équipe KFM Delice." },
      { status: 403 }
    );
  }

  // Rate limiting
  const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const { allowed } = await rateLimit(clientIp, 3, 60000); // 3 registrations per minute
  if (!allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives d'inscription. Réessayez dans une minute." },
      { status: 429 }
    );
  }

  try {
    await dbReady;
    const body = await request.json();
    const validation = registerRestaurantSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const data = validation.data;

    // Generate or validate slug
    const baseSlug = data.slug || generateSlug(data.restaurantName);
    const slug = await ensureUniqueSlug(baseSlug);

    // Check if owner email is already used as admin
    const existingAdmin = await db.admin.findFirst({ where: { email: data.ownerEmail } });
    if (existingAdmin) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email. Connectez-vous ou utilisez un autre email." },
        { status: 400 }
      );
    }

    // Hash the owner password
    const hashedPassword = await hashPassword(data.ownerPassword);

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // Create restaurant + admin + config in a transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Create restaurant
      const restaurant = await tx.restaurant.create({
        data: {
          name: data.restaurantName,
          slug,
          tagline: data.tagline || "",
          phone: data.phone,
          whatsapp: data.whatsapp || data.phone,
          email: data.email || "",
          address: data.address || "",
          hours: "Lun-Dim : 11h00 - 23h00",
          currency: data.currency,
          locale: data.locale,
          plan: data.plan,
          status: "trial",
          trialEndsAt,
          ownerEmail: data.ownerEmail,
          ownerName: data.ownerName,
          ownerPhone: data.ownerPhone || "",
        },
      });

      // 2. Create admin account for the owner
      const admin = await tx.admin.create({
        data: {
          email: data.ownerEmail,
          password: hashedPassword,
          name: data.ownerName,
          role: "admin",
          status: "active",
          restaurantId: restaurant.id,
        },
      });

      // 3. Create default restaurant config
      await tx.restaurantConfig.create({
        data: {
          restaurantId: restaurant.id,
          primaryColor: "#ea580c",
          accentColor: "#f97316",
          menuCategories: JSON.stringify([
            { id: "entrees", name: "Entrées" },
            { id: "plats", name: "Plats Principaux" },
            { id: "desserts", name: "Desserts" },
            { id: "boissons", name: "Boissons" },
          ]),
          features: JSON.stringify({
            delivery: true,
            reservations: true,
            reviews: true,
            loyalty: data.plan !== "free",
            pos: true,
            invoices: data.plan !== "free",
            quotes: data.plan === "pro" || data.plan === "enterprise",
            expenses: data.plan === "pro" || data.plan === "enterprise",
            staff: data.plan === "pro" || data.plan === "enterprise",
            drivers: data.plan === "pro" || data.plan === "enterprise",
          }),
          openingHours: JSON.stringify({
            open: 11,
            close: 23,
            timezone: "Africa/Conakry",
          }),
        },
      });

      return { restaurant, admin };
    });

    // Generate JWT token for the new admin
    const token = generateToken({
      id: result.admin.id,
      email: result.admin.email,
      role: result.admin.role,
      type: "admin",
      restaurantId: result.restaurant.id,
      restaurantSlug: result.restaurant.slug,
    });

    return NextResponse.json({
      success: true,
      restaurant: {
        id: result.restaurant.id,
        name: result.restaurant.name,
        slug: result.restaurant.slug,
        plan: result.restaurant.plan,
        status: result.restaurant.status,
        trialEndsAt: result.restaurant.trialEndsAt,
      },
      admin: {
        id: result.admin.id,
        email: result.admin.email,
        name: result.admin.name,
        role: result.admin.role,
      },
      token,
    }, { status: 201 });

  } catch (error) {
    console.error("Restaurant registration error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du restaurant. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
