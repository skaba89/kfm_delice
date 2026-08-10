import { createHash, createHmac, timingSafeEqual } from 'crypto';

export type PaymentLifecycleStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';

const PAYMENT_TRANSITIONS: Record<PaymentLifecycleStatus, readonly PaymentLifecycleStatus[]> = {
  pending: ['processing', 'paid', 'failed'],
  processing: ['paid', 'failed'],
  paid: ['refunded'],
  failed: [],
  refunded: [],
};

export function isValidPaymentTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = PAYMENT_TRANSITIONS[from as PaymentLifecycleStatus];
  return Boolean(allowed?.includes(to as PaymentLifecycleStatus));
}

export function computePaymentRequestHash(input: {
  orderId: string;
  method: string;
  phone?: string;
  customerName?: string;
  amount: number;
  restaurantId: string;
  customerId?: string;
}): string {
  const canonical = {
    orderId: input.orderId,
    method: input.method,
    phone: input.phone?.trim() || '',
    customerName: input.customerName?.trim() || '',
    amount: input.amount,
    restaurantId: input.restaurantId,
    customerId: input.customerId || '',
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function resolvePaymentIdempotencyKey(
  providedKey: unknown,
  orderId: string,
  method: string
): string {
  if (typeof providedKey === 'string' && providedKey.trim()) {
    return providedKey.trim().slice(0, 200);
  }
  return `auto_${createHash('sha256').update(`${orderId}|${method}`).digest('hex')}`;
}

export function paymentWebhookEventId(body: Record<string, unknown>, rawBody: string): string {
  const explicit = body.eventId || body.event_id;
  if (explicit) return String(explicit);
  return `body_${createHash('sha256').update(rawBody).digest('hex')}`;
}

function canonicalInternalUpdate(body: {
  id: string;
  status: string;
  transactionRef?: string;
  failedReason?: string;
}): string {
  return JSON.stringify({
    id: body.id,
    status: body.status,
    transactionRef: body.transactionRef || '',
    failedReason: body.failedReason || '',
  });
}

export function signInternalPaymentUpdate(
  body: { id: string; status: string; transactionRef?: string; failedReason?: string },
  timestampMs: number,
  secret: string
): string {
  if (!secret) return '';
  return createHmac('sha256', secret)
    .update(`${timestampMs}.${canonicalInternalUpdate(body)}`)
    .digest('hex');
}

export function verifyInternalPaymentUpdate(
  body: { id: string; status: string; transactionRef?: string; failedReason?: string },
  timestampHeader: string | null,
  signature: string | null,
  secret: string,
  nowMs: number = Date.now(),
  maxSkewMs: number = 5 * 60 * 1000
): boolean {
  if (!secret || !timestampHeader || !signature || !/^\d+$/.test(timestampHeader)) return false;
  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowMs - timestamp) > maxSkewMs) return false;
  const expected = signInternalPaymentUpdate(body, timestamp, secret);
  if (!/^[0-9a-f]{64}$/.test(signature) || expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}
