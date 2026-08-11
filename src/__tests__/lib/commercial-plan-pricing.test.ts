import { describe, expect, it } from 'vitest';
import {
  getPlanMonthlyPriceGnf,
  resolveEffectiveCommercialPlan,
} from '@/lib/commercial-plan-catalog';

describe('commercial plan pricing catalog', () => {
  it('keeps public monthly prices in one source of truth', () => {
    expect(getPlanMonthlyPriceGnf('free')).toBe(0);
    expect(getPlanMonthlyPriceGnf('starter')).toBe(50_000);
    expect(getPlanMonthlyPriceGnf('pro')).toBe(150_000);
    expect(getPlanMonthlyPriceGnf('enterprise')).toBe(500_000);
  });

  it('does not invent a monthly price for negotiated custom contracts', () => {
    expect(getPlanMonthlyPriceGnf('custom')).toBeNull();
  });

  it('always prefers Account.plan over a stale Restaurant.plan', () => {
    expect(resolveEffectiveCommercialPlan('starter', 'pro')).toBe('starter');
    expect(resolveEffectiveCommercialPlan('custom', 'free')).toBe('custom');
  });

  it('keeps legacy standalone restaurants on Restaurant.plan', () => {
    expect(resolveEffectiveCommercialPlan(null, 'pro')).toBe('pro');
    expect(resolveEffectiveCommercialPlan(undefined, 'starter')).toBe('starter');
  });

  it('falls back safely to free for malformed legacy plan values', () => {
    expect(resolveEffectiveCommercialPlan('unknown', 'invalid')).toBe('free');
  });
});
