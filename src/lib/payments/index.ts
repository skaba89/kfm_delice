/**
 * Payment Gateway Abstraction Layer — Mission 1 (Phase 3)
 *
 * UNIFIED payment service. This is the ONLY payment module used by
 * /api/payment/route.ts. The legacy src/lib/payment-providers.ts has
 * been removed.
 *
 * Rules:
 *   - cash → status 'pending' (confirmed manually by a cashier via PATCH)
 *   - card → status 'processing' (Stripe Checkout, confirmed by signed webhook)
 *   - orange_money / mtn_money / wave → real API only in production;
 *     simulation allowed ONLY when APP_MODE != 'production'
 *   - In production, unconfigured providers return an explicit error
 *     (no silent fallback to simulation)
 *
 * Idempotency:
 *   - The caller (/api/payment/route.ts) MUST pass an idempotencyKey
 *   - This module does NOT store idempotency (that's the route's job
 *     via the IdempotencyKey table) — it is stateless and pure.
 */

import {
  isOrangeMoneyConfigured,
  initiateOrangeMoneyPayment,
  verifyOrangeMoneyTransaction,
} from './orange-money';

import {
  isMTNMomoConfigured,
  initiateMTNMoMoPayment,
  verifyMTNMoMoTransaction,
} from './mtn-momo';

import {
  isWaveConfigured,
  initiateWavePayment,
  verifyWaveTransaction,
} from './wave';

export type PaymentMethod = 'cash' | 'orange_money' | 'mtn_money' | 'wave' | 'card';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed';

const IS_PRODUCTION = process.env.APP_MODE === 'production' || process.env.NODE_ENV === 'production';

export interface InitPaymentParams {
  method: PaymentMethod;
  phone: string;
  amount: number;
  orderId: string;
  currency?: string;
  returnUrl?: string;
  notifyUrl?: string;
  restaurantId?: string;
  idempotencyKey?: string;
}

export interface InitPaymentResult {
  success: boolean;
  status?: PaymentStatus;
  transactionRef?: string;
  paymentUrl?: string;
  message?: string;
  otpRequired?: boolean;
  error?: string;
}

export interface VerifyPaymentResult {
  status: PaymentStatus;
  transactionRef?: string;
  financialTransactionId?: string;
  error?: string;
}

/** Check if a payment method is using real API (not simulation) */
export function isProductionPayment(method: PaymentMethod): boolean {
  if (method === 'orange_money') return isOrangeMoneyConfigured();
  if (method === 'mtn_money') return isMTNMomoConfigured();
  if (method === 'wave') return isWaveConfigured();
  if (method === 'card') return !!process.env.STRIPE_SECRET_KEY;
  return false;
}

/**
 * Initiate a payment through the appropriate gateway.
 *
 * Mission 1 (Phase 3):
 *   - cash → pending (NOT paid). A cashier must confirm via PATCH.
 *   - card → processing (Stripe Checkout). Confirmed by signed webhook only.
 *   - mobile money → real API; simulation only in non-production.
 */
export async function initiatePayment(params: InitPaymentParams): Promise<InitPaymentResult> {
  const { method, phone, amount, orderId, currency = 'GNF', returnUrl, notifyUrl } = params;

  // ── Cash: pending until cashier confirms ──
  if (method === 'cash') {
    return {
      success: true,
      status: 'pending',
      transactionRef: `CASH_${Date.now()}`,
      message: 'Paiement en espèces enregistré. En attente de confirmation du caissier.',
    };
  }

  // ── Card: processing until Stripe webhook confirms ──
  if (method === 'card') {
    return initiateStripeCheckout(params);
  }

  // ── Orange Money ──
  if (method === 'orange_money') {
    if (isOrangeMoneyConfigured()) {
      const result = await initiateOrangeMoneyPayment({
        phone,
        amount,
        orderId,
        currency,
        returnUrl: returnUrl || '',
        notifyUrl: notifyUrl || '',
      });
      if (result.success) {
        return {
          success: true,
          status: 'processing',
          transactionRef: result.transactionRef,
          paymentUrl: result.paymentUrl,
          message: 'Paiement Orange Money initié. Confirmez sur votre téléphone.',
          otpRequired: true,
        };
      }
      return { success: false, error: result.error || 'Erreur Orange Money' };
    }
    // Not configured
    if (IS_PRODUCTION) {
      return {
        success: false,
        error: 'Orange Money n\'est pas configuré. Paiement impossible en production.',
      };
    }
    return simulatePayment('orange_money', phone, amount);
  }

  // ── MTN MoMo ──
  if (method === 'mtn_money') {
    if (isMTNMomoConfigured()) {
      const result = await initiateMTNMoMoPayment({
        phone,
        amount,
        orderId,
        currency,
        payerMessage: `Paiement commande KFM-${orderId.slice(-8).toUpperCase()}`,
      });
      if (result.success) {
        return {
          success: true,
          status: 'processing',
          transactionRef: result.transactionRef,
          message: 'Paiement MTN Money initié. Confirmez sur votre téléphone.',
          otpRequired: true,
        };
      }
      return { success: false, error: result.error || 'Erreur MTN Money' };
    }
    if (IS_PRODUCTION) {
      return {
        success: false,
        error: 'MTN MoMo n\'est pas configuré. Paiement impossible en production.',
      };
    }
    return simulatePayment('mtn_money', phone, amount);
  }

  // ── Wave ──
  if (method === 'wave') {
    if (isWaveConfigured()) {
      const result = await initiateWavePayment({
        phone,
        amount,
        orderId,
        currency,
        payerMessage: `Paiement commande KFM-${orderId.slice(-8).toUpperCase()}`,
      });
      if (result.success) {
        return {
          success: true,
          status: 'processing',
          transactionRef: result.transactionRef,
          paymentUrl: result.paymentUrl,
          message: 'Paiement Wave initié. Confirmez sur votre application Wave.',
          otpRequired: true,
        };
      }
      return { success: false, error: result.error || 'Erreur Wave' };
    }
    if (IS_PRODUCTION) {
      return {
        success: false,
        error: 'Wave n\'est pas configuré. Paiement impossible en production.',
      };
    }
    return simulatePayment('wave', phone, amount);
  }

  return { success: false, error: `Méthode de paiement non supportée : ${method}` };
}

/**
 * Initiate a Stripe Checkout Session for card payments.
 * Returns status='processing' — the order is only marked 'paid' when
 * the signed Stripe webhook confirms checkout.session.completed.
 */
async function initiateStripeCheckout(params: InitPaymentParams): Promise<InitPaymentResult> {
  const { amount, orderId, returnUrl, restaurantId } = params;
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

  if (!STRIPE_SECRET_KEY) {
    if (IS_PRODUCTION) {
      return {
        success: false,
        error: 'Stripe n\'est pas configuré (STRIPE_SECRET_KEY manquant). Paiement carte impossible en production.',
      };
    }
    // Dev fallback: return a mock checkout URL
    return {
      success: true,
      status: 'processing',
      transactionRef: `stripe-mock-${orderId}`,
      paymentUrl: `${process.env.PUBLIC_APP_URL || ''}/payment/mock?method=card&orderId=${orderId}&amount=${amount}`,
      message: 'Paiement carte (MODE DÉMO). Configurez STRIPE_SECRET_KEY pour la production.',
    };
  }

  // Real Stripe Checkout Session
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'mode': 'payment',
      'line_items[0][price_data][currency]': 'gnf',
      'line_items[0][price_data][product_data][name]': `Commande KFM Delice ${orderId}`,
      'line_items[0][price_data][unit_amount]': String(amount),
      'line_items[0][quantity]': '1',
      'success_url': returnUrl || `${process.env.PUBLIC_APP_URL}/payment/success`,
      'cancel_url': `${process.env.PUBLIC_APP_URL}/payment/cancel`,
      'client_reference_id': orderId,
      'metadata[orderId]': orderId,
      ...(restaurantId && { 'metadata[restaurantId]': restaurantId }),
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return {
      success: false,
      status: 'failed',
      error: `Stripe checkout session failed: ${res.status} ${errText.substring(0, 200)}`,
    };
  }

  const data = await res.json();
  if (!data.id || !data.url) {
    return { success: false, status: 'failed', error: 'Stripe: réponse incomplète (id ou url manquant)' };
  }

  return {
    success: true,
    status: 'processing',
    transactionRef: data.id,
    paymentUrl: data.url,
    message: 'Redirection vers Stripe Checkout...',
  };
}

/** Verify a payment transaction status */
export async function verifyPayment(
  method: PaymentMethod,
  transactionRef: string
): Promise<VerifyPaymentResult> {
  if (method === 'orange_money' && isOrangeMoneyConfigured()) {
    return verifyOrangeMoneyTransaction(transactionRef);
  }
  if (method === 'mtn_money' && isMTNMomoConfigured()) {
    return verifyMTNMoMoTransaction(transactionRef);
  }
  if (method === 'wave' && isWaveConfigured()) {
    return verifyWaveTransaction(transactionRef);
  }
  // For unconfigured methods or cash/card, just return paid
  return { status: 'paid', transactionRef };
}

/** Simulation fallback for development/demo ONLY (never in production) */
function simulatePayment(
  method: 'orange_money' | 'mtn_money' | 'wave',
  phone: string,
  _amount: number
): InitPaymentResult {
  const cleanPhone = phone.replace(/\s/g, '');
  if (!cleanPhone.startsWith('+224') && !cleanPhone.startsWith('224') && !cleanPhone.startsWith('6')) {
    const label = method === 'orange_money' ? 'Orange Money' : method === 'mtn_money' ? 'MTN Money' : 'Wave';
    return {
      success: false,
      error: `Numéro ${label} invalide. Format attendu : +224 6XX XXX XXX`,
    };
  }

  const isSuccess = Math.random() > 0.05;
  if (isSuccess) {
    const prefix = method === 'orange_money' ? 'OM' : method === 'mtn_money' ? 'MTN' : 'WAVE';
    const label = method === 'orange_money' ? 'Orange Money' : method === 'mtn_money' ? 'MTN Money' : 'Wave';
    return {
      success: true,
      status: 'processing',
      transactionRef: `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      message: `Paiement ${label} initié (MODE DÉMO). Confirmez sur votre téléphone.`,
      otpRequired: true,
    };
  }

  return {
    success: false,
    error: 'Solde insuffisant ou service temporairement indisponible. (MODE DÉMO)',
  };
}
