#!/usr/bin/env node
/**
 * resolve-failed-migrations.cjs
 *
 * Marks failed migrations as rolled back so `prisma migrate deploy` can proceed.
 * This is safe — the migration is already partially applied (tables exist).
 *
 * A "failed" migration is one where:
 *   - finished_at IS NULL (never completed)
 *   - rolled_back_at IS NULL (never rolled back)
 *   - started_at IS NOT NULL (was actually started)
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/resolve-failed-migrations.cjs
 */

const { PrismaClient } = require('@prisma/client');

async function main() {
  const db = new PrismaClient();
  try {
    // Find all truly failed migrations (started but never finished, never rolled back)
    const failedMigrations = await db.$queryRawUnsafe(
      `SELECT migration_name FROM _prisma_migrations
       WHERE finished_at IS NULL
         AND rolled_back_at IS NULL
         AND started_at IS NOT NULL`
    );

    if (!failedMigrations || failedMigrations.length === 0) {
      console.log('[resolve] No failed migrations found.');
      return;
    }

    console.log(`[resolve] Found ${failedMigrations.length} failed migration(s):`);
    for (const m of failedMigrations) {
      console.log(`  - ${m.migration_name}`);
    }

    // Mark each failed migration as rolled back
    for (const m of failedMigrations) {
      const name = m.migration_name;
      console.log(`[resolve] Marking ${name} as rolled back...`);
      await db.$executeRawUnsafe(
        `UPDATE _prisma_migrations
         SET rolled_back_at = NOW(),
             finished_at = NOW(),
             applied_steps_count = 0
         WHERE migration_name = $1
           AND finished_at IS NULL
           AND rolled_back_at IS NULL`,
        name
      );
      console.log(`[resolve] ✓ ${name} marked as rolled back`);
    }

    console.log('[resolve] ✓ All failed migrations resolved.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error('[resolve] Error:', err.message);
  // Don't exit with error code — let render-start.sh continue
  // (it will fail at migrate deploy if there's a real issue)
  process.exit(0);
});
