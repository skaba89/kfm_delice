/**
 * MTN Mobile Money (MoMo) API Integration
 *
 * Production API docs: https://momodeveloper.mtn.com/
 *
 * To activate:
 * 1. Register at https://momodeveloper.mtn.com/
 * 2. Get your subscription_key, api_user, api_key
 * 3. Set these env vars in Render:
 *    - MTN_MOMO_SUBSCRIPTION_KEY
 *    - MTN_MOMO_API_USER
 *    - MTN_MOMO_API_KEY
 *    - MTN_MOMO_API_URL (default: https://momodeveloper.mtn.com)
 *    - MTN_MOMO_CALLBACK_URL
 *
 * Flow:
 * 1. Frontend calls POST /api/payment → initPayment()
 * 2. We call MTN MoMo Collection API → request to pay
 * 3. User confirms on their phone (USSD push)
 * 4. MTN calls our callback URL (PATCH /api/payment with webhook=true)
 * 5. We verify the transaction and update the payment status
 */

const MTN_API_URL = process.env.MTN_MOMO_API_URL || 'https://momodeveloper.mtn.com';
const MTN_SUBSCRIPTION_KEY = process.env.MTN_MOMO_SUBSCRIPTION_KEY;
const MTN_API_USER = process.env.MTN_MOMO_API_USER;
const MTN_API_KEY = process.env.MTN_MOMO_API_KEY;
const MTN_CALLBACK_URL = process.env.MTN_MOMO_CALLBACK_URL;

/** Check if MTN MoMo is configured for production */
export function isMTNMomoConfigured(): boolean {
  return !!(MTN_SUBSCRIPTION_KEY && MTN_API_USER && MTN_API_KEY);
}

/** Get OAuth token from MTN MoMo API */
async function getMTNToken(): Promise<string> {
  const credentials = Buffer.from(`${MTN_API_USER}:${MTN_API_KEY}`).toString('base64');

  const response = await fetch(`${MTN_API_URL}/collection/token/`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY!,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`MTN MoMo auth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

/** Initiate an MTN MoMo payment (Request to Pay) */
export async function initiateMTNMoMoPayment(params: {
  phone: string;
  amount: number;
  orderId: string;
  currency: string;
  payerMessage?: string;
}): Promise<{
  success: boolean;
  transactionRef?: string;
  error?: string;
}> {
  if (!isMTNMomoConfigured()) {
    return {
      success: false,
      error: 'MTN Money non configuré. Veuillez contacter l\'administrateur.',
    };
  }

  try {
    const token = await getMTNToken();
    const referenceId = crypto.randomUUID();

    // Format phone number for MTN (E.164 format: +224XXXXXXXXX)
    let formattedPhone = params.phone.replace(/\s/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+224' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+224' + formattedPhone;
    }

    const response = await fetch(`${MTN_API_URL}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': 'mtnguineaconakry', // Guinea Conakry
        'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY!,
        'Content-Type': 'application/json',
        ...(MTN_CALLBACK_URL ? { 'X-Callback-Url': MTN_CALLBACK_URL } : {}),
      },
      body: JSON.stringify({
        amount: String(params.amount),
        currency: params.currency || 'GNF',
        externalId: params.orderId,
        payer: {
          partyIdType: 'MSISDN',
          partyId: formattedPhone.replace('+', ''),
        },
        payerMessage: params.payerMessage || `Paiement commande KFM-${params.orderId.slice(-8).toUpperCase()}`,
        payeeNote: 'KFM Delice',
      }),
    });

    // MTN returns 202 Accepted for successful request
    if (response.status === 202) {
      return {
        success: true,
        transactionRef: referenceId,
      };
    }

    const errorData = await response.json().catch(() => ({}));
    console.error('[MTN MoMo] Init failed:', response.status, errorData);
    return { success: false, error: 'Erreur lors de l\'initialisation du paiement MTN Money.' };
  } catch (error) {
    console.error('[MTN MoMo] Error:', error);
    return { success: false, error: 'Service MTN Money temporairement indisponible.' };
  }
}

/** Verify an MTN MoMo transaction status */
export async function verifyMTNMoMoTransaction(referenceId: string): Promise<{
  status: 'pending' | 'processing' | 'paid' | 'failed';
  transactionRef?: string;
  financialTransactionId?: string;
  error?: string;
}> {
  if (!isMTNMomoConfigured()) {
    return { status: 'failed', error: 'MTN MoMo non configuré' };
  }

  try {
    const token = await getMTNToken();

    const response = await fetch(`${MTN_API_URL}/collection/v1_0/requesttopay/${referenceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Target-Environment': 'mtnguineaconakry',
        'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY!,
      },
    });

    if (!response.ok) {
      return { status: 'pending', error: 'Vérification en cours' };
    }

    const data = await response.json();
    const statusMap: Record<string, 'pending' | 'processing' | 'paid' | 'failed'> = {
      'PENDING': 'pending',
      'PROCESSING': 'processing',
      'SUCCESSFUL': 'paid',
      'FAILED': 'failed',
      'REJECTED': 'failed',
      'TIMEOUT': 'failed',
    };

    return {
      status: statusMap[data.status] || 'pending',
      transactionRef: referenceId,
      financialTransactionId: data.financialTransactionId,
    };
  } catch (error) {
    console.error('[MTN MoMo] Verify error:', error);
    return { status: 'pending', error: 'Vérification temporairement indisponible' };
  }
}
