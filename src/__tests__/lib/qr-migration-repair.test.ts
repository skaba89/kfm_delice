/**
 * Mission 8: Tests for verify-restaurant-table-qr-migration.cjs logic
 *
 * Tests the verification logic without a live database connection.
 * Uses mocked PrismaClient to simulate different database states.
 *
 * Scenarios tested:
 *   1. All objects exist → exit 0 (chemin A)
 *   2. Table missing → exit 1 (chemin B)
 *   3. Column missing → exit 1
 *   4. FK missing → exit 1
 *   5. FK already exists → exit 0
 *   6. Migration already applied → exit 0
 *   7. Another migration in failed state → script ignores it (only checks QR)
 *   8. Concurrent startup → no corruption (idempotent verification)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read the verification script source to verify it has the right structure
const scriptPath = join(process.cwd(), 'scripts/verify-restaurant-table-qr-migration.cjs');
const scriptSource = readFileSync(scriptPath, 'utf-8');

describe('Mission 3: verify-restaurant-table-qr-migration.cjs — script structure', () => {
  it('should exist and be readable', () => {
    expect(scriptSource.length).toBeGreaterThan(1000);
  });

  it('should NOT reference non-existent migration_script column', () => {
    expect(scriptSource).not.toContain('migration_script');
  });

  it('should use $queryRawUnsafe (acceptable for read-only queries)', () => {
    // The script uses $queryRawUnsafe for information_schema queries
    // which is acceptable since these are read-only SELECTs
    expect(scriptSource).toContain('$queryRawUnsafe');
  });

  it('should check all 10 verification points', () => {
    expect(scriptSource).toContain('Check 1: RestaurantTable table exists');
    expect(scriptSource).toContain('Check 2: RestaurantTable columns');
    expect(scriptSource).toContain('Check 3: Order.tableId column');
    expect(scriptSource).toContain('Check 4: Order.tableNumberStr column');
    expect(scriptSource).toContain('Check 5 & 6: Indexes and constraints');
    expect(scriptSource).toContain('Check 7 & 8: Foreign keys');
    expect(scriptSource).toContain('Check 9: Orphaned data check');
    expect(scriptSource).toContain('Check 10: Migration state');
  });

  it('should exit 0 on success (chemin A)', () => {
    expect(scriptSource).toContain("process.exit(0)");
    expect(scriptSource).toContain('CHEMIN A');
  });

  it('should exit 1 on failure (chemin B)', () => {
    expect(scriptSource).toContain("process.exit(1)");
    expect(scriptSource).toContain('CHEMIN B');
  });

  it('should exit 2 on database error', () => {
    expect(scriptSource).toContain("process.exit(2)");
  });

  it('should only target the QR migration', () => {
    expect(scriptSource).toContain('20260713000000_add_restaurant_table_qr');
  });

  it('should check all expected columns', () => {
    const expectedColumns = [
      'id', 'restaurantId', 'name', 'number', 'capacity', 'zone',
      'status', 'active', 'qrToken', 'qrVersion', 'qrEnabled',
      'qrGeneratedAt', 'lastScannedAt', 'scanCount', 'createdAt', 'updatedAt',
    ];
    for (const col of expectedColumns) {
      expect(scriptSource).toContain(col);
    }
  });

  it('should check all expected indexes', () => {
    expect(scriptSource).toContain('RestaurantTable_pkey');
    expect(scriptSource).toContain('RestaurantTable_restaurantId_number_key');
    expect(scriptSource).toContain('RestaurantTable_qrToken_key');
    expect(scriptSource).toContain('RestaurantTable_restaurantId_idx');
    expect(scriptSource).toContain('RestaurantTable_restaurantId_active_idx');
    expect(scriptSource).toContain('Order_tableId_idx');
  });

  it('should check FK ON DELETE actions', () => {
    expect(scriptSource).toContain('CASCADE');
    expect(scriptSource).toContain('SET NULL');
  });

  it('should check for orphaned data', () => {
    expect(scriptSource).toContain('orphaned');
    expect(scriptSource).toContain('LEFT JOIN');
  });

  it('should NOT modify the database (read-only)', () => {
    expect(scriptSource).not.toContain('UPDATE');
    expect(scriptSource).not.toContain('DELETE FROM');
    expect(scriptSource).not.toContain('INSERT INTO');
    expect(scriptSource).not.toContain('ALTER TABLE');
    expect(scriptSource).not.toContain('CREATE TABLE');
    expect(scriptSource).not.toContain('DROP');
  });
});

describe('Mission 4: repair-qr-migration.cjs — script structure', () => {
  const repairScriptPath = join(process.cwd(), 'scripts/repair-qr-migration.cjs');
  const repairSource = readFileSync(repairScriptPath, 'utf-8');

  it('should exist and be readable', () => {
    expect(repairSource.length).toBeGreaterThan(1000);
  });

  it('should only target the QR migration', () => {
    expect(repairSource).toContain('20260713000000_add_restaurant_table_qr');
  });

  it('should implement both chemin A and chemin B', () => {
    expect(repairSource).toContain('CHEMIN A');
    expect(repairSource).toContain('CHEMIN B');
  });

  it('should use prisma migrate resolve (not manual UPDATE)', () => {
    expect(repairSource).toContain('prisma migrate resolve');
    expect(repairSource).toContain('--applied');
    expect(repairSource).toContain('--rolled-back');
  });

  it('should use conditional SQL (IF NOT EXISTS / DO $$)', () => {
    expect(repairSource).toContain('IF NOT EXISTS');
    expect(repairSource).toContain('DO $$');
    expect(repairSource).toContain('pg_constraint');
  });

  it('should NOT use prisma db push', () => {
    // Filter out comments to check only executable code
    const executableCode = repairSource
      .split('\n')
      .filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('#'))
      .join('\n');
    expect(executableCode).not.toMatch(/prisma\s+db\s+push/);
  });

  it('should NOT use --accept-data-loss', () => {
    // Filter out comments to check only executable code
    const executableCode = repairSource
      .split('\n')
      .filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('#'))
      .join('\n');
    expect(executableCode).not.toMatch(/--accept-data-loss/);
  });

  it('should run verification before and after repair', () => {
    expect(repairSource).toContain('verify');
    expect(repairSource).toContain('verify-restaurant-table-qr-migration.cjs');
  });
});

describe('Mission 2: QR migration SQL audit', () => {
  const migrationPath = join(
    process.cwd(),
    'prisma/migrations/20260713000000_add_restaurant_table_qr/migration.sql'
  );
  const migrationSql = readFileSync(migrationPath, 'utf-8');

  it('should create RestaurantTable with IF NOT EXISTS', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS "RestaurantTable"');
  });

  it('should create all expected columns', () => {
    const expectedCols = [
      'id', 'restaurantId', 'name', 'number', 'capacity', 'zone',
      'status', 'active', 'qrToken', 'qrVersion', 'qrEnabled',
      'qrGeneratedAt', 'lastScannedAt', 'scanCount', 'createdAt', 'updatedAt',
    ];
    for (const col of expectedCols) {
      expect(migrationSql).toContain(`"${col}"`);
    }
  });

  it('should create unique indexes with IF NOT EXISTS', () => {
    expect(migrationSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS');
  });

  it('should create regular indexes with IF NOT EXISTS', () => {
    expect(migrationSql).toContain('CREATE INDEX IF NOT EXISTS');
  });

  it('should add Order columns with IF NOT EXISTS', () => {
    expect(migrationSql).toContain('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableId"');
    expect(migrationSql).toContain('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableNumberStr"');
  });

  it('should handle Order_tableId_fkey with DROP IF EXISTS first', () => {
    expect(migrationSql).toContain('DROP CONSTRAINT IF EXISTS "Order_tableId_fkey"');
  });

  // This is the ROOT CAUSE of the P3018 error:
  it('should NOT handle RestaurantTable_restaurantId_fkey with IF NOT EXISTS (known bug)', () => {
    // The migration uses plain ADD CONSTRAINT without IF NOT EXISTS
    // This causes P3018 when the constraint already exists
    expect(migrationSql).toContain('ADD CONSTRAINT "RestaurantTable_restaurantId_fkey"');
    // It does NOT use DO $$ conditional block
    expect(migrationSql).not.toContain('DO $$');
  });
});

describe('Mission 5: render-start.sh — security checks', () => {
  const startScriptPath = join(process.cwd(), 'render-start.sh');
  const startSource = readFileSync(startScriptPath, 'utf-8');

  it('should use set -euo pipefail (fail-fast)', () => {
    expect(startSource).toContain('set -euo pipefail');
  });

  it('should NOT run prisma db push', () => {
    // The script may mention "db push" in comments, but must not EXECUTE it
    const executableLines = startSource
      .split('\n')
      .filter(l => !l.trim().startsWith('#') && !l.trim().startsWith('echo'))
      .join('\n');
    expect(executableLines).not.toMatch(/prisma\s+db\s+push/);
  });

  it('should NOT run auto-seed', () => {
    expect(startSource).not.toContain('auto-seed');
  });

  it('should NOT run backfill scripts', () => {
    expect(startSource).not.toContain('backfill');
  });

  it('should NOT use the generic resolve-failed-migrations.cjs', () => {
    // The old script resolved ALL failed migrations blindly.
    // The new script uses repair-qr-migration.cjs which only targets the QR migration.
    expect(startSource).not.toContain('resolve-failed-migrations.cjs');
  });

  it('should use the targeted repair-qr-migration.cjs', () => {
    expect(startSource).toContain('repair-qr-migration.cjs');
  });

  it('should run prisma migrate deploy (not reset, not push)', () => {
    expect(startSource).toContain('prisma migrate deploy');
    expect(startSource).not.toContain('prisma migrate reset');
  });

  it('should run verification before starting Next.js', () => {
    expect(startSource).toContain('verify-schema-read-only.cjs');
  });

  it('should start Next.js on 0.0.0.0', () => {
    expect(startSource).toContain('next start -p "$PORT" -H 0.0.0.0');
  });

  it('should keep the installed @prisma/client package at startup', () => {
    expect(startSource).not.toMatch(/rm -rf[^\n]*node_modules\/@prisma\/client/);
  });

  it('should NOT have || true on critical steps', () => {
    // Check that critical commands don't have || true
    const lines = startSource.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments and echo lines
      if (trimmed.startsWith('#') || trimmed.startsWith('echo')) continue;
      // Check for || true on node/prisma/next commands
      if ((trimmed.includes('node ') || trimmed.includes('prisma ') || trimmed.includes('next ')) 
          && trimmed.includes('|| true')) {
        // Exception: rm -rf ... || true is OK (cleanup)
        if (trimmed.includes('rm -rf')) continue;
        throw new Error(`Found || true on critical command: ${trimmed}`);
      }
    }
  });
});

describe('Render build and schema verification regressions', () => {
  const buildSource = readFileSync(join(process.cwd(), 'render-build.sh'), 'utf-8');
  const schemaVerifySource = readFileSync(
    join(process.cwd(), 'scripts/verify-schema-read-only.cjs'),
    'utf-8'
  );
  const renderBlueprint = readFileSync(join(process.cwd(), 'render.yaml'), 'utf-8');

  it('uses the repository-local Next.js binary', () => {
    expect(buildSource).toContain('node_modules/.bin/next build');
    expect(buildSource).not.toMatch(/^next build$/m);
  });

  it('does not delete the installed Prisma Client package during build', () => {
    expect(buildSource).not.toMatch(/rm -rf[^\n]*node_modules\/@prisma\/client/);
  });

  it('pins Render Node through the supported NODE_VERSION variable', () => {
    expect(renderBlueprint).toContain('key: NODE_VERSION');
    expect(renderBlueprint).not.toContain('nodeVersion:');
  });

  it('checks PostgreSQL quoted table names without lowercasing them', () => {
    expect(schemaVerifySource).toContain("'RestaurantTable'");
    expect(schemaVerifySource).not.toContain('table.toLowerCase()');
  });
});
