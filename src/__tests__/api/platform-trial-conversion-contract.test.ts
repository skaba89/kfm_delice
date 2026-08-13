import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const subscriptionRoute = readFileSync(
  path.join(process.cwd(), 'src/app/api/platform/accounts/[id]/billing/subscription/route.ts'),
  'utf8',
);
const billingDomain = readFileSync(
  path.join(process.cwd(), 'src/lib/platform-billing.ts'),
  'utf8',
);

describe('explicit SaaS trial conversion contract', () => {
  it('keeps trialing as the default until an operator explicitly requests active', () => {
    expect(subscriptionRoute).toContain(
      "const targetStatus = input.status ?? existing?.status ?? (account.status === 'trial' ? 'trialing' : 'active');",
    );
    expect(subscriptionRoute).toContain(
      "if (account.status === 'trial' && targetStatus === 'active')",
    );
  });

  it('revalidates account and subscription state inside one transaction before conversion', () => {
    expect(subscriptionRoute).toContain('await db.$transaction(async (tx) =>');
    expect(subscriptionRoute).toContain('const freshAccount = await tx.account.findUnique');
    expect(subscriptionRoute).toContain('const freshSubscription = await tx.platformSubscription.findFirst');
    expect(subscriptionRoute).toContain("freshAccount.status !== 'trial'");
    expect(subscriptionRoute).toContain("freshSubscription.status !== 'trialing'");
    expect(subscriptionRoute).toContain("status: 'trialing'");
    expect(subscriptionRoute).toContain("where: { id, status: 'trial' }");
    expect(subscriptionRoute).toContain('BILLING_TRIAL_CONVERSION_CONFLICT');
  });

  it('only activates restaurants that are still in trial state', () => {
    expect(subscriptionRoute).toContain("where: { accountId: id, status: 'trial' }");
    expect(subscriptionRoute).toContain("data: { status: 'active', trialEndsAt: '' }");
    expect(subscriptionRoute).not.toContain("where: { accountId: id, status: 'suspended' }");
  });

  it('treats a completed concurrent conversion as an idempotent replay', () => {
    expect(subscriptionRoute).toContain(
      "if (freshAccount.status === 'active' && freshSubscription?.status === 'active')",
    );
    expect(subscriptionRoute).toContain('replay: true');
    expect(subscriptionRoute).toContain('if (!result.replay)');
  });

  it('invalidates tenant cache and writes the conversion audit only after the transaction resolves', () => {
    const transactionStart = subscriptionRoute.indexOf('await db.$transaction(async (tx) =>');
    const afterTransaction = subscriptionRoute.indexOf('if (!result.replay)', transactionStart);
    const cacheInvalidation = subscriptionRoute.indexOf('invalidateTenantCache(slug)', afterTransaction);
    const auditAction = subscriptionRoute.indexOf("action: 'platform_trial_converted'", afterTransaction);

    expect(transactionStart).toBeGreaterThanOrEqual(0);
    expect(afterTransaction).toBeGreaterThan(transactionStart);
    expect(cacheInvalidation).toBeGreaterThan(afterTransaction);
    expect(auditAction).toBeGreaterThan(afterTransaction);
  });

  it('never allows trialing subscriptions to be invoiced', () => {
    expect(billingDomain).toContain("if (!['active', 'past_due'].includes(subscription.status))");
    expect(billingDomain).toContain('BILLING_SUBSCRIPTION_NOT_BILLABLE');
  });
});
