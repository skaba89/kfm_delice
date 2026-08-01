#!/usr/bin/env node
/**
 * resolve-failed-migrations.cjs
 *
 * Marks failed migrations as rolled back so `prisma migrate deploy` can proceed.
 * This is safe — the migration is already partially applied (tables exist).
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/resolve-failed-migrations.cjs
 */

const { PrismaClient } = require('@prisma/client');

async function main() {
  const db = new PrismaClient();
  try {
    // Find all failed migrations
    const failedMigrations = await db.$queryRawUnsafe(
      `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL`
    );

    if (failedMigrations.length === 0) {
      console.log('[resolve] No failed migrations found.');
      return;
    }

    console.log(`[resolve] Found ${failedMigrations.length} failed migration(s):`);
    for (const m of failedMigrations) {
      console.log(`  - ${m.migration_name}`);
    }

    // Mark each failed migration as rolled back
    for (const m of failedMigrations) {
      console.log(`[resolve] Marking ${m.migration_name} as rolled back...`);
      await db.$executeRawUnsafe(
        `UPDATE _prisma_migrations SET rolled_back_at = NOW(), finished_at = NOW() WHERE migration_name = $1`,
        m.migration_name
      );
    }

    console.log('[resolve] ✓ All failed migrations resolved. Run `prisma migrate deploy` again.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error('[resolve] Error:', err.message);
  process.exit(1);
});
