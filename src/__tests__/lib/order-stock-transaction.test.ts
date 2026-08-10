import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    idempotencyKey: { findUnique: vi.fn(), delete: vi.fn() },
    menuItem: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { createOrderAtomically } from '@/lib/order-service';
import { db } from '@/lib/db';

describe('order stock transaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('decrements linked stock and records movement inside the order transaction', async () => {
    vi.mocked(db.idempotencyKey.findUnique).mockResolvedValue(null as any);
    vi.mocked(db.menuItem.findMany).mockResolvedValue([
      { id: 'm1', name: 'Poulet', price: 10000n, available: true, stockItemId: 's1' },
    ] as any);

    const tx = {
      restaurant: { findUnique: vi.fn().mockResolvedValue({ deliveryFee: 0n, minDelivery: 0n, account: null }) },
      order: { create: vi.fn().mockResolvedValue({ id: 'o1' }) },
      orderItem: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      stockItem: {
        findFirst: vi.fn().mockResolvedValue({ id: 's1', quantity: 10 }),
        update: vi.fn().mockResolvedValue({ id: 's1', quantity: 8 }),
      },
      stockMovement: { create: vi.fn().mockResolvedValue({ id: 'mv1' }) },
    } as any;
    vi.mocked(db.$transaction).mockImplementation(async (callback: any) => callback(tx));

    const result = await createOrderAtomically(
      {
        items: [{ menuItemId: 'm1', quantity: 2 }],
        orderType: 'takeaway',
        paymentMethod: 'cash',
      },
      { restaurantId: 'r1', clientIp: '1.1.1.1' }
    );

    expect(result.success).toBe(true);
    expect(tx.stockItem.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { quantity: 8 },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stockItemId: 's1',
        restaurantId: 'r1',
        type: 'out',
        quantity: 2,
      }),
    });
  });

  it('fails the order transaction when a linked stock write fails', async () => {
    vi.mocked(db.idempotencyKey.findUnique).mockResolvedValue(null as any);
    vi.mocked(db.menuItem.findMany).mockResolvedValue([
      { id: 'm1', name: 'Poulet', price: 10000n, available: true, stockItemId: 's1' },
    ] as any);

    const tx = {
      restaurant: { findUnique: vi.fn().mockResolvedValue({ deliveryFee: 0n, minDelivery: 0n, account: null }) },
      order: { create: vi.fn().mockResolvedValue({ id: 'o1' }) },
      orderItem: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      stockItem: {
        findFirst: vi.fn().mockResolvedValue({ id: 's1', quantity: 10 }),
        update: vi.fn().mockRejectedValue(new Error('stock write failed')),
      },
      stockMovement: { create: vi.fn() },
    } as any;
    vi.mocked(db.$transaction).mockImplementation(async (callback: any) => callback(tx));

    await expect(createOrderAtomically(
      {
        items: [{ menuItemId: 'm1', quantity: 2 }],
        orderType: 'takeaway',
        paymentMethod: 'cash',
      },
      { restaurantId: 'r1', clientIp: '1.1.1.1' }
    )).rejects.toThrow('stock write failed');
  });
});
