import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('LoyaltyTier migration recovery contract', () => {
  const repair = readRepoFile('scripts/repair-loyalty-tier-migration.cjs');
  const startup = readRepoFile('render-start.sh');
  const readiness = readRepoFile('scripts/verify-schema-read-only.cjs');

  it('targets only the known failed LoyaltyTier migration', () => {
    expect(repair).toContain("const MIGRATION_NAME = '20260713060000_add_loyalty_tiers'");
    expect(repair).toContain("['migrate', 'resolve', '--applied', MIGRATION_NAME]");
    expect(repair).not.toMatch(/['"]migrate['"],\s*['"]reset['"]/i);
    expect(repair).not.toMatch(/['"]db['"],\s*['"]push['"]/i);
    expect(repair).not.toMatch(/['"]--accept-data-loss['"]/i);
    expect(repair).not.toMatch(/\$executeRawUnsafe\([\s\S]*?DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)/i);
  });

  it('proves the historical LoyaltyTier shape before resolving migration history', () => {
    for (const column of [
      'id',
      'restaurantId',
      'name',
      'label',
      'minSpent',
      'discountPercent',
      'freeDelivery',
      'freeDish',
      'color',
      'icon',
      'active',
      'createdAt',
      'updatedAt',
    ]) {
      expect(repair).toContain(column);
    }

    expect(repair).toContain('LoyaltyTier_pkey');
    expect(repair).toContain('LoyaltyTier_restaurantId_name_key');
    expect(repair).toContain('LoyaltyTier_restaurantId_active_idx');
    expect(repair).toContain('LoyaltyTier_restaurantId_fkey');
    expect(repair).toContain('refusing to invent LoyaltyTier data-bearing fields');
  });

  it('preserves historical LoyaltyTier orphans and never rewrites business rows', () => {
    expect(repair).toContain('countOrphanTiers');
    expect(repair).toContain('NOT VALID');
    expect(repair).toContain('historical orphan row(s)');
    expect(repair).toContain('No data was deleted or rewritten');
    expect(repair).not.toMatch(/DELETE\s+FROM\s+"LoyaltyTier"/i);
    expect(repair).not.toMatch(/UPDATE\s+"LoyaltyTier"/i);
  });

  it('restores only the exact historical Customer.tier contract when missing', () => {
    expect(repair).toContain('Customer.tier');
    expect(repair).toContain("ADD COLUMN \"tier\" TEXT NOT NULL DEFAULT 'bronze'");
    expect(repair).toContain('Customer_tier_idx');
    expect(repair).toContain("default mismatch: expected bronze");
  });

  it('runs LoyaltyTier recovery before strict prisma migrate deploy', () => {
    const repairPosition = startup.indexOf('node scripts/repair-loyalty-tier-migration.cjs');
    const migratePosition = startup.indexOf('node_modules/.bin/prisma migrate deploy');

    expect(repairPosition).toBeGreaterThan(-1);
    expect(migratePosition).toBeGreaterThan(-1);
    expect(repairPosition).toBeLessThan(migratePosition);
    expect(startup).toContain('targeted LoyaltyTier migration repair failed');
  });

  it('keeps LoyaltyTier and Customer.tier in the post-migration readiness gate', () => {
    expect(readiness).toContain("'LoyaltyTier'");
    expect(readiness).toContain('LoyaltyTier: [');
    for (const column of [
      'restaurantId',
      'name',
      'label',
      'minSpent',
      'discountPercent',
      'freeDelivery',
      'freeDish',
      'color',
      'icon',
      'active',
      'createdAt',
      'updatedAt',
    ]) {
      expect(readiness).toContain(`'${column}'`);
    }

    // Customer gains additional readiness columns over time. Verify the
    // LoyaltyTier contract without requiring tier/mustChangePassword adjacency.
    expect(readiness).toContain('Customer: [');
    expect(readiness).toContain("'tier'");
    expect(readiness).toContain("'mustChangePassword'");
  });
});
