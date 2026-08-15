#!/usr/bin/env node
'use strict';

/**
 * Bounded launcher for the historical PromoCode migration repair.
 *
 * The repair itself lives in repair-promo-migration-core.cjs and remains
 * unchanged. This launcher only constrains PostgreSQL waits and the total
 * startup time so Render cannot spend its whole port-binding window stuck
 * before Next.js starts.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');

const WATCHDOG_MS = 60_000;
const KILL_GRACE_MS = 5_000;
const CORE_SCRIPT = path.join(__dirname, 'repair-promo-migration-core.cjs');

function isPostgres(rawUrl) {
  return rawUrl.startsWith('postgresql://') || rawUrl.startsWith('postgres://');
}

function buildBoundedDatabaseUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL URL');
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(`Unsupported DATABASE_URL protocol for PromoCode repair: ${url.protocol}`);
  }

  // These settings affect only the repair child process. The original secret
  // and the application-wide DATABASE_URL remain unchanged.
  url.searchParams.set('connect_timeout', '10');
  url.searchParams.set('pool_timeout', '10');
  url.searchParams.set('socket_timeout', '30');
  url.searchParams.set('application_name', 'kfm-promo-repair');

  const boundedPgOptions = '-c lock_timeout=10000 -c statement_timeout=30000';
  const existingOptions = url.searchParams.get('options');
  url.searchParams.set(
    'options',
    existingOptions ? `${existingOptions} ${boundedPgOptions}` : boundedPgOptions
  );

  return url.toString();
}

function terminateProcessGroup(child, signal) {
  if (!child.pid) return;

  try {
    if (process.platform !== 'win32') {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch (error) {
    // ESRCH means the child already exited between the timer and this call.
    if (error?.code !== 'ESRCH') {
      console.error(`[promo-repair] Failed to send ${signal}:`, error?.message || String(error));
    }
  }
}

function main() {
  const rawUrl = process.env.DATABASE_URL || '';

  // Preserve the historical script contract for SQLite/local environments.
  if (!isPostgres(rawUrl)) {
    console.log('[promo-repair] Non-PostgreSQL provider; nothing to do.');
    return;
  }

  let boundedUrl;
  try {
    boundedUrl = buildBoundedDatabaseUrl(rawUrl);
  } catch (error) {
    console.error('[promo-repair] FATAL:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  console.log(
    '[promo-repair] Starting bounded repair ' +
      '(connect=10s, pool=10s, socket=30s, lock=10s, statement=30s, watchdog=60s)...'
  );

  const child = spawn(process.execPath, [CORE_SCRIPT], {
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      DATABASE_URL: boundedUrl,
    },
  });

  let watchdogExpired = false;
  let killTimer = null;

  const watchdog = setTimeout(() => {
    watchdogExpired = true;
    console.error(
      '[promo-repair] FATAL: repair exceeded the 60s startup watchdog; ' +
        'terminating it so Render fails fast instead of timing out silently.'
    );
    terminateProcessGroup(child, 'SIGTERM');

    killTimer = setTimeout(() => {
      console.error('[promo-repair] Repair did not stop after SIGTERM; forcing SIGKILL.');
      terminateProcessGroup(child, 'SIGKILL');
    }, KILL_GRACE_MS);
    killTimer.unref?.();
  }, WATCHDOG_MS);

  watchdog.unref?.();

  child.once('error', (error) => {
    clearTimeout(watchdog);
    if (killTimer) clearTimeout(killTimer);
    console.error('[promo-repair] FATAL: unable to start repair process:', error.message);
    process.exitCode = 1;
  });

  child.once('exit', (code, signal) => {
    clearTimeout(watchdog);
    if (killTimer) clearTimeout(killTimer);

    if (watchdogExpired) {
      process.exitCode = 124;
      return;
    }

    if (signal) {
      console.error(`[promo-repair] FATAL: repair process terminated by ${signal}.`);
      process.exitCode = 1;
      return;
    }

    if (code !== 0) {
      console.error(`[promo-repair] FATAL: repair process exited with code ${code}.`);
      process.exitCode = typeof code === 'number' ? code : 1;
      return;
    }

    console.log('[promo-repair] ✓ Bounded repair process completed.');
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  WATCHDOG_MS,
  KILL_GRACE_MS,
  buildBoundedDatabaseUrl,
  isPostgres,
};
