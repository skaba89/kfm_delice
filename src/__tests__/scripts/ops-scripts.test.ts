import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const tempDirs: string[] = [];

function run(command: string, args: string[]) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
  });
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('operator scripts', () => {
  it('keeps the post-deploy smoke script syntactically valid Python', () => {
    const script = path.join(root, 'scripts', 'post-deploy-smoke.py');
    const result = run('python3', ['-m', 'py_compile', script]);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it('keeps the read-only capacity probe syntactically valid Python', () => {
    const script = path.join(root, 'scripts', 'load-readonly.py');
    const result = run('python3', ['-m', 'py_compile', script]);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it('keeps the backup script syntactically valid bash', () => {
    const result = run('bash', ['-n', path.join(root, 'scripts', 'backup-postgres.sh')]);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it('keeps the restore script syntactically valid bash', () => {
    const result = run('bash', ['-n', path.join(root, 'scripts', 'restore-postgres.sh')]);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it('refuses restore of an existing archive without the explicit confirmation phrase', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'kfm-restore-test-'));
    tempDirs.push(dir);
    const backup = path.join(dir, 'placeholder.dump');
    writeFileSync(backup, 'test-placeholder');

    const result = spawnSync('bash', [path.join(root, 'scripts', 'restore-postgres.sh'), backup], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        RESTORE_DATABASE_URL: 'postgresql://example.invalid/kfm_restore',
        CONFIRM_RESTORE: '',
      },
    });

    expect(result.status).toBe(3);
    expect(`${result.stdout}${result.stderr}`).toContain('CONFIRM_RESTORE=RESTORE_TO_EMPTY_DATABASE');
  });
});
