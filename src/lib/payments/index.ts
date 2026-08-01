/**
 * Payment Gateway Abstraction Layer
 *
 * Routes payment requests to the appropriate provider (Orange Money, MTN MoMo, or simulation).
 * When real API credentials are configured, production payments are used.
 * Otherwise, falls back to simulation mode for development/demo.
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

export interface InitPaymentParams {
  method: PaymentMethod;
  phone: string;
  amount: number;
  orderId: string;
  currency?: string;
  returnUrl?: string;
  notifyUrl?: string;
  restaurantId?: string; // Mission 4: for Stripe metadata
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
  return false; // cash and card don't need external APIs
}

/** Initiate a payment through the appropriate gateway */
export async function initiatePayment(params: InitPaymentParams): Promise<InitPaymentResult> {
  const { method, phone, amount, orderId, currency = 'GNF', returnUrl, notifyUrl } = params;

  // Cash payments are always immediate
  if (method === 'cash') {
    return {
      success: true,
      status: 'paid',
      transactionRef: `CASH_${Date.now()}`,
      message: 'Paiement en espèces enregistré.',
    };
  }

  // Card payments are always immediate (for now — integrate Stripe later if needed)
  if (method === 'card') {
    return {
      success: true,
      status: 'paid',
      transactionRef: `CARD_${Date.now()}`,
      message: 'Paiement par carte enregistré.',
    };
  }

  // Orange Money — use real API if configured, otherwise simulate
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

      return {
        success: false,
        error: result.error || 'Erreur Orange Money',
      };
    }

    // Simulation fallback
    return simulatePayment('orange_money', phone, amount);
  }

  // MTN MoMo — use real API if configured, otherwise simulate
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

      return {
        success: false,
        error: result.error || 'Erreur MTN Money',
      };
    }

    // Simulation fallback
    return simulatePayment('mtn_money', phone, amount);
  }

  // Wave — use real API if configured, otherwise simulate
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

      return {
        success: false,
        error: result.error || 'Erreur Wave',
      };
    }

    // Simulation fallback
    return simulatePayment('wave', phone, amount);
  }

  return { success: false, error: `Méthode de paiement non supportée : ${method}` };
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

/** Simulation fallback for development/demo */
function simulatePayment(
  method: 'orange_money' | 'mtn_money' | 'wave',
  phone: string,
  _amount: number
): InitPaymentResult {
  // Validate phone format
  const cleanPhone = phone.replace(/\s/g, '');
  if (!cleanPhone.startsWith('+224') && !cleanPhone.startsWith('224') && !cleanPhone.startsWith('6')) {
    const label = method === 'orange_money' ? 'Orange Money' : method === 'mtn_money' ? 'MTN Money' : 'Wave';
    return {
      success: false,
      error: `Numéro ${label} invalide. Format attendu : +224 6XX XXX XXX`,
    };
  }

  // Simulate success (95% rate)
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
