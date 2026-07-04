import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin, hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateSlug, ensureUniqueSlug } from "@/lib/tenant";
import { z } from "zod";

const createMainRestaurantSchema = z.object({
  accountId: z.string().optional(),
  restaurantName: z.string().min(2, "Nom du restaurant requis"),
  slug: z.string().optional(),
  phone: z.string().default(""),
  email: z.string().default(""),
  address: z.string().default(""),
  currency: z.string().default("GNF"),
  plan: z.enum(["free", "starter", "pro", "enterprise"]).default("free"),
  // Admin credentials
  adminName: z.string().min(2, "Nom de l'admin requis"),
  adminEmail: z.string().email("Email admin invalide"),
  adminPassword: z.string().min(6, "Mot de passe requis (min 6)"),
});

// POST — Create a main restaurant + account + admin (platform admin only)
export async function POST(request: Request) {
  try {
    await dbReady;
    const platformAdmin = await authenticatePlatformAdmin(request);
    if (!platformAdmin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const validation = createMainRestaurantSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const data = validation.data;
    let accountId = data.accountId;

    // Create Account if not provided
    if (!accountId) {
      const account = await db.account.create({
        data: {
          name: data.restaurantName,
          ownerName: data.adminName,
          ownerEmail: data.adminEmail,
          plan: data.plan,
        },
      });
      accountId = account.id;
    }

    // Generate slug
    const baseSlug = data.slug || generateSlug(data.restaurantName);
    const slug = await ensureUniqueSlug(baseSlug);

    // Create restaurant
    const restaurant = await db.restaurant.create({
      data: {
        name: data.restaurantName,
        slug,
        phone: data.phone,
        email: data.email,
        address: data.address,
        currency: data.currency,
        plan: data.plan,
        accountId,
        type: "principal",
        createdByAdminId: platformAdmin.id,
      },
    });

    // Create default config
    await db.restaurantConfig.create({
      data: { restaurantId: restaurant.id },
    });

    // Create admin
    const hashedPassword = await hashPassword(data.adminPassword);
    const admin = await db.admin.create({
      data: {
        email: data.adminEmail,
        password: hashedPassword,
        name: data.adminName,
        role: "admin",
        restaurantId: restaurant.id,
        accountId,
        canCreateRestaurant: true,
      },
    });

    await logAudit({
      actorId: platformAdmin.id,
      actorType: "platform_admin",
      action: "restaurant_main_create",
      entityType: "Restaurant",
      entityId: restaurant.id,
      accountId,
      after: { restaurantName: data.restaurantName, slug, adminEmail: data.adminEmail },
      request,
    });

    return NextResponse.json(bigIntToNumber({
      restaurant,
      admin: { id: admin.id, email: admin.email, name: admin.name },
      accountId,
    }), { status: 201 });
  } catch (error) {
    console.error("[platform/restaurants/main POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
