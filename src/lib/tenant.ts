/**
 * Tenant Resolution — Multi-tenant SaaS utility
 *
 * Resolves the current restaurant from header/path/subdomain/query while
 * enforcing both restaurant and SaaS-account lifecycle centrally.
 */

import { db } from './db';
import { evaluateSubscriptionAccess } from './subscription-access';

export interface TenantContext {
  restaurantId: string;
  slug: string;
  name: string;
  currency: string;
  locale: string;
  plan: string;
  status: string;
  accountStatus?: string | null;
  accountTrialEndsAt?: string | null;
  accountContractEndDate?: string | null;
}

const tenantCache = new Map<string, { data: TenantContext; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function contractGraceDays(): number {
  const parsed = Number(process.env.COMMERCIAL_CONTRACT_GRACE_DAYS ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(90, Math.max(0, Math.trunc(parsed)));
}

export function extractSlug(request: Request): string | null {
  const strategy = process.env.TENANT_STRATEGY || 'slug-header';
  const url = new URL(request.url);

  const headerSlug = request.headers.get('x-restaurant-slug');
  const pathMatch = url.pathname.match(/^\/r\/([^/]+)/);
  const querySlug = url.searchParams.get('restaurant') || url.searchParams.get('slug');

  if (headerSlug) return headerSlug;
  if (pathMatch?.[1]) return pathMatch[1];
  if (querySlug) return querySlug;

  if (strategy === 'subdomain') {
    const host = request.headers.get('host') || '';
    const hostname = host.split(':')[0];
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const subdomain = parts[0];
      if (subdomain && !['www', 'app', 'admin'].includes(subdomain)) return subdomain;
    }
  }

  return null;
}

export function isTenantActive(tenant: Pick<
  TenantContext,
  'status' | 'accountStatus' | 'accountTrialEndsAt' | 'accountContractEndDate'
>): boolean {
  return evaluateSubscriptionAccess({
    restaurantStatus: tenant.status,
    accountStatus: tenant.accountStatus ?? null,
    trialEndsAt: tenant.accountTrialEndsAt ?? null,
    contractEndDate: tenant.accountContractEndDate ?? null,
    contractGraceDays: contractGraceDays(),
  }).allowed;
}

function toContext(restaurant: {
  id: string;
  slug: string;
  name: string;
  currency: string;
  locale: string;
  plan: string;
  status: string;
  account?: {
    status: string;
    trialEndsAt: string | null;
    contractEndDate: string | null;
  } | null;
}): TenantContext {
  return {
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    currency: restaurant.currency,
    locale: restaurant.locale,
    plan: restaurant.plan,
    status: restaurant.status,
    accountStatus: restaurant.account?.status ?? null,
    accountTrialEndsAt: restaurant.account?.trialEndsAt ?? null,
    accountContractEndDate: restaurant.account?.contractEndDate ?? null,
  };
}

export async function resolveTenant(slug: string): Promise<TenantContext | null> {
  const cached = tenantCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return isTenantActive(cached.data) ? cached.data : null;
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
      account: {
        select: {
          status: true,
          trialEndsAt: true,
          contractEndDate: true,
        },
      },
    },
  });

  if (!restaurant) return null;
  const context = toContext(restaurant);
  if (!isTenantActive(context)) {
    tenantCache.delete(slug);
    return null;
  }

  tenantCache.set(slug, { data: context, expiresAt: Date.now() + CACHE_TTL });
  return context;
}

let defaultTenantCache: { data: TenantContext; expiresAt: number } | null = null;

export async function resolveDefaultTenant(): Promise<TenantContext | null> {
  if (defaultTenantCache && defaultTenantCache.expiresAt > Date.now()) {
    return isTenantActive(defaultTenantCache.data) ? defaultTenantCache.data : null;
  }

  const restaurant = await db.restaurant.findFirst({
    where: { status: { in: ['active', 'trial'] } },
    select: {
      id: true,
      slug: true,
      name: true,
      currency: true,
      locale: true,
      plan: true,
      status: true,
      account: {
        select: {
          status: true,
          trialEndsAt: true,
          contractEndDate: true,
        },
      },
    },
  });

  if (!restaurant) return null;
  const context = toContext(restaurant);
  if (!isTenantActive(context)) return null;
  defaultTenantCache = { data: context, expiresAt: Date.now() + CACHE_TTL };
  return context;
}

export async function resolveTenantFromRequest(request: Request): Promise<TenantContext | null> {
  const slug = extractSlug(request);
  if (slug) return resolveTenant(slug);

  const isProduction = process.env.NODE_ENV === 'production';
  const allowDefault = process.env.ALLOW_DEFAULT_TENANT === 'true';
  if (isProduction && !allowDefault) return null;
  return resolveDefaultTenant();
}

export async function getRestaurantId(request: Request): Promise<string | null> {
  const tenant = await resolveTenantFromRequest(request);
  return tenant?.restaurantId || null;
}

export function isFeatureEnabled(tenant: TenantContext, feature: string): boolean {
  if (!isTenantActive(tenant)) return false;
  const planFeatures: Record<string, string[]> = {
    free: ['delivery', 'reservations', 'reviews', 'pos'],
    starter: ['delivery', 'reservations', 'reviews', 'pos', 'loyalty', 'invoices'],
    pro: ['delivery', 'reservations', 'reviews', 'pos', 'loyalty', 'invoices', 'quotes', 'expenses', 'staff', 'drivers'],
    enterprise: ['delivery', 'reservations', 'reviews', 'pos', 'loyalty', 'invoices', 'quotes', 'expenses', 'staff', 'drivers', 'custom_domain', 'api_access', 'white_label'],
  };
  return (planFeatures[tenant.plan] || planFeatures.free).includes(feature);
}

export function invalidateTenantCache(slug?: string): void {
  if (slug) tenantCache.delete(slug);
  else tenantCache.clear();
  defaultTenantCache = null;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

export async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  while (await db.restaurant.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return slug;
}
