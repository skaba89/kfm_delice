/**
 * Order Creation Service — Mission 1, 2, 3
 *
 * Implements a fully server-authoritative order creation flow:
 *   1. Resolve the restaurant from QR token or tenant slug (never from client).
 *   2. Load each MenuItem by (menuItemId + restaurantId) — reject if not found or unavailable.
 *   3. Compute subtotal from DB prices — ignore any client-sent prices.
 *   4. Compute delivery fee from Restaurant.deliveryFee — ignore client value.
 *   5. Compute discount from PromoCode — ignore client discount.
 *   6. Validate maxUses, maxUsesPerUser, expiry — atomically increment usedCount.
 *   7. Force status=pending, paymentStatus=pending.
 *   8. customerId comes only from JWT (never from request body).
 *   9. Wrap order + idempotency key + promo redemption + stock in a transaction.
 *  10. IdempotencyKey with @@unique([restaurantId, key]) prevents duplicates atomically.
 *
 * This module is server-only — it imports Prisma and crypto.
 */

import { db } from './db';
import { hashFingerprint } from './crypto';
import { Prisma } from '@prisma/client';

const IDEMPOTENCY_TTL_HOURS = 24;
const IDEMPOTENCY_MAX_AGE_MS = IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000;

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
  rawBodyHash: string;
}

export interface CreateOrderResult {
  success: boolean;
  status: number; // HTTP status code (200, 201, 400, 404, 409, etc.)
  order?: unknown;
  error?: string;
  code?: string;
  created?: boolean; // Mission 3: false on idempotent replay, true on new creation
}

/**
 * Create an order with full server-side validation and atomic idempotency.
 *
 * Mission 3 (Phase 3):
 *   - Compares requestHash on replay → 409 if mismatch
 *   - Returns created:false on replay
 *   - Side effects (email, WS, stock, audit) are skipped by the caller when created=false
 */
export async function createOrderAtomically(
  input: CreateOrderInput,
  ctx: CreateOrderContext
): Promise<CreateOrderResult> {
  const { restaurantId, customerId, clientIp, rawBodyHash } = ctx;

  // ── Step 1: Idempotency check (atomic) ──
  if (input.idempotencyKey) {
    const existing = await db.idempotencyKey.findUnique({
      where: {
        restaurantId_key: { restaurantId, key: input.idempotencyKey },
      },
      include: { order: true },
    });

    if (existing) {
      const isExpired = existing.expiresAt < new Date();
      if (existing.orderId && existing.order) {
        // ── Mission 3: Compare requestHash on replay ──
        if (existing.requestHash && existing.requestHash !== rawBodyHash) {
          return {
            success: false,
            status: 409,
            error: 'Clé d\'idempotence utilisée avec un payload différent',
            code: 'IDEMPOTENCY_HASH_MISMATCH',
          };
        }
        // Idempotent replay — return the existing order, created=false
        return { success: true, status: 200, order: existing.order, created: false };
      }
      if (!isExpired && existing.status === 'pending') {
        return {
          success: false,
          status: 409,
          error: 'Une commande avec cette clé d\'idempotence est en cours de traitement',
          code: 'IDEMPOTENCY_IN_FLIGHT',
        };
      }
      // Expired or failed — delete and allow re-creation
      await db.idempotencyKey.delete({ where: { id: existing.id } }).catch(() => {});
    }
  }

  // ── Step 2: Load all menu items by ID + restaurantId ──
  const menuItemIds = input.items.map(i => i.menuItemId);
  const menuItems = await db.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId },
    select: { id: true, name: true, price: true, available: true },
  });

  // Validate every item exists and is available
  const itemsByMenuId = new Map(menuItems.map(m => [m.id, m]));
  for (const item of input.items) {
    const dbItem = itemsByMenuId.get(item.menuItemId);
    if (!dbItem) {
      return {
        success: false,
        status: 400,
        error: `Article introuvable: ${item.menuItemId}`,
        code: 'ITEM_NOT_FOUND',
      };
    }
    if (!dbItem.available) {
      return {
        success: false,
        status: 400,
        error: `Article indisponible: ${dbItem.name}`,
        code: 'ITEM_UNAVAILABLE',
      };
    }
  }

  // ── Step 3: Compute subtotal from DB prices ──
  // NOTE: monetary fields are BigInt on PostgreSQL and number on SQLite.
  // We use `as any` for Prisma writes and Number() for arithmetic to
  // support both providers transparently. GNF amounts fit in Number.MAX_SAFE_INTEGER.
  const orderItemData = input.items.map(item => {
    const dbItem = itemsByMenuId.get(item.menuItemId)!;
    const unitPrice = Number(dbItem.price);
    const quantity = item.quantity;
    const lineTotal = unitPrice * quantity;
    return {
      menuItemId: item.menuItemId,
      name: dbItem.name,
      unitPrice,
      quantity,
      note: item.note || '',
      lineTotal,
    };
  });

  // Sum line totals
  const subtotal = orderItemData.reduce((sum, oi) => sum + oi.lineTotal, 0);

  // ── Step 4: Compute delivery fee from Restaurant ──
  let deliveryFee = 0;
  if (input.orderType === 'delivery') {
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: { deliveryFee: true, minDelivery: true },
    });
    if (!restaurant) {
      return { success: false, status: 404, error: 'Restaurant non trouvé', code: 'RESTAURANT_NOT_FOUND' };
    }
    deliveryFee = Number(restaurant.deliveryFee);
    const minDelivery = Number(restaurant.minDelivery);
    if (minDelivery > 0 && subtotal < minDelivery) {
      return {
        success: false,
        status: 400,
        error: `Minimum de commande de ${minDelivery.toLocaleString('fr-FR')} GNF pour la livraison`,
        code: 'BELOW_MIN_DELIVERY',
      };
    }
  }

  // ── Step 5: Compute discount from PromoCode (server-authoritative) ──
  let discount = 0;
  let promoCodeId: string | null = null;
  let promoCodeStr: string | null = null;

  if (input.promoCode && input.promoCode.trim().length > 0) {
    const normalizedCode = input.promoCode.trim().toUpperCase();
    const promo = await db.promoCode.findFirst({
      where: { restaurantId, code: normalizedCode },
    });

    if (!promo) {
      return { success: false, status: 400, error: `Code promo "${normalizedCode}" introuvable`, code: 'PROMO_NOT_FOUND' };
    }
    if (!promo.active) {
      return { success: false, status: 400, error: 'Code promo désactivé', code: 'PROMO_INACTIVE' };
    }
    const now = new Date();
    if (promo.startsAt && now < promo.startsAt) {
      return { success: false, status: 400, error: 'Code promo pas encore actif', code: 'PROMO_NOT_STARTED' };
    }
    if (promo.expiresAt && now > promo.expiresAt) {
      return { success: false, status: 400, error: 'Code promo expiré', code: 'PROMO_EXPIRED' };
    }
    if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
      return { success: false, status: 400, error: 'Code promo épuisé', code: 'PROMO_EXHAUSTED' };
    }
    const minTotal = Number(promo.minOrderTotal);
    if (minTotal > 0 && subtotal < minTotal) {
      return {
        success: false,
        status: 400,
        error: `Commande minimum de ${minTotal.toLocaleString('fr-FR')} GNF requise pour ce code`,
        code: 'PROMO_MIN_TOTAL',
      };
    }

    // Check per-user usage (only if customerId is present)
    if (customerId && promo.maxUsesPerUser > 0) {
      const userRedemptions = await db.promotionRedemption.count({
        where: { promoCodeId: promo.id, customerId },
      });
      if (userRedemptions >= promo.maxUsesPerUser) {
        return { success: false, status: 400, error: 'Vous avez déjà utilisé ce code promo', code: 'PROMO_USER_LIMIT' };
      }
    }

    const value = Number(promo.discountValue);
    if (promo.discountType === 'percent') {
      discount = Math.round((subtotal * value) / 100);
    } else {
      discount = Math.min(value, subtotal);
    }
    promoCodeId = promo.id;
    promoCodeStr = normalizedCode;
  }

  // ── Step 6: Compute tip (validated against 50% of total) ──
  const computedTotalBeforeTip = Math.max(0, subtotal + deliveryFee - discount);
  const maxTip = Math.floor(computedTotalBeforeTip / 2);
  const tip = Math.max(0, Math.min(Math.floor(input.tip || 0), maxTip));

  const total = computedTotalBeforeTip + tip;

  // ── Step 7: Compute platform commission ──
  let platformCommission = 0;
  try {
    const restaurantWithAccount = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: { account: { select: { commissionRate: true } } },
    });
    const rate = restaurantWithAccount?.account?.commissionRate ?? 0;
    if (rate > 0) {
      platformCommission = Math.round((total * Math.round(rate)) / 100);
    }
  } catch {
    /* non-blocking — commissionRate may not exist */
  }

  // ── Step 8: Build snapshot JSON for backward compat ──
  const itemsSnapshot = JSON.stringify(
    orderItemData.map(oi => ({
      id: oi.menuItemId,
      name: oi.name,
      price: oi.unitPrice,
      qty: oi.quantity,
      note: oi.note,
    }))
  );

  // ── Step 9: Execute the full order creation in a transaction ──
  try {
    const result = await db.$transaction(async (tx) => {
      // ── Create the idempotency key record (atomic dedup) ──
      let idempotencyRecordId: string | null = null;
      if (input.idempotencyKey) {
        const created = await tx.idempotencyKey.create({
          data: {
            key: input.idempotencyKey,
            restaurantId,
            customerId: customerId || null,
            requestHash: rawBodyHash,
            status: 'pending',
            expiresAt: new Date(Date.now() + IDEMPOTENCY_MAX_AGE_MS),
          },
        });
        idempotencyRecordId = created.id;
      }

      // ── Create the order ──
      // Monetary fields are cast to `any` to support both BigInt (Postgres) and number (SQLite).
      const order = await tx.order.create({
        data: {
          customerName: input.customerName || '',
          phone: input.phone || '',
          items: itemsSnapshot,
          total: total as any,
          status: 'pending', // forced
          orderType: input.orderType,
          paymentMethod: input.paymentMethod,
          paymentStatus: 'pending', // forced
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
          ...(ctx.tableNumberStr && /^\d+$/.test(ctx.tableNumberStr) && {
            tableNumber: parseInt(ctx.tableNumberStr, 10),
          }),
        } as any,
      });

      // ── Create normalized OrderItem records ──
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

      // ── Create PromotionRedemption + increment usedCount atomically ──
      if (promoCodeId && promoCodeStr) {
        const customerFingerprint = customerId
          ? ''
          : hashFingerprint(`${input.phone || ''}|${clientIp}`);

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

        // Atomic increment — prevents race conditions on usedCount
        await tx.promoCode.update({
          where: { id: promoCodeId },
          data: { usedCount: { increment: 1 } },
        });
      }

      // ── Link idempotency key to the order ──
      if (idempotencyRecordId) {
        await tx.idempotencyKey.update({
          where: { id: idempotencyRecordId },
          data: { orderId: order.id, status: 'completed' },
        });
      }

      return order;
    }, {
      timeout: 10000,
      // Serializable isolation would cause DB locks on SQLite; ReadCommitted is
      // sufficient with the @@unique constraint on IdempotencyKey.
      ...(process.env.DATABASE_URL?.startsWith('postgresql') ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } : {}),
    });

    return { success: true, status: 201, order: result, created: true };
  } catch (error) {
    // If it's a unique constraint violation on idempotency key,
    // a concurrent request already created the order — return it.
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation — likely idempotency key race
        if (input.idempotencyKey) {
          const existing = await db.idempotencyKey.findUnique({
            where: {
              restaurantId_key: { restaurantId, key: input.idempotencyKey },
            },
            include: { order: true },
          });
          if (existing?.order) {
            return { success: true, status: 200, order: existing.order, created: false };
          }
        }
        return {
          success: false,
          status: 409,
          error: 'Conflit — une commande identique est en cours de création',
          code: 'IDEMPOTENCY_CONFLICT',
        };
      }
    }
    throw error;
  }
}
