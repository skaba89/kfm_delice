import { logger } from "@/lib/logger";
import { PrismaClient } from '@prisma/client'

// ─── Database URL resolution ───────────────────────────────────────
// Accepts:
//   - file:           → SQLite (local dev)
//   - postgresql://   → PostgreSQL (Render/production)
//   - postgres://     → PostgreSQL (Render/production)
//
// Rules:
//   - In production, DATABASE_URL is REQUIRED. If missing or invalid, throw.
//   - In development only, fall back to a local SQLite file with a warning.
//   - NEVER override a valid PostgreSQL URL with a SQLite URL.
//   - Never log the full DATABASE_URL in production (it contains credentials).
//
// IMPORTANT: This module is imported transitively by client-side code
// (constants.ts → MenuSection.tsx, DriverDashboard.tsx, etc.). We must
// NOT throw at module-load time on the client, because the browser
// doesn't have DATABASE_URL and PrismaClient can't run in the browser.
// All validation is guarded with `typeof window === 'undefined'`.
//
// Mission 2 (Phase 3): This module NO LONGER runs any DDL at runtime.
// All schema changes MUST go through `prisma migrate deploy`. The
// previous safety-net (ALTER TABLE / CREATE TABLE / $executeRawUnsafe)
// has been removed — it was hiding missing migrations and could mask
// data corruption.

const isProduction = process.env.NODE_ENV === 'production';
const isServer = typeof window === 'undefined';

if (isServer) {
  if (!process.env.DATABASE_URL) {
    if (isProduction) {
      throw new Error(
        '[db] FATAL: DATABASE_URL is required in production. ' +
        'Set it to a valid postgresql:// URL (Render → Environment tab).'
      );
    }
    // Dev-only fallback to local SQLite
    process.env.DATABASE_URL = 'file:./data/kfm-delice.db';
    console.warn(
      '[db] DATABASE_URL was missing — defaulting to local SQLite: file:./data/kfm-delice.db. ' +
      'Set DATABASE_URL (postgresql:// or postgres://) for production.'
    );
  }

  const finalDatabaseUrl = process.env.DATABASE_URL || '';
  const isValidDatabaseUrl =
    finalDatabaseUrl.startsWith('file:') ||
    finalDatabaseUrl.startsWith('postgresql://') ||
    finalDatabaseUrl.startsWith('postgres://');

  if (!isValidDatabaseUrl) {
    throw new Error(
      '[db] FATAL: Invalid DATABASE_URL. Expected a URL starting with "file:", "postgresql://" or "postgres://". ' +
      'Refusing to start to avoid silent data corruption.'
    );
  }

  // Log only the provider, never the full URL (which may contain credentials).
  const dbProvider =
    finalDatabaseUrl.startsWith('postgresql://') || finalDatabaseUrl.startsWith('postgres://')
      ? 'postgres'
      : 'sqlite';
  if (isProduction) {
    logger.debug(`[db] Database provider: ${dbProvider}`);
  } else {
    logger.debug(`[db] Database provider: ${dbProvider} (DATABASE_URL=${finalDatabaseUrl})`);
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Credential-bearing fields are excluded from all normal Prisma results.
// Authentication paths that genuinely need one of these values must request it
// explicitly with select/omit override. This prevents an eager relation include
// from accidentally serializing password hashes or platform 2FA recovery data.
const sensitiveFieldOmit = {
  admin: { password: true },
  customer: { password: true },
  driver: { password: true },
  platformAdmin: {
    password: true,
    twoFactorSecret: true,
    twoFactorBackupCodes: true,
  },
} as const;

// Only instantiate PrismaClient on the server. On the client, export a
// proxy that throws if accessed (so client code that accidentally uses
// `db` fails clearly instead of crashing at import time).
export const db = isServer
  ? (globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
        omit: sensitiveFieldOmit,
      }))
  : (new Proxy(
      {},
      {
        get() {
          throw new Error('[db] PrismaClient cannot be used in the browser.');
        },
      }
    ) as PrismaClient);

if (isServer && process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// ─── dbReady: resolves immediately (no DDL to wait for) ────────────
// Previously this waited for the runtime schema-fix to complete.
// Now that we don't run DDL at runtime, dbReady resolves instantly.
// Kept for backwards compatibility with API routes that `await dbReady`.
export const dbReady = Promise.resolve();

// ─── BigInt serialization helper ───────────────────────────────────
// PostgreSQL returns BigInt for BigInt columns; JSON.stringify throws
// on BigInt. This recursively converts BigInt → Number for API responses.
export function bigIntToNumber(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(bigIntToNumber);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = bigIntToNumber(value);
    }
    return result;
  }
  return obj;
}

// ─── Database health check ─────────────────────────────────────────
// Returns ok=true if a trivial DB query succeeds, with latency in ms.
export async function testDatabaseConnection(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const t0 = Date.now();
  try {
    await db.$queryRawUnsafe('SELECT 1');
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, latencyMs: Date.now() - t0, error: msg };
  }
}

// ─── Public restaurant listing (multi-tenant SaaS) ────────────────
// Returns minimal info for all active restaurants, for platform landing
// pages and public restaurant directories.
export async function listRestaurants(): Promise<
  Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    logo: string | null;
    bannerImage: string | null;
    currency: string;
    locale: string;
    plan: string;
    status: string;
  }>
> {
  try {
    const restaurants = await db.restaurant.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        currency: true,
        locale: true,
        plan: true,
        status: true,
        config: { select: { logo: true, heroImage: true } },
      },
      orderBy: { name: 'asc' },
    });
    return restaurants.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description || null,
      logo: r.config?.logo || null,
      bannerImage: r.config?.heroImage || null,
      currency: r.currency,
      locale: r.locale,
      plan: r.plan,
      status: r.status,
    }));
  } catch (e) {
    console.error('[db] listRestaurants error:', e);
    return [];
  }
}
