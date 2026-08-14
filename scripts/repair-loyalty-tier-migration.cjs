#!/usr/bin/env node
/**
 * repair-loyalty-tier-migration.cjs
 *
 * Targeted production recovery for the historical failed migration:
 *   20260713060000_add_loyalty_tiers
 *
 * Safety model:
 * - PostgreSQL only.
 * - Never resolves any other migration.
 * - Never drops tables, columns, indexes, constraints, or business data.
 * - If the migration is failed, verify/complete only the objects declared by
 *   that historical migration, then use Prisma's official
 *   `migrate resolve --applied` command.
 * - Existing LoyaltyTier tables must already expose the exact required
 *   data-bearing column shape before this script creates missing metadata.
 * - Customer.tier may be added only with the exact historical deterministic
 *   default ('bronze'); existing values are never rewritten.
 * - Historical orphan LoyaltyTier rows are preserved. If they prevent
 *   retroactive FK validation, the FK is added/kept NOT VALID so PostgreSQL
 *   still enforces it for future inserts/updates without deleting history.
 * - If the expected shape cannot be proven, fail closed and leave P3009 intact.
 */

const { PrismaClient } = require('@prisma/client');
const { execFileSync } = require('child_process');

const MIGRATION_NAME = '20260713060000_add_loyalty_tiers';

const EXPECTED_LOYALTY_COLUMNS = {
  id: { type: 'text', nullable: 'NO' },
  restaurantId: { type: 'text', nullable: 'NO' },
  name: { type: 'text', nullable: 'NO' },
  label: { type: 'text', nullable: 'NO' },
  minSpent: { type: 'bigint', nullable: 'NO' },
  discountPercent: { type: 'integer', nullable: 'NO' },
  freeDelivery: { type: 'boolean', nullable: 'NO' },
  freeDish: { type: 'boolean', nullable: 'NO' },
  color: { type: 'text', nullable: 'NO' },
  icon: { type: 'text', nullable: 'NO' },
  active: { type: 'boolean', nullable: 'NO' },
  createdAt: { type: 'timestamp without time zone', nullable: 'NO' },
  updatedAt: { type: 'timestamp without time zone', nullable: 'NO' },
};

const REQUIRED_INDEXES = [
  {
    table: 'LoyaltyTier',
    name: 'LoyaltyTier_restaurantId_name_key',
    unique: true,
    columns: ['restaurantId', 'name'],
  },
  {
    table: 'LoyaltyTier',
    name: 'LoyaltyTier_restaurantId_active_idx',
    unique: false,
    columns: ['restaurantId', 'active'],
  },
  {
    table: 'Customer',
    name: 'Customer_tier_idx',
    unique: false,
    columns: ['tier'],
  },
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

function assertRequiredLoyaltyColumnShape(metadata, context) {
  const missingColumns = Object.keys(EXPECTED_LOYALTY_COLUMNS).filter((column) => !metadata.has(column));
  if (missingColumns.length > 0) {
    throw new Error(
      `${context} is missing required columns (${missingColumns.join(', ')}); refusing to invent LoyaltyTier data-bearing fields`
    );
  }

  const shapeErrors = [];
  for (const [column, expected] of Object.entries(EXPECTED_LOYALTY_COLUMNS)) {
    const actual = metadata.get(column);
    if (actual.data_type !== expected.type || actual.is_nullable !== expected.nullable) {
      shapeErrors.push(
        `${column}: expected ${expected.type}/${expected.nullable}, got ${actual.data_type}/${actual.is_nullable}`
      );
    }
  }

  if (shapeErrors.length > 0) {
    throw new Error(`${context} column shape mismatch: ${shapeErrors.join('; ')}`);
  }
}

async function createHistoricalTable(db) {
  console.log('[loyalty-repair] LoyaltyTier table is missing; creating the exact historical shape...');
  await db.$executeRawUnsafe(`
    CREATE TABLE "LoyaltyTier" (
      "id"              TEXT NOT NULL,
      "restaurantId"    TEXT NOT NULL,
      "name"            TEXT NOT NULL,
      "label"           TEXT NOT NULL DEFAULT '',
      "minSpent"        BIGINT NOT NULL DEFAULT 0,
      "discountPercent" INTEGER NOT NULL DEFAULT 0,
      "freeDelivery"    BOOLEAN NOT NULL DEFAULT false,
      "freeDish"        BOOLEAN NOT NULL DEFAULT false,
      "color"           TEXT NOT NULL DEFAULT '#cd7f32',
      "icon"            TEXT NOT NULL DEFAULT '',
      "active"          BOOLEAN NOT NULL DEFAULT true,
      "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"       TIMESTAMP(3) NOT NULL,
      CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
    )
  `);
}

async function ensurePrimaryKey(db) {
  const rows = await db.$queryRawUnsafe(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = '"LoyaltyTier"'::regclass
      AND contype = 'p'
  `);

  if (rows.length === 0) {
    await db.$executeRawUnsafe(`
      ALTER TABLE "LoyaltyTier"
        ADD CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
    `);
    return;
  }

  if (rows.length !== 1 || rows[0].conname !== 'LoyaltyTier_pkey') {
    throw new Error(
      `LoyaltyTier has unexpected primary-key constraint(s): ${rows.map((row) => row.conname).join(', ')}`
    );
  }

  const normalized = String(rows[0].definition || '').replace(/"/g, '');
  if (!normalized.includes('PRIMARY KEY (id)')) {
    throw new Error(`Unexpected LoyaltyTier_pkey definition: ${rows[0].definition}`);
  }
}

async function getIndexState(db, table, name) {
  const rows = await db.$queryRawUnsafe(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = $1
       AND indexname = $2`,
    table,
    name
  );
  return rows[0] || null;
}

function assertExpectedIndex(index, spec) {
  if (!index) {
    throw new Error(`${spec.name} is missing`);
  }

  const normalized = String(index.indexdef || '').replace(/"/g, '');
  const isUnique = /CREATE\s+UNIQUE\s+INDEX/i.test(normalized);
  if (isUnique !== spec.unique) {
    throw new Error(`${spec.name} uniqueness mismatch: ${index.indexdef}`);
  }

  const expectedColumns = `(${spec.columns.join(', ')})`;
  if (!normalized.includes(expectedColumns)) {
    throw new Error(`${spec.name} column definition mismatch: ${index.indexdef}`);
  }
}

async function ensureIndexes(db) {
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyTier_restaurantId_name_key"
      ON "LoyaltyTier"("restaurantId", "name")
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LoyaltyTier_restaurantId_active_idx"
      ON "LoyaltyTier"("restaurantId", "active")
  `);

  for (const spec of REQUIRED_INDEXES.filter((item) => item.table === 'LoyaltyTier')) {
    const index = await getIndexState(db, spec.table, spec.name);
    assertExpectedIndex(index, spec);
  }
}

async function countOrphanTiers(db) {
  const rows = await db.$queryRawUnsafe(`
    SELECT COUNT(*)::text AS count
    FROM "LoyaltyTier" lt
    LEFT JOIN "Restaurant" r ON r."id" = lt."restaurantId"
    WHERE r."id" IS NULL
  `);
  return BigInt(rows[0]?.count || '0');
}

async function getForeignKeyState(db) {
  const rows = await db.$queryRawUnsafe(`
    SELECT
      c.conname,
      c.convalidated,
      pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    WHERE c.conrelid = '"LoyaltyTier"'::regclass
      AND c.conname = 'LoyaltyTier_restaurantId_fkey'
      AND c.contype = 'f'
  `);
  return rows[0] || null;
}

function assertExpectedForeignKey(fk) {
  if (!fk) {
    throw new Error('LoyaltyTier_restaurantId_fkey is missing');
  }

  const definition = String(fk.definition || '');
  if (
    !definition.includes('FOREIGN KEY ("restaurantId")') ||
    !definition.includes('REFERENCES "Restaurant"(id)') ||
    !definition.includes('ON DELETE CASCADE')
  ) {
    throw new Error(`Unexpected LoyaltyTier_restaurantId_fkey definition: ${definition}`);
  }
}

async function ensureForeignKey(db) {
  const orphanCount = await countOrphanTiers(db);
  let fk = await getForeignKeyState(db);

  if (fk) {
    assertExpectedForeignKey(fk);
  } else if (orphanCount > 0n) {
    console.warn(
      `[loyalty-repair] ⚠ Found ${orphanCount.toString()} historical LoyaltyTier row(s) with no matching Restaurant. ` +
        'Preserving them and adding the FK as NOT VALID; future inserts/updates remain enforced.'
    );
    await db.$executeRawUnsafe(`
      ALTER TABLE "LoyaltyTier"
        ADD CONSTRAINT "LoyaltyTier_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
        ON DELETE CASCADE
        NOT VALID
    `);
    fk = await getForeignKeyState(db);
  } else {
    await db.$executeRawUnsafe(`
      ALTER TABLE "LoyaltyTier"
        ADD CONSTRAINT "LoyaltyTier_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
        ON DELETE CASCADE
    `);
    fk = await getForeignKeyState(db);
  }

  assertExpectedForeignKey(fk);

  if (!fk.convalidated && orphanCount === 0n) {
    console.log('[loyalty-repair] No orphan LoyaltyTier rows remain; validating foreign key...');
    await db.$executeRawUnsafe(`
      ALTER TABLE "LoyaltyTier"
        VALIDATE CONSTRAINT "LoyaltyTier_restaurantId_fkey"
    `);
    fk = await getForeignKeyState(db);
    assertExpectedForeignKey(fk);
  }

  if (!fk.convalidated && orphanCount > 0n) {
    console.warn(
      `[loyalty-repair] ⚠ LoyaltyTier_restaurantId_fkey remains NOT VALID because ${orphanCount.toString()} ` +
        'historical orphan row(s) exist. No data was deleted or rewritten.'
    );
  }

  return { orphanCount, validated: Boolean(fk.convalidated) };
}

async function ensureCustomerTier(db) {
  if (!(await tableExists(db, 'Customer'))) {
    throw new Error('Customer table is missing; refusing LoyaltyTier migration recovery');
  }

  let metadata = await getColumnMetadata(db, 'Customer');
  let tier = metadata.get('tier');

  if (!tier) {
    console.log("[loyalty-repair] Customer.tier is missing; adding exact historical TEXT NOT NULL DEFAULT 'bronze' column...");
    await db.$executeRawUnsafe(`
      ALTER TABLE "Customer"
        ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'bronze'
    `);
    metadata = await getColumnMetadata(db, 'Customer');
    tier = metadata.get('tier');
  }

  if (!tier || tier.data_type !== 'text' || tier.is_nullable !== 'NO') {
    throw new Error(
      `Customer.tier shape mismatch: expected text/NO, got ${tier?.data_type || 'missing'}/${tier?.is_nullable || 'missing'}`
    );
  }

  const defaultValue = String(tier.column_default || '');
  if (!defaultValue.includes("'bronze'")) {
    throw new Error(`Customer.tier default mismatch: expected bronze, got ${defaultValue || 'none'}`);
  }

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Customer_tier_idx" ON "Customer"("tier")
  `);

  const spec = REQUIRED_INDEXES.find((item) => item.name === 'Customer_tier_idx');
  const index = await getIndexState(db, spec.table, spec.name);
  assertExpectedIndex(index, spec);
}

async function ensureHistoricalObjects(db) {
  if (!(await tableExists(db, 'LoyaltyTier'))) {
    await createHistoricalTable(db);
  } else {
    const metadata = await getColumnMetadata(db, 'LoyaltyTier');
    assertRequiredLoyaltyColumnShape(metadata, 'Existing LoyaltyTier table');
  }

  await ensurePrimaryKey(db);
  await ensureIndexes(db);
  const fkState = await ensureForeignKey(db);
  await ensureCustomerTier(db);
  return fkState;
}

async function verifyRequiredObjects(db, expectedFkState) {
  if (!(await tableExists(db, 'LoyaltyTier'))) {
    throw new Error('LoyaltyTier table is still missing after repair');
  }

  const metadata = await getColumnMetadata(db, 'LoyaltyTier');
  assertRequiredLoyaltyColumnShape(metadata, 'LoyaltyTier');
  await ensurePrimaryKey(db);

  for (const spec of REQUIRED_INDEXES) {
    const index = await getIndexState(db, spec.table, spec.name);
    assertExpectedIndex(index, spec);
  }

  const fk = await getForeignKeyState(db);
  assertExpectedForeignKey(fk);

  const orphanCount = await countOrphanTiers(db);
  if (orphanCount !== expectedFkState.orphanCount) {
    throw new Error(
      `LoyaltyTier orphan count changed during repair: before=${expectedFkState.orphanCount.toString()} ` +
        `after=${orphanCount.toString()}`
    );
  }

  if (orphanCount === 0n && !fk.convalidated) {
    throw new Error('LoyaltyTier foreign key is unexpectedly NOT VALID with no orphan rows');
  }

  if (orphanCount > 0n && fk.convalidated) {
    throw new Error('LoyaltyTier foreign key cannot be validated while historical orphan rows exist');
  }

  const customerMetadata = await getColumnMetadata(db, 'Customer');
  const tier = customerMetadata.get('tier');
  if (!tier || tier.data_type !== 'text' || tier.is_nullable !== 'NO') {
    throw new Error('Customer.tier verification failed after recovery');
  }
  if (!String(tier.column_default || '').includes("'bronze'")) {
    throw new Error(`Customer.tier default verification failed: ${tier.column_default || 'none'}`);
  }

  console.log(
    `[loyalty-repair] ✓ LoyaltyTier table, columns, indexes, PK, FK and Customer.tier verified ` +
      `(fkValidated=${Boolean(fk.convalidated)}, historicalOrphans=${orphanCount.toString()})`
  );
}

function resolveApplied() {
  console.log(`[loyalty-repair] Resolving failed migration as applied: ${MIGRATION_NAME}`);
  execFileSync(
    'node_modules/.bin/prisma',
    ['migrate', 'resolve', '--applied', MIGRATION_NAME],
    { stdio: 'inherit', env: process.env }
  );
}

async function main() {
  if (!isPostgres()) {
    console.log('[loyalty-repair] Non-PostgreSQL provider; nothing to do.');
    return;
  }

  const db = new PrismaClient();

  try {
    const state = await getMigrationState(db);

    if (!state) {
      console.log('[loyalty-repair] Migration not recorded; prisma migrate deploy will apply it normally.');
      return;
    }

    const finished = state.finished_at !== null;
    const rolledBack = state.rolled_back_at !== null;

    console.log(
      `[loyalty-repair] Migration state: finished=${finished}, rolledBack=${rolledBack}, startedAt=${state.started_at?.toISOString?.() || state.started_at}`
    );

    if (finished && !rolledBack) {
      console.log('[loyalty-repair] ✓ Migration already applied. Nothing to repair.');
      return;
    }

    if (rolledBack) {
      console.log('[loyalty-repair] Migration is already marked rolled back; migrate deploy will retry it.');
      return;
    }

    console.log('[loyalty-repair] Failed migration detected. Verifying/completing only its declared objects...');
    const fkState = await ensureHistoricalObjects(db);
    await verifyRequiredObjects(db, fkState);

    resolveApplied();

    const after = await getMigrationState(db);
    if (!after || after.finished_at === null || after.rolled_back_at !== null) {
      throw new Error('Prisma resolve completed but migration history is not in applied state');
    }

    console.log('[loyalty-repair] ✓ Failed LoyaltyTier migration recovered safely.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error('[loyalty-repair] FATAL:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
