/**
 * Email notification templates for business events.
 * Each function returns an EmailPayload ready to send via sendEmail().
 *
 * All templates are non-blocking — if email fails, the business action
 * still succeeds. The caller should catch errors and log them.
 */

import { RESTO } from './constants';

interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
}

// ── Order notifications ────────────────────────────────────────

export function newOrderAdminEmail(adminEmail: string, order: {
  id: string;
  customerName: string;
  total: number;
  orderType: string;
  tableNumber?: number;
  items: string;
}): EmailTemplate {
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const itemsHtml = Array.isArray(items)
    ? items.map((i: { name: string; qty: number; price: number }) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.name}</td><td style="padding:8px;text-align:center">${i.qty}</td><td style="padding:8px;text-align:right">${Number(i.price).toLocaleString('fr-FR')} GNF</td></tr>`
      ).join('')
    : '';

  return {
    to: adminEmail,
    subject: `🛎️ Nouvelle commande — ${order.orderType === 'dine_in' ? `Table ${order.tableNumber}` : order.orderType === 'delivery' ? 'Livraison' : 'À emporter'}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff">
        <div style="background:linear-gradient(135deg,#ea580c,#dc2626);padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:24px">Nouvelle commande reçue</h1>
        </div>
        <div style="padding:20px">
          <p style="color:#666">Une nouvelle commande a été passée :</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead><tr style="background:#f8f8f8"><th style="padding:8px;text-align:left">Plat</th><th style="padding:8px">Qté</th><th style="padding:8px;text-align:right">Prix</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <p style="font-size:18px;font-weight:bold;color:#ea580c">Total: ${Number(order.total).toLocaleString('fr-FR')} GNF</p>
          <p style="color:#666">Client: ${order.customerName}</p>
          <p style="color:#666">Type: ${order.orderType}${order.tableNumber ? ` (Table ${order.tableNumber})` : ''}</p>
          <a href="${process.env.PUBLIC_APP_URL || 'https://kfm-delice-ggb4.onrender.com'}/admin"
             style="display:inline-block;margin-top:16px;padding:12px 24px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px">
            Voir la commande
          </a>
        </div>
      </div>
    `,
  };
}

// ── Reservation notification ───────────────────────────────────

export function newReservationAdminEmail(adminEmail: string, reservation: {
  customerName: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  zone: string;
  notes?: string;
}): EmailTemplate {
  return {
    to: adminEmail,
    subject: `📅 Nouvelle réservation — ${reservation.date} à ${reservation.time}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff">
        <div style="background:linear-gradient(135deg,#ea580c,#dc2626);padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:24px">Nouvelle réservation</h1>
        </div>
        <div style="padding:20px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;color:#666">Nom</td><td style="padding:8px;font-weight:bold">${reservation.customerName}</td></tr>
            <tr><td style="padding:8px;color:#666">Téléphone</td><td style="padding:8px">${reservation.phone}</td></tr>
            <tr><td style="padding:8px;color:#666">Date</td><td style="padding:8px">${reservation.date}</td></tr>
            <tr><td style="padding:8px;color:#666">Heure</td><td style="padding:8px">${reservation.time}</td></tr>
            <tr><td style="padding:8px;color:#666">Personnes</td><td style="padding:8px">${reservation.guests}</td></tr>
            <tr><td style="padding:8px;color:#666">Zone</td><td style="padding:8px">${reservation.zone}</td></tr>
            ${reservation.notes ? `<tr><td style="padding:8px;color:#666">Notes</td><td style="padding:8px">${reservation.notes}</td></tr>` : ''}
          </table>
        </div>
      </div>
    `,
  };
}

// ── Quota exceeded notification ────────────────────────────────

export function quotaExceededEmail(ownerEmail: string, account: {
  name: string;
  plan: string;
  maxRestaurants: number;
  usedRestaurants: number;
}): EmailTemplate {
  return {
    to: ownerEmail,
    subject: `⚠️ Quota dépassé — ${account.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff">
        <div style="background:#f59e0b;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:24px">Quota dépassé</h1>
        </div>
        <div style="padding:20px">
          <p>Bonjour,</p>
          <p>Votre compte <strong>${account.name}</strong> (plan ${account.plan}) a dépassé son quota de restaurants :</p>
          <ul>
            <li>Restaurants utilisés: <strong>${account.usedRestaurants}</strong></li>
            <li>Maximum autorisé: <strong>${account.maxRestaurants}</strong></li>
          </ul>
          <p>Pour continuer à créer des restaurants, veuillez mettre à niveau votre plan.</p>
          <a href="${process.env.PUBLIC_APP_URL || ''}/admin"
             style="display:inline-block;margin-top:16px;padding:12px 24px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px">
            Mettre à niveau
          </a>
        </div>
      </div>
    `,
  };
}

// ── Account suspended notification ─────────────────────────────

export function accountSuspendedEmail(ownerEmail: string, accountName: string, reason: string): EmailTemplate {
  return {
    to: ownerEmail,
    subject: `🚫 Compte suspendu — ${accountName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff">
        <div style="background:#dc2626;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:24px">Compte suspendu</h1>
        </div>
        <div style="padding:20px">
          <p>Votre compte <strong>${accountName}</strong> a été suspendu.</p>
          <p><strong>Raison:</strong> ${reason}</p>
          <p>Pour plus d'informations, veuillez contacter l'équipe KFM Delice.</p>
        </div>
      </div>
    `,
  };
}

// ── Welcome email (new customer) ───────────────────────────────

export function welcomeCustomerEmail(email: string, name: string): EmailTemplate {
  return {
    to: email,
    subject: `Bienvenue chez ${RESTO.name} ! 🎉`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff">
        <div style="background:linear-gradient(135deg,#ea580c,#dc2626);padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:28px">Bienvenue, ${name} !</h1>
        </div>
        <div style="padding:20px">
          <p>Merci de vous être inscrit chez ${RESTO.name}.</p>
          <p>Vous bénéficiez de <strong>100 points de fidélité</strong> de bienvenue !</p>
          <p>Découvrez notre menu et commandez dès maintenant :</p>
          <a href="${process.env.PUBLIC_APP_URL || ''}/menu"
             style="display:inline-block;margin-top:16px;padding:12px 24px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px">
            Voir le menu
          </a>
          <p style="margin-top:20px;color:#666;font-size:14px">
            ${RESTO.name} — ${RESTO.tagline}<br>
            ${RESTO.phone} · ${RESTO.address}
          </p>
        </div>
      </div>
    `,
  };
}
