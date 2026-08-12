import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticatePlatformAdmin: vi.fn(),
  subscriptionFindMany: vi.fn(),
  invoiceAggregate: vi.fn(),
  invoiceGroupBy: vi.fn(),
  paymentAggregate: vi.fn(),
  noticeCount: vi.fn(),
  noticeFindMany: vi.fn(),
  accountFindMany: vi.fn(),
  isBillingDunningEnabled: vi.fn(),
  getPlatformEmailProvider: vi.fn(),
  isPlatformEmailDeliveryConfigured: vi.fn(),
  isBillingAccessEnforcementEnabled: vi.fn(),
}));

function bigIntToNumber(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(bigIntToNumber);
  if (value instanceof Date) return value;
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

vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  bigIntToNumber,
  db: {
    platformSubscription: { findMany: mocks.subscriptionFindMany },
    platformInvoice: {
      aggregate: mocks.invoiceAggregate,
      groupBy: mocks.invoiceGroupBy,
    },
    platformPayment: { aggregate: mocks.paymentAggregate },
    platformBillingNotice: {
      count: mocks.noticeCount,
      findMany: mocks.noticeFindMany,
    },
    account: { findMany: mocks.accountFindMany },
  },
}));

vi.mock('@/lib/platform-billing-dunning', () => ({
  isBillingDunningEnabled: mocks.isBillingDunningEnabled,
}));

vi.mock('@/lib/platform-email', () => ({
  getPlatformEmailProvider: mocks.getPlatformEmailProvider,
  isPlatformEmailDeliveryConfigured: mocks.isPlatformEmailDeliveryConfigured,
}));

vi.mock('@/lib/subscription-access', () => ({
  isBillingAccessEnforcementEnabled: mocks.isBillingAccessEnforcementEnabled,
}));

import { GET } from '@/app/api/platform/billing/overview/route';

function request() {
  return new Request('https://example.test/api/platform/billing/overview', {
    headers: { Authorization: 'Bearer platform-token' },
  });
}

describe('platform billing global finance overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatePlatformAdmin.mockResolvedValue({ id: 'platform-1', role: 'super_admin' });
    mocks.isBillingDunningEnabled.mockReturnValue(false);
    mocks.getPlatformEmailProvider.mockReturnValue('console');
    mocks.isPlatformEmailDeliveryConfigured.mockReturnValue(false);
    mocks.isBillingAccessEnforcementEnabled.mockReturnValue(false);

    mocks.subscriptionFindMany.mockResolvedValue([
      {
        id: 'sub-monthly', accountId: 'account-1', status: 'active', billingCycle: 'monthly',
        currency: 'GNF', unitAmount: 50_000n, nextBillingAt: null, provider: 'manual',
      },
      {
        id: 'sub-annual', accountId: 'account-2', status: 'active', billingCycle: 'annual',
        currency: 'GNF', unitAmount: 1_200_000n, nextBillingAt: null, provider: 'manual',
      },
      {
        id: 'sub-past-due', accountId: 'account-3', status: 'past_due', billingCycle: 'monthly',
        currency: 'GNF', unitAmount: 150_000n, nextBillingAt: null, provider: 'manual',
      },
      {
        id: 'sub-trial', accountId: 'account-4', status: 'trialing', billingCycle: 'annual',
        currency: 'GNF', unitAmount: 600_000n, nextBillingAt: null, provider: 'manual',
      },
    ]);

    mocks.invoiceAggregate
      .mockResolvedValueOnce({
        _sum: { total: 400_000n, amountPaid: 100_000n },
        _count: { id: 3 },
      })
      .mockResolvedValueOnce({
        _sum: { total: 500_000n, amountPaid: 400_000n },
        _count: { id: 5 },
      });

    mocks.invoiceGroupBy.mockResolvedValue([
      {
        accountId: 'account-1',
        _sum: { total: 200_000n, amountPaid: 50_000n },
        _count: { _all: 2 },
        _min: { dueAt: new Date('2026-07-01T00:00:00.000Z') },
      },
      {
        accountId: 'account-2',
        _sum: { total: 100_000n, amountPaid: 0n },
        _count: { _all: 1 },
        _min: { dueAt: new Date('2026-07-15T00:00:00.000Z') },
      },
    ]);

    mocks.paymentAggregate.mockResolvedValue({
      _sum: { amount: 350_000n },
      _count: { id: 4 },
    });
    mocks.noticeCount
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    mocks.noticeFindMany.mockResolvedValue([
      {
        id: 'notice-1',
        accountId: 'account-1',
        invoiceId: 'invoice-1',
        stage: 'grace_warning',
        recipient: 'billing@example.test',
        status: 'failed',
        provider: 'resend',
        errorMessage: 'temporary provider failure',
        attemptedAt: new Date('2026-08-11T00:00:00.000Z'),
        updatedAt: new Date('2026-08-11T00:01:00.000Z'),
        invoice: { number: 'KFM-202608-0001' },
      },
    ]);
    mocks.accountFindMany.mockResolvedValue([
      { id: 'account-1', name: 'Groupe Alpha', ownerEmail: 'alpha@example.test', plan: 'starter', status: 'active' },
      { id: 'account-2', name: 'Groupe Beta', ownerEmail: 'beta@example.test', plan: 'pro', status: 'active' },
    ]);
  });

  it('rejects unauthenticated access before reading finance tables', async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue(null);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Non autorisé');
    expect(mocks.subscriptionFindMany).not.toHaveBeenCalled();
    expect(mocks.invoiceAggregate).not.toHaveBeenCalled();
    expect(mocks.paymentAggregate).not.toHaveBeenCalled();
  });

  it('calculates contracted run-rate, receivables, collection and operational health globally', async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.runRate).toEqual({
      mrr: 300_000,
      arr: 3_600_000,
      activeSubscriptions: 2,
      pastDueSubscriptions: 1,
      trialingSubscriptions: 1,
      pausedSubscriptions: 0,
      totalSubscriptions: 4,
    });

    expect(body.receivables.outstanding).toBe(300_000);
    expect(body.receivables.openInvoiceCount).toBe(3);
    expect(body.receivables.overdueAccountCount).toBe(2);
    expect(body.receivables.topOverdueAccounts).toEqual([
      expect.objectContaining({
        accountId: 'account-1',
        accountName: 'Groupe Alpha',
        invoiceCount: 2,
        outstanding: 150_000,
      }),
      expect.objectContaining({
        accountId: 'account-2',
        accountName: 'Groupe Beta',
        invoiceCount: 1,
        outstanding: 100_000,
      }),
    ]);

    expect(body.collection).toEqual({
      collected30d: 350_000,
      paymentCount30d: 4,
      invoiced90d: 500_000,
      collectedAgainstInvoices90d: 400_000,
      invoiceCount90d: 5,
      collectionRate90dPct: 80,
    });

    expect(body.operations).toMatchObject({
      accessEnforcementEnabled: false,
      dunningEnabled: false,
      emailProvider: 'console',
      emailDeliveryConfigured: false,
      dunningIssuesCount: 2,
      dunningSent30d: 3,
    });
    expect(body.operations.recentDunningIssues).toEqual([
      expect.objectContaining({
        accountId: 'account-1',
        accountName: 'Groupe Alpha',
        ownerEmail: 'alpha@example.test',
        invoiceNumber: 'KFM-202608-0001',
        status: 'failed',
      }),
    ]);
  });

  it('returns a null 90-day collection rate when no invoice was issued', async () => {
    mocks.invoiceAggregate
      .mockReset()
      .mockResolvedValueOnce({
        _sum: { total: null, amountPaid: null },
        _count: { id: 0 },
      })
      .mockResolvedValueOnce({
        _sum: { total: null, amountPaid: null },
        _count: { id: 0 },
      });
    mocks.invoiceGroupBy.mockResolvedValue([]);
    mocks.noticeFindMany.mockResolvedValue([]);
    mocks.accountFindMany.mockResolvedValue([]);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.receivables.outstanding).toBe(0);
    expect(body.receivables.overdueAccountCount).toBe(0);
    expect(body.collection.collectionRate90dPct).toBeNull();
  });
});
