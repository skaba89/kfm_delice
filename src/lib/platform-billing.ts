import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  getPlanMonthlyPriceGnf,
  normalizeCommercialPlanValue,
  type CommercialPlan,
} from '@/lib/commercial-plan-catalog';

export const billingCycleSchema = z.enum(['monthly', 'annual']);
export const subscriptionStatusSchema = z.enum(['trialing', 'active', 'past_due', 'paused', 'cancelled']);
export const invoiceStatusSchema = z.enum(['open', 'paid', 'overdue', 'void']);
export const paymentMethodSchema = z.enum(['manual', 'cash', 'bank_transfer', 'mobile_money', 'card', 'external']);

const moneyInputSchema = z.union([
  z.number().int().safe().nonnegative(),
  z.string().trim().regex(/^\d{1,18}$/, 'Montant invalide'),
]);

const positiveMoneyInputSchema = z.union([
  z.number().int().safe().positive(),
  z.string().trim().regex(/^[1-9]\d{0,17}$/, 'Montant invalide'),
]);

const optionalIsoDateSchema = z.string().trim().max(40).nullable().optional();

export const subscriptionPatchSchema = z.object({
  billingCycle: billingCycleSchema.optional(),
  status: subscriptionStatusSchema.optional(),
  currency: z.literal('GNF').optional(),
  customUnitAmount: moneyInputSchema.optional(),
  currentPeriodStart: optionalIsoDateSchema,
  currentPeriodEnd: optionalIsoDateSchema,
  nextBillingAt: optionalIsoDateSchema,
  cancelAtPeriodEnd: z.boolean().optional(),
  provider: z.string().trim().min(1).max(50).optional(),
  providerCustomerRef: z.string().trim().max(200).optional(),
  providerSubscriptionRef: z.string().trim().max(200).optional(),
}).strict();

export const invoiceCreateSchema = z.object({
  periodStart: optionalIsoDateSchema,
  periodEnd: optionalIsoDateSchema,
  dueAt: z.string().trim().min(1).max(40),
  tax: moneyInputSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
  providerInvoiceRef: z.string().trim().max(200).optional(),
}).strict();

export const paymentCreateSchema = z.object({
  invoiceId: z.string().trim().min(1).max(100),
  amount: positiveMoneyInputSchema,
  method: paymentMethodSchema,
  provider: z.string().trim().min(1).max(50).optional(),
  providerPaymentRef: z.string().trim().max(200).optional(),
  idempotencyKey: z.string().trim().min(8).max(128),
  paidAt: optionalIsoDateSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export class BillingDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message);
    this.name = 'BillingDomainError';
  }
}

export function parseMoneyToBigInt(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new BillingDomainError('BILLING_INVALID_AMOUNT', 'Montant invalide.');
    }
    return BigInt(value);
  }
  if (!/^\d{1,18}$/.test(value.trim())) {
    throw new BillingDomainError('BILLING_INVALID_AMOUNT', 'Montant invalide.');
  }
  return BigInt(value.trim());
}

export function parseRequiredIsoDate(value: string, field: string): Date {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new BillingDomainError('BILLING_INVALID_DATE', `${field} est invalide.`);
  }
  return parsed;
}

export function parseOptionalIsoDate(value: string | null | undefined, field: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return parseRequiredIsoDate(value, field);
}

export function validateBillingPeriod(start: Date | null | undefined, end: Date | null | undefined): void {
  if (start && end && end.getTime() <= start.getTime()) {
    throw new BillingDomainError(
      'BILLING_INVALID_PERIOD',
      'La fin de période doit être postérieure au début de période.',
    );
  }
}

export function deriveSubscriptionUnitAmount(params: {
  plan: string;
  billingCycle: 'monthly' | 'annual';
  customUnitAmount?: string | number | bigint;
  existingUnitAmount?: bigint | null;
}): { plan: CommercialPlan; unitAmount: bigint } {
  const plan = normalizeCommercialPlanValue(params.plan);
  if (!plan) {
    throw new BillingDomainError('BILLING_INVALID_PLAN', 'Plan commercial invalide.');
  }

  if (plan === 'custom') {
    const raw = params.customUnitAmount ?? params.existingUnitAmount;
    if (raw === undefined || raw === null) {
      throw new BillingDomainError(
        'BILLING_CUSTOM_AMOUNT_REQUIRED',
        'Un montant contractuel explicite est requis pour le plan custom.',
      );
    }
    return { plan, unitAmount: parseMoneyToBigInt(raw) };
  }

  const monthly = getPlanMonthlyPriceGnf(plan);
  if (monthly === null) {
    throw new BillingDomainError('BILLING_PRICE_UNAVAILABLE', 'Tarif catalogue indisponible pour ce plan.');
  }

  const monthlyAmount = BigInt(monthly);
  return {
    plan,
    unitAmount: params.billingCycle === 'annual' ? monthlyAmount * 12n : monthlyAmount,
  };
}

export function calculateOutstanding(total: bigint, amountPaid: bigint): bigint {
  const outstanding = total - amountPaid;
  return outstanding > 0n ? outstanding : 0n;
}

export function assertPaymentFitsOutstanding(amount: bigint, outstanding: bigint): void {
  if (amount <= 0n) {
    throw new BillingDomainError('BILLING_INVALID_PAYMENT_AMOUNT', 'Le montant du paiement doit être positif.');
  }
  if (outstanding <= 0n) {
    throw new BillingDomainError('BILLING_INVOICE_ALREADY_PAID', 'Cette facture est déjà soldée.', 409);
  }
  if (amount > outstanding) {
    throw new BillingDomainError('BILLING_OVERPAYMENT', 'Le paiement dépasse le solde restant de la facture.', 409);
  }
}

export function generatePlatformInvoiceNumber(accountId: string, now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const accountPart = accountId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'ACCT';
  const randomPart = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `KFM-${y}${m}-${accountPart}-${randomPart}`;
}

export function serializeBillingMetadata(metadata: Record<string, unknown> | undefined): string {
  if (!metadata) return '{}';
  const serialized = JSON.stringify(metadata);
  if (serialized.length > 4000) {
    throw new BillingDomainError('BILLING_METADATA_TOO_LARGE', 'Les métadonnées de paiement sont trop volumineuses.');
  }
  return serialized;
}
