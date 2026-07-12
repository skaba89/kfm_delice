import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { resolveTableQrToken, buildPublicTableQrResponse } from "@/lib/table-qr";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

// ────────────────────────────────────────────────────────────────
// GET /api/qr/table/[token] — PUBLIC QR resolution endpoint
//
// This is the only endpoint a scanner's phone hits when scanning a
// restaurant table QR code. It resolves the opaque token to the
// minimum public data needed to display the menu + table context.
//
// Returns:
//   200 — { restaurant, table, menuUrl }
//   404 — token not found
//   410 — token found but disabled (qrEnabled=false → rotated or disabled)
//   403 — table inactive, restaurant suspended, or account suspended
//   429 — rate limit exceeded
// ────────────────────────────────────────────────────────────────

interface RouteContext {
  params: Promise<{ token: string }>;
}

// 30 scans/min per IP — generous enough for a busy restaurant but
// blocks brute-force enumeration of the token space (2^256 anyway,
// but defense in depth).
const SCAN_RATE_LIMIT = 30;
const SCAN_RATE_WINDOW = 60_000;

export async function GET(request: Request, ctx: RouteContext) {
  try {
    await dbReady;

    const { token } = await ctx.params;

    // ── Rate limit (per IP, per minute) ──
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const { allowed, remaining } = await rateLimit(
      `qr:${clientIp}`,
      SCAN_RATE_LIMIT,
      SCAN_RATE_WINDOW
    );
    if (!allowed) {
      const resp = NextResponse.json(
        { error: "Trop de scans. Réessayez dans une minute." },
        { status: 429 }
      );
      resp.headers.set("X-RateLimit-Remaining", String(remaining));
      return resp;
    }

    // ── Resolve token (full validation chain) ──
    const resolved = await resolveTableQrToken(token, { trackScan: true });
    if (resolved) {
      return NextResponse.json(buildPublicTableQrResponse(resolved));
    }

    // ── Token did NOT fully resolve — figure out why for a useful error ──
    const tableRow = await db.restaurantTable.findUnique({
      where: { qrToken: token },
      select: {
        id: true,
        qrEnabled: true,
        active: true,
        restaurantId: true,
        restaurant: { select: { status: true, account: { select: { status: true } } } },
      },
    });

    if (!tableRow) {
      return NextResponse.json(
        { error: "QR code invalide", code: "QR_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Log invalid scan attempt (security audit)
    await logAudit({
      actorId: "anonymous",
      actorType: "public",
      action: "table_qr_scan_invalid",
      entityType: "RestaurantTable",
      entityId: tableRow.id,
      restaurantId: tableRow.restaurantId,
      after: {
        qrEnabled: tableRow.qrEnabled,
        active: tableRow.active,
        restaurantStatus: tableRow.restaurant?.status,
        accountStatus: tableRow.restaurant?.account?.status,
      },
      request,
    }).catch(() => {});

    if (!tableRow.qrEnabled) {
      return NextResponse.json(
        { error: "Ce QR code a été remplacé", code: "QR_ROTATED" },
        { status: 410 }
      );
    }
    if (!tableRow.active) {
      return NextResponse.json(
        { error: "Cette table est désactivée", code: "TABLE_INACTIVE" },
        { status: 403 }
      );
    }
    const restoStatus = tableRow.restaurant?.status;
    const accountStatus = tableRow.restaurant?.account?.status;
    if (accountStatus && accountStatus !== "active" && accountStatus !== "trial") {
      return NextResponse.json(
        { error: "Ce compte est suspendu", code: "ACCOUNT_SUSPENDED" },
        { status: 403 }
      );
    }
    if (restoStatus && restoStatus !== "active" && restoStatus !== "trial") {
      return NextResponse.json(
        { error: "Ce restaurant est temporairement indisponible", code: "RESTAURANT_UNAVAILABLE" },
        { status: 403 }
      );
    }
    // Fallback (should not reach here, but be defensive)
    return NextResponse.json(
      { error: "QR code invalide", code: "QR_INVALID" },
      { status: 404 }
    );
  } catch (error) {
    console.error("[qr/table:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
