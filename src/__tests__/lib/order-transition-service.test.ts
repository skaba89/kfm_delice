import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: { $transaction: vi.fn() },
}));

import { db } from '@/lib/db';
import {
  applyOrderPatchAtomically,
  getDisallowedOrderPatchFields,
} from '@/lib/order-transition-service';

describe('order PATCH role field matrix', () => {
  it('blocks financial mutations from kitchen/staff', () => {
    expect(getDisallowedOrderPatchFields('kitchen', {
      id: 'o1', status: 'preparing', total: 1, discount: 1,
    })).toEqual(expect.arrayContaining(['total', 'discount']));
    expect(getDisallowedOrderPatchFields('staff', {
      id: 'o1', status: 'confirmed', tax: 1,
    })).toContain('tax');
  });

  it('allows full edit surface for admin/manager', () => {
    expect(getDisallowedOrderPatchFields('manager', {
      id: 'o1', total: 1000, discount: 10, driverId: 'd1', customerId: 'c1',
    })).toEqual([]);
  });
});

describe('atomic terminal order effects', () => {
  beforeEach(() => vi.clearAllMocks());

  it('commits delivery earnings, loyalty and invoice inside one transaction', async () => {
    const existing = {
      id: 'order-delivery-1', status: 'delivering', driverId: 'd1', customerId: 'c1',
      total: 10000n, deliveryFee: 1000n, tax: 0n, customerName: 'Client', phone: '600',
      items: [], paymentStatus: 'paid', restaurantId: 'r1',
    };
    const finalOrder = { ...existing, status: 'delivered', driverEarning: 1000n };
    const tx = {
      order: {
        findFirst: vi.fn().mockResolvedValueOnce(existing).mockResolvedValueOnce(finalOrder),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue(finalOrder),
      },
      driver: {
        findFirst: vi.fn().mockResolvedValue({ id: 'd1', commissionRate: 10 }),
        update: vi.fn().mockResolvedValue({ id: 'd1' }),
        updateMany: vi.fn(),
      },
      customer: {
        findFirst: vi.fn().mockResolvedValue({ id: 'c1' }),
        update: vi.fn().mockResolvedValue({ id: 'c1' }),
      },
      restaurant: { findUnique: vi.fn().mockResolvedValue({ loyaltyPointsRate: 1 }) },
      loyaltyPointsHistory: { create: vi.fn().mockResolvedValue({ id: 'lh1' }) },
      invoice: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'inv1' }),
      },
      stockMovement: { findMany: vi.fn(), create: vi.fn() },
      stockItem: { updateMany: vi.fn() },
    } as any;
    vi.mocked(db.$transaction).mockImplementation(async (callback: any) => callback(tx));

    const result = await applyOrderPatchAtomically(
      { id: existing.id, status: 'delivered' },
      { restaurantId: 'r1', actorId: 'admin1', actorRole: 'manager' }
    );

    expect(result.ok).toBe(true);
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'delivering' }),
      data: expect.objectContaining({ status: 'delivered' }),
    }));
    expect(tx.driver.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'available',
        totalDeliveries: { increment: 1 },
        totalEarnings: { increment: 1000n },
      }),
    }));
    expect(tx.customer.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ totalOrders: { increment: 1 }, totalSpent: { increment: 10000n } }),
    }));
    expect(tx.loyaltyPointsHistory.create).toHaveBeenCalled();
    expect(tx.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ orderId: existing.id, status: 'paid' }),
    }));
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it('restores exactly the recorded outbound stock on cancellation', async () => {
    const existing = {
      id: 'order-cancel-1', status: 'confirmed', driverId: null, customerId: null,
      total: 10000n, deliveryFee: 0n, tax: 0n, customerName: 'Client', phone: '',
      items: [], paymentStatus: 'pending', restaurantId: 'r1',
    };
    const finalOrder = { ...existing, status: 'cancelled' };
    const tx = {
      order: {
        findFirst: vi.fn().mockResolvedValueOnce(existing).mockResolvedValueOnce(finalOrder),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
      },
      driver: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      customer: { findFirst: vi.fn(), update: vi.fn() },
      restaurant: { findUnique: vi.fn() },
      loyaltyPointsHistory: { create: vi.fn() },
      invoice: { findFirst: vi.fn(), create: vi.fn() },
      stockMovement: {
        findMany: vi.fn().mockResolvedValue([
          { stockItemId: 's1', quantity: 2 },
          { stockItemId: 's1', quantity: 1 },
          { stockItemId: 's2', quantity: 0.5 },
        ]),
        create: vi.fn().mockResolvedValue({ id: 'mv' }),
      },
      stockItem: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    } as any;
    vi.mocked(db.$transaction).mockImplementation(async (callback: any) => callback(tx));

    const result = await applyOrderPatchAtomically(
      { id: existing.id, status: 'cancelled' },
      { restaurantId: 'r1', actorId: 'admin1', actorRole: 'manager' }
    );

    expect(result.ok).toBe(true);
    expect(tx.stockItem.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', restaurantId: 'r1' },
      data: { quantity: { increment: 3 } },
    });
    expect(tx.stockItem.updateMany).toHaveBeenCalledWith({
      where: { id: 's2', restaurantId: 'r1' },
      data: { quantity: { increment: 0.5 } },
    });
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });
});
