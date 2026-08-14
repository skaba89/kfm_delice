#!/usr/bin/env node
/**
 * repair-chat-message-migration.cjs
 *
 * Targeted production recovery for the historical failed migration:
 *   20260713050000_add_chat_messages
 *
 * Safety model:
 * - PostgreSQL only.
 * - Never resolves any other migration.
 * - Never drops tables, columns, indexes, constraints, or data.
 * - If the migration is failed, verify/complete only the objects declared by
 *   the historical migration, then use Prisma's official
 *   `migrate resolve --applied` command.
 * - Existing tables must already expose the exact required data-bearing
 *   column shape before this script creates any missing index/constraint.
 * - Historical orphan ChatMessage rows are preserved. When they prevent
 *   retroactive FK validation, the FK is added NOT VALID so PostgreSQL still
 *   enforces it for new/updated rows without deleting or rewriting history.
 * - The repair never invents sender/content/tenant values for existing rows.
 * - If the expected shape cannot be proven, fail closed and leave P3009 intact.
 */

const { PrismaClient } = require('@prisma/client');
const { execFileSync } = require('child_process');

const MIGRATION_NAME = '20260713050000_add_chat_messages';

const EXPECTED_COLUMNS = {
  id: { type: 'text', nullable: 'NO' },
  restaurantId: { type: 'text', nullable: 'NO' },
  senderId: { type: 'text', nullable: 'NO' },
  senderName: { type: 'text', nullable: 'NO' },
  senderRole: { type: 'text', nullable: 'NO' },
  content: { type: 'text', nullable: 'NO' },
  createdAt: { type: 'timestamp without time zone', nullable: 'NO' },
};

const REQUIRED_INDEXES = [
  'ChatMessage_restaurantId_createdAt_idx',
  'ChatMessage_restaurantId_idx',
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
    SELECT to_regclass('public."ChatMessage"') IS NOT NULL AS exists
  `);
  return Boolean(rows[0]?.exists);
}

async function getColumnMetadata(db) {
  const rows = await db.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ChatMessage'
  `);
  return new Map(rows.map((row) => [row.column_name, row]));
}

function assertRequiredColumnShape(metadata, context) {
  const missingColumns = Object.keys(EXPECTED_COLUMNS).filter((column) => !metadata.has(column));
  if (missingColumns.length > 0) {
    throw new Error(
      `${context} is missing required columns (${missingColumns.join(', ')}); refusing to invent data-bearing fields`
    );
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
    throw new Error(`${context} column shape mismatch: ${shapeErrors.join('; ')}`);
  }
}

async function createHistoricalTable(db) {
  console.log('[chat-repair] ChatMessage table is missing; creating the exact historical shape...');
  await db.$executeRawUnsafe(`
    CREATE TABLE "ChatMessage" (
      "id"            TEXT NOT NULL,
      "restaurantId"  TEXT NOT NULL,
      "senderId"      TEXT NOT NULL,
      "senderName"    TEXT NOT NULL,
      "senderRole"    TEXT NOT NULL,
      "content"       TEXT NOT NULL,
      "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
    )
  `);
}

async function countOrphanMessages(db) {
  const rows = await db.$queryRawUnsafe(`
    SELECT COUNT(*)::text AS count
    FROM "ChatMessage" cm
    LEFT JOIN "Restaurant" r ON r."id" = cm."restaurantId"
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
    WHERE c.conrelid = '"ChatMessage"'::regclass
      AND c.conname = 'ChatMessage_restaurantId_fkey'
      AND c.contype = 'f'
  `);
  return rows[0] || null;
}

function assertExpectedForeignKey(fk) {
  if (!fk) {
    throw new Error('ChatMessage_restaurantId_fkey is missing');
  }

  const definition = String(fk.definition || '');
  if (
    !definition.includes('FOREIGN KEY ("restaurantId")') ||
    !definition.includes('REFERENCES "Restaurant"(id)') ||
    !definition.includes('ON DELETE CASCADE')
  ) {
    throw new Error(`Unexpected ChatMessage_restaurantId_fkey definition: ${definition}`);
  }
}

async function ensureForeignKey(db) {
  const orphanCount = await countOrphanMessages(db);
  let fk = await getForeignKeyState(db);

  if (fk) {
    assertExpectedForeignKey(fk);
  } else if (orphanCount > 0n) {
    console.warn(
      `[chat-repair] ⚠ Found ${orphanCount.toString()} historical ChatMessage row(s) with no matching Restaurant. ` +
        'Preserving them and adding the FK as NOT VALID; future inserts/updates remain enforced.'
    );
    await db.$executeRawUnsafe(`
      ALTER TABLE "ChatMessage"
        ADD CONSTRAINT "ChatMessage_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
        ON DELETE CASCADE
        NOT VALID
    `);
    fk = await getForeignKeyState(db);
  } else {
    await db.$executeRawUnsafe(`
      ALTER TABLE "ChatMessage"
        ADD CONSTRAINT "ChatMessage_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
        ON DELETE CASCADE
    `);
    fk = await getForeignKeyState(db);
  }

  assertExpectedForeignKey(fk);

  if (!fk.convalidated && orphanCount === 0n) {
    console.log('[chat-repair] No orphan ChatMessage rows remain; validating foreign key...');
    await db.$executeRawUnsafe(`
      ALTER TABLE "ChatMessage"
        VALIDATE CONSTRAINT "ChatMessage_restaurantId_fkey"
    `);
    fk = await getForeignKeyState(db);
    assertExpectedForeignKey(fk);
  }

  if (!fk.convalidated && orphanCount > 0n) {
    console.warn(
      `[chat-repair] ⚠ ChatMessage_restaurantId_fkey remains NOT VALID because ${orphanCount.toString()} ` +
        'historical orphan row(s) exist. No data was deleted or rewritten.'
    );
  }

  return { orphanCount, validated: Boolean(fk.convalidated) };
}

async function ensureHistoricalObjects(db) {
  if (!(await tableExists(db))) {
    await createHistoricalTable(db);
  } else {
    const metadata = await getColumnMetadata(db);
    assertRequiredColumnShape(metadata, 'Existing ChatMessage table');
  }

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ChatMessage_restaurantId_createdAt_idx"
      ON "ChatMessage"("restaurantId", "createdAt")
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ChatMessage_restaurantId_idx"
      ON "ChatMessage"("restaurantId")
  `);

  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = '"ChatMessage"'::regclass
          AND conname = 'ChatMessage_pkey'
          AND contype = 'p'
      ) THEN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = '"ChatMessage"'::regclass
            AND contype = 'p'
        ) THEN
          RAISE EXCEPTION 'ChatMessage has an unexpected primary-key constraint';
        END IF;
        ALTER TABLE "ChatMessage"
          ADD CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id");
      END IF;
    END $$
  `);

  return ensureForeignKey(db);
}

async function verifyRequiredObjects(db, expectedFkState) {
  if (!(await tableExists(db))) {
    throw new Error('ChatMessage table is still missing after repair');
  }

  const metadata = await getColumnMetadata(db);
  assertRequiredColumnShape(metadata, 'ChatMessage');

  const indexRows = await db.$queryRawUnsafe(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ChatMessage'
  `);
  const indexes = new Set(indexRows.map((row) => row.indexname));
  const missingIndexes = REQUIRED_INDEXES.filter((index) => !indexes.has(index));
  if (missingIndexes.length > 0) {
    throw new Error(`ChatMessage missing required indexes: ${missingIndexes.join(', ')}`);
  }

  const pkRows = await db.$queryRawUnsafe(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = '"ChatMessage"'::regclass
      AND contype = 'p'
  `);
  if (pkRows.length !== 1 || pkRows[0].conname !== 'ChatMessage_pkey') {
    throw new Error(
      `ChatMessage primary-key verification failed (${pkRows.map((row) => row.conname).join(', ') || 'none'})`
    );
  }

  const fk = await getForeignKeyState(db);
  assertExpectedForeignKey(fk);

  const orphanCount = await countOrphanMessages(db);
  if (orphanCount !== expectedFkState.orphanCount) {
    throw new Error(
      `ChatMessage orphan count changed during repair: before=${expectedFkState.orphanCount.toString()} ` +
        `after=${orphanCount.toString()}`
    );
  }

  if (orphanCount === 0n && !fk.convalidated) {
    throw new Error('ChatMessage foreign key is unexpectedly NOT VALID with no orphan rows');
  }

  if (orphanCount > 0n && fk.convalidated) {
    throw new Error('ChatMessage foreign key cannot be validated while historical orphan rows exist');
  }

  console.log(
    `[chat-repair] ✓ ChatMessage table, columns, indexes, PK and FK verified ` +
      `(fkValidated=${Boolean(fk.convalidated)}, historicalOrphans=${orphanCount.toString()})`
  );
}

function resolveApplied() {
  console.log(`[chat-repair] Resolving failed migration as applied: ${MIGRATION_NAME}`);
  execFileSync(
    'node_modules/.bin/prisma',
    ['migrate', 'resolve', '--applied', MIGRATION_NAME],
    { stdio: 'inherit', env: process.env }
  );
}

async function main() {
  if (!isPostgres()) {
    console.log('[chat-repair] Non-PostgreSQL provider; nothing to do.');
    return;
  }

  const db = new PrismaClient();

  try {
    const state = await getMigrationState(db);

    if (!state) {
      console.log('[chat-repair] Migration not recorded; prisma migrate deploy will apply it normally.');
      return;
    }

    const finished = state.finished_at !== null;
    const rolledBack = state.rolled_back_at !== null;

    console.log(
      `[chat-repair] Migration state: finished=${finished}, rolledBack=${rolledBack}, startedAt=${state.started_at?.toISOString?.() || state.started_at}`
    );

    if (finished && !rolledBack) {
      console.log('[chat-repair] ✓ Migration already applied. Nothing to repair.');
      return;
    }

    if (rolledBack) {
      console.log('[chat-repair] Migration is already marked rolled back; migrate deploy will retry it.');
      return;
    }

    console.log('[chat-repair] Failed migration detected. Verifying/completing only its declared objects...');
    const fkState = await ensureHistoricalObjects(db);
    await verifyRequiredObjects(db, fkState);

    resolveApplied();

    const after = await getMigrationState(db);
    if (!after || after.finished_at === null || after.rolled_back_at !== null) {
      throw new Error('Prisma resolve completed but migration history is not in applied state');
    }

    console.log('[chat-repair] ✓ Failed ChatMessage migration recovered safely.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error('[chat-repair] FATAL:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
