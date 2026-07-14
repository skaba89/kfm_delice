-- ────────────────────────────────────────────────────────────────────
-- Mission P3.7: ChatMessage table — internal restaurant chat
-- ────────────────────────────────────────────────────────────────────
-- One chat channel per restaurant (no rooms). All admin-role users
-- of the restaurant can read + post. Messages are scoped by restaurantId
-- (multi-tenant isolation).

CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id"            TEXT NOT NULL,
  "restaurantId"  TEXT NOT NULL,
  "senderId"      TEXT NOT NULL,
  "senderName"    TEXT NOT NULL,
  "senderRole"    TEXT NOT NULL,
  "content"       TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatMessage_restaurantId_createdAt_idx"
  ON "ChatMessage"("restaurantId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_restaurantId_idx"
  ON "ChatMessage"("restaurantId");

ALTER TABLE "ChatMessage"
  ADD CONSTRAINT "ChatMessage_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
  ON DELETE CASCADE;
