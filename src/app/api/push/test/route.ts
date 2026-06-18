// ───────────────────────────────────────────────────────────────────
// src/app/api/push/test/route.ts — Send a test push to the current user
// ───────────────────────────────────────────────────────────────────
// POST /api/push/test
//   Sends a test notification to ALL the current user's subscribed devices.
//   Useful for verifying that VAPID config + subscription flow work end-to-end.
//
// Auth: any authenticated user
// ───────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { authenticateAny } from "@/lib/auth";
import { sendPushToUser, isPushServerConfigured } from "@/lib/push-server";

export async function POST(request: Request) {
  const auth = await authenticateAny(request);
  if (!auth) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!isPushServerConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.",
      },
      { status: 503 },
    );
  }

  const result = await sendPushToUser(
    {
      userType:
        auth.type === "platform_admin"
          ? "platform"
          : (auth.type as "admin" | "customer" | "driver"),
      userId: auth.id,
    },
    {
      title: "Test KFM Delice",
      body: `Notification de test envoyée à ${auth.email || "vous"}`,
      url: "/",
      tag: "test",
    },
  );

  return NextResponse.json({
    configured: true,
    sent: result.sent,
    failed: result.failed,
    errors: result.errors,
    message:
      result.sent > 0
        ? `${result.sent} notification(s) envoyée(s)`
        : "Aucune subscription enregistrée pour cet utilisateur — appelez d'abord POST /api/push avec une subscription browser",
  });
}
