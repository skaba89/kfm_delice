import { describe, expect, it } from 'vitest';
import { isRestaurantOpenAt } from '@/lib/restaurant-availability';

describe('restaurant ordering availability', () => {
  it('uses tenant timezone for simple daily hours', () => {
    const hours = { open: 11, close: 23, timezone: 'Africa/Conakry' };
    expect(isRestaurantOpenAt(hours, new Date('2026-08-11T12:00:00Z'))).toBe(true);
    expect(isRestaurantOpenAt(hours, new Date('2026-08-11T23:30:00Z'))).toBe(false);
  });

  it('supports weekly closed days', () => {
    const weekly = {
      timezone: 'Africa/Conakry',
      monday: { open: 11, close: 23, closed: false },
      tuesday: { open: 11, close: 23, closed: true },
    };
    expect(isRestaurantOpenAt(weekly, new Date('2026-08-10T12:00:00Z'))).toBe(true); // Monday
    expect(isRestaurantOpenAt(weekly, new Date('2026-08-11T12:00:00Z'))).toBe(false); // Tuesday
  });

  it('supports overnight service windows', () => {
    const hours = { open: 18, close: 2, timezone: 'Africa/Conakry' };
    expect(isRestaurantOpenAt(hours, new Date('2026-08-11T23:00:00Z'))).toBe(true);
    expect(isRestaurantOpenAt(hours, new Date('2026-08-12T01:00:00Z'))).toBe(true);
    expect(isRestaurantOpenAt(hours, new Date('2026-08-12T10:00:00Z'))).toBe(false);
  });

  it('falls back safely for malformed configs', () => {
    expect(isRestaurantOpenAt('not-json', new Date('2026-08-11T12:00:00Z'))).toBe(true);
  });
});
