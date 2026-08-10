import { db } from './db';
import { isValidOrderTransition, ORDER_TRANSITIONS } from './validations';
import { Prisma } from '@prisma/client';

export type OrderPatchRole = 'admin' | 'manager' | 'staff' | 'cashier' | 'kitchen' | 'delivery_manager';

export interface OrderPatchPayload {
  id: string;
  customerName?: string;
  phone?: string;
  items?: string;
  total?: number;
  status?: string;
  orderType?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  tableNumber?: number;
  discount?: number;
  tax?: number;
  note?: string;
  driverId?: string | null;
  estimatedDeliveryTime?: string;
  customerId?: string;
}

const ROLE_FIELDS: Record<OrderPatchRole, readonly (keyof OrderPatchPayload)[]> = {
  admin: [
    'id', 'customerName', 'phone', 'items', 'total', 'status', 'orderType',
    'paymentMethod', 'paymentStatus', 'deliveryAddress', 'deliveryFee',
    'tableNumber', 'discount', 'tax', 'note', 'driverId',
    'estimatedDeliveryTime', 'customerId',
  ],
  manager: [
    'id', 'customerName', 'phone', 'items', 'total', 'status', 'orderType',
    'paymentMethod', 'paymentStatus', 'deliveryAddress', 'deliveryFee',
    'tableNumber', 'discount', 'tax', 'note', 'driverId',
    'estimatedDeliveryTime', 'customerId',
  ],
  cashier: ['id', 'status', 'paymentMethod', 'paymentStatus', 'customerName', 'phone', 'note'],
  kitchen: ['id', 'status', 'note'],
  staff: ['id', 'status', 'note', 'customerName', 'phone', 'tableNumber'],
  delivery_manager: ['id', 'status', 'driverId', 'estimatedDeliveryTime', 'deliveryAddress', 'note'],
};

const isPostgres = () => {
  const url = process.env.DATABASE_URL || '';
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
};

/**
 * Monetary Prisma fields are BigInt in PostgreSQL and Int in the SQLite test
 * schema. Keep one business implementation while writing the provider-native
 * runtime value. Call sites cast through `any` only at the Prisma boundary.
 */
function money(value: number | bigint | null | undefined): number | bigint {
  const numeric = typeof value === 'bigint' ? value : Math.trunc(Number(value || 0));
  return isPostgres() ? BigInt(numeric) : Number(numeric);
}

function moneyNumber(value: number | bigint | null | undefined): number {
  return Number(value || 0);
}

export function getDisallowedOrderPatchFields(
  role: string,
  patch: OrderPatchPayload
): string[] {
  const allowed = ROLE_FIELDS[role as OrderPatchRole];
  if (!allowed) return Object.keys(patch).filter(key => key !== 'id');
  return Object.keys(patch).filter(
    key => patch[key as keyof OrderPatchPayload] !== undefined && !allowed.includes(key as keyof OrderPatchPayload)
  );
}

export interface ApplyOrderPatchContext {
  restaurantId: string;
  actorId: string;
  actorRole: string;
}

export type ApplyOrderPatchResult =
  | {
      ok: true;
      order: any;
      becameDelivered: boolean;
      becameCancelled: boolean;
      assignedDriverId?: string;
      customerId?: string;
      replayed: boolean;
    }
  | { ok: false; status: number; error: string; code: string };

function toProviderMoneyUpdate(data: Record<string, unknown>): Record<string, unknown> {
  const monetaryFields = ['total', 'deliveryFee', 'discount', 'tax'] as const;
  const result = { ...data };
  for (const field of monetaryFields) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = money(Number(result[field]));
    }
  }
  return result;
}

function automaticInvoiceNumber(orderId: string, date: Date = new Date()): string {
  return `AUTO-${date.getFullYear()}-${orderId.slice(-10).toUpperCase()}`;
}

export async function applyOrderPatchAtomically(
  patch: OrderPatchPayload,
  context: ApplyOrderPatchContext
): Promise<ApplyOrderPatchResult> {
  const disallowed = getDisallowedOrderPatchFields(context.actorRole, patch);
  if (disallowed.length > 0) {
    return {
      ok: false,
      status: 403,
      error: `Champs non autorisés pour ce rôle: ${disallowed.join(', ')}`,
      code: 'ORDER_PATCH_FIELDS_FORBIDDEN',
    };
  }

  const result = await db.$transaction(async tx => {
    const existing = await tx.order.findFirst({
      where: { id: patch.id, restaurantId: context.restaurantId },
      select: {
        id: true,
        status: true,
        driverId: true,
        customerId: true,
        total: true,
        deliveryFee: true,
        tax: true,
        customerName: true,
        phone: true,
        items: true,
        paymentStatus: true,
        restaurantId: true,
      },
    });
    if (!existing) {
      return { ok: false as const, status: 404, error: 'Commande introuvable', code: 'ORDER_NOT_FOUND' };
    }

    const requestedStatus = patch.status;
    const statusChanged = Boolean(requestedStatus && requestedStatus !== existing.status);
    if (statusChanged && requestedStatus && !isValidOrderTransition(existing.status, requestedStatus)) {
      return {
        ok: false as const,
        status: 400,
        error: `Transition invalide: ${existing.status} → ${requestedStatus}. Transitions autorisées: ${ORDER_TRANSITIONS[existing.status]?.join(', ') || 'aucune'}`,
        code: 'ORDER_INVALID_TRANSITION',
      };
    }

    let requestedDriver: { id: string; commissionRate: number } | null = null;
    if (typeof patch.driverId === 'string' && patch.driverId) {
      requestedDriver = await tx.driver.findFirst({
        where: { id: patch.driverId, restaurantId: context.restaurantId },
        select: { id: true, commissionRate: true },
      });
      if (!requestedDriver) {
        return {
          ok: false as const,
          status: 400,
          error: 'Livreur introuvable pour ce restaurant',
          code: 'DRIVER_TENANT_MISMATCH',
        };
      }
    }

    if (patch.customerId) {
      const customer = await tx.customer.findFirst({
        where: { id: patch.customerId, restaurantId: context.restaurantId },
        select: { id: true },
      });
      if (!customer) {
        return {
          ok: false as const,
          status: 400,
          error: 'Client introuvable pour ce restaurant',
          code: 'CUSTOMER_TENANT_MISMATCH',
        };
      }
    }

    const { id, driverId, ...rest } = patch;
    const updateData = toProviderMoneyUpdate(rest as Record<string, unknown>);
    if (driverId !== undefined) updateData.driverId = driverId;

    let replayed = false;
    if (statusChanged && requestedStatus) {
      const changed = await tx.order.updateMany({
        where: { id, restaurantId: context.restaurantId, status: existing.status },
        data: updateData as any,
      });
      if (changed.count !== 1) {
        const current = await tx.order.findFirst({ where: { id, restaurantId: context.restaurantId } });
        if (!current) {
          return { ok: false as const, status: 404, error: 'Commande introuvable', code: 'ORDER_NOT_FOUND' };
        }
        if (current.status === requestedStatus) {
          return {
            ok: true as const,
            order: current,
            becameDelivered: false,
            becameCancelled: false,
            assignedDriverId: undefined,
            customerId: current.customerId || undefined,
            replayed: true,
          };
        }
        return {
          ok: false as const,
          status: 409,
          error: 'La commande a été modifiée simultanément. Rechargez puis réessayez.',
          code: 'ORDER_CONCURRENT_UPDATE',
        };
      }
    } else {
      await tx.order.update({ where: { id }, data: updateData as any });
    }

    const becameDelivered = statusChanged && requestedStatus === 'delivered';
    const becameCancelled = statusChanged && requestedStatus === 'cancelled';
    const terminal = becameDelivered || becameCancelled;
    const effectiveDriverId = driverId !== undefined ? (driverId || null) : existing.driverId;
    const effectiveCustomerId = patch.customerId || existing.customerId || undefined;

    if (driverId !== undefined && existing.driverId && existing.driverId !== driverId) {
      await tx.driver.updateMany({
        where: { id: existing.driverId, restaurantId: context.restaurantId },
        data: { status: 'available', currentOrderId: '' },
      });
    }

    if (driverId && requestedDriver && !terminal) {
      await tx.driver.update({
        where: { id: driverId },
        data: { status: 'busy', currentOrderId: id },
      });
    }

    if (terminal && effectiveDriverId) {
      const driver = await tx.driver.findFirst({
        where: { id: effectiveDriverId, restaurantId: context.restaurantId },
        select: { id: true, commissionRate: true },
      });
      if (driver) {
        const computedEarning = Math.max(
          Math.round(moneyNumber(existing.total) * (Number(driver.commissionRate) / 100)),
          moneyNumber(existing.deliveryFee)
        );
        await tx.driver.update({
          where: { id: effectiveDriverId },
          data: {
            status: 'available',
            currentOrderId: '',
            ...(becameDelivered ? {
              totalDeliveries: { increment: 1 },
              totalEarnings: { increment: money(computedEarning) as any },
            } : {}),
          } as any,
        });
        if (becameDelivered) {
          await tx.order.update({
            where: { id },
            data: { driverEarning: money(computedEarning) as any },
          });
        }
      }
    }

    if (becameCancelled) {
      const outgoingMovements = await tx.stockMovement.findMany({
        where: {
          restaurantId: context.restaurantId,
          type: 'out',
          reason: `Commande ${id}`,
        },
        select: { stockItemId: true, quantity: true },
      });
      const restoreByStock = new Map<string, number>();
      for (const movement of outgoingMovements) {
        restoreByStock.set(
          movement.stockItemId,
          (restoreByStock.get(movement.stockItemId) || 0) + Number(movement.quantity)
        );
      }
      for (const [stockItemId, quantity] of restoreByStock) {
        if (quantity <= 0) continue;
        const restored = await tx.stockItem.updateMany({
          where: { id: stockItemId, restaurantId: context.restaurantId },
          data: { quantity: { increment: quantity } },
        });
        if (restored.count !== 1) {
          throw new Error(`StockItem ${stockItemId} missing during cancellation restore`);
        }
        await tx.stockMovement.create({
          data: {
            stockItemId,
            type: 'in',
            quantity,
            reason: `Annulation commande ${id}`,
            actor: context.actorId,
            restaurantId: context.restaurantId,
          },
        });
      }
    }

    if (becameDelivered && effectiveCustomerId) {
      const customer = await tx.customer.findFirst({
        where: { id: effectiveCustomerId, restaurantId: context.restaurantId },
        select: { id: true },
      });
      if (customer) {
        const restaurant = await tx.restaurant.findUnique({
          where: { id: context.restaurantId },
          select: { loyaltyPointsRate: true },
        });
        const pointsEarned = Math.floor(moneyNumber(existing.total) / 1000) * (restaurant?.loyaltyPointsRate ?? 1);
        await tx.customer.update({
          where: { id: effectiveCustomerId },
          data: {
            ...(pointsEarned > 0 ? { loyaltyPoints: { increment: pointsEarned } } : {}),
            totalOrders: { increment: 1 },
            totalSpent: { increment: money(existing.total) as any },
          } as any,
        });
        if (pointsEarned > 0) {
          await tx.loyaltyPointsHistory.create({
            data: {
              customerId: effectiveCustomerId,
              referenceId: id,
              points: pointsEarned,
              type: 'earned',
              description: `Commande #${id.slice(-8).toUpperCase()}`,
            },
          });
        }
      }
    }

    if (becameDelivered) {
      const existingInvoice = await tx.invoice.findFirst({
        where: { orderId: id, restaurantId: context.restaurantId },
        select: { id: true },
      });
      if (!existingInvoice) {
        const now = new Date();
        const due = new Date(now);
        due.setDate(due.getDate() + 7);
        const taxNumber = moneyNumber(existing.tax);
        const totalNumber = moneyNumber(existing.total);
        await tx.invoice.create({
          data: {
            number: automaticInvoiceNumber(id, now),
            customerName: existing.customerName || 'Client',
            customerPhone: existing.phone || '',
            items: existing.items as any,
            subtotal: money(Math.max(0, totalNumber - taxNumber)) as any,
            tax: money(taxNumber) as any,
            total: money(totalNumber) as any,
            status: existing.paymentStatus === 'paid' ? 'paid' : 'pending',
            dueDate: due.toISOString().slice(0, 10),
            notes: `Facture générée automatiquement pour la commande ${id}`,
            orderId: id,
            restaurantId: context.restaurantId,
          } as any,
        });
      }
    }

    const order = await tx.order.findFirst({ where: { id, restaurantId: context.restaurantId } });
    if (!order) throw new Error('Order disappeared after atomic transition');

    return {
      ok: true as const,
      order,
      becameDelivered,
      becameCancelled,
      assignedDriverId: driverId && !terminal ? driverId : undefined,
      customerId: effectiveCustomerId,
      replayed,
    };
  }, {
    timeout: 15000,
    ...(isPostgres()
      ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      : {}),
  });

  return result as ApplyOrderPatchResult;
}
