import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ entitlement: vi.fn() }));

vi.mock('@/lib/commercial-entitlements', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/commercial-entitlements')>();
  return {
    ...original,
    getRestaurantFeatureEntitlement: mocks.entitlement,
  };
});

import { commercialFeatureGate } from '@/lib/commercial-feature-gate';

describe('commercial feature HTTP gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when the effective plan includes the feature', async () => {
    mocks.entitlement.mockResolvedValue({ allowed: true, plan: 'starter', feature: 'invoices' });
    await expect(commercialFeatureGate('r1', 'invoices')).resolves.toBeNull();
  });

  it('returns a stable upgrade response when a feature is not sold in the plan', async () => {
    mocks.entitlement.mockResolvedValue({
      allowed: false,
      plan: 'starter',
      feature: 'drivers',
      code: 'FEATURE_NOT_INCLUDED',
    });

    const response = await commercialFeatureGate('r1', 'drivers');
    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
    await expect(response!.json()).resolves.toMatchObject({
      code: 'FEATURE_NOT_INCLUDED',
      feature: 'drivers',
      plan: 'starter',
      upgradeRequired: true,
    });
  });

  it('does not label a suspended account as an upgrade opportunity', async () => {
    mocks.entitlement.mockResolvedValue({
      allowed: false,
      plan: 'enterprise',
      feature: 'invoices',
      code: 'ACCOUNT_UNAVAILABLE',
    });

    const response = await commercialFeatureGate('r1', 'invoices');
    expect(response!.status).toBe(403);
    await expect(response!.json()).resolves.toMatchObject({
      code: 'ACCOUNT_UNAVAILABLE',
      upgradeRequired: false,
    });
  });
});
