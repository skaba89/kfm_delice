import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticatePlatformAdmin: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authenticatePlatformAdmin: mocks.authenticatePlatformAdmin,
}));

vi.mock('@/lib/audit', () => ({
  logAudit: mocks.logAudit,
}));

vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  bigIntToNumber: (value: unknown) => value,
  db: {},
}));

import { PATCH as patchSubscription } from '@/app/api/platform/accounts/[id]/billing/subscription/route';
import { POST as issueInvoice } from '@/app/api/platform/accounts/[id]/billing/invoices/route';
import { POST as recordPayment } from '@/app/api/platform/accounts/[id]/billing/payments/route';

const context = { params: Promise.resolve({ id: 'account-1' }) };

function request(path: string, method: 'PATCH' | 'POST') {
  return new Request(`https://example.test${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
}

async function expectReadOnly(response: Response) {
  const body = await response.json();
  expect(response.status).toBe(403);
  expect(body.code).toBe('BILLING_ROLE_FORBIDDEN');
  expect(mocks.logAudit).not.toHaveBeenCalled();
}

describe('platform billing RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatePlatformAdmin.mockResolvedValue({ id: 'support-1', role: 'support' });
  });

  it('blocks support from changing subscriptions', async () => {
    await expectReadOnly(await patchSubscription(
      request('/api/platform/accounts/account-1/billing/subscription', 'PATCH'),
      context,
    ));
  });

  it('blocks support from issuing invoices', async () => {
    await expectReadOnly(await issueInvoice(
      request('/api/platform/accounts/account-1/billing/invoices', 'POST'),
      context,
    ));
  });

  it('blocks support from recording payments', async () => {
    await expectReadOnly(await recordPayment(
      request('/api/platform/accounts/account-1/billing/payments', 'POST'),
      context,
    ));
  });
});
