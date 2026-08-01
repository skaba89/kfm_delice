#!/usr/bin/env node
/**
 * repair-qr-migration.cjs — Mission 4
 *
 * Targeted, safe repair of the 20260713000000_add_restaurant_table_qr migration.
 *
 * This script:
 *   1. Runs the read-only verification (verify-restaurant-table-qr-migration.cjs)
 *   2. If all objects exist (chemin A): runs `prisma migrate resolve --applied`
 *   3. If objects are missing (chemin B):
 *      a. Runs `prisma migrate resolve --rolled-back`
 *      b. Creates missing objects using conditional SQL (IF NOT EXISTS / DO $$)
 *      c. Re-runs the verification
 *      d. If verification passes: runs `prisma migrate resolve --applied`
 *
 * ONLY targets the QR migration. Refuses to touch any other migration.
 *
 * This script does NOT:
 *   - Drop tables or columns
 *   - Delete data
 *   - Use `prisma db push`
 *   - Use `--accept-data-loss`
 *   - Modify other migrations
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/repair-qr-migration.cjs
 *
 * Exit codes:
 *   0 — migration repaired successfully (or already OK)
 *   1 — repair failed (manual intervention needed)
 *   2 — database connection error
 */

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const MIGRATION_NAME = '20260713000000_add_restaurant_table_qr';

async function verify(db) {
  // Run the verification script and capture its exit code
  try {
    execSync('node scripts/verify-restaurant-table-qr-migration.cjs', {
      stdio: 'inherit',
      env: process.env,
    });
    return 0; // all objects OK
  } catch (err) {
    if (err.status === 1) return 1; // objects missing
    return 2; // database error
  }
}

async function getMigrationState(db) {
  const result = await db.$queryRawUnsafe(`
    SELECT migration_name, finished_at, rolled_back_at, started_at
    FROM _prisma_migrations
    WHERE migration_name = $1
  `, MIGRATION_NAME);
  return result[0] || null;
}

async function runPrismaResolve(action) {
  console.log(`[repair] Running: prisma migrate resolve --${action} ${MIGRATION_NAME}`);
  try {
    execSync(`node_modules/.bin/prisma migrate resolve --${action} ${MIGRATION_NAME}`, {
      stdio: 'inherit',
      env: process.env,
    });
    return true;
  } catch (err) {
    console.error(`[repair] prisma migrate resolve --${action} failed:`, err.message);
    return false;
  }
}

async function createMissingObjects(db) {
  console.log('[repair] Creating missing objects with conditional SQL...');

  // 1. Create table if not exists
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RestaurantTable" (
      "id"              TEXT NOT NULL,
      "restaurantId"    TEXT NOT NULL,
      "name"            TEXT NOT NULL,
      "number"          TEXT NOT NULL,
      "capacity"        INTEGER NOT NULL DEFAULT 4,
      "zone"            TEXT NOT NULL DEFAULT '',
      "status"          TEXT NOT NULL DEFAULT 'available',
      "active"          BOOLEAN NOT NULL DEFAULT true,
      "qrToken"         TEXT NOT NULL,
      "qrVersion"       INTEGER NOT NULL DEFAULT 1,
      "qrEnabled"       BOOLEAN NOT NULL DEFAULT true,
      "qrGeneratedAt"   TIMESTAMP(3),
      "lastScannedAt"   TIMESTAMP(3),
      "scanCount"       INTEGER NOT NULL DEFAULT 0,
      "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"       TIMESTAMP(3) NOT NULL,
      CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
    )
  `);
  console.log('  ✓ RestaurantTable table ensured');

  // 2. Unique indexes
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_number_key"
      ON "RestaurantTable"("restaurantId", "number")
  `);
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_qrToken_key"
      ON "RestaurantTable"("qrToken")
  `);
  console.log('  ✓ Unique indexes ensured');

  // 3. Regular indexes
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_idx"
      ON "RestaurantTable"("restaurantId")
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_active_idx"
      ON "RestaurantTable"("restaurantId", "active")
  `);
  console.log('  ✓ Regular indexes ensured');

  // 4. FK: RestaurantTable → Restaurant (CASCADE) — conditional via DO $$
  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RestaurantTable_restaurantId_fkey'
      ) THEN
        ALTER TABLE "RestaurantTable"
          ADD CONSTRAINT "RestaurantTable_restaurantId_fkey"
          FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
          ON DELETE CASCADE;
      END IF;
    END $$
  `);
  console.log('  ✓ RestaurantTable_restaurantId_fkey ensured');

  // 5. Add columns to Order if missing
  await db.$executeRawUnsafe(`
    ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableId" TEXT
  `);
  await db.$executeRawUnsafe(`
    ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableNumberStr" TEXT NOT NULL DEFAULT ''
  `);
  console.log('  ✓ Order.tableId and Order.tableNumberStr ensured');

  // 6. FK: Order → RestaurantTable (SET NULL) — conditional via DO $$
  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Order_tableId_fkey'
      ) THEN
        ALTER TABLE "Order"
          ADD CONSTRAINT "Order_tableId_fkey"
          FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id")
          ON DELETE SET NULL;
      END IF;
    END $$
  `);
  console.log('  ✓ Order_tableId_fkey ensured');

  // 7. Index on Order.tableId
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Order_tableId_idx" ON "Order"("tableId")
  `);
  console.log('  ✓ Order_tableId_idx ensured');
}

async function main() {
  console.log('[repair] ─────────────────────────────────────────────');
  console.log(`[repair] Repairing migration: ${MIGRATION_NAME}`);
  console.log('[repair] ─────────────────────────────────────────────');

  const db = new PrismaClient();

  try {
    // ── Step 1: Check migration state ──
    const state = await getMigrationState(db);
    if (!state) {
      console.log('[repair] Migration not in _prisma_migrations — nothing to repair.');
      console.log('[repair] prisma migrate deploy will apply it normally.');
      return;
    }

    const isFinished = state.finished_at !== null;
    const isRolledBack = state.rolled_back_at !== null;

    if (isFinished && !isRolledBack) {
      console.log('[repair] ✓ Migration already marked as applied. Nothing to do.');
      return;
    }

    console.log('[repair] Migration is in failed or rolled-back state.');
    console.log('[repair] Running verification to determine path (A or B)...');

    // ── Step 2: Run verification ──
    const verifyResult = await verify(db);

    if (verifyResult === 2) {
      console.error('[repair] ✗ Database connection error during verification.');
      process.exit(2);
    }

    if (verifyResult === 0) {
      // ── CHEMIN A: All objects exist ──
      console.log('[repair] ── CHEMIN A: All objects verified ──');
      console.log('[repair] Marking migration as applied...');
      const ok = await runPrismaResolve('applied');
      if (!ok) {
        console.error('[repair] ✗ Failed to mark migration as applied.');
        process.exit(1);
      }
      console.log('[repair] ✓ Migration marked as applied (chemin A).');
      return;
    }

    // ── CHEMIN B: Objects missing ──
    console.log('[repair] ── CHEMIN B: Some objects missing ──');

    // Step B.1: Mark as rolled-back so prisma can re-apply
    console.log('[repair] Step B.1: Marking migration as rolled-back...');
    const rolledBack = await runPrismaResolve('rolled-back');
    if (!rolledBack) {
      console.error('[repair] ✗ Failed to mark migration as rolled-back.');
      process.exit(1);
    }

    // Step B.2: Create missing objects with conditional SQL
    console.log('[repair] Step B.2: Creating missing objects...');
    await createMissingObjects(db);

    // Step B.3: Re-verify
    console.log('[repair] Step B.3: Re-running verification...');
    const verifyResult2 = await verify(db);

    if (verifyResult2 !== 0) {
      console.error('[repair] ✗ Verification still fails after repair. Manual intervention needed.');
      process.exit(1);
    }

    // Step B.4: Mark as applied
    console.log('[repair] Step B.4: All objects verified. Marking as applied...');
    const ok = await runPrismaResolve('applied');
    if (!ok) {
      console.error('[repair] ✗ Failed to mark migration as applied.');
      process.exit(1);
    }

    console.log('[repair] ✓ Migration repaired successfully (chemin B).');
  } catch (err) {
    console.error('[repair] Error:', err.message);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
