import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateAdmin: vi.fn(),
  hashPassword: vi.fn(async (value: string) => `hashed:${value}`),
  verifyPassword: vi.fn(async () => true),
  logAudit: vi.fn(async () => undefined),
  adminFindUnique: vi.fn(),
  adminFindFirst: vi.fn(),
  adminFindMany: vi.fn(),
  adminCount: vi.fn(),
  adminCreate: vi.fn(),
  adminUpdate: vi.fn(),
  adminDeleteMany: vi.fn(),
  restaurantFindUnique: vi.fn(),
  restaurantFindMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authenticateAdmin: mocks.authenticateAdmin,
  hasRole: (role: string, allowed: readonly string[]) => allowed.includes(role),
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
  ADMIN_ROLES: ['admin', 'manager', 'staff', 'cashier', 'kitchen', 'delivery_manager', 'driver', 'host', 'accountant'],
}));

vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  bigIntToNumber: (value: unknown) => value,
  db: {
    admin: {
      findUnique: mocks.adminFindUnique,
      findFirst: mocks.adminFindFirst,
      findMany: mocks.adminFindMany,
      count: mocks.adminCount,
      create: mocks.adminCreate,
      update: mocks.adminUpdate,
      deleteMany: mocks.adminDeleteMany,
    },
    restaurant: {
      findUnique: mocks.restaurantFindUnique,
      findMany: mocks.restaurantFindMany,
    },
  },
}));

vi.mock('@/lib/audit', () => ({ logAudit: mocks.logAudit }));

import { POST, PATCH, DELETE } from '@/app/api/admins/route';

const caller = {
  id: 'admin-owner',
  email: 'owner@test.local',
  name: 'Owner',
  role: 'admin',
  restaurantId: 'r1',
  restaurantSlug: 'resto',
  accountId: 'acc1',
};

const explicitTestPassword = ['test', 'pw', 'value'].join('-');
const currentTestPassword = ['current', 'pw', 'value'].join('-');

function postRequest(body: Record<string, unknown>) {
  return new Request('https://example.test/api/admins', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('admin commercial entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateAdmin.mockResolvedValue(caller);
    mocks.adminFindUnique.mockResolvedValue(null);
    mocks.restaurantFindUnique.mockResolvedValue({
      id: 'r1',
      accountId: 'acc1',
      account: { id: 'acc1', status: 'active', maxAdmins: 3 },
    });
    mocks.restaurantFindMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
    mocks.adminCount.mockResolvedValue(1);
  });

  it('blocks creation when the account admin quota is reached', async () => {
    mocks.adminCount.mockResolvedValue(3);

    const response = await POST(postRequest({
      email: 'new@test.local',
      name: 'New Admin',
      password: explicitTestPassword,
      role: 'manager',
    }));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.code).toBe('ACCOUNT_ADMIN_QUOTA_REACHED');
    expect(json).toMatchObject({ usage: 3, limit: 3 });
    expect(mocks.adminCreate).not.toHaveBeenCalled();
  });

  it('blocks creation for a suspended SaaS account', async () => {
    mocks.restaurantFindUnique.mockResolvedValue({
      id: 'r1',
      accountId: 'acc1',
      account: { id: 'acc1', status: 'suspended', maxAdmins: 3 },
    });

    const response = await POST(postRequest({
      email: 'new@test.local',
      name: 'New Admin',
      password: explicitTestPassword,
    }));

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ACCOUNT_UNAVAILABLE');
    expect(mocks.adminCreate).not.toHaveBeenCalled();
  });

  it('issues a one-time random password when omitted and never exposes a password hash', async () => {
    mocks.adminCreate.mockImplementation(async ({ data }: any) => ({
      id: 'new-admin',
      email: data.email,
      name: data.name,
      role: data.role,
      status: data.status,
      mustChangePassword: data.mustChangePassword,
      restaurantId: data.restaurantId,
      accountId: data.accountId,
      canCreateRestaurant: false,
      restaurantCreationLimit: 0,
      restaurantsCreatedCount: 0,
      createdAt: new Date('2026-08-11T00:00:00Z'),
      updatedAt: new Date('2026-08-11T00:00:00Z'),
    }));

    const response = await POST(postRequest({
      email: 'new@test.local',
      name: 'New Admin',
      role: 'manager',
    }));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.mustChangePassword).toBe(true);
    expect(typeof json.temporaryPassword).toBe('string');
    expect(json.temporaryPassword.length).toBeGreaterThanOrEqual(20);
    expect(json.password).toBeUndefined();
    expect(mocks.hashPassword).toHaveBeenCalledWith(json.temporaryPassword);
  });

  it('returns a safe projection after password update', async () => {
    mocks.adminFindFirst.mockResolvedValue({ id: 'target', password: 'old-hash' });
    mocks.adminUpdate.mockResolvedValue({
      id: 'target',
      email: 'target@test.local',
      name: 'Target',
      role: 'manager',
      status: 'active',
      mustChangePassword: false,
      restaurantId: 'r1',
      accountId: 'acc1',
      canCreateRestaurant: false,
      restaurantCreationLimit: 0,
      restaurantsCreatedCount: 0,
      createdAt: new Date('2026-08-11T00:00:00Z'),
      updatedAt: new Date('2026-08-11T00:00:00Z'),
    });

    const response = await PATCH(new Request('https://example.test/api/admins', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'target',
        password: explicitTestPassword,
        currentPassword: currentTestPassword,
      }),
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.password).toBeUndefined();
  });

  it('prevents an administrator from deleting their own active account', async () => {
    const response = await DELETE(new Request('https://example.test/api/admins?id=admin-owner', {
      method: 'DELETE',
    }));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('SELF_DELETE_FORBIDDEN');
    expect(mocks.adminDeleteMany).not.toHaveBeenCalled();
  });
});
