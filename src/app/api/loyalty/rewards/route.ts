import { db, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateCustomer } from "@/lib/auth";
import { resolveTenantFromRequest } from "@/lib/tenant";
import { commercialFeatureGate } from "@/lib/commercial-feature-gate";

// GET: List active rewards for the resolved restaurant only.
// Client-supplied restaurantId query parameters are intentionally ignored:
// tenant identity comes from the trusted slug/header/path resolver.
export async function GET(request: Request) {
  try {
    const tenant = await resolveTenantFromRequest(request);
    if (!tenant) {
      return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
    }
    const featureGate = await commercialFeatureGate(tenant.restaurantId, 'loyalty');
    if (featureGate) return featureGate;

    const rewards = await db.loyaltyReward.findMany({
      where: { active: true, restaurantId: tenant.restaurantId },
      orderBy: { pointsCost: "asc" },
    });

    return NextResponse.json({ data: bigIntToNumber(rewards) });
  } catch (error) {
    console.error("[loyalty/rewards:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Redeem a reward for the authenticated customer's restaurant.
export async function POST(request: Request) {
  try {
    const customer = await authenticateCustomer(request);
    if (!customer) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    const featureGate = await commercialFeatureGate(customer.restaurantId, 'loyalty');
    if (featureGate) return featureGate;

    const body = await request.json();
    const rewardId = typeof body?.rewardId === "string" ? body.rewardId.trim() : "";
    if (!rewardId) {
      return NextResponse.json({ error: "rewardId requis" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const reward = await tx.loyaltyReward.findFirst({
        where: {
          id: rewardId,
          restaurantId: customer.restaurantId,
          active: true,
        },
      });

      if (!reward) {
        return { kind: "not_found" as const };
      }

      // Compare-and-decrement in one SQL update. Two concurrent redemption
      // requests cannot both spend the same points: once the first update
      // commits, the second no longer satisfies loyaltyPoints >= pointsCost.
      const spent = await tx.customer.updateMany({
        where: {
          id: customer.id,
          restaurantId: customer.restaurantId,
          status: "active",
          loyaltyPoints: { gte: reward.pointsCost },
        },
        data: { loyaltyPoints: { decrement: reward.pointsCost } },
      });

      if (spent.count !== 1) {
        const current = await tx.customer.findFirst({
          where: { id: customer.id, restaurantId: customer.restaurantId },
          select: { loyaltyPoints: true },
        });
        return {
          kind: "insufficient" as const,
          currentPoints: current?.loyaltyPoints ?? 0,
          requiredPoints: reward.pointsCost,
        };
      }

      const historyEntry = await tx.loyaltyPointsHistory.create({
        data: {
          customerId: customer.id,
          points: -reward.pointsCost,
          type: "redeemed",
          description: `Échange: ${reward.name}`,
          referenceId: reward.id,
        },
      });

      const updatedCustomer = await tx.customer.findFirst({
        where: { id: customer.id, restaurantId: customer.restaurantId },
        select: { loyaltyPoints: true },
      });
      if (!updatedCustomer) {
        throw new Error("Customer disappeared during loyalty redemption");
      }

      return {
        kind: "success" as const,
        reward,
        historyEntry,
        remainingPoints: updatedCustomer.loyaltyPoints,
      };
    });

    if (result.kind === "not_found") {
      return NextResponse.json({ error: "Récompense introuvable ou inactive" }, { status: 404 });
    }
    if (result.kind === "insufficient") {
      return NextResponse.json(
        {
          error: "Points insuffisants",
          currentPoints: result.currentPoints,
          requiredPoints: result.requiredPoints,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Récompense "${result.reward.name}" échangée avec succès !`,
      remainingPoints: result.remainingPoints,
      historyEntry: bigIntToNumber(result.historyEntry),
      reward: {
        id: result.reward.id,
        name: result.reward.name,
        category: result.reward.category,
        value: Number(result.reward.value),
      },
    });
  } catch (error) {
    console.error("[loyalty/rewards:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
