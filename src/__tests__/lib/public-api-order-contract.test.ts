import { describe, expect, it } from 'vitest';
import { normalizePublicOrderPayload } from '@/lib/public-api';

describe('public order request contract', () => {
  it('converts the legacy menu item shape to the strict API shape', () => {
    const payload = normalizePublicOrderPayload({
      slug: 'kfm-delice',
      items: [
        { id: 'menu-1', name: 'Riz', price: 35000, qty: 2 },
      ],
      total: 70000,
      deliveryFee: 5000,
      discount: 1000,
      tax: 0,
      orderType: 'delivery',
      paymentMethod: 'cash',
      customerName: 'Client Test',
      phone: '+224620000000',
      deliveryAddress: 'Kaloum',
    });

    expect(payload).toEqual({
      items: [{ menuItemId: 'menu-1', quantity: 2 }],
      orderType: 'delivery',
      customerName: 'Client Test',
      phone: '+224620000000',
      deliveryAddress: 'Kaloum',
      paymentMethod: 'cash',
    });
  });

  it('never forwards browser-computed monetary or privileged fields', () => {
    const payload = normalizePublicOrderPayload({
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
      total: 1,
      subtotal: 1,
      deliveryFee: 0,
      discount: 999999,
      tax: 0,
      status: 'delivered',
      paymentStatus: 'paid',
      customerId: 'other-customer',
      driverId: 'other-driver',
      platformCommission: 0,
      driverEarning: 999999,
      orderType: 'takeaway',
      paymentMethod: 'cash',
    });

    expect(payload).toEqual({
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
      orderType: 'takeaway',
      paymentMethod: 'cash',
    });
  });

  it('preserves a manual table number as a non-authoritative note instead of sending tableNumber', () => {
    const payload = normalizePublicOrderPayload({
      items: [{ id: 'menu-1', qty: 1 }],
      orderType: 'dine_in',
      paymentMethod: 'cash',
      tableNumber: 12,
      note: 'Sans piment',
    });

    expect(payload).toEqual({
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
      orderType: 'dine_in',
      paymentMethod: 'cash',
      note: '[Table 12] Sans piment',
    });
    expect(payload).not.toHaveProperty('tableNumber');
  });

  it('keeps QR table tokens structured and does not duplicate them into notes', () => {
    const payload = normalizePublicOrderPayload({
      items: [{ id: 'menu-1', qty: 1 }],
      orderType: 'dine_in',
      paymentMethod: 'cash',
      tableNumber: 12,
      tableQrToken: 'qr-token',
      note: 'Sans piment',
    });

    expect(payload).toEqual({
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
      orderType: 'dine_in',
      paymentMethod: 'cash',
      tableQrToken: 'qr-token',
      note: 'Sans piment',
    });
  });
});
