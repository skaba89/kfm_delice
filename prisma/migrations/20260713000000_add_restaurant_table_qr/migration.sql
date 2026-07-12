-- ────────────────────────────────────────────────────────────────────
-- Mission 11: RestaurantTable + Order.tableId for QR-code table ordering
-- ────────────────────────────────────────────────────────────────────
-- Adds:
--   • "RestaurantTable" model — physical tables with opaque QR tokens
--   • Order.tableId (FK, SetNull on delete) — link to the scanned table
--   • Order.tableNumberStr — snapshot of table.number string
--
-- Multi-tenant isolation:
--   • Each RestaurantTable row belongs to exactly one Restaurant (cascade).
--   • The unique constraint (restaurantId, number) means two restaurants
--     can both have a table numbered "T04" without collision.
--   • qrToken is globally unique so a single QR scan resolves to exactly
--     one (table, restaurant) pair.
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "RestaurantTable" (
  "id"              TEXT NOT NULL,
  "restaurantId"    TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "number"          TEXT NOT NULL,
  "capacity"        INTEGER NOT NULL DEFAULT 4,
  "zone"            TEXT NOT NULL DEFAULT '',
  "status"          TEXT NOT NULL DEFAULT 'available',
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "qrToken"         TEXT NOT NULL,
  "qrVersion"       INTEGER NOT NULL DEFAULT 1,
  "qrEnabled"       BOOLEAN NOT NULL DEFAULT true,
  "qrGeneratedAt"   TIMESTAMP(3),
  "lastScannedAt"   TIMESTAMP(3),
  "scanCount"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: (restaurantId, number)
CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_number_key"
  ON "RestaurantTable"("restaurantId", "number");

-- Globally unique QR token (one token resolves to one table)
CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_qrToken_key"
  ON "RestaurantTable"("qrToken");

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_idx"
  ON "RestaurantTable"("restaurantId");
CREATE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_active_idx"
  ON "RestaurantTable"("restaurantId", "active");

-- Foreign key to Restaurant (cascade on delete)
ALTER TABLE "RestaurantTable"
  ADD CONSTRAINT "RestaurantTable_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
  ON DELETE CASCADE;

-- ── Add tableId + tableNumberStr to Order ──
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableNumberStr" TEXT NOT NULL DEFAULT '';

-- FK from Order.tableId → RestaurantTable.id (SetNull on table deletion)
ALTER TABLE "Order"
  DROP CONSTRAINT IF EXISTS "Order_tableId_fkey";
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id")
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Order_tableId_idx" ON "Order"("tableId");
