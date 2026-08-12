import { describe, expect, it } from 'vitest';
import {
  evaluateSubscriptionAccess,
  getBillingAccessGraceDays,
  isBillingAccessEnforcementEnabled,
} from '@/lib/subscription-access';

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

  it('keeps billing enforcement opt-in for safe rollout', () => {
    const result = evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'active',
      billingStatus: 'past_due',
      billingOverdueSince: '2026-08-01T00:00:00.000Z',
      billingGraceDays: 0,
      billingEnforcementEnabled: false,
      now: new Date('2026-08-12T00:00:00.000Z'),
    });

    expect(result).toEqual({ allowed: true });
    expect(isBillingAccessEnforcementEnabled('false')).toBe(false);
    expect(isBillingAccessEnforcementEnabled('true')).toBe(true);
  });

  it('keeps a past-due tenant online during the configured grace period', () => {
    const result = evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'active',
      billingStatus: 'past_due',
      billingOverdueSince: '2026-08-10T00:00:00.000Z',
      billingGraceDays: 7,
      billingEnforcementEnabled: true,
      now: new Date('2026-08-12T00:00:00.000Z'),
    });

    expect(result).toEqual({ allowed: true });
  });

  it('blocks a past-due tenant only after a real overdue timestamp exceeds grace', () => {
    const result = evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'active',
      billingStatus: 'past_due',
      billingOverdueSince: '2026-08-01T00:00:00.000Z',
      billingGraceDays: 7,
      billingEnforcementEnabled: true,
      now: new Date('2026-08-12T00:00:00.000Z'),
    });

    expect(result).toEqual({
      allowed: false,
      code: 'ACCOUNT_BILLING_PAST_DUE',
    });
  });

  it('never cuts access from a stale past_due status without an overdue invoice timestamp', () => {
    const result = evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'active',
      billingStatus: 'past_due',
      billingOverdueSince: null,
      billingGraceDays: 0,
      billingEnforcementEnabled: true,
      now: new Date('2026-08-12T00:00:00.000Z'),
    });

    expect(result).toEqual({ allowed: true });
  });

  it('blocks paused or cancelled billing subscriptions when enforcement is active', () => {
    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'active',
      billingStatus: 'paused',
      billingEnforcementEnabled: true,
    })).toEqual({ allowed: false, code: 'ACCOUNT_BILLING_UNAVAILABLE' });

    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'active',
      billingStatus: 'cancelled',
      billingEnforcementEnabled: true,
    })).toEqual({ allowed: false, code: 'ACCOUNT_BILLING_UNAVAILABLE' });
  });

  it('bounds billing grace to a safe 0-90 day range with a 7 day default', () => {
    expect(getBillingAccessGraceDays(undefined)).toBe(7);
    expect(getBillingAccessGraceDays(-5)).toBe(0);
    expect(getBillingAccessGraceDays(120)).toBe(90);
  });
});
