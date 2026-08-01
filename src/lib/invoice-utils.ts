import { logger } from "@/lib/logger";
/**
 * Invoice utilities — auto-generation, numbering, creation on delivery.
 */

import { db } from './db';
import { logAudit } from './audit';

/**
 * Generate the next invoice number in the format: INV-2026-001
 * Uses the current year + a sequential counter per restaurant.
 */
export async function generateInvoiceNumber(restaurantId: string): Promise<string> {
  const year = new Date().getFullYear();

  // Count existing invoices for this restaurant + year
  const existingInvoices = await db.invoice.findMany({
    where: {
      restaurantId,
      number: { startsWith: `INV-${year}-` },
    },
    select: { number: true },
    orderBy: { number: 'desc' },
    take: 1,
  });

  let nextSeq = 1;
  if (existingInvoices.length > 0) {
    const lastNumber = existingInvoices[0].number;
    const parts = lastNumber.split('-');
    if (parts.length === 3) {
      nextSeq = parseInt(parts[2]) + 1;
    }
  }

  return `INV-${year}-${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Auto-generate an invoice when an order is delivered.
 * Non-blocking — if invoice creation fails, the delivery still succeeds.
 *
 * @param orderId The order that was just delivered
 * @param restaurantId The restaurant ID
 * @param adminId The admin who marked the order as delivered (for audit)
 * @param request The HTTP request (for audit log IP/user-agent)
 */
export async function autoGenerateInvoice(
  orderId: string,
  restaurantId: string,
  adminId: string,
  request?: Request
): Promise<void> {
  try {
    // Check if an invoice already exists for this order
    const existingInvoice = await db.invoice.findFirst({
      where: { orderId, restaurantId },
      select: { id: true },
    });

    if (existingInvoice) {
      // Invoice already exists — skip
      return;
    }

    // Fetch the order with items
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerName: true,
        phone: true,
        items: true,
        total: true,
        tax: true,
        discount: true,
        paymentMethod: true,
        paymentStatus: true,
        createdAt: true,
      },
    });

    if (!order) return;

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(restaurantId);

    // Parse items from JSON
    const items = typeof order.items === 'string'
      ? JSON.parse(order.items)
      : order.items;

    // Calculate subtotal (total - tax + discount, or just total if no breakdown)
    const total = Number(order.total);
    const tax = Number(order.tax || 0);
    const discount = Number(order.discount || 0);
    const subtotal = total - tax + discount;

    // Create the invoice
    const invoice = await db.invoice.create({
      data: {
        number: invoiceNumber,
        customerName: order.customerName || 'Client',
        customerPhone: order.phone || '',
        items: JSON.stringify(items) as any,
        subtotal: subtotal as any,
        tax: tax as any,
        total: total as any,
        status: order.paymentStatus === 'paid' ? 'paid' : 'pending',
        dueDate: new Date().toISOString().slice(0, 10),
        notes: `Facture auto-générée — Commande #${orderId.slice(-8).toUpperCase()}`,
        orderId: orderId,
        restaurantId,
      },
    });

    // Audit log
    await logAudit({
      actorId: adminId,
      actorType: 'admin',
      action: 'invoice_auto_generated',
      entityType: 'Invoice',
      entityId: invoice.id,
      restaurantId,
      after: { number: invoiceNumber, orderId, total },
      request,
    }).catch(() => {});

    logger.debug(`[invoice] ✓ Auto-generated ${invoiceNumber} for order ${orderId.slice(-8).toUpperCase()}`);
  } catch (error) {
    console.warn('[invoice] Auto-generation failed (non-blocking):', error instanceof Error ? error.message : String(error));
  }
}
