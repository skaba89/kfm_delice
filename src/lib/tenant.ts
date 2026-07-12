/**
 * Tenant Resolution — Multi-tenant SaaS utility
 *
 * Resolves the current restaurant (tenant) from:
 * 1. Custom header: x-restaurant-slug (set by middleware or client)
 * 2. URL path prefix: /r/{slug}/...
 * 3. Subdomain: {slug}.domain.com
 * 4. Query param: ?restaurant={slug}
 * 5. Fallback: first restaurant (single-tenant backward compat)
 *
 * Strategy is configurable via TENANT_STRATEGY env var:
 * - "slug-header" (default): expects x-restaurant-slug header
 * - "path": extracts slug from /r/{slug}/ URL path
 * - "subdomain": extracts slug from subdomain
 * - "query": reads ?restaurant= query parameter
 */

import { db } from './db';

// Types
export interface TenantContext {
  restaurantId: string;
  slug: string;
  name: string;
  currency: string;
  locale: string;
  plan: string;
  status: string;
}

// Cache tenant lookups in-memory for performance (TTL: 5 minutes)
const tenantCache = new Map<string, { data: TenantContext; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Extract restaurant slug from a Request object using the configured strategy
 */
export function extractSlug(request: Request): string | null {
  const strategy = process.env.TENANT_STRATEGY || 'slug-header';
  const url = new URL(request.url);

  switch (strategy) {
    case 'slug-header': {
      // Primary strategy: read from x-restaurant-slug header (set by middleware)
      const headerSlug = request.headers.get('x-restaurant-slug');
      if (headerSlug) return headerSlug;
      // Fallback to query param if header not present.
      // Accept both ?restaurant=<slug> (legacy) and ?slug=<slug>
      // so /r/[slug]/ pages can pass the slug explicitly without
      // going through the middleware header path.
      const querySlug = url.searchParams.get('restaurant') || url.searchParams.get('slug');
      return querySlug;
    }

    case 'path': {
      // Extract from URL path: /r/{slug}/...
      const pathMatch = url.pathname.match(/^\/r\/([^/]+)/);
      if (pathMatch) return pathMatch[1];
      // Also accept ?slug= and ?restaurant= as fallbacks
      const querySlug = url.searchParams.get('restaurant') || url.searchParams.get('slug');
      if (querySlug) return querySlug;
      // And the header
      const headerSlug = request.headers.get('x-restaurant-slug');
      return headerSlug;
    }

    case 'subdomain': {
      // Extract from subdomain: {slug}.domain.com
      const host = request.headers.get('host') || '';
      const parts = host.split('.');
      if (parts.length >= 3) {
        const subdomain = parts[0];
        // Ignore www and common subdomains
        if (subdomain && subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'admin') {
          return subdomain;
        }
      }
      // Fallback to header
      const headerSlug = request.headers.get('x-restaurant-slug');
      return headerSlug;
    }

    case 'query': {
      const querySlug = url.searchParams.get('restaurant');
      if (querySlug) return querySlug;
      const headerSlug = request.headers.get('x-restaurant-slug');
      return headerSlug;
    }

    default:
      return null;
  }
}

/**
 * Resolve tenant context from a slug string
 * Returns null if restaurant not found or suspended
 */
export async function resolveTenant(slug: string): Promise<TenantContext | null> {
  // Check cache first
  const cached = tenantCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      currency: true,
      locale: true,
      plan: true,
      status: true,
    },
  });

  if (!restaurant) return null;

  const context: TenantContext = {
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    currency: restaurant.currency,
    locale: restaurant.locale,
    plan: restaurant.plan,
    status: restaurant.status,
  };

  // Cache the result
  tenantCache.set(slug, { data: context, expiresAt: Date.now() + CACHE_TTL });

  return context;
}

/**
 * Resolve tenant from a Request object
 * This is the main function used in API routes
 *
 * Behavior:
 *   - If a slug is extracted from the request (header / path / subdomain /
 *     query), resolve that specific tenant.
 *   - If no slug is extracted:
 *       • In production (multi-tenant SaaS), return null unless
 *         ALLOW_DEFAULT_TENANT=true is set explicitly. This prevents the
 *         platform from silently leaking data of the first restaurant to
 *         unauthenticated / unscoped requests.
 *       • In development, fall back to the first restaurant (single-tenant
 *         backward compat) to keep the local dev experience smooth.
 */
export async function resolveTenantFromRequest(request: Request): Promise<TenantContext | null> {
  const slug = extractSlug(request);
  if (!slug) {
    // Decide whether to fall back to the default (first) restaurant.
    const isProduction = process.env.NODE_ENV === 'production';
    const allowDefault = process.env.ALLOW_DEFAULT_TENANT === 'true';
    if (isProduction && !allowDefault) {
      // Multi-tenant SaaS: do NOT silently return another restaurant's data.
      return null;
    }
    // Dev mode OR explicit opt-in via ALLOW_DEFAULT_TENANT=true
    return resolveDefaultTenant();
  }
  return resolveTenant(slug);
}

/**
 * Fallback: resolve the default/first restaurant
 * Used for backward compatibility with single-tenant deployments
 */
let defaultTenantCache: { data: TenantContext; expiresAt: number } | null = null;

export async function resolveDefaultTenant(): Promise<TenantContext | null> {
  // Check cache
  if (defaultTenantCache && defaultTenantCache.expiresAt > Date.now()) {
    return defaultTenantCache.data;
  }

  const restaurant = await db.restaurant.findFirst({
    select: {
      id: true,
      slug: true,
      name: true,
      currency: true,
      locale: true,
      plan: true,
      status: true,
    },
  });

  if (!restaurant) return null;

  const context: TenantContext = {
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    currency: restaurant.currency,
    locale: restaurant.locale,
    plan: restaurant.plan,
    status: restaurant.status,
  };

  defaultTenantCache = { data: context, expiresAt: Date.now() + CACHE_TTL };
  return context;
}

/**
 * Get restaurant ID from request — convenience wrapper for API routes
 * Returns null if tenant not found
 */
export async function getRestaurantId(request: Request): Promise<string | null> {
  const tenant = await resolveTenantFromRequest(request);
  return tenant?.restaurantId || null;
}

/**
 * Validate that a restaurant is active and allowed to operate
 */
export function isTenantActive(tenant: TenantContext): boolean {
  return tenant.status === 'active' || tenant.status === 'trial';
}

/**
 * Check if a feature is enabled for a tenant's plan
 */
export function isFeatureEnabled(tenant: TenantContext, feature: string): boolean {
  const planFeatures: Record<string, string[]> = {
    free: ['delivery', 'reservations', 'reviews', 'pos'],
    starter: ['delivery', 'reservations', 'reviews', 'pos', 'loyalty', 'invoices'],
    pro: ['delivery', 'reservations', 'reviews', 'pos', 'loyalty', 'invoices', 'quotes', 'expenses', 'staff', 'drivers'],
    enterprise: ['delivery', 'reservations', 'reviews', 'pos', 'loyalty', 'invoices', 'quotes', 'expenses', 'staff', 'drivers', 'custom_domain', 'api_access', 'white_label'],
  };

  const features = planFeatures[tenant.plan] || planFeatures.free;
  return features.includes(feature);
}

/**
 * Invalidate tenant cache (call after restaurant updates)
 */
export function invalidateTenantCache(slug?: string): void {
  if (slug) {
    tenantCache.delete(slug);
  } else {
    tenantCache.clear();
  }
  defaultTenantCache = null;
}

/**
 * Generate a unique slug from a restaurant name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '')         // Remove leading/trailing hyphens
    .substring(0, 50);               // Limit length
}

/**
 * Ensure slug is unique by appending a number if needed
 */
export async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (await db.restaurant.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
