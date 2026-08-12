import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  restaurantFindUnique: vi.fn(),
  restaurantFindFirst: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  overdueInvoiceFindFirst: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    restaurant: {
      findUnique: mocks.restaurantFindUnique,
      findFirst: mocks.restaurantFindFirst,
    },
    platformSubscription: {
      findUnique: mocks.subscriptionFindUnique,
    },
    platformInvoice: {
      findFirst: mocks.overdueInvoiceFindFirst,
    },
  },
}));

import {
  resolveTenant,
  resolveTenantFromRequest,
  resolveDefaultTenant,
  getRestaurantId,
  isTenantActive,
  isFeatureEnabled,
  invalidateTenantCache,
  extractSlug,
  generateSlug,
} from '@/lib/tenant';
import { db } from '@/lib/db';

const activeTenant = {
  id: 'r1', slug: 'kfm', name: 'KFM', currency: 'GNF', locale: 'fr', plan: 'pro', status: 'active',
};

const accountTenant = {
  ...activeTenant,
  account: {
    id: 'account-1',
    plan: 'pro',
    status: 'active',
    trialEndsAt: null,
    contractEndDate: null,
  },
};

describe('tenant lifecycle enforcement', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDefault = process.env.ALLOW_DEFAULT_TENANT;
  const originalBillingEnforcement = process.env.BILLING_ACCESS_ENFORCEMENT;
  const originalBillingGrace = process.env.BILLING_ACCESS_GRACE_DAYS;

  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTenantCache();
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_DEFAULT_TENANT;
    delete process.env.BILLING_ACCESS_ENFORCEMENT;
    delete process.env.BILLING_ACCESS_GRACE_DAYS;
    mocks.subscriptionFindUnique.mockResolvedValue(null);
    mocks.overdueInvoiceFindFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDefault === undefined) delete process.env.ALLOW_DEFAULT_TENANT;
    else process.env.ALLOW_DEFAULT_TENANT = originalDefault;
    if (originalBillingEnforcement === undefined) delete process.env.BILLING_ACCESS_ENFORCEMENT;
    else process.env.BILLING_ACCESS_ENFORCEMENT = originalBillingEnforcement;
    if (originalBillingGrace === undefined) delete process.env.BILLING_ACCESS_GRACE_DAYS;
    else process.env.BILLING_ACCESS_GRACE_DAYS = originalBillingGrace;
  });

  it('resolves active and trial tenants', async () => {
    vi.mocked(db.restaurant.findUnique).mockResolvedValue(activeTenant as any);
    await expect(resolveTenant('kfm')).resolves.toMatchObject({ restaurantId: 'r1', status: 'active' });

    invalidateTenantCache();
    vi.mocked(db.restaurant.findUnique).mockResolvedValue({ ...activeTenant, status: 'trial' } as any);
    await expect(resolveTenant('kfm')).resolves.toMatchObject({ status: 'trial' });
  });

  it.each(['suspended', 'cancelled', 'inactive'])('blocks %s tenants globally', async (status) => {
    vi.mocked(db.restaurant.findUnique).mockResolvedValue({ ...activeTenant, status } as any);
    await expect(resolveTenant('kfm')).resolves.toBeNull();
  });

  it('never uses an implicit default tenant in production', async () => {
    process.env.NODE_ENV = 'production';
    const request = new Request('https://example.com/api/menu');
    await expect(resolveTenantFromRequest(request)).resolves.toBeNull();
    expect(db.restaurant.findFirst).not.toHaveBeenCalled();
  });

  it('uses only active/trial restaurants for explicit default fallback', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEFAULT_TENANT = 'true';
    vi.mocked(db.restaurant.findFirst).mockResolvedValue(activeTenant as any);
    await expect(resolveDefaultTenant()).resolves.toMatchObject({ restaurantId: 'r1' });
    expect(db.restaurant.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['active', 'trial'] } },
    }));
  });

  it('blocks restaurant ID resolution for suspended tenants', async () => {
    vi.mocked(db.restaurant.findUnique).mockResolvedValue({ ...activeTenant, status: 'suspended' } as any);
    const request = new Request('https://example.com/api/orders', {
      headers: { 'x-restaurant-slug': 'kfm' },
    });
    await expect(getRestaurantId(request)).resolves.toBeNull();
  });

  it('disables paid features when the tenant is not active', () => {
    expect(isTenantActive({ status: 'active' })).toBe(true);
    expect(isTenantActive({ status: 'trial' })).toBe(true);
    expect(isTenantActive({ status: 'suspended' })).toBe(false);
    expect(isFeatureEnabled({
      restaurantId: 'r', slug: 's', name: 'n', currency: 'GNF', locale: 'fr', plan: 'pro', status: 'suspended',
    }, 'loyalty')).toBe(false);
  });

  it('loads billing state and blocks an account past the configured overdue grace', async () => {
    process.env.BILLING_ACCESS_ENFORCEMENT = 'true';
    process.env.BILLING_ACCESS_GRACE_DAYS = '7';
    mocks.restaurantFindUnique.mockResolvedValue(accountTenant);
    mocks.subscriptionFindUnique.mockResolvedValue({ status: 'past_due' });
    mocks.overdueInvoiceFindFirst.mockResolvedValue({ dueAt: new Date('2000-01-01T00:00:00.000Z') });

    await expect(resolveTenant('kfm')).resolves.toBeNull();
    expect(mocks.subscriptionFindUnique).toHaveBeenCalledWith({
      where: { accountId: 'account-1' },
      select: { status: true },
    });
    expect(mocks.overdueInvoiceFindFirst).toHaveBeenCalledWith({
      where: { accountId: 'account-1', status: 'overdue' },
      orderBy: { dueAt: 'asc' },
      select: { dueAt: true },
    });
  });

  it('does not query billing tables when collection enforcement is disabled', async () => {
    process.env.BILLING_ACCESS_ENFORCEMENT = 'false';
    mocks.restaurantFindUnique.mockResolvedValue(accountTenant);

    await expect(resolveTenant('kfm')).resolves.toMatchObject({
      restaurantId: 'r1',
      accountId: 'account-1',
    });
    expect(mocks.subscriptionFindUnique).not.toHaveBeenCalled();
    expect(mocks.overdueInvoiceFindFirst).not.toHaveBeenCalled();
  });
});

describe('tenant identifiers', () => {
  it('extracts explicit header, path and query tenants', () => {
    expect(extractSlug(new Request('https://example.com/api/menu', { headers: { 'x-restaurant-slug': 'header-slug' } }))).toBe('header-slug');
    expect(extractSlug(new Request('https://example.com/r/path-slug/menu'))).toBe('path-slug');
    expect(extractSlug(new Request('https://example.com/api/menu?slug=query-slug'))).toBe('query-slug');
  });

  it('generates stable URL-safe slugs', () => {
    expect(generateSlug('KFM Délice Conakry')).toBe('kfm-delice-conakry');
  });
});
