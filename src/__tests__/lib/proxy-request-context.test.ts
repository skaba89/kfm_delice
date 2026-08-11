import { describe, expect, it } from 'vitest';
import { buildTrustedRequestHeaders } from '@/lib/proxy-request-context';

describe('trusted proxy request context', () => {
  it('removes client-spoofed internal identity headers', () => {
    const incoming = new Headers({
      'x-request-id': 'client-request-id',
      'x-user-id': 'attacker-user',
      'x-user-type': 'platform_admin',
      'x-user-role': 'super_admin',
      'x-restaurant-id': 'other-tenant',
      'x-restaurant-slug': 'public-slug',
      'user-agent': 'vitest',
    });

    const headers = buildTrustedRequestHeaders(incoming, {
      requestId: 'server-request-id',
      tenantSlug: 'trusted-slug',
      userId: 'user-1',
      userType: 'admin',
      userRole: 'manager',
      restaurantId: 'restaurant-1',
    });

    expect(headers.get('x-request-id')).toBe('server-request-id');
    expect(headers.get('x-user-id')).toBe('user-1');
    expect(headers.get('x-user-type')).toBe('admin');
    expect(headers.get('x-user-role')).toBe('manager');
    expect(headers.get('x-restaurant-id')).toBe('restaurant-1');
    expect(headers.get('x-restaurant-slug')).toBe('trusted-slug');
    expect(headers.get('user-agent')).toBe('vitest');
  });

  it('does not invent authenticated identity on public requests', () => {
    const incoming = new Headers({
      'x-user-id': 'spoofed',
      'x-restaurant-id': 'spoofed-tenant',
      'x-restaurant-slug': 'tenant-a',
    });

    const headers = buildTrustedRequestHeaders(incoming, {
      requestId: 'request-2',
      tenantSlug: 'tenant-a',
    });

    expect(headers.get('x-user-id')).toBeNull();
    expect(headers.get('x-user-type')).toBeNull();
    expect(headers.get('x-user-role')).toBeNull();
    expect(headers.get('x-restaurant-id')).toBeNull();
    expect(headers.get('x-restaurant-slug')).toBe('tenant-a');
  });
});
