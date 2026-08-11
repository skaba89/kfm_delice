import { describe, expect, it } from 'vitest';
import { evaluateSubscriptionAccess } from '@/lib/subscription-access';

describe('subscription access policy', () => {
  it('allows active and trial restaurants on operational accounts', () => {
    expect(evaluateSubscriptionAccess('active', 'active').allowed).toBe(true);
    expect(evaluateSubscriptionAccess('trial', 'trial').allowed).toBe(true);
  });

  it('allows legacy restaurants without an Account link', () => {
    expect(evaluateSubscriptionAccess('active', null).allowed).toBe(true);
  });

  it('keeps existing operations available when the account is over quota', () => {
    expect(evaluateSubscriptionAccess('active', 'over_quota').allowed).toBe(true);
  });

  it('blocks suspended or cancelled restaurants', () => {
    expect(evaluateSubscriptionAccess('suspended', 'active')).toEqual({
      allowed: false,
      code: 'RESTAURANT_UNAVAILABLE',
    });
    expect(evaluateSubscriptionAccess('cancelled', 'active').allowed).toBe(false);
  });

  it('blocks suspended or cancelled SaaS accounts', () => {
    expect(evaluateSubscriptionAccess('active', 'suspended')).toEqual({
      allowed: false,
      code: 'ACCOUNT_UNAVAILABLE',
    });
    expect(evaluateSubscriptionAccess('active', 'cancelled').allowed).toBe(false);
  });

  it('fails closed for unknown statuses', () => {
    expect(evaluateSubscriptionAccess('unknown', 'active').allowed).toBe(false);
    expect(evaluateSubscriptionAccess('active', 'unknown').allowed).toBe(false);
  });
});
