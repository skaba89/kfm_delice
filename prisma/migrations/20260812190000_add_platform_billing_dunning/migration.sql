-- KFM Delice — persistent SaaS billing dunning notices
-- Keeps financial reminders separate from restaurant customer notifications.

CREATE TABLE "PlatformBillingNotice" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "attemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformBillingNotice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformBillingNotice_idempotencyKey_key"
ON "PlatformBillingNotice"("idempotencyKey");

CREATE INDEX "PlatformBillingNotice_accountId_status_idx"
ON "PlatformBillingNotice"("accountId", "status");

CREATE INDEX "PlatformBillingNotice_invoiceId_idx"
ON "PlatformBillingNotice"("invoiceId");

CREATE INDEX "PlatformBillingNotice_createdAt_idx"
ON "PlatformBillingNotice"("createdAt");

ALTER TABLE "PlatformBillingNotice"
ADD CONSTRAINT "PlatformBillingNotice_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
