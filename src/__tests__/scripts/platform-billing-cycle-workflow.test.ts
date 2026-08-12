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

  it('does not fail scheduled builds before production secrets are configured', () => {
    expect(workflow).toContain('Billing automation is not configured');
    expect(workflow).toContain('exit 0');
  });

  it('fails when the protected endpoint returns a non-2xx status', () => {
    expect(workflow).toContain('Platform billing cycle returned HTTP $status');
    expect(workflow).toContain('exit 1');
  });
});
