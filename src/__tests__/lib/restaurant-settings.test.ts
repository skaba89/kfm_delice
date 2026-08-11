import { afterEach, describe, expect, it } from 'vitest';
import {
  normalizeRestaurantConfigData,
  normalizeRestaurantSettingsData,
  restaurantSettingsPatchSchema,
} from '@/lib/restaurant-settings';

describe('restaurant settings contract', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('rejects unknown and server-authoritative restaurant fields', () => {
    const result = restaurantSettingsPatchSchema.safeParse({
      restaurant: { name: 'Tenant A', plan: 'enterprise', status: 'active' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown config fields and invalid business values', () => {
    expect(restaurantSettingsPatchSchema.safeParse({
      restaurant: { deliveryFee: -1 },
    }).success).toBe(false);
    expect(restaurantSettingsPatchSchema.safeParse({
      restaurant: { currency: 'gnf' },
    }).success).toBe(false);
    expect(restaurantSettingsPatchSchema.safeParse({
      config: { arbitrarySecret: 'value' },
    }).success).toBe(false);
  });

  it('accepts the historical useful settings surface with bounded types', () => {
    const result = restaurantSettingsPatchSchema.safeParse({
      restaurant: {
        name: 'Restaurant Test',
        email: 'contact@example.test',
        tables: 12,
        deliveryFee: 5000,
        minDelivery: 15000,
        deliveryZones: ['Kaloum', 'Dixinn'],
        currency: 'GNF',
        locale: 'fr',
      },
      config: {
        primaryColor: '#ea580c',
        features: { delivery: true, loyalty: false },
        openingHours: { monday: { open: 11, close: 23, closed: false } },
      },
    });
    expect(result.success).toBe(true);
  });

  it('normalizes delivery zones and provider-native money for SQLite', () => {
    process.env.DATABASE_URL = 'file:./test.db';
    const data = normalizeRestaurantSettingsData({
      deliveryZones: ['Kaloum', 'Dixinn'],
      deliveryFee: 5000,
      minDelivery: 15000,
    });

    expect(data.deliveryZones).toBe('Kaloum:Dixinn');
    expect(data.deliveryFee).toBe(5000);
    expect(data.minDelivery).toBe(15000);
  });

  it('normalizes monetary fields to bigint for PostgreSQL', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/kfm_test';
    const data = normalizeRestaurantSettingsData({
      deliveryFee: 5000,
      minDelivery: 15000,
    });

    expect(data.deliveryFee).toBe(5000n);
    expect(data.minDelivery).toBe(15000n);
  });

  it('canonicalizes structured config JSON consistently', () => {
    const data = normalizeRestaurantConfigData({
      features: { delivery: true, loyalty: false },
      socialLinks: '{"facebook":"https://example.test"}',
      primaryColor: '#fff',
    });

    expect(data.features).toBe('{"delivery":true,"loyalty":false}');
    expect(data.socialLinks).toBe('{"facebook":"https://example.test"}');
    expect(data.primaryColor).toBe('#fff');
  });

  it('rejects malformed structured JSON strings', () => {
    expect(restaurantSettingsPatchSchema.safeParse({
      config: { features: '{not-json}' },
    }).success).toBe(false);
  });
});
