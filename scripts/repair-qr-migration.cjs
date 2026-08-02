#!/usr/bin/env node
/**
 * repair-qr-migration.cjs — Mission 4 (simplified)
 *
 * Targeted, safe repair of the 20260713000000_add_restaurant_table_qr migration.
 *
 * Strategy:
 *   1. Run read-only verification of all QR objects
 *   2. If objects are missing, create them with conditional SQL (IF NOT EXISTS / DO $$)
 *   3. Re-verify
 *   4. If all objects OK, mark migration as --applied via prisma migrate resolve
 *   5. If --applied fails (P3012 — not in a state Prisma can resolve), manually
 *      UPDATE _prisma_migrations to set finished_at (last resort, documented)
 *
 * ONLY targets the QR migration. Refuses to touch any other migration.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/repair-qr-migration.cjs
 */

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const MIGRATION_NAME = '20260713000000_add_restaurant_table_qr';

function runPrismaResolve(action) {
  console.log(`[repair] Running: prisma migrate resolve --${action} ${MIGRATION_NAME}`);
  try {
    execSync(`node_modules/.bin/prisma migrate resolve --${action} ${MIGRATION_NAME}`, {
      stdio: 'inherit',
      env: process.env,
    });
    return true;
  } catch (err) {
    console.log(`[repair] prisma migrate resolve --${action} returned non-zero exit code`);
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
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_number_key" ON "RestaurantTable"("restaurantId", "number")`);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_qrToken_key" ON "RestaurantTable"("qrToken")`);
  console.log('  ✓ Unique indexes ensured');

  // 3. Regular indexes
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_idx" ON "RestaurantTable"("restaurantId")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_active_idx" ON "RestaurantTable"("restaurantId", "active")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Order_tableId_idx" ON "Order"("tableId")`);
  console.log('  ✓ Regular indexes ensured (including Order_tableId_idx)');

  // 4. FK: RestaurantTable → Restaurant (CASCADE)
  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RestaurantTable_restaurantId_fkey') THEN
        ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_restaurantId_fkey"
          FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;
      END IF;
    END $$
  `);
  console.log('  ✓ RestaurantTable_restaurantId_fkey ensured');

  // 5. Order columns
  await db.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableId" TEXT`);
  await db.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableNumberStr" TEXT NOT NULL DEFAULT ''`);
  console.log('  ✓ Order.tableId and Order.tableNumberStr ensured');

  // 6. FK: Order → RestaurantTable (SET NULL)
  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_tableId_fkey') THEN
        ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey"
          FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL;
      END IF;
    END $$
  `);
  console.log('  ✓ Order_tableId_fkey ensured');
}

async function verify() {
  try {
    execSync('node scripts/verify-restaurant-table-qr-migration.cjs', {
      stdio: 'inherit',
      env: process.env,
    });
    return 0;
  } catch (err) {
    return err.status || 1;
  }
}

async function markAsApplied(db) {
  // Try prisma migrate resolve --applied first
  const ok = runPrismaResolve('applied');
  if (ok) {
    console.log('[repair] ✓ Migration marked as applied via prisma migrate resolve.');
    return true;
  }

  // If --applied fails (P3012), manually UPDATE _prisma_migrations
  // This is the last resort — documented and audited.
  console.log('[repair] prisma migrate resolve --applied failed (likely P3012).');
  console.log('[repair] Falling back to direct UPDATE of _prisma_migrations...');
  console.log('[repair] (This is safe — the objects are verified to exist.)');

  try {
    await db.$executeRawUnsafe(`
      UPDATE _prisma_migrations
      SET finished_at = NOW(),
          rolled_back_at = NULL,
          applied_steps_count = 1,
          logs = COALESCE(logs, '') || '[repair] Marked as applied by repair-qr-migration.cjs\n'
      WHERE migration_name = $1
    `, MIGRATION_NAME);
    console.log('[repair] ✓ Migration marked as applied via direct UPDATE.');
    return true;
  } catch (err) {
    console.error('[repair] ✗ Direct UPDATE failed:', err.message);
    return false;
  }
}

async function main() {
  console.log('[repair] ─────────────────────────────────────────────');
  console.log(`[repair] Repairing migration: ${MIGRATION_NAME}`);
  console.log('[repair] ─────────────────────────────────────────────');

  const db = new PrismaClient();

  try {
    // ── Step 1: Check migration state ──
    const state = await db.$queryRawUnsafe(`
      SELECT migration_name, finished_at, rolled_back_at, started_at
      FROM _prisma_migrations
      WHERE migration_name = $1
    `, MIGRATION_NAME).catch(() => []);

    if (state.length > 0) {
      const s = state[0];
      const isFinished = s.finished_at !== null;
      const isRolledBack = s.rolled_back_at !== null;
      console.log(`[repair] Migration state: finished=${isFinished}, rolled_back=${isRolledBack}`);

      if (isFinished && !isRolledBack) {
        console.log('[repair] ✓ Migration already applied. Nothing to do.');
        return;
      }
    } else {
      console.log('[repair] Migration not in _prisma_migrations — will let migrate deploy handle it.');
      return;
    }

    // ── Step 2: Verify objects ──
    console.log('[repair] Step 2: Running verification...');
    let verifyResult = await verify();

    if (verifyResult === 2) {
      console.error('[repair] ✗ Database connection error.');
      process.exit(2);
    }

    // ── Step 3: If objects missing, create them ──
    if (verifyResult !== 0) {
      console.log('[repair] Step 3: Creating missing objects...');
      await createMissingObjects(db);

      console.log('[repair] Step 3b: Re-verifying...');
      verifyResult = await verify();
      if (verifyResult !== 0) {
        console.error('[repair] ✗ Verification still fails after creating objects. Manual intervention needed.');
        process.exit(1);
      }
    }

    // ── Step 4: Mark as applied ──
    console.log('[repair] Step 4: All objects verified. Marking as applied...');
    const ok = await markAsApplied(db);
    if (!ok) {
      console.error('[repair] ✗ Failed to mark migration as applied.');
      process.exit(1);
    }

    console.log('[repair] ✓ Migration repaired successfully.');
  } catch (err) {
    console.error('[repair] Error:', err.message);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
