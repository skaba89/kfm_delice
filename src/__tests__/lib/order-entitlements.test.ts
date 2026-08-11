import { describe, expect, it, vi } from 'vitest';
import { checkMonthlyOrderEntitlement, getUtcMonthWindow } from '@/lib/order-entitlements';

describe('monthly order entitlements', () => {
  it('uses UTC calendar month boundaries', () => {
    const { start, end } = getUtcMonthWindow(new Date('2026-08-31T23:59:59.999Z'));
    expect(start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('keeps legacy restaurants without Account hierarchy operational', async () => {
    const tx = {
      restaurant: {
        findUnique: vi.fn().mockResolvedValue({ account: null }),
        findMany: vi.fn(),
      },
      order: { count: vi.fn() },
    };

    await expect(checkMonthlyOrderEntitlement(tx, 'r1')).resolves.toEqual({ allowed: true });
    expect(tx.order.count).not.toHaveBeenCalled();
  });

  it('blocks suspended accounts before counting usage', async () => {
    const tx = {
      restaurant: {
        findUnique: vi.fn().mockResolvedValue({
          account: { id: 'a1', status: 'suspended', maxOrdersPerMonth: 1000 },
        }),
        findMany: vi.fn(),
      },
      order: { count: vi.fn() },
    };

    const result = await checkMonthlyOrderEntitlement(tx, 'r1');
    expect(result).toMatchObject({ allowed: false, code: 'ACCOUNT_UNAVAILABLE' });
    expect(tx.order.count).not.toHaveBeenCalled();
  });

  it('counts all restaurants of the account in the same UTC month', async () => {
    const tx = {
      restaurant: {
        findUnique: vi.fn().mockResolvedValue({
          account: { id: 'a1', status: 'active', maxOrdersPerMonth: 10 },
        }),
        findMany: vi.fn().mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]),
      },
      order: { count: vi.fn().mockResolvedValue(9) },
    };

    const result = await checkMonthlyOrderEntitlement(tx, 'r1', new Date('2026-08-15T12:00:00Z'));
    expect(result).toMatchObject({ allowed: true, usage: 9, limit: 10 });
    expect(tx.order.count).toHaveBeenCalledWith({
      where: {
        restaurantId: { in: ['r1', 'r2'] },
        createdAt: {
          gte: new Date('2026-08-01T00:00:00.000Z'),
          lt: new Date('2026-09-01T00:00:00.000Z'),
        },
      },
    });
  });

  it('rejects the next order when the sold monthly quota is reached', async () => {
    const tx = {
      restaurant: {
        findUnique: vi.fn().mockResolvedValue({
          account: { id: 'a1', status: 'active', maxOrdersPerMonth: 10 },
        }),
        findMany: vi.fn().mockResolvedValue([{ id: 'r1' }]),
      },
      order: { count: vi.fn().mockResolvedValue(10) },
    };

    const result = await checkMonthlyOrderEntitlement(tx, 'r1');
    expect(result).toMatchObject({
      allowed: false,
      code: 'ACCOUNT_MONTHLY_ORDER_QUOTA_REACHED',
      usage: 10,
      limit: 10,
    });
  });

  it('treats a zero legacy quota as no order entitlement, not unlimited usage', async () => {
    const tx = {
      restaurant: {
        findUnique: vi.fn().mockResolvedValue({
          account: { id: 'a1', status: 'active', maxOrdersPerMonth: 0 },
        }),
        findMany: vi.fn().mockResolvedValue([{ id: 'r1' }]),
      },
      order: { count: vi.fn().mockResolvedValue(0) },
    };

    const result = await checkMonthlyOrderEntitlement(tx, 'r1');
    expect(result).toMatchObject({
      allowed: false,
      code: 'ACCOUNT_MONTHLY_ORDER_QUOTA_REACHED',
      usage: 0,
      limit: 0,
    });
  });
});
