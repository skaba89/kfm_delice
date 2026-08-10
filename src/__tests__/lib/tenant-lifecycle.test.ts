import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    restaurant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import {
  resolveTenant,
  resolveTenantFromRequest,
  resolveDefaultTenant,
  getRestaurantId,
  isTenantActive,
  isFeatureEnabled,
  invalidateTenantCache,
  extractSlug,
  generateSlug,
} from '@/lib/tenant';
import { db } from '@/lib/db';

const activeTenant = {
  id: 'r1', slug: 'kfm', name: 'KFM', currency: 'GNF', locale: 'fr', plan: 'pro', status: 'active',
};

describe('tenant lifecycle enforcement', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDefault = process.env.ALLOW_DEFAULT_TENANT;

  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTenantCache();
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_DEFAULT_TENANT;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDefault === undefined) delete process.env.ALLOW_DEFAULT_TENANT;
    else process.env.ALLOW_DEFAULT_TENANT = originalDefault;
  });

  it('resolves active and trial tenants', async () => {
    vi.mocked(db.restaurant.findUnique).mockResolvedValue(activeTenant as any);
    await expect(resolveTenant('kfm')).resolves.toMatchObject({ restaurantId: 'r1', status: 'active' });

    invalidateTenantCache();
    vi.mocked(db.restaurant.findUnique).mockResolvedValue({ ...activeTenant, status: 'trial' } as any);
    await expect(resolveTenant('kfm')).resolves.toMatchObject({ status: 'trial' });
  });

  it.each(['suspended', 'cancelled', 'inactive'])('blocks %s tenants globally', async (status) => {
    vi.mocked(db.restaurant.findUnique).mockResolvedValue({ ...activeTenant, status } as any);
    await expect(resolveTenant('kfm')).resolves.toBeNull();
  });

  it('never uses an implicit default tenant in production', async () => {
    process.env.NODE_ENV = 'production';
    const request = new Request('https://example.com/api/menu');
    await expect(resolveTenantFromRequest(request)).resolves.toBeNull();
    expect(db.restaurant.findFirst).not.toHaveBeenCalled();
  });

  it('uses only active/trial restaurants for explicit default fallback', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEFAULT_TENANT = 'true';
    vi.mocked(db.restaurant.findFirst).mockResolvedValue(activeTenant as any);
    await expect(resolveDefaultTenant()).resolves.toMatchObject({ restaurantId: 'r1' });
    expect(db.restaurant.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['active', 'trial'] } },
    }));
  });

  it('blocks restaurant ID resolution for suspended tenants', async () => {
    vi.mocked(db.restaurant.findUnique).mockResolvedValue({ ...activeTenant, status: 'suspended' } as any);
    const request = new Request('https://example.com/api/orders', {
      headers: { 'x-restaurant-slug': 'kfm' },
    });
    await expect(getRestaurantId(request)).resolves.toBeNull();
  });

  it('disables paid features when the tenant is not active', () => {
    expect(isTenantActive({ status: 'active' })).toBe(true);
    expect(isTenantActive({ status: 'trial' })).toBe(true);
    expect(isTenantActive({ status: 'suspended' })).toBe(false);
    expect(isFeatureEnabled({
      restaurantId: 'r', slug: 's', name: 'n', currency: 'GNF', locale: 'fr', plan: 'pro', status: 'suspended',
    }, 'loyalty')).toBe(false);
  });
});

describe('tenant identifiers', () => {
  it('extracts explicit header, path and query tenants', () => {
    expect(extractSlug(new Request('https://example.com/api/menu', { headers: { 'x-restaurant-slug': 'header-slug' } }))).toBe('header-slug');
    expect(extractSlug(new Request('https://example.com/r/path-slug/menu'))).toBe('path-slug');
    expect(extractSlug(new Request('https://example.com/api/menu?slug=query-slug'))).toBe('query-slug');
  });

  it('generates stable URL-safe slugs', () => {
    expect(generateSlug('KFM Délice Conakry')).toBe('kfm-delice-conakry');
  });
});
