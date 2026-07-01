// ───────────────────────────────────────────────────────────────────
// src/lib/push-server.ts — Server-side Web Push notification sender
// ───────────────────────────────────────────────────────────────────
// Uses the `web-push` library to send encrypted push notifications to
// subscribers' browsers via the Web Push API (RFC 8030 + VAPID).
//
// Required env vars:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — client-side VAPID public key
//   VAPID_PRIVATE_KEY            — server-side VAPID private key
//   VAPID_SUBJECT                — "mailto:admin@example.com"
//
// Generate keys with: npx web-push generate-vapid-keys
// ───────────────────────────────────────────────────────────────────
import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { db } from "./db";

let vapidConfigured = false;

function configureVapid(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:admin@kfm-delice.com";

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export function isPushServerConfigured(): boolean {
  return configureVapid();
}

export type PushTarget = {
  userType: "admin" | "customer" | "driver" | "platform" | "manager" | "staff";
  userId: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

export type PushSendResult = {
  sent: number;
  failed: number;
  errors: string[];
};

/**
 * Send a push notification to a single user (all their subscriptions).
 * Returns counts of sent/failed deliveries.
 */
export async function sendPushToUser(
  target: PushTarget,
  payload: PushPayload,
): Promise<PushSendResult> {
  if (!configureVapid()) {
    return {
      sent: 0,
      failed: 0,
      errors: ["VAPID keys not configured — set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY"],
    };
  }

  // userKey matches the format stored in /api/push: "<userType>:<userId>"
  // For manager/staff stored under "admin:..." in DB, normalize here.
  const normalizedType = target.userType === "manager" || target.userType === "staff"
    ? "admin"
    : target.userType;
  const userKey = `${normalizedType}:${target.userId}`;
  const subscriptions = await db.pushSubscription.findMany({
    where: { userKey },
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    tag: payload.tag || "kfm-delice",
    data: payload.data || {},
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const expiredIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      const pushSubscription: WebPushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dhKey, auth: sub.authKey },
      };
      try {
        await webpush.sendNotification(pushSubscription, message);
        sent++;
      } catch (err) {
        failed++;
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 404 / 410 → subscription no longer valid, delete it
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(sub.id);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`endpoint=${sub.endpoint.slice(0, 60)}...: ${msg}`);
        }
      }
    }),
  );

  // Cleanup expired subscriptions
  if (expiredIds.length > 0) {
    try {
      await db.pushSubscription.deleteMany({
        where: { id: { in: expiredIds } },
      });
    } catch (err) {
      console.error("[push] Failed to delete expired subscriptions:", err);
    }
  }

  return { sent, failed, errors };
}

/**
 * Broadcast a push notification to all subscribers in a restaurant.
 * Useful for "new order" broadcasts to admin/manager staff.
 */
export async function broadcastPushToRestaurant(
  restaurantId: string,
  payload: PushPayload,
  options?: { onlyUserTypes?: PushTarget["userType"][] },
): Promise<PushSendResult> {
  if (!configureVapid()) {
    return {
      sent: 0,
      failed: 0,
      errors: ["VAPID keys not configured"],
    };
  }

  const where: Record<string, unknown> = { restaurantId };
  if (options?.onlyUserTypes && options.onlyUserTypes.length > 0) {
    where.userType = { in: options.onlyUserTypes };
  }

  const subscriptions = await db.pushSubscription.findMany({ where });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    tag: payload.tag || "kfm-delice",
    data: payload.data || {},
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const expiredIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      const pushSubscription: WebPushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dhKey, auth: sub.authKey },
      };
      try {
        await webpush.sendNotification(pushSubscription, message);
        sent++;
      } catch (err) {
        failed++;
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(sub.id);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`endpoint=${sub.endpoint.slice(0, 60)}...: ${msg}`);
        }
      }
    }),
  );

  if (expiredIds.length > 0) {
    try {
      await db.pushSubscription.deleteMany({
        where: { id: { in: expiredIds } },
      });
    } catch (err) {
      console.error("[push] Failed to delete expired subscriptions:", err);
    }
  }

  return { sent, failed, errors };
}

// ── Convenience helpers for common KFM Delice events ──────────────

export async function notifyNewOrder(
  restaurantId: string,
  customerName: string,
  total: number,
  orderType: string,
): Promise<PushSendResult> {
  return broadcastPushToRestaurant(
    restaurantId,
    {
      title: "Nouvelle commande !",
      body: `${customerName} — ${total.toLocaleString("fr-FR")} GNF (${orderType})`,
      url: "/admin?tab=orders",
      tag: "new-order",
    },
    { onlyUserTypes: ["admin", "manager"] },
  );
}

export async function notifyOrderStatusUpdate(
  target: PushTarget,
  orderNumber: string,
  newStatus: string,
): Promise<PushSendResult> {
  return sendPushToUser(target, {
    title: `Commande ${orderNumber} mise à jour`,
    body: `Statut: ${newStatus}`,
    url: "/client?tab=orders",
    tag: "order-status",
  });
}

export async function notifyNewReservation(
  restaurantId: string,
  customerName: string,
  guests: number,
  date: string,
  time: string,
): Promise<PushSendResult> {
  return broadcastPushToRestaurant(
    restaurantId,
    {
      title: "Nouvelle réservation !",
      body: `${customerName} — ${guests} pers. le ${date} à ${time}`,
      url: "/admin?tab=reservations",
      tag: "new-reservation",
    },
    { onlyUserTypes: ["admin", "manager"] },
  );
}

export async function notifyDeliveryAssigned(
  target: PushTarget,
  customerName: string,
  address: string,
): Promise<PushSendResult> {
  return sendPushToUser(target, {
    title: "Nouvelle livraison assignée",
    body: `${customerName} — ${address}`,
    url: "/driver",
    tag: "delivery-assigned",
  });
}
