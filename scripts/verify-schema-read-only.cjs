#!/usr/bin/env node
/**
 * verify-schema-read-only.cjs — production readiness verification
 *
 * Read-only verification that the database schema matches the minimum shape
 * required by the running application. This intentionally checks BOTH tables
 * and critical columns: historical migrations once produced a database where
 * `prisma migrate deploy` succeeded while Restaurant.plan and
 * Admin.restaurantId were still missing.
 *
 * Does NOT modify the database.
 * Exits with code 0 only when all required objects are present.
 */

const { PrismaClient } = require('@prisma/client');

const REQUIRED_TABLES = [
  'OrderItem',
  'IdempotencyKey',
  'PromotionRedemption',
  'WebhookEvent',
  'CustomerFavorite',
  'RefreshToken',
  'RevokedToken',
  'PaymentIdempotencyKey',
  // SaaS commercial billing ledger
  'PlatformSubscription',
  'PlatformInvoice',
  'PlatformPayment',
  'PlatformBillingNotice',
  // Pending self-service onboarding (must exist before public registration can run)
  'PublicRegistrationIntent',
  // Core tables
  'Account',
  'Restaurant',
  'Admin',
  'Customer',
  'MenuItem',
  'Order',
  'Payment',
  'PromoCode',
  'ChatMessage',
  'LoyaltyTier',
  'RestaurantTable',
];

const REQUIRED_COLUMNS = {
  Restaurant: [
    'plan', 'status', 'currency', 'locale',
    'ownerEmail', 'ownerName', 'ownerPhone',
    'accountId', 'deliveryRadiusKm', 'loyaltyPointsRate', 'lat', 'lng',
  ],
  Admin: [
    'restaurantId', 'accountId', 'mustChangePassword',
    'loginAttempts', 'lockedUntil', 'tokenVersion',
  ],
  Customer: [
    'restaurantId', 'tier', 'mustChangePassword',
    'loginAttempts', 'lockedUntil', 'tokenVersion',
  ],
  Driver: [
    'restaurantId', 'mustChangePassword', 'loginAttempts', 'lockedUntil',
    'commissionRate', 'totalEarnings',
  ],
  MenuItem: ['restaurantId', 'ingredientCost', 'stockItemId'],
  Order: [
    'restaurantId', 'customerId', 'driverId',
    'assignmentStatus', 'tip', 'platformCommission',
    'tableId', 'tableNumberStr',
  ],
  PromoCode: [
    'code', 'description', 'discountType', 'discountValue',
    'minOrderTotal', 'maxUses', 'usedCount', 'maxUsesPerUser',
    'active', 'startsAt', 'expiresAt', 'restaurantId',
  ],
  ChatMessage: [
    'restaurantId', 'senderId', 'senderName', 'senderRole', 'content', 'createdAt',
  ],
  LoyaltyTier: [
    'restaurantId', 'name', 'label', 'minSpent', 'discountPercent',
    'freeDelivery', 'freeDish', 'color', 'icon', 'active', 'createdAt', 'updatedAt',
  ],
  PlatformSubscription: [
    'accountId', 'plan', 'billingCycle', 'status', 'currency', 'unitAmount',
    'currentPeriodStart', 'currentPeriodEnd', 'nextBillingAt', 'provider',
  ],
  PlatformInvoice: [
    'accountId', 'subscriptionId', 'number', 'idempotencyKey', 'subtotal', 'tax', 'total',
    'amountPaid', 'status', 'dueAt', 'paidAt',
  ],
  PlatformPayment: [
    'accountId', 'invoiceId', 'amount', 'currency', 'method', 'provider',
    'status', 'providerPaymentRef', 'idempotencyKey', 'paidAt',
  ],
  PlatformBillingNotice: [
    'accountId', 'invoiceId', 'stage', 'channel', 'recipient', 'status',
    'provider', 'idempotencyKey', 'errorMessage', 'attemptedAt', 'sentAt',
  ],
  PublicRegistrationIntent: [
    'ownerEmail', 'tokenHash', 'payload', 'passwordHash', 'status', 'expiresAt',
  ],
};

async function postgresTableExists(db, table) {
  const result = await db.$queryRawUnsafe(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = $1
    )::boolean AS exists`,
    table
  );
  return Boolean(result[0]?.exists);
}

async function postgresColumnExists(db, table, column) {
  const result = await db.$queryRawUnsafe(
    `SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    )::boolean AS exists`,
    table,
    column
  );
  return Boolean(result[0]?.exists);
}

async function sqliteTableExists(db, table) {
  const result = await db.$queryRawUnsafe(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    table
  );
  return Array.isArray(result) && result.length > 0;
}

async function sqliteColumnExists(db, table, column) {
  // Table names come only from REQUIRED_COLUMNS above, never from user input.
  const rows = await db.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
  return Array.isArray(rows) && rows.some((row) => row.name === column);
}

async function verifyTenantLinks(db, isPostgres) {
  // These checks catch an unsafe partial migration where the column exists but
  // legacy rows were not assignable to a tenant. Empty tables are valid.
  const checks = [
    ['Admin', 'restaurantId'],
    ['Customer', 'restaurantId'],
  ];

  for (const [table, column] of checks) {
    const sql = isPostgres
      ? `SELECT COUNT(*)::int AS count FROM "${table}" WHERE "${column}" IS NULL`
      : `SELECT COUNT(*) AS count FROM "${table}" WHERE "${column}" IS NULL`;
    const rows = await db.$queryRawUnsafe(sql);
    const count = Number(rows[0]?.count || 0);
    if (count > 0) {
      console.error(`[verify-schema] UNSCOPED TENANT ROWS: ${table}.${column} has ${count} NULL value(s)`);
      process.exit(1);
    }
  }
}

async function main() {
  const db = new PrismaClient();
  try {
    const url = process.env.DATABASE_URL || '';
    const isPostgres = url.startsWith('postgresql://') || url.startsWith('postgres://');

    const tableExists = isPostgres ? postgresTableExists : sqliteTableExists;
    const columnExists = isPostgres ? postgresColumnExists : sqliteColumnExists;

    for (const table of REQUIRED_TABLES) {
      const exists = await tableExists(db, table);
      if (!exists) {
        console.error(`[verify-schema] MISSING TABLE: ${table}`);
        process.exit(1);
      }
      console.log(`[verify-schema] ✓ table ${table}`);
    }

    for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
      const tableIsPresent = await tableExists(db, table);
      if (!tableIsPresent) {
        console.error(`[verify-schema] MISSING TABLE FOR COLUMN CHECK: ${table}`);
        process.exit(1);
      }
      for (const column of columns) {
        const exists = await columnExists(db, table, column);
        if (!exists) {
          console.error(`[verify-schema] MISSING COLUMN: ${table}.${column}`);
          process.exit(1);
        }
        console.log(`[verify-schema] ✓ column ${table}.${column}`);
      }
    }

    await verifyTenantLinks(db, isPostgres);

    console.log('[verify-schema] ✓ All required tables, columns and tenant links are valid.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error('[verify-schema] Error:', err.message);
  process.exit(1);
});