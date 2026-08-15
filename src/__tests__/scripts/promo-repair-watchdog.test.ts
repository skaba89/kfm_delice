import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const wrapperPath = path.join(root, 'scripts', 'repair-promo-migration.cjs');
const corePath = path.join(root, 'scripts', 'repair-promo-migration-core.cjs');
const require = createRequire(import.meta.url);

const {
  WATCHDOG_MS,
  KILL_GRACE_MS,
  buildBoundedDatabaseUrl,
  isPostgres,
} = require(wrapperPath) as {
  WATCHDOG_MS: number;
  KILL_GRACE_MS: number;
  buildBoundedDatabaseUrl: (url: string) => string;
  isPostgres: (url: string) => boolean;
};

describe('PromoCode migration repair startup guard', () => {
  it('keeps the wrapper and preserved repair core syntactically valid', () => {
    for (const script of [wrapperPath, corePath]) {
      const result = spawnSync(process.execPath, ['--check', script], {
        cwd: root,
        encoding: 'utf8',
      });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    }
  });

  it('bounds PostgreSQL connection, lock and statement waits without losing existing URL options', () => {
    const bounded = new URL(
      buildBoundedDatabaseUrl(
        'postgresql://user:secret@localhost:5432/kfm?schema=public&sslmode=prefer&options=-c%20idle_in_transaction_session_timeout%3D5000'
      )
    );

    expect(bounded.username).toBe('user');
    expect(bounded.password).toBe('secret');
    expect(bounded.searchParams.get('schema')).toBe('public');
    expect(bounded.searchParams.get('sslmode')).toBe('prefer');
    expect(bounded.searchParams.get('connect_timeout')).toBe('10');
    expect(bounded.searchParams.get('pool_timeout')).toBe('10');
    expect(bounded.searchParams.get('socket_timeout')).toBe('30');
    expect(bounded.searchParams.get('application_name')).toBe('kfm-promo-repair');

    const options = bounded.searchParams.get('options') || '';
    expect(options).toContain('idle_in_transaction_session_timeout=5000');
    expect(options).toContain('lock_timeout=10000');
    expect(options).toContain('statement_timeout=30000');
  });

  it('keeps the Render startup watchdog well below the observed platform timeout', () => {
    expect(WATCHDOG_MS).toBe(60_000);
    expect(KILL_GRACE_MS).toBe(5_000);

    const wrapper = readFileSync(wrapperPath, 'utf8');
    expect(wrapper).toContain('repair-promo-migration-core.cjs');
    expect(wrapper).toContain("terminateProcessGroup(child, 'SIGTERM')");
    expect(wrapper).toContain("terminateProcessGroup(child, 'SIGKILL')");
    expect(wrapper).toContain('process.exitCode = 124');
  });

  it('preserves the historical no-op contract outside PostgreSQL', () => {
    expect(isPostgres('postgresql://localhost/db')).toBe(true);
    expect(isPostgres('postgres://localhost/db')).toBe(true);
    expect(isPostgres('file:./db/custom.db')).toBe(false);

    const result = spawnSync(process.execPath, [wrapperPath], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: 'file:./db/custom.db',
      },
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('Non-PostgreSQL provider; nothing to do.');
  });

  it('keeps the original targeted PromoCode recovery logic in the core script', () => {
    const core = readFileSync(corePath, 'utf8');
    expect(core).toContain("const MIGRATION_NAME = '20260713040000_add_promo_codes';");
    expect(core).toContain('PromoCode_restaurantId_fkey');
    expect(core).toContain("['migrate', 'resolve', '--applied', MIGRATION_NAME]");
    expect(core).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)\b/i);
    expect(core).not.toContain("['migrate', 'reset'");
    expect(core).not.toContain("'--accept-data-loss'");
  });
});
