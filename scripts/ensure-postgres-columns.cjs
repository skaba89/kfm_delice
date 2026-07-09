/**
 * ensure-postgres-columns.cjs — Add missing columns directly via SQL
 *
 * This script is a SAFETY NET for production PostgreSQL deployments.
 * It runs AFTER `prisma migrate deploy` and `prisma db push` to ensure
 * critical columns exist, even when those tools fail due to:
 *   - Migration drift (DB modified by db push in the past)
 *   - Type conflicts (INTEGER vs BIGINT)
 *   - Failed migrations blocking subsequent ones
 *
 * The script is IDEMPOTENT (uses IF NOT EXISTS) and SAFE:
 *   - Only adds columns, never drops or modifies existing ones
 *   - Uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS
 *   - Exits gracefully if columns already exist
 *
 * Called from render-start.sh on PostgreSQL deployments.
 */

const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL || '';

// Only run on PostgreSQL
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
if (!isPostgres) {
  console.log('[ensure-columns] Not PostgreSQL, skipping.');
  process.exit(0);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error', 'warn'] });

/**
 * Columns that MUST exist for the application to work.
 * Each entry: [table, column, SQL type definition with default]
 *
 * These are the columns referenced in application code but that were
 * missing from the initial migration or that get lost during drift.
 */
const REQUIRED_COLUMNS = [
  // Admin missing columns (the init migration didn't have restaurantId
  // or mustChangePassword — without restaurantId, /api/login crashes)
  ['Admin', 'restaurantId', 'TEXT NOT NULL DEFAULT \'\''],
  ['Admin', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT false'],

  // Customer missing columns
  ['Customer', 'restaurantId', 'TEXT NOT NULL DEFAULT \'\''],
  ['Customer', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT false'],

  // Driver earnings (commit 7e63085)
  ['Driver', 'restaurantId', 'TEXT NOT NULL DEFAULT \'\''],
  ['Driver', 'commissionRate', 'DOUBLE PRECISION NOT NULL DEFAULT 10'],
  ['Driver', 'totalEarnings', 'BIGINT NOT NULL DEFAULT 0'],
  ['Driver', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT false'],

  // Order driver earning (commit 29b777f)
  ['Order', 'driverEarning', 'BIGINT NOT NULL DEFAULT 0'],

  // Password security fields
  ['Admin', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT false'],
  ['Customer', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT false'],
  ['Driver', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT false'],

  // Driver GPS tracking
  ['Driver', 'lat', 'DOUBLE PRECISION NOT NULL DEFAULT 0'],
  ['Driver', 'lng', 'DOUBLE PRECISION NOT NULL DEFAULT 0'],
  ['Driver', 'lastLocationUpdate', 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ['Driver', 'currentOrderId', 'TEXT NOT NULL DEFAULT \'\''],

  // Order fields
  ['Order', 'driverLat', 'DOUBLE PRECISION NOT NULL DEFAULT 0'],
  ['Order', 'driverLng', 'DOUBLE PRECISION NOT NULL DEFAULT 0'],
  ['Order', 'estimatedDeliveryTime', 'TEXT NOT NULL DEFAULT \'\''],
  ['Order', 'note', 'TEXT NOT NULL DEFAULT \'\''],
  ['Order', 'tax', 'BIGINT NOT NULL DEFAULT 0'],
  ['Order', 'discount', 'BIGINT NOT NULL DEFAULT 0'],
  ['Order', 'deliveryFee', 'BIGINT NOT NULL DEFAULT 0'],
  ['Order', 'tableNumber', 'INTEGER NOT NULL DEFAULT 0'],
  ['Order', 'deliveryAddress', 'TEXT NOT NULL DEFAULT \'\''],
  ['Order', 'paymentMethod', 'TEXT NOT NULL DEFAULT \'cash\''],
  ['Order', 'paymentStatus', 'TEXT NOT NULL DEFAULT \'pending\''],

  // Restaurant SaaS fields
  ['Restaurant', 'plan', 'TEXT NOT NULL DEFAULT \'free\''],
  ['Restaurant', 'status', 'TEXT NOT NULL DEFAULT \'active\''],
  ['Restaurant', 'trialEndsAt', 'TEXT NOT NULL DEFAULT \'\''],
  ['Restaurant', 'currency', 'TEXT NOT NULL DEFAULT \'GNF\''],
  ['Restaurant', 'locale', 'TEXT NOT NULL DEFAULT \'fr\''],
  ['Restaurant', 'ownerEmail', 'TEXT NOT NULL DEFAULT \'\''],
  ['Restaurant', 'ownerName', 'TEXT NOT NULL DEFAULT \'\''],
  ['Restaurant', 'ownerPhone', 'TEXT NOT NULL DEFAULT \'\''],

  // Customer fields
  ['Customer', 'loyaltyPoints', 'INTEGER NOT NULL DEFAULT 0'],
  ['Customer', 'totalOrders', 'INTEGER NOT NULL DEFAULT 0'],
  ['Customer', 'totalSpent', 'BIGINT NOT NULL DEFAULT 0'],
  ['Customer', 'address', 'TEXT NOT NULL DEFAULT \'\''],
  ['Customer', 'phone', 'TEXT NOT NULL DEFAULT \'\''],

  // MenuItem fields
  ['MenuItem', 'badge', 'TEXT NOT NULL DEFAULT \'\''],
  ['MenuItem', 'popular', 'BOOLEAN NOT NULL DEFAULT false'],
  ['MenuItem', 'available', 'BOOLEAN NOT NULL DEFAULT true'],

  // Payment fields
  ['Payment', 'transactionRef', 'TEXT NOT NULL DEFAULT \'\''],
  ['Payment', 'phone', 'TEXT NOT NULL DEFAULT \'\''],
  ['Payment', 'customerName', 'TEXT NOT NULL DEFAULT \'\''],
  ['Payment', 'metadata', 'TEXT NOT NULL DEFAULT \'{}\''],
  ['Payment', 'paidAt', 'TEXT NOT NULL DEFAULT \'\''],
  ['Payment', 'failedReason', 'TEXT NOT NULL DEFAULT \'\''],

  // 2FA TOTP for PlatformAdmin (migration 20260709000000)
  ['PlatformAdmin', 'twoFactorEnabled', 'BOOLEAN NOT NULL DEFAULT false'],
  ['PlatformAdmin', 'twoFactorSecret', 'TEXT'],
  ['PlatformAdmin', 'twoFactorBackupCodes', 'TEXT'],
];

/**
 * Tables that MUST exist for the application to work.
 * If missing, create them with minimal schema.
 */
const REQUIRED_TABLES = [
  {
    name: 'PlatformAdmin',
    sql: `CREATE TABLE IF NOT EXISTS "PlatformAdmin" (
      "id" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "password" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'super_admin',
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    name: 'RestaurantConfig',
    sql: `CREATE TABLE IF NOT EXISTS "RestaurantConfig" (
      "id" TEXT NOT NULL,
      "restaurantId" TEXT NOT NULL UNIQUE,
      "logo" TEXT NOT NULL DEFAULT '',
      "heroImage" TEXT NOT NULL DEFAULT '',
      "primaryColor" TEXT NOT NULL DEFAULT '#ea580c',
      "accentColor" TEXT NOT NULL DEFAULT '#f97316',
      "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
      "menuCategories" JSONB NOT NULL DEFAULT '[]',
      "features" JSONB NOT NULL DEFAULT '{}',
      "openingHours" JSONB NOT NULL DEFAULT '{}',
      "socialLinks" JSONB NOT NULL DEFAULT '{}',
      "customDomain" TEXT NOT NULL DEFAULT '',
      "metaTitle" TEXT NOT NULL DEFAULT '',
      "metaDescription" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "RestaurantConfig_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    name: 'PushSubscription',
    sql: `CREATE TABLE IF NOT EXISTS "PushSubscription" (
      "id" TEXT NOT NULL,
      "userKey" TEXT NOT NULL,
      "userType" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "restaurantId" TEXT NOT NULL DEFAULT '',
      "endpoint" TEXT NOT NULL UNIQUE,
      "p256dhKey" TEXT NOT NULL,
      "authKey" TEXT NOT NULL,
      "userAgent" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    name: 'StockItem',
    sql: `CREATE TABLE IF NOT EXISTS "StockItem" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "sku" TEXT NOT NULL DEFAULT '',
      "category" TEXT NOT NULL DEFAULT 'general',
      "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "unit" TEXT NOT NULL DEFAULT 'unité',
      "minThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "unitCost" INTEGER NOT NULL DEFAULT 0,
      "supplier" TEXT NOT NULL DEFAULT '',
      "lastRestocked" TEXT NOT NULL DEFAULT '',
      "notes" TEXT NOT NULL DEFAULT '',
      "restaurantId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    name: 'StockMovement',
    sql: `CREATE TABLE IF NOT EXISTS "StockMovement" (
      "id" TEXT NOT NULL,
      "stockItemId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "quantity" DOUBLE PRECISION NOT NULL,
      "reason" TEXT NOT NULL DEFAULT '',
      "actor" TEXT NOT NULL DEFAULT '',
      "restaurantId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    name: 'LoyaltyReward',
    sql: `CREATE TABLE IF NOT EXISTS "LoyaltyReward" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "pointsCost" INTEGER NOT NULL DEFAULT 0,
      "category" TEXT NOT NULL DEFAULT 'discount',
      "value" BIGINT NOT NULL DEFAULT 0,
      "menuItemId" TEXT,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "restaurantId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "LoyaltyReward_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    name: 'LoyaltyPointsHistory',
    sql: `CREATE TABLE IF NOT EXISTS "LoyaltyPointsHistory" (
      "id" TEXT NOT NULL,
      "customerId" TEXT NOT NULL,
      "points" INTEGER NOT NULL DEFAULT 0,
      "type" TEXT NOT NULL,
      "reason" TEXT NOT NULL DEFAULT '',
      "restaurantId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "LoyaltyPointsHistory_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    name: 'Account',
    sql: `CREATE TABLE IF NOT EXISTS "Account" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "ownerName" TEXT NOT NULL DEFAULT '',
      "ownerEmail" TEXT NOT NULL DEFAULT '',
      "ownerPhone" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'active',
      "plan" TEXT NOT NULL DEFAULT 'starter',
      "maxRestaurants" INTEGER NOT NULL DEFAULT 1,
      "maxSecondaryRestaurants" INTEGER NOT NULL DEFAULT 0,
      "maxAdmins" INTEGER NOT NULL DEFAULT 3,
      "maxUsers" INTEGER NOT NULL DEFAULT 10,
      "maxOrdersPerMonth" INTEGER NOT NULL DEFAULT 1000,
      "contractStartDate" TEXT NOT NULL DEFAULT '',
      "contractEndDate" TEXT NOT NULL DEFAULT '',
      "trialEndsAt" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    name: 'AuditLog',
    sql: `CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT NOT NULL,
      "actorId" TEXT NOT NULL,
      "actorType" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "accountId" TEXT,
      "restaurantId" TEXT,
      "before" JSONB,
      "after" JSONB,
      "ipAddress" TEXT NOT NULL DEFAULT '',
      "userAgent" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
    )`,
  },
];

async function main() {
  console.log('[ensure-columns] Starting PostgreSQL column/table safety check...');
  await prisma.$connect();

  let tablesCreated = 0;
  let columnsAdded = 0;
  let errors = 0;

  // ── 1. Ensure required tables exist ──────────────────────────
  for (const { name, sql } of REQUIRED_TABLES) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`[ensure-columns] ✓ Table ensured: ${name}`);
      tablesCreated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('already exists')) {
        // Table already exists — that's fine
      } else {
        console.warn(`[ensure-columns] ⚠ Table ${name}: ${msg}`);
        errors++;
      }
    }
  }

  // ── 2. Ensure required columns exist ─────────────────────────
  for (const [table, column, def] of REQUIRED_COLUMNS) {
    try {
      // PostgreSQL supports ADD COLUMN IF NOT EXISTS (since 9.6)
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${def}`
      );
      columnsAdded++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('already exists') || msg.includes('does not exist')) {
        // "already exists" = column already there (fine)
        // "does not exist" = table doesn't exist (will be created next run)
      } else {
        console.warn(`[ensure-columns] ⚠ ${table}.${column}: ${msg}`);
        errors++;
      }
    }
  }

  // ── 3. Create indexes if missing (best effort) ──────────────
  const INDEXES = [
    'CREATE INDEX IF NOT EXISTS "Driver_restaurantId_status_idx" ON "Driver"("restaurantId", "status")',
    'CREATE INDEX IF NOT EXISTS "MenuItem_restaurantId_category_idx" ON "MenuItem"("restaurantId", "category")',
    'CREATE INDEX IF NOT EXISTS "Order_restaurantId_status_idx" ON "Order"("restaurantId", "status")',
    'CREATE INDEX IF NOT EXISTS "StockItem_restaurantId_category_idx" ON "StockItem"("restaurantId", "category")',
    'CREATE INDEX IF NOT EXISTS "PushSubscription_userKey_idx" ON "PushSubscription"("userKey")',
  ];
  for (const sql of INDEXES) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      // Index creation is best-effort — don't fail
    }
  }

  console.log(`[ensure-columns] Done. Tables ensured: ${tablesCreated}, columns ensured: ${columnsAdded}, errors: ${errors}`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('[ensure-columns] FATAL:', e.message);
  prisma.$disconnect().finally(() => process.exit(1));
});
