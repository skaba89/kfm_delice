import { NextResponse } from 'next/server';
import { authenticatePlatformAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { bigIntToNumber, db, dbReady } from '@/lib/db';
import {
  BillingDomainError,
  deriveSubscriptionUnitAmount,
  parseOptionalIsoDate,
  subscriptionPatchSchema,
} from '@/lib/platform-billing';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const { id } = await params;
    const parsed = subscriptionPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Données invalides', code: 'BILLING_VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const account = await db.account.findUnique({
      where: { id },
      select: { id: true, plan: true, status: true },
    });
    if (!account) return NextResponse.json({ error: 'Compte non trouvé' }, { status: 404 });

    const existing = await db.platformSubscription.findFirst({
      where: { accountId: id },
      orderBy: { createdAt: 'desc' },
    });

    const input = parsed.data;
    const billingCycle = input.billingCycle ?? existing?.billingCycle ?? 'monthly';
    if (billingCycle !== 'monthly' && billingCycle !== 'annual') {
      throw new BillingDomainError('BILLING_INVALID_CYCLE', 'Cycle de facturation invalide.');
    }

    const { plan, unitAmount } = deriveSubscriptionUnitAmount({
      plan: account.plan,
      billingCycle,
      customUnitAmount: input.customUnitAmount,
      existingUnitAmount: existing?.unitAmount ?? null,
    });

    const currentPeriodStart = parseOptionalIsoDate(input.currentPeriodStart, 'currentPeriodStart');
    const currentPeriodEnd = parseOptionalIsoDate(input.currentPeriodEnd, 'currentPeriodEnd');
    const nextBillingAt = parseOptionalIsoDate(input.nextBillingAt, 'nextBillingAt');

    if (currentPeriodStart && currentPeriodEnd && currentPeriodEnd <= currentPeriodStart) {
      throw new BillingDomainError(
        'BILLING_INVALID_PERIOD',
        'La fin de période doit être postérieure au début de période.',
      );
    }

    const data = {
      plan,
      billingCycle,
      status: input.status ?? existing?.status ?? (account.status === 'trial' ? 'trialing' : 'active'),
      currency: 'GNF',
      unitAmount,
      ...(currentPeriodStart !== undefined && { currentPeriodStart }),
      ...(currentPeriodEnd !== undefined && { currentPeriodEnd }),
      ...(nextBillingAt !== undefined && { nextBillingAt }),
      ...(input.cancelAtPeriodEnd !== undefined && { cancelAtPeriodEnd: input.cancelAtPeriodEnd }),
      ...(input.provider !== undefined && { provider: input.provider }),
      ...(input.providerCustomerRef !== undefined && { providerCustomerRef: input.providerCustomerRef }),
      ...(input.providerSubscriptionRef !== undefined && { providerSubscriptionRef: input.providerSubscriptionRef }),
    };

    const before = existing ? bigIntToNumber(existing) : null;
    const subscription = existing
      ? await db.platformSubscription.update({ where: { id: existing.id }, data })
      : await db.platformSubscription.create({ data: { accountId: id, ...data } });

    await logAudit({
      actorId: admin.id,
      actorType: 'platform_admin',
      action: existing ? 'platform_subscription_change' : 'platform_subscription_create',
      entityType: 'PlatformSubscription',
      entityId: subscription.id,
      accountId: id,
      before,
      after: bigIntToNumber(subscription),
      request,
    });

    return NextResponse.json(bigIntToNumber(subscription));
  } catch (error) {
    if (error instanceof BillingDomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    console.error('[platform/billing/subscription PATCH]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
