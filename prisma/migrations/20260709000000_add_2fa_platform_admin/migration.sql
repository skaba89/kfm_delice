-- Migration: Add 2FA TOTP fields to PlatformAdmin
-- Idempotent (uses IF NOT EXISTS)

ALTER TABLE "PlatformAdmin" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformAdmin" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
ALTER TABLE "PlatformAdmin" ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" TEXT;
