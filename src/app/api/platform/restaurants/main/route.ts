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
    let accountMaxSecondary = 0;

    // Create Account if not provided, otherwise load existing
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
      accountMaxSecondary = account.maxSecondaryRestaurants;
    } else {
      // ── Mission 2: Prevent multiple principal restaurants per account ──
      const existingAccount = await db.account.findUnique({ where: { id: accountId } });
      if (!existingAccount) {
        return NextResponse.json({ error: "Compte non trouvé" }, { status: 404 });
      }
      accountMaxSecondary = existingAccount.maxSecondaryRestaurants;

      // Check if account already has a principal restaurant
      const existingPrincipal = await db.restaurant.findFirst({
        where: { accountId, type: "principal" },
        select: { id: true },
      });
      if (existingPrincipal) {
        return NextResponse.json(
          { error: "Ce compte possède déjà un restaurant principal." },
          { status: 400 }
        );
      }
    }

    // Generate slug
    const baseSlug = data.slug || generateSlug(data.restaurantName);
    const slug = await ensureUniqueSlug(baseSlug);

    // Create restaurant + config + admin in a transaction
    const result = await db.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
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

      await tx.restaurantConfig.create({ data: { restaurantId: restaurant.id } });

      // ── Mission 1: Set restaurantCreationLimit from account quotas ──
      const hashedPassword = await hashPassword(data.adminPassword);
      const admin = await tx.admin.create({
        data: {
          email: data.adminEmail,
          password: hashedPassword,
          name: data.adminName,
          role: "admin",
          restaurantId: restaurant.id,
          accountId,
          canCreateRestaurant: true,
          restaurantCreationLimit: accountMaxSecondary,
          restaurantsCreatedCount: 0,
        },
      });

      return { restaurant, admin };
    });

    await logAudit({
      actorId: platformAdmin.id,
      actorType: "platform_admin",
      action: "restaurant_main_create",
      entityType: "Restaurant",
      entityId: result.restaurant.id,
      accountId,
      after: { restaurantName: data.restaurantName, slug, adminEmail: data.adminEmail, restaurantCreationLimit: accountMaxSecondary },
      request,
    });

    return NextResponse.json(bigIntToNumber({
      restaurant: result.restaurant,
      admin: { id: result.admin.id, email: result.admin.email, name: result.admin.name },
      accountId,
    }), { status: 201 });
  } catch (error) {
    console.error("[platform/restaurants/main POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
