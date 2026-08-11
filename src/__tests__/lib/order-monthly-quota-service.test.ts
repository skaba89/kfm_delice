import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  entitlement: vi.fn(),
  idempotencyFindUnique: vi.fn(),
  idempotencyDelete: vi.fn(),
  menuFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/order-entitlements', () => ({
  checkMonthlyOrderEntitlement: mocks.entitlement,
}));

vi.mock('@/lib/db', () => ({
  db: {
    idempotencyKey: {
      findUnique: mocks.idempotencyFindUnique,
      delete: mocks.idempotencyDelete,
    },
    menuItem: { findMany: mocks.menuFindMany },
    $transaction: mocks.transaction,
  },
}));

import { createOrderAtomically, type CreateOrderInput } from '@/lib/order-service';

const baseInput: CreateOrderInput = {
  items: [{ menuItemId: 'm1', quantity: 1 }],
  orderType: 'takeaway',
  customerName: 'Client',
  phone: '+224600000000',
  paymentMethod: 'cash',
};

const context = {
  restaurantId: 'r1',
  clientIp: '1.1.1.1',
};

describe('order service monthly account quota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.idempotencyFindUnique.mockResolvedValue(null);
    mocks.menuFindMany.mockResolvedValue([
      { id: 'm1', name: 'Plat', price: 10_000, available: true, stockItemId: null },
    ]);
  });

  it('returns a commercial 403 when the transactional quota check rejects the order', async () => {
    const tx = {};
    mocks.transaction.mockImplementation(async (callback: (value: unknown) => unknown) => callback(tx));
    mocks.entitlement.mockResolvedValue({
      allowed: false,
      code: 'ACCOUNT_MONTHLY_ORDER_QUOTA_REACHED',
      error: 'Quota mensuel de commandes atteint (1000/1000)',
      usage: 1000,
      limit: 1000,
    });

    const result = await createOrderAtomically(baseInput, context);

    expect(mocks.entitlement).toHaveBeenCalledWith(tx, 'r1');
    expect(result).toMatchObject({
      success: false,
      status: 403,
      code: 'ACCOUNT_MONTHLY_ORDER_QUOTA_REACHED',
    });
  });

  it('does not consume/check quota again for a completed idempotent replay', async () => {
    const input = { ...baseInput, idempotencyKey: 'same-request' };
    mocks.idempotencyFindUnique.mockResolvedValue({
      id: 'idem-1',
      expiresAt: new Date(Date.now() + 60_000),
      orderId: 'order-1',
      order: { id: 'order-1', total: 10_000 },
      requestHash: '',
      status: 'completed',
    });

    const result = await createOrderAtomically(input, context);

    expect(result).toMatchObject({ success: true, status: 200, created: false });
    expect(mocks.entitlement).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
