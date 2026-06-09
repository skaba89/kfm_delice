import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateAny, hasRole } from "@/lib/auth";

/**
 * Push Subscription Management API
 * 
 * POST /api/push — Save a push subscription for a user
 * DELETE /api/push — Remove a push subscription
 * GET /api/push — List subscriptions (admin only)
 * 
 * Note: For a production app without a PushSubscription model in Prisma,
 * we store subscriptions in memory. In production, you'd use a database table.
 */

// In-memory subscription store (replaces DB for now)
// In production, create a PushSubscription model in Prisma
interface PushSub {
  userId: string;
  userType: string;
  subscription: PushSubscriptionJSON;
  createdAt: number;
}

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

const subscriptions = new Map<string, PushSub>();

// GET: List subscriptions (admin only)
export async function GET(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const subs = Array.from(subscriptions.values()).map((s) => ({
      userId: s.userId,
      userType: s.userType,
      endpoint: s.subscription.endpoint.substring(0, 50) + "...",
      createdAt: s.createdAt,
    }));

    return NextResponse.json({
      total: subs.length,
      subscriptions: subs,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Save a push subscription
export async function POST(request: Request) {
  try {
    const auth = await authenticateAny(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { subscription } = body as { subscription: PushSubscriptionJSON };

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: "Subscription invalide" }, { status: 400 });
    }

    const key = `${auth.type}:${auth.id}`;
    subscriptions.set(key, {
      userId: auth.id,
      userType: auth.type,
      subscription,
      createdAt: Date.now(),
    });

    console.log(`[Push] Subscription saved for ${key} (total: ${subscriptions.size})`);

    return NextResponse.json({ success: true, message: "Subscription enregistrée" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE: Remove a push subscription
export async function DELETE(request: Request) {
  try {
    const auth = await authenticateAny(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const key = `${auth.type}:${auth.id}`;
    const deleted = subscriptions.delete(key);

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Export for use in other modules
export function getPushSubscriptions() {
  return subscriptions;
}
