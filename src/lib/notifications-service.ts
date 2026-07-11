/**
 * Notification service — sends email notifications for business events.
 * All methods are non-blocking (fire-and-forget) so they never break
 * the business flow.
 */

import { sendEmail } from './email';
import {
  newOrderAdminEmail,
  newReservationAdminEmail,
  quotaExceededEmail,
  accountSuspendedEmail,
  welcomeCustomerEmail,
} from './email-templates';
import { db } from './db';

/**
 * Notify restaurant admins of a new order.
 * Fetches admin emails from DB, sends to each (non-blocking).
 */
export async function notifyNewOrder(restaurantId: string, order: {
  id: string;
  customerName: string;
  total: number;
  orderType: string;
  tableNumber?: number;
  items: string;
}): Promise<void> {
  try {
    const admins = await db.admin.findMany({
      where: { restaurantId, status: 'active' },
      select: { email: true },
    });
    const emails = admins.map((a) => a.email).filter(Boolean);
    if (emails.length === 0) return;

    const template = newOrderAdminEmail(emails[0], order);
    await sendEmail(template);
    // Could send to all admins, but for simplicity we send to the first one.
    // In production, use BCC or a mailing list.
  } catch (err) {
    console.warn('[notifications] notifyNewOrder failed:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Notify restaurant admins of a new reservation.
 */
export async function notifyNewReservation(restaurantId: string, reservation: {
  customerName: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  zone: string;
  notes?: string;
}): Promise<void> {
  try {
    const admins = await db.admin.findMany({
      where: { restaurantId, status: 'active' },
      select: { email: true },
    });
    const emails = admins.map((a) => a.email).filter(Boolean);
    if (emails.length === 0) return;

    const template = newReservationAdminEmail(emails[0], reservation);
    await sendEmail(template);
  } catch (err) {
    console.warn('[notifications] notifyNewReservation failed:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Notify account owner that their quota has been exceeded.
 */
export async function notifyQuotaExceeded(accountId: string, account: {
  name: string;
  plan: string;
  maxRestaurants: number;
  usedRestaurants: number;
  ownerEmail: string;
}): Promise<void> {
  try {
    if (!account.ownerEmail) return;
    const template = quotaExceededEmail(account.ownerEmail, account);
    await sendEmail(template);
  } catch (err) {
    console.warn('[notifications] notifyQuotaExceeded failed:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Notify account owner that their account has been suspended.
 */
export async function notifyAccountSuspended(account: {
  name: string;
  ownerEmail: string;
}, reason: string): Promise<void> {
  try {
    if (!account.ownerEmail) return;
    const template = accountSuspendedEmail(account.ownerEmail, account.name, reason);
    await sendEmail(template);
  } catch (err) {
    console.warn('[notifications] notifyAccountSuspended failed:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Send welcome email to a new customer.
 */
export async function notifyWelcomeCustomer(email: string, name: string): Promise<void> {
  try {
    if (!email) return;
    const template = welcomeCustomerEmail(email, name);
    await sendEmail(template);
  } catch (err) {
    console.warn('[notifications] notifyWelcomeCustomer failed:', err instanceof Error ? err.message : String(err));
  }
}
