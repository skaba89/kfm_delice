import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticatePlatformAdmin: vi.fn(),
  restaurantFindMany: vi.fn(),
  restaurantFindUnique: vi.fn(),
  restaurantUpdate: vi.fn(),
  accountFindMany: vi.fn(),
  invalidateConfigCache: vi.fn(),
  invalidateTenantCache: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authenticatePlatformAdmin: mocks.authenticatePlatformAdmin,
}));

vi.mock('@/lib/constants', () => ({
  invalidateConfigCache: mocks.invalidateConfigCache,
}));

vi.mock('@/lib/tenant', () => ({
  invalidateTenantCache: mocks.invalidateTenantCache,
}));

vi.mock('@/lib/audit', () => ({
  logAudit: mocks.logAudit,
}));

vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  bigIntToNumber: (value: unknown) => value,
  db: {
    restaurant: {
      findMany: mocks.restaurantFindMany,
      findUnique: mocks.restaurantFindUnique,
      update: mocks.restaurantUpdate,
    },
    account: {
      findMany: mocks.accountFindMany,
    },
  },
}));

import { GET, PATCH } from '@/app/api/platform/restaurants/route';

const platformAdmin = { id: 'platform-1', email: 'platform@example.test', role: 'super_admin' };

function baseRestaurant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'restaurant-1',
    name: 'Restaurant A',
    slug: 'restaurant-a',
    status: 'active',
    plan: 'free',
    accountId: null,
    account: null,
    config: null,
    _count: { orders: 0, customers: 0, admins: 0, menuItems: 0 },
    ...overrides,
  };
}

describe('platform restaurant commercial source of truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatePlatformAdmin.mockResolvedValue(platformAdmin);
    mocks.logAudit.mockResolvedValue(undefined);
  });

  it('returns Account.plan as the effective plan and counts each SaaS account only once', async () => {
    mocks.restaurantFindMany.mockResolvedValue([
      baseRestaurant({
        id: 'r1',
        slug: 'r1',
        plan: 'free',
        accountId: 'a1',
        account: { id: 'a1', name: 'Compte Starter', plan: 'starter', status: 'active' },
      }),
      baseRestaurant({
        id: 'r2',
        slug: 'r2',
        plan: 'pro',
        accountId: 'a1',
        account: { id: 'a1', name: 'Compte Starter', plan: 'starter', status: 'active' },
      }),
      baseRestaurant({ id: 'legacy-pro', slug: 'legacy-pro', plan: 'pro', accountId: null, account: null }),
      baseRestaurant({
        id: 'r-custom',
        slug: 'r-custom',
        plan: 'enterprise',
        accountId: 'a2',
        account: { id: 'a2', name: 'Compte Custom', plan: 'custom', status: 'active' },
      }),
    ]);
    mocks.accountFindMany.mockResolvedValue([
      { id: 'a1', plan: 'starter', status: 'active' },
      { id: 'a2', plan: 'custom', status: 'active' },
      { id: 'a3', plan: 'pro', status: 'trial' },
      { id: 'a4', plan: 'enterprise', status: 'suspended' },
    ]);

    const response = await GET(new Request('https://example.test/api/platform/restaurants'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0]).toMatchObject({
      storedPlan: 'free',
      plan: 'starter',
      effectivePlan: 'starter',
      planSource: 'account',
    });
    expect(body.data[1]).toMatchObject({ storedPlan: 'pro', plan: 'starter' });
    expect(body.data[2]).toMatchObject({ storedPlan: 'pro', plan: 'pro', planSource: 'restaurant' });
    expect(body.data[3]).toMatchObject({ plan: 'custom', planSource: 'account' });

    // Starter account = 50k once, not once per restaurant. Legacy Pro = 150k.
    // Custom is intentionally unpriced; trial/suspended accounts are excluded.
    expect(body.stats).toMatchObject({
      estimatedMonthlyCatalogValue: 200_000,
      totalRevenue: 200_000,
      unpricedCustomSubscriptions: 1,
      legacyStandaloneRestaurants: 1,
    });
  });

  it('rejects a restaurant-level plan change when an Account is authoritative', async () => {
    mocks.restaurantFindUnique.mockResolvedValue({
      id: 'r1',
      slug: 'r1',
      status: 'active',
      plan: 'free',
      accountId: 'a1',
      account: { plan: 'starter' },
    });

    const response = await PATCH(new Request('https://example.test/api/platform/restaurants', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'r1', plan: 'pro' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      code: 'ACCOUNT_PLAN_AUTHORITATIVE',
      accountId: 'a1',
      effectivePlan: 'starter',
    });
    expect(mocks.restaurantUpdate).not.toHaveBeenCalled();
  });

  it('keeps legacy standalone plan edits supported and audited', async () => {
    mocks.restaurantFindUnique.mockResolvedValue({
      id: 'legacy-1',
      slug: 'legacy-1',
      status: 'active',
      plan: 'starter',
      accountId: null,
      account: null,
    });
    mocks.restaurantUpdate.mockResolvedValue({
      id: 'legacy-1',
      slug: 'legacy-1',
      status: 'active',
      plan: 'pro',
      accountId: null,
    });

    const response = await PATCH(new Request('https://example.test/api/platform/restaurants', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'legacy-1', plan: 'pro' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ plan: 'pro', storedPlan: 'pro', planSource: 'restaurant' });
    expect(mocks.restaurantUpdate).toHaveBeenCalledWith({
      where: { id: 'legacy-1' },
      data: { plan: 'pro' },
    });
    expect(mocks.invalidateConfigCache).toHaveBeenCalledWith('legacy-1');
    expect(mocks.invalidateTenantCache).toHaveBeenCalledWith('legacy-1');
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'platform_restaurant_update',
      entityId: 'legacy-1',
    }));
  });
});
