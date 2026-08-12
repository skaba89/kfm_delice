import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  accountFindUnique: vi.fn(),
  subscriptionFindMany: vi.fn(),
  subscriptionUpdate: vi.fn(),
  subscriptionUpdateMany: vi.fn(),
  invoiceFindUnique: vi.fn(),
  invoiceCreate: vi.fn(),
  invoiceUpdateMany: vi.fn(),
  invoiceFindMany: vi.fn(),
  invalidateTenantCache: vi.fn(),
  runPlatformBillingDunning: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  db: {
    account: { findUnique: mocks.accountFindUnique },
    platformSubscription: {
      findMany: mocks.subscriptionFindMany,
      update: mocks.subscriptionUpdate,
      updateMany: mocks.subscriptionUpdateMany,
    },
    platformInvoice: {
      findUnique: mocks.invoiceFindUnique,
      create: mocks.invoiceCreate,
      updateMany: mocks.invoiceUpdateMany,
      findMany: mocks.invoiceFindMany,
    },
  },
}));

vi.mock('@/lib/tenant', () => ({
  invalidateTenantCache: mocks.invalidateTenantCache,
}));

vi.mock('@/lib/platform-billing-dunning', () => ({
  runPlatformBillingDunning: mocks.runPlatformBillingDunning,
}));

import {
  addBillingCycle,
  billingCycleInvoiceKey,
  runPlatformBillingCycle,
} from '@/lib/platform-billing-cycle';

const amount = BigInt(50_000);
const dunningSuccess = {
  enabled: false,
  provider: 'console' as const,
  candidateInvoices: 0,
  accountsEvaluated: 0,
  sent: 0,
  replayed: 0,
  failed: 0,
  skippedUnconfigured: 0,
  skippedInvalidRecipient: 0,
  skippedMissingAccount: 0,
  inProgress: 0,
};

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'subscription-1',
    accountId: 'account-1',
    plan: 'starter',
    billingCycle: 'monthly',
    status: 'active',
    currency: 'GNF',
    unitAmount: amount,
    currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
    nextBillingAt: new Date('2026-08-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

describe('platform billing cycle automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountFindUnique.mockResolvedValue({ id: 'account-1', plan: 'starter', status: 'active' });
    mocks.subscriptionFindMany.mockResolvedValue([subscription()]);
    mocks.subscriptionUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...subscription(),
      ...data,
    }));
    mocks.subscriptionUpdateMany.mockResolvedValue({ count: 0 });
    mocks.invoiceFindUnique.mockResolvedValue(null);
    mocks.invoiceCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'invoice-1',
      ...data,
    }));
    mocks.invoiceUpdateMany.mockResolvedValue({ count: 0 });
    mocks.invoiceFindMany.mockResolvedValue([]);
    mocks.runPlatformBillingDunning.mockResolvedValue(dunningSuccess);
  });

  it('clamps monthly cycles to the last valid day of the target month', () => {
    expect(addBillingCycle(new Date('2027-01-31T10:15:30.000Z'), 'monthly').toISOString())
      .toBe('2027-02-28T10:15:30.000Z');
    expect(addBillingCycle(new Date('2028-01-31T10:15:30.000Z'), 'monthly').toISOString())
      .toBe('2028-02-29T10:15:30.000Z');
  });

  it('clamps annual February 29 renewals to February 28 on non-leap years', () => {
    expect(addBillingCycle(new Date('2028-02-29T00:00:00.000Z'), 'annual').toISOString())
      .toBe('2029-02-28T00:00:00.000Z');
  });

  it('creates a deterministic invoice, advances the subscription and runs dunning afterwards', async () => {
    const now = new Date('2026-08-12T00:00:00.000Z');
    const result = await runPlatformBillingCycle({ now, dueDays: 7, maxCatchUp: 12 });

    expect(result.invoicesCreated).toBe(1);
    expect(result.invoicesReplayed).toBe(0);
    expect(result.subscriptionsAdvanced).toBe(1);
    expect(result.dunning).toEqual(dunningSuccess);
    expect(mocks.runPlatformBillingDunning).toHaveBeenCalledWith({ now });
    expect(mocks.invoiceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'account-1',
        subscriptionId: 'subscription-1',
        idempotencyKey: billingCycleInvoiceKey('subscription-1', new Date('2026-08-01T00:00:00.000Z')),
        periodStart: new Date('2026-08-01T00:00:00.000Z'),
        periodEnd: new Date('2026-09-01T00:00:00.000Z'),
        dueAt: new Date('2026-08-08T00:00:00.000Z'),
        status: 'overdue',
        subtotal: amount,
        total: amount,
      }),
    });
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { id: 'subscription-1' },
      data: expect.objectContaining({
        currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
        nextBillingAt: new Date('2026-09-01T00:00:00.000Z'),
      }),
    });
  });

  it('replays an existing deterministic invoice without creating a duplicate', async () => {
    mocks.invoiceFindUnique.mockResolvedValue({ id: 'invoice-existing' });

    const result = await runPlatformBillingCycle({
      now: new Date('2026-08-12T00:00:00.000Z'),
      dueDays: 7,
    });

    expect(result.invoicesCreated).toBe(0);
    expect(result.invoicesReplayed).toBe(1);
    expect(result.subscriptionsAdvanced).toBe(1);
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
  });

  it('cancels at the configured period boundary before creating another invoice', async () => {
    mocks.subscriptionFindMany.mockResolvedValue([
      subscription({ cancelAtPeriodEnd: true }),
    ]);

    const result = await runPlatformBillingCycle({
      now: new Date('2026-08-12T00:00:00.000Z'),
    });

    expect(result.subscriptionsCancelled).toBe(1);
    expect(result.invoicesCreated).toBe(0);
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { id: 'subscription-1' },
      data: { status: 'cancelled', nextBillingAt: null },
    });
    expect(mocks.invalidateTenantCache).toHaveBeenCalledOnce();
  });

  it('never bills a subscription whose stored plan is stale versus Account.plan', async () => {
    mocks.accountFindUnique.mockResolvedValue({ id: 'account-1', plan: 'pro', status: 'active' });

    const result = await runPlatformBillingCycle({
      now: new Date('2026-08-12T00:00:00.000Z'),
    });

    expect(result.invoicesCreated).toBe(0);
    expect(result.skipped).toContainEqual(expect.objectContaining({
      subscriptionId: 'subscription-1',
      code: 'BILLING_SUBSCRIPTION_PLAN_STALE',
    }));
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
  });

  it('marks overdue invoices and active subscriptions past_due after generation', async () => {
    mocks.subscriptionFindMany.mockResolvedValue([]);
    mocks.invoiceUpdateMany.mockResolvedValue({ count: 2 });
    mocks.invoiceFindMany.mockResolvedValue([
      { accountId: 'account-1' },
      { accountId: 'account-1' },
      { accountId: 'account-2' },
    ]);
    mocks.subscriptionUpdateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 0 });

    const result = await runPlatformBillingCycle({ now: new Date('2026-08-12T00:00:00.000Z') });

    expect(result.invoicesMarkedOverdue).toBe(2);
    expect(result.subscriptionsMarkedPastDue).toBe(2);
    expect(result.subscriptionsRecovered).toBe(0);
    expect(mocks.subscriptionUpdateMany).toHaveBeenCalledWith({
      where: {
        accountId: { in: ['account-1', 'account-2'] },
        status: 'active',
      },
      data: { status: 'past_due' },
    });
    expect(mocks.invalidateTenantCache).toHaveBeenCalledOnce();
  });

  it('recovers stale past_due subscriptions when no overdue invoice remains', async () => {
    mocks.subscriptionFindMany.mockResolvedValue([]);
    mocks.invoiceFindMany.mockResolvedValue([]);
    mocks.subscriptionUpdateMany.mockResolvedValueOnce({ count: 3 });

    const result = await runPlatformBillingCycle({ now: new Date('2026-08-12T00:00:00.000Z') });

    expect(result.subscriptionsMarkedPastDue).toBe(0);
    expect(result.subscriptionsRecovered).toBe(3);
    expect(mocks.subscriptionUpdateMany).toHaveBeenCalledWith({
      where: { status: 'past_due' },
      data: { status: 'active' },
    });
    expect(mocks.invalidateTenantCache).toHaveBeenCalledOnce();
  });

  it('keeps invoice lifecycle successful when dunning fails unexpectedly', async () => {
    mocks.subscriptionFindMany.mockResolvedValue([]);
    mocks.runPlatformBillingDunning.mockRejectedValue(new Error('provider unavailable\ninternal detail'));

    const result = await runPlatformBillingCycle({ now: new Date('2026-08-12T00:00:00.000Z') });

    expect(result.invoicesCreated).toBe(0);
    expect(result.dunning).toBeUndefined();
    expect(result.dunningError).toBe('provider unavailable internal detail');
  });

  it('caps catch-up work and leaves remaining periods for a later execution', async () => {
    mocks.subscriptionFindMany.mockResolvedValue([
      subscription({
        currentPeriodStart: new Date('2025-12-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z'),
        nextBillingAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ]);

    const result = await runPlatformBillingCycle({
      now: new Date('2026-04-15T00:00:00.000Z'),
      dueDays: 7,
      maxCatchUp: 2,
    });

    expect(result.invoicesCreated).toBe(2);
    expect(result.subscriptionsAdvanced).toBe(2);
    expect(result.cappedSubscriptions).toBe(1);
    expect(result.skipped).toContainEqual(expect.objectContaining({
      code: 'BILLING_CATCH_UP_CAPPED',
    }));
  });
});
