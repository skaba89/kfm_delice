import { dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { rotateRefreshToken, extractRefreshToken, setRefreshTokenCookie } from "@/lib/refresh-token";

/**
 * POST /api/refresh
 * Mission 7: Rotate refresh token and issue a new access JWT.
 *
 * The refresh token is read from:
 *   1. HttpOnly cookie `refresh_token` (preferred)
 *   2. Authorization: Bearer <token> header (mobile apps)
 *
 * The old refresh token is revoked atomically, and a new token pair is issued.
 * This implements refresh token rotation (RFC 6749 Section 10.4).
 */
export async function POST(request: Request) {
  try {
    await dbReady;

    // ── Rate limit: 30 refreshes per minute per IP ──
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const { allowed } = await rateLimit(`refresh:${clientIp}`, 30, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Trop de requêtes. Réessayez plus tard." },
        { status: 429 }
      );
    }

    // ── Extract the refresh token ──
    const refreshToken = extractRefreshToken(request);
    if (!refreshToken) {
      return NextResponse.json(
        { error: "Token de rafraîchissement requis", code: "NO_REFRESH_TOKEN" },
        { status: 401 }
      );
    }

    // ── Rotate the token (verifies + issues new pair) ──
    const tokenPair = await rotateRefreshToken(refreshToken);
    if (!tokenPair) {
      return NextResponse.json(
        { error: "Token invalide, expiré ou déjà utilisé", code: "INVALID_REFRESH_TOKEN" },
        { status: 401 }
      );
    }

    // ── Set the new refresh token as an HttpOnly cookie ──
    const response = NextResponse.json({
      accessToken: tokenPair.accessToken,
      expiresAt: tokenPair.expiresAt.toISOString(),
    });
    setRefreshTokenCookie(response, tokenPair.refreshToken, tokenPair.expiresAt);

    return response;
  } catch (error) {
    console.error("[refresh] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
