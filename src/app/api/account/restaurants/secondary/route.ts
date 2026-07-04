import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateSlug, ensureUniqueSlug } from "@/lib/tenant";
import { z } from "zod";

const createSecondarySchema = z.object({
  name: z.string().min(2, "Nom du restaurant requis"),
  slug: z.string().optional(),
  phone: z.string().default(""),
  email: z.string().default(""),
  address: z.string().default(""),
  currency: z.string().default("GNF"),
  // Optional: create an admin for this secondary restaurant
  adminName: z.string().optional(),
  adminEmail: z.string().email().optional(),
  adminPassword: z.string().min(6).optional(),
});

// POST — Create a secondary restaurant (account admin with canCreateRestaurant)
export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // ── Validate all conditions ──
    if (!admin.accountId) {
      return NextResponse.json({ error: "Aucun compte associé à cet administrateur." }, { status: 403 });
    }
    if (!admin.canCreateRestaurant) {
      return NextResponse.json({ error: "Vous n'êtes pas autorisé à créer un restaurant secondaire." }, { status: 403 });
    }

    const account = await db.account.findUnique({ where: { id: admin.accountId } });
    if (!account) {
      return NextResponse.json({ error: "Compte non trouvé." }, { status: 404 });
    }

    if (account.status === "suspended" || account.status === "cancelled") {
      return NextResponse.json({ error: "Votre compte est suspendu. Contactez le support." }, { status: 403 });
    }
    if (account.status === "over_quota") {
      return NextResponse.json({ error: "Quota de restaurants atteint. Contactez KFM Delice pour augmenter votre limite." }, { status: 403 });
    }

    // Count current restaurants
    const restaurants = await db.restaurant.findMany({
      where: { accountId: admin.accountId },
      select: { type: true },
    });
    const totalRestaurants = restaurants.length;
    const secondaryRestaurants = restaurants.filter(r => r.type === "secondary").length;

    if (totalRestaurants >= account.maxRestaurants) {
      return NextResponse.json({ error: "Quota de restaurants atteint. Contactez KFM Delice pour augmenter votre limite." }, { status: 403 });
    }
    if (secondaryRestaurants >= account.maxSecondaryRestaurants) {
      return NextResponse.json({ error: "Quota de restaurants secondaires atteint." }, { status: 403 });
    }
    if ((admin.restaurantsCreatedCount ?? 0) >= (admin.restaurantCreationLimit ?? 0)) {
      return NextResponse.json({ error: "Votre limite de création de restaurants est atteinte." }, { status: 403 });
    }

    // Check that a principal restaurant exists
    const principal = restaurants.find(r => r.type === "principal");
    if (!principal) {
      return NextResponse.json({ error: "Aucun restaurant principal trouvé pour ce compte." }, { status: 400 });
    }

    // Find the principal restaurant ID
    const principalRestaurant = await db.restaurant.findFirst({
      where: { accountId: admin.accountId, type: "principal" },
      select: { id: true },
    });
    if (!principalRestaurant) {
      return NextResponse.json({ error: "Aucun restaurant principal trouvé pour ce compte." }, { status: 400 });
    }

    const body = await request.json();
    const validation = createSecondarySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const data = validation.data;
    const baseSlug = data.slug || generateSlug(data.name);
    const slug = await ensureUniqueSlug(baseSlug);

    // Create secondary restaurant
    const restaurant = await db.restaurant.create({
      data: {
        name: data.name,
        slug,
        phone: data.phone,
        email: data.email,
        address: data.address,
        currency: data.currency,
        plan: account.plan,
        accountId: admin.accountId,
        parentRestaurantId: principalRestaurant.id,
        type: "secondary",
        createdByAdminId: admin.id,
      },
    });

    // Create default config
    await db.restaurantConfig.create({ data: { restaurantId: restaurant.id } });

    // Create admin for secondary restaurant if provided
    if (data.adminEmail && data.adminPassword && data.adminName) {
      const hashedPassword = await hashPassword(data.adminPassword);
      await db.admin.create({
        data: {
          email: data.adminEmail,
          password: hashedPassword,
          name: data.adminName,
          role: "admin",
          restaurantId: restaurant.id,
          accountId: admin.accountId,
        },
      });
    }

    // Increment admin's restaurantsCreatedCount
    await db.admin.update({
      where: { id: admin.id },
      data: { restaurantsCreatedCount: { increment: 1 } },
    });

    await logAudit({
      actorId: admin.id,
      actorType: "admin",
      action: "restaurant_secondary_create",
      entityType: "Restaurant",
      entityId: restaurant.id,
      accountId: admin.accountId,
      restaurantId: restaurant.id,
      after: { name: data.name, slug, type: "secondary" },
      request,
    });

    return NextResponse.json(bigIntToNumber(restaurant), { status: 201 });
  } catch (error) {
    console.error("[account/restaurants/secondary POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
