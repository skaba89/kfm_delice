import nodemailer from 'nodemailer';
import { RESTO } from './constants';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'KFM Delice <noreply@kfm-delice.com>';

type EmailProvider = 'resend' | 'smtp' | 'console';

function detectProvider(): EmailProvider {
  if (RESEND_API_KEY) return 'resend';
  if (SMTP_HOST) return 'smtp';
  return 'console';
}

const PROVIDER = detectProvider();

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email using the best available provider.
 * Gracefully degrades: Resend → SMTP → console log.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; provider: EmailProvider; error?: string }> {
  try {
    if (PROVIDER === 'resend') {
      return await sendViaResend(payload);
    }
    if (PROVIDER === 'smtp') {
      return await sendViaSmtp(payload);
    }
    return sendViaConsole(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[EmailService] Failed to send email:', message);
    return { success: false, provider: PROVIDER, error: message };
  }
}

// ---------------------------------------------------------------------------
// Resend provider
// ---------------------------------------------------------------------------

async function sendViaResend(payload: EmailPayload): Promise<{ success: boolean; provider: EmailProvider; error?: string }> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }

  return { success: true, provider: 'resend' };
}

// ---------------------------------------------------------------------------
// SMTP provider
// ---------------------------------------------------------------------------

async function sendViaSmtp(payload: EmailPayload): Promise<{ success: boolean; provider: EmailProvider; error?: string }> {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });

  return { success: true, provider: 'smtp' };
}

// ---------------------------------------------------------------------------
// Console fallback
// ---------------------------------------------------------------------------

function sendViaConsole(payload: EmailPayload): { success: boolean; provider: EmailProvider } {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  EMAIL (console fallback — no provider configured)          ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  To      : ${payload.to}`);
  console.log(`║  Subject : ${payload.subject}`);
  console.log('║  HTML    : (see below)');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(payload.html);
  console.log('— end of email —\n');

  return { success: true, provider: 'console' };
}

// ---------------------------------------------------------------------------
// Shared template helpers
// ---------------------------------------------------------------------------

const BRAND_COLOR = '#f97316';
const BRAND_DARK = '#ea580c';
const BG_LIGHT = '#fef7ed';
const TEXT_PRIMARY = '#1c1917';
const TEXT_SECONDARY = '#78716c';

function emailWrapper(content: string, previewText: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KFM Delice</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; padding: 12px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f5f5f4;">${previewText}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">🍽️ KFM Delice</h1>
              <p style="margin:4px 0 0;color:#fff8f0;font-size:13px;opacity:0.9;">L'Art du Goût Guinéen</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${BG_LIGHT};padding:24px 32px;border-top:1px solid #e7e5e4;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:center;">
                    <p style="margin:0 0 8px;color:${BRAND_COLOR};font-size:16px;font-weight:600;">KFM Delice</p>
                    <p style="margin:0 0 4px;color:${TEXT_SECONDARY};font-size:13px;">📍 ${RESTO.address}</p>
                    <p style="margin:0 0 4px;color:${TEXT_SECONDARY};font-size:13px;">📞 ${RESTO.phone}</p>
                    <p style="margin:0 0 4px;color:${TEXT_SECONDARY};font-size:13px;">✉️ ${RESTO.email}</p>
                    <p style="margin:0 0 4px;color:${TEXT_SECONDARY};font-size:13px;">🕐 ${RESTO.hours}</p>
                    <p style="margin:12px 0 0;color:${TEXT_SECONDARY};font-size:11px;">Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function sectionTitle(text: string): string {
  return `<h2 style="margin:0 0 16px;color:${TEXT_PRIMARY};font-size:20px;font-weight:600;">${text}</h2>`;
}

function paragraph(text: string, style = ''): string {
  return `<p style="margin:0 0 12px;color:${TEXT_SECONDARY};font-size:15px;line-height:1.6;${style}">${text}</p>`;
}

function badge(text: string, color = BRAND_COLOR): string {
  return `<span style="display:inline-block;background-color:${color};color:#ffffff;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;">${text}</span>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e7e5e4;margin:20px 0;">`;
}

function button(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;">
    <tr>
      <td style="background-color:${BRAND_COLOR};border-radius:8px;">
        <a href="${url}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">${text}</a>
      </td>
    </tr>
  </table>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:${TEXT_SECONDARY};font-size:14px;white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;color:${TEXT_PRIMARY};font-size:14px;font-weight:500;">${value}</td>
  </tr>`;
}

function itemsTable(items: { name: string; qty: number; price: number; note?: string }[], total: number): string {
  const rows = items
    .map(
      (item) => `<tr>
    <td style="padding:8px 12px 8px 0;color:${TEXT_PRIMARY};font-size:14px;">${item.name}${item.note ? `<br><span style="color:${TEXT_SECONDARY};font-size:12px;font-style:italic;">${item.note}</span>` : ''}</td>
    <td style="padding:8px 12px;color:${TEXT_SECONDARY};font-size:14px;text-align:center;">×${item.qty}</td>
    <td style="padding:8px 0;color:${TEXT_PRIMARY};font-size:14px;text-align:right;font-weight:500;">${(item.price * item.qty).toLocaleString('fr-FR')} GNF</td>
  </tr>`
    )
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <thead>
      <tr style="border-bottom:2px solid #e7e5e4;">
        <th style="padding:8px 12px 8px 0;text-align:left;color:${TEXT_SECONDARY};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Article</th>
        <th style="padding:8px 12px;text-align:center;color:${TEXT_SECONDARY};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Qté</th>
        <th style="padding:8px 0;text-align:right;color:${TEXT_SECONDARY};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Prix</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      <tr style="border-top:2px solid ${BRAND_COLOR};">
        <td colspan="2" style="padding:12px 12px 12px 0;color:${TEXT_PRIMARY};font-size:16px;font-weight:700;">Total</td>
        <td style="padding:12px 0;color:${BRAND_COLOR};font-size:16px;font-weight:700;text-align:right;">${total.toLocaleString('fr-FR')} GNF</td>
      </tr>
    </tfoot>
  </table>`;
}

// ---------------------------------------------------------------------------
// Status label mapping
// ---------------------------------------------------------------------------

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  ready: 'Prête',
  picking_up: 'En route vers le restaurant',
  delivering: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'Sur place',
  takeaway: 'À emporter',
  delivery: 'Livraison',
};

const ZONE_LABELS: Record<string, string> = {
  interieur: 'Intérieur',
  terrasse: 'Terrasse',
  vip: 'VIP',
};

// ---------------------------------------------------------------------------
// Template: Order Confirmation
// ---------------------------------------------------------------------------

export interface OrderConfirmationData {
  customerName: string;
  orderNumber: string;
  items: { name: string; qty: number; price: number; note?: string }[];
  total: number;
  orderType: string;
  estimatedTime?: string;
}

export function orderConfirmationTemplate(data: OrderConfirmationData): { subject: string; html: string } {
  const subject = `Confirmation de votre commande #${data.orderNumber} — KFM Delice`;
  const orderTypeLabel = ORDER_TYPE_LABELS[data.orderType] || data.orderType;

  const body = `
    ${sectionTitle(`Merci, ${data.customerName} ! 🎉`)}
    ${paragraph('Votre commande a bien été enregistrée. Voici le récapitulatif :')}
    ${badge(orderTypeLabel)}
    ${divider()}
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${infoRow('📋 Commande', `#${data.orderNumber}`)}
      ${data.estimatedTime ? infoRow('⏱️ Temps estimé', data.estimatedTime) : ''}
    </table>
    ${divider()}
    ${itemsTable(data.items, data.total)}
    ${paragraph('Nous vous tiendrons informé de l\'avancement de votre commande.', 'font-style:italic;')}
  `;

  return { subject, html: emailWrapper(body, `Confirmation de commande #${data.orderNumber}`) };
}

// ---------------------------------------------------------------------------
// Template: Reservation Confirmation
// ---------------------------------------------------------------------------

export interface ReservationConfirmationData {
  customerName: string;
  date: string;
  time: string;
  guests: number;
  zone: string;
  confirmationCode: string;
}

export function reservationConfirmationTemplate(data: ReservationConfirmationData): { subject: string; html: string } {
  const subject = `Confirmation de réservation — KFM Delice`;
  const zoneLabel = ZONE_LABELS[data.zone] || data.zone;

  const body = `
    ${sectionTitle(`Réservation confirmée, ${data.customerName} ! ✨`)}
    ${paragraph('Nous avons bien reçu votre demande de réservation. Voici les détails :')}
    ${divider()}
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${infoRow('📅 Date', data.date)}
      ${infoRow('🕐 Heure', data.time)}
      ${infoRow('👥 Convives', `${data.guests} personne${data.guests > 1 ? 's' : ''}`)}
      ${infoRow('📍 Zone', zoneLabel)}
      ${infoRow('🎫 Code', `<strong style="color:${BRAND_COLOR};font-size:16px;">${data.confirmationCode}</strong>`)}
    </table>
    ${divider()}
    ${paragraph('Veuillez présenter ce code à votre arrivée. En cas de modification, n\'hésitez pas à nous contacter.')}
    ${paragraph(`<strong>📞 ${RESTO.phone}</strong> | <strong>✉️ ${RESTO.email}</strong>`)}
  `;

  return { subject, html: emailWrapper(body, `Réservation le ${data.date} à ${data.time}`) };
}

// ---------------------------------------------------------------------------
// Template: Invoice Created
// ---------------------------------------------------------------------------

export interface InvoiceCreatedData {
  customerName: string;
  invoiceNumber: string;
  amount: number;
  dueDate?: string;
  viewLink?: string;
}

export function invoiceCreatedTemplate(data: InvoiceCreatedData): { subject: string; html: string } {
  const subject = `Facture #${data.invoiceNumber} — KFM Delice`;

  const body = `
    ${sectionTitle(`Facture disponible, ${data.customerName}`)}
    ${paragraph('Une nouvelle facture a été générée pour vous :')}
    ${divider()}
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${infoRow('📄 Facture', `#${data.invoiceNumber}`)}
      ${infoRow('💰 Montant', `<strong style="color:${BRAND_COLOR};font-size:18px;">${data.amount.toLocaleString('fr-FR')} GNF</strong>`)}
      ${data.dueDate ? infoRow('📅 Échéance', data.dueDate) : ''}
    </table>
    ${divider()}
    ${data.viewLink ? button('Voir la facture', data.viewLink) : ''}
    ${paragraph('Merci pour votre confiance.', 'font-style:italic;')}
  `;

  return { subject, html: emailWrapper(body, `Facture #${data.invoiceNumber} — ${data.amount.toLocaleString('fr-FR')} GNF`) };
}

// ---------------------------------------------------------------------------
// Template: Order Status Update
// ---------------------------------------------------------------------------

export interface OrderStatusUpdateData {
  customerName: string;
  orderNumber: string;
  newStatus: string;
  trackingLink?: string;
}

export function orderStatusUpdateTemplate(data: OrderStatusUpdateData): { subject: string; html: string } {
  const statusLabel = ORDER_STATUS_LABELS[data.newStatus] || data.newStatus;
  const subject = `Commande #${data.orderNumber} — ${statusLabel}`;

  // Status-specific messaging
  const statusMessages: Record<string, string> = {
    pending: 'Votre commande est en attente de confirmation.',
    confirmed: 'Votre commande a été confirmée ! Nous commençons la préparation.',
    preparing: 'Nos chefs préparent votre commande avec soin !',
    ready: 'Votre commande est prête !',
    picking_up: 'Le livreur est en route vers le restaurant.',
    delivering: 'Votre commande est en route vers vous !',
    delivered: 'Votre commande a été livrée. Bon appétit ! 🍽️',
    cancelled: 'Votre commande a été annulée. N\'hésitez pas à nous contacter pour plus d\'informations.',
  };

  const message = statusMessages[data.newStatus] || 'Le statut de votre commande a été mis à jour.';

  // Color varies by status
  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    confirmed: '#3b82f6',
    preparing: BRAND_COLOR,
    ready: '#06b6d4',
    picking_up: '#6366f1',
    delivering: '#8b5cf6',
    delivered: '#22c55e',
    cancelled: '#ef4444',
  };
  const statusColor = statusColors[data.newStatus] || BRAND_COLOR;

  const body = `
    ${sectionTitle(`Mise à jour de votre commande`)}
    ${paragraph(`Bonjour <strong>${data.customerName}</strong>,`)}
    ${paragraph(message)}
    ${divider()}
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${infoRow('📋 Commande', `#${data.orderNumber}`)}
      ${infoRow('📌 Statut', `<span style="display:inline-block;background-color:${statusColor};color:#ffffff;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;">${statusLabel}</span>`)}
    </table>
    ${divider()}
    ${data.trackingLink ? button('Suivre la commande', data.trackingLink) : ''}
    ${paragraph('Merci de votre patience et de votre confiance.', 'font-style:italic;')}
  `;

  return { subject, html: emailWrapper(body, `Commande #${data.orderNumber} — ${statusLabel}`) };
}

// ---------------------------------------------------------------------------
// Template: Password Reset
// ---------------------------------------------------------------------------

export interface PasswordResetData {
  resetLink: string;
  expiryHours?: number;
}

export function passwordResetTemplate(data: PasswordResetData): { subject: string; html: string } {
  const subject = 'Réinitialisation de votre mot de passe — KFM Delice';
  const expiry = data.expiryHours ?? 1;

  const body = `
    ${sectionTitle('Réinitialisation du mot de passe 🔐')}
    ${paragraph('Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :')}
    ${button('Réinitialiser le mot de passe', data.resetLink)}
    ${divider()}
    ${paragraph(`⏳ Ce lien expire dans <strong>${expiry} heure${expiry > 1 ? 's' : ''}</strong>.`, 'color:#ef4444;font-weight:500;')}
    ${paragraph('Si vous n\'avez pas fait cette demande, vous pouvez ignorer cet email — votre mot de passe restera inchangé.')}
  `;

  return { subject, html: emailWrapper(body, 'Réinitialisation de mot de passe') };
}

// ---------------------------------------------------------------------------
// Template: Welcome
// ---------------------------------------------------------------------------

export interface WelcomeData {
  customerName: string;
  loginLink?: string;
}

export function welcomeTemplate(data: WelcomeData): { subject: string; html: string } {
  const subject = `Bienvenue chez KFM Delice, ${data.customerName} ! 🎉`;

  const body = `
    ${sectionTitle(`Bienvenue, ${data.customerName} ! 🍽️`)}
    ${paragraph('Nous sommes ravis de vous compter parmi nos clients ! Votre compte a été créé avec succès.')}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_LIGHT};border-radius:8px;margin:16px 0;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 8px;color:${BRAND_COLOR};font-size:16px;font-weight:600;">⭐ Programme de fidélité</p>
          <p style="margin:0;color:${TEXT_SECONDARY};font-size:14px;line-height:1.6;">
            Gagnez des points à chaque commande ! Chaque commande vous rapporte des points de fidélité échangeables contre des réductions et des plats gratuits.
          </p>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr>
        <td style="padding:16px 24px;border:1px solid #e7e5e4;border-radius:8px;">
          <p style="margin:0 0 8px;color:${TEXT_PRIMARY};font-size:14px;font-weight:600;">Ce que vous pouvez faire :</p>
          <p style="margin:0 0 4px;color:${TEXT_SECONDARY};font-size:14px;">🍕 Commander en ligne — Sur place, à emporter ou en livraison</p>
          <p style="margin:0 0 4px;color:${TEXT_SECONDARY};font-size:14px;">📅 Réserver une table — Intérieur, terrasse ou VIP</p>
          <p style="margin:0 0 4px;color:${TEXT_SECONDARY};font-size:14px;">📦 Suivre vos commandes — Notifications en temps réel</p>
          <p style="margin:0;color:${TEXT_SECONDARY};font-size:14px;">🎁 Cumuler des points — Récompenses et surprises</p>
        </td>
      </tr>
    </table>
    ${divider()}
    ${data.loginLink ? button('Accéder à mon compte', data.loginLink) : ''}
    ${paragraph('À très bientôt chez KFM Delice !', 'font-style:italic;')}
  `;

  return { subject, html: emailWrapper(body, `Bienvenue chez KFM Delice, ${data.customerName}`) };
}

// ---------------------------------------------------------------------------
// Fire-and-forget helper — never rejects, logs errors silently
// ---------------------------------------------------------------------------

/**
 * Send an email without blocking the caller. Errors are caught and logged.
 * Use this in API routes so that email failures never break the main response.
 */
export function sendEmailAsync(payload: EmailPayload): void {
  sendEmail(payload).catch((err) => {
    console.error('[EmailService] Async send failed:', err instanceof Error ? err.message : err);
  });
}

// ---------------------------------------------------------------------------
// Customer email lookup helper
// ---------------------------------------------------------------------------

/**
 * Look up a customer's email by name (case-insensitive partial match).
 * Returns the first match or null.
 */
export async function findCustomerEmailByName(customerName: string): Promise<string | null> {
  try {
    const { db } = await import('@/lib/db');
    const customer = await db.customer.findFirst({
      where: { name: { contains: customerName } },
      select: { email: true },
    });
    return customer?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Look up a customer's email by phone.
 * Returns the first match or null.
 */
export async function findCustomerEmailByPhone(phone: string): Promise<string | null> {
  if (!phone) return null;
  try {
    const { db } = await import('@/lib/db');
    const customer = await db.customer.findFirst({
      where: { phone },
      select: { email: true },
    });
    return customer?.email ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Export provider info for the test endpoint
// ---------------------------------------------------------------------------

export function getEmailProviderInfo(): { provider: EmailProvider; from: string } {
  return { provider: PROVIDER, from: EMAIL_FROM };
}
