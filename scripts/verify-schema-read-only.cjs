#!/usr/bin/env node
/**
 * verify-schema-read-only.cjs — Mission 5
 *
 * Read-only verification that the database schema matches what the app expects.
 * Does NOT modify the database — only queries information_schema / sqlite_master.
 *
 * Exits with code 0 if all expected tables exist, 1 otherwise.
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
  // Core tables
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

async function main() {
  const db = new PrismaClient();
  try {
    const url = process.env.DATABASE_URL || '';
    const isPostgres = url.startsWith('postgresql://') || url.startsWith('postgres://');

    if (isPostgres) {
      // Query information_schema
      for (const table of REQUIRED_TABLES) {
        const result = await db.$queryRawUnsafe(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
          )::boolean`,
          // Prisma creates quoted CamelCase table names in PostgreSQL.
          // information_schema.table_name is therefore case-sensitive here.
          table
        );
        const exists = result[0]?.exists;
        if (!exists) {
          console.error(`[verify-schema] MISSING TABLE: ${table}`);
          process.exit(1);
        }
        console.log(`[verify-schema] ✓ ${table}`);
      }
    } else {
      // SQLite — query sqlite_master
      for (const table of REQUIRED_TABLES) {
        const result = await db.$queryRawUnsafe(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
          table
        );
        if (!result || result.length === 0) {
          console.error(`[verify-schema] MISSING TABLE: ${table}`);
          process.exit(1);
        }
        console.log(`[verify-schema] ✓ ${table}`);
      }
    }

    console.log('[verify-schema] ✓ All required tables exist.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error('[verify-schema] Error:', err.message);
  process.exit(1);
});
