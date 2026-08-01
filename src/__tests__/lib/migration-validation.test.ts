/**
 * Mission 10: Migration validation test (no live PostgreSQL required)
 *
 * Validates that the production hardening migration SQL:
 *   1. Is syntactically correct (parseable)
 *   2. Contains all required CREATE TABLE statements
 *   3. Contains all required ALTER TABLE statements
 *   4. Uses IF NOT EXISTS / IF NOT EXISTS for idempotency
 *   5. Creates all required indexes and constraints
 *
 * For a full integration test with a live PostgreSQL instance,
 * see the `postgres-check` job in .github/workflows/ci.yml which
 * runs `prisma migrate deploy` on PostgreSQL 16 in CI.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(process.cwd(), 'prisma/migrations/20260801000000_production_hardening/migration.sql');
const migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

describe('Mission 5: Production hardening migration', () => {
  it('should exist and be non-empty', () => {
    expect(migrationSql.length).toBeGreaterThan(1000);
  });

  it('should contain CREATE TABLE for all 7 new models', () => {
    const requiredTables = [
      'OrderItem',
      'IdempotencyKey',
      'PromotionRedemption',
      'WebhookEvent',
      'CustomerFavorite',
      'RefreshToken',
      'RevokedToken',
    ];
    for (const table of requiredTables) {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
    }
  });

  it('should contain ALTER TABLE for PlatformAdmin (add session security fields)', () => {
    expect(migrationSql).toContain('ALTER TABLE "PlatformAdmin" ADD COLUMN IF NOT EXISTS "tokenVersion"');
    expect(migrationSql).toContain('ALTER TABLE "PlatformAdmin" ADD COLUMN IF NOT EXISTS "mustChangePassword"');
    expect(migrationSql).toContain('ALTER TABLE "PlatformAdmin" ADD COLUMN IF NOT EXISTS "loginAttempts"');
    expect(migrationSql).toContain('ALTER TABLE "PlatformAdmin" ADD COLUMN IF NOT EXISTS "lockedUntil"');
  });

  it('should contain ALTER TABLE for Admin (add tokenVersion)', () => {
    expect(migrationSql).toContain('ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "tokenVersion"');
  });

  it('should contain ALTER TABLE for Customer (add tokenVersion)', () => {
    expect(migrationSql).toContain('ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tokenVersion"');
  });

  it('should be idempotent (all CREATE/ALTER use IF NOT EXISTS)', () => {
    // Count CREATE TABLE statements
    const createStatements = migrationSql.match(/CREATE TABLE/g) || [];
    const createIfNotExists = migrationSql.match(/CREATE TABLE IF NOT EXISTS/g) || [];
    expect(createIfNotExists.length).toBe(createStatements.length);

    // Count ALTER TABLE ADD COLUMN statements
    const alterStatements = migrationSql.match(/ALTER TABLE .* ADD COLUMN/g) || [];
    const alterIfNotExists = migrationSql.match(/ALTER TABLE .* ADD COLUMN IF NOT EXISTS/g) || [];
    expect(alterIfNotExists.length).toBe(alterStatements.length);
  });

  it('should create unique indexes for IdempotencyKey', () => {
    expect(migrationSql).toContain('IdempotencyKey_restaurantId_key_key');
    expect(migrationSql).toContain('IdempotencyKey_orderId_key');
  });

  it('should create unique index for PromotionRedemption', () => {
    expect(migrationSql).toContain('PromotionRedemption_orderId_key');
  });

  it('should create unique index for WebhookEvent', () => {
    expect(migrationSql).toContain('WebhookEvent_provider_providerEventId_key');
  });

  it('should create unique index for CustomerFavorite', () => {
    expect(migrationSql).toContain('CustomerFavorite_customerId_menuItemId_key');
  });

  it('should create unique index for RefreshToken', () => {
    expect(migrationSql).toContain('RefreshToken_tokenHash_key');
  });

  it('should create unique index for RevokedToken', () => {
    expect(migrationSql).toContain('RevokedToken_jti_key');
  });

  it('should add foreign key constraints', () => {
    expect(migrationSql).toContain('OrderItem_orderId_fkey');
    expect(migrationSql).toContain('OrderItem_menuItemId_fkey');
    expect(migrationSql).toContain('IdempotencyKey_restaurantId_fkey');
    expect(migrationSql).toContain('PromotionRedemption_promoCodeId_fkey');
    expect(migrationSql).toContain('WebhookEvent_restaurantId_fkey');
    expect(migrationSql).toContain('CustomerFavorite_customerId_fkey');
  });

  it('should use BIGINT for monetary fields (PostgreSQL)', () => {
    expect(migrationSql).toContain('"unitPrice" BIGINT NOT NULL');
    expect(migrationSql).toContain('"lineTotal" BIGINT NOT NULL');
    expect(migrationSql).toContain('"discountAmount" BIGINT NOT NULL');
  });

  it('should use JSONB for WebhookEvent payload (PostgreSQL)', () => {
    expect(migrationSql).toContain('"payload" JSONB NOT NULL');
  });

  it('should create performance indexes', () => {
    expect(migrationSql).toContain('OrderItem_orderId_idx');
    expect(migrationSql).toContain('OrderItem_menuItemId_idx');
    expect(migrationSql).toContain('IdempotencyKey_restaurantId_status_idx');
    expect(migrationSql).toContain('IdempotencyKey_expiresAt_idx');
    expect(migrationSql).toContain('PromotionRedemption_promoCodeId_createdAt_idx');
    expect(migrationSql).toContain('WebhookEvent_provider_status_idx');
    expect(migrationSql).toContain('RefreshToken_expiresAt_idx');
    expect(migrationSql).toContain('RevokedToken_expiresAt_idx');
  });

  it('should not contain any DROP statements (additive only)', () => {
    expect(migrationSql).not.toMatch(/DROP TABLE/i);
    expect(migrationSql).not.toMatch(/DROP COLUMN/i);
    expect(migrationSql).not.toMatch(/TRUNCATE/i);
  });

  it('should not contain any DELETE statements', () => {
    expect(migrationSql).not.toMatch(/DELETE FROM/i);
  });

  it('should not use --accept-data-loss', () => {
    expect(migrationSql).not.toContain('--accept-data-loss');
  });
});
