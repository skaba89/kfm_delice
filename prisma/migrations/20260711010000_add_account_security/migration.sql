-- Migration: Add account security fields (loginAttempts + lockedUntil)
-- Idempotent (uses IF NOT EXISTS)

-- Admin
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "loginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- Customer
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "loginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- Driver
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "loginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
