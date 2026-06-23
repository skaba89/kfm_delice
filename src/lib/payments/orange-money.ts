/**
 * Orange Money API Integration
 *
 * Production API docs: https://developer.orange.com/apis/orange-money-webpay
 *
 * To activate:
 * 1. Register at https://developer.orange.com
 * 2. Get your client_id, client_secret, merchant_id
 * 3. Set these env vars in Render:
 *    - ORANGE_MONEY_CLIENT_ID
 *    - ORANGE_MONEY_CLIENT_SECRET
 *    - ORANGE_MONEY_MERCHANT_ID
 *    - ORANGE_MONEY_API_URL (default: https://api.orange.com)
 *
 * Flow:
 * 1. Frontend calls POST /api/payment → initPayment()
 * 2. We call Orange Money WebPay API → get payment_url + pay_token
 * 3. Frontend redirects user to payment_url
 * 4. User confirms on their phone
 * 5. Orange Money calls our webhook (PATCH /api/payment with webhook=true)
 * 6. We verify the transaction and update the payment status
 */

const ORANGE_API_URL = process.env.ORANGE_MONEY_API_URL || 'https://api.orange.com';
const ORANGE_CLIENT_ID = process.env.ORANGE_MONEY_CLIENT_ID;
const ORANGE_CLIENT_SECRET = process.env.ORANGE_MONEY_CLIENT_SECRET;
const ORANGE_MERCHANT_ID = process.env.ORANGE_MONEY_MERCHANT_ID;

/** Check if Orange Money is configured for production */
export function isOrangeMoneyConfigured(): boolean {
  return !!(ORANGE_CLIENT_ID && ORANGE_CLIENT_SECRET && ORANGE_MERCHANT_ID);
}

/** Get OAuth token from Orange Money API */
async function getOrangeToken(): Promise<string> {
  const credentials = Buffer.from(`${ORANGE_CLIENT_ID}:${ORANGE_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(`${ORANGE_API_URL}/oauth/v3/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Orange Money auth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

/** Initiate an Orange Money payment */
export async function initiateOrangeMoneyPayment(params: {
  phone: string;
  amount: number;
  orderId: string;
  currency: string;
  returnUrl: string;
  notifyUrl: string;
}): Promise<{
  success: boolean;
  paymentUrl?: string;
  payToken?: string;
  transactionRef?: string;
  error?: string;
}> {
  if (!isOrangeMoneyConfigured()) {
    return {
      success: false,
      error: 'Orange Money non configuré. Veuillez contacter l\'administrateur.',
    };
  }

  try {
    const token = await getOrangeToken();

    const response = await fetch(`${ORANGE_API_URL}/omcashil/v2/webpay`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchant_id: ORANGE_MERCHANT_ID,
        amount: params.amount,
        currency: params.currency || 'GNF',
        order_id: params.orderId,
        return_url: params.returnUrl,
        notify_url: params.notifyUrl,
        lang: 'fr',
        reference: `KFM-${params.orderId.slice(-8).toUpperCase()}`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Orange Money] Init failed:', response.status, errorData);
      return { success: false, error: 'Erreur lors de l\'initialisation du paiement Orange Money.' };
    }

    const data = await response.json();
    return {
      success: true,
      paymentUrl: data.payment_url,
      payToken: data.pay_token,
      transactionRef: data.txnid || `OM_${Date.now()}`,
    };
  } catch (error) {
    console.error('[Orange Money] Error:', error);
    return { success: false, error: 'Service Orange Money temporairement indisponible.' };
  }
}

/** Verify an Orange Money transaction status */
export async function verifyOrangeMoneyTransaction(payToken: string): Promise<{
  status: 'pending' | 'paid' | 'failed';
  transactionRef?: string;
  error?: string;
}> {
  if (!isOrangeMoneyConfigured()) {
    return { status: 'failed', error: 'Orange Money non configuré' };
  }

  try {
    const token = await getOrangeToken();

    const response = await fetch(`${ORANGE_API_URL}/omcashil/v2/webpay/${payToken}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { status: 'pending', error: 'Vérification en cours' };
    }

    const data = await response.json();
    const statusMap: Record<string, 'pending' | 'paid' | 'failed'> = {
      'INITIATED': 'pending',
      'PENDING': 'pending',
      'SUCCESS': 'paid',
      'COMPLETED': 'paid',
      'FAILED': 'failed',
      'CANCELLED': 'failed',
      'EXPIRED': 'failed',
    };

    return {
      status: statusMap[data.status] || 'pending',
      transactionRef: data.txnid,
    };
  } catch (error) {
    console.error('[Orange Money] Verify error:', error);
    return { status: 'pending', error: 'Vérification temporairement indisponible' };
  }
}
