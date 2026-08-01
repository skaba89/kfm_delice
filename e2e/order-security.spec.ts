/**
 * Mission 10: E2E security tests for the public order API.
 *
 * These tests hit the actual /api/orders endpoint and verify that
 * server-side validation rejects all client-side manipulation attempts.
 *
 * Prerequisites:
 *   - Dev server running on localhost:3000
 *   - At least one restaurant + menu items seeded
 */
import { test, expect, request } from '@playwright/test';

const API_BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

// Helper: create an API context
async function apiContext() {
  return await request.newContext({ baseURL: API_BASE });
}

test.describe('Mission 1: Order creation security', () => {
  test('Test 1: should reject client-sent total (prix falsifié)', async () => {
    const api = await apiContext();
    const res = await api.post('/api/orders', {
      data: {
        items: [{ menuItemId: 'test-item', quantity: 1 }],
        orderType: 'dine_in',
        total: 1, // client tries to set a 1 GNF total
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('FORBIDDEN_FIELDS');
    expect(body.forbidden).toContain('total');
  });

  test('Test 2: should reject non-existent menu item', async () => {
    const api = await apiContext();
    const res = await api.post('/api/orders', {
      data: {
        items: [{ menuItemId: 'non-existent-item-id', quantity: 1 }],
        orderType: 'dine_in',
      },
    });
    expect([400, 404]).toContain(res.status());
  });

  test('Test 3: should reject client-sent discount', async () => {
    const api = await apiContext();
    const res = await api.post('/api/orders', {
      data: {
        items: [{ menuItemId: 'test-item', quantity: 1 }],
        discount: 99999,
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('FORBIDDEN_FIELDS');
    expect(body.forbidden).toContain('discount');
  });

  test('Test 4: should reject client-sent deliveryFee', async () => {
    const api = await apiContext();
    const res = await api.post('/api/orders', {
      data: {
        items: [{ menuItemId: 'test-item', quantity: 1 }],
        orderType: 'delivery',
        deliveryFee: 0,
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.forbidden).toContain('deliveryFee');
  });

  test('Test 5: should reject status=paid sent at creation', async () => {
    const api = await apiContext();
    const res = await api.post('/api/orders', {
      data: {
        items: [{ menuItemId: 'test-item', quantity: 1 }],
        status: 'paid',
        paymentStatus: 'paid',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.forbidden).toContain('status');
    expect(body.forbidden).toContain('paymentStatus');
  });

  test('Test 6: should reject client-sent customerId', async () => {
    const api = await apiContext();
    const res = await api.post('/api/orders', {
      data: {
        items: [{ menuItemId: 'test-item', quantity: 1 }],
        customerId: 'someone-else-id',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.forbidden).toContain('customerId');
  });
});

test.describe('Mission 4: Stripe webhook security', () => {
  test('Test 10: should reject Stripe webhook without signature', async () => {
    const api = await apiContext();
    const res = await api.post('/api/webhooks/stripe', {
      data: {
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_123', amount_total: 50000 } },
      },
      headers: {
        'Content-Type': 'application/json',
        // NO stripe-signature header
      },
    });
    expect(res.status()).toBe(400);
  });

  test('Test 10b: should reject Stripe webhook with invalid signature', async () => {
    const api = await apiContext();
    const res = await api.post('/api/webhooks/stripe', {
      data: {
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_123', amount_total: 50000 } },
      },
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'invalid-signature-value',
      },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('Mission 9: Customer favorites security', () => {
  test('Test 15: should require authentication for favorites', async () => {
    const api = await apiContext();
    const res = await api.get('/api/customer/favorites');
    expect(res.status()).toBe(401);
  });

  test('Test 15b: should reject POST favorites without auth', async () => {
    const api = await apiContext();
    const res = await api.post('/api/customer/favorites', {
      data: { itemId: 'test-item' },
    });
    expect(res.status()).toBe(401);
  });
});
