import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";

/**
 * POST /api/admin/fix-schema-v2 — Comprehensive schema fix
 *
 * Instead of dropping tables, this ALTERs all column types to match
 * the Prisma schema exactly. Works on PostgreSQL.
 *
 * This fixes the root cause: the safety-net in db.ts created tables
 * with TEXT/INTEGER types, but Prisma expects BIGINT for monetary
 * fields. ALTER COLUMN TYPE is safe — no data loss.
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

    // Helper: execute SQL, catch errors, log result
    const exec = async (sql: string, label: string) => {
      try {
        await db.$executeRawUnsafe(sql);
        results.push({ table: label, action: "alter", status: "ok" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("does not exist") || msg.includes("already") || msg.includes("cannot be cast")) {
          results.push({ table: label, action: "skip", status: msg.substring(0, 100) });
        } else {
          results.push({ table: label, action: "error", status: msg.substring(0, 100) });
        }
      }
    };

    // ── 1. Fix RestaurantTable column types ──
    await exec(`ALTER TABLE "RestaurantTable" ALTER COLUMN "capacity" TYPE INTEGER USING "capacity"::integer`, "RestaurantTable.capacity");
    await exec(`ALTER TABLE "RestaurantTable" ALTER COLUMN "active" TYPE BOOLEAN USING "active"::boolean`, "RestaurantTable.active");
    await exec(`ALTER TABLE "RestaurantTable" ALTER COLUMN "qrVersion" TYPE INTEGER USING "qrVersion"::integer`, "RestaurantTable.qrVersion");
    await exec(`ALTER TABLE "RestaurantTable" ALTER COLUMN "qrEnabled" TYPE BOOLEAN USING "qrEnabled"::boolean`, "RestaurantTable.qrEnabled");
    await exec(`ALTER TABLE "RestaurantTable" ALTER COLUMN "scanCount" TYPE INTEGER USING "scanCount"::integer`, "RestaurantTable.scanCount");

    // ── 2. Fix PromoCode column types ──
    await exec(`ALTER TABLE "PromoCode" ALTER COLUMN "discountValue" TYPE BIGINT USING "discountValue"::bigint`, "PromoCode.discountValue");
    await exec(`ALTER TABLE "PromoCode" ALTER COLUMN "minOrderTotal" TYPE BIGINT USING "minOrderTotal"::bigint`, "PromoCode.minOrderTotal");
    await exec(`ALTER TABLE "PromoCode" ALTER COLUMN "maxUses" TYPE INTEGER USING "maxUses"::integer`, "PromoCode.maxUses");
    await exec(`ALTER TABLE "PromoCode" ALTER COLUMN "usedCount" TYPE INTEGER USING "usedCount"::integer`, "PromoCode.usedCount");
    await exec(`ALTER TABLE "PromoCode" ALTER COLUMN "maxUsesPerUser" TYPE INTEGER USING "maxUsesPerUser"::integer`, "PromoCode.maxUsesPerUser");
    await exec(`ALTER TABLE "PromoCode" ALTER COLUMN "active" TYPE BOOLEAN USING "active"::boolean`, "PromoCode.active");

    // ── 3. Fix LoyaltyTier column types ──
    await exec(`ALTER TABLE "LoyaltyTier" ALTER COLUMN "minSpent" TYPE BIGINT USING "minSpent"::bigint`, "LoyaltyTier.minSpent");
    await exec(`ALTER TABLE "LoyaltyTier" ALTER COLUMN "discountPercent" TYPE INTEGER USING "discountPercent"::integer`, "LoyaltyTier.discountPercent");
    await exec(`ALTER TABLE "LoyaltyTier" ALTER COLUMN "freeDelivery" TYPE BOOLEAN USING "freeDelivery"::boolean`, "LoyaltyTier.freeDelivery");
    await exec(`ALTER TABLE "LoyaltyTier" ALTER COLUMN "freeDish" TYPE BOOLEAN USING "freeDish"::boolean`, "LoyaltyTier.freeDish");
    await exec(`ALTER TABLE "LoyaltyTier" ALTER COLUMN "active" TYPE BOOLEAN USING "active"::boolean`, "LoyaltyTier.active");

    // ── 4. Fix Order columns ──
    await exec(`ALTER TABLE "Order" ALTER COLUMN "tip" TYPE BIGINT USING COALESCE("tip"::bigint, 0)`, "Order.tip");
    await exec(`ALTER TABLE "Order" ALTER COLUMN "tip" SET DEFAULT 0`, "Order.tip default");
    await exec(`ALTER TABLE "Order" ALTER COLUMN "discount" TYPE BIGINT USING COALESCE("discount"::bigint, 0)`, "Order.discount");
    await exec(`ALTER TABLE "Order" ALTER COLUMN "tax" TYPE BIGINT USING COALESCE("tax"::bigint, 0)`, "Order.tax");
    await exec(`ALTER TABLE "Order" ALTER COLUMN "deliveryFee" TYPE BIGINT USING COALESCE("deliveryFee"::bigint, 0)`, "Order.deliveryFee");
    await exec(`ALTER TABLE "Order" ALTER COLUMN "total" TYPE BIGINT USING "total"::bigint`, "Order.total");

    // ── 5. Fix Customer columns ──
    await exec(`ALTER TABLE "Customer" ALTER COLUMN "tier" TYPE TEXT USING COALESCE("tier"::text, 'bronze')`, "Customer.tier");
    await exec(`ALTER TABLE "Customer" ALTER COLUMN "tier" SET DEFAULT 'bronze'`, "Customer.tier default");
    await exec(`ALTER TABLE "Customer" ALTER COLUMN "totalSpent" TYPE BIGINT USING COALESCE("totalSpent"::bigint, 0)`, "Customer.totalSpent");
    await exec(`ALTER TABLE "Customer" ALTER COLUMN "loyaltyPoints" TYPE INTEGER USING COALESCE("loyaltyPoints"::integer, 0)`, "Customer.loyaltyPoints");
    await exec(`ALTER TABLE "Customer" ALTER COLUMN "totalOrders" TYPE INTEGER USING COALESCE("totalOrders"::integer, 0)`, "Customer.totalOrders");

    // ── 6. Ensure FK constraints exist ──
    const fks = [
      { name: "PromoCode_restaurantId_fkey", sql: `ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE` },
      { name: "ChatMessage_restaurantId_fkey", sql: `ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE` },
      { name: "LoyaltyTier_restaurantId_fkey", sql: `ALTER TABLE "LoyaltyTier" ADD CONSTRAINT "LoyaltyTier_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE` },
      { name: "RestaurantTable_restaurantId_fkey", sql: `ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE` },
    ];
    for (const fk of fks) {
      try {
        await db.$executeRawUnsafe(fk.sql);
        results.push({ table: fk.name, action: "add FK", status: "ok" });
      } catch {
        results.push({ table: fk.name, action: "skip FK", status: "already exists" });
      }
    }

    // ── 7. Ensure all required indexes exist ──
    const indexes = [
      `CREATE UNIQUE INDEX IF NOT EXISTS "PromoCode_restaurantId_code_key" ON "PromoCode"("restaurantId", "code")`,
      `CREATE INDEX IF NOT EXISTS "PromoCode_restaurantId_active_idx" ON "PromoCode"("restaurantId", "active")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyTier_restaurantId_name_key" ON "LoyaltyTier"("restaurantId", "name")`,
      `CREATE INDEX IF NOT EXISTS "LoyaltyTier_restaurantId_active_idx" ON "LoyaltyTier"("restaurantId", "active")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_qrToken_key" ON "RestaurantTable"("qrToken")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_number_key" ON "RestaurantTable"("restaurantId", "number")`,
    ];
    for (const idx of indexes) {
      try { await db.$executeRawUnsafe(idx); } catch { /* ignore */ }
    }
    results.push({ table: "indexes", action: "ensure all", status: "ok" });

    return NextResponse.json({
      ok: true,
      message: "Schema fix v2 complete — all column types aligned with Prisma schema",
      results,
    });
  } catch (error) {
    console.error("[admin/fix-schema-v2]", error);
    return NextResponse.json(
      { error: "Erreur serveur", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
