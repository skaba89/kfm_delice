/**
 * Stock management — decrement on order, restore on cancel, low-stock alerts.
 */

import { db } from './db';
import { logAudit } from './audit';

interface OrderItem {
  name: string;
  qty: number;
  note?: string;
}

/**
 * Decrement stock for all menu items in an order.
 * For each ordered item, find the linked StockItem and decrement its quantity
 * by the order quantity. Create a StockMovement for audit.
 *
 * Non-blocking: if stock decrement fails, the order still succeeds.
 */
export async function decrementStockForOrder(
  orderId: string,
  restaurantId: string,
  items: OrderItem[],
  actorId: string = 'system'
): Promise<void> {
  try {
    // Get all menu items for this restaurant that have stockItemId
    const menuItems = await db.menuItem.findMany({
      where: {
        restaurantId,
        stockItemId: { not: null },
      },
      select: { id: true, name: true, stockItemId: true },
    });

    if (menuItems.length === 0) return; // no stock links configured

    for (const item of items) {
      // Find the menu item by name (items in order are stored by name)
      const menuItem = menuItems.find((m) => m.name === item.name);
      if (!menuItem?.stockItemId) continue;

      const stockItem = await db.stockItem.findUnique({
        where: { id: menuItem.stockItemId },
        select: { id: true, name: true, quantity: true, minThreshold: true, unit: true },
      });

      if (!stockItem) continue;

      const newQuantity = stockItem.quantity - item.qty;

      // Decrement stock
      await db.stockItem.update({
        where: { id: stockItem.id },
        data: { quantity: newQuantity },
      });

      // Create stock movement record
      await db.stockMovement.create({
        data: {
          stockItemId: stockItem.id,
          type: 'out',
          quantity: item.qty,
          reason: `Commande #${orderId.slice(-8).toUpperCase()}`,
          actor: actorId,
          restaurantId,
        },
      }).catch(() => {}); // non-blocking

      // Low-stock alert
      if (newQuantity <= stockItem.minThreshold && stockItem.minThreshold > 0) {
        console.warn(
          `[stock] ⚠️ LOW STOCK ALERT: "${stockItem.name}" is at ${newQuantity} ${stockItem.unit}` +
          ` (minimum: ${stockItem.minThreshold}). Restaurant: ${restaurantId}`
        );

        // Send email alert (non-blocking)
        try {
          const { sendEmail } = await import('./email');
          const admins = await db.admin.findMany({
            where: { restaurantId, status: 'active' },
            select: { email: true },
          });
          const adminEmail = admins[0]?.email;
          if (adminEmail) {
            sendEmail({
              to: adminEmail,
              subject: `⚠️ Alerte stock bas — ${stockItem.name}`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                  <div style="background:#f59e0b;padding:20px;text-align:center">
                    <h1 style="color:#fff;margin:0">Alerte stock bas</h1>
                  </div>
                  <div style="padding:20px">
                    <p>Le stock de <strong>${stockItem.name}</strong> est bas :</p>
                    <ul>
                      <li>Quantité restante: <strong>${newQuantity} ${stockItem.unit}</strong></li>
                      <li>Seuil minimum: <strong>${stockItem.minThreshold} ${stockItem.unit}</strong></li>
                      <li>Commande: #${orderId.slice(-8).toUpperCase()}</li>
                    </ul>
                    <p>Pensez à réapprovisionner bientôt !</p>
                  </div>
                </div>
              `,
            }).catch(() => {});
          }
        } catch { /* non-blocking */ }
      }

      // Auto-disable menu item if out of stock
      if (newQuantity <= 0) {
        await db.menuItem.update({
          where: { id: menuItem.id },
          data: { available: false },
        }).catch(() => {});
        console.warn(
          `[stock] ❌ OUT OF STOCK: "${menuItem.name}" auto-disabled (stock: 0)`
        );
      }
    }
  } catch (error) {
    console.warn('[stock] decrementStockForOrder failed (non-blocking):', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Restore stock when an order is cancelled.
 * Re-increment the stock for each item that was decremented.
 */
export async function restoreStockForOrder(
  orderId: string,
  restaurantId: string,
  items: OrderItem[]
): Promise<void> {
  try {
    const menuItems = await db.menuItem.findMany({
      where: {
        restaurantId,
        stockItemId: { not: null },
      },
      select: { id: true, name: true, stockItemId: true, available: true },
    });

    if (menuItems.length === 0) return;

    for (const item of items) {
      const menuItem = menuItems.find((m) => m.name === item.name);
      if (!menuItem?.stockItemId) continue;

      const stockItem = await db.stockItem.findUnique({
        where: { id: menuItem.stockItemId },
        select: { id: true, name: true, quantity: true, unit: true },
      });

      if (!stockItem) continue;

      // Re-increment stock
      await db.stockItem.update({
        where: { id: stockItem.id },
        data: { quantity: stockItem.quantity + item.qty },
      });

      // Create stock movement
      await db.stockMovement.create({
        data: {
          stockItemId: stockItem.id,
          type: 'in',
          quantity: item.qty,
          reason: `Annulation commande #${orderId.slice(-8).toUpperCase()}`,
          actor: 'system',
          restaurantId,
        },
      }).catch(() => {});

      // Re-enable menu item if it was disabled
      if (!menuItem.available) {
        await db.menuItem.update({
          where: { id: menuItem.id },
          data: { available: true },
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.warn('[stock] restoreStockForOrder failed (non-blocking):', error instanceof Error ? error.message : String(error));
  }
}
