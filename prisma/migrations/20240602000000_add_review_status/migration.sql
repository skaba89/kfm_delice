-- AlterTable: Add status column to Review table (for visibility toggle)
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'visible';
