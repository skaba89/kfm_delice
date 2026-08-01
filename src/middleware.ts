import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { rateLimit } from '@/lib/rate-limit';

// ────────────────────────────────────────────────────────────────
// Security Configuration
// ────────────────────────────────────────────────────────────────

// JWT_SECRET resolution — matches src/lib/auth.ts semantics:
//   - Production: REQUIRED (≥16 chars). If missing, the middleware refuses
//     to verify any token (returns 500 on protected routes). We do NOT throw
//     at module-load time because Next.js imports middleware in many contexts.
//   - Dev/build: insecure dev fallback with a warning. Never logged verbatim.
//
// SECURITY: In production with an invalid/missing JWT_SECRET, we DO NOT use
// the dev fallback to verify tokens. Why? Because the dev fallback is
// committed to the public GitHub repo — an attacker could forge a valid JWT
// with that known secret and bypass authentication entirely. Instead, we
// return an explicit 500 on protected routes while still serving public
// routes (/api/menu, /api/restaurants, /api/status, etc.) so the frontend
// doesn't completely break.
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
    // Return an invalid random secret so token verification always fails.
    // We do NOT use the dev fallback here — it would let attackers forge
    // valid JWTs with a publicly-known secret.
    return { secret: new TextEncoder().encode('invalid-missing-jwt-secret-' + Date.now()), valid: false };
  }
  if (!secret) {
    console.warn(
      '[middleware] WARNING: JWT_SECRET not set — using insecure dev fallback.'
    );
  }
  return { secret: new TextEncoder().encode(DEV_FALLBACK_SECRET), valid: true };
}

const { secret: _JWT_SECRET, valid: jwtSecretValid } = resolveJwtSecretForEdge();

// ────────────────────────────────────────────────────────────────
// Route Classification
// ────────────────────────────────────────────────────────────────

// Note: /api/seed is intentionally PUBLIC at the middleware level (so the
// route handler can return proper 401/403/429 responses). The seed route
// enforces its own authentication: SEED_TOKEN header OR admin JWT, with a
// strict 3-req/min rate limit. See src/app/api/seed/route.ts.
//
// /api/status is the lightweight public Render health check (no DB, no auth).
// /api/health is the full diagnostic — auth-protected in production.
//
// /api/webhooks/* are PUBLIC at the middleware level — they authenticate
// via provider signatures (Stripe-Signature, etc.), NOT via JWT.
// The route handlers enforce signature verification themselves.
const PUBLIC_GET_ROUTES = ['/api/menu', '/api/reviews', '/api/tracking', '/api/restaurant', '/api/restaurants', '/api/diagnose', '/api/seed', '/api/loyalty/rewards', '/api/loyalty/tiers', '/api/status', '/api/qr/table', '/api/currency/convert'];
const PUBLIC_POST_ROUTES = ['/api/login', '/api/customer-login', '/api/customer-register', '/api/driver-login', '/api/orders', '/api/reservations', '/api/seed', '/api/register-restaurant', '/api/platform-login', '/api/reviews', '/api/promo-codes/validate', '/api/customer/favorites', '/api/customer/reorder', '/api/customer/birthday-offer', '/api/customer/referral', '/api/webhooks/stripe', '/api/webhooks/payment'];
const PUBLIC_ANY_ROUTES = ['/api']; // health check

// Auth endpoints that need rate limiting
const AUTH_ROUTES = ['/api/login', '/api/customer-login', '/api/customer-register', '/api/driver-login', '/api/register-restaurant', '/api/platform-login'];
const AUTH_RATE_LIMIT = parseInt(process.env.AUTH_RATE_LIMIT || '10', 10);       // max requests
const AUTH_RATE_WINDOW = parseInt(process.env.AUTH_RATE_WINDOW_MS || '60000', 10);  // per minute

// General API rate limiting
const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT || '60', 10);        // max requests
const API_RATE_WINDOW = parseInt(process.env.API_RATE_WINDOW_MS || '60000', 10);   // per minute

// ────────────────────────────────────────────────────────────────
// Tenant Slug Extraction (Edge-compatible, no DB access)
// ────────────────────────────────────────────────────────────────

function extractTenantSlug(request: NextRequest): string | null {
  const strategy = process.env.TENANT_STRATEGY || 'slug-header';
  const { pathname, searchParams } = request.nextUrl;

  // Always check explicit x-restaurant-slug header first (set by frontend)
  const headerSlug = request.headers.get('x-restaurant-slug');
  if (headerSlug) return headerSlug;

  // ALWAYS extract from /r/{slug}/... URL path regardless of strategy —
  // the per-restaurant URL is the canonical tenant identifier and
  // must work even when TENANT_STRATEGY=slug-header (the default).
  const pathMatch = pathname.match(/^\/r\/([^/]+)/);
  if (pathMatch) return pathMatch[1];

  // Accept both ?restaurant=<slug> (legacy) and ?slug=<slug>
  const querySlugAny = searchParams.get('restaurant') || searchParams.get('slug');
  if (querySlugAny) return querySlugAny;

  switch (strategy) {
    case 'subdomain': {
      // Extract from subdomain: {slug}.domain.com
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
    default: {
      // Already checked above — nothing more to do.
      break;
    }
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
  // Content-Security-Policy — relaxed for development, strict for production
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

  // ── Step 0: Extract tenant slug and add to request headers ──
  const tenantSlug = extractTenantSlug(request);

  // ── Step 1: Security headers on ALL responses ──
  // We'll apply them at the end, but we need a base response first.

  // ── Step 2: Health check ──
  if (PUBLIC_ANY_ROUTES.some(r => pathname === r)) {
    const response = NextResponse.next();
    if (tenantSlug) response.headers.set('x-restaurant-slug', tenantSlug);
    return addSecurityHeaders(response);
  }

  // ── Step 3: Rate limiting for auth routes (stricter) ──
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

  // ── Step 4: General rate limiting for all API routes ──
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

  // ── Step 5: Public routes — no auth needed ──
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

  // ── Step 5b: Public restaurant pages (/r/<slug>/...) — no auth needed ──
  // These pages render restaurant-specific content (menu, reservation,
  // landing). The tenant slug is extracted from the URL path and
  // propagated as the x-restaurant-slug header for any downstream
  // fetch the page may make to /api/* routes.
  if (pathname.startsWith('/r/')) {
    const response = NextResponse.next();
    if (tenantSlug) response.headers.set('x-restaurant-slug', tenantSlug);
    return addSecurityHeaders(response);
  }

  // ── Step 6: Protected API routes — require auth ──
  // (Only /api/* routes beyond this point — /r/* pages are public.)

  // SECURITY: In production with an invalid JWT_SECRET, refuse ALL protected
  // routes with a clear 500 error. We do NOT attempt to verify tokens with
  // the dev fallback secret (which is publicly known and would let attackers
  // forge valid JWTs).
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
    // Use jose (Web Crypto API) instead of jsonwebtoken (Node.js crypto)
    // This works in Edge Runtime where jsonwebtoken fails
    const { payload } = await jwtVerify(token, _JWT_SECRET);

    const decoded = payload as Record<string, unknown>;
    if (!decoded || typeof decoded !== 'object' || !('id' in decoded) || !('type' in decoded)) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Token invalide' }, { status: 401 })
      );
    }

    // Add user info + tenant slug to request headers for downstream use
    const response = NextResponse.next();
    response.headers.set('x-user-id', String(decoded.id));
    response.headers.set('x-user-type', String(decoded.type));
    response.headers.set('x-user-role', String(decoded.role || ''));

    // Add restaurant slug from JWT if present, otherwise from tenant resolution
    const jwtSlug = decoded.restaurantSlug as string | undefined;
    if (jwtSlug) {
      response.headers.set('x-restaurant-slug', jwtSlug);
    } else if (tenantSlug) {
      response.headers.set('x-restaurant-slug', tenantSlug);
    }

    // Add restaurant ID from JWT if present
    const jwtRestoId = decoded.restaurantId as string | undefined;
    if (jwtRestoId) {
      response.headers.set('x-restaurant-id', jwtRestoId);
    }

    return addSecurityHeaders(response);
  } catch {
    return addSecurityHeaders(
      NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 401 })
    );
  }
}

export const config = {
  // Run middleware on API routes AND on /r/[slug]/... public restaurant
  // pages so the x-restaurant-slug header is set from the URL path
  // (security headers + tenant propagation for any downstream fetch).
  matcher: ['/api/:path*', '/r/:path*'],
};
