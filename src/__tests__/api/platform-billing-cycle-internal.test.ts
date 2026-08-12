import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runPlatformBillingCycle: vi.fn(),
}));

vi.mock('@/lib/platform-billing-cycle', () => ({
  runPlatformBillingCycle: mocks.runPlatformBillingCycle,
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
    mocks.runPlatformBillingCycle.mockResolvedValue({
      evaluatedAt: '2026-08-12T00:00:00.000Z',
      invoicesCreated: 1,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails closed when the cron secret is not configured', async () => {
    vi.stubEnv('BILLING_CRON_SECRET', '');
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe('BILLING_AUTOMATION_NOT_CONFIGURED');
    expect(mocks.runPlatformBillingCycle).not.toHaveBeenCalled();
  });

  it('rejects a missing or incorrect bearer secret', async () => {
    vi.stubEnv('BILLING_CRON_SECRET', 'billing-cron-test-secret');

    expect((await POST(request())).status).toBe(401);
    expect((await POST(request('wrong-secret'))).status).toBe(401);
    expect(mocks.runPlatformBillingCycle).not.toHaveBeenCalled();
  });

  it('runs the cycle only with the exact configured bearer secret', async () => {
    vi.stubEnv('BILLING_CRON_SECRET', 'billing-cron-test-secret');
    const response = await POST(request('billing-cron-test-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result.invoicesCreated).toBe(1);
    expect(mocks.runPlatformBillingCycle).toHaveBeenCalledOnce();
  });
});
