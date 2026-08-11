import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  restaurantFindUnique: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    restaurant: { findUnique: mocks.restaurantFindUnique },
  },
}));

import { getRestaurantConfig, invalidateConfigCache } from '@/lib/constants';

function restaurant(plan: string, accountPlan: string | null, configOverrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    slug: 'tenant-a',
    name: 'Tenant A',
    tagline: '',
    description: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    hours: '',
    rating: 4.5,
    tables: 20,
    deliveryFee: 5000,
    minDelivery: 15000,
    deliveryZones: 'Conakry',
    currency: 'GNF',
    locale: 'fr',
    plan,
    account: accountPlan ? { plan: accountPlan } : null,
    config: {
      heroImage: '',
      logo: '',
      primaryColor: '#ea580c',
      accentColor: '#f97316',
      fontFamily: 'Inter',
      menuCategories: '[]',
      openingHours: '',
      features: JSON.stringify({
        delivery: true,
        reservations: true,
        reviews: true,
        loyalty: true,
        pos: true,
        invoices: true,
        quotes: true,
        expenses: true,
        staff: true,
        drivers: true,
        advanced_analytics: true,
        exports: true,
        custom_domain: true,
        api_access: true,
        white_label: true,
      }),
      socialLinks: '',
      customDomain: 'menu.example.test',
      metaTitle: '',
      metaDescription: '',
      ...configOverrides,
    },
  };
}

describe('resolved restaurant config commercial masking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateConfigCache();
  });

  it('uses Account.plan and masks stale Pro/Enterprise flags after downgrade to Starter', async () => {
    mocks.restaurantFindUnique.mockResolvedValue(restaurant('pro', 'starter'));

    const config = await getRestaurantConfig('tenant-a');

    expect(config?.plan).toBe('starter');
    expect(config?.features.invoices).toBe(true);
    expect(config?.features.loyalty).toBe(true);
    expect(config?.features.quotes).toBe(false);
    expect(config?.features.expenses).toBe(false);
    expect(config?.features.staff).toBe(false);
    expect(config?.features.drivers).toBe(false);
    expect(config?.features.advanced_analytics).toBe(false);
    expect(config?.features.exports).toBe(false);
    expect(config?.features.custom_domain).toBe(false);
    expect(config?.customDomain).toBe('');
  });

  it('enables Pro catalog features even when legacy JSON predates the new analytics/export flags', async () => {
    mocks.restaurantFindUnique.mockResolvedValue(restaurant('starter', 'pro', {
      features: JSON.stringify({
        delivery: true,
        reservations: true,
        reviews: true,
        loyalty: true,
        pos: true,
        invoices: true,
        quotes: true,
        expenses: true,
        staff: true,
        drivers: true,
      }),
    }));

    const config = await getRestaurantConfig('tenant-a');

    expect(config?.plan).toBe('pro');
    expect(config?.features.drivers).toBe(true);
    expect(config?.features.advanced_analytics).toBe(true);
    expect(config?.features.exports).toBe(true);
    expect(config?.features.custom_domain).toBe(false);
  });

  it('requires both Enterprise entitlement and config opt-in for a custom domain', async () => {
    mocks.restaurantFindUnique.mockResolvedValue(restaurant('enterprise', 'enterprise'));

    const config = await getRestaurantConfig('tenant-a');

    expect(config?.features.custom_domain).toBe(true);
    expect(config?.customDomain).toBe('menu.example.test');
  });
});
