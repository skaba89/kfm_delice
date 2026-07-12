-- Migration: Link MenuItem to StockItem for automatic stock decrement
-- Idempotent (uses IF NOT EXISTS)

ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "stockItemId" TEXT;
CREATE INDEX IF NOT EXISTS "MenuItem_stockItemId_idx" ON "MenuItem"("stockItemId");
