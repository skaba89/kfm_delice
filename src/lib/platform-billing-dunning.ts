import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db, dbReady } from '@/lib/db';
import {
  getBillingAccessGraceDays,
  isBillingAccessEnforcementEnabled,
} from '@/lib/subscription-access';
import {
  getPlatformEmailProvider,
  isPlatformEmailDeliveryConfigured,
  sendPlatformEmail,
} from '@/lib/platform-email';

export type BillingDunningStage = 'overdue_initial' | 'grace_warning' | 'access_suspended';

export interface BillingDunningResult {
  enabled: boolean;
  provider: 'resend' | 'smtp' | 'console';
  candidateInvoices: number;
  accountsEvaluated: number;
  sent: number;
  replayed: number;
  failed: number;
  skippedUnconfigured: number;
  skippedInvalidRecipient: number;
  skippedMissingAccount: number;
  inProgress: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WARNING_DAYS = 3;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_CLAIM_TIMEOUT_MINUTES = 30;
const MAX_WARNING_DAYS = 30;
const MAX_BATCH_SIZE = 500;
const MAX_CLAIM_TIMEOUT_MINUTES = 24 * 60;
const RETRYABLE_NOTICE_STATUSES = [
  'pending',
  'failed',
  'skipped_unconfigured',
  'skipped_invalid_recipient',
] as const;
const emailSchema = z.string().trim().email().max(320);

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function isBillingDunningEnabled(
  value: string | boolean | null | undefined = process.env.BILLING_DUNNING_ENABLED,
): boolean {
  if (typeof value === 'boolean') return value;
  return String(value ?? '').trim().toLowerCase() === 'true';
}

export function getBillingDunningWarningDays(
  value: string | number | null | undefined = process.env.BILLING_DUNNING_GRACE_WARNING_DAYS,
): number {
  return clampInteger(value, DEFAULT_WARNING_DAYS, 0, MAX_WARNING_DAYS);
}

export function getBillingDunningBatchSize(
  value: string | number | null | undefined = process.env.BILLING_DUNNING_BATCH_SIZE,
): number {
  return clampInteger(value, DEFAULT_BATCH_SIZE, 1, MAX_BATCH_SIZE);
}

export function getBillingDunningClaimTimeoutMinutes(
  value: string | number | null | undefined = process.env.BILLING_DUNNING_CLAIM_TIMEOUT_MINUTES,
): number {
  return clampInteger(value, DEFAULT_CLAIM_TIMEOUT_MINUTES, 5, MAX_CLAIM_TIMEOUT_MINUTES);
}

export function billingDunningNoticeKey(invoiceId: string, stage: BillingDunningStage): string {
  return `billing-dunning:${invoiceId}:${stage}`;
}

export function selectBillingDunningStage(params: {
  dueAt: Date;
  now: Date;
  accessEnforcementEnabled: boolean;
  accessGraceDays: number;
  warningDays: number;
}): BillingDunningStage {
  if (!params.accessEnforcementEnabled) return 'overdue_initial';

  const graceEnd = params.dueAt.getTime() + params.accessGraceDays * DAY_MS;
  if (params.now.getTime() > graceEnd) return 'access_suspended';

  const warningStart = graceEnd - params.warningDays * DAY_MS;
  if (params.warningDays > 0 && params.now.getTime() >= warningStart) return 'grace_warning';
  return 'overdue_initial';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMoney(amount: bigint, currency: string): string {
  return `${new Intl.NumberFormat('fr-FR').format(amount)} ${escapeHtml(currency)}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date);
}

function safeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'Erreur email inconnue');
  return raw.replace(/[\r\n]+/g, ' ').slice(0, 500);
}

export function renderPlatformDunningEmail(params: {
  stage: BillingDunningStage;
  accountName: string;
  ownerName: string;
  invoiceNumber: string;
  outstanding: bigint;
  currency: string;
  dueAt: Date;
  graceEnd: Date | null;
}): { subject: string; html: string } {
  const accountName = escapeHtml(params.accountName || 'Votre compte');
  const ownerName = escapeHtml(params.ownerName || 'Madame, Monsieur');
  const invoiceNumber = escapeHtml(params.invoiceNumber);
  const outstanding = formatMoney(params.outstanding, params.currency);
  const dueDate = escapeHtml(formatDate(params.dueAt));
  const graceDate = params.graceEnd ? escapeHtml(formatDate(params.graceEnd)) : null;

  const copy = params.stage === 'access_suspended'
    ? {
        subject: 'Accès KFM Delice suspendu pour impayé',
        title: 'Régularisation nécessaire pour restaurer votre accès',
        message: `La facture ${invoiceNumber} reste impayée après la période de grâce. L’accès commercial du compte est temporairement indisponible. Après règlement complet des factures en retard, la restauration est automatique.`,
        accent: '#b91c1c',
      }
    : params.stage === 'grace_warning'
      ? {
          subject: 'Régularisation requise avant suspension — KFM Delice',
          title: 'Votre période de grâce arrive à échéance',
          message: `La facture ${invoiceNumber} reste impayée. Merci de régulariser avant le ${graceDate ?? dueDate} afin d’éviter une interruption d’accès.`,
          accent: '#c2410c',
        }
      : {
          subject: `Facture SaaS ${invoiceNumber} en retard — KFM Delice`,
          title: 'Une facture SaaS est arrivée à échéance',
          message: `La facture ${invoiceNumber}, échue le ${dueDate}, présente encore un solde à régler. Merci de procéder à la régularisation.`,
          accent: '#ea580c',
        };

  const html = `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f5f5f4;font-family:Arial,sans-serif;color:#1c1917">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;background:#f5f5f4">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e4">
        <tr><td style="padding:22px 28px;background:#111827;color:#fff">
          <div style="font-size:20px;font-weight:700">KFM Delice Platform</div>
          <div style="font-size:12px;color:#d1d5db;margin-top:4px">Facturation SaaS</div>
        </td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 14px;font-size:15px">Bonjour ${ownerName},</p>
          <h1 style="margin:0 0 14px;font-size:22px;color:${copy.accent}">${copy.title}</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#57534e">${copy.message}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:8px;padding:14px">
            <tr><td style="padding:6px;color:#78716c">Compte</td><td style="padding:6px;text-align:right;font-weight:600">${accountName}</td></tr>
            <tr><td style="padding:6px;color:#78716c">Facture</td><td style="padding:6px;text-align:right;font-weight:600">${invoiceNumber}</td></tr>
            <tr><td style="padding:6px;color:#78716c">Échéance</td><td style="padding:6px;text-align:right">${dueDate}</td></tr>
            <tr><td style="padding:6px;color:#78716c">Solde restant</td><td style="padding:6px;text-align:right;font-weight:700;color:${copy.accent}">${outstanding}</td></tr>
          </table>
          <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#78716c">Ce message concerne l’abonnement SaaS KFM Delice de votre organisation. Aucun paiement n’est demandé par lien dans cet email.</p>
        </td></tr>
        <tr><td style="padding:18px 28px;background:#fafaf9;border-top:1px solid #e7e5e4;color:#78716c;font-size:12px;text-align:center">KFM Delice Platform — notification de facturation</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: copy.subject, html };
}

async function getOrCreateNotice(params: {
  accountId: string;
  invoiceId: string;
  stage: BillingDunningStage;
  recipient: string;
  idempotencyKey: string;
}) {
  const existing = await db.platformBillingNotice.findUnique({
    where: { idempotencyKey: params.idempotencyKey },
  });
  if (existing) return existing;

  try {
    return await db.platformBillingNotice.create({
      data: {
        accountId: params.accountId,
        invoiceId: params.invoiceId,
        stage: params.stage,
        recipient: params.recipient,
        idempotencyKey: params.idempotencyKey,
        status: 'pending',
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    const concurrent = await db.platformBillingNotice.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (!concurrent) throw error;
    return concurrent;
  }
}

export async function runPlatformBillingDunning(options: {
  now?: Date;
  enabled?: boolean;
  batchSize?: number;
  warningDays?: number;
  accessGraceDays?: number;
  accessEnforcementEnabled?: boolean;
} = {}): Promise<BillingDunningResult> {
  const provider = getPlatformEmailProvider();
  const enabled = options.enabled ?? isBillingDunningEnabled();
  const result: BillingDunningResult = {
    enabled,
    provider,
    candidateInvoices: 0,
    accountsEvaluated: 0,
    sent: 0,
    replayed: 0,
    failed: 0,
    skippedUnconfigured: 0,
    skippedInvalidRecipient: 0,
    skippedMissingAccount: 0,
    inProgress: 0,
  };

  // Safe rollout and zero DB overhead while disabled.
  if (!enabled) return result;

  await dbReady;
  const now = options.now ?? new Date();
  const batchSize = clampInteger(options.batchSize, getBillingDunningBatchSize(), 1, MAX_BATCH_SIZE);
  const warningDays = clampInteger(options.warningDays, getBillingDunningWarningDays(), 0, MAX_WARNING_DAYS);
  const accessGraceDays = clampInteger(options.accessGraceDays, getBillingAccessGraceDays(), 0, 90);
  const accessEnforcementEnabled = options.accessEnforcementEnabled ?? isBillingAccessEnforcementEnabled();
  const claimTimeoutMinutes = getBillingDunningClaimTimeoutMinutes();
  const staleClaimBefore = new Date(now.getTime() - claimTimeoutMinutes * 60 * 1000);

  // Read a bounded candidate window, then retain only the oldest overdue invoice
  // per account. This prevents a catch-up batch from sending many emails to the
  // same customer in a single daily run.
  const invoices = await db.platformInvoice.findMany({
    where: {
      status: 'overdue',
      dueAt: { lt: now },
    },
    orderBy: { dueAt: 'asc' },
    take: Math.min(batchSize * 10, 2000),
    select: {
      id: true,
      accountId: true,
      number: true,
      currency: true,
      total: true,
      amountPaid: true,
      dueAt: true,
    },
  });
  result.candidateInvoices = invoices.length;

  const oldestByAccount = new Map<string, (typeof invoices)[number]>();
  for (const invoice of invoices) {
    if (!oldestByAccount.has(invoice.accountId)) oldestByAccount.set(invoice.accountId, invoice);
    if (oldestByAccount.size >= batchSize) break;
  }

  const candidates = [...oldestByAccount.values()];
  result.accountsEvaluated = candidates.length;
  if (candidates.length === 0) return result;

  const accountIds = candidates.map((invoice) => invoice.accountId);
  const accounts = await db.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, name: true, ownerName: true, ownerEmail: true },
  });
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  for (const invoice of candidates) {
    const account = accountById.get(invoice.accountId);
    if (!account) {
      result.skippedMissingAccount += 1;
      continue;
    }

    const stage = selectBillingDunningStage({
      dueAt: invoice.dueAt,
      now,
      accessEnforcementEnabled,
      accessGraceDays,
      warningDays,
    });
    const idempotencyKey = billingDunningNoticeKey(invoice.id, stage);
    const recipient = account.ownerEmail.trim();
    const notice = await getOrCreateNotice({
      accountId: invoice.accountId,
      invoiceId: invoice.id,
      stage,
      recipient,
      idempotencyKey,
    });

    if (notice.status === 'sent') {
      result.replayed += 1;
      continue;
    }

    const claim = await db.platformBillingNotice.updateMany({
      where: {
        id: notice.id,
        OR: [
          { status: { in: [...RETRYABLE_NOTICE_STATUSES] } },
          { status: 'sending', attemptedAt: { lt: staleClaimBefore } },
        ],
      },
      data: {
        status: 'sending',
        recipient,
        provider,
        attemptedAt: now,
        errorMessage: '',
      },
    });
    if (claim.count !== 1) {
      result.inProgress += 1;
      continue;
    }

    if (!emailSchema.safeParse(recipient).success) {
      await db.platformBillingNotice.update({
        where: { id: notice.id },
        data: {
          status: 'skipped_invalid_recipient',
          provider,
          errorMessage: 'Adresse email du propriétaire invalide ou absente.',
        },
      });
      result.skippedInvalidRecipient += 1;
      continue;
    }

    if (!isPlatformEmailDeliveryConfigured()) {
      await db.platformBillingNotice.update({
        where: { id: notice.id },
        data: {
          status: 'skipped_unconfigured',
          provider,
          errorMessage: 'Aucun provider email réel configuré.',
        },
      });
      result.skippedUnconfigured += 1;
      continue;
    }

    const outstanding = invoice.total > invoice.amountPaid
      ? invoice.total - invoice.amountPaid
      : BigInt(0);
    if (outstanding <= BigInt(0)) {
      // Defensive: an overdue invoice with no outstanding balance should be
      // reconciled by billing before a future dunning run. Do not email it.
      await db.platformBillingNotice.update({
        where: { id: notice.id },
        data: {
          status: 'failed',
          provider,
          errorMessage: 'Facture overdue sans solde restant; réconciliation requise.',
        },
      });
      result.failed += 1;
      continue;
    }

    const graceEnd = accessEnforcementEnabled
      ? new Date(invoice.dueAt.getTime() + accessGraceDays * DAY_MS)
      : null;
    const email = renderPlatformDunningEmail({
      stage,
      accountName: account.name,
      ownerName: account.ownerName,
      invoiceNumber: invoice.number,
      outstanding,
      currency: invoice.currency,
      dueAt: invoice.dueAt,
      graceEnd,
    });

    try {
      const delivery = await sendPlatformEmail({
        to: recipient,
        subject: email.subject,
        html: email.html,
      });

      if (!delivery.success || delivery.provider === 'console') {
        await db.platformBillingNotice.update({
          where: { id: notice.id },
          data: {
            status: delivery.configured ? 'failed' : 'skipped_unconfigured',
            provider: delivery.provider,
            errorMessage: (delivery.error ?? 'Échec de livraison email.').slice(0, 500),
          },
        });
        if (delivery.configured) result.failed += 1;
        else result.skippedUnconfigured += 1;
        continue;
      }

      await db.platformBillingNotice.update({
        where: { id: notice.id },
        data: {
          status: 'sent',
          provider: delivery.provider,
          sentAt: now,
          errorMessage: '',
        },
      });
      result.sent += 1;
    } catch (error) {
      await db.platformBillingNotice.update({
        where: { id: notice.id },
        data: {
          status: 'failed',
          provider,
          errorMessage: safeErrorMessage(error),
        },
      });
      result.failed += 1;
    }
  }

  return result;
}
