import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const repair = readFileSync('scripts/repair-reco-11-15-migration.cjs', 'utf8');
const startup = readFileSync('render-start.sh', 'utf8');
const readiness = readFileSync('scripts/verify-schema-read-only.cjs', 'utf8');
const migration = readFileSync(
  'prisma/migrations/20260714090000_add_reco_11_15/migration.sql',
  'utf8'
);

describe('Reco 11-15 historical migration recovery', () => {
  it('targets exactly the failed historical migration', () => {
    expect(repair).toContain("const MIGRATION_NAME = '20260714090000_add_reco_11_15'");
    expect(repair).toContain("['migrate', 'resolve', '--applied', MIGRATION_NAME]");
    expect(repair).not.toMatch(/resolve\s+--applied\s+\$?\{?[^M]/);
  });

  it('keeps the recovery non-destructive for business rows', () => {
    expect(repair).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)\b/i);
    expect(repair).not.toMatch(/\bDELETE\s+FROM\s+"?(Customer|Staff|Supplier|Restaurant)"?/i);
    expect(repair).not.toMatch(/\bUPDATE\s+"?(Customer|Staff|Supplier|Restaurant)"?\s+SET\b/i);
    expect(repair).not.toContain('migrate reset');
    expect(repair).not.toContain('db push');
    expect(repair).not.toContain('--accept-data-loss');
  });

  it('locks the exact historical scalar column contract', () => {
    expect(migration).toContain(
      'ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "referralCode" TEXT NOT NULL DEFAULT \'\';'
    );
    expect(migration).toContain(
      'ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "referredBy" TEXT NOT NULL DEFAULT \'\';'
    );
    expect(migration).toContain(
      'ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "weeklySchedule" TEXT NOT NULL DEFAULT \'[]\';'
    );
    expect(migration).toContain(
      'ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "totalHours" REAL NOT NULL DEFAULT 0;'
    );

    expect(repair).toContain('Customer.referralCode');
    expect(repair).toContain('Customer.referredBy');
    expect(repair).toContain('Staff.weeklySchedule');
    expect(repair).toContain('Staff.totalHours');
  });

  it('locks Supplier shape, indexes and FK semantics', () => {
    for (const column of [
      'id',
      'name',
      'contactName',
      'phone',
      'email',
      'address',
      'category',
      'notes',
      'restaurantId',
      'createdAt',
      'updatedAt',
    ]) {
      expect(repair).toContain(column);
    }

    expect(repair).toContain('Supplier_pkey');
    expect(repair).toContain('Supplier_restaurantId_idx');
    expect(repair).toContain('Supplier_restaurantId_category_idx');
    expect(repair).toContain('Supplier_restaurantId_fkey');
    expect(repair).toContain('REFERENCES "Restaurant"("id")');
    expect(repair).toContain('ON DELETE CASCADE');
    expect(repair).toContain('NOT VALID');
  });

  it('verifies row counts and orphan preservation', () => {
    expect(repair).toContain('captureRowCounts');
    expect(repair).toContain('assertRowCountsUnchanged');
    expect(repair).toContain('countSupplierOrphans');
    expect(repair).toContain('No data was deleted or rewritten');
  });

  it('runs the targeted repair before strict migrate deploy', () => {
    const repairIndex = startup.indexOf('node scripts/repair-reco-11-15-migration.cjs');
    const migrateIndex = startup.indexOf('node_modules/.bin/prisma migrate deploy');
    expect(repairIndex).toBeGreaterThan(-1);
    expect(migrateIndex).toBeGreaterThan(repairIndex);
    expect(startup).toContain('Step 7e: Repairing failed Reco 11-15/Supplier migration');
    expect(startup).toContain('Step 7f: Running prisma migrate deploy');
  });

  it('extends runtime readiness to every Reco 11-15 object', () => {
    expect(readiness).toContain("'Supplier'");
    expect(readiness).toContain("'Staff'");
    expect(readiness).toContain("'referralCode'");
    expect(readiness).toContain("'referredBy'");
    expect(readiness).toContain("'weeklySchedule'");
    expect(readiness).toContain("'totalHours'");
    expect(readiness).toContain("'contactName'");
    expect(readiness).toContain("'category'");
    expect(readiness).toContain("'restaurantId'");
  });
});
