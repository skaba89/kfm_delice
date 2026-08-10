#!/usr/bin/env node
/**
 * verify-schema-read-only.cjs — Mission 5
 *
 * Read-only verification that the database schema matches what the app expects.
 * Does NOT modify the database — only queries information_schema / sqlite_master.
 *
 * Exits with code 0 if all expected tables + critical columns exist, 1 otherwise.
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
  'Account',
  'Restaurant',
  'Admin',
  'Customer',
  'MenuItem',
  'Order',
  'Payment',
  'PromoCode',
  'RestaurantTable',
];

const REQUIRED_COLUMNS = {
  Restaurant: ['id', 'slug', 'plan', 'status', 'currency', 'locale', 'accountId'],
  Admin: ['id', 'email', 'restaurantId', 'tokenVersion', 'mustChangePassword'],
  Customer: ['id', 'email', 'restaurantId', 'tokenVersion', 'tier'],
  Order: ['id', 'restaurantId', 'customerId', 'status', 'paymentStatus', 'tip', 'tableId'],
  Driver: ['id', 'restaurantId', 'mustChangePassword', 'commissionRate', 'totalEarnings'],
  MenuItem: ['id', 'restaurantId', 'price', 'ingredientCost', 'stockItemId'],
};

async function main() {
  const db = new PrismaClient();
  try {
    const url = process.env.DATABASE_URL || '';
    const isPostgres = url.startsWith('postgresql://') || url.startsWith('postgres://');

    if (isPostgres) {
      for (const table of REQUIRED_TABLES) {
        const result = await db.$queryRawUnsafe(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
          )::boolean`,
          table
        );
        const exists = result[0]?.exists;
        if (!exists) {
          console.error(`[verify-schema] MISSING TABLE: ${table}`);
          process.exit(1);
        }
        console.log(`[verify-schema] ✓ table ${table}`);
      }

      for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
        for (const column of columns) {
          const result = await db.$queryRawUnsafe(
            `SELECT EXISTS (
              SELECT FROM information_schema.columns
              WHERE table_schema = 'public'
              AND table_name = $1
              AND column_name = $2
            )::boolean`,
            table,
            column
          );
          const exists = result[0]?.exists;
          if (!exists) {
            console.error(`[verify-schema] MISSING COLUMN: ${table}.${column}`);
            process.exit(1);
          }
        }
        console.log(`[verify-schema] ✓ critical columns ${table}`);
      }
    } else {
      for (const table of REQUIRED_TABLES) {
        const result = await db.$queryRawUnsafe(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
          table
        );
        if (!result || result.length === 0) {
          console.error(`[verify-schema] MISSING TABLE: ${table}`);
          process.exit(1);
        }
        console.log(`[verify-schema] ✓ table ${table}`);
      }

      for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
        const pragma = await db.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
        const available = new Set((pragma || []).map((row) => row.name));
        for (const column of columns) {
          if (!available.has(column)) {
            console.error(`[verify-schema] MISSING COLUMN: ${table}.${column}`);
            process.exit(1);
          }
        }
        console.log(`[verify-schema] ✓ critical columns ${table}`);
      }
    }

    console.log('[verify-schema] ✓ All required tables and critical columns exist.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error('[verify-schema] Error:', err.message);
  process.exit(1);
});
