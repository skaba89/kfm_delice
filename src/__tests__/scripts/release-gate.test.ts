import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const gate = require('../../../scripts/verify-release-gate.cjs') as {
  EXIT: { OK: number; BLOCKED: number; STALE: number };
  REQUIRED_WORKFLOWS: Array<{ file: string; label: string }>;
  latestExactPushRun: (runs: Array<Record<string, unknown>>, sha: string) => Record<string, unknown> | null;
  evaluateWorkflowRun: (run: Record<string, unknown> | null) => { state: string; reason: string };
  isCurrentMainTip: (targetSha: string, mainSha: string) => boolean;
};

const sha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);

describe('production release gate', () => {
  it('requires both CI and Security Scan workflows', () => {
    expect(gate.REQUIRED_WORKFLOWS).toEqual([
      { file: 'ci.yml', label: 'CI' },
      { file: 'security.yml', label: 'Security Scan' },
    ]);
  });

  it('selects the latest exact-SHA push run and ignores PR/other SHA runs', () => {
    const selected = gate.latestExactPushRun([
      { head_sha: sha, event: 'pull_request', status: 'completed', conclusion: 'success', run_number: 99, created_at: '2026-08-11T10:00:00Z' },
      { head_sha: otherSha, event: 'push', status: 'completed', conclusion: 'success', run_number: 100, created_at: '2026-08-11T10:01:00Z' },
      { head_sha: sha, event: 'push', status: 'completed', conclusion: 'failure', run_number: 10, created_at: '2026-08-11T09:00:00Z' },
      { head_sha: sha, event: 'push', status: 'completed', conclusion: 'success', run_number: 11, created_at: '2026-08-11T10:02:00Z' },
    ], sha);

    expect(selected).toMatchObject({
      head_sha: sha,
      event: 'push',
      run_number: 11,
      conclusion: 'success',
    });
  });

  it('distinguishes pending, green and failed workflow runs', () => {
    expect(gate.evaluateWorkflowRun(null).state).toBe('waiting');
    expect(gate.evaluateWorkflowRun({ status: 'in_progress' }).state).toBe('waiting');
    expect(gate.evaluateWorkflowRun({ status: 'completed', conclusion: 'success' }).state).toBe('success');
    expect(gate.evaluateWorkflowRun({ status: 'completed', conclusion: 'failure' })).toMatchObject({ state: 'failure' });
  });

  it('treats any non-current main SHA as stale', () => {
    expect(gate.isCurrentMainTip(sha, sha)).toBe(true);
    expect(gate.isCurrentMainTip(sha, otherSha)).toBe(false);
    expect(gate.EXIT.STALE).toBe(78);
  });

  it('keeps the Render workflow behind the exact production gate', () => {
    const workflow = readFileSync(path.join(process.cwd(), '.github', 'workflows', 'deploy.yml'), 'utf8');

    expect(workflow).toContain('permissions:');
    expect(workflow).toContain('actions: read');
    expect(workflow).toContain('Verify exact production release gates');
    expect(workflow).toContain('node scripts/verify-release-gate.cjs "$TARGET_SHA"');
    expect(workflow).toContain('SKIP_DEPLOY=true');
    expect(workflow).toContain("if: env.SKIP_DEPLOY != 'true'");
    expect(workflow).toContain('Trigger exact Render revision');
  });
});
