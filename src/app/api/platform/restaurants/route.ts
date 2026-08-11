import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  getPlanMonthlyPriceGnf,
  normalizeCommercialPlanValue,
  resolveEffectiveCommercialPlan,
} from "@/lib/commercial-plan-catalog";
import { z } from "zod";

const BILLABLE_ACCOUNT_STATUSES = new Set(["active", "over_quota"]);

function catalogPlanPrice(planValue: string | null | undefined): number | null {
  const plan = normalizeCommercialPlanValue(planValue) ?? "free";
  return getPlanMonthlyPriceGnf(plan);
}

export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Accès plateforme requis" }, { status: 403 });
    }

    const [restaurants, accounts] = await Promise.all([
      db.restaurant.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          account: {
            select: {
              id: true,
              name: true,
              plan: true,
              status: true,
            },
          },
          config: { select: { primaryColor: true, logo: true } },
          _count: {
            select: {
              orders: true,
              customers: true,
              admins: true,
              menuItems: true,
            },
          },
        },
      }),
      db.account.findMany({
        select: { id: true, plan: true, status: true },
      }),
    ]);

    const data = restaurants.map((restaurant) => {
      const effectivePlan = resolveEffectiveCommercialPlan(restaurant.account?.plan, restaurant.plan);
      return {
        ...restaurant,
        storedPlan: restaurant.plan,
        // Existing platform clients already read `plan`; return the authoritative
        // effective plan there while retaining `storedPlan` for diagnostics.
        plan: effectivePlan,
        effectivePlan,
        planSource: restaurant.account ? "account" : "restaurant",
      };
    });

    const totalRestaurants = restaurants.length;
    const activeRestaurants = restaurants.filter((r) => r.status === "active").length;
    const trialRestaurants = restaurants.filter((r) => r.status === "trial").length;

    let estimatedMonthlyCatalogValue = 0;
    let unpricedCustomSubscriptions = 0;

    for (const account of accounts) {
      if (!BILLABLE_ACCOUNT_STATUSES.has(account.status)) continue;
      const price = catalogPlanPrice(account.plan);
      if (price === null) unpricedCustomSubscriptions += 1;
      else estimatedMonthlyCatalogValue += price;
    }

    const legacyStandaloneRestaurants = restaurants.filter((restaurant) => !restaurant.accountId);
    for (const restaurant of legacyStandaloneRestaurants) {
      if (restaurant.status !== "active") continue;
      const price = catalogPlanPrice(restaurant.plan);
      if (price === null) unpricedCustomSubscriptions += 1;
      else estimatedMonthlyCatalogValue += price;
    }

    return NextResponse.json({
      data: bigIntToNumber(data),
      stats: {
        totalRestaurants,
        activeRestaurants,
        trialRestaurants,
        totalRevenue: estimatedMonthlyCatalogValue,
        estimatedMonthlyCatalogValue,
        unpricedCustomSubscriptions,
        legacyStandaloneRestaurants: legacyStandaloneRestaurants.length,
      },
    });
  } catch (error) {
    console.error("[platform/restaurants GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

const platformPatchSchema = z.object({
  id: z.string().min(1, "ID requis"),
  status: z.enum(["active", "trial", "suspended", "cancelled"]).optional(),
  plan: z.enum(["free", "starter", "pro", "enterprise"]).optional(),
}).strict().refine((value) => Boolean(value.status || value.plan), {
  message: "Statut ou plan requis",
});

export async function PATCH(request: Request) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Accès plateforme requis" }, { status: 403 });
    }

    const validation = platformPatchSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        {
          error: validation.error.issues[0]?.message || "Données invalides",
          code: "PLATFORM_RESTAURANT_VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const { id, status, plan } = validation.data;
    const existing = await db.restaurant.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        status: true,
        plan: true,
        accountId: true,
        account: { select: { plan: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
    }

    if (plan && existing.accountId) {
      return NextResponse.json(
        {
          error: "Le plan de ce restaurant est piloté par son compte SaaS. Modifiez le plan depuis l’onglet Comptes.",
          code: "ACCOUNT_PLAN_AUTHORITATIVE",
          accountId: existing.accountId,
          effectivePlan: resolveEffectiveCommercialPlan(existing.account?.plan, existing.plan),
        },
        { status: 409 }
      );
    }

    const updateData: { status?: string; plan?: string } = {};
    if (status) updateData.status = status;
    if (plan) updateData.plan = plan;

    const restaurant = await db.restaurant.update({
      where: { id },
      data: updateData,
    });

    const { invalidateConfigCache } = await import("@/lib/constants");
    const { invalidateTenantCache } = await import("@/lib/tenant");
    invalidateConfigCache(restaurant.slug);
    invalidateTenantCache(restaurant.slug);

    await logAudit({
      actorId: admin.id,
      actorType: "platform_admin",
      action: "platform_restaurant_update",
      entityType: "Restaurant",
      entityId: id,
      accountId: existing.accountId,
      before: { status: existing.status, plan: existing.plan },
      after: updateData,
      request,
    });

    const effectivePlan = resolveEffectiveCommercialPlan(existing.account?.plan, restaurant.plan);
    return NextResponse.json(bigIntToNumber({
      ...restaurant,
      storedPlan: restaurant.plan,
      plan: effectivePlan,
      effectivePlan,
      planSource: existing.accountId ? "account" : "restaurant",
    }));
  } catch (error) {
    console.error("[platform/restaurants PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
