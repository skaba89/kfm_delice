/**
 * Wave Mobile Money API Integration
 *
 * Wave is a popular mobile money service in West Africa (Senegal, Mali, Côte d'Ivoire, Guinea).
 * Unlike Orange Money and MTN MoMo, Wave does not (yet) offer a public self-serve merchant API.
 * Production integration requires a partnership with Wave Business:
 *   https://business.wave.com/
 *
 * To activate (when Wave credentials are available):
 * 1. Sign up at https://business.wave.com/ (Guinea)
 * 2. Get your API key / business account credentials
 * 3. Set these env vars:
 *    - WAVE_API_KEY
 *    - WAVE_API_URL (default: https://api.wave.com)
 *    - WAVE_BUSINESS_NAME
 *    - WAVE_CALLBACK_URL
 *
 * Flow (when production):
 * 1. Frontend calls POST /api/payment → initPayment()
 * 2. We create a Wave checkout session / payment request
 * 3. User is redirected to Wave app or receives USSD push
 * 4. Wave calls our callback URL with the payment result
 * 5. We verify the transaction status
 *
 * In simulation mode (no API key), the flow mimics the user receiving a Wave push
 * notification and confirming with their Wave PIN.
 */

const WAVE_API_URL = process.env.WAVE_API_URL || 'https://api.wave.com';
const WAVE_API_KEY = process.env.WAVE_API_KEY;
const WAVE_BUSINESS_NAME = process.env.WAVE_BUSINESS_NAME || 'KFM Delice';
const WAVE_CALLBACK_URL = process.env.WAVE_CALLBACK_URL;

/** Check if Wave is configured for production */
export function isWaveConfigured(): boolean {
  return !!WAVE_API_KEY;
}

/**
 * Initiate a Wave payment.
 *
 * Production: would call Wave Business API to create a checkout session.
 * Simulation: returns a fake transaction reference for demo purposes.
 */
export async function initiateWavePayment(params: {
  phone: string;
  amount: number;
  orderId: string;
  currency?: string;
  payerMessage?: string;
}): Promise<{
  success: boolean;
  transactionRef?: string;
  paymentUrl?: string;
  error?: string;
}> {
  // Validate phone — Wave Guinea numbers are +224 6XX XXX XXX (Orange) or +224 6XX XXX XXX (MTN ranges too)
  const cleanPhone = params.phone.replace(/\s/g, '');
  let formattedPhone = cleanPhone;
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '+224' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone;
  }

  // Wave validates the phone has a Wave account in production;
  // in simulation, we accept any Guinea-format number
  if (!/^\+224[6-7]\d{8}$/.test(formattedPhone)) {
    return {
      success: false,
      error: 'Numéro Wave invalide. Format attendu : +224 6XX XXX XXX (Guinée).',
    };
  }

  if (!isWaveConfigured()) {
    // Simulation fallback — pretend a Wave push was sent to the customer's phone
    return {
      success: true,
      transactionRef: `WAVE_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
  }

  // Production path — placeholder for when Wave Business API access is granted
  try {
    const referenceId = `KFM-${params.orderId.slice(-8).toUpperCase()}-${Date.now()}`;
    const response = await fetch(`${WAVE_API_URL}/v1/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WAVE_API_KEY}`,
        'Content-Type': 'application/json',
        ...(WAVE_CALLBACK_URL ? { 'X-Callback-Url': WAVE_CALLBACK_URL } : {}),
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency || 'GNF',
        reference_id: referenceId,
        business_name: WAVE_BUSINESS_NAME,
        customer: { phone: formattedPhone },
        reason: params.payerMessage || `Paiement commande KFM-${params.orderId.slice(-8).toUpperCase()}`,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        transactionRef: data.id || referenceId,
        paymentUrl: data.checkout_url,
      };
    }

    const errorData = await response.json().catch(() => ({}));
    console.error('[Wave] Init failed:', response.status, errorData);
    return {
      success: false,
      error: 'Erreur lors de l\'initialisation du paiement Wave.',
    };
  } catch (error) {
    console.error('[Wave] Error:', error);
    return {
      success: false,
      error: 'Service Wave temporairement indisponible.',
    };
  }
}

/** Verify a Wave transaction status */
export async function verifyWaveTransaction(transactionRef: string): Promise<{
  status: 'pending' | 'processing' | 'paid' | 'failed';
  transactionRef?: string;
  financialTransactionId?: string;
  error?: string;
}> {
  if (!isWaveConfigured()) {
    // Simulation: 80% chance payment was confirmed after a brief processing state
    return {
      status: Math.random() > 0.2 ? 'paid' : 'pending',
      transactionRef,
      financialTransactionId: `WAVE-FIN-${transactionRef.slice(-12)}`,
    };
  }

  try {
    const response = await fetch(`${WAVE_API_URL}/v1/checkout/sessions/${transactionRef}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WAVE_API_KEY}`,
      },
    });

    if (!response.ok) {
      return { status: 'pending', error: 'Vérification en cours' };
    }

    const data = await response.json();
    const statusMap: Record<string, 'pending' | 'processing' | 'paid' | 'failed'> = {
      'pending': 'pending',
      'processing': 'processing',
      'complete': 'paid',
      'completed': 'paid',
      'success': 'paid',
      'failed': 'failed',
      'expired': 'failed',
      'cancelled': 'failed',
    };

    return {
      status: statusMap[data.status] || 'pending',
      transactionRef,
      financialTransactionId: data.financial_transaction_id,
    };
  } catch (error) {
    console.error('[Wave] Verify error:', error);
    return { status: 'pending', error: 'Vérification temporairement indisponible' };
  }
}
