import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { rateLimit } from '@/lib/rate-limit';
import { buildTrustedRequestHeaders } from '@/lib/proxy-request-context';

// ────────────────────────────────────────────────────────────────
// Security Configuration
// ────────────────────────────────────────────────────────────────

// JWT_SECRET resolution — matches src/lib/auth.ts semantics:
//   - Production: REQUIRED (≥16 chars). If missing, the proxy refuses
//     to verify any token (returns 500 on protected routes).
//   - Dev/build: insecure dev fallback with a warning. Never logged verbatim.
const DEV_FALLBACK_SECRET = 'kfm-delice-dev-secret-change-in-prod';
const isProdEnv = process.env.NODE_ENV === 'production';
const isNextBuildPhase = process.env.NEXT_BUILD === 'true';

function resolveJwtSecretForEdge(): { secret: Uint8Array; valid: boolean } {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) {
    return { secret: new TextEncoder().encode(secret), valid: true };
  }
  if (isProdEnv && !isNextBuildPhase) {
    console.error(
      '[proxy] FATAL: JWT_SECRET missing or too short in production. ' +
      'All authenticated routes will return 500 until JWT_SECRET is set.'
    );
    return { secret: new TextEncoder().encode('invalid-missing-jwt-secret-' + Date.now()), valid: false };
  }
  if (!secret) {
    console.warn('[proxy] WARNING: JWT_SECRET not set — using insecure dev fallback.');
  }
  return { secret: new TextEncoder().encode(DEV_FALLBACK_SECRET), valid: true };
}

const { secret: _JWT_SECRET, valid: jwtSecretValid } = resolveJwtSecretForEdge();

// ────────────────────────────────────────────────────────────────
// Route Classification
// ────────────────────────────────────────────────────────────────

const PUBLIC_GET_ROUTES = ['/api/menu', '/api/reviews', '/api/tracking', '/api/restaurant', '/api/restaurants', '/api/diagnose', '/api/seed', '/api/loyalty/rewards', '/api/loyalty/tiers', '/api/status', '/api/qr/table', '/api/currency/convert'];
const PUBLIC_POST_ROUTES = ['/api/login', '/api/customer-login', '/api/customer-register', '/api/driver-login', '/api/orders', '/api/reservations', '/api/seed', '/api/register-restaurant', '/api/platform-login', '/api/reviews', '/api/promo-codes/validate', '/api/customer/favorites', '/api/customer/reorder', '/api/customer/birthday-offer', '/api/customer/referral', '/api/webhooks/stripe', '/api/webhooks/payment', '/api/refresh', '/api/logout'];
const PUBLIC_ANY_ROUTES = ['/api'];

const AUTH_ROUTES = ['/api/login', '/api/customer-login', '/api/customer-register', '/api/driver-login', '/api/register-restaurant', '/api/platform-login'];
const AUTH_RATE_LIMIT = parseInt(process.env.AUTH_RATE_LIMIT || '10', 10);
const AUTH_RATE_WINDOW = parseInt(process.env.AUTH_RATE_WINDOW_MS || '60000', 10);
const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT || '60', 10);
const API_RATE_WINDOW = parseInt(process.env.API_RATE_WINDOW_MS || '60000', 10);

// ────────────────────────────────────────────────────────────────
// Tenant Slug Extraction (Edge-compatible, no DB access)
// ────────────────────────────────────────────────────────────────

function extractTenantSlug(request: NextRequest): string | null {
  const strategy = process.env.TENANT_STRATEGY || 'slug-header';
  const { pathname, searchParams } = request.nextUrl;

  const headerSlug = request.headers.get('x-restaurant-slug');
  if (headerSlug) return headerSlug;

  const pathMatch = pathname.match(/^\/r\/([^/]+)/);
  if (pathMatch) return pathMatch[1];

  const querySlugAny = searchParams.get('restaurant') || searchParams.get('slug');
  if (querySlugAny) return querySlugAny;

  if (strategy === 'subdomain') {
    const host = request.headers.get('host') || '';
    const parts = host.split('.');
    if (parts.length >= 3) {
      const subdomain = parts[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'admin') {
        return subdomain;
      }
    }
  }

  return null;
}

// ────────────────────────────────────────────────────────────────
// Response + request-context helpers
// ────────────────────────────────────────────────────────────────

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'"
    );
  }
  return response;
}

function finalizeResponse(response: NextResponse, requestId: string): NextResponse {
  // requestId is safe and useful to expose to clients/support. User/tenant
  // identity headers remain request-only and are never copied to the response.
  response.headers.set('x-request-id', requestId);
  return addSecurityHeaders(response);
}

function continueRequest(
  request: NextRequest,
  requestId: string,
  context: {
    tenantSlug?: string | null;
    userId?: string;
    userType?: string;
    userRole?: string;
    restaurantId?: string;
  } = {}
): NextResponse {
  const headers = buildTrustedRequestHeaders(request.headers, {
    requestId,
    ...context,
  });
  return finalizeResponse(NextResponse.next({ request: { headers } }), requestId);
}

function jsonResponse(body: Record<string, unknown>, status: number, requestId: string): NextResponse {
  return finalizeResponse(NextResponse.json(body, { status }), requestId);
}

// ────────────────────────────────────────────────────────────────
// Proxy
// ────────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const requestId = globalThis.crypto.randomUUID();
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const tenantSlug = extractTenantSlug(request);

  if (PUBLIC_ANY_ROUTES.some(r => pathname === r)) {
    return continueRequest(request, requestId, { tenantSlug });
  }

  if (method === 'POST' && AUTH_ROUTES.some(r => pathname.startsWith(r))) {
    const { allowed, remaining } = await rateLimit(clientIp, AUTH_RATE_LIMIT, AUTH_RATE_WINDOW);
    if (!allowed) {
      const response = jsonResponse(
        { error: 'Trop de tentatives. Réessayez dans une minute.' },
        429,
        requestId
      );
      response.headers.set('Retry-After', '60');
      response.headers.set('X-RateLimit-Remaining', String(remaining));
      return response;
    }
  }

  if (pathname.startsWith('/api/')) {
    const { allowed, remaining } = await rateLimit(`api:${clientIp}`, API_RATE_LIMIT, API_RATE_WINDOW);
    if (!allowed) {
      const response = jsonResponse(
        { error: 'Limite de requêtes atteinte. Réessayez plus tard.' },
        429,
        requestId
      );
      response.headers.set('Retry-After', '60');
      response.headers.set('X-RateLimit-Remaining', String(remaining));
      return response;
    }
  }

  if (method === 'GET' && PUBLIC_GET_ROUTES.some(r => pathname.startsWith(r))) {
    return continueRequest(request, requestId, { tenantSlug });
  }
  if (method === 'POST' && PUBLIC_POST_ROUTES.some(r => pathname.startsWith(r))) {
    return continueRequest(request, requestId, { tenantSlug });
  }

  if (pathname.startsWith('/r/')) {
    return continueRequest(request, requestId, { tenantSlug });
  }

  if (!jwtSecretValid) {
    return jsonResponse(
      { error: "Configuration serveur invalide (JWT_SECRET manquant). Contactez l'administrateur." },
      500,
      requestId
    );
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: "Token d'authentification requis" }, 401, requestId);
  }

  const token = authHeader.substring(7);
  try {
    // Keep the existing coarse proxy JWT verification unchanged. Route handlers
    // continue to perform the authoritative auth/session checks in src/lib/auth.
    const { payload } = await jwtVerify(token, _JWT_SECRET);

    const decoded = payload as Record<string, unknown>;
    if (!decoded || typeof decoded !== 'object' || !('id' in decoded) || !('type' in decoded)) {
      return jsonResponse({ error: 'Token invalide' }, 401, requestId);
    }

    const jwtSlug = typeof decoded.restaurantSlug === 'string' ? decoded.restaurantSlug : undefined;
    const jwtRestaurantId = typeof decoded.restaurantId === 'string' ? decoded.restaurantId : undefined;

    return continueRequest(request, requestId, {
      tenantSlug: jwtSlug || tenantSlug,
      userId: String(decoded.id),
      userType: String(decoded.type),
      userRole: typeof decoded.role === 'string' ? decoded.role : '',
      restaurantId: jwtRestaurantId,
    });
  } catch {
    return jsonResponse({ error: 'Token invalide ou expiré' }, 401, requestId);
  }
}

export const config = {
  matcher: ['/api/:path*', '/r/:path*'],
};
