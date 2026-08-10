-- Reconcile critical PostgreSQL schema drift without rewriting migration history.
--
-- This migration is intentionally forward-only and idempotent. It fixes the
-- columns that the current Prisma schema and production seed/auth flows require
-- but that are absent when the historical migrations are replayed on a fresh DB.
-- Existing production databases where these columns already exist are no-ops.

-- ─────────────────────────────────────────────────────────────────────────────
-- Restaurant: SaaS/runtime fields used by seed, tenant resolution and ordering
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "deliveryRadiusKm" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "loyaltyPointsRate" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION NOT NULL DEFAULT 9.5092;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION NOT NULL DEFAULT -13.7122;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "trialEndsAt" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'GNF';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'fr';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "ownerEmail" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "ownerName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "ownerPhone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "createdByAdminId" TEXT;

CREATE INDEX IF NOT EXISTS "Restaurant_status_idx" ON "Restaurant"("status");
CREATE INDEX IF NOT EXISTS "Restaurant_plan_idx" ON "Restaurant"("plan");

-- ─────────────────────────────────────────────────────────────────────────────
-- Admin: tenant ownership is mandatory in the current application model.
-- Add nullable first so a legacy populated DB can be reconciled safely.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "restaurantId" TEXT;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "loginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Customer has the same tenant requirement.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "restaurantId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "loginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'bronze';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "favoriteItemIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "birthday" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "referralCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "referredBy" TEXT NOT NULL DEFAULT '';

-- Safe backfill rule:
--   * empty tables: nothing to do, NOT NULL can be applied immediately;
--   * exactly one restaurant: attach legacy unscoped users to that restaurant;
--   * several restaurants + unscoped rows: fail rather than guess a tenant.
DO $$
DECLARE
    restaurant_count INTEGER;
    default_restaurant_id TEXT;
BEGIN
    SELECT COUNT(*), MIN("id") INTO restaurant_count, default_restaurant_id FROM "Restaurant";

    IF EXISTS (SELECT 1 FROM "Admin" WHERE "restaurantId" IS NULL) THEN
        IF restaurant_count = 1 THEN
            UPDATE "Admin" SET "restaurantId" = default_restaurant_id WHERE "restaurantId" IS NULL;
        ELSIF restaurant_count > 1 THEN
            RAISE EXCEPTION 'Cannot safely backfill Admin.restaurantId: multiple restaurants exist';
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM "Customer" WHERE "restaurantId" IS NULL) THEN
        IF restaurant_count = 1 THEN
            UPDATE "Customer" SET "restaurantId" = default_restaurant_id WHERE "restaurantId" IS NULL;
        ELSIF restaurant_count > 1 THEN
            RAISE EXCEPTION 'Cannot safely backfill Customer.restaurantId: multiple restaurants exist';
        END IF;
    END IF;
END $$;

-- Empty fresh databases and safely backfilled single-tenant databases can now
-- enforce the invariant expected by Prisma.
ALTER TABLE "Admin" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "restaurantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Admin_restaurantId_idx" ON "Admin"("restaurantId");
CREATE INDEX IF NOT EXISTS "Customer_restaurantId_idx" ON "Customer"("restaurantId");
CREATE INDEX IF NOT EXISTS "Customer_restaurantId_email_idx" ON "Customer"("restaurantId", "email");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Admin_restaurantId_fkey') THEN
        ALTER TABLE "Admin"
        ADD CONSTRAINT "Admin_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Customer_restaurantId_fkey') THEN
        ALTER TABLE "Customer"
        ADD CONSTRAINT "Customer_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- Current schema scopes customer emails by restaurant rather than globally.
DROP INDEX IF EXISTS "Customer_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_email_restaurantId_key"
    ON "Customer"("email", "restaurantId");
