import { describe, expect, it } from 'vitest';
import {
  BillingDomainError,
  assertPaymentFitsOutstanding,
  calculateOutstanding,
  deriveSubscriptionUnitAmount,
  parseMoneyToBigInt,
  parseOptionalIsoDate,
  serializeBillingMetadata,
  validateBillingPeriod,
} from '@/lib/platform-billing';

describe('platform billing domain rules', () => {
  it('derives standard plan prices exclusively from the commercial catalog', () => {
    expect(deriveSubscriptionUnitAmount({
      plan: 'starter',
      billingCycle: 'monthly',
      customUnitAmount: 999_999,
    }).unitAmount).toBe(50_000n);

    expect(deriveSubscriptionUnitAmount({
      plan: 'pro',
      billingCycle: 'annual',
    }).unitAmount).toBe(1_800_000n);
  });

  it('requires an explicit negotiated amount for a new custom subscription', () => {
    expect(() => deriveSubscriptionUnitAmount({
      plan: 'custom',
      billingCycle: 'monthly',
    })).toThrowError(expect.objectContaining({ code: 'BILLING_CUSTOM_AMOUNT_REQUIRED' }));

    expect(deriveSubscriptionUnitAmount({
      plan: 'custom',
      billingCycle: 'monthly',
      customUnitAmount: '275000',
    }).unitAmount).toBe(275_000n);
  });

  it('preserves an existing custom amount when editing unrelated subscription fields', () => {
    expect(deriveSubscriptionUnitAmount({
      plan: 'custom',
      billingCycle: 'annual',
      existingUnitAmount: 3_000_000n,
    }).unitAmount).toBe(3_000_000n);
  });

  it('parses GNF amounts without floating point arithmetic', () => {
    expect(parseMoneyToBigInt('5000000000')).toBe(5_000_000_000n);
    expect(() => parseMoneyToBigInt(-1)).toThrow(BillingDomainError);
    expect(() => parseMoneyToBigInt('1.50')).toThrow(BillingDomainError);
  });

  it('rejects invalid billing periods', () => {
    const start = parseOptionalIsoDate('2026-08-01T00:00:00Z', 'periodStart');
    const end = parseOptionalIsoDate('2026-07-31T23:59:59Z', 'periodEnd');
    expect(() => validateBillingPeriod(start, end)).toThrowError(
      expect.objectContaining({ code: 'BILLING_INVALID_PERIOD' }),
    );
  });

  it('computes outstanding balance and rejects overpayment', () => {
    expect(calculateOutstanding(100_000n, 40_000n)).toBe(60_000n);
    expect(() => assertPaymentFitsOutstanding(60_001n, 60_000n)).toThrowError(
      expect.objectContaining({ code: 'BILLING_OVERPAYMENT' }),
    );
    expect(() => assertPaymentFitsOutstanding(60_000n, 60_000n)).not.toThrow();
  });

  it('bounds serialized payment metadata', () => {
    expect(serializeBillingMetadata({ channel: 'bank_transfer' })).toContain('bank_transfer');
    expect(() => serializeBillingMetadata({ payload: 'x'.repeat(5000) })).toThrowError(
      expect.objectContaining({ code: 'BILLING_METADATA_TOO_LARGE' }),
    );
  });
});
