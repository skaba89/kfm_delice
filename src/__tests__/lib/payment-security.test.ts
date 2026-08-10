import { describe, expect, it } from 'vitest';
import {
  computePaymentRequestHash,
  isValidPaymentTransition,
  paymentWebhookEventId,
  resolvePaymentIdempotencyKey,
  signInternalPaymentUpdate,
  verifyInternalPaymentUpdate,
} from '@/lib/payment-security';

describe('payment idempotency', () => {
  it('generates a stable fallback key for legacy clients', () => {
    expect(resolvePaymentIdempotencyKey(undefined, 'order-1', 'orange_money')).toBe(
      resolvePaymentIdempotencyKey('', 'order-1', 'orange_money')
    );
    expect(resolvePaymentIdempotencyKey(undefined, 'order-1', 'orange_money')).not.toBe(
      resolvePaymentIdempotencyKey(undefined, 'order-1', 'wave')
    );
  });

  it('preserves an explicit client key after trimming', () => {
    expect(resolvePaymentIdempotencyKey('  client-key  ', 'o1', 'cash')).toBe('client-key');
  });

  it('binds the request hash to financial and tenant context', () => {
    const base = {
      orderId: 'o1', method: 'wave', phone: '600', customerName: 'Client',
      amount: 10000, restaurantId: 'r1', customerId: 'c1',
    };
    const hash = computePaymentRequestHash(base);
    expect(hash).not.toBe(computePaymentRequestHash({ ...base, amount: 11000 }));
    expect(hash).not.toBe(computePaymentRequestHash({ ...base, method: 'cash' }));
    expect(hash).not.toBe(computePaymentRequestHash({ ...base, restaurantId: 'r2' }));
    expect(hash).not.toBe(computePaymentRequestHash({ ...base, customerId: 'c2' }));
  });
});

describe('payment state machine', () => {
  it.each([
    ['pending', 'processing'],
    ['pending', 'paid'],
    ['pending', 'failed'],
    ['processing', 'paid'],
    ['processing', 'failed'],
    ['paid', 'refunded'],
  ])('allows %s -> %s', (from, to) => {
    expect(isValidPaymentTransition(from, to)).toBe(true);
  });

  it.each([
    ['paid', 'failed'],
    ['failed', 'paid'],
    ['refunded', 'paid'],
    ['refunded', 'failed'],
  ])('blocks terminal regression %s -> %s', (from, to) => {
    expect(isValidPaymentTransition(from, to)).toBe(false);
  });

  it('treats same-state replay as idempotent', () => {
    expect(isValidPaymentTransition('paid', 'paid')).toBe(true);
  });
});

describe('internal payment simulation signatures', () => {
  const secret = 'test-internal-secret';
  const body = { id: 'p1', status: 'paid', transactionRef: 'txn-1' };

  it('signs the full update and rejects tampering', () => {
    const now = 1_800_000_000_000;
    const signature = signInternalPaymentUpdate(body, now, secret);
    expect(verifyInternalPaymentUpdate(body, String(now), signature, secret, now)).toBe(true);
    expect(verifyInternalPaymentUpdate({ ...body, status: 'failed' }, String(now), signature, secret, now)).toBe(false);
  });

  it('rejects replay outside the timestamp window', () => {
    const timestamp = 1_800_000_000_000;
    const signature = signInternalPaymentUpdate(body, timestamp, secret);
    expect(verifyInternalPaymentUpdate(body, String(timestamp), signature, secret, timestamp + 6 * 60 * 1000)).toBe(false);
  });
});

describe('provider webhook event identity', () => {
  it('uses explicit provider event IDs when supplied', () => {
    expect(paymentWebhookEventId({ eventId: 'evt-1' }, '{"eventId":"evt-1"}')).toBe('evt-1');
  });

  it('deduplicates identical retry bodies but not changed status bodies', () => {
    const body1 = '{"transactionId":"tx1","status":"processing"}';
    const body2 = '{"transactionId":"tx1","status":"paid"}';
    expect(paymentWebhookEventId({}, body1)).toBe(paymentWebhookEventId({}, body1));
    expect(paymentWebhookEventId({}, body1)).not.toBe(paymentWebhookEventId({}, body2));
  });
});
