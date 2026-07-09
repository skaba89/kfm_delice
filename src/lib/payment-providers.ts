/**
 * Payment provider abstraction for Guinean mobile money + cards.
 *
 * Supports:
 *   - Orange Money (Guinea) — via Orange Money Web Payment API
 *   - MTN MoMo (Guinea) — via MTN MoMo Open API
 *   - Wave (Guinea) — via Wave Pay API
 *   - Cash (no API, manual confirmation)
 *   - Card (via Stripe — for international customers)
 *
 * Each provider has its own env vars. If credentials are missing,
 * the provider falls back to "mock" mode (returns a fake payment URL)
 * so the app works in development without real API access.
 *
 * In production, set the env vars for each provider you want to enable.
 */

export type PaymentMethod = 'cash' | 'orange_money' | 'mtn_money' | 'wave' | 'card';

export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';

export interface PaymentInitRequest {
  orderId: string;
  method: PaymentMethod;
  amount: number; // in GNF
  phone?: string; // customer phone (for mobile money)
  customerName?: string;
  returnUrl?: string; // URL to redirect after payment
}

export interface PaymentInitResponse {
  success: boolean;
  paymentId?: string; // internal payment record ID
  providerPaymentId?: string; // provider's transaction ID
  paymentUrl?: string; // URL to redirect customer for payment
  status: PaymentStatus;
  error?: string;
}

export interface PaymentVerifyRequest {
  providerPaymentId: string;
  method: PaymentMethod;
}

export interface PaymentVerifyResponse {
  status: PaymentStatus;
  transactionRef?: string;
  rawResponse?: unknown;
}

// ── Provider configs ───────────────────────────────────────────

const ORANGE_MONEY_API_URL = process.env.ORANGE_MONEY_API_URL || 'https://api.orange.com';
const ORANGE_MONEY_CLIENT_ID = process.env.ORANGE_MONEY_CLIENT_ID || '';
const ORANGE_MONEY_CLIENT_SECRET = process.env.ORANGE_MONEY_CLIENT_SECRET || '';
const ORANGE_MONEY_MERCHANT_NUMBER = process.env.ORANGE_MONEY_MERCHANT_NUMBER || '';

const MTN_MOMO_API_URL = process.env.MTN_MOMO_API_URL || 'https://sandbox.momodeveloper.mtn.com';
const MTN_MOMO_SUBSCRIPTION_KEY = process.env.MTN_MOMO_SUBSCRIPTION_KEY || '';
const MTN_MOMO_USER_ID = process.env.MTN_MOMO_USER_ID || '';
const MTN_MOMO_API_KEY = process.env.MTN_MOMO_API_KEY || '';

const WAVE_API_URL = process.env.WAVE_API_URL || 'https://api.wave.com';
const WAVE_API_KEY = process.env.WAVE_API_KEY || '';
const WAVE_BUSINESS_ID = process.env.WAVE_BUSINESS_ID || '';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

// ── Mock mode detection ────────────────────────────────────────

function isMockMode(method: PaymentMethod): boolean {
  switch (method) {
    case 'orange_money':
      return !ORANGE_MONEY_CLIENT_ID || !ORANGE_MONEY_CLIENT_SECRET;
    case 'mtn_money':
      return !MTN_MOMO_SUBSCRIPTION_KEY || !MTN_MOMO_API_KEY;
    case 'wave':
      return !WAVE_API_KEY;
    case 'card':
      return !STRIPE_SECRET_KEY;
    default:
      return false;
  }
}

// ── Init payment ───────────────────────────────────────────────

export async function initPayment(req: PaymentInitRequest): Promise<PaymentInitResponse> {
  try {
    switch (req.method) {
      case 'cash':
        // Cash payments are always "pending" — confirmed manually by staff
        return {
          success: true,
          status: 'pending',
          paymentId: `cash-${req.orderId}`,
        };

      case 'orange_money':
        return await initOrangeMoney(req);

      case 'mtn_money':
        return await initMtnMoMo(req);

      case 'wave':
        return await initWave(req);

      case 'card':
        return await initStripe(req);

      default:
        return { success: false, status: 'failed', error: 'Méthode de paiement non supportée' };
    }
  } catch (error) {
    console.error('[payment] initPayment error:', error);
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Erreur de paiement',
    };
  }
}

// ── Orange Money ───────────────────────────────────────────────

async function initOrangeMoney(req: PaymentInitRequest): Promise<PaymentInitResponse> {
  if (isMockMode('orange_money')) {
    console.log('[payment] Orange Money: mock mode (no credentials)');
    return {
      success: true,
      status: 'processing',
      paymentId: `om-mock-${req.orderId}`,
      paymentUrl: `${process.env.PUBLIC_APP_URL || ''}/payment/mock?method=orange_money&orderId=${req.orderId}&amount=${req.amount}`,
    };
  }

  // Real Orange Money Web Payment API
  // 1. Get OAuth token
  const tokenRes = await fetch(`${ORANGE_MONEY_API_URL}/oauth/v3/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${ORANGE_MONEY_CLIENT_ID}:${ORANGE_MONEY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  const tokenData = await tokenRes.json();

  // 2. Create payment
  const payRes = await fetch(`${ORANGE_MONEY_API_URL}/omcoreapis/1.0.2/mp/init`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: req.amount,
      currency: 'GNF',
      orderId: req.orderId,
      merchantNumber: ORANGE_MONEY_MERCHANT_NUMBER,
      customerMsisdn: req.phone,
      returnUrl: req.returnUrl || `${process.env.PUBLIC_APP_URL}/payment/success`,
    }),
  });
  const payData = await payRes.json();

  return {
    success: true,
    status: 'processing',
    providerPaymentId: payData.transactionId || payData.id,
    paymentUrl: payData.paymentUrl || payData.redirectUrl,
  };
}

// ── MTN MoMo ───────────────────────────────────────────────────

async function initMtnMoMo(req: PaymentInitRequest): Promise<PaymentInitResponse> {
  if (isMockMode('mtn_money')) {
    console.log('[payment] MTN MoMo: mock mode (no credentials)');
    return {
      success: true,
      status: 'processing',
      paymentId: `mtn-mock-${req.orderId}`,
      paymentUrl: `${process.env.PUBLIC_APP_URL || ''}/payment/mock?method=mtn_money&orderId=${req.orderId}&amount=${req.amount}`,
    };
  }

  // Real MTN MoMo API — request-to-pay
  const reference = `KFM-${req.orderId.slice(-8)}`;
  const res = await fetch(`${MTN_MOMO_API_URL}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MTN_MOMO_API_KEY}`,
      'X-Reference-Id': reference,
      'X-Target-Environment': 'production',
      'Ocp-Apim-Subscription-Key': MTN_MOMO_SUBSCRIPTION_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: req.amount,
      currency: 'GNF',
      externalId: req.orderId,
      payer: { partyIdType: 'MSISDN', partyId: req.phone },
      payerMessage: `Commande ${req.orderId}`,
      payeeNote: 'KFM Delice',
    }),
  });

  if (res.status === 202) {
    return {
      success: true,
      status: 'processing',
      providerPaymentId: reference,
    };
  }

  const errorData = await res.json().catch(() => ({}));
  return {
    success: false,
    status: 'failed',
    error: errorData.message || 'MTN MoMo: erreur de paiement',
  };
}

// ── Wave ───────────────────────────────────────────────────────

async function initWave(req: PaymentInitRequest): Promise<PaymentInitResponse> {
  if (isMockMode('wave')) {
    console.log('[payment] Wave: mock mode (no credentials)');
    return {
      success: true,
      status: 'processing',
      paymentId: `wave-mock-${req.orderId}`,
      paymentUrl: `${process.env.PUBLIC_APP_URL || ''}/payment/mock?method=wave&orderId=${req.orderId}&amount=${req.amount}`,
    };
  }

  // Real Wave Checkout API
  const res = await fetch(`${WAVE_API_URL}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WAVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: req.amount,
      currency: 'GNF',
      error_url: req.returnUrl ? `${req.returnUrl}?status=error` : `${process.env.PUBLIC_APP_URL}/payment/error`,
      success_url: req.returnUrl ? `${req.returnUrl}?status=success` : `${process.env.PUBLIC_APP_URL}/payment/success`,
      business_id: WAVE_BUSINESS_ID,
    }),
  });
  const data = await res.json();

  return {
    success: true,
    status: 'processing',
    providerPaymentId: data.id,
    paymentUrl: data.wave_launch_url,
  };
}

// ── Stripe (card) ──────────────────────────────────────────────

async function initStripe(req: PaymentInitRequest): Promise<PaymentInitResponse> {
  if (isMockMode('card')) {
    console.log('[payment] Stripe: mock mode (no credentials)');
    return {
      success: true,
      status: 'processing',
      paymentId: `stripe-mock-${req.orderId}`,
      paymentUrl: `${process.env.PUBLIC_APP_URL || ''}/payment/mock?method=card&orderId=${req.orderId}&amount=${req.amount}`,
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
      'line_items[0][price_data][product_data][name]': `Commande KFM Delice ${req.orderId}`,
      'line_items[0][price_data][unit_amount]': String(req.amount),
      'line_items[0][quantity]': '1',
      'success_url': req.returnUrl || `${process.env.PUBLIC_APP_URL}/payment/success`,
      'cancel_url': `${process.env.PUBLIC_APP_URL}/payment/cancel`,
    }),
  });
  const data = await res.json();

  return {
    success: true,
    status: 'processing',
    providerPaymentId: data.id,
    paymentUrl: data.url,
  };
}

// ── Verify payment ─────────────────────────────────────────────

export async function verifyPayment(req: PaymentVerifyRequest): Promise<PaymentVerifyResponse> {
  try {
    // In mock mode, always return 'pending'
    if (req.providerPaymentId?.includes('-mock-')) {
      return { status: 'pending' };
    }

    switch (req.method) {
      case 'orange_money':
        // Query Orange Money transaction status
        return { status: 'pending', transactionRef: req.providerPaymentId };

      case 'mtn_money': {
        if (!MTN_MOMO_SUBSCRIPTION_KEY) return { status: 'pending' };
        const res = await fetch(
          `${MTN_MOMO_API_URL}/collection/v1_0/requesttopay/${req.providerPaymentId}`,
          {
            headers: {
              'Authorization': `Bearer ${MTN_MOMO_API_KEY}`,
              'X-Target-Environment': 'production',
              'Ocp-Apim-Subscription-Key': MTN_MOMO_SUBSCRIPTION_KEY,
            },
          }
        );
        const data = await res.json();
        const statusMap: Record<string, PaymentStatus> = {
          PENDING: 'pending',
          SUCCESSFUL: 'paid',
          FAILED: 'failed',
        };
        return {
          status: statusMap[data.status] || 'pending',
          transactionRef: data.financialTransactionId,
          rawResponse: data,
        };
      }

      case 'wave': {
        if (!WAVE_API_KEY) return { status: 'pending' };
        const res = await fetch(`${WAVE_API_URL}/v1/checkout/sessions/${req.providerPaymentId}`, {
          headers: { 'Authorization': `Bearer ${WAVE_API_KEY}` },
        });
        const data = await res.json();
        return {
          status: data.payment_status === 'paid' ? 'paid' : 'pending',
          transactionRef: data.id,
          rawResponse: data,
        };
      }

      case 'card': {
        if (!STRIPE_SECRET_KEY) return { status: 'pending' };
        const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${req.providerPaymentId}`, {
          headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
        });
        const data = await res.json();
        return {
          status: data.payment_status === 'paid' ? 'paid' : 'pending',
          transactionRef: data.id,
          rawResponse: data,
        };
      }

      default:
        return { status: 'pending' };
    }
  } catch (error) {
    console.error('[payment] verifyPayment error:', error);
    return { status: 'pending' };
  }
}

// ── Provider info (for UI) ─────────────────────────────────────

export function getAvailableProviders(): { method: PaymentMethod; label: string; enabled: boolean; mock: boolean }[] {
  return [
    { method: 'cash', label: 'Espèces', enabled: true, mock: false },
    { method: 'orange_money', label: 'Orange Money', enabled: true, mock: isMockMode('orange_money') },
    { method: 'mtn_money', label: 'MTN MoMo', enabled: true, mock: isMockMode('mtn_money') },
    { method: 'wave', label: 'Wave', enabled: true, mock: isMockMode('wave') },
    { method: 'card', label: 'Carte bancaire', enabled: true, mock: isMockMode('card') },
  ];
}
