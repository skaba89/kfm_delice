export type RealtimeMode = 'disabled' | 'local';

interface RealtimeEnvironment {
  NODE_ENV?: string;
  APP_MODE?: string;
  REALTIME_MODE?: string;
}

/**
 * The built-in `ws` server is intentionally restricted to non-production
 * development. It keeps a process-local connection registry and therefore
 * cannot provide tenant-safe, multi-instance delivery guarantees.
 *
 * Production must use the HTTP/polling paths until a distributed realtime
 * adapter (Redis/pub-sub or a managed realtime service) is configured.
 */
export function resolveRealtimeMode(
  env: RealtimeEnvironment = typeof process !== 'undefined' ? process.env : {}
): RealtimeMode {
  const production = env.NODE_ENV === 'production' || env.APP_MODE === 'production';
  if (production) return 'disabled';

  const requested = (env.REALTIME_MODE || 'local').toLowerCase();
  return requested === 'local' ? 'local' : 'disabled';
}

export function isLocalRealtimeEnabled(
  env: RealtimeEnvironment = typeof process !== 'undefined' ? process.env : {}
): boolean {
  return resolveRealtimeMode(env) === 'local';
}
