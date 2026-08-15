import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

  it('publishes only a verified PostgreSQL dump and its matching sidecars', () => {
    const workflow = readFileSync(
      path.join(root, '.github', 'workflows', 'backup.yml'),
      'utf8',
    );

    expect(workflow).toContain("-name '*.dump'");
    expect(workflow).toContain('Expected exactly one PostgreSQL .dump file');
    expect(workflow).toContain('pg_restore --list "$backup_file"');
    expect(workflow).toContain('sha256sum --check "$(basename "$manifest_file")"');
    expect(workflow).toContain('${{ steps.backup.outputs.backup_path }}.sha256');
    expect(workflow).toContain('${{ steps.backup.outputs.backup_path }}.list.txt');
    expect(workflow).not.toContain("find backups -maxdepth 1 -type f -printf");
    expect(workflow).not.toContain('mv "$latest"');
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
