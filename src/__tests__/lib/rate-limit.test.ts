import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimit } from '@/lib/rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should allow requests within limit', () => {
    const result = rateLimit('test-ip', 5, 60000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should block requests exceeding limit', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('test-ip-2', 5, 60000);
    }
    const result = rateLimit('test-ip-2', 5, 60000);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after window expires', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('test-ip-3', 5, 60000);
    }
    vi.advanceTimersByTime(61000);
    const result = rateLimit('test-ip-3', 5, 60000);
    expect(result.success).toBe(true);
  });

  it('should track different identifiers independently', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('ip-a', 5, 60000);
    }
    const resultB = rateLimit('ip-b', 5, 60000);
    expect(resultB.success).toBe(true);

    const resultA = rateLimit('ip-a', 5, 60000);
    expect(resultA.success).toBe(false);
  });
});
