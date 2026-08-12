import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const billingSchema = readFileSync(
  path.join(root, 'prisma', 'models', 'platform-billing.prisma'),
  'utf8',
);
const migration = readFileSync(
  path.join(root, 'prisma', 'migrations', '20260812050000_add_platform_billing_ledger', 'migration.sql'),
  'utf8',
);
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

describe('platform billing Prisma contract', () => {
  it('loads Prisma from the active schema directory', () => {
    expect(packageJson.prisma?.schema).toBe('prisma');
  });

  it('keeps one billing subscription per SaaS account', () => {
    expect(billingSchema).toMatch(/accountId\s+String\s+@unique/);
    expect(migration).toContain('PlatformSubscription_accountId_key');
  });

  it('makes invoice and payment retries idempotent at database level', () => {
    expect(billingSchema).toMatch(/model PlatformInvoice[\s\S]*idempotencyKey\s+String\s+@unique/);
    expect(billingSchema).toMatch(/model PlatformPayment[\s\S]*idempotencyKey\s+String\s+@unique/);
    expect(migration).toContain('PlatformInvoice_idempotencyKey_key');
    expect(migration).toContain('PlatformPayment_idempotencyKey_key');
  });

  it('keeps SaaS billing separated from restaurant Invoice and Payment relations', () => {
    expect(billingSchema).toContain('model PlatformInvoice');
    expect(billingSchema).toContain('model PlatformPayment');
    expect(billingSchema).not.toMatch(/restaurantId\s+String/);
  });

  it('uses BigInt for every persisted GNF amount', () => {
    expect(billingSchema).toMatch(/unitAmount\s+BigInt/);
    expect(billingSchema).toMatch(/subtotal\s+BigInt/);
    expect(billingSchema).toMatch(/tax\s+BigInt/);
    expect(billingSchema).toMatch(/total\s+BigInt/);
    expect(billingSchema).toMatch(/amountPaid\s+BigInt/);
    expect(billingSchema).toMatch(/amount\s+BigInt/);
    expect(migration).toContain('"unitAmount" BIGINT');
    expect(migration).toContain('"amount" BIGINT');
  });

  it('keeps provider templates outside the active multi-file schema model folder', () => {
    const sqliteTemplate = readFileSync(
      path.join(root, 'prisma', 'templates', 'schema.sqlite.template'),
      'utf8',
    );
    const postgresTemplate = readFileSync(
      path.join(root, 'prisma', 'templates', 'schema.postgres.template'),
      'utf8',
    );
    expect(sqliteTemplate).toContain('provider = "sqlite"');
    expect(postgresTemplate).toContain('provider = "postgresql"');
  });
});
