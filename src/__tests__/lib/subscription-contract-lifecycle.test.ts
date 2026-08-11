import { describe, expect, it } from 'vitest';
import { evaluateSubscriptionAccess } from '@/lib/subscription-access';

describe('commercial subscription dates', () => {
  it('keeps a date-only trial active through the named UTC day', () => {
    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'trial',
      trialEndsAt: '2026-08-11',
      now: new Date('2026-08-11T23:59:59.999Z'),
    }).allowed).toBe(true);
  });

  it('expires a date-only trial at the next UTC midnight', () => {
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

  it('still blocks explicit commercial suspension regardless of dates', () => {
    expect(evaluateSubscriptionAccess({
      restaurantStatus: 'active',
      accountStatus: 'suspended',
      contractEndDate: '2030-12-31',
      now: new Date('2026-08-11T00:00:00.000Z'),
    })).toMatchObject({ allowed: false, code: 'ACCOUNT_UNAVAILABLE' });
  });
});
