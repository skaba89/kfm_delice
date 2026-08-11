import { describe, expect, it } from 'vitest';
import { evaluateSubscriptionAccess } from '@/lib/subscription-access';

describe('commercial subscription dates', () => {
  it('keeps a date-only account trial active through the named UTC day', () => {
    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'trial',
      trialEndsAt: '2026-08-11',
      now: new Date('2026-08-11T23:59:59.999Z'),
    }).allowed).toBe(true);
  });

  it('expires a date-only account trial at the next UTC midnight', () => {
    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'trial',
      trialEndsAt: '2026-08-11',
      now: new Date('2026-08-12T00:00:00.000Z'),
    })).toMatchObject({
      allowed: false,
      code: 'ACCOUNT_TRIAL_EXPIRED',
    });
  });

  it('keeps a standalone Restaurant date-only trial active through its named UTC day', () => {
    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'trial',
      accountStatus: null,
      trialEndsAt: '2026-08-11',
      now: new Date('2026-08-11T23:59:59.999Z'),
    }).allowed).toBe(true);
  });

  it('expires a standalone Restaurant date-only trial when no Account hierarchy exists', () => {
    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'trial',
      accountStatus: null,
      trialEndsAt: '2026-08-11',
      now: new Date('2026-08-12T00:00:00.000Z'),
    })).toMatchObject({
      allowed: false,
      code: 'RESTAURANT_TRIAL_EXPIRED',
    });
  });

  it('uses the exact ISO timestamp written by public restaurant registration', () => {
    const trialEndsAt = '2026-08-25T10:30:00.000Z';

    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'trial',
      accountStatus: null,
      trialEndsAt,
      now: new Date('2026-08-25T10:30:00.000Z'),
    }).allowed).toBe(true);

    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'trial',
      accountStatus: null,
      trialEndsAt,
      now: new Date('2026-08-25T10:30:00.001Z'),
    })).toMatchObject({
      allowed: false,
      code: 'RESTAURANT_TRIAL_EXPIRED',
    });
  });

  it('accepts explicit ISO timezone offsets without using server-local timezone', () => {
    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'trial',
      accountStatus: null,
      trialEndsAt: '2026-08-25T12:30:00+02:00',
      now: new Date('2026-08-25T10:30:00.001Z'),
    })).toMatchObject({
      allowed: false,
      code: 'RESTAURANT_TRIAL_EXPIRED',
    });
  });

  it('does not let a legacy restaurant trial date override an active Account lifecycle', () => {
    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'trial',
      accountStatus: 'active',
      trialEndsAt: null,
      contractEndDate: '2026-12-31',
      now: new Date('2026-08-12T00:00:00.000Z'),
    }).allowed).toBe(true);
  });

  it('expires an active contract after the contract end day', () => {
    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'active',
      contractEndDate: '2026-08-31',
      now: new Date('2026-09-01T00:00:00.000Z'),
      contractGraceDays: 0,
    })).toMatchObject({
      allowed: false,
      code: 'ACCOUNT_CONTRACT_EXPIRED',
    });
  });

  it('applies an explicit contract grace period without mutating account state', () => {
    const duringGrace = evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'active',
      contractEndDate: '2026-08-31',
      now: new Date('2026-09-03T12:00:00.000Z'),
      contractGraceDays: 5,
    });
    expect(duringGrace.allowed).toBe(true);

    const afterGrace = evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'active',
      contractEndDate: '2026-08-31',
      now: new Date('2026-09-06T00:00:00.000Z'),
      contractGraceDays: 5,
    });
    expect(afterGrace).toMatchObject({ allowed: false, code: 'ACCOUNT_CONTRACT_EXPIRED' });
  });

  it('does not auto-lock legacy malformed date strings', () => {
    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'trial',
      trialEndsAt: '31/08/2026-invalid',
      now: new Date('2027-01-01T00:00:00.000Z'),
    }).allowed).toBe(true);
  });

  it('rejects ambiguous local ISO timestamps by treating them as legacy-invalid', () => {
    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'trial',
      accountStatus: null,
      trialEndsAt: '2026-08-25T10:30:00',
      now: new Date('2030-01-01T00:00:00.000Z'),
    }).allowed).toBe(true);
  });

  it('still blocks explicit commercial suspension regardless of dates', () => {
    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'suspended',
      contractEndDate: '2030-12-31',
      now: new Date('2026-08-11T00:00:00.000Z'),
    })).toMatchObject({ allowed: false, code: 'ACCOUNT_UNAVAILABLE' });
  });
});
