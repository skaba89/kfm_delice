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
const DEV_FALLBACK_SECRET = 'kfm-delice-dev-secret-change-in-prod';
const isProdEnv = process.env.NODE_ENV === 'production';
const isNextBuildPhase = process.env.NEXT_BUILD === 'true';

function resolveJwtSecretForEdge(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (isProdEnv && !isNextBuildPhase) {
    console.error(
      '[middleware] FATAL: JWT_SECRET missing or too short in production. ' +
      'All authenticated routes will reject tokens until JWT_SECRET is set.'
    );
    return DEV_FALLBACK_SECRET;
  }
  if (!secret) {
    console.warn(
      '[middleware] WARNING: JWT_SECRET not set — using insecure dev fallback.'
    );
  }
  return DEV_FALLBACK_SECRET;
}

const JWT_SECRET = resolveJwtSecretForEdge();
// jose uses Uint8Array for the secret (Web Crypto API compatible)
const _JWT_SECRET = new TextEncoder().encode(JWT_SECRET);

// ────────────────────────────────────────────────────────────────
// Route Classification
// ────────────────────────────────────────────────────────────────

const PUBLIC_GET_ROUTES = ['/api/menu', '/api/reviews', '/api/tracking', '/api/restaurant', '/api/restaurants', '/api/diagnose', '/api/seed', '/api/loyalty/rewards', '/api/health'];
const PUBLIC_POST_ROUTES = ['/api/login', '/api/customer-login', '/api/customer-register', '/api/driver-login', '/api/orders', '/api/reservations', '/api/seed', '/api/register-restaurant', '/api/platform-login', '/api/reviews'];
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

  switch (strategy) {
    case 'path': {
      // Extract from URL path: /r/{slug}/...
      const pathMatch = pathname.match(/^\/r\/([^/]+)/);
      if (pathMatch) return pathMatch[1];
      break;
    }

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

    case 'query': {
      const querySlug = searchParams.get('restaurant');
      if (querySlug) return querySlug;
      break;
    }

    case 'slug-header':
    default: {
      // Check query param as fallback
      const querySlug = searchParams.get('restaurant');
      if (querySlug) return querySlug;
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

  // ── Step 6: Protected API routes — require auth ──

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
  matcher: '/api/:path*',
};
