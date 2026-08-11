import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const mocks = vi.hoisted(() => ({
  authenticateAdmin: vi.fn(),
  authenticateDriver: vi.fn(),
  driverFindFirst: vi.fn(),
  driverFindMany: vi.fn(),
  driverUpdateMany: vi.fn(),
  orderUpdateMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authenticateAdmin: mocks.authenticateAdmin,
  authenticateDriver: mocks.authenticateDriver,
  hasRole: () => true,
}));
vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  bigIntToNumber: (value: unknown) => value,
  db: {
    driver: {
      findFirst: mocks.driverFindFirst,
      findMany: mocks.driverFindMany,
      updateMany: mocks.driverUpdateMany,
    },
    order: { updateMany: mocks.orderUpdateMany },
  },
}));

import { GET as getLocation, PATCH as patchLocation } from '@/app/api/driver-location/route';

const driverAuth = {
  id: 'driver-a',
  restaurantId: 'restaurant-a',
  restaurantSlug: 'tenant-a',
  email: 'driver-a@example.test',
};

const adminAuth = {
  id: 'admin-a',
  restaurantId: 'restaurant-a',
  restaurantSlug: 'tenant-a',
  role: 'admin',
};

describe('driver location tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateAdmin.mockResolvedValue(null);
    mocks.authenticateDriver.mockResolvedValue(driverAuth);
    mocks.driverFindFirst.mockResolvedValue({ id: 'driver-a', name: 'A', phone: '', lat: 1, lng: 2, status: 'available', vehicle: 'moto', currentOrderId: '', lastLocationUpdate: new Date() });
    mocks.driverUpdateMany.mockResolvedValue({ count: 1 });
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('forbids a driver from reading another driver location by query id', async () => {
    const response = await getLocation(new Request('https://example.test/api/driver-location?driverId=driver-b'));
    expect(response.status).toBe(403);
    expect(mocks.driverFindFirst).not.toHaveBeenCalled();
  });

  it('forbids a driver from updating another driver by body id', async () => {
    const response = await patchLocation(new Request('https://example.test/api/driver-location', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ driverId: 'driver-b', lat: 9.5, lng: -13.7 }),
    }));
    expect(response.status).toBe(403);
    expect(mocks.driverUpdateMany).not.toHaveBeenCalled();
  });

  it('scopes admin location lookup to the admin restaurant', async () => {
    mocks.authenticateAdmin.mockResolvedValue(adminAuth);
    mocks.authenticateDriver.mockResolvedValue(null);
    mocks.driverFindFirst.mockResolvedValue(null);

    const response = await getLocation(new Request('https://example.test/api/driver-location?driverId=driver-other'));
    expect(response.status).toBe(404);
    expect(mocks.driverFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'driver-other', restaurantId: 'restaurant-a' },
    }));
  });

  it('scopes order coordinate writes by restaurant and authenticated driver', async () => {
    const response = await patchLocation(new Request('https://example.test/api/driver-location', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lat: 9.5, lng: -13.7, orderId: 'order-a' }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order-a', restaurantId: 'restaurant-a', driverId: 'driver-a' },
      data: { driverLat: 9.5, driverLng: -13.7 },
    });
  });
});

describe('driver delivery workflow contracts', () => {
  const source = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

  it('routes driver status transitions through the atomic terminal service', () => {
    const text = source('src/app/api/driver-orders/route.ts');
    expect(text).toContain('applyOrderPatchAtomically');
    expect(text).toContain('DRIVER_TRANSITIONS');
    expect(text).toContain('DRIVER_ORDER_CLAIM_REQUIRED');
    expect(text).not.toContain('totalDeliveries: { increment: 1 }');
  });

  it('does not expose deliveries already proposed to another driver in the shared pool', () => {
    const text = source('src/app/api/driver-orders/route.ts');
    expect(text).toContain('OPEN_ASSIGNMENT_STATES');
    expect(text).toContain('assignmentStatus: { in: OPEN_ASSIGNMENT_STATES }');
  });

  it('accepts proposals with compare-and-swap on both driver and order', () => {
    const text = source('src/app/api/orders/[id]/accept/route.ts');
    expect(text).toContain('tx.driver.updateMany');
    expect(text).toContain('tx.order.updateMany');
    expect(text).toContain('currentOrderId: ""');
    expect(text).toContain('assignmentStatus: "proposed"');
    expect(text).toContain('status: "ready"');
    expect(text).toContain('driverId: null');
  });

  it('rejects only the still-active proposal for the authenticated tenant driver', () => {
    const text = source('src/app/api/orders/[id]/reject/route.ts');
    expect(text).toContain('restaurantId: driverAuth.restaurantId');
    expect(text).toContain('proposedToDriverId: driverAuth.id');
    expect(text).toContain('assignmentStatus: "proposed"');
    expect(text).toContain('db.order.updateMany');
  });

  it('allows admin proposal only on READY unassigned orders without overwriting live proposals', () => {
    const text = source('src/app/api/orders/[id]/assign/route.ts');
    expect(text).toContain('if (order.status !== "ready")');
    expect(text).toContain('DELIVERY_PROPOSAL_IN_FLIGHT');
    expect(text).toContain('db.order.updateMany');
    expect(text).toContain('driverId: null');
    expect(text).not.toContain('data: {\n          assignmentStatus: "proposed",\n          proposedToDriverId: target.id,\n          proposedAt: new Date(),\n          status: "ready"');
  });
});
