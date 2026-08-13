import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runPlatformBillingLifecycle: vi.fn(),
}));

vi.mock('@/lib/platform-billing-lifecycle', () => ({
  runPlatformBillingLifecycle: mocks.runPlatformBillingLifecycle,
}));

import { POST } from '@/app/api/internal/platform-billing-cycle/route';

function request(token?: string) {
  return new Request('https://example.test/api/internal/platform-billing-cycle', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe('internal platform billing cycle endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runPlatformBillingLifecycle.mockResolvedValue({
      evaluatedAt: '2026-08-13T04:17:00.000Z',
      invoicesCreated: 1,
      trialLifecycle: {
        due: 1,
        subscriptionsActivated: 1,
        accountsActivated: 1,
        restaurantsActivated: 1,
        skipped: [],
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails closed when the cron credential is not configured', async () => {
    vi.stubEnv('BILLING_CRON_SECRET', '');
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe('BILLING_AUTOMATION_NOT_CONFIGURED');
    expect(mocks.runPlatformBillingLifecycle).not.toHaveBeenCalled();
  });

  it('rejects a missing or incorrect bearer value', async () => {
    vi.stubEnv('BILLING_CRON_SECRET', 'unit-test-value');

    expect((await POST(request())).status).toBe(401);
    expect((await POST(request('incorrect-value'))).status).toBe(401);
    expect(mocks.runPlatformBillingLifecycle).not.toHaveBeenCalled();
  });

  it('runs the trial-aware lifecycle only with the exact configured bearer value', async () => {
    vi.stubEnv('BILLING_CRON_SECRET', 'unit-test-value');
    const response = await POST(request('unit-test-value'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result.invoicesCreated).toBe(1);
    expect(body.result.trialLifecycle.subscriptionsActivated).toBe(1);
    expect(mocks.runPlatformBillingLifecycle).toHaveBeenCalledOnce();
  });
});
