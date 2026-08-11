import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    restaurant: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
    },
  },
}));

import { invalidateTenantCache, isFeatureEnabled, resolveTenant } from '@/lib/tenant';

const restaurant = {
  id: 'r1',
  slug: 'tenant-a',
  name: 'Tenant A',
  currency: 'GNF',
  locale: 'fr',
  plan: 'pro',
  status: 'active',
};

describe('public tenant subscription lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTenantCache();
  });

  it('resolves an active restaurant on an active account', async () => {
    mocks.findUnique.mockResolvedValue({
      ...restaurant,
      account: { plan: 'pro', status: 'active' },
    });

    await expect(resolveTenant('tenant-a')).resolves.toMatchObject({
      restaurantId: 'r1',
      accountStatus: 'active',
      plan: 'pro',
    });
  });

  it('uses Account.plan before a stale Restaurant.plan for all tenant feature checks', async () => {
    mocks.findUnique.mockResolvedValue({
      ...restaurant,
      plan: 'pro',
      account: { plan: 'starter', status: 'active' },
    });

    const tenant = await resolveTenant('tenant-a');
    expect(tenant).not.toBeNull();
    expect(tenant?.plan).toBe('starter');
    expect(isFeatureEnabled(tenant!, 'invoices')).toBe(true);
    expect(isFeatureEnabled(tenant!, 'drivers')).toBe(false);
    expect(isFeatureEnabled(tenant!, 'advanced_analytics')).toBe(false);
    expect(isFeatureEnabled(tenant!, 'exports')).toBe(false);
  });

  it('blocks an active restaurant when its SaaS account is suspended', async () => {
    mocks.findUnique.mockResolvedValue({
      ...restaurant,
      account: { plan: 'pro', status: 'suspended' },
    });

    await expect(resolveTenant('tenant-a')).resolves.toBeNull();
  });

  it('keeps legacy restaurants without account hierarchy accessible', async () => {
    mocks.findUnique.mockResolvedValue({
      ...restaurant,
      account: null,
    });

    await expect(resolveTenant('tenant-a')).resolves.toMatchObject({ restaurantId: 'r1', plan: 'pro' });
  });

  it('blocks cancelled restaurants even on an active account', async () => {
    mocks.findUnique.mockResolvedValue({
      ...restaurant,
      status: 'cancelled',
      account: { plan: 'pro', status: 'active' },
    });

    await expect(resolveTenant('tenant-a')).resolves.toBeNull();
  });
});
