-- Mission 1 (Phase 3): PaymentIdempotencyKey — prevents double-charging
-- A dedicated table for payment idempotency (separate from order IdempotencyKey).

CREATE TABLE IF NOT EXISTS "PaymentIdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "paymentId" TEXT,
    "orderId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentIdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIdempotencyKey_restaurantId_key_key" ON "PaymentIdempotencyKey"("restaurantId", "key");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIdempotencyKey_paymentId_key" ON "PaymentIdempotencyKey"("paymentId");
CREATE INDEX IF NOT EXISTS "PaymentIdempotencyKey_restaurantId_status_idx" ON "PaymentIdempotencyKey"("restaurantId", "status");
CREATE INDEX IF NOT EXISTS "PaymentIdempotencyKey_expiresAt_idx" ON "PaymentIdempotencyKey"("expiresAt");
CREATE INDEX IF NOT EXISTS "PaymentIdempotencyKey_orderId_idx" ON "PaymentIdempotencyKey"("orderId");

ALTER TABLE "PaymentIdempotencyKey" ADD CONSTRAINT "PaymentIdempotencyKey_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;
