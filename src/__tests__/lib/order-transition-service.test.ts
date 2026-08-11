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

  it('commits delivery earnings, loyalty and invoice inside one transaction when included in plan', async () => {
    const existing = {
      id: 'order-delivery-1', status: 'delivering', driverId: 'd1', customerId: 'c1',
      total: 10000 as any, deliveryFee: 1000 as any, tax: 0 as any,
      customerName: 'Client', phone: '600', items: [], paymentStatus: 'paid', restaurantId: 'r1',
    };
    const finalOrder = { ...existing, status: 'delivered', driverEarning: 1000 as any };
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
      restaurant: {
        findUnique: vi.fn().mockResolvedValue({
          loyaltyPointsRate: 1,
          plan: 'starter',
          account: { plan: 'starter', status: 'active' },
        }),
      },
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

    const driverUpdate = tx.driver.update.mock.calls[0][0];
    expect(driverUpdate.data.status).toBe('available');
    expect(driverUpdate.data.totalDeliveries).toEqual({ increment: 1 });
    expect(Number(driverUpdate.data.totalEarnings.increment)).toBe(1000);

    const customerUpdate = tx.customer.update.mock.calls[0][0];
    expect(customerUpdate.data.totalOrders).toEqual({ increment: 1 });
    expect(Number(customerUpdate.data.totalSpent.increment)).toBe(10000);
    expect(customerUpdate.data.loyaltyPoints).toEqual({ increment: 10 });

    expect(tx.loyaltyPointsHistory.create).toHaveBeenCalled();
    const invoiceCreate = tx.invoice.create.mock.calls[0][0];
    expect(invoiceCreate.data.orderId).toBe(existing.id);
    expect(invoiceCreate.data.status).toBe('paid');
    expect(Number(invoiceCreate.data.total)).toBe(10000);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it('keeps core customer stats but skips loyalty and invoice effects on Free', async () => {
    const existing = {
      id: 'order-free-1', status: 'ready', driverId: null, customerId: 'c1',
      total: 12000 as any, deliveryFee: 0 as any, tax: 0 as any,
      customerName: 'Client', phone: '600', items: [], paymentStatus: 'paid', restaurantId: 'r1',
    };
    const finalOrder = { ...existing, status: 'delivered' };
    const tx = {
      order: {
        findFirst: vi.fn().mockResolvedValueOnce(existing).mockResolvedValueOnce(finalOrder),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
      },
      driver: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      customer: {
        findFirst: vi.fn().mockResolvedValue({ id: 'c1' }),
        update: vi.fn().mockResolvedValue({ id: 'c1' }),
      },
      restaurant: {
        findUnique: vi.fn().mockResolvedValue({
          loyaltyPointsRate: 3,
          plan: 'free',
          account: { plan: 'free', status: 'active' },
        }),
      },
      loyaltyPointsHistory: { create: vi.fn() },
      invoice: { findFirst: vi.fn(), create: vi.fn() },
      stockMovement: { findMany: vi.fn(), create: vi.fn() },
      stockItem: { updateMany: vi.fn() },
    } as any;
    vi.mocked(db.$transaction).mockImplementation(async (callback: any) => callback(tx));

    const result = await applyOrderPatchAtomically(
      { id: existing.id, status: 'delivered' },
      { restaurantId: 'r1', actorId: 'admin1', actorRole: 'manager' }
    );

    expect(result.ok).toBe(true);
    const customerUpdate = tx.customer.update.mock.calls[0][0];
    expect(customerUpdate.data.totalOrders).toEqual({ increment: 1 });
    expect(Number(customerUpdate.data.totalSpent.increment)).toBe(12000);
    expect(customerUpdate.data.loyaltyPoints).toBeUndefined();
    expect(tx.loyaltyPointsHistory.create).not.toHaveBeenCalled();
    expect(tx.invoice.findFirst).not.toHaveBeenCalled();
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it('restores exactly the recorded outbound stock on cancellation', async () => {
    const existing = {
      id: 'order-cancel-1', status: 'confirmed', driverId: null, customerId: null,
      total: 10000 as any, deliveryFee: 0 as any, tax: 0 as any,
      customerName: 'Client', phone: '', items: [], paymentStatus: 'pending', restaurantId: 'r1',
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
