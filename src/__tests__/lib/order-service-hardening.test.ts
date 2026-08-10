import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    idempotencyKey: { findUnique: vi.fn(), delete: vi.fn() },
    menuItem: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import {
  computeOrderRequestHash,
  calculatePlatformCommission,
  createOrderAtomically,
  type CreateOrderInput,
  type CreateOrderContext,
} from '@/lib/order-service';
import { db } from '@/lib/db';

const input: CreateOrderInput = {
  items: [{ menuItemId: 'm1', quantity: 2, note: 'sans piment' }],
  orderType: 'delivery',
  customerName: 'Client',
  phone: '+224600000000',
  deliveryAddress: 'Kaloum',
  paymentMethod: 'orange_money',
  promoCode: 'promo10',
  tip: 5000,
  note: 'appeler à la porte',
  idempotencyKey: 'idem-1',
};

const ctx: CreateOrderContext = {
  restaurantId: 'r1',
  customerId: 'c1',
  clientIp: '1.1.1.1',
  rawBodyHash: 'legacy-incomplete-hash',
};

describe('canonical order idempotency fingerprint', () => {
  it('is stable for normalization of promo and note whitespace', () => {
    const a = computeOrderRequestHash(input, ctx);
    const b = computeOrderRequestHash({ ...input, promoCode: ' PROMO10 ', note: ' appeler à la porte ' }, ctx);
    expect(a).toBe(b);
  });

  it.each([
    ['tip', { tip: 5001 }],
    ['payment method', { paymentMethod: 'cash' as const }],
    ['delivery address', { deliveryAddress: 'Ratoma' }],
    ['phone', { phone: '+224611111111' }],
    ['customer name', { customerName: 'Autre Client' }],
    ['quantity', { items: [{ menuItemId: 'm1', quantity: 3, note: 'sans piment' }] }],
    ['item note', { items: [{ menuItemId: 'm1', quantity: 2, note: 'avec piment' }] }],
  ])('changes when %s changes', (_label, patch) => {
    expect(computeOrderRequestHash(input, ctx)).not.toBe(computeOrderRequestHash({ ...input, ...patch }, ctx));
  });

  it('does not bind legitimate retries to the client IP', () => {
    expect(computeOrderRequestHash(input, ctx)).toBe(
      computeOrderRequestHash(input, { ...ctx, clientIp: '2.2.2.2' })
    );
  });

  it('binds the key to server-resolved tenant/customer/table context', () => {
    const base = computeOrderRequestHash(input, ctx);
    expect(base).not.toBe(computeOrderRequestHash(input, { ...ctx, restaurantId: 'r2' }));
    expect(base).not.toBe(computeOrderRequestHash(input, { ...ctx, customerId: 'c2' }));
    expect(base).not.toBe(computeOrderRequestHash(input, { ...ctx, tableId: 't1' }));
  });
});

describe('platform commission precision', () => {
  it('keeps decimal percentage precision', () => {
    expect(calculatePlatformCommission(10_000, 2.5)).toBe(250);
    expect(calculatePlatformCommission(10_000, 2.75)).toBe(275);
  });

  it('returns zero for invalid/non-positive values', () => {
    expect(calculatePlatformCommission(10_000, 0)).toBe(0);
    expect(calculatePlatformCommission(0, 2.5)).toBe(0);
  });
});

describe('idempotent replay uses the canonical server hash', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects the same key when tip changes even if the legacy route hash is identical', async () => {
    vi.mocked(db.idempotencyKey.findUnique).mockResolvedValue({
      id: 'ik1',
      expiresAt: new Date(Date.now() + 60_000),
      orderId: 'o1',
      order: { id: 'o1' },
      requestHash: computeOrderRequestHash(input, ctx),
      status: 'completed',
    } as any);

    const result = await createOrderAtomically(
      { ...input, tip: 6000 },
      { ...ctx, rawBodyHash: 'legacy-incomplete-hash' }
    );

    expect(result).toMatchObject({ success: false, status: 409, code: 'IDEMPOTENCY_HASH_MISMATCH' });
    expect(db.menuItem.findMany).not.toHaveBeenCalled();
  });
});
