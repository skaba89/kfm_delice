import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();

function run(command: string, args: string[]) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
  });
}

describe('operator scripts', () => {
  it('keeps the post-deploy smoke script syntactically valid Python', () => {
    const script = path.join(root, 'scripts', 'post-deploy-smoke.py');
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

  it('refuses restore without the explicit destructive-operation confirmation', () => {
    const result = spawnSync('bash', [path.join(root, 'scripts', 'restore-postgres.sh'), '/tmp/nonexistent.dump'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        RESTORE_DATABASE_URL: 'postgresql://example.invalid/kfm_restore',
        CONFIRM_RESTORE: '',
      },
    });
    expect(result.status).not.toBe(0);
  });
});
