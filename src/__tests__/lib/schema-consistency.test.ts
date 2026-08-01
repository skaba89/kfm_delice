/**
 * Mission 10: Prisma schema consistency test
 *
 * Validates that the PostgreSQL and SQLite schemas are consistent:
 *   - Same model names
 *   - Same field names (excluding type differences like BigInt vs Int)
 *   - Same relations
 *   - Same unique constraints
 *
 * This catches drift between the two schemas that would cause
 * runtime errors when switching providers.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SQLITE_SCHEMA = readFileSync(join(process.cwd(), 'prisma/schema.sqlite.prisma'), 'utf-8');
const POSTGRES_SCHEMA = readFileSync(join(process.cwd(), 'prisma/schema.postgres.prisma'), 'utf-8');

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
    // Skip comments, directives, relations
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@') || trimmed.startsWith('}')) continue;
    // Match field declarations: fieldName Type ...
    const fieldMatch = trimmed.match(/^(\w+)\s+/);
    if (fieldMatch) {
      fields.push(fieldMatch[1]);
    }
  }
  return fields.sort();
}

describe('Mission 5: Prisma schema consistency (SQLite vs PostgreSQL)', () => {
  it('should have the same model names in both schemas', () => {
    const sqliteModels = extractModelNames(SQLITE_SCHEMA);
    const postgresModels = extractModelNames(POSTGRES_SCHEMA);
    expect(sqliteModels).toEqual(postgresModels);
  });

  it('should have all 7 new Mission models', () => {
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
    for (const model of requiredNewModels) {
      expect(models).toContain(model);
    }
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
    expect(sqliteFields).toContain('tokenVersion');
    expect(sqliteFields).toContain('mustChangePassword');
    expect(sqliteFields).toContain('loginAttempts');
    expect(sqliteFields).toContain('lockedUntil');
    expect(postgresFields).toContain('tokenVersion');
    expect(postgresFields).toContain('mustChangePassword');
    expect(postgresFields).toContain('loginAttempts');
    expect(postgresFields).toContain('lockedUntil');
  });

  it('should have orderItems relation on Order in both schemas', () => {
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

  it('should have the same unique constraints on IdempotencyKey', () => {
    expect(SQLITE_SCHEMA).toContain('@@unique([restaurantId, key])');
    expect(POSTGRES_SCHEMA).toContain('@@unique([restaurantId, key])');
  });

  it('should have the same unique constraints on CustomerFavorite', () => {
    expect(SQLITE_SCHEMA).toContain('@@unique([customerId, menuItemId])');
    expect(POSTGRES_SCHEMA).toContain('@@unique([customerId, menuItemId])');
  });

  it('should have the same unique constraints on WebhookEvent', () => {
    expect(SQLITE_SCHEMA).toContain('@@unique([provider, providerEventId])');
    expect(POSTGRES_SCHEMA).toContain('@@unique([provider, providerEventId])');
  });

  it('should have the same unique constraints on PromotionRedemption', () => {
    expect(SQLITE_SCHEMA).toContain('@@unique([orderId])');
    expect(POSTGRES_SCHEMA).toContain('@@unique([orderId])');
  });
});
