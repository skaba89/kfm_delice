import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoiceFindMany: vi.fn(),
  accountFindMany: vi.fn(),
  noticeFindUnique: vi.fn(),
  noticeCreate: vi.fn(),
  noticeUpdateMany: vi.fn(),
  noticeUpdate: vi.fn(),
  getProvider: vi.fn(),
  isConfigured: vi.fn(),
  sendPlatformEmail: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  db: {
    platformInvoice: { findMany: mocks.invoiceFindMany },
    account: { findMany: mocks.accountFindMany },
    platformBillingNotice: {
      findUnique: mocks.noticeFindUnique,
      create: mocks.noticeCreate,
      updateMany: mocks.noticeUpdateMany,
      update: mocks.noticeUpdate,
    },
  },
}));

vi.mock('@/lib/platform-email', () => ({
  getPlatformEmailProvider: mocks.getProvider,
  isPlatformEmailDeliveryConfigured: mocks.isConfigured,
  sendPlatformEmail: mocks.sendPlatformEmail,
}));

import {
  billingDunningNoticeKey,
  runPlatformBillingDunning,
  selectBillingDunningStage,
} from '@/lib/platform-billing-dunning';

const now = new Date('2026-08-12T00:00:00.000Z');
const overdueInvoice = {
  id: 'invoice-1',
  accountId: 'account-1',
  number: 'KFM-202608-0001',
  currency: 'GNF',
  total: 100_000n,
  amountPaid: 20_000n,
  dueAt: new Date('2026-08-01T00:00:00.000Z'),
};
const account = {
  id: 'account-1',
  name: 'Groupe KFM',
  ownerName: 'Responsable KFM',
  ownerEmail: 'billing@example.test',
};

function pendingNotice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notice-1',
    accountId: 'account-1',
    invoiceId: 'invoice-1',
    stage: 'overdue_initial',
    recipient: 'billing@example.test',
    status: 'pending',
    provider: '',
    attemptedAt: null,
    sentAt: null,
    idempotencyKey: billingDunningNoticeKey('invoice-1', 'overdue_initial'),
    ...overrides,
  };
}

describe('platform billing dunning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoiceFindMany.mockResolvedValue([overdueInvoice]);
    mocks.accountFindMany.mockResolvedValue([account]);
    mocks.noticeFindUnique.mockResolvedValue(null);
    mocks.noticeCreate.mockResolvedValue(pendingNotice());
    mocks.noticeUpdateMany.mockResolvedValue({ count: 1 });
    mocks.noticeUpdate.mockResolvedValue(pendingNotice());
    mocks.getProvider.mockReturnValue('resend');
    mocks.isConfigured.mockReturnValue(true);
    mocks.sendPlatformEmail.mockResolvedValue({
      success: true,
      configured: true,
      provider: 'resend',
    });
  });

  it('does zero database work while dunning is disabled', async () => {
    const result = await runPlatformBillingDunning({ enabled: false, now });

    expect(result.enabled).toBe(false);
    expect(mocks.invoiceFindMany).not.toHaveBeenCalled();
    expect(mocks.accountFindMany).not.toHaveBeenCalled();
    expect(mocks.sendPlatformEmail).not.toHaveBeenCalled();
  });

  it('selects progressive stages without claiming suspension when access enforcement is off', () => {
    expect(selectBillingDunningStage({
      dueAt: new Date('2026-08-10T00:00:00.000Z'),
      now,
      accessEnforcementEnabled: false,
      accessGraceDays: 7,
      warningDays: 3,
    })).toBe('overdue_initial');

    expect(selectBillingDunningStage({
      dueAt: new Date('2026-08-08T00:00:00.000Z'),
      now,
      accessEnforcementEnabled: true,
      accessGraceDays: 7,
      warningDays: 3,
    })).toBe('grace_warning');

    expect(selectBillingDunningStage({
      dueAt: new Date('2026-08-01T00:00:00.000Z'),
      now,
      accessEnforcementEnabled: true,
      accessGraceDays: 7,
      warningDays: 3,
    })).toBe('access_suspended');
  });

  it('never marks the console fallback as a delivered financial notice', async () => {
    mocks.getProvider.mockReturnValue('console');
    mocks.isConfigured.mockReturnValue(false);

    const result = await runPlatformBillingDunning({
      enabled: true,
      now,
      accessEnforcementEnabled: false,
    });

    expect(result.skippedUnconfigured).toBe(1);
    expect(result.sent).toBe(0);
    expect(mocks.sendPlatformEmail).not.toHaveBeenCalled();
    expect(mocks.noticeUpdate).toHaveBeenCalledWith({
      where: { id: 'notice-1' },
      data: expect.objectContaining({
        status: 'skipped_unconfigured',
        provider: 'console',
      }),
    });
  });

  it('sends one real overdue notice and records the delivery provider', async () => {
    const result = await runPlatformBillingDunning({
      enabled: true,
      now: new Date('2026-08-02T00:00:00.000Z'),
      accessEnforcementEnabled: false,
    });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(mocks.sendPlatformEmail).toHaveBeenCalledOnce();
    expect(mocks.sendPlatformEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'billing@example.test',
      subject: expect.stringContaining('Facture SaaS'),
    }));
    expect(mocks.noticeUpdate).toHaveBeenCalledWith({
      where: { id: 'notice-1' },
      data: expect.objectContaining({
        status: 'sent',
        provider: 'resend',
      }),
    });
  });

  it('replays a sent stage without sending a duplicate email', async () => {
    mocks.noticeFindUnique.mockResolvedValue(pendingNotice({ status: 'sent' }));

    const result = await runPlatformBillingDunning({
      enabled: true,
      now: new Date('2026-08-02T00:00:00.000Z'),
      accessEnforcementEnabled: false,
    });

    expect(result.replayed).toBe(1);
    expect(result.sent).toBe(0);
    expect(mocks.noticeUpdateMany).not.toHaveBeenCalled();
    expect(mocks.sendPlatformEmail).not.toHaveBeenCalled();
  });

  it('skips an invalid account owner email and keeps the notice retryable', async () => {
    mocks.accountFindMany.mockResolvedValue([{ ...account, ownerEmail: 'not-an-email' }]);

    const result = await runPlatformBillingDunning({
      enabled: true,
      now: new Date('2026-08-02T00:00:00.000Z'),
      accessEnforcementEnabled: false,
    });

    expect(result.skippedInvalidRecipient).toBe(1);
    expect(mocks.sendPlatformEmail).not.toHaveBeenCalled();
    expect(mocks.noticeUpdate).toHaveBeenCalledWith({
      where: { id: 'notice-1' },
      data: expect.objectContaining({ status: 'skipped_invalid_recipient' }),
    });
  });

  it('records provider failures without throwing or marking the notice sent', async () => {
    mocks.sendPlatformEmail.mockResolvedValue({
      success: false,
      configured: true,
      provider: 'resend',
      error: 'temporary provider failure',
    });

    const result = await runPlatformBillingDunning({
      enabled: true,
      now: new Date('2026-08-02T00:00:00.000Z'),
      accessEnforcementEnabled: false,
    });

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
    expect(mocks.noticeUpdate).toHaveBeenCalledWith({
      where: { id: 'notice-1' },
      data: expect.objectContaining({ status: 'failed' }),
    });
  });

  it('does not send when another worker already owns the sending claim', async () => {
    mocks.noticeUpdateMany.mockResolvedValue({ count: 0 });

    const result = await runPlatformBillingDunning({
      enabled: true,
      now: new Date('2026-08-02T00:00:00.000Z'),
      accessEnforcementEnabled: false,
    });

    expect(result.inProgress).toBe(1);
    expect(mocks.sendPlatformEmail).not.toHaveBeenCalled();
  });

  it('evaluates only the oldest overdue invoice for each account in one run', async () => {
    mocks.invoiceFindMany.mockResolvedValue([
      overdueInvoice,
      { ...overdueInvoice, id: 'invoice-2', number: 'KFM-202608-0002', dueAt: new Date('2026-08-05T00:00:00.000Z') },
    ]);

    const result = await runPlatformBillingDunning({
      enabled: true,
      now: new Date('2026-08-06T00:00:00.000Z'),
      accessEnforcementEnabled: false,
    });

    expect(result.candidateInvoices).toBe(2);
    expect(result.accountsEvaluated).toBe(1);
    expect(mocks.noticeCreate).toHaveBeenCalledTimes(1);
    expect(mocks.sendPlatformEmail).toHaveBeenCalledTimes(1);
  });
});
