import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const quotaSchema = z.object({
  maxRestaurants: z.number().int().min(1, "Le nombre maximum de restaurants doit être au moins 1").optional(),
  maxSecondaryRestaurants: z.number().int().min(0).optional(),
  maxAdmins: z.number().int().min(1, "Le nombre maximum d'administrateurs doit être au moins 1").optional(),
  maxUsers: z.number().int().min(1).optional(),
  plan: z.enum(["free", "starter", "pro", "enterprise", "custom"]).optional(),
  status: z.enum(["active", "trial", "suspended", "cancelled", "over_quota"]).optional(),
});

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
    const body = await request.json();
    const validation = quotaSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const account = await db.account.findUnique({ where: { id } });
    if (!account) return NextResponse.json({ error: "Compte non trouvé" }, { status: 404 });

    // ── Mission 6: Quota coherence validation ──
    const newMaxRestaurants = validation.data.maxRestaurants ?? account.maxRestaurants;
    const newMaxSecondary = validation.data.maxSecondaryRestaurants ?? account.maxSecondaryRestaurants;
    const newMaxAdmins = validation.data.maxAdmins ?? account.maxAdmins;
    const newMaxUsers = validation.data.maxUsers ?? account.maxUsers;

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
      plan: account.plan,
      status: account.status,
    };

    // Check if new quota is below current usage → over_quota
    const restaurantCount = await db.restaurant.count({ where: { accountId: id } });
    let finalStatus = validation.data.status;
    if (newMaxRestaurants < restaurantCount && !finalStatus) {
      finalStatus = "over_quota";
    }

    const updated = await db.account.update({
      where: { id },
      data: { ...validation.data, ...(finalStatus && { status: finalStatus }) },
    });

    await logAudit({
      actorId: admin.id,
      actorType: "platform_admin",
      action: "quota_change",
      entityType: "Account",
      entityId: id,
      accountId: id,
      before,
      after: { ...validation.data, ...(finalStatus && { status: finalStatus }) },
      request,
    });

    // Audit: over_quota transition
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
