import { PrismaClient } from '@prisma/client'

// Ensure DATABASE_URL is correctly set for SQLite
// The URL MUST start with "file:" for Prisma SQLite
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = 'file:./data/kfm-delice.db'
  console.log('[db] DATABASE_URL was missing or invalid, defaulting to: file:./data/kfm-delice.db')
} else {
  console.log('[db] DATABASE_URL:', process.env.DATABASE_URL)
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  schemaFixed: boolean | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// ─── Synchronous schema fix: add missing columns ────────────────────
// This runs once when the PrismaClient is first created.
// Uses a dbReady promise so API routes can await schema readiness.
let dbReadyResolve!: () => void
export const dbReady = new Promise<void>((resolve) => { dbReadyResolve = resolve })

if (!globalForPrisma.schemaFixed) {
  globalForPrisma.schemaFixed = true;
  const missingColumns: [string, string, string][] = [
    ['Admin', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT 0'],
    ['Customer', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT 0'],
    ['Driver', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT 0'],
    ['Driver', 'lat', 'REAL NOT NULL DEFAULT 0'],
    ['Driver', 'lng', 'REAL NOT NULL DEFAULT 0'],
    ['Driver', 'lastLocationUpdate', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'],
    ['Driver', 'currentOrderId', "TEXT NOT NULL DEFAULT ''"],
    ['Driver', 'email', "TEXT NOT NULL DEFAULT ''"],
    ['Driver', 'password', "TEXT NOT NULL DEFAULT ''"],
    ['Invoice', 'orderId', "TEXT DEFAULT ''"],
    ['Order', 'driverLat', 'REAL NOT NULL DEFAULT 0'],
    ['Order', 'driverLng', 'REAL NOT NULL DEFAULT 0'],
    ['Order', 'estimatedDeliveryTime', "TEXT NOT NULL DEFAULT ''"],
    ['Order', 'note', "TEXT NOT NULL DEFAULT ''"],
    ['Order', 'tax', 'INTEGER NOT NULL DEFAULT 0'],
    ['Order', 'discount', 'INTEGER NOT NULL DEFAULT 0'],
    ['Order', 'deliveryFee', 'INTEGER NOT NULL DEFAULT 0'],
    ['Order', 'tableNumber', 'INTEGER NOT NULL DEFAULT 0'],
    ['Order', 'deliveryAddress', "TEXT NOT NULL DEFAULT ''"],
    ['Order', 'paymentMethod', "TEXT NOT NULL DEFAULT 'cash'"],
    ['Order', 'paymentStatus', "TEXT NOT NULL DEFAULT 'pending'"],
    ['Order', 'customerId', 'TEXT'],
    ['Order', 'driverId', 'TEXT'],
    ['Reservation', 'loyaltyPoint', 'INTEGER NOT NULL DEFAULT 50'],
    ['Reservation', 'customerId', 'TEXT'],
    ['Restaurant', 'plan', "TEXT NOT NULL DEFAULT 'free'"],
    ['Restaurant', 'status', "TEXT NOT NULL DEFAULT 'active'"],
    ['Restaurant', 'trialEndsAt', "TEXT NOT NULL DEFAULT ''"],
    ['Restaurant', 'currency', "TEXT NOT NULL DEFAULT 'GNF'"],
    ['Restaurant', 'locale', "TEXT NOT NULL DEFAULT 'fr'"],
    ['Restaurant', 'ownerEmail', "TEXT NOT NULL DEFAULT ''"],
    ['Restaurant', 'ownerName', "TEXT NOT NULL DEFAULT ''"],
    ['Restaurant', 'ownerPhone', "TEXT NOT NULL DEFAULT ''"],
    ['Customer', 'loyaltyPoints', 'INTEGER NOT NULL DEFAULT 0'],
    ['Customer', 'totalOrders', 'INTEGER NOT NULL DEFAULT 0'],
    ['Customer', 'totalSpent', 'INTEGER NOT NULL DEFAULT 0'],
    ['Customer', 'address', "TEXT NOT NULL DEFAULT ''"],
    ['Customer', 'phone', "TEXT NOT NULL DEFAULT ''"],
    ['Review', 'customerId', 'TEXT'],
    ['MenuItem', 'badge', "TEXT NOT NULL DEFAULT ''"],
    ['MenuItem', 'popular', 'BOOLEAN NOT NULL DEFAULT 0'],
    ['MenuItem', 'available', 'BOOLEAN NOT NULL DEFAULT 1'],
    ['Payment', 'transactionRef', "TEXT NOT NULL DEFAULT ''"],
    ['Payment', 'phone', "TEXT NOT NULL DEFAULT ''"],
    ['Payment', 'customerName', "TEXT NOT NULL DEFAULT ''"],
    ['Payment', 'metadata', "TEXT NOT NULL DEFAULT '{}'"],
    ['Payment', 'paidAt', "TEXT NOT NULL DEFAULT ''"],
    ['Payment', 'failedReason', "TEXT NOT NULL DEFAULT ''"],
  ];

  // Run all schema fixes sequentially, then resolve dbReady
  (async () => {
    for (const [table, column, def] of missingColumns) {
      try {
        await db.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('duplicate column') && !msg.includes('already exists') && !msg.includes('no such table')) {
          console.warn(`[db:fix] Could not add ${table}.${column}: ${msg}`);
        }
      }
    }
    console.log('[db:fix] Schema fix complete');
    dbReadyResolve();
  })();
} else {
  // Already fixed in a previous invocation
  dbReadyResolve();
}

// ─── BigInt-safe JSON serialization helper ────────────────────────
// Prisma SQLite raw queries return BigInt for COUNT(*) and INTEGER columns.
// JSON.stringify can't serialize BigInt, so we need to convert them.
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
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT id, slug, name, description, logo, bannerImage, currency, locale, plan, status
      FROM Restaurant
      WHERE status = 'active'
      ORDER BY name ASC
    `);
    return bigIntToNumber(rows) as Array<{
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
    }>;
  } catch (e) {
    console.error('[db] listRestaurants error:', e);
    return [];
  }
}
