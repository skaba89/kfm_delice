#!/usr/bin/env node
/**
 * verify-restaurant-table-qr-migration.cjs — Mission 3
 *
 * Read-only verification that the QR table migration's objects exist
 * and match the expected schema. Does NOT modify the database.
 *
 * Checks:
 *   1.  RestaurantTable table exists
 *   2.  All expected columns with correct types
 *   3.  Order.tableId column exists
 *   4.  Order.tableNumberStr column exists
 *   5.  All expected indexes exist
 *   6.  All expected unique constraints exist
 *   7.  Both foreign keys exist
 *   8.  ON DELETE actions are correct
 *   9.  No orphaned data (Order.tableId → RestaurantTable.id)
 *   10. Migration state in _prisma_migrations
 *
 * Exit codes:
 *   0 — all objects match (chemin A: safe to mark as applied)
 *   1 — one or more objects missing or different (chemin B: needs repair)
 *   2 — database connection error
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/verify-restaurant-table-qr-migration.cjs
 */

const { PrismaClient } = require('@prisma/client');

// ── Expected schema for RestaurantTable ──
const EXPECTED_COLUMNS = [
  { name: 'id',              type: 'text',       nullable: false },
  { name: 'restaurantId',    type: 'text',       nullable: false },
  { name: 'name',            type: 'text',       nullable: false },
  { name: 'number',          type: 'text',       nullable: false },
  { name: 'capacity',        type: 'integer',    nullable: false },
  { name: 'zone',            type: 'text',       nullable: false },
  { name: 'status',          type: 'text',       nullable: false },
  { name: 'active',          type: 'boolean',    nullable: false },
  { name: 'qrToken',         type: 'text',       nullable: false },
  { name: 'qrVersion',       type: 'integer',    nullable: false },
  { name: 'qrEnabled',       type: 'boolean',    nullable: false },
  { name: 'qrGeneratedAt',   type: 'timestamp',  nullable: true  },
  { name: 'lastScannedAt',   type: 'timestamp',  nullable: true  },
  { name: 'scanCount',       type: 'integer',    nullable: false },
  { name: 'createdAt',       type: 'timestamp',  nullable: false },
  { name: 'updatedAt',       type: 'timestamp',  nullable: false },
];

const EXPECTED_INDEXES = [
  'RestaurantTable_pkey',                        // PK
  'RestaurantTable_restaurantId_number_key',     // unique (restaurantId, number)
  'RestaurantTable_qrToken_key',                 // unique qrToken
  'RestaurantTable_restaurantId_idx',            // index restaurantId
  'RestaurantTable_restaurantId_active_idx',     // index (restaurantId, active)
  'Order_tableId_idx',                           // index Order.tableId
];

const EXPECTED_CONSTRAINTS = [
  {
    name: 'RestaurantTable_pkey',
    type: 'p', // primary key
    table: 'RestaurantTable',
    onDelete: null,
  },
  {
    name: 'RestaurantTable_restaurantId_fkey',
    type: 'f', // foreign key
    table: 'RestaurantTable',
    onDelete: 'CASCADE',
    references: 'Restaurant',
  },
  {
    name: 'Order_tableId_fkey',
    type: 'f',
    table: 'Order',
    onDelete: 'SET NULL',
    references: 'RestaurantTable',
  },
];

const MIGRATION_NAME = '20260713000000_add_restaurant_table_qr';

async function main() {
  const db = new PrismaClient();
  const errors = [];
  const warnings = [];

  try {
    // ── Check 1: RestaurantTable table exists ──
    console.log('[verify] Check 1: RestaurantTable table exists...');
    const tableExists = await db.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'RestaurantTable'
      )::boolean AS exists
    `);
    if (!tableExists[0]?.exists) {
      errors.push('RestaurantTable table does NOT exist');
      console.log('  ✗ RestaurantTable table MISSING');
    } else {
      console.log('  ✓ RestaurantTable table exists');
    }

    // ── Check 2: All expected columns on RestaurantTable ──
    console.log('[verify] Check 2: RestaurantTable columns...');
    const columns = await db.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'RestaurantTable'
      ORDER BY ordinal_position
    `);
    const columnMap = new Map(columns.map(c => [c.column_name, c]));

    for (const expected of EXPECTED_COLUMNS) {
      const actual = columnMap.get(expected.name);
      if (!actual) {
        errors.push(`Column RestaurantTable.${expected.name} is MISSING`);
        console.log(`  ✗ ${expected.name} MISSING`);
      } else {
        // Check type (timestamp covers timestamp(3) and timestamp without time zone)
        const typeMatch =
          actual.data_type === expected.type ||
          (expected.type === 'timestamp' && actual.data_type.startsWith('timestamp'));
        if (!typeMatch) {
          errors.push(`Column RestaurantTable.${expected.name} has wrong type: expected ${expected.type}, got ${actual.data_type}`);
          console.log(`  ✗ ${expected.name} type mismatch: expected ${expected.type}, got ${actual.data_type}`);
        } else if (actual.is_nullable === 'YES' && !expected.nullable) {
          errors.push(`Column RestaurantTable.${expected.name} should NOT be nullable`);
          console.log(`  ✗ ${expected.name} should not be nullable`);
        } else {
          console.log(`  ✓ ${expected.name} (${actual.data_type})`);
        }
      }
    }

    // ── Check 3: Order.tableId column exists ──
    console.log('[verify] Check 3: Order.tableId column...');
    const orderTableId = await db.$queryRawUnsafe(`
      SELECT data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'Order'
      AND column_name = 'tableId'
    `);
    if (orderTableId.length === 0) {
      errors.push('Order.tableId column is MISSING');
      console.log('  ✗ Order.tableId MISSING');
    } else {
      console.log('  ✓ Order.tableId exists');
    }

    // ── Check 4: Order.tableNumberStr column exists ──
    console.log('[verify] Check 4: Order.tableNumberStr column...');
    const orderTableNum = await db.$queryRawUnsafe(`
      SELECT data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'Order'
      AND column_name = 'tableNumberStr'
    `);
    if (orderTableNum.length === 0) {
      errors.push('Order.tableNumberStr column is MISSING');
      console.log('  ✗ Order.tableNumberStr MISSING');
    } else {
      console.log('  ✓ Order.tableNumberStr exists');
    }

    // ── Check 5 & 6: Indexes and unique constraints ──
    console.log('[verify] Check 5 & 6: Indexes and constraints...');
    const indexes = await db.$queryRawUnsafe(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('RestaurantTable', 'Order')
    `);
    const indexNames = new Set(indexes.map(i => i.indexname));

    for (const expectedIdx of EXPECTED_INDEXES) {
      if (!indexNames.has(expectedIdx)) {
        errors.push(`Index/constraint "${expectedIdx}" is MISSING`);
        console.log(`  ✗ ${expectedIdx} MISSING`);
      } else {
        console.log(`  ✓ ${expectedIdx}`);
      }
    }

    // ── Check 7 & 8: Foreign keys with ON DELETE actions ──
    console.log('[verify] Check 7 & 8: Foreign keys with ON DELETE actions...');
    const fks = await db.$queryRawUnsafe(`
      SELECT
        c.conname AS constraint_name,
        c.contype AS constraint_type,
        cl.relname AS table_name,
        cl2.relname AS references_table,
        c.confdeltype AS on_delete
      FROM pg_constraint c
      JOIN pg_class cl ON c.conrelid = cl.oid
      LEFT JOIN pg_class cl2 ON c.confrelid = cl2.oid
      WHERE c.conname IN (
        'RestaurantTable_restaurantId_fkey',
        'Order_tableId_fkey',
        'RestaurantTable_pkey'
      )
    `);
    const fkMap = new Map(fks.map(f => [f.constraint_name, f]));

    for (const expected of EXPECTED_CONSTRAINTS) {
      const actual = fkMap.get(expected.name);
      if (!actual) {
        errors.push(`Constraint "${expected.name}" is MISSING`);
        console.log(`  ✗ ${expected.name} MISSING`);
        continue;
      }

      if (actual.constraint_type !== expected.type) {
        errors.push(`Constraint "${expected.name}" has wrong type: expected ${expected.type}, got ${actual.constraint_type}`);
        console.log(`  ✗ ${expected.name} type mismatch`);
      }

      if (expected.type === 'f') {
        // Check ON DELETE action
        // confdeltype: 'a' = NO ACTION, 'c' = CASCADE, 'n' = SET NULL, 'r' = RESTRICT, 'd' = SET DEFAULT
        const deleteActions = { 'a': 'NO ACTION', 'c': 'CASCADE', 'n': 'SET NULL', 'r': 'RESTRICT', 'd': 'SET DEFAULT' };
        const actualDelete = deleteActions[actual.on_delete] || 'UNKNOWN';
        if (actualDelete !== expected.onDelete) {
          errors.push(`Constraint "${expected.name}" ON DELETE: expected ${expected.onDelete}, got ${actualDelete}`);
          console.log(`  ✗ ${expected.name} ON DELETE mismatch: expected ${expected.onDelete}, got ${actualDelete}`);
        } else {
          console.log(`  ✓ ${expected.name} ON DELETE ${actualDelete}`);
        }

        // Check referenced table
        if (expected.references && actual.references_table !== expected.references) {
          errors.push(`Constraint "${expected.name}" references wrong table: expected ${expected.references}, got ${actual.references_table}`);
          console.log(`  ✗ ${expected.name} references wrong table`);
        }
      }
    }

    // ── Check 9: No orphaned data ──
    console.log('[verify] Check 9: Orphaned data check...');
    if (tableExists[0]?.exists) {
      const orphanedOrders = await db.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS count
        FROM "Order" o
        LEFT JOIN "RestaurantTable" rt ON o."tableId" = rt.id
        WHERE o."tableId" IS NOT NULL AND rt.id IS NULL
      `);
      if (orphanedOrders[0]?.count > 0) {
        warnings.push(`${orphanedOrders[0].count} orders reference non-existent tables`);
        console.log(`  ⚠ ${orphanedOrders[0].count} orphaned orders (non-blocking)`);
      } else {
        console.log('  ✓ No orphaned orders');
      }
    }

    // ── Check 10: Migration state in _prisma_migrations ──
    console.log('[verify] Check 10: Migration state...');
    const migrationState = await db.$queryRawUnsafe(`
      SELECT migration_name, finished_at, rolled_back_at, started_at
      FROM _prisma_migrations
      WHERE migration_name = $1
    `, MIGRATION_NAME);

    if (migrationState.length === 0) {
      console.log(`  ℹ Migration "${MIGRATION_NAME}" not in _prisma_migrations (never attempted)`);
    } else {
      const m = migrationState[0];
      const isFinished = m.finished_at !== null;
      const isRolledBack = m.rolled_back_at !== null;
      const isFailed = m.started_at !== null && !isFinished && !isRolledBack;

      if (isFinished && !isRolledBack) {
        console.log(`  ✓ Migration already marked as applied`);
      } else if (isRolledBack) {
        console.log(`  ℹ Migration is marked as rolled back`);
      } else if (isFailed) {
        console.log(`  ✗ Migration is in FAILED state (started but never finished)`);
        errors.push(`Migration "${MIGRATION_NAME}" is in failed state`);
      } else {
        console.log(`  ℹ Migration state unknown`);
      }
    }

    // ── Final report ──
    console.log('');
    console.log('========================================');
    if (errors.length === 0) {
      console.log('✓ All QR migration objects verified — CHEMIN A (safe to mark as applied)');
      console.log('========================================');
      process.exit(0);
    } else {
      console.log(`✗ ${errors.length} error(s) found — CHEMIN B (needs repair)`);
      console.log('========================================');
      for (const e of errors) {
        console.log(`  ✗ ${e}`);
      }
      if (warnings.length > 0) {
        console.log('');
        console.log('Warnings (non-blocking):');
        for (const w of warnings) {
          console.log(`  ⚠ ${w}`);
        }
      }
      process.exit(1);
    }
  } catch (err) {
    console.error('[verify] Database error:', err.message);
    process.exit(2);
  } finally {
    await db.$disconnect();
  }
}

main();
