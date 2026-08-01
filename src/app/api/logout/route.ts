import { dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAny } from "@/lib/auth";
import { revokeAllUserTokens, clearRefreshTokenCookie } from "@/lib/refresh-token";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/logout
 * Mission 7: Revoke all refresh tokens for the user and clear the cookie.
 *
 * The access JWT is short-lived (15min) and will expire naturally.
 * Refresh tokens are revoked immediately so they cannot be used to
 * obtain new access JWTs.
 */
export async function POST(request: Request) {
  try {
    await dbReady;

    const auth = await authenticateAny(request);
    if (!auth) {
      // Even if not authenticated, clear the cookie
      const response = NextResponse.json({ ok: true });
      clearRefreshTokenCookie(response);
      return response;
    }

    // Revoke all refresh tokens for this user
    const revokedCount = await revokeAllUserTokens(auth.id, auth.type);

    // Audit log (non-blocking)
    await logAudit({
      actorId: auth.id,
      actorType: auth.type,
      action: "logout",
      entityType: auth.type === "admin" ? "Admin" : auth.type === "customer" ? "Customer" : auth.type === "driver" ? "Driver" : "PlatformAdmin",
      entityId: auth.id,
      ...(auth.restaurantId && { restaurantId: auth.restaurantId }),
      request,
    }).catch(() => {});

    const response = NextResponse.json({
      ok: true,
      revokedTokens: revokedCount,
    });
    clearRefreshTokenCookie(response);
    return response;
  } catch (error) {
    console.error("[logout] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
