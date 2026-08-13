import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  candidateFindMany: vi.fn(),
  transaction: vi.fn(),
  txSubscriptionFindUnique: vi.fn(),
  txSubscriptionUpdateMany: vi.fn(),
  txAccountFindUnique: vi.fn(),
  txAccountUpdateMany: vi.fn(),
  txRestaurantUpdateMany: vi.fn(),
  invalidateTenantCache: vi.fn(),
  invalidateConfigCache: vi.fn(),
  runPlatformBillingCycle: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    platformSubscription: { findMany: mocks.candidateFindMany },
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/lib/tenant', () => ({
  invalidateTenantCache: mocks.invalidateTenantCache,
}));

vi.mock('@/lib/constants', () => ({
  invalidateConfigCache: mocks.invalidateConfigCache,
}));

vi.mock('@/lib/platform-billing-cycle', () => ({
  runPlatformBillingCycle: mocks.runPlatformBillingCycle,
}));

import {
  activateDueTrialSubscriptions,
  runPlatformBillingLifecycle,
} from '@/lib/platform-billing-lifecycle';

const trialEnd = new Date('2026-08-13T00:00:00.000Z');

function tx() {
  return {
    platformSubscription: {
      findUnique: mocks.txSubscriptionFindUnique,
      updateMany: mocks.txSubscriptionUpdateMany,
    },
    account: {
      findUnique: mocks.txAccountFindUnique,
      updateMany: mocks.txAccountUpdateMany,
    },
    restaurant: {
      updateMany: mocks.txRestaurantUpdateMany,
    },
  };
}

describe('platform billing trial lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.candidateFindMany.mockResolvedValue([{ id: 'sub-1', accountId: 'account-1' }]);
    mocks.txSubscriptionFindUnique.mockResolvedValue({
      id: 'sub-1',
      accountId: 'account-1',
      plan: 'starter',
      billingCycle: 'monthly',
      status: 'trialing',
      unitAmount: 50_000n,
      nextBillingAt: trialEnd,
    });
    mocks.txAccountFindUnique.mockResolvedValue({ id: 'account-1', plan: 'starter', status: 'trial' });
    mocks.txSubscriptionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txAccountUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txRestaurantUpdateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback: (value: ReturnType<typeof tx>) => unknown) => callback(tx()));
    mocks.runPlatformBillingCycle.mockResolvedValue({ invoicesCreated: 1, invoicesReplayed: 0 });
  });

  it('atomically activates an expired trial while preserving the due billing boundary', async () => {
    const now = new Date('2026-08-13T04:17:00.000Z');
    const result = await activateDueTrialSubscriptions(now);

    expect(result).toMatchObject({
      due: 1,
      subscriptionsActivated: 1,
      accountsActivated: 1,
      restaurantsActivated: 1,
      skipped: [],
    });
    expect(mocks.txSubscriptionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'sub-1',
        status: 'trialing',
        nextBillingAt: { lte: now },
      },
      data: { status: 'active' },
    });
    expect(mocks.txAccountUpdateMany).toHaveBeenCalledWith({
      where: { id: 'account-1', status: 'trial' },
      data: { status: 'active' },
    });
    expect(mocks.txRestaurantUpdateMany).toHaveBeenCalledWith({
      where: { accountId: 'account-1', status: 'trial' },
      data: { status: 'active' },
    });
    expect(mocks.invalidateTenantCache).toHaveBeenCalledOnce();
    expect(mocks.invalidateConfigCache).toHaveBeenCalledOnce();
  });

  it('does not double-activate when another execution already claimed the trial', async () => {
    mocks.txSubscriptionUpdateMany.mockResolvedValue({ count: 0 });

    const result = await activateDueTrialSubscriptions(new Date('2026-08-13T04:17:00.000Z'));

    expect(result.subscriptionsActivated).toBe(0);
    expect(result.accountsActivated).toBe(0);
    expect(result.restaurantsActivated).toBe(0);
    expect(mocks.txAccountUpdateMany).not.toHaveBeenCalled();
    expect(mocks.txRestaurantUpdateMany).not.toHaveBeenCalled();
    expect(mocks.invalidateTenantCache).not.toHaveBeenCalled();
  });

  it('keeps a suspended account in trialing state and reports a stable skip code', async () => {
    mocks.txAccountFindUnique.mockResolvedValue({ id: 'account-1', plan: 'starter', status: 'suspended' });

    const result = await activateDueTrialSubscriptions(new Date('2026-08-13T04:17:00.000Z'));

    expect(result.subscriptionsActivated).toBe(0);
    expect(result.skipped).toContainEqual(expect.objectContaining({
      subscriptionId: 'sub-1',
      accountId: 'account-1',
      code: 'BILLING_ACCOUNT_NOT_BILLABLE',
    }));
    expect(mocks.txSubscriptionUpdateMany).not.toHaveBeenCalled();
  });

  it('refuses activation when the trial price is stale versus the commercial catalog', async () => {
    mocks.txSubscriptionFindUnique.mockResolvedValue({
      id: 'sub-1',
      accountId: 'account-1',
      plan: 'starter',
      billingCycle: 'monthly',
      status: 'trialing',
      unitAmount: 49_999n,
      nextBillingAt: trialEnd,
    });

    const result = await activateDueTrialSubscriptions(new Date('2026-08-13T04:17:00.000Z'));

    expect(result.subscriptionsActivated).toBe(0);
    expect(result.skipped).toContainEqual(expect.objectContaining({
      code: 'BILLING_SUBSCRIPTION_PRICE_STALE',
    }));
    expect(mocks.txSubscriptionUpdateMany).not.toHaveBeenCalled();
  });

  it('runs invoice generation immediately after a successful trial transition', async () => {
    const now = new Date('2026-08-13T04:17:00.000Z');
    const result = await runPlatformBillingLifecycle({ now, dueDays: 7, maxCatchUp: 12 });

    expect(result.trialLifecycle.subscriptionsActivated).toBe(1);
    expect(result.invoicesCreated).toBe(1);
    expect(mocks.runPlatformBillingCycle).toHaveBeenCalledWith({ now, dueDays: 7, maxCatchUp: 12 });
  });
});
