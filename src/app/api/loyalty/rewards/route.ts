import { db, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateCustomer, authenticateAdmin, hasRole } from "@/lib/auth";

// GET: List all active rewards (public, no auth needed)
export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const restaurantId = sp.get("restaurantId");

    const where: Record<string, unknown> = { active: true };
    if (restaurantId) where.restaurantId = restaurantId;

    const rewards = await db.loyaltyReward.findMany({
      where,
      orderBy: { pointsCost: "asc" },
    });

    // bigIntToNumber wraps BigInt fields (value) for JSON serialization.
    // On SQLite these are already number (no-op); on PostgreSQL they are
    // bigint and JSON.stringify would throw without this conversion.
    return NextResponse.json({ data: bigIntToNumber(rewards) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Redeem a reward (requires customer auth)
export async function POST(request: Request) {
  try {
    const customer = await authenticateCustomer(request);
    if (!customer) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { rewardId } = body;

    if (!rewardId) {
      return NextResponse.json({ error: "rewardId requis" }, { status: 400 });
    }

    // Get the reward
    const reward = await db.loyaltyReward.findUnique({ where: { id: rewardId } });
    if (!reward || !reward.active) {
      return NextResponse.json({ error: "Récompense introuvable ou inactive" }, { status: 404 });
    }

    // Check customer has enough points
    const customerData = await db.customer.findUnique({ where: { id: customer.id } });
    if (!customerData) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }
    if (customerData.loyaltyPoints < reward.pointsCost) {
      return NextResponse.json(
        { error: "Points insuffisants", currentPoints: customerData.loyaltyPoints, requiredPoints: reward.pointsCost },
        { status: 400 }
      );
    }

    // Deduct points and create history entry in a transaction
    const result = await db.$transaction(async (tx) => {
      // Deduct points from customer
      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: { decrement: reward.pointsCost } },
      });

      // Create history entry
      const historyEntry = await tx.loyaltyPointsHistory.create({
        data: {
          customerId: customer.id,
          points: -reward.pointsCost,
          type: "redeemed",
          description: `Échange: ${reward.name}`,
          referenceId: reward.id,
        },
      });

      return { updatedCustomer, historyEntry };
    });

    return NextResponse.json({
      success: true,
      message: `Récompense "${reward.name}" échangée avec succès !`,
      remainingPoints: result.updatedCustomer.loyaltyPoints,
      historyEntry: bigIntToNumber(result.historyEntry),
      reward: {
        id: reward.id,
        name: reward.name,
        category: reward.category,
        // Number() wraps BigInt (value field) for JSON serialization
        value: Number(reward.value),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
