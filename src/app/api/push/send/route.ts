// ───────────────────────────────────────────────────────────────────
// src/app/api/push/send/route.ts — Send push notification (admin/manager only)
// ───────────────────────────────────────────────────────────────────
// POST /api/push/send
//   body: {
//     target: { userType: "admin"|"customer"|"driver", userId: string },
//     payload: { title: string, body: string, url?: string, tag?: string }
//   }
//
// Used by:
//   - Order status updates (admin → customer)
//   - Delivery assignment (admin → driver)
//   - Manual reminders (admin → any user)
//
// Auth: admin or manager (scoped to their restaurant)
// ───────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { sendPushToUser, isPushServerConfigured } from "@/lib/push-server";

type SendBody = {
  target?: { userType: "admin" | "customer" | "driver"; userId: string };
  payload?: { title: string; body: string; url?: string; tag?: string };
};

export async function POST(request: Request) {
  const admin = await authenticateAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!hasRole(admin.role, ["admin", "manager"])) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (!isPushServerConfigured()) {
    return NextResponse.json(
      {
        error:
          "VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.",
      },
      { status: 503 },
    );
  }

  let body: SendBody = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { target, payload } = body;
  if (!target?.userType || !target?.userId) {
    return NextResponse.json(
      { error: "target.userType et target.userId requis" },
      { status: 400 },
    );
  }
  if (!payload?.title || !payload.body) {
    return NextResponse.json(
      { error: "payload.title et payload.body requis" },
      { status: 400 },
    );
  }

  const result = await sendPushToUser(
    target,
    {
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag,
    },
  );

  return NextResponse.json({
    success: result.sent > 0,
    sent: result.sent,
    failed: result.failed,
    errors: result.errors,
  });
}
