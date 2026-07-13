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
    console.log(`[db] Database provider: ${dbProvider}`);
  } else {
    console.log(`[db] Database provider: ${dbProvider} (DATABASE_URL=${finalDatabaseUrl})`);
  }
}

// Compute provider for schema-fix branching (server-only)
const _finalDatabaseUrl = process.env.DATABASE_URL || '';
const dbProvider =
  _finalDatabaseUrl.startsWith('postgresql://') || _finalDatabaseUrl.startsWith('postgres://')
    ? 'postgres'
    : 'sqlite';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  schemaFixed: boolean | undefined
}

// Only instantiate PrismaClient on the server. On the client, export a
// proxy that throws if accessed (so client code that accidentally uses
// `db` fails clearly instead of crashing at import time).
//
// Why: db.ts is imported transitively by client components via
// constants.ts. PrismaClient cannot run in the browser (it needs Node.js
// crypto + a TCP connection to the DB), so we must not instantiate it
// on the client.
export const db = isServer
  ? (globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
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

// ─── Synchronous schema fix: add missing columns ────────────────────
// This runs once when the PrismaClient is first created.
// Uses a dbReady promise so API routes can await schema readiness.
let dbReadyResolve!: () => void
export const dbReady = new Promise<void>((resolve) => { dbReadyResolve = resolve })

if (isServer && !globalForPrisma.schemaFixed) {
  globalForPrisma.schemaFixed = true;

  // ─── PostgreSQL schema patch (safety net) ──────────────────────
  // On PostgreSQL, we ALSO run a safety net here (in addition to the
  // ensure-postgres-columns.cjs script in render-start.sh). This ensures
  // critical columns exist even if the shell script fails or is skipped.
  //
  // Uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS (PostgreSQL 9.6+).
  // Only ADDS columns — never drops or modifies existing ones.
  if (dbProvider !== 'sqlite') {
    const pgColumns: [string, string, string][] = [
      // Admin (init migration was missing restaurantId + mustChangePassword)
      ['Admin', 'restaurantId', "TEXT NOT NULL DEFAULT ''"],
      ['Admin', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT false'],
      // Customer (same issue)
      ['Customer', 'restaurantId', "TEXT NOT NULL DEFAULT ''"],
      ['Customer', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT false'],
      ['Customer', 'loyaltyPoints', 'INTEGER NOT NULL DEFAULT 0'],
      ['Customer', 'totalOrders', 'INTEGER NOT NULL DEFAULT 0'],
      ['Customer', 'totalSpent', 'BIGINT NOT NULL DEFAULT 0'],
      ['Customer', 'address', "TEXT NOT NULL DEFAULT ''"],
      ['Customer', 'phone', "TEXT NOT NULL DEFAULT ''"],
      // Driver (missing restaurantId + earnings + password flag)
      ['Driver', 'restaurantId', "TEXT NOT NULL DEFAULT ''"],
      ['Driver', 'commissionRate', 'DOUBLE PRECISION NOT NULL DEFAULT 10'],
      ['Driver', 'totalEarnings', 'BIGINT NOT NULL DEFAULT 0'],
      ['Driver', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT false'],
      ['Driver', 'lat', 'DOUBLE PRECISION NOT NULL DEFAULT 0'],
      ['Driver', 'lng', 'DOUBLE PRECISION NOT NULL DEFAULT 0'],
      ['Driver', 'currentOrderId', "TEXT NOT NULL DEFAULT ''"],
      ['Driver', 'email', "TEXT NOT NULL DEFAULT ''"],
      ['Driver', 'password', "TEXT NOT NULL DEFAULT ''"],
      // Order (missing driverEarning + other fields)
      ['Order', 'driverEarning', 'BIGINT NOT NULL DEFAULT 0'],
      ['Order', 'driverLat', 'DOUBLE PRECISION NOT NULL DEFAULT 0'],
      ['Order', 'driverLng', 'DOUBLE PRECISION NOT NULL DEFAULT 0'],
      ['Order', 'estimatedDeliveryTime', "TEXT NOT NULL DEFAULT ''"],
      ['Order', 'note', "TEXT NOT NULL DEFAULT ''"],
      ['Order', 'tax', 'BIGINT NOT NULL DEFAULT 0'],
      ['Order', 'discount', 'BIGINT NOT NULL DEFAULT 0'],
      ['Order', 'deliveryFee', 'BIGINT NOT NULL DEFAULT 0'],
      ['Order', 'tableNumber', 'INTEGER NOT NULL DEFAULT 0'],
      ['Order', 'deliveryAddress', "TEXT NOT NULL DEFAULT ''"],
      ['Order', 'paymentMethod', "TEXT NOT NULL DEFAULT 'cash'"],
      ['Order', 'paymentStatus', "TEXT NOT NULL DEFAULT 'pending'"],
      ['Order', 'customerId', 'TEXT'],
      ['Order', 'driverId', 'TEXT'],
      // Restaurant (init migration was missing SaaS fields)
      ['Restaurant', 'plan', "TEXT NOT NULL DEFAULT 'free'"],
      ['Restaurant', 'status', "TEXT NOT NULL DEFAULT 'active'"],
      ['Restaurant', 'trialEndsAt', "TEXT NOT NULL DEFAULT ''"],
      ['Restaurant', 'currency', "TEXT NOT NULL DEFAULT 'GNF'"],
      ['Restaurant', 'locale', "TEXT NOT NULL DEFAULT 'fr'"],
      ['Restaurant', 'ownerEmail', "TEXT NOT NULL DEFAULT ''"],
      ['Restaurant', 'ownerName', "TEXT NOT NULL DEFAULT ''"],
      ['Restaurant', 'ownerPhone', "TEXT NOT NULL DEFAULT ''"],
      ['Restaurant', 'whatsapp', "TEXT NOT NULL DEFAULT ''"],
      // MenuItem (missing badge, popular, available)
      ['MenuItem', 'badge', "TEXT NOT NULL DEFAULT ''"],
      ['MenuItem', 'popular', 'BOOLEAN NOT NULL DEFAULT false'],
      ['MenuItem', 'available', 'BOOLEAN NOT NULL DEFAULT true'],
      // Reservation (missing loyaltyPoint + customerId)
      ['Reservation', 'loyaltyPoint', 'INTEGER NOT NULL DEFAULT 50'],
      ['Reservation', 'customerId', 'TEXT'],
      // Review (missing customerId)
      ['Review', 'customerId', 'TEXT'],
      // Invoice (missing orderId)
      ['Invoice', 'orderId', "TEXT DEFAULT ''"],
      // Payment (missing fields)
      ['Payment', 'transactionRef', "TEXT NOT NULL DEFAULT ''"],
      ['Payment', 'phone', "TEXT NOT NULL DEFAULT ''"],
      ['Payment', 'customerName', "TEXT NOT NULL DEFAULT ''"],
      ['Payment', 'metadata', "TEXT NOT NULL DEFAULT '{}'"],
      ['Payment', 'paidAt', "TEXT NOT NULL DEFAULT ''"],
      ['Payment', 'failedReason', "TEXT NOT NULL DEFAULT ''"],
      // ── SaaS Account fields ──
      ['Restaurant', 'accountId', 'TEXT'],
      ['Restaurant', 'parentRestaurantId', 'TEXT'],
      ['Restaurant', 'type', "TEXT NOT NULL DEFAULT 'principal'"],
      ['Restaurant', 'createdByAdminId', 'TEXT'],
      ['Admin', 'accountId', 'TEXT'],
      ['Admin', 'canCreateRestaurant', 'BOOLEAN NOT NULL DEFAULT false'],
      ['Admin', 'restaurantCreationLimit', 'INTEGER NOT NULL DEFAULT 0'],
      ['Admin', 'restaurantsCreatedCount', 'INTEGER NOT NULL DEFAULT 0'],
      // ── Mission 11: Order.tableId + Order.tableNumberStr ──
      ['Order', 'tableId', 'TEXT'],
      ['Order', 'tableNumberStr', "TEXT NOT NULL DEFAULT ''"],
      // ── Mission P2.5: Order.tip (pourboire) ──
      ['Order', 'tip', 'BIGINT NOT NULL DEFAULT 0'],
    ];

    (async () => {
      try {
        for (const [table, column, def] of pgColumns) {
          try {
            await db.$executeRawUnsafe(
              `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${def}`
            );
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (!msg.includes('already exists') && !msg.includes('does not exist')) {
              console.warn(`[db:pg-fix] Could not add ${table}.${column}: ${msg}`);
            }
          }
        }

        // ── Fix: link existing Admin records to the first Restaurant ──
        try {
          await db.$executeRawUnsafe(`
            UPDATE "Admin" SET "restaurantId" = (
              SELECT "id" FROM "Restaurant" LIMIT 1
            )
            WHERE "restaurantId" = '' OR "restaurantId" IS NULL
          `);
          console.log('[db:pg-fix] Linked orphan admins to first restaurant');
        } catch (e: unknown) {
          // Non-fatal — might fail if Restaurant table is empty
        }

        // Same for Customer and Driver
        try {
          await db.$executeRawUnsafe(`
            UPDATE "Customer" SET "restaurantId" = (
              SELECT "id" FROM "Restaurant" LIMIT 1
            )
            WHERE "restaurantId" = '' OR "restaurantId" IS NULL
          `);
        } catch {}

        try {
          await db.$executeRawUnsafe(`
            UPDATE "Driver" SET "restaurantId" = (
              SELECT "id" FROM "Restaurant" LIMIT 1
            )
            WHERE "restaurantId" = '' OR "restaurantId" IS NULL
          `);
        } catch {}

        // ── Create Account and AuditLog tables if they don't exist ──
        try {
          await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Account" (
            "id" TEXT NOT NULL, "name" TEXT NOT NULL,
            "ownerName" TEXT NOT NULL DEFAULT '', "ownerEmail" TEXT NOT NULL DEFAULT '',
            "ownerPhone" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'active',
            "plan" TEXT NOT NULL DEFAULT 'starter',
            "maxRestaurants" INTEGER NOT NULL DEFAULT 1,
            "maxSecondaryRestaurants" INTEGER NOT NULL DEFAULT 0,
            "maxAdmins" INTEGER NOT NULL DEFAULT 3, "maxUsers" INTEGER NOT NULL DEFAULT 10,
            "maxOrdersPerMonth" INTEGER NOT NULL DEFAULT 1000,
            "contractStartDate" TEXT NOT NULL DEFAULT '', "contractEndDate" TEXT NOT NULL DEFAULT '',
            "trialEndsAt" TEXT NOT NULL DEFAULT '',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
          )`);
        } catch {}

        try {
          await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "AuditLog" (
            "id" TEXT NOT NULL, "actorId" TEXT NOT NULL, "actorType" TEXT NOT NULL,
            "action" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL,
            "accountId" TEXT, "restaurantId" TEXT,
            "before" JSONB, "after" JSONB,
            "ipAddress" TEXT NOT NULL DEFAULT '', "userAgent" TEXT NOT NULL DEFAULT '',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
          )`);
        } catch {}

        // ── Mission 11: Create RestaurantTable table if missing (PostgreSQL) ──
        try {
          await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "RestaurantTable" (
            "id" TEXT NOT NULL,
            "restaurantId" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "number" TEXT NOT NULL,
            "capacity" INTEGER NOT NULL DEFAULT 4,
            "zone" TEXT NOT NULL DEFAULT '',
            "status" TEXT NOT NULL DEFAULT 'available',
            "active" BOOLEAN NOT NULL DEFAULT true,
            "qrToken" TEXT NOT NULL,
            "qrVersion" INTEGER NOT NULL DEFAULT 1,
            "qrEnabled" BOOLEAN NOT NULL DEFAULT true,
            "qrGeneratedAt" TIMESTAMP(3),
            "lastScannedAt" TIMESTAMP(3),
            "scanCount" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
          )`);
          await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_qrToken_key" ON "RestaurantTable"("qrToken")`);
          await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_number_key" ON "RestaurantTable"("restaurantId", "number")`);
          await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_idx" ON "RestaurantTable"("restaurantId")`);
          await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_active_idx" ON "RestaurantTable"("restaurantId", "active")`);
          // FK (idempotent — wrap in try/catch)
          try {
            await db.$executeRawUnsafe(`ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE`);
          } catch {}
          try {
            await db.$executeRawUnsafe(`ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL`);
          } catch {}
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes('already exists')) {
            console.warn(`[db:pg-fix] Could not create RestaurantTable: ${msg}`);
          }
        }

        // ── Mission P2.6: Create PromoCode table if missing (PostgreSQL) ──
        try {
          await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PromoCode" (
            "id" TEXT NOT NULL,
            "code" TEXT NOT NULL,
            "description" TEXT NOT NULL DEFAULT '',
            "discountType" TEXT NOT NULL DEFAULT 'percent',
            "discountValue" BIGINT NOT NULL DEFAULT 0,
            "minOrderTotal" BIGINT NOT NULL DEFAULT 0,
            "maxUses" INTEGER NOT NULL DEFAULT 0,
            "usedCount" INTEGER NOT NULL DEFAULT 0,
            "maxUsesPerUser" INTEGER NOT NULL DEFAULT 1,
            "active" BOOLEAN NOT NULL DEFAULT true,
            "startsAt" TIMESTAMP(3),
            "expiresAt" TIMESTAMP(3),
            "restaurantId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
          )`);
          await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PromoCode_restaurantId_code_key" ON "PromoCode"("restaurantId", "code")`);
          await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromoCode_restaurantId_active_idx" ON "PromoCode"("restaurantId", "active")`);
          await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromoCode_code_idx" ON "PromoCode"("code")`);
          try {
            await db.$executeRawUnsafe(`ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE`);
          } catch {}
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes('already exists')) {
            console.warn(`[db:pg-fix] Could not create PromoCode: ${msg}`);
          }
        }

        // ── Mission P3.7: Create ChatMessage table if missing (PostgreSQL) ──
        try {
          await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ChatMessage" (
            "id" TEXT NOT NULL,
            "restaurantId" TEXT NOT NULL,
            "senderId" TEXT NOT NULL,
            "senderName" TEXT NOT NULL,
            "senderRole" TEXT NOT NULL,
            "content" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
          )`);
          await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ChatMessage_restaurantId_createdAt_idx" ON "ChatMessage"("restaurantId", "createdAt")`);
          await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ChatMessage_restaurantId_idx" ON "ChatMessage"("restaurantId")`);
          try {
            await db.$executeRawUnsafe(`ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE`);
          } catch {}
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes('already exists')) {
            console.warn(`[db:pg-fix] Could not create ChatMessage: ${msg}`);
          }
        }

        // ── Mission P3.8: Create LoyaltyTier table + Customer.tier column (PostgreSQL) ──
        try {
          await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "LoyaltyTier" (
            "id" TEXT NOT NULL,
            "restaurantId" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "label" TEXT NOT NULL DEFAULT '',
            "minSpent" BIGINT NOT NULL DEFAULT 0,
            "discountPercent" INTEGER NOT NULL DEFAULT 0,
            "freeDelivery" BOOLEAN NOT NULL DEFAULT false,
            "freeDish" BOOLEAN NOT NULL DEFAULT false,
            "color" TEXT NOT NULL DEFAULT '#cd7f32',
            "icon" TEXT NOT NULL DEFAULT '',
            "active" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
          )`);
          await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyTier_restaurantId_name_key" ON "LoyaltyTier"("restaurantId", "name")`);
          await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LoyaltyTier_restaurantId_active_idx" ON "LoyaltyTier"("restaurantId", "active")`);
          try {
            await db.$executeRawUnsafe(`ALTER TABLE "LoyaltyTier" ADD CONSTRAINT "LoyaltyTier_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE`);
          } catch {}
          // Add tier column to Customer
          try {
            await db.$executeRawUnsafe(`ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'bronze'`);
          } catch {}
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes('already exists')) {
            console.warn(`[db:pg-fix] Could not create LoyaltyTier: ${msg}`);
          }
        }

        console.log('[db:pg-fix] PostgreSQL safety-net schema check complete');
      } catch (outerError) {
        console.error('[db:pg-fix] FATAL error in safety net:', outerError);
      } finally {
        // ALWAYS resolve dbReady, even if the safety net failed.
        // Without this, all API routes would hang forever on `await dbReady`.
        dbReadyResolve();
      }
    })();
  } else {
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
    // ── Mission 11: Order.tableId + Order.tableNumberStr (SQLite) ──
    // Note: 'Order' is a reserved keyword in SQLite — must be quoted.
    ['Order', 'tableId', 'TEXT'],
    ['Order', 'tableNumberStr', "TEXT NOT NULL DEFAULT ''"],
    // ── Mission P2.5: Order.tip (pourboire) ──
    ['Order', 'tip', 'INTEGER NOT NULL DEFAULT 0'],
    // ── Mission P3.8: Customer.tier (loyalty tier) ──
    ['Customer', 'tier', "TEXT NOT NULL DEFAULT 'bronze'"],
  ];

  // Run all schema fixes sequentially, then resolve dbReady
  (async () => {
    for (const [table, column, def] of missingColumns) {
      try {
        // Quote the table name — 'Order' is reserved in SQL.
        // Other tables (Admin, Customer, etc.) work fine either way.
        const quotedTable = table === 'Order' ? `"${table}"` : table;
        await db.$executeRawUnsafe(`ALTER TABLE ${quotedTable} ADD COLUMN ${column} ${def}`)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('duplicate column') && !msg.includes('already exists') && !msg.includes('no such table')) {
          console.warn(`[db:fix] Could not add ${table}.${column}: ${msg}`);
        }
      }
    }

    // ── Mission 11: Create RestaurantTable table if missing (SQLite) ──
    try {
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "RestaurantTable" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "restaurantId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "number" TEXT NOT NULL,
        "capacity" INTEGER NOT NULL DEFAULT 4,
        "zone" TEXT NOT NULL DEFAULT '',
        "status" TEXT NOT NULL DEFAULT 'available',
        "active" BOOLEAN NOT NULL DEFAULT 1,
        "qrToken" TEXT NOT NULL,
        "qrVersion" INTEGER NOT NULL DEFAULT 1,
        "qrEnabled" BOOLEAN NOT NULL DEFAULT 1,
        "qrGeneratedAt" DATETIME,
        "lastScannedAt" DATETIME,
        "scanCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_qrToken_key" ON "RestaurantTable"("qrToken")`);
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_number_key" ON "RestaurantTable"("restaurantId", "number")`);
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_idx" ON "RestaurantTable"("restaurantId")`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('already exists')) {
        console.warn(`[db:fix] Could not create RestaurantTable: ${msg}`);
      }
    }

    // ── Mission P2.6: Create PromoCode table if missing (SQLite) ──
    try {
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PromoCode" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "code" TEXT NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "discountType" TEXT NOT NULL DEFAULT 'percent',
        "discountValue" INTEGER NOT NULL DEFAULT 0,
        "minOrderTotal" INTEGER NOT NULL DEFAULT 0,
        "maxUses" INTEGER NOT NULL DEFAULT 0,
        "usedCount" INTEGER NOT NULL DEFAULT 0,
        "maxUsesPerUser" INTEGER NOT NULL DEFAULT 1,
        "active" BOOLEAN NOT NULL DEFAULT 1,
        "startsAt" DATETIME,
        "expiresAt" DATETIME,
        "restaurantId" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PromoCode_restaurantId_code_key" ON "PromoCode"("restaurantId", "code")`);
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromoCode_restaurantId_active_idx" ON "PromoCode"("restaurantId", "active")`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('already exists')) {
        console.warn(`[db:fix] Could not create PromoCode: ${msg}`);
      }
    }

    // ── Mission P3.7: Create ChatMessage table if missing (SQLite) ──
    try {
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ChatMessage" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "restaurantId" TEXT NOT NULL,
        "senderId" TEXT NOT NULL,
        "senderName" TEXT NOT NULL,
        "senderRole" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ChatMessage_restaurantId_createdAt_idx" ON "ChatMessage"("restaurantId", "createdAt")`);
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ChatMessage_restaurantId_idx" ON "ChatMessage"("restaurantId")`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('already exists')) {
        console.warn(`[db:fix] Could not create ChatMessage: ${msg}`);
      }
    }

    // ── Mission P3.8: Create LoyaltyTier table if missing (SQLite) ──
    try {
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "LoyaltyTier" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "restaurantId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "label" TEXT NOT NULL DEFAULT '',
        "minSpent" INTEGER NOT NULL DEFAULT 0,
        "discountPercent" INTEGER NOT NULL DEFAULT 0,
        "freeDelivery" BOOLEAN NOT NULL DEFAULT 0,
        "freeDish" BOOLEAN NOT NULL DEFAULT 0,
        "color" TEXT NOT NULL DEFAULT '#cd7f32',
        "icon" TEXT NOT NULL DEFAULT '',
        "active" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyTier_restaurantId_name_key" ON "LoyaltyTier"("restaurantId", "name")`);
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LoyaltyTier_restaurantId_active_idx" ON "LoyaltyTier"("restaurantId", "active")`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('already exists')) {
        console.warn(`[db:fix] Could not create LoyaltyTier: ${msg}`);
      }
    }

    console.log('[db:fix] Schema fix complete');
    dbReadyResolve();
  })();
  } // end SQLite-only branch
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
//
// Uses the Prisma client (not raw SQL) so column/table quoting is handled
// correctly on both SQLite and PostgreSQL. Raw SQL like `FROM Restaurant`
// would fail on PostgreSQL because unquoted identifiers are folded to
// lowercase, but Prisma creates tables as `"Restaurant"` (quoted).
//
// Note: `logo` and `bannerImage` come from the related RestaurantConfig
// (where the field is `heroImage`), not from Restaurant itself.
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
