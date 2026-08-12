-- KFM Delice — SaaS platform billing ledger
-- Deliberately separate from restaurant Invoice/Payment tables.

CREATE TABLE "PlatformSubscription" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "status" TEXT NOT NULL DEFAULT 'active',
    "currency" TEXT NOT NULL DEFAULT 'GNF',
    "unitAmount" BIGINT NOT NULL DEFAULT 0,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "nextBillingAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "providerCustomerRef" TEXT NOT NULL DEFAULT '',
    "providerSubscriptionRef" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformInvoice" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "number" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'GNF',
    "subtotal" BIGINT NOT NULL,
    "tax" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL,
    "amountPaid" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "providerInvoiceRef" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformPayment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GNF',
    "method" TEXT NOT NULL DEFAULT 'manual',
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'paid',
    "providerPaymentRef" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "failedReason" TEXT NOT NULL DEFAULT '',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformSubscription_accountId_key" ON "PlatformSubscription"("accountId");
CREATE UNIQUE INDEX "PlatformInvoice_number_key" ON "PlatformInvoice"("number");
CREATE UNIQUE INDEX "PlatformInvoice_idempotencyKey_key" ON "PlatformInvoice"("idempotencyKey");
CREATE UNIQUE INDEX "PlatformPayment_idempotencyKey_key" ON "PlatformPayment"("idempotencyKey");
CREATE INDEX "PlatformSubscription_accountId_status_idx" ON "PlatformSubscription"("accountId", "status");
CREATE INDEX "PlatformSubscription_accountId_createdAt_idx" ON "PlatformSubscription"("accountId", "createdAt");
CREATE INDEX "PlatformSubscription_nextBillingAt_idx" ON "PlatformSubscription"("nextBillingAt");
CREATE INDEX "PlatformInvoice_accountId_status_idx" ON "PlatformInvoice"("accountId", "status");
CREATE INDEX "PlatformInvoice_accountId_createdAt_idx" ON "PlatformInvoice"("accountId", "createdAt");
CREATE INDEX "PlatformInvoice_subscriptionId_idx" ON "PlatformInvoice"("subscriptionId");
CREATE INDEX "PlatformInvoice_dueAt_idx" ON "PlatformInvoice"("dueAt");
CREATE INDEX "PlatformPayment_accountId_status_idx" ON "PlatformPayment"("accountId", "status");
CREATE INDEX "PlatformPayment_accountId_createdAt_idx" ON "PlatformPayment"("accountId", "createdAt");
CREATE INDEX "PlatformPayment_invoiceId_idx" ON "PlatformPayment"("invoiceId");

ALTER TABLE "PlatformInvoice"
ADD CONSTRAINT "PlatformInvoice_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "PlatformSubscription"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlatformPayment"
ADD CONSTRAINT "PlatformPayment_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
