#!/usr/bin/env node
/**
 * repair-reco-11-15-migration.cjs
 *
 * Targeted production recovery for the historical failed migration:
 *   20260714090000_add_reco_11_15
 *
 * Safety model:
 * - PostgreSQL only.
 * - Never resolves any other migration.
 * - Never drops tables, columns, indexes, constraints, or business data.
 * - Never DELETEs or UPDATEs Customer, Staff, Supplier, or Restaurant rows.
 * - Completes only deterministic historical columns declared by this migration.
 * - Existing Supplier tables must already expose the exact data-bearing shape.
 * - Historical orphan Supplier rows are preserved. If they prevent retroactive
 *   FK validation, the FK is added/kept NOT VALID; PostgreSQL still enforces it
 *   for future inserts/updates.
 * - Migration history is resolved only after exact postconditions are proven.
 */

const { PrismaClient } = require('@prisma/client');
const { execFileSync } = require('child_process');

const MIGRATION_NAME = '20260714090000_add_reco_11_15';

const EXPECTED_SUPPLIER_COLUMNS = {
  id: { type: 'text', nullable: 'NO', defaultKind: 'none' },
  name: { type: 'text', nullable: 'NO', defaultKind: 'none' },
  contactName: { type: 'text', nullable: 'NO', defaultKind: 'empty' },
  phone: { type: 'text', nullable: 'NO', defaultKind: 'empty' },
  email: { type: 'text', nullable: 'NO', defaultKind: 'empty' },
  address: { type: 'text', nullable: 'NO', defaultKind: 'empty' },
  category: { type: 'text', nullable: 'NO', defaultKind: 'general' },
  notes: { type: 'text', nullable: 'NO', defaultKind: 'empty' },
  restaurantId: { type: 'text', nullable: 'NO', defaultKind: 'none' },
  createdAt: { type: 'timestamp without time zone', nullable: 'NO', defaultKind: 'now' },
  updatedAt: { type: 'timestamp without time zone', nullable: 'NO', defaultKind: 'none' },
};

const REQUIRED_INDEXES = [
  { name: 'Supplier_restaurantId_idx', columns: ['restaurantId'] },
  { name: 'Supplier_restaurantId_category_idx', columns: ['restaurantId', 'category'] },
];

function isPostgres() {
  const url = process.env.DATABASE_URL || '';
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

async function getMigrationState(db) {
  const rows = await db.$queryRawUnsafe(
    `SELECT migration_name, started_at, finished_at, rolled_back_at, logs
     FROM _prisma_migrations
     WHERE migration_name = $1
     ORDER BY started_at DESC`,
    MIGRATION_NAME
  );
  return rows[0] || null;
}

async function tableExists(db, table) {
  const rows = await db.$queryRawUnsafe(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = $1
     ) AS exists`,
    table
  );
  return Boolean(rows[0]?.exists);
}

async function requireTable(db, table) {
  if (!(await tableExists(db, table))) {
    throw new Error(`${table} table is missing; refusing ${MIGRATION_NAME} recovery`);
  }
}

async function getColumnMetadata(db, table) {
  const rows = await db.$queryRawUnsafe(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    table
  );
  return new Map(rows.map((row) => [row.column_name, row]));
}

function assertDefault(column, metadata, expectedKind) {
  const actual = String(metadata.column_default || '');
  if (expectedKind === 'none') {
    if (metadata.column_default !== null) {
      throw new Error(`${column} default mismatch: expected none, got ${actual}`);
    }
    return;
  }
  if (expectedKind === 'empty' && !actual.includes("''")) {
    throw new Error(`${column} default mismatch: expected empty string, got ${actual || 'none'}`);
  }
  if (expectedKind === 'general' && !actual.includes("'general'")) {
    throw new Error(`${column} default mismatch: expected general, got ${actual || 'none'}`);
  }
  if (expectedKind === 'now' && !/CURRENT_TIMESTAMP|now\(\)/i.test(actual)) {
    throw new Error(`${column} default mismatch: expected CURRENT_TIMESTAMP, got ${actual || 'none'}`);
  }
}

function assertSupplierShape(metadata, context) {
  const missing = Object.keys(EXPECTED_SUPPLIER_COLUMNS).filter((column) => !metadata.has(column));
  if (missing.length > 0) {
    throw new Error(`${context} is missing Supplier columns (${missing.join(', ')}); refusing to invent data-bearing fields`);
  }

  const errors = [];
  for (const [column, expected] of Object.entries(EXPECTED_SUPPLIER_COLUMNS)) {
    const actual = metadata.get(column);
    if (actual.data_type !== expected.type || actual.is_nullable !== expected.nullable) {
      errors.push(`${column}: expected ${expected.type}/${expected.nullable}, got ${actual.data_type}/${actual.is_nullable}`);
      continue;
    }
    try {
      assertDefault(`Supplier.${column}`, actual, expected.defaultKind);
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length > 0) {
    throw new Error(`${context} shape mismatch: ${errors.join('; ')}`);
  }
}

async function ensureDeterministicColumn(db, table, column, sql, expected) {
  let metadata = await getColumnMetadata(db, table);
  if (!metadata.has(column)) {
    console.log(`[reco-repair] ${table}.${column} is missing; adding exact historical deterministic column...`);
    await db.$executeRawUnsafe(sql);
    metadata = await getColumnMetadata(db, table);
  }

  const actual = metadata.get(column);
  if (!actual || actual.data_type !== expected.type || actual.is_nullable !== 'NO') {
    throw new Error(
      `${table}.${column} shape mismatch: expected ${expected.type}/NO, got ${actual?.data_type || 'missing'}/${actual?.is_nullable || 'missing'}`
    );
  }

  const defaultValue = String(actual.column_default || '');
  if (!defaultValue.includes(expected.defaultToken)) {
    throw new Error(
      `${table}.${column} default mismatch: expected token ${expected.defaultToken}, got ${defaultValue || 'none'}`
    );
  }
}

async function ensureHistoricalScalarColumns(db) {
  await requireTable(db, 'Customer');
  await requireTable(db, 'Staff');

  await ensureDeterministicColumn(
    db,
    'Customer',
    'referralCode',
    `ALTER TABLE "Customer" ADD COLUMN "referralCode" TEXT NOT NULL DEFAULT ''`,
    { type: 'text', defaultToken: "''" }
  );
  await ensureDeterministicColumn(
    db,
    'Customer',
    'referredBy',
    `ALTER TABLE "Customer" ADD COLUMN "referredBy" TEXT NOT NULL DEFAULT ''`,
    { type: 'text', defaultToken: "''" }
  );
  await ensureDeterministicColumn(
    db,
    'Staff',
    'weeklySchedule',
    `ALTER TABLE "Staff" ADD COLUMN "weeklySchedule" TEXT NOT NULL DEFAULT '[]'`,
    { type: 'text', defaultToken: "'[]'" }
  );
  await ensureDeterministicColumn(
    db,
    'Staff',
    'totalHours',
    `ALTER TABLE "Staff" ADD COLUMN "totalHours" REAL NOT NULL DEFAULT 0`,
    { type: 'real', defaultToken: '0' }
  );
}

async function createHistoricalSupplierTable(db) {
  console.log('[reco-repair] Supplier table is missing; creating the exact historical shape...');
  await db.$executeRawUnsafe(`
    CREATE TABLE "Supplier" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "contactName" TEXT NOT NULL DEFAULT '',
      "phone" TEXT NOT NULL DEFAULT '',
      "email" TEXT NOT NULL DEFAULT '',
      "address" TEXT NOT NULL DEFAULT '',
      "category" TEXT NOT NULL DEFAULT 'general',
      "notes" TEXT NOT NULL DEFAULT '',
      "restaurantId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
    )
  `);
}

async function ensureSupplierShape(db) {
  if (!(await tableExists(db, 'Supplier'))) {
    await createHistoricalSupplierTable(db);
  }
  const metadata = await getColumnMetadata(db, 'Supplier');
  assertSupplierShape(metadata, 'Supplier');
}

async function ensurePrimaryKey(db) {
  const rows = await db.$queryRawUnsafe(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = '"Supplier"'::regclass
      AND contype = 'p'
  `);

  if (rows.length === 0) {
    await db.$executeRawUnsafe(`
      ALTER TABLE "Supplier"
        ADD CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
    `);
    return;
  }

  if (rows.length !== 1 || rows[0].conname !== 'Supplier_pkey') {
    throw new Error(`Supplier has unexpected primary-key constraint(s): ${rows.map((row) => row.conname).join(', ')}`);
  }

  const normalized = String(rows[0].definition || '').replace(/"/g, '');
  if (!normalized.includes('PRIMARY KEY (id)')) {
    throw new Error(`Unexpected Supplier_pkey definition: ${rows[0].definition}`);
  }
}

async function getIndex(db, name) {
  const rows = await db.$queryRawUnsafe(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'Supplier'
       AND indexname = $1`,
    name
  );
  return rows[0] || null;
}

function assertIndex(index, spec) {
  if (!index) throw new Error(`${spec.name} is missing`);
  const normalized = String(index.indexdef || '').replace(/"/g, '');
  if (/CREATE\s+UNIQUE\s+INDEX/i.test(normalized)) {
    throw new Error(`${spec.name} must be non-unique: ${index.indexdef}`);
  }
  const expectedColumns = `(${spec.columns.join(', ')})`;
  if (!normalized.includes(expectedColumns)) {
    throw new Error(`${spec.name} column definition mismatch: ${index.indexdef}`);
  }
}

async function ensureIndexes(db) {
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Supplier_restaurantId_idx" ON "Supplier"("restaurantId")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Supplier_restaurantId_category_idx" ON "Supplier"("restaurantId", "category")`);

  for (const spec of REQUIRED_INDEXES) {
    assertIndex(await getIndex(db, spec.name), spec);
  }
}

async function countSupplierOrphans(db) {
  const rows = await db.$queryRawUnsafe(`
    SELECT COUNT(*)::text AS count
    FROM "Supplier" s
    LEFT JOIN "Restaurant" r ON r."id" = s."restaurantId"
    WHERE r."id" IS NULL
  `);
  return BigInt(rows[0]?.count || '0');
}

async function getForeignKey(db) {
  const rows = await db.$queryRawUnsafe(`
    SELECT c.conname, c.convalidated, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    WHERE c.conrelid = '"Supplier"'::regclass
      AND c.conname = 'Supplier_restaurantId_fkey'
      AND c.contype = 'f'
  `);
  return rows[0] || null;
}

function assertForeignKey(fk) {
  if (!fk) throw new Error('Supplier_restaurantId_fkey is missing');
  const definition = String(fk.definition || '');
  if (
    !definition.includes('FOREIGN KEY ("restaurantId")') ||
    !definition.includes('REFERENCES "Restaurant"(id)') ||
    !definition.includes('ON DELETE CASCADE')
  ) {
    throw new Error(`Unexpected Supplier_restaurantId_fkey definition: ${definition}`);
  }
}

async function ensureForeignKey(db) {
  await requireTable(db, 'Restaurant');
  const orphanCount = await countSupplierOrphans(db);
  let fk = await getForeignKey(db);

  if (fk) {
    assertForeignKey(fk);
  } else if (orphanCount > 0n) {
    console.warn(
      `[reco-repair] ⚠ Found ${orphanCount.toString()} historical Supplier row(s) without Restaurant. ` +
        'Preserving them and adding the FK NOT VALID; future writes remain enforced.'
    );
    await db.$executeRawUnsafe(`
      ALTER TABLE "Supplier"
        ADD CONSTRAINT "Supplier_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
        ON DELETE CASCADE
        NOT VALID
    `);
    fk = await getForeignKey(db);
  } else {
    await db.$executeRawUnsafe(`
      ALTER TABLE "Supplier"
        ADD CONSTRAINT "Supplier_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
        ON DELETE CASCADE
    `);
    fk = await getForeignKey(db);
  }

  assertForeignKey(fk);

  if (!fk.convalidated && orphanCount === 0n) {
    await db.$executeRawUnsafe(`ALTER TABLE "Supplier" VALIDATE CONSTRAINT "Supplier_restaurantId_fkey"`);
    fk = await getForeignKey(db);
    assertForeignKey(fk);
  }

  if (orphanCount === 0n && !fk.convalidated) {
    throw new Error('Supplier FK remains NOT VALID although no orphan rows exist');
  }
  if (orphanCount > 0n && fk.convalidated) {
    throw new Error('Supplier FK cannot be validated while historical orphan rows exist');
  }

  if (orphanCount > 0n) {
    console.warn(
      `[reco-repair] ⚠ Supplier_restaurantId_fkey remains NOT VALID because ${orphanCount.toString()} historical orphan row(s) exist. No data was deleted or rewritten.`
    );
  }

  return { orphanCount, validated: Boolean(fk.convalidated) };
}

async function countRows(db, table) {
  const rows = await db.$queryRawUnsafe(`SELECT COUNT(*)::text AS count FROM "${table}"`);
  return BigInt(rows[0]?.count || '0');
}

async function captureRowCounts(db) {
  await requireTable(db, 'Customer');
  await requireTable(db, 'Staff');
  return {
    Customer: await countRows(db, 'Customer'),
    Staff: await countRows(db, 'Staff'),
    Supplier: (await tableExists(db, 'Supplier')) ? await countRows(db, 'Supplier') : 0n,
  };
}

async function assertRowCountsUnchanged(db, before) {
  const after = {
    Customer: await countRows(db, 'Customer'),
    Staff: await countRows(db, 'Staff'),
    Supplier: await countRows(db, 'Supplier'),
  };
  for (const table of Object.keys(before)) {
    if (after[table] !== before[table]) {
      throw new Error(`${table} row count changed during repair: before=${before[table]} after=${after[table]}`);
    }
  }
}

async function verifyScalarColumns(db) {
  const customer = await getColumnMetadata(db, 'Customer');
  const staff = await getColumnMetadata(db, 'Staff');

  const checks = [
    ['Customer.referralCode', customer.get('referralCode'), 'text', "''"],
    ['Customer.referredBy', customer.get('referredBy'), 'text', "''"],
    ['Staff.weeklySchedule', staff.get('weeklySchedule'), 'text', "'[]'"],
    ['Staff.totalHours', staff.get('totalHours'), 'real', '0'],
  ];

  for (const [name, actual, type, defaultToken] of checks) {
    if (!actual || actual.data_type !== type || actual.is_nullable !== 'NO') {
      throw new Error(`${name} verification failed`);
    }
    if (!String(actual.column_default || '').includes(defaultToken)) {
      throw new Error(`${name} default verification failed: ${actual.column_default || 'none'}`);
    }
  }
}

async function verifyRequiredObjects(db, expectedFkState, rowCountsBefore) {
  await verifyScalarColumns(db);
  const supplierMetadata = await getColumnMetadata(db, 'Supplier');
  assertSupplierShape(supplierMetadata, 'Supplier');
  await ensurePrimaryKey(db);
  for (const spec of REQUIRED_INDEXES) assertIndex(await getIndex(db, spec.name), spec);

  const fk = await getForeignKey(db);
  assertForeignKey(fk);
  const orphanCount = await countSupplierOrphans(db);
  if (orphanCount !== expectedFkState.orphanCount) {
    throw new Error(
      `Supplier orphan count changed during repair: before=${expectedFkState.orphanCount.toString()} after=${orphanCount.toString()}`
    );
  }
  if (Boolean(fk.convalidated) !== expectedFkState.validated) {
    throw new Error('Supplier FK validation state changed unexpectedly after verification');
  }

  await assertRowCountsUnchanged(db, rowCountsBefore);
  console.log('[reco-repair] ✓ Customer/Staff columns, Supplier shape, indexes, PK, FK and row counts verified');
}

function resolveApplied() {
  console.log(`[reco-repair] Resolving failed migration as applied: ${MIGRATION_NAME}`);
  execFileSync(
    'node_modules/.bin/prisma',
    ['migrate', 'resolve', '--applied', MIGRATION_NAME],
    { stdio: 'inherit', env: process.env }
  );
}

async function main() {
  if (!isPostgres()) {
    console.log('[reco-repair] Non-PostgreSQL provider; nothing to do.');
    return;
  }

  const db = new PrismaClient();
  try {
    const state = await getMigrationState(db);
    if (!state) {
      console.log('[reco-repair] Migration not recorded; prisma migrate deploy will apply it normally.');
      return;
    }

    const finished = state.finished_at !== null;
    const rolledBack = state.rolled_back_at !== null;
    console.log(
      `[reco-repair] Migration state: finished=${finished}, rolledBack=${rolledBack}, startedAt=${state.started_at?.toISOString?.() || state.started_at}`
    );

    if (finished && !rolledBack) {
      console.log('[reco-repair] ✓ Migration already applied. Nothing to repair.');
      return;
    }
    if (rolledBack) {
      console.log('[reco-repair] Migration is marked rolled back; migrate deploy will retry it normally.');
      return;
    }

    console.log('[reco-repair] Failed migration detected. Verifying/completing only its historical objects...');
    const rowCountsBefore = await captureRowCounts(db);
    await ensureHistoricalScalarColumns(db);
    await ensureSupplierShape(db);
    await ensurePrimaryKey(db);
    await ensureIndexes(db);
    const fkState = await ensureForeignKey(db);
    await verifyRequiredObjects(db, fkState, rowCountsBefore);

    resolveApplied();

    const after = await getMigrationState(db);
    if (!after || after.finished_at === null || after.rolled_back_at !== null) {
      throw new Error('Prisma resolve completed but migration history is not in applied state');
    }

    console.log('[reco-repair] ✓ Failed Reco 11-15 migration recovered safely. No business rows were deleted or rewritten.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error('[reco-repair] FATAL:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
