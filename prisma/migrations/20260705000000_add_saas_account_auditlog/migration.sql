-- Migration: Add SaaS Account, AuditLog models + Restaurant/Admin fields
-- Idempotent (uses IF NOT EXISTS + DO $$ blocks)

-- CreateTable: Account
CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL DEFAULT '',
    "ownerEmail" TEXT NOT NULL DEFAULT '',
    "ownerPhone" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "maxRestaurants" INTEGER NOT NULL DEFAULT 1,
    "maxSecondaryRestaurants" INTEGER NOT NULL DEFAULT 0,
    "maxAdmins" INTEGER NOT NULL DEFAULT 3,
    "maxUsers" INTEGER NOT NULL DEFAULT 10,
    "maxOrdersPerMonth" INTEGER NOT NULL DEFAULT 1000,
    "contractStartDate" TEXT NOT NULL DEFAULT '',
    "contractEndDate" TEXT NOT NULL DEFAULT '',
    "trialEndsAt" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Account_status_idx" ON "Account"("status");
CREATE INDEX IF NOT EXISTS "Account_plan_idx" ON "Account"("plan");
CREATE INDEX IF NOT EXISTS "Account_ownerEmail_idx" ON "Account"("ownerEmail");

-- Add columns to Restaurant
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "parentRestaurantId" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'principal';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "createdByAdminId" TEXT;

-- Add columns to Admin
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "canCreateRestaurant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "restaurantCreationLimit" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "restaurantsCreatedCount" INTEGER NOT NULL DEFAULT 0;

-- Add foreign keys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Restaurant_accountId_fkey') THEN
        ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Admin_accountId_fkey') THEN
        ALTER TABLE "Admin" ADD CONSTRAINT "Admin_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Restaurant_accountId_idx" ON "Restaurant"("accountId");
CREATE INDEX IF NOT EXISTS "Admin_accountId_idx" ON "Admin"("accountId");

-- CreateTable: AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "accountId" TEXT,
    "restaurantId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "AuditLog_accountId_idx" ON "AuditLog"("accountId");
CREATE INDEX IF NOT EXISTS "AuditLog_restaurantId_idx" ON "AuditLog"("restaurantId");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_idx" ON "AuditLog"("entityType");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_accountId_fkey') THEN
        ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE;
    END IF;
END $$;
