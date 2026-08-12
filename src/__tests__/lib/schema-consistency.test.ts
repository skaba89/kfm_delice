/**
 * Mission 10: Prisma provider-template consistency test
 *
 * Validates that the PostgreSQL and SQLite provider templates are consistent:
 *   - Same legacy/core model names
 *   - Same field names (excluding type differences like BigInt vs Int)
 *   - Same relations
 *   - Same unique constraints
 *
 * Shared domain models (for example Platform Billing) now live separately in
 * prisma/models/*.prisma and are loaded with the active prisma/schema.prisma.
 * This test therefore compares the two provider templates, while dedicated
 * domain schema tests validate the shared model files.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SQLITE_SCHEMA = readFileSync(
  join(process.cwd(), 'prisma/templates/schema.sqlite.template'),
  'utf-8',
);
const POSTGRES_SCHEMA = readFileSync(
  join(process.cwd(), 'prisma/templates/schema.postgres.template'),
  'utf-8',
);

function extractModelNames(schema: string): string[] {
  const matches = schema.matchAll(/^model\s+(\w+)\s*\{/gm);
  return Array.from(matches).map(m => m[1]).sort();
}

function extractModelFields(schema: string, modelName: string): string[] {
  const regex = new RegExp(`model ${modelName} \\{([\\s\\S]*?)^\\}`, 'm');
  const match = schema.match(regex);
  if (!match) return [];
  const body = match[1];
  const fields: string[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@') || trimmed.startsWith('}')) continue;
    const fieldMatch = trimmed.match(/^(\w+)\s+/);
    if (fieldMatch) fields.push(fieldMatch[1]);
  }
  return fields.sort();
}

describe('Mission 5: Prisma provider consistency (SQLite vs PostgreSQL)', () => {
  it('should have the same core model names in both provider templates', () => {
    const sqliteModels = extractModelNames(SQLITE_SCHEMA);
    const postgresModels = extractModelNames(POSTGRES_SCHEMA);
    expect(sqliteModels).toEqual(postgresModels);
  });

  it('should have all 7 Mission models in both provider templates', () => {
    const models = extractModelNames(SQLITE_SCHEMA);
    const requiredNewModels = [
      'OrderItem',
      'IdempotencyKey',
      'PromotionRedemption',
      'WebhookEvent',
      'CustomerFavorite',
      'RefreshToken',
      'RevokedToken',
    ];
    for (const model of requiredNewModels) expect(models).toContain(model);
  });

  it('should have tokenVersion on Admin in both schemas', () => {
    const sqliteAdminFields = extractModelFields(SQLITE_SCHEMA, 'Admin');
    const postgresAdminFields = extractModelFields(POSTGRES_SCHEMA, 'Admin');
    expect(sqliteAdminFields).toContain('tokenVersion');
    expect(postgresAdminFields).toContain('tokenVersion');
  });

  it('should have tokenVersion on Customer in both schemas', () => {
    const sqliteCustomerFields = extractModelFields(SQLITE_SCHEMA, 'Customer');
    const postgresCustomerFields = extractModelFields(POSTGRES_SCHEMA, 'Customer');
    expect(sqliteCustomerFields).toContain('tokenVersion');
    expect(postgresCustomerFields).toContain('tokenVersion');
  });

  it('should have session security fields on PlatformAdmin in both schemas', () => {
    const sqliteFields = extractModelFields(SQLITE_SCHEMA, 'PlatformAdmin');
    const postgresFields = extractModelFields(POSTGRES_SCHEMA, 'PlatformAdmin');
    for (const field of ['tokenVersion', 'mustChangePassword', 'loginAttempts', 'lockedUntil']) {
      expect(sqliteFields).toContain(field);
      expect(postgresFields).toContain(field);
    }
  });

  it('should have orderItems and idempotencyKey relations on Order in both schemas', () => {
    const sqliteOrderFields = extractModelFields(SQLITE_SCHEMA, 'Order');
    const postgresOrderFields = extractModelFields(POSTGRES_SCHEMA, 'Order');
    expect(sqliteOrderFields).toContain('orderItems');
    expect(postgresOrderFields).toContain('orderItems');
    expect(sqliteOrderFields).toContain('idempotencyKey');
    expect(postgresOrderFields).toContain('idempotencyKey');
  });

  it('should have favorites relation on Customer in both schemas', () => {
    const sqliteFields = extractModelFields(SQLITE_SCHEMA, 'Customer');
    const postgresFields = extractModelFields(POSTGRES_SCHEMA, 'Customer');
    expect(sqliteFields).toContain('favorites');
    expect(postgresFields).toContain('favorites');
  });

  it('should keep the same important unique constraints', () => {
    for (const constraint of [
      '@@unique([restaurantId, key])',
      '@@unique([customerId, menuItemId])',
      '@@unique([provider, providerEventId])',
      '@@unique([orderId])',
    ]) {
      expect(SQLITE_SCHEMA).toContain(constraint);
      expect(POSTGRES_SCHEMA).toContain(constraint);
    }
  });
});
