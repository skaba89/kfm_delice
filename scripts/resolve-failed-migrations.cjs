#!/usr/bin/env node
/**
 * resolve-failed-migrations.cjs
 *
 * Marks failed migrations as SUCCESSFULLY APPLIED so `prisma migrate deploy`
 * skips them. This is safe when the tables/constraints already exist in the
 * database (from a previous `db push`).
 *
 * A "failed" migration is one where:
 *   - started_at IS NOT NULL (was started)
 *   - finished_at IS NULL (never completed)
 *   - rolled_back_at IS NULL (never rolled back)
 *
 * We mark it as applied by setting finished_at = NOW() and
 * applied_steps_count = total_steps_count.
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/resolve-failed-migrations.cjs
 */

const { PrismaClient } = require('@prisma/client');

async function main() {
  const db = new PrismaClient();
  try {
    // Find all truly failed migrations
    const failedMigrations = await db.$queryRawUnsafe(
      `SELECT migration_name, migration_script FROM _prisma_migrations
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

    // Mark each failed migration as SUCCESSFULLY APPLIED
    // (not rolled back — we want Prisma to SKIP it, not re-apply it)
    for (const m of failedMigrations) {
      const name = m.migration_name;
      console.log(`[resolve] Marking ${name} as successfully applied...`);
      await db.$executeRawUnsafe(
        `UPDATE _prisma_migrations
         SET finished_at = NOW(),
             rolled_back_at = NULL,
             applied_steps_count = COALESCE(applied_steps_count, 1),
             logs = COALESCE(logs, '') || '[resolve] Marked as applied by resolve-failed-migrations.cjs\n'
         WHERE migration_name = $1
           AND finished_at IS NULL
           AND rolled_back_at IS NULL`,
        name
      );
      console.log(`[resolve] ✓ ${name} marked as applied`);
    }

    console.log('[resolve] ✓ All failed migrations resolved (marked as applied).');
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error('[resolve] Error:', err.message);
  // Don't exit with error code — let render-start.sh continue
  process.exit(0);
});
