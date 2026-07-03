import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { z } from "zod";

const loyaltyRewardUpdateSchema = z.object({
  name: z.string().min(1, 'Nom requis').optional(),
  description: z.string().optional(),
  pointsCost: z.number().min(1, 'Coût en points requis (min 1)').optional(),
  category: z.enum(['discount', 'free_item', 'delivery', 'special']).optional(),
  value: z.number().min(0).optional(),
  menuItemId: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

// PATCH: Update a reward (admin/manager only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const raw = await request.json();
    const validation = loyaltyRewardUpdateSchema.safeParse(raw);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    // ── Multi-tenant isolation ──────────────────────────────────
    // Verify the reward belongs to the admin's restaurant BEFORE updating.
    const existingReward = await db.loyaltyReward.findFirst({
      where: { id, restaurantId: admin.restaurantId },
      select: { id: true },
    });
    if (!existingReward) {
      return NextResponse.json({ error: "Récompense introuvable" }, { status: 404 });
    }

    const reward = await db.loyaltyReward.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json(reward);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE: Delete a reward (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    // ── Multi-tenant isolation ──────────────────────────────────
    const existingReward = await db.loyaltyReward.findFirst({
      where: { id, restaurantId: admin.restaurantId },
      select: { id: true },
    });
    if (!existingReward) {
      return NextResponse.json({ error: "Récompense introuvable" }, { status: 404 });
    }

    await db.loyaltyReward.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Récompense supprimée" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
