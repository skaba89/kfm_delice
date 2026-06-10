import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { rateLimit } from '@/lib/rate-limit';

// ────────────────────────────────────────────────────────────────
// Security Configuration
// ────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for middleware');
}
// jose uses Uint8Array for the secret (Web Crypto API compatible)
const _JWT_SECRET = new TextEncoder().encode(JWT_SECRET);

// ────────────────────────────────────────────────────────────────
// Route Classification
// ────────────────────────────────────────────────────────────────

const PUBLIC_GET_ROUTES = ['/api/menu', '/api/reviews', '/api/tracking'];
const PUBLIC_POST_ROUTES = ['/api/login', '/api/customer-login', '/api/customer-register', '/api/driver-login', '/api/orders', '/api/reservations', '/api/seed'];
const PUBLIC_ANY_ROUTES = ['/api']; // health check

// Auth endpoints that need rate limiting
const AUTH_ROUTES = ['/api/login', '/api/customer-login', '/api/customer-register', '/api/driver-login'];
const AUTH_RATE_LIMIT = 10;       // max requests
const AUTH_RATE_WINDOW = 60_000;  // per minute

// General API rate limiting
const API_RATE_LIMIT = 60;        // max requests
const API_RATE_WINDOW = 60_000;   // per minute

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

  // ── Step 1: Security headers on ALL responses ──
  // We'll apply them at the end, but we need a base response first.

  // ── Step 2: Health check ──
  if (PUBLIC_ANY_ROUTES.some(r => pathname === r)) {
    return addSecurityHeaders(NextResponse.next());
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
    return addSecurityHeaders(NextResponse.next());
  }
  if (method === 'POST' && PUBLIC_POST_ROUTES.some(r => pathname.startsWith(r))) {
    return addSecurityHeaders(NextResponse.next());
  }

  // ── Step 6: DELETE on reviews — needs auth ──
  // All other /api/ routes require authentication

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

    // Add user info to request headers for downstream use
    const response = NextResponse.next();
    response.headers.set('x-user-id', String(decoded.id));
    response.headers.set('x-user-type', String(decoded.type));
    response.headers.set('x-user-role', String(decoded.role || ''));
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
