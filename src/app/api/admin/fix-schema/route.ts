import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";

/**
 * POST /api/admin/fix-schema — Drop and recreate tables with correct types
 *
 * This endpoint fixes the issue where the safety-net in db.ts created
 * tables with TEXT/INTEGER types instead of the Prisma-expected BIGINT.
 *
 * It drops the empty problematic tables and recreates them with the
 * correct types using raw SQL that matches the Prisma schema exactly.
 *
 * Admin only — destructive operation (but tables are empty so no data loss).
 */
export async function POST(request: Request) {
  try {
    await dbReady;

    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin"])) {
      return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
    }

    const results: Array<{ table: string; action: string; status: string }> = [];

    // ── Tables to fix (drop + recreate with correct types) ──
    // Only drop if empty — check row count first
    const tablesToFix = [
      {
        name: "PromoCode",
        createSQL: `CREATE TABLE "PromoCode" (
          "id" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "description" TEXT NOT NULL DEFAULT '',
          "discountType" TEXT NOT NULL DEFAULT 'percent',
          "discountValue" BIGINT NOT NULL DEFAULT 0,
          "minOrderTotal" BIGINT NOT NULL DEFAULT 0,
          "maxUses" INTEGER NOT NULL DEFAULT 0,
          "usedCount" INTEGER NOT NULL DEFAULT 0,
          "maxUsesPerUser" INTEGER NOT NULL DEFAULT 1,
          "active" BOOLEAN NOT NULL DEFAULT true,
          "startsAt" TIMESTAMP(3),
          "expiresAt" TIMESTAMP(3),
          "restaurantId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
        )`,
        indexes: [
          `CREATE UNIQUE INDEX "PromoCode_restaurantId_code_key" ON "PromoCode"("restaurantId", "code")`,
          `CREATE INDEX "PromoCode_restaurantId_active_idx" ON "PromoCode"("restaurantId", "active")`,
          `CREATE INDEX "PromoCode_code_idx" ON "PromoCode"("code")`,
        ],
      },
      {
        name: "ChatMessage",
        createSQL: `CREATE TABLE "ChatMessage" (
          "id" TEXT NOT NULL,
          "restaurantId" TEXT NOT NULL,
          "senderId" TEXT NOT NULL,
          "senderName" TEXT NOT NULL,
          "senderRole" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
        )`,
        indexes: [
          `CREATE INDEX "ChatMessage_restaurantId_createdAt_idx" ON "ChatMessage"("restaurantId", "createdAt")`,
          `CREATE INDEX "ChatMessage_restaurantId_idx" ON "ChatMessage"("restaurantId")`,
        ],
      },
      {
        name: "LoyaltyTier",
        createSQL: `CREATE TABLE "LoyaltyTier" (
          "id" TEXT NOT NULL,
          "restaurantId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "label" TEXT NOT NULL DEFAULT '',
          "minSpent" BIGINT NOT NULL DEFAULT 0,
          "discountPercent" INTEGER NOT NULL DEFAULT 0,
          "freeDelivery" BOOLEAN NOT NULL DEFAULT false,
          "freeDish" BOOLEAN NOT NULL DEFAULT false,
          "color" TEXT NOT NULL DEFAULT '#cd7f32',
          "icon" TEXT NOT NULL DEFAULT '',
          "active" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
        )`,
        indexes: [
          `CREATE UNIQUE INDEX "LoyaltyTier_restaurantId_name_key" ON "LoyaltyTier"("restaurantId", "name")`,
          `CREATE INDEX "LoyaltyTier_restaurantId_active_idx" ON "LoyaltyTier"("restaurantId", "active")`,
        ],
      },
    ];

    for (const table of tablesToFix) {
      try {
        // Check if table exists and get row count
        let count = 0;
        try {
          const result = await db.$queryRawUnsafe(
            `SELECT COUNT(*)::int as count FROM "${table.name}"`
          ) as Array<{ count: number }>;
          count = result[0]?.count ?? 0;
        } catch {
          // Table doesn't exist — skip drop, just create
          results.push({ table: table.name, action: "create (did not exist)", status: "ok" });
        }

        if (count > 0) {
          results.push({
            table: table.name,
            action: "skip",
            status: `has ${count} rows — NOT dropping (data would be lost)`,
          });
          continue;
        }

        // Drop the table (empty — safe)
        try {
          await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table.name}" CASCADE`);
        } catch {
          /* ignore */
        }

        // Recreate with correct types
        await db.$executeRawUnsafe(table.createSQL);

        // Create indexes
        for (const indexSQL of table.indexes) {
          try {
            await db.$executeRawUnsafe(indexSQL);
          } catch {
            /* index may already exist */
          }
        }

        results.push({ table: table.name, action: "drop + recreate", status: "ok" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ table: table.name, action: "error", status: msg });
      }
    }

    // Also fix Customer.tier column type if needed
    try {
      await db.$executeRawUnsafe(
        `ALTER TABLE "Customer" ALTER COLUMN "tier" SET DEFAULT 'bronze'`
      );
      results.push({ table: "Customer.tier", action: "ensure default", status: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ table: "Customer.tier", action: "error", status: msg });
    }

    // Fix Order.tip column type if needed (should be BIGINT on postgres)
    try {
      await db.$executeRawUnsafe(
        `ALTER TABLE "Order" ALTER COLUMN "tip" SET DEFAULT 0`
      );
      results.push({ table: "Order.tip", action: "ensure default", status: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ table: "Order.tip", action: "error", status: msg });
    }

    return NextResponse.json({
      ok: true,
      message: "Schema fix complete — tables recreated with correct types",
      results,
    });
  } catch (error) {
    console.error("[admin/fix-schema]", error);
    return NextResponse.json(
      { error: "Erreur serveur", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
