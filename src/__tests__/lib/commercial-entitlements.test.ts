import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  restaurantFindUnique: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    restaurant: { findUnique: mocks.restaurantFindUnique },
  },
}));

import {
  getPlanFeatures,
  getRestaurantFeatureEntitlement,
  normalizeCommercialPlan,
  planIncludesFeature,
} from '@/lib/commercial-entitlements';

describe('commercial plan entitlements', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses Account.plan as the SaaS source of truth before Restaurant.plan', () => {
    expect(normalizeCommercialPlan('starter', 'enterprise')).toBe('starter');
  });

  it('falls back to Restaurant.plan for legacy restaurants without Account hierarchy', () => {
    expect(normalizeCommercialPlan(null, 'pro')).toBe('pro');
  });

  it('fails unknown legacy plan values down to free', () => {
    expect(normalizeCommercialPlan('unknown', 'unknown')).toBe('free');
  });

  it('enforces the existing progressive plan matrix', () => {
    expect(planIncludesFeature('free', 'invoices')).toBe(false);
    expect(planIncludesFeature('starter', 'invoices')).toBe(true);
    expect(planIncludesFeature('starter', 'drivers')).toBe(false);
    expect(planIncludesFeature('pro', 'drivers')).toBe(true);
    expect(planIncludesFeature('enterprise', 'white_label')).toBe(true);
  });

  it('treats custom as the enterprise capability baseline until overrides exist', () => {
    expect(getPlanFeatures('custom')).toEqual(getPlanFeatures('enterprise'));
  });

  it('returns FEATURE_NOT_INCLUDED for a module not sold in the effective plan', async () => {
    mocks.restaurantFindUnique.mockResolvedValue({
      plan: 'enterprise',
      account: { plan: 'starter', status: 'active' },
    });

    await expect(getRestaurantFeatureEntitlement('r1', 'drivers')).resolves.toEqual({
      allowed: false,
      plan: 'starter',
      feature: 'drivers',
      code: 'FEATURE_NOT_INCLUDED',
    });
  });

  it('blocks feature access for a suspended SaaS account even on enterprise', async () => {
    mocks.restaurantFindUnique.mockResolvedValue({
      plan: 'enterprise',
      account: { plan: 'enterprise', status: 'suspended' },
    });

    await expect(getRestaurantFeatureEntitlement('r1', 'invoices')).resolves.toMatchObject({
      allowed: false,
      code: 'ACCOUNT_UNAVAILABLE',
      plan: 'enterprise',
    });
  });
});
