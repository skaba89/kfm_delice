import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticatePlatformAdmin: vi.fn(),
  logAudit: vi.fn(),
  accountFindUnique: vi.fn(),
  subscriptionFindFirst: vi.fn(),
  subscriptionCreate: vi.fn(),
  subscriptionUpdate: vi.fn(),
  paymentFindUnique: vi.fn(),
  paymentCreate: vi.fn(),
  invoiceFindUnique: vi.fn(),
  invoiceUpdateMany: vi.fn(),
  transaction: vi.fn(),
}));

function bigIntToNumber(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(bigIntToNumber);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, bigIntToNumber(item)]),
    );
  }
  return value;
}

vi.mock('@/lib/auth', () => ({
  authenticatePlatformAdmin: mocks.authenticatePlatformAdmin,
}));

vi.mock('@/lib/audit', () => ({
  logAudit: mocks.logAudit,
}));

vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  bigIntToNumber,
  db: {
    account: { findUnique: mocks.accountFindUnique },
    platformSubscription: {
      findFirst: mocks.subscriptionFindFirst,
      create: mocks.subscriptionCreate,
      update: mocks.subscriptionUpdate,
    },
    platformPayment: {
      findUnique: mocks.paymentFindUnique,
      create: mocks.paymentCreate,
    },
    platformInvoice: {
      findUnique: mocks.invoiceFindUnique,
      updateMany: mocks.invoiceUpdateMany,
    },
    $transaction: mocks.transaction,
  },
}));

import { PATCH as patchSubscription } from '@/app/api/platform/accounts/[id]/billing/subscription/route';
import { POST as recordPayment } from '@/app/api/platform/accounts/[id]/billing/payments/route';

const platformAdmin = { id: 'platform-1', role: 'super_admin' };
const context = { params: Promise.resolve({ id: 'account-1' }) };

function request(path: string, body: unknown, method: 'PATCH' | 'POST') {
  return new Request(`https://example.test${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('platform SaaS billing API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatePlatformAdmin.mockResolvedValue(platformAdmin);
    mocks.logAudit.mockResolvedValue(undefined);
    mocks.accountFindUnique.mockResolvedValue({ id: 'account-1', plan: 'starter', status: 'active' });
    mocks.subscriptionFindFirst.mockResolvedValue(null);
    mocks.subscriptionCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'subscription-1',
      createdAt: new Date('2026-08-12T00:00:00Z'),
      updatedAt: new Date('2026-08-12T00:00:00Z'),
      ...data,
    }));
    mocks.subscriptionUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'subscription-1',
      accountId: 'account-1',
      createdAt: new Date('2026-08-12T00:00:00Z'),
      updatedAt: new Date('2026-08-12T00:00:00Z'),
      ...data,
    }));
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      platformPayment: {
        findUnique: mocks.paymentFindUnique,
        create: mocks.paymentCreate,
      },
      platformInvoice: {
        findUnique: mocks.invoiceFindUnique,
        updateMany: mocks.invoiceUpdateMany,
      },
    }));
  });

  it('uses Account.plan catalog pricing even when a client sends a fake custom amount', async () => {
    const response = await patchSubscription(
      request('/api/platform/accounts/account-1/billing/subscription', {
        billingCycle: 'monthly',
        customUnitAmount: 999999,
      }, 'PATCH'),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.subscriptionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'account-1',
        plan: 'starter',
        unitAmount: 50_000n,
        billingCycle: 'monthly',
      }),
    });
  });

  it('rejects a custom account without an explicit negotiated amount', async () => {
    mocks.accountFindUnique.mockResolvedValue({ id: 'account-1', plan: 'custom', status: 'active' });

    const response = await patchSubscription(
      request('/api/platform/accounts/account-1/billing/subscription', { billingCycle: 'monthly' }, 'PATCH'),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('BILLING_CUSTOM_AMOUNT_REQUIRED');
    expect(mocks.subscriptionCreate).not.toHaveBeenCalled();
  });

  it('records a full payment atomically and marks the invoice paid', async () => {
    mocks.paymentFindUnique.mockResolvedValue(null);
    mocks.invoiceFindUnique
      .mockResolvedValueOnce({
        id: 'invoice-1', accountId: 'account-1', currency: 'GNF', total: 100_000n,
        amountPaid: 40_000n, status: 'open',
      })
      .mockResolvedValueOnce({
        id: 'invoice-1', accountId: 'account-1', currency: 'GNF', total: 100_000n,
        amountPaid: 100_000n, status: 'paid',
      });
    mocks.invoiceUpdateMany.mockResolvedValue({ count: 1 });
    mocks.paymentCreate.mockResolvedValue({
      id: 'payment-1', accountId: 'account-1', invoiceId: 'invoice-1',
      amount: 60_000n, currency: 'GNF', status: 'paid', idempotencyKey: 'payment-key-0001',
    });

    const response = await recordPayment(
      request('/api/platform/accounts/account-1/billing/payments', {
        invoiceId: 'invoice-1',
        amount: 60000,
        method: 'bank_transfer',
        idempotencyKey: 'payment-key-0001',
      }, 'POST'),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.replay).toBe(false);
    expect(mocks.invoiceUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'invoice-1', amountPaid: 40_000n, status: 'open' }),
      data: expect.objectContaining({ amountPaid: 100_000n, status: 'paid' }),
    }));
    expect(mocks.paymentCreate).toHaveBeenCalledOnce();
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'platform_payment_recorded',
      accountId: 'account-1',
    }));
  });

  it('replays an identical idempotency key without a second write or audit', async () => {
    mocks.paymentFindUnique.mockResolvedValue({
      id: 'payment-1', accountId: 'account-1', invoiceId: 'invoice-1',
      amount: 60_000n, currency: 'GNF', status: 'paid', idempotencyKey: 'payment-key-0001',
    });
    mocks.invoiceFindUnique.mockResolvedValue({
      id: 'invoice-1', accountId: 'account-1', total: 100_000n, amountPaid: 100_000n, status: 'paid',
    });

    const response = await recordPayment(
      request('/api/platform/accounts/account-1/billing/payments', {
        invoiceId: 'invoice-1',
        amount: 60000,
        method: 'bank_transfer',
        idempotencyKey: 'payment-key-0001',
      }, 'POST'),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.replay).toBe(true);
    expect(mocks.invoiceUpdateMany).not.toHaveBeenCalled();
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });

  it('rejects reuse of an idempotency key for another amount', async () => {
    mocks.paymentFindUnique.mockResolvedValue({
      id: 'payment-1', accountId: 'account-1', invoiceId: 'invoice-1',
      amount: 50_000n, idempotencyKey: 'payment-key-0001',
    });

    const response = await recordPayment(
      request('/api/platform/accounts/account-1/billing/payments', {
        invoiceId: 'invoice-1',
        amount: 60000,
        method: 'bank_transfer',
        idempotencyKey: 'payment-key-0001',
      }, 'POST'),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('BILLING_IDEMPOTENCY_CONFLICT');
  });

  it('rejects overpayment before any invoice mutation', async () => {
    mocks.paymentFindUnique.mockResolvedValue(null);
    mocks.invoiceFindUnique.mockResolvedValue({
      id: 'invoice-1', accountId: 'account-1', currency: 'GNF', total: 100_000n,
      amountPaid: 90_000n, status: 'open',
    });

    const response = await recordPayment(
      request('/api/platform/accounts/account-1/billing/payments', {
        invoiceId: 'invoice-1',
        amount: 20000,
        method: 'bank_transfer',
        idempotencyKey: 'payment-key-0002',
      }, 'POST'),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('BILLING_OVERPAYMENT');
    expect(mocks.invoiceUpdateMany).not.toHaveBeenCalled();
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
  });
});
