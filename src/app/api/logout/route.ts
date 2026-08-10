import { dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAny, extractToken, verifyToken, revokeToken } from "@/lib/auth";
import { revokeAllUserTokens, clearRefreshTokenCookie } from "@/lib/refresh-token";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/logout
 * Revokes both the current access JWT (jti) and all refresh tokens for the
 * authenticated identity, then clears the refresh-token cookie.
 */
export async function POST(request: Request) {
  try {
    await dbReady;

    const rawAccessToken = extractToken(request);
    const accessPayload = rawAccessToken ? verifyToken(rawAccessToken) : null;
    const auth = await authenticateAny(request);

    if (!auth) {
      const response = NextResponse.json({ ok: true });
      clearRefreshTokenCookie(response);
      return response;
    }

    const revokedRefreshTokens = await revokeAllUserTokens(auth.id, auth.type);

    if (accessPayload?.jti) {
      const expiresAt = accessPayload.exp
        ? new Date(accessPayload.exp * 1000)
        : new Date(Date.now() + 20 * 60 * 1000);
      await revokeToken(accessPayload.jti, auth.id, auth.type, expiresAt, "logout");
    }

    await logAudit({
      actorId: auth.id,
      actorType: auth.type,
      action: "logout",
      entityType:
        auth.type === "admin"
          ? "Admin"
          : auth.type === "customer"
            ? "Customer"
            : auth.type === "driver"
              ? "Driver"
              : "PlatformAdmin",
      entityId: auth.id,
      ...(auth.restaurantId && { restaurantId: auth.restaurantId }),
      request,
    }).catch(() => {});

    const response = NextResponse.json({
      ok: true,
      revokedTokens: revokedRefreshTokens,
      accessTokenRevoked: Boolean(accessPayload?.jti),
    });
    clearRefreshTokenCookie(response);
    return response;
  } catch (error) {
    console.error("[logout] Error:", error);
    const response = NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    clearRefreshTokenCookie(response);
    return response;
  }
}
