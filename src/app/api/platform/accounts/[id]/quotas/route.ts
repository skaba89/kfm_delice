import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const quotaSchema = z.object({
  maxRestaurants: z.number().min(0).optional(),
  maxSecondaryRestaurants: z.number().min(0).optional(),
  maxAdmins: z.number().min(0).optional(),
  maxUsers: z.number().min(0).optional(),
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

    const before = { maxRestaurants: account.maxRestaurants, maxSecondaryRestaurants: account.maxSecondaryRestaurants, plan: account.plan, status: account.status };

    // Check if new quota is below current usage
    const restaurantCount = await db.restaurant.count({ where: { accountId: id } });
    const newMax = validation.data.maxRestaurants ?? account.maxRestaurants;
    
    let finalStatus = validation.data.status;
    if (newMax < restaurantCount && !finalStatus) {
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
      after: validation.data,
      request,
    });

    return NextResponse.json(bigIntToNumber(updated));
  } catch (error) {
    console.error("[platform/quotas PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
