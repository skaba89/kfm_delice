#!/usr/bin/env node
/**
 * CI-only PostgreSQL regression for the historical ChatMessage P3009 repair.
 *
 * This script is intentionally inert unless GitHub CI is using a localhost
 * PostgreSQL database. It must never run against a remote/developer database.
 */

const { execFileSync } = require('child_process');

const databaseUrl = process.env.DATABASE_URL || '';
const isLocalPostgres =
  /^postgres(?:ql)?:\/\/[^@]+@(localhost|127\.0\.0\.1)(?::\d+)?\//i.test(databaseUrl);

if (process.env.CI !== 'true' || !isLocalPostgres) {
  console.log('[chat-orphan-regression] skipped (requires CI=true + localhost PostgreSQL)');
  process.exit(0);
}

const { PrismaClient } = require('@prisma/client');

const MIGRATION_NAME = '20260713050000_add_chat_messages';
const ORPHAN_ID = 'ci-chat-orphan-existing';
const NEW_ORPHAN_ID = 'ci-chat-orphan-new-write';
const MISSING_RESTAURANT_ID = 'ci-missing-restaurant';

const db = new PrismaClient();

async function getFkState() {
  const rows = await db.$queryRawUnsafe(`
    SELECT c.convalidated
    FROM pg_constraint c
    WHERE c.conrelid = '"ChatMessage"'::regclass
      AND c.conname = 'ChatMessage_restaurantId_fkey'
      AND c.contype = 'f'
  `);
  return rows[0] || null;
}

async function cleanup() {
  await db.$executeRawUnsafe(`
    DELETE FROM "ChatMessage"
    WHERE "id" IN ('${ORPHAN_ID}', '${NEW_ORPHAN_ID}')
  `);

  const fk = await getFkState();
  if (fk && !fk.convalidated) {
    await db.$executeRawUnsafe(`
      ALTER TABLE "ChatMessage"
        VALIDATE CONSTRAINT "ChatMessage_restaurantId_fkey"
    `);
  }
}

async function main() {
  await cleanup();

  await db.$executeRawUnsafe(`
    ALTER TABLE "ChatMessage"
      DROP CONSTRAINT IF EXISTS "ChatMessage_restaurantId_fkey"
  `);

  await db.$executeRawUnsafe(`
    INSERT INTO "ChatMessage"
      ("id", "restaurantId", "senderId", "senderName", "senderRole", "content", "createdAt")
    VALUES
      ('${ORPHAN_ID}', '${MISSING_RESTAURANT_ID}', 'ci-sender', 'CI Sender', 'admin', 'CI orphan regression', CURRENT_TIMESTAMP)
  `);

  const changed = await db.$executeRawUnsafe(`
    UPDATE _prisma_migrations
    SET finished_at = NULL,
        rolled_back_at = NULL,
        applied_steps_count = 0,
        logs = 'CI simulated P3009 with historical orphan ChatMessage row'
    WHERE migration_name = '${MIGRATION_NAME}'
  `);

  if (Number(changed) < 1) {
    throw new Error('ChatMessage migration row not found for orphan P3009 regression');
  }

  execFileSync('node', ['scripts/repair-chat-message-migration.cjs'], {
    stdio: 'inherit',
    env: process.env,
  });

  const preserved = await db.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS count
    FROM "ChatMessage"
    WHERE "id" = '${ORPHAN_ID}'
      AND "restaurantId" = '${MISSING_RESTAURANT_ID}'
  `);
  if (Number(preserved[0]?.count || 0) !== 1) {
    throw new Error('Historical orphan ChatMessage was not preserved');
  }

  const fk = await getFkState();
  if (!fk) {
    throw new Error('ChatMessage foreign key was not recreated');
  }
  if (fk.convalidated) {
    throw new Error('ChatMessage foreign key should remain NOT VALID while the historical orphan exists');
  }

  let rejected = false;
  try {
    await db.$executeRawUnsafe(`
      INSERT INTO "ChatMessage"
        ("id", "restaurantId", "senderId", "senderName", "senderRole", "content", "createdAt")
      VALUES
        ('${NEW_ORPHAN_ID}', '${MISSING_RESTAURANT_ID}', 'ci-sender-2', 'CI Sender 2', 'admin', 'must be rejected', CURRENT_TIMESTAMP)
    `);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const metaCode = error && typeof error === 'object' && 'meta' in error ? error.meta?.code : undefined;
    if (message.includes('23503') || metaCode === '23503') {
      rejected = true;
    } else {
      throw error;
    }
  }

  if (!rejected) {
    throw new Error('NOT VALID foreign key did not reject a new orphan ChatMessage write');
  }

  await cleanup();

  const validatedFk = await getFkState();
  if (!validatedFk?.convalidated) {
    throw new Error('ChatMessage foreign key did not validate after CI orphan cleanup');
  }

  execFileSync('node_modules/.bin/prisma', ['migrate', 'deploy'], {
    stdio: 'inherit',
    env: process.env,
  });

  console.log(
    '[chat-orphan-regression] ✓ historical orphan preserved, future orphan rejected, cleanup validated, migrate deploy green'
  );
}

main()
  .catch((error) => {
    console.error(
      '[chat-orphan-regression] FATAL:',
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
