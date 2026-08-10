export interface CheckoutPricingInput {
  subtotal: number;
  promoDiscount?: number;
  deliveryFee?: number;
  minDelivery?: number;
  orderType: 'delivery' | 'takeaway' | 'dine_in';
  tipPercent?: number;
  customTip?: number | null;
}

export interface CheckoutPricingResult {
  subtotal: number;
  promoDiscount: number;
  deliveryFee: number;
  baseBeforeTip: number;
  maxTip: number;
  tip: number;
  total: number;
  deliveryMinimumMet: boolean;
  deliveryMinimumMissing: number;
}

export function computeCheckoutPricing(input: CheckoutPricingInput): CheckoutPricingResult {
  const subtotal = Math.max(0, Math.floor(input.subtotal || 0));
  const promoDiscount = Math.max(0, Math.min(subtotal, Math.floor(input.promoDiscount || 0)));
  const deliveryFee = input.orderType === 'delivery'
    ? Math.max(0, Math.floor(input.deliveryFee || 0))
    : 0;
  const minDelivery = input.orderType === 'delivery'
    ? Math.max(0, Math.floor(input.minDelivery || 0))
    : 0;

  // Backend validates the minimum on the server-computed subtotal BEFORE promo.
  const deliveryMinimumMet = input.orderType !== 'delivery' || subtotal >= minDelivery;
  const deliveryMinimumMissing = deliveryMinimumMet ? 0 : Math.max(0, minDelivery - subtotal);

  const baseBeforeTip = Math.max(0, subtotal + deliveryFee - promoDiscount);
  const maxTip = Math.floor(baseBeforeTip / 2);
  const requestedTip = input.customTip !== null && input.customTip !== undefined
    ? Math.max(0, Math.floor(input.customTip))
    : Math.round(baseBeforeTip * (Math.max(0, input.tipPercent || 0) / 100));
  const tip = Math.min(requestedTip, maxTip);

  return {
    subtotal,
    promoDiscount,
    deliveryFee,
    baseBeforeTip,
    maxTip,
    tip,
    total: baseBeforeTip + tip,
    deliveryMinimumMet,
    deliveryMinimumMissing,
  };
}
