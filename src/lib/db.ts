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
// SYNCHRONOUS — must complete before any API route uses the client.
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
  ];

  // Run synchronously — block until all columns are added
  for (const [table, column, def] of missingColumns) {
    try {
      db.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
        .then(() => console.log(`[db:fix] ✓ Added ${table}.${column}`))
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
            console.warn(`[db:fix] Could not add ${table}.${column}: ${msg}`);
          }
        });
    } catch (e) {
      // Ignore
    }
  }
  console.log('[db:fix] Schema fix queued');
}
