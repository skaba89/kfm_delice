import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { rateLimit } from '@/lib/rate-limit';

// ────────────────────────────────────────────────────────────────
// Security Configuration
// ────────────────────────────────────────────────────────────────

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
      '[middleware] FATAL: JWT_SECRET missing or too short in production. ' +
      'All authenticated routes will return 500 until JWT_SECRET is set.'
    );
    return { secret: new TextEncoder().encode('invalid-missing-jwt-secret-' + Date.now()), valid: false };
  }
  if (!secret) {
    console.warn('[middleware] WARNING: JWT_SECRET not set — using insecure dev fallback.');
  }
  return { secret: new TextEncoder().encode(DEV_FALLBACK_SECRET), valid: true };
}

const { secret: _JWT_SECRET, valid: jwtSecretValid } = resolveJwtSecretForEdge();

// ────────────────────────────────────────────────────────────────
// Route Classification
// ────────────────────────────────────────────────────────────────

// Liveness/readiness probes must bypass auth and rate limiting. /api/ready
// performs its own read-only DB/schema verification in the route handler.
const PUBLIC_HEALTH_ROUTES = ['/api/status', '/api/ready'];
const PUBLIC_GET_ROUTES = ['/api/menu', '/api/reviews', '/api/tracking', '/api/restaurant', '/api/restaurants', '/api/diagnose', '/api/seed', '/api/loyalty/rewards', '/api/loyalty/tiers', '/api/status', '/api/ready', '/api/qr/table', '/api/currency/convert'];
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

  switch (strategy) {
    case 'subdomain': {
      const host = request.headers.get('host') || '';
      const parts = host.split('.');
      if (parts.length >= 3) {
        const subdomain = parts[0];
        if (subdomain && subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'admin') {
          return subdomain;
        }
      }
      break;
    }
    case 'query':
    case 'slug-header':
    default:
      break;
  }

  return null;
}

// ────────────────────────────────────────────────────────────────
// Security Headers
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

// ────────────────────────────────────────────────────────────────
// Middleware
// ────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const tenantSlug = extractTenantSlug(request);

  // Health probes are intentionally handled before every auth/rate-limit path.
  if (method === 'GET' && PUBLIC_HEALTH_ROUTES.includes(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

  if (PUBLIC_ANY_ROUTES.some(r => pathname === r)) {
    const response = NextResponse.next();
    if (tenantSlug) response.headers.set('x-restaurant-slug', tenantSlug);
    return addSecurityHeaders(response);
  }

  if (method === 'POST' && AUTH_ROUTES.some(r => pathname.startsWith(r))) {
    const { allowed, remaining } = await rateLimit(clientIp, AUTH_RATE_LIMIT, AUTH_RATE_WINDOW);
    if (!allowed) {
      const response = NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans une minute.' },
        { status: 429 }
      );
      response.headers.set('Retry-After', '60');
      response.headers.set('X-RateLimit-Remaining', String(remaining));
      return addSecurityHeaders(response);
    }
  }

  if (pathname.startsWith('/api/')) {
    const { allowed, remaining } = await rateLimit(`api:${clientIp}`, API_RATE_LIMIT, API_RATE_WINDOW);
    if (!allowed) {
      const response = NextResponse.json(
        { error: 'Limite de requêtes atteinte. Réessayez plus tard.' },
        { status: 429 }
      );
      response.headers.set('Retry-After', '60');
      response.headers.set('X-RateLimit-Remaining', String(remaining));
      return addSecurityHeaders(response);
    }
  }

  if (method === 'GET' && PUBLIC_GET_ROUTES.some(r => pathname.startsWith(r))) {
    const response = NextResponse.next();
    if (tenantSlug) response.headers.set('x-restaurant-slug', tenantSlug);
    return addSecurityHeaders(response);
  }
  if (method === 'POST' && PUBLIC_POST_ROUTES.some(r => pathname.startsWith(r))) {
    const response = NextResponse.next();
    if (tenantSlug) response.headers.set('x-restaurant-slug', tenantSlug);
    return addSecurityHeaders(response);
  }

  if (pathname.startsWith('/r/')) {
    const response = NextResponse.next();
    if (tenantSlug) response.headers.set('x-restaurant-slug', tenantSlug);
    return addSecurityHeaders(response);
  }

  if (!jwtSecretValid) {
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Configuration serveur invalide (JWT_SECRET manquant). Contactez l\'administrateur.' },
        { status: 500 }
      )
    );
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return addSecurityHeaders(
      NextResponse.json({ error: "Token d'authentification requis" }, { status: 401 })
    );
  }

  const token = authHeader.substring(7);
  try {
    const { payload } = await jwtVerify(token, _JWT_SECRET);
    const decoded = payload as Record<string, unknown>;
    if (!decoded || typeof decoded !== 'object' || !('id' in decoded) || !('type' in decoded)) {
      return addSecurityHeaders(NextResponse.json({ error: 'Token invalide' }, { status: 401 }));
    }

    const response = NextResponse.next();
    response.headers.set('x-user-id', String(decoded.id));
    response.headers.set('x-user-type', String(decoded.type));
    response.headers.set('x-user-role', String(decoded.role || ''));

    const jwtSlug = decoded.restaurantSlug as string | undefined;
    if (jwtSlug) response.headers.set('x-restaurant-slug', jwtSlug);
    else if (tenantSlug) response.headers.set('x-restaurant-slug', tenantSlug);

    const jwtRestoId = decoded.restaurantId as string | undefined;
    if (jwtRestoId) response.headers.set('x-restaurant-id', jwtRestoId);

    return addSecurityHeaders(response);
  } catch {
    return addSecurityHeaders(
      NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 401 })
    );
  }
}

export const config = {
  matcher: ['/api/:path*', '/r/:path*'],
};
