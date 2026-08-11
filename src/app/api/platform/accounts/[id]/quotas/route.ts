import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { invalidateTenantCache } from '@/lib/tenant';
import { invalidateConfigCache } from '@/lib/constants';
import { getPlanQuotaDefaults } from '@/lib/commercial-plan-catalog';
import { z } from "zod";

const quotaSchema = z.object({
  maxRestaurants: z.number().int().min(1, "Le nombre maximum de restaurants doit être au moins 1").optional(),
  maxSecondaryRestaurants: z.number().int().min(0).optional(),
  maxAdmins: z.number().int().min(1, "Le nombre maximum d'administrateurs doit être au moins 1").optional(),
  maxUsers: z.number().int().min(1).optional(),
  maxOrdersPerMonth: z.number().int().min(1, "Le quota mensuel de commandes doit être au moins 1").optional(),
  plan: z.enum(["free", "starter", "pro", "enterprise", "custom"]).optional(),
  status: z.enum(["active", "trial", "suspended", "cancelled", "over_quota"]).optional(),
}).strict();

// PATCH — Update account quotas (platform admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { id } = await params;
    const validation = quotaSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const account = await db.account.findUnique({ where: { id } });
    if (!account) return NextResponse.json({ error: "Compte non trouvé" }, { status: 404 });

    const input = validation.data;
    const planChanged = Boolean(input.plan && input.plan !== account.plan);
    const planDefaults = planChanged && input.plan ? getPlanQuotaDefaults(input.plan) : null;

    const newMaxRestaurants = input.maxRestaurants
      ?? planDefaults?.maxRestaurants
      ?? account.maxRestaurants;
    const newMaxSecondary = input.maxSecondaryRestaurants
      ?? planDefaults?.maxSecondaryRestaurants
      ?? account.maxSecondaryRestaurants;
    const newMaxAdmins = input.maxAdmins
      ?? planDefaults?.maxAdmins
      ?? account.maxAdmins;
    const newMaxUsers = input.maxUsers
      ?? planDefaults?.maxUsers
      ?? account.maxUsers;

    if (newMaxSecondary > newMaxRestaurants - 1) {
      return NextResponse.json(
        { error: "Le nombre de restaurants secondaires ne peut pas dépasser maxRestaurants - 1." },
        { status: 400 }
      );
    }
    if (newMaxUsers < newMaxAdmins) {
      return NextResponse.json(
        { error: "Le nombre maximum d'utilisateurs doit être supérieur ou égal au nombre maximum d'administrateurs." },
        { status: 400 }
      );
    }

    const before = {
      maxRestaurants: account.maxRestaurants,
      maxSecondaryRestaurants: account.maxSecondaryRestaurants,
      maxAdmins: account.maxAdmins,
      maxUsers: account.maxUsers,
      maxOrdersPerMonth: account.maxOrdersPerMonth,
      plan: account.plan,
      status: account.status,
    };

    const restaurantCount = await db.restaurant.count({ where: { accountId: id } });
    let finalStatus = input.status;
    if (!finalStatus && newMaxRestaurants < restaurantCount) {
      finalStatus = "over_quota";
    } else if (!finalStatus && account.status === "over_quota" && newMaxRestaurants >= restaurantCount) {
      finalStatus = "active";
    }

    const updateData = {
      ...input,
      ...(planChanged ? {
        maxRestaurants: newMaxRestaurants,
        maxSecondaryRestaurants: newMaxSecondary,
        maxAdmins: newMaxAdmins,
        maxUsers: newMaxUsers,
      } : {}),
      ...(finalStatus && { status: finalStatus }),
    };

    const updated = await db.$transaction(async (tx) => {
      const updatedAccount = await tx.account.update({
        where: { id },
        data: updateData,
      });

      if (planChanged && input.plan) {
        // Account.plan remains authoritative. Keep Restaurant.plan synchronized
        // only as a denormalized compatibility shadow for legacy readers.
        await tx.restaurant.updateMany({
          where: { accountId: id },
          data: { plan: input.plan },
        });
      }

      return updatedAccount;
    });

    invalidateTenantCache();
    invalidateConfigCache();

    await logAudit({
      actorId: admin.id,
      actorType: "platform_admin",
      action: "quota_change",
      entityType: "Account",
      entityId: id,
      accountId: id,
      before,
      after: {
        ...updateData,
        ...(planChanged && input.plan ? { restaurantPlanShadowSynced: input.plan } : {}),
      },
      request,
    });

    if (finalStatus === "over_quota" && account.status !== "over_quota") {
      await logAudit({
        actorId: admin.id,
        actorType: "platform_admin",
        action: "account_over_quota",
        entityType: "Account",
        entityId: id,
        accountId: id,
        before: { status: account.status },
        after: { status: "over_quota", restaurantCount, newMax: newMaxRestaurants },
        request,
      });
    }

    return NextResponse.json(bigIntToNumber(updated));
  } catch (error) {
    console.error("[platform/quotas PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
