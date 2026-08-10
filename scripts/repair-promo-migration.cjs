#!/usr/bin/env node
/**
 * repair-promo-migration.cjs
 *
 * Targeted production recovery for the historical failed migration:
 *   20260713040000_add_promo_codes
 *
 * Safety model:
 * - PostgreSQL only.
 * - Never resolves any other migration.
 * - Never drops tables, columns, indexes, constraints, or data.
 * - Never uses prisma db push / migrate reset / --accept-data-loss.
 * - If the migration is failed, ensure only the objects declared by the
 *   historical migration, verify them, then use Prisma's official
 *   `migrate resolve --applied` command.
 * - If ownership/shape cannot be proven, fail closed and leave P3009 intact.
 */

const { PrismaClient } = require('@prisma/client');
const { execFileSync } = require('child_process');

const MIGRATION_NAME = '20260713040000_add_promo_codes';

const EXPECTED_COLUMNS = {
  id: { type: 'text', nullable: 'NO' },
  code: { type: 'text', nullable: 'NO' },
  description: { type: 'text', nullable: 'NO' },
  discountType: { type: 'text', nullable: 'NO' },
  discountValue: { type: 'bigint', nullable: 'NO' },
  minOrderTotal: { type: 'bigint', nullable: 'NO' },
  maxUses: { type: 'integer', nullable: 'NO' },
  usedCount: { type: 'integer', nullable: 'NO' },
  maxUsesPerUser: { type: 'integer', nullable: 'NO' },
  active: { type: 'boolean', nullable: 'NO' },
  startsAt: { type: 'timestamp without time zone', nullable: 'YES' },
  expiresAt: { type: 'timestamp without time zone', nullable: 'YES' },
  restaurantId: { type: 'text', nullable: 'NO' },
  createdAt: { type: 'timestamp without time zone', nullable: 'NO' },
  updatedAt: { type: 'timestamp without time zone', nullable: 'NO' },
};

const REQUIRED_INDEXES = [
  'PromoCode_restaurantId_code_key',
  'PromoCode_restaurantId_active_idx',
  'PromoCode_code_idx',
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

async function tableExists(db) {
  const rows = await db.$queryRawUnsafe(`
    SELECT to_regclass('public."PromoCode"') IS NOT NULL AS exists
  `);
  return Boolean(rows[0]?.exists);
}

async function getColumnMetadata(db) {
  const rows = await db.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'PromoCode'
  `);
  return new Map(rows.map((row) => [row.column_name, row]));
}

async function getExistingColumns(db) {
  return new Set((await getColumnMetadata(db)).keys());
}

async function ensurePromoTable(db) {
  const exists = await tableExists(db);

  if (!exists) {
    console.log('[promo-repair] PromoCode table is missing; creating the exact historical shape...');
    await db.$executeRawUnsafe(`
      CREATE TABLE "PromoCode" (
        "id"              TEXT NOT NULL,
        "code"            TEXT NOT NULL,
        "description"     TEXT NOT NULL DEFAULT '',
        "discountType"    TEXT NOT NULL DEFAULT 'percent',
        "discountValue"   BIGINT NOT NULL DEFAULT 0,
        "minOrderTotal"   BIGINT NOT NULL DEFAULT 0,
        "maxUses"         INTEGER NOT NULL DEFAULT 0,
        "usedCount"       INTEGER NOT NULL DEFAULT 0,
        "maxUsesPerUser"  INTEGER NOT NULL DEFAULT 1,
        "active"          BOOLEAN NOT NULL DEFAULT true,
        "startsAt"        TIMESTAMP(3),
        "expiresAt"       TIMESTAMP(3),
        "restaurantId"    TEXT NOT NULL,
        "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"       TIMESTAMP(3) NOT NULL,
        CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
      )
    `);
    return;
  }

  const columns = await getExistingColumns(db);

  // Never invent business identity / tenant ownership values for existing rows.
  // If any of these are missing, manual review is required.
  for (const column of ['id', 'code', 'restaurantId']) {
    if (!columns.has(column)) {
      throw new Error(
        `Existing PromoCode table is missing critical column ${column}; refusing automatic repair`
      );
    }
  }

  const safeAdds = [
    ['description', `ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT ''`],
    ['discountType', `ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "discountType" TEXT NOT NULL DEFAULT 'percent'`],
    ['discountValue', `ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "discountValue" BIGINT NOT NULL DEFAULT 0`],
    ['minOrderTotal', `ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "minOrderTotal" BIGINT NOT NULL DEFAULT 0`],
    ['maxUses', `ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "maxUses" INTEGER NOT NULL DEFAULT 0`],
    ['usedCount', `ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "usedCount" INTEGER NOT NULL DEFAULT 0`],
    ['maxUsesPerUser', `ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "maxUsesPerUser" INTEGER NOT NULL DEFAULT 1`],
    ['active', `ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true`],
    ['startsAt', `ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3)`],
    ['expiresAt', `ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3)`],
  ];

  for (const [column, sql] of safeAdds) {
    if (!columns.has(column)) {
      console.log(`[promo-repair] Ensuring missing column PromoCode.${column}`);
      await db.$executeRawUnsafe(sql);
    }
  }

  if (!columns.has('createdAt')) {
    console.log('[promo-repair] Ensuring missing column PromoCode.createdAt');
    await db.$executeRawUnsafe(`ALTER TABLE "PromoCode" ADD COLUMN "createdAt" TIMESTAMP(3)`);
    await db.$executeRawUnsafe(`UPDATE "PromoCode" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL`);
    await db.$executeRawUnsafe(`ALTER TABLE "PromoCode" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP`);
    await db.$executeRawUnsafe(`ALTER TABLE "PromoCode" ALTER COLUMN "createdAt" SET NOT NULL`);
  }

  if (!columns.has('updatedAt')) {
    console.log('[promo-repair] Ensuring missing column PromoCode.updatedAt');
    await db.$executeRawUnsafe(`ALTER TABLE "PromoCode" ADD COLUMN "updatedAt" TIMESTAMP(3)`);
    await db.$executeRawUnsafe(`UPDATE "PromoCode" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL`);
    await db.$executeRawUnsafe(`ALTER TABLE "PromoCode" ALTER COLUMN "updatedAt" SET NOT NULL`);
  }

  // The historical migration requires a primary key on id. If a table existed
  // before the migration, create the PK only when no PK is already defined.
  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = '"PromoCode"'::regclass
          AND contype = 'p'
      ) THEN
        ALTER TABLE "PromoCode"
          ADD CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id");
      END IF;
    END $$
  `);
}

async function ensureIndexesAndForeignKey(db) {
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "PromoCode_restaurantId_code_key"
      ON "PromoCode"("restaurantId", "code")
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PromoCode_restaurantId_active_idx"
      ON "PromoCode"("restaurantId", "active")
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PromoCode_code_idx"
      ON "PromoCode"("code")
  `);

  // If the historical failure happened because the FK already existed, this
  // guard avoids repeating the same error. If orphan data prevents creating
  // the FK, PostgreSQL throws and the repair fails closed without deleting rows.
  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = '"PromoCode"'::regclass
          AND conname = 'PromoCode_restaurantId_fkey'
          AND contype = 'f'
      ) THEN
        ALTER TABLE "PromoCode"
          ADD CONSTRAINT "PromoCode_restaurantId_fkey"
          FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
          ON DELETE CASCADE;
      END IF;
    END $$
  `);
}

async function verifyExactObjects(db) {
  if (!(await tableExists(db))) {
    throw new Error('PromoCode table is still missing after repair');
  }

  const metadata = await getColumnMetadata(db);
  const missingColumns = Object.keys(EXPECTED_COLUMNS).filter((column) => !metadata.has(column));
  if (missingColumns.length > 0) {
    throw new Error(`PromoCode missing required columns: ${missingColumns.join(', ')}`);
  }

  const shapeErrors = [];
  for (const [column, expected] of Object.entries(EXPECTED_COLUMNS)) {
    const actual = metadata.get(column);
    if (actual.data_type !== expected.type || actual.is_nullable !== expected.nullable) {
      shapeErrors.push(
        `${column}: expected ${expected.type}/${expected.nullable}, got ${actual.data_type}/${actual.is_nullable}`
      );
    }
  }
  if (shapeErrors.length > 0) {
    throw new Error(`PromoCode column shape mismatch: ${shapeErrors.join('; ')}`);
  }

  const indexRows = await db.$queryRawUnsafe(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'PromoCode'
  `);
  const indexes = new Set(indexRows.map((row) => row.indexname));
  const missingIndexes = REQUIRED_INDEXES.filter((index) => !indexes.has(index));
  if (missingIndexes.length > 0) {
    throw new Error(`PromoCode missing required indexes: ${missingIndexes.join(', ')}`);
  }

  const pkRows = await db.$queryRawUnsafe(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = '"PromoCode"'::regclass
      AND contype = 'p'
  `);
  if (pkRows.length !== 1) {
    throw new Error(`PromoCode primary-key verification failed (found ${pkRows.length})`);
  }

  const fkRows = await db.$queryRawUnsafe(`
    SELECT
      c.conname,
      pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    WHERE c.conrelid = '"PromoCode"'::regclass
      AND c.conname = 'PromoCode_restaurantId_fkey'
      AND c.contype = 'f'
  `);

  if (fkRows.length !== 1) {
    throw new Error('PromoCode_restaurantId_fkey is missing');
  }

  const definition = String(fkRows[0].definition || '');
  if (
    !definition.includes('FOREIGN KEY ("restaurantId")') ||
    !definition.includes('REFERENCES "Restaurant"(id)') ||
    !definition.includes('ON DELETE CASCADE')
  ) {
    throw new Error(`Unexpected PromoCode_restaurantId_fkey definition: ${definition}`);
  }

  console.log('[promo-repair] ✓ PromoCode table, columns, indexes, PK and FK verified');
}

function resolveApplied() {
  console.log(`[promo-repair] Resolving failed migration as applied: ${MIGRATION_NAME}`);
  execFileSync(
    'node_modules/.bin/prisma',
    ['migrate', 'resolve', '--applied', MIGRATION_NAME],
    { stdio: 'inherit', env: process.env }
  );
}

async function main() {
  if (!isPostgres()) {
    console.log('[promo-repair] Non-PostgreSQL provider; nothing to do.');
    return;
  }

  const db = new PrismaClient();

  try {
    const state = await getMigrationState(db);

    if (!state) {
      console.log('[promo-repair] Migration not recorded; prisma migrate deploy will apply it normally.');
      return;
    }

    const finished = state.finished_at !== null;
    const rolledBack = state.rolled_back_at !== null;

    console.log(
      `[promo-repair] Migration state: finished=${finished}, rolledBack=${rolledBack}, startedAt=${state.started_at?.toISOString?.() || state.started_at}`
    );

    if (finished && !rolledBack) {
      console.log('[promo-repair] ✓ Migration already applied. Nothing to repair.');
      return;
    }

    if (rolledBack) {
      console.log('[promo-repair] Migration is already marked rolled back; migrate deploy will retry it.');
      return;
    }

    console.log('[promo-repair] Failed migration detected. Verifying/completing only its declared objects...');
    await ensurePromoTable(db);
    await ensureIndexesAndForeignKey(db);
    await verifyExactObjects(db);

    resolveApplied();

    const after = await getMigrationState(db);
    if (!after || after.finished_at === null || after.rolled_back_at !== null) {
      throw new Error('Prisma resolve completed but migration history is not in applied state');
    }

    console.log('[promo-repair] ✓ Failed promo migration recovered safely.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error('[promo-repair] FATAL:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
