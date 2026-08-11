import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin, hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateSlug, ensureUniqueSlug } from "@/lib/tenant";
import { validatePassword } from "@/lib/password-policy";
import {
  getPlanQuotaDefaults,
  normalizeCommercialPlanValue,
  type CommercialPlan,
} from "@/lib/commercial-plan-catalog";
import { z } from "zod";

const createMainRestaurantSchema = z.object({
  accountId: z.string().optional(),
  restaurantName: z.string().min(2, "Nom du restaurant requis"),
  slug: z.string().optional(),
  phone: z.string().default(""),
  email: z.string().default(""),
  address: z.string().default(""),
  currency: z.string().default("GNF"),
  plan: z.enum(["free", "starter", "pro", "enterprise", "custom"]).optional(),
  adminName: z.string().min(2, "Nom de l'admin requis"),
  adminEmail: z.string().email("Email admin invalide"),
  adminPassword: z.string().min(6, "Mot de passe requis (min 6)"),
}).strict();

// POST — Create a main restaurant + account + admin (platform admin only)
export async function POST(request: Request) {
  try {
    await dbReady;
    const platformAdmin = await authenticatePlatformAdmin(request);
    if (!platformAdmin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const validation = createMainRestaurantSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const data = validation.data;
    const pwCheck = validatePassword(data.adminPassword);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.errors[0] }, { status: 400 });
    }

    const existingAccount = data.accountId
      ? await db.account.findUnique({
          where: { id: data.accountId },
          select: {
            id: true,
            plan: true,
            maxSecondaryRestaurants: true,
          },
        })
      : null;

    if (data.accountId && !existingAccount) {
      return NextResponse.json({ error: "Compte non trouvé" }, { status: 404 });
    }

    if (existingAccount && data.plan && data.plan !== existingAccount.plan) {
      return NextResponse.json(
        {
          error: "Le plan du restaurant doit suivre le plan du compte SaaS existant.",
          code: "ACCOUNT_PLAN_AUTHORITATIVE",
          accountId: existingAccount.id,
          effectivePlan: existingAccount.plan,
        },
        { status: 409 }
      );
    }

    if (existingAccount) {
      const existingPrincipal = await db.restaurant.findFirst({
        where: { accountId: existingAccount.id, type: "principal" },
        select: { id: true },
      });
      if (existingPrincipal) {
        return NextResponse.json(
          { error: "Ce compte possède déjà un restaurant principal." },
          { status: 400 }
        );
      }
    }

    const baseSlug = data.slug || generateSlug(data.restaurantName);
    const slug = await ensureUniqueSlug(baseSlug);
    const hashedPassword = await hashPassword(data.adminPassword);

    const requestedPlan: CommercialPlan = existingAccount
      ? normalizeCommercialPlanValue(existingAccount.plan) ?? "free"
      : data.plan ?? "free";
    const defaults = getPlanQuotaDefaults(requestedPlan);

    // Account creation and its first principal restaurant are one unit. If any
    // config/admin write fails, the new SaaS account is rolled back too.
    const result = await db.$transaction(async (tx) => {
      const account = existingAccount
        ? existingAccount
        : await tx.account.create({
            data: {
              name: data.restaurantName,
              ownerName: data.adminName,
              ownerEmail: data.adminEmail,
              plan: requestedPlan,
              maxRestaurants: defaults.maxRestaurants,
              maxSecondaryRestaurants: defaults.maxSecondaryRestaurants,
              maxAdmins: defaults.maxAdmins,
              maxUsers: defaults.maxUsers,
            },
            select: {
              id: true,
              plan: true,
              maxSecondaryRestaurants: true,
            },
          });

      const effectivePlan = normalizeCommercialPlanValue(account.plan) ?? "free";
      const restaurant = await tx.restaurant.create({
        data: {
          name: data.restaurantName,
          slug,
          phone: data.phone,
          email: data.email,
          address: data.address,
          currency: data.currency,
          // Account.plan is authoritative. Restaurant.plan remains a denormalized
          // compatibility shadow for older code paths and legacy exports.
          plan: effectivePlan,
          accountId: account.id,
          type: "principal",
          createdByAdminId: platformAdmin.id,
        },
      });

      await tx.restaurantConfig.create({ data: { restaurantId: restaurant.id } });

      const admin = await tx.admin.create({
        data: {
          email: data.adminEmail,
          password: hashedPassword,
          name: data.adminName,
          role: "admin",
          restaurantId: restaurant.id,
          accountId: account.id,
          canCreateRestaurant: true,
          restaurantCreationLimit: account.maxSecondaryRestaurants,
          restaurantsCreatedCount: 0,
          mustChangePassword: true,
        },
      });

      return { restaurant, admin, account };
    });

    await logAudit({
      actorId: platformAdmin.id,
      actorType: "platform_admin",
      action: "restaurant_main_create",
      entityType: "Restaurant",
      entityId: result.restaurant.id,
      accountId: result.account.id,
      after: {
        restaurantName: data.restaurantName,
        slug,
        plan: result.account.plan,
        adminEmail: data.adminEmail,
        restaurantCreationLimit: result.account.maxSecondaryRestaurants,
      },
      request,
    });

    return NextResponse.json(bigIntToNumber({
      restaurant: result.restaurant,
      admin: { id: result.admin.id, email: result.admin.email, name: result.admin.name },
      accountId: result.account.id,
      effectivePlan: result.account.plan,
    }), { status: 201 });
  } catch (error) {
    console.error("[platform/restaurants/main POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
