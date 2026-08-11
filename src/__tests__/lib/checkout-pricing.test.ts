import { describe, expect, it } from 'vitest';
import { computeCheckoutPricing } from '@/lib/checkout-pricing';

describe('checkout pricing mirror', () => {
  it('mirrors delivery fee, promo and tip order used by the backend', () => {
    expect(computeCheckoutPricing({
      subtotal: 20_000,
      promoDiscount: 2_000,
      deliveryFee: 5_000,
      minDelivery: 15_000,
      orderType: 'delivery',
      tipPercent: 10,
    })).toMatchObject({
      baseBeforeTip: 23_000,
      tip: 2_300,
      total: 25_300,
      deliveryMinimumMet: true,
    });
  });

  it('checks delivery minimum against subtotal before promo', () => {
    const result = computeCheckoutPricing({
      subtotal: 14_000,
      promoDiscount: 4_000,
      deliveryFee: 5_000,
      minDelivery: 15_000,
      orderType: 'delivery',
    });
    expect(result.deliveryMinimumMet).toBe(false);
    expect(result.deliveryMinimumMissing).toBe(1_000);
  });

  it('does not charge delivery fee for takeaway or dine-in', () => {
    expect(computeCheckoutPricing({ subtotal: 10_000, deliveryFee: 5_000, orderType: 'takeaway' }).deliveryFee).toBe(0);
    expect(computeCheckoutPricing({ subtotal: 10_000, deliveryFee: 5_000, orderType: 'dine_in' }).deliveryFee).toBe(0);
  });

  it('clamps custom tips to the backend 50% maximum', () => {
    const result = computeCheckoutPricing({
      subtotal: 10_000,
      orderType: 'takeaway',
      customTip: 9_000,
    });
    expect(result.maxTip).toBe(5_000);
    expect(result.tip).toBe(5_000);
    expect(result.total).toBe(15_000);
  });
});
