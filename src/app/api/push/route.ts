// ───────────────────────────────────────────────────────────────────
// src/app/api/push/route.ts — Web Push subscription management
// ───────────────────────────────────────────────────────────────────
// Endpoints:
//   GET    /api/push            — list current user's subscriptions
//   POST   /api/push            — save a new subscription (idempotent by endpoint)
//   DELETE /api/push            — remove the current user's subscriptions
//   GET    /api/push/status     — check VAPID config (admin only)
//
// Auth: any authenticated user (admin, customer, driver, platform)
// ───────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateAny, authenticateAdmin, hasRole } from "@/lib/auth";
import { isPushServerConfigured } from "@/lib/push-server";

type SubscriptionBody = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function GET(request: Request) {
  const auth = await authenticateAny(request);
  if (!auth) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Platform admins can see all subscriptions (for diagnostics)
  if (auth.type === "platform_admin" || (auth.type === "admin" && hasRole(auth.role, ["admin", "manager"]))) {
    const where: Record<string, unknown> = {};
    if (auth.type !== "platform_admin") {
      where.restaurantId = auth.restaurantId || "";
    }
    const all = await db.pushSubscription.findMany({
      where,
      select: {
        id: true,
        userKey: true,
        userType: true,
        userId: true,
        endpoint: true,
        userAgent: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      total: all.length,
      configured: isPushServerConfigured(),
      subscriptions: all.map((s) => ({
        ...s,
        endpoint: s.endpoint.slice(0, 80) + "...",
      })),
    });
  }

  // Regular user: only their own subscriptions
  const userKey = `${auth.type}:${auth.id}`;
  const own = await db.pushSubscription.findMany({
    where: { userKey },
    select: {
      id: true,
      endpoint: true,
      userAgent: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    total: own.length,
    configured: isPushServerConfigured(),
    subscriptions: own.map((s) => ({
      ...s,
      endpoint: s.endpoint.slice(0, 80) + "...",
    })),
  });
}

export async function POST(request: Request) {
  const auth = await authenticateAny(request);
  if (!auth) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let body: { subscription?: SubscriptionBody };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json(
      { error: "Subscription invalide — endpoint + keys.p256dh + keys.auth requis" },
      { status: 400 },
    );
  }

  const userKey = `${auth.type}:${auth.id}`;
  const userAgent = request.headers.get("user-agent") || "";

  // Upsert: if endpoint exists, update userKey/restaurantId/userAgent (handles re-login)
  try {
    const existing = await db.pushSubscription.findUnique({
      where: { endpoint: sub.endpoint },
    });

    if (existing) {
      await db.pushSubscription.update({
        where: { id: existing.id },
        data: {
          userKey,
          userType: auth.type,
          userId: auth.id,
          restaurantId: auth.restaurantId || "",
          userAgent,
        },
      });
      return NextResponse.json({ success: true, updated: true });
    }

    await db.pushSubscription.create({
      data: {
        userKey,
        userType: auth.type,
        userId: auth.id,
        restaurantId: auth.restaurantId || "",
        endpoint: sub.endpoint,
        p256dhKey: sub.keys.p256dh,
        authKey: sub.keys.auth,
        userAgent,
      },
    });
    return NextResponse.json({ success: true, created: true });
  } catch (err) {
    console.error("[push] POST error:", err);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticateAny(request);
  if (!auth) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let body: { endpoint?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Allow empty body — delete all user subscriptions
  }

  const userKey = `${auth.type}:${auth.id}`;

  if (body.endpoint) {
    // Delete a specific subscription (must belong to the user)
    const sub = await db.pushSubscription.findUnique({
      where: { endpoint: body.endpoint },
    });
    if (!sub || sub.userKey !== userKey) {
      return NextResponse.json(
        { error: "Subscription introuvable ou non autorisée" },
        { status: 404 },
      );
    }
    await db.pushSubscription.delete({ where: { id: sub.id } });
    return NextResponse.json({ success: true, deleted: 1 });
  }

  // Delete all subscriptions for this user
  const result = await db.pushSubscription.deleteMany({ where: { userKey } });
  return NextResponse.json({ success: true, deleted: result.count });
}
