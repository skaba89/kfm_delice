-- Migration: Add missing tables that were in schema.prisma but NOT in
-- the initial migration (00000000000000_init).
--
-- Without this migration, prisma migrate deploy on a fresh PostgreSQL
-- database would create only 15 of the 20 tables defined in the schema.
-- The 5 missing tables are:
--   - PlatformAdmin       (used by /api/platform-login)
--   - RestaurantConfig    (used by /api/restaurant, getRestaurantConfig)
--   - PushSubscription    (used by /api/push, /api/push/send)
--   - StockItem           (used by /api/stock)
--   - StockMovement       (used by /api/stock)
--
-- This migration is IDEMPOTENT (uses IF NOT EXISTS) so it's safe to run
-- on databases that already have some of these tables.

-- CreateTable: PlatformAdmin
CREATE TABLE IF NOT EXISTS "PlatformAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'super_admin',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAdmin_email_key" ON "PlatformAdmin"("email");
CREATE INDEX IF NOT EXISTS "PlatformAdmin_email_idx" ON "PlatformAdmin"("email");

-- CreateTable: RestaurantConfig
CREATE TABLE IF NOT EXISTS "RestaurantConfig" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "logo" TEXT NOT NULL DEFAULT '',
    "heroImage" TEXT NOT NULL DEFAULT '',
    "primaryColor" TEXT NOT NULL DEFAULT '#ea580c',
    "accentColor" TEXT NOT NULL DEFAULT '#f97316',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "menuCategories" JSONB NOT NULL DEFAULT '[]',
    "features" JSONB NOT NULL DEFAULT '{}',
    "openingHours" JSONB NOT NULL DEFAULT '{}',
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "customDomain" TEXT NOT NULL DEFAULT '',
    "metaTitle" TEXT NOT NULL DEFAULT '',
    "metaDescription" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantConfig_restaurantId_key" ON "RestaurantConfig"("restaurantId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RestaurantConfig_restaurantId_fkey'
    ) THEN
        ALTER TABLE "RestaurantConfig"
        ADD CONSTRAINT "RestaurantConfig_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- CreateTable: PushSubscription
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userKey" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL DEFAULT '',
    "endpoint" TEXT NOT NULL,
    "p256dhKey" TEXT NOT NULL,
    "authKey" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userKey_idx" ON "PushSubscription"("userKey");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_userType_idx" ON "PushSubscription"("userId", "userType");
CREATE INDEX IF NOT EXISTS "PushSubscription_restaurantId_idx" ON "PushSubscription"("restaurantId");

-- CreateTable: StockItem
CREATE TABLE IF NOT EXISTS "StockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'unité',
    "minThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCost" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT NOT NULL DEFAULT '',
    "lastRestocked" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockItem_restaurantId_category_idx" ON "StockItem"("restaurantId", "category");
CREATE INDEX IF NOT EXISTS "StockItem_restaurantId_quantity_idx" ON "StockItem"("restaurantId", "quantity");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StockItem_restaurantId_fkey'
    ) THEN
        ALTER TABLE "StockItem"
        ADD CONSTRAINT "StockItem_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- CreateTable: StockMovement
CREATE TABLE IF NOT EXISTS "StockMovement" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actor" TEXT NOT NULL DEFAULT '',
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockMovement_stockItemId_idx" ON "StockMovement"("stockItemId");
CREATE INDEX IF NOT EXISTS "StockMovement_restaurantId_createdAt_idx" ON "StockMovement"("restaurantId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_stockItemId_fkey'
    ) THEN
        ALTER TABLE "StockMovement"
        ADD CONSTRAINT "StockMovement_stockItemId_fkey"
        FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_restaurantId_fkey'
    ) THEN
        ALTER TABLE "StockMovement"
        ADD CONSTRAINT "StockMovement_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;
    END IF;
END $$;
