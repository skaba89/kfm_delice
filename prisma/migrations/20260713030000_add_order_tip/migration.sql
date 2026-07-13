-- ────────────────────────────────────────────────────────────────────
-- Mission P2.5: Add tip (pourboire) column to Order
-- ────────────────────────────────────────────────────────────────────
-- Allows customers to leave a tip at checkout. The tip is:
--   - Validated server-side (0 <= tip <= 50% of total)
--   - Stored on the order record
--   - Displayed separately on invoices + dashboard
--   - Included in revenue stats (but tracked separately from subtotal)

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tip" BIGINT NOT NULL DEFAULT 0;
