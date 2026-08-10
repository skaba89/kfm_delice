/**
 * Server-authoritative order creation with atomic idempotency and promo usage.
 */

import { db } from './db';
import { hashFingerprint } from './crypto';
import { Prisma } from '@prisma/client';

const IDEMPOTENCY_TTL_HOURS = 24;
const IDEMPOTENCY_MAX_AGE_MS = IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000;
const SERIALIZABLE_RETRIES = 1;

export interface CreateOrderInput {
  items: { menuItemId: string; quantity: number; note?: string }[];
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  customerName?: string;
  phone?: string;
  deliveryAddress?: string;
  paymentMethod: 'cash' | 'orange_money' | 'mtn_money' | 'wave' | 'card';
  tableQrToken?: string;
  promoCode?: string;
  tip?: number;
  note?: string;
  idempotencyKey?: string;
}

export interface CreateOrderContext {
  restaurantId: string;
  tableId?: string;
  tableNumberStr?: string;
  customerId?: string;
  clientIp: string;
  /** @deprecated The service computes its own canonical request hash. */
  rawBodyHash?: string;
}

export interface CreateOrderResult {
  success: boolean;
  status: number;
  order?: unknown;
  error?: string;
  code?: string;
  created?: boolean;
}

class OrderValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = 'OrderValidationError';
  }
}

export function computeOrderRequestHash(input: CreateOrderInput, ctx: CreateOrderContext): string {
  const canonical = {
    items: input.items.map(item => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      note: item.note?.trim() || '',
    })),
    orderType: input.orderType,
    customerName: input.customerName?.trim() || '',
    phone: input.phone?.trim() || '',
    deliveryAddress: input.deliveryAddress?.trim() || '',
    paymentMethod: input.paymentMethod,
    tableQrToken: input.tableQrToken?.trim() || '',
    promoCode: input.promoCode?.trim().toUpperCase() || '',
    tip: Math.floor(input.tip || 0),
    note: input.note?.trim() || '',
    restaurantId: ctx.restaurantId,
    tableId: ctx.tableId || '',
    tableNumberStr: ctx.tableNumberStr || '',
    customerId: ctx.customerId || '',
  };
  return hashFingerprint(JSON.stringify(canonical));
}

export function calculatePlatformCommission(total: number, ratePercent: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(ratePercent) || total <= 0 || ratePercent <= 0) return 0;
  return Math.round((total * ratePercent) / 100);
}

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

export async function createOrderAtomically(
  input: CreateOrderInput,
  ctx: CreateOrderContext
): Promise<CreateOrderResult> {
  const { restaurantId, customerId, clientIp } = ctx;
  const requestHash = computeOrderRequestHash(input, ctx);

  if (input.idempotencyKey) {
    const existing = await db.idempotencyKey.findUnique({
      where: { restaurantId_key: { restaurantId, key: input.idempotencyKey } },
      include: { order: true },
    });

    if (existing) {
      const isExpired = existing.expiresAt < new Date();
      if (existing.orderId && existing.order) {
        if (existing.requestHash && existing.requestHash !== requestHash) {
          return {
            success: false,
            status: 409,
            error: "Clé d'idempotence utilisée avec un payload différent",
            code: 'IDEMPOTENCY_HASH_MISMATCH',
          };
        }
        return { success: true, status: 200, order: existing.order, created: false };
      }
      if (!isExpired && existing.status === 'pending') {
        return {
          success: false,
          status: 409,
          error: "Une commande avec cette clé d'idempotence est en cours de traitement",
          code: 'IDEMPOTENCY_IN_FLIGHT',
        };
      }
      await db.idempotencyKey.delete({ where: { id: existing.id } }).catch(() => {});
    }
  }

  const menuItemIds = input.items.map(i => i.menuItemId);
  const menuItems = await db.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId },
    select: { id: true, name: true, price: true, available: true },
  });

  const itemsByMenuId = new Map(menuItems.map(m => [m.id, m]));
  for (const item of input.items) {
    const dbItem = itemsByMenuId.get(item.menuItemId);
    if (!dbItem) {
      return { success: false, status: 400, error: `Article introuvable: ${item.menuItemId}`, code: 'ITEM_NOT_FOUND' };
    }
    if (!dbItem.available) {
      return { success: false, status: 400, error: `Article indisponible: ${dbItem.name}`, code: 'ITEM_UNAVAILABLE' };
    }
  }

  const orderItemData = input.items.map(item => {
    const dbItem = itemsByMenuId.get(item.menuItemId)!;
    const unitPrice = Number(dbItem.price);
    const quantity = item.quantity;
    return {
      menuItemId: item.menuItemId,
      name: dbItem.name,
      unitPrice,
      quantity,
      note: item.note || '',
      lineTotal: unitPrice * quantity,
    };
  });
  const subtotal = orderItemData.reduce((sum, oi) => sum + oi.lineTotal, 0);
  const itemsSnapshot = JSON.stringify(orderItemData.map(oi => ({
    id: oi.menuItemId,
    name: oi.name,
    price: oi.unitPrice,
    qty: oi.quantity,
    note: oi.note,
  })));

  const customerFingerprint = customerId ? '' : hashFingerprint(`${input.phone || ''}|${clientIp}`);

  const execute = async () => db.$transaction(async tx => {
    let idempotencyRecordId: string | null = null;
    if (input.idempotencyKey) {
      const created = await tx.idempotencyKey.create({
        data: {
          key: input.idempotencyKey,
          restaurantId,
          customerId: customerId || null,
          requestHash,
          status: 'pending',
          expiresAt: new Date(Date.now() + IDEMPOTENCY_MAX_AGE_MS),
        },
      });
      idempotencyRecordId = created.id;
    }

    const restaurant = await tx.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        deliveryFee: true,
        minDelivery: true,
        account: { select: { commissionRate: true } },
      },
    });
    if (!restaurant) throw new OrderValidationError('Restaurant non trouvé', 'RESTAURANT_NOT_FOUND', 404);

    let deliveryFee = 0;
    if (input.orderType === 'delivery') {
      deliveryFee = Number(restaurant.deliveryFee);
      const minDelivery = Number(restaurant.minDelivery);
      if (minDelivery > 0 && subtotal < minDelivery) {
        throw new OrderValidationError(
          `Minimum de commande de ${minDelivery.toLocaleString('fr-FR')} GNF pour la livraison`,
          'BELOW_MIN_DELIVERY'
        );
      }
    }

    let discount = 0;
    let promoCodeId: string | null = null;
    let promoCodeStr: string | null = null;

    if (input.promoCode?.trim()) {
      const normalizedCode = input.promoCode.trim().toUpperCase();
      const promo = await tx.promoCode.findFirst({ where: { restaurantId, code: normalizedCode } });
      if (!promo) throw new OrderValidationError(`Code promo "${normalizedCode}" introuvable`, 'PROMO_NOT_FOUND');
      if (!promo.active) throw new OrderValidationError('Code promo désactivé', 'PROMO_INACTIVE');

      const now = new Date();
      if (promo.startsAt && now < promo.startsAt) throw new OrderValidationError('Code promo pas encore actif', 'PROMO_NOT_STARTED');
      if (promo.expiresAt && now > promo.expiresAt) throw new OrderValidationError('Code promo expiré', 'PROMO_EXPIRED');

      const minTotal = Number(promo.minOrderTotal);
      if (minTotal > 0 && subtotal < minTotal) {
        throw new OrderValidationError(
          `Commande minimum de ${minTotal.toLocaleString('fr-FR')} GNF requise pour ce code`,
          'PROMO_MIN_TOTAL'
        );
      }

      if (promo.maxUsesPerUser > 0) {
        const redemptionCount = await tx.promotionRedemption.count({
          where: customerId
            ? { promoCodeId: promo.id, customerId }
            : { promoCodeId: promo.id, customerFingerprint },
        });
        if (redemptionCount >= promo.maxUsesPerUser) {
          throw new OrderValidationError('Vous avez déjà atteint la limite de ce code promo', 'PROMO_USER_LIMIT');
        }
      }

      if (promo.maxUses > 0) {
        const reserved = await tx.promoCode.updateMany({
          where: { id: promo.id, active: true, usedCount: { lt: promo.maxUses } },
          data: { usedCount: { increment: 1 } },
        });
        if (reserved.count !== 1) {
          throw new OrderValidationError('Code promo épuisé', 'PROMO_EXHAUSTED');
        }
      } else {
        await tx.promoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } });
      }

      const value = Number(promo.discountValue);
      discount = promo.discountType === 'percent'
        ? Math.round((subtotal * value) / 100)
        : Math.min(value, subtotal);
      promoCodeId = promo.id;
      promoCodeStr = normalizedCode;
    }

    const beforeTip = Math.max(0, subtotal + deliveryFee - discount);
    const maxTip = Math.floor(beforeTip / 2);
    const tip = Math.max(0, Math.min(Math.floor(input.tip || 0), maxTip));
    const total = beforeTip + tip;
    const platformCommission = calculatePlatformCommission(
      total,
      Number(restaurant.account?.commissionRate ?? 0)
    );

    const order = await tx.order.create({
      data: {
        customerName: input.customerName || '',
        phone: input.phone || '',
        items: itemsSnapshot,
        total: total as any,
        status: 'pending',
        orderType: input.orderType,
        paymentMethod: input.paymentMethod,
        paymentStatus: 'pending',
        deliveryAddress: input.deliveryAddress || '',
        deliveryFee: deliveryFee as any,
        discount: discount as any,
        tip: tip as any,
        platformCommission: platformCommission as any,
        note: input.note || '',
        restaurantId,
        ...(customerId && { customerId }),
        ...(ctx.tableId && { tableId: ctx.tableId }),
        ...(ctx.tableNumberStr && { tableNumberStr: ctx.tableNumberStr }),
        ...(ctx.tableNumberStr && /^\d+$/.test(ctx.tableNumberStr) && { tableNumber: parseInt(ctx.tableNumberStr, 10) }),
      } as any,
    });

    if (orderItemData.length > 0) {
      await tx.orderItem.createMany({
        data: orderItemData.map(oi => ({
          orderId: order.id,
          menuItemId: oi.menuItemId,
          name: oi.name,
          unitPrice: oi.unitPrice as any,
          quantity: oi.quantity,
          note: oi.note,
          lineTotal: oi.lineTotal as any,
          restaurantId,
        })) as any,
      });
    }

    if (promoCodeId && promoCodeStr) {
      await tx.promotionRedemption.create({
        data: {
          promoCodeId,
          orderId: order.id,
          restaurantId,
          customerId: customerId || null,
          customerFingerprint,
          discountAmount: discount as any,
          code: promoCodeStr,
        } as any,
      });
    }

    if (idempotencyRecordId) {
      await tx.idempotencyKey.update({
        where: { id: idempotencyRecordId },
        data: { orderId: order.id, status: 'completed' },
      });
    }

    return order;
  }, {
    timeout: 10000,
    ...(process.env.DATABASE_URL?.startsWith('postgresql')
      ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      : {}),
  });

  for (let attempt = 0; attempt <= SERIALIZABLE_RETRIES; attempt += 1) {
    try {
      const order = await execute();
      return { success: true, status: 201, order, created: true };
    } catch (error) {
      if (error instanceof OrderValidationError) {
        return { success: false, status: error.status, error: error.message, code: error.code };
      }

      if (isSerializationConflict(error) && attempt < SERIALIZABLE_RETRIES) continue;

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && input.idempotencyKey) {
        const existing = await db.idempotencyKey.findUnique({
          where: { restaurantId_key: { restaurantId, key: input.idempotencyKey } },
          include: { order: true },
        });
        if (existing?.order) {
          if (existing.requestHash && existing.requestHash !== requestHash) {
            return {
              success: false,
              status: 409,
              error: "Clé d'idempotence utilisée avec un payload différent",
              code: 'IDEMPOTENCY_HASH_MISMATCH',
            };
          }
          return { success: true, status: 200, order: existing.order, created: false };
        }
        return {
          success: false,
          status: 409,
          error: "Conflit — une commande avec cette clé est en cours de création",
          code: 'IDEMPOTENCY_CONFLICT',
        };
      }

      if (isSerializationConflict(error)) {
        return {
          success: false,
          status: 409,
          error: 'Conflit concurrent, veuillez réessayer la commande',
          code: 'ORDER_CONCURRENT_RETRY',
        };
      }
      throw error;
    }
  }

  return { success: false, status: 409, error: 'Conflit concurrent', code: 'ORDER_CONCURRENT_RETRY' };
}
