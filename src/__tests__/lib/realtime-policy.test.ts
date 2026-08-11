import { describe, expect, it } from 'vitest';
import { isLocalRealtimeEnabled, resolveRealtimeMode } from '@/lib/realtime-policy';

describe('realtime policy', () => {
  it('always disables the process-local websocket server in NODE_ENV production', () => {
    expect(resolveRealtimeMode({ NODE_ENV: 'production', REALTIME_MODE: 'local' })).toBe('disabled');
    expect(isLocalRealtimeEnabled({ NODE_ENV: 'production', REALTIME_MODE: 'local' })).toBe(false);
  });

  it('always disables the process-local websocket server in APP_MODE production', () => {
    expect(resolveRealtimeMode({ APP_MODE: 'production', REALTIME_MODE: 'local' })).toBe('disabled');
  });

  it('keeps local realtime available for non-production development', () => {
    expect(resolveRealtimeMode({ NODE_ENV: 'development' })).toBe('local');
    expect(resolveRealtimeMode({ NODE_ENV: 'test', REALTIME_MODE: 'local' })).toBe('local');
  });

  it('can explicitly disable local realtime outside production', () => {
    expect(resolveRealtimeMode({ NODE_ENV: 'development', REALTIME_MODE: 'disabled' })).toBe('disabled');
  });
});
