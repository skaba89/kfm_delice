import { db } from './db';

export interface DayAvailability {
  open: number;
  close: number;
  closed?: boolean;
}

export type WeeklyAvailability = Partial<Record<
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
  DayAvailability
>> & { timezone?: string };

export interface SimpleAvailability {
  open: number;
  close: number;
  timezone?: string;
}

const DEFAULT_AVAILABILITY: SimpleAvailability = {
  open: 11,
  close: 23,
  timezone: 'Africa/Conakry',
};

const DAY_KEYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const;

function parseAvailability(raw: unknown): SimpleAvailability | WeeklyAvailability {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return DEFAULT_AVAILABILITY; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_AVAILABILITY;
  return value as SimpleAvailability | WeeklyAvailability;
}

function zonedParts(now: Date, timezone: string): { day: typeof DAY_KEYS[number]; minuteOfDay: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday')?.value?.toLowerCase();
    const dayMap: Record<string, typeof DAY_KEYS[number]> = {
      sun: 'sunday', mon: 'monday', tue: 'tuesday', wed: 'wednesday',
      thu: 'thursday', fri: 'friday', sat: 'saturday',
    };
    const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
    return { day: dayMap[weekday || ''] || 'sunday', minuteOfDay: hour * 60 + minute };
  } catch {
    return zonedParts(now, 'Africa/Conakry');
  }
}

function toMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const hours = Math.trunc(value);
  const fractionalMinutes = Math.round((value - hours) * 60);
  return Math.max(0, Math.min(24 * 60, hours * 60 + fractionalMinutes));
}

export function isRestaurantOpenAt(raw: unknown, now: Date = new Date()): boolean {
  const parsed = parseAvailability(raw);
  const timezone = typeof parsed.timezone === 'string' && parsed.timezone
    ? parsed.timezone
    : 'Africa/Conakry';
  const { day, minuteOfDay } = zonedParts(now, timezone);

  const weeklyEntry = (parsed as WeeklyAvailability)[day];
  const config: DayAvailability = weeklyEntry && typeof weeklyEntry === 'object'
    ? weeklyEntry
    : {
        open: Number((parsed as SimpleAvailability).open ?? DEFAULT_AVAILABILITY.open),
        close: Number((parsed as SimpleAvailability).close ?? DEFAULT_AVAILABILITY.close),
        closed: false,
      };

  if (config.closed) return false;
  const open = toMinutes(Number(config.open));
  const close = toMinutes(Number(config.close));
  if (open === close) return false;
  if (close > open) return minuteOfDay >= open && minuteOfDay < close;
  // Overnight service, e.g. 18:00 → 02:00.
  return minuteOfDay >= open || minuteOfDay < close;
}

export async function getRestaurantOrderingAvailability(
  restaurantId: string,
  now: Date = new Date()
): Promise<{ open: boolean; configured: boolean }> {
  const config = await db.restaurantConfig.findUnique({
    where: { restaurantId },
    select: { openingHours: true },
  });
  return {
    open: isRestaurantOpenAt(config?.openingHours ?? DEFAULT_AVAILABILITY, now),
    configured: Boolean(config),
  };
}
