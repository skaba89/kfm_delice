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
  getPlanQuotaDefaults,
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

  it('enforces the progressive plan matrix including analytics and exports', () => {
    expect(planIncludesFeature('free', 'invoices')).toBe(false);
    expect(planIncludesFeature('starter', 'invoices')).toBe(true);
    expect(planIncludesFeature('starter', 'quotes')).toBe(false);
    expect(planIncludesFeature('starter', 'advanced_analytics')).toBe(false);
    expect(planIncludesFeature('starter', 'exports')).toBe(false);
    expect(planIncludesFeature('pro', 'quotes')).toBe(true);
    expect(planIncludesFeature('pro', 'drivers')).toBe(true);
    expect(planIncludesFeature('pro', 'advanced_analytics')).toBe(true);
    expect(planIncludesFeature('pro', 'exports')).toBe(true);
    expect(planIncludesFeature('enterprise', 'white_label')).toBe(true);
  });

  it('uses the same quota catalog sold on the pricing page', () => {
    expect(getPlanQuotaDefaults('free')).toEqual({
      maxRestaurants: 1,
      maxSecondaryRestaurants: 0,
      maxAdmins: 2,
      maxUsers: 5,
    });
    expect(getPlanQuotaDefaults('starter')).toEqual({
      maxRestaurants: 2,
      maxSecondaryRestaurants: 1,
      maxAdmins: 5,
      maxUsers: 15,
    });
    expect(getPlanQuotaDefaults('pro')).toMatchObject({
      maxRestaurants: 5,
      maxAdmins: 15,
      maxUsers: 50,
    });
    expect(getPlanQuotaDefaults('enterprise')).toMatchObject({
      maxRestaurants: 20,
      maxAdmins: 50,
      maxUsers: 200,
    });
  });

  it('returns defensive copies of quota defaults', () => {
    const quotas = getPlanQuotaDefaults('starter');
    quotas.maxRestaurants = 99;
    expect(getPlanQuotaDefaults('starter').maxRestaurants).toBe(2);
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
