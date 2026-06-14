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

// ─── One-time schema fix: add missing columns ────────────────────
// This runs once when the PrismaClient is first created.
// It ensures all required columns exist, fixing the common issue where
// prisma db push doesn't add all columns (especially on Render free plan).
if (!globalForPrisma.schemaFixed) {
  globalForPrisma.schemaFixed = true;
  const missingColumns: [string, string, string][] = [
    // [table, column, column_definition]
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
  ];

  // Run asynchronously — don't block the first request
  (async () => {
    try {
      for (const [table, column, def] of missingColumns) {
        try {
          await db.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
          console.log(`[db:fix] ✓ Added ${table}.${column}`);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('duplicate column') || msg.includes('already exists')) {
            // Column already exists — that's fine
          } else {
            console.warn(`[db:fix] Could not add ${table}.${column}: ${msg}`);
          }
        }
      }
      console.log('[db:fix] Schema fix complete');
    } catch (e) {
      console.error('[db:fix] Schema fix error:', e);
    }
  })();
}
