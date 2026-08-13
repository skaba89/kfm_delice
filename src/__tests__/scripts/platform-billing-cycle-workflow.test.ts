import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  path.join(process.cwd(), '.github', 'workflows', 'platform-billing-cycle.yml'),
  'utf8',
);

describe('platform billing cycle workflow contract', () => {
  it('runs daily away from the top of the hour and remains manually dispatchable', () => {
    expect(workflow).toContain("cron: '17 4 * * *'");
    expect(workflow).toContain('workflow_dispatch:');
  });

  it('prevents overlapping production billing runs', () => {
    expect(workflow).toContain('group: platform-billing-cycle-production');
    expect(workflow).toContain('cancel-in-progress: false');
  });

  it('uses only secret-backed production endpoint credentials', () => {
    expect(workflow).toContain('secrets.RENDER_PUBLIC_BASE_URL');
    expect(workflow).toContain('secrets.BILLING_CRON_SECRET');
    expect(workflow).toContain('Authorization: Bearer $BILLING_CRON_SECRET');
    expect(workflow).toContain('/api/internal/platform-billing-cycle');
  });

  it('fails closed when production billing automation secrets are missing', () => {
    expect(workflow).toContain('Production billing automation is incomplete');
    expect(workflow).toContain('RENDER_PUBLIC_BASE_URL');
    expect(workflow).toContain('BILLING_CRON_SECRET');
    expect(workflow).toContain('exit 1');
    expect(workflow).not.toContain('Billing automation is not configured; skipping');
  });

  it('requires HTTPS for the production billing endpoint', () => {
    expect(workflow).toContain('RENDER_PUBLIC_BASE_URL must use HTTPS');
  });

  it('fails when the protected endpoint returns a non-2xx status', () => {
    expect(workflow).toContain('Platform billing cycle returned HTTP $status');
    expect(workflow).toContain('exit 1');
  });

  it('requires an application-level success acknowledgement', () => {
    expect(workflow).toContain("payload.get('ok') is not True");
    expect(workflow).toContain('Billing endpoint returned a non-success business response');
  });
});
