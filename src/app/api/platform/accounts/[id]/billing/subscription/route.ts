import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { authenticatePlatformAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { bigIntToNumber, db, dbReady } from '@/lib/db';
import {
  assertBillingWriteRole,
  BillingDomainError,
  deriveSubscriptionUnitAmount,
  parseOptionalIsoDate,
  subscriptionPatchSchema,
} from '@/lib/platform-billing';
import { invalidateTenantCache } from '@/lib/tenant';

function subscriptionView(subscription: any) {
  if (!subscription) return null;
  return bigIntToNumber({
    id: subscription.id,
    accountId: subscription.accountId,
    plan: subscription.plan,
    billingCycle: subscription.billingCycle,
    status: subscription.status,
    currency: subscription.currency,
    unitAmount: subscription.unitAmount,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    nextBillingAt: subscription.nextBillingAt,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    provider: subscription.provider,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    assertBillingWriteRole(admin);

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
      select: { id: true, plan: true, status: true, trialEndsAt: true },
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

    if (account.plan !== 'custom' && input.customUnitAmount !== undefined) {
      throw new BillingDomainError(
        'BILLING_STANDARD_PRICE_AUTHORITATIVE',
        'Le prix d’un plan standard est défini par le catalogue et ne peut pas être remplacé dans cette API.',
      );
    }
    if (
      account.plan === 'custom'
      && existing
      && input.billingCycle !== undefined
      && input.billingCycle !== existing.billingCycle
      && input.customUnitAmount === undefined
    ) {
      throw new BillingDomainError(
        'BILLING_CUSTOM_AMOUNT_REQUIRED',
        'Un nouveau montant contractuel est requis lors d’un changement de cycle du plan custom.',
      );
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

    const targetStatus = input.status ?? existing?.status ?? (account.status === 'trial' ? 'trialing' : 'active');
    const data = {
      plan,
      billingCycle,
      status: targetStatus,
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

    // Public trial onboarding deliberately creates Account.status=trial and
    // PlatformSubscription.status=trialing. Moving billing to `active` from the
    // platform back-office is the explicit commercial conversion boundary.
    // Keep the transition atomic so a paid subscription can never coexist with
    // a still-expired trial Account because of a partial write.
    if (account.status === 'trial' && targetStatus === 'active') {
      const result = await db.$transaction(async (tx) => {
        const freshAccount = await tx.account.findUnique({
          where: { id },
          select: { id: true, plan: true, status: true, trialEndsAt: true },
        });
        if (!freshAccount) {
          throw new BillingDomainError('BILLING_ACCOUNT_NOT_FOUND', 'Compte non trouvé.', 404);
        }

        const freshSubscription = await tx.platformSubscription.findFirst({
          where: { accountId: id },
          orderBy: { createdAt: 'desc' },
        });

        // Safe retry after another request completed the exact same conversion.
        if (freshAccount.status === 'active' && freshSubscription?.status === 'active') {
          return {
            subscription: freshSubscription,
            restaurantSlugs: [] as string[],
            convertedRestaurants: 0,
            replay: true,
          };
        }

        if (freshAccount.plan !== account.plan) {
          throw new BillingDomainError(
            'BILLING_TRIAL_CONVERSION_CONFLICT',
            'Le plan commercial a changé pendant la conversion. Rechargez la facturation puis réessayez.',
            409,
          );
        }
        if (freshAccount.status !== 'trial' || !freshSubscription || freshSubscription.status !== 'trialing') {
          throw new BillingDomainError(
            'BILLING_TRIAL_CONVERSION_CONFLICT',
            'L’essai n’est plus dans un état convertible. Rechargez la facturation avant toute activation.',
            409,
          );
        }

        const trialRestaurants = await tx.restaurant.findMany({
          where: { accountId: id, status: 'trial' },
          select: { slug: true },
        });

        const subscriptionClaim = await tx.platformSubscription.updateMany({
          where: { id: freshSubscription.id, accountId: id, status: 'trialing' },
          data,
        });
        if (subscriptionClaim.count !== 1) {
          throw new BillingDomainError(
            'BILLING_TRIAL_CONVERSION_CONFLICT',
            'L’abonnement a été modifié en parallèle. Rechargez la facturation puis réessayez.',
            409,
          );
        }

        const accountClaim = await tx.account.updateMany({
          where: { id, status: 'trial' },
          data: { status: 'active', trialEndsAt: '' },
        });
        if (accountClaim.count !== 1) {
          throw new BillingDomainError(
            'BILLING_TRIAL_CONVERSION_CONFLICT',
            'Le compte a été modifié en parallèle. Rechargez la facturation puis réessayez.',
            409,
          );
        }

        const restaurantsUpdate = await tx.restaurant.updateMany({
          where: { accountId: id, status: 'trial' },
          data: { status: 'active', trialEndsAt: '' },
        });

        const subscription = await tx.platformSubscription.findUnique({
          where: { id: freshSubscription.id },
        });
        if (!subscription) {
          throw new BillingDomainError(
            'BILLING_TRIAL_CONVERSION_CONFLICT',
            'Impossible de relire l’abonnement converti.',
            409,
          );
        }

        return {
          subscription,
          restaurantSlugs: trialRestaurants.map((restaurant) => restaurant.slug),
          convertedRestaurants: restaurantsUpdate.count,
          replay: false,
        };
      });

      if (!result.replay) {
        for (const slug of result.restaurantSlugs) invalidateTenantCache(slug);
        await logAudit({
          actorId: admin.id,
          actorType: 'platform_admin',
          action: 'platform_trial_converted',
          entityType: 'PlatformSubscription',
          entityId: result.subscription.id,
          accountId: id,
          before: {
            accountStatus: account.status,
            trialEndsAt: account.trialEndsAt,
            subscription: subscriptionView(existing),
          },
          after: {
            accountStatus: 'active',
            trialEndsAt: '',
            convertedRestaurants: result.convertedRestaurants,
            subscription: subscriptionView(result.subscription),
          },
          request,
        });
      }

      return NextResponse.json(subscriptionView(result.subscription));
    }

    let subscription;
    let before = existing;
    let created = false;

    if (existing) {
      subscription = await db.platformSubscription.update({ where: { id: existing.id }, data });
    } else {
      try {
        subscription = await db.platformSubscription.create({ data: { accountId: id, ...data } });
        created = true;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error;
        }
        const raced = await db.platformSubscription.findFirst({
          where: { accountId: id },
          orderBy: { createdAt: 'desc' },
        });
        if (!raced) throw error;
        before = raced;
        subscription = await db.platformSubscription.update({ where: { id: raced.id }, data });
      }
    }

    await logAudit({
      actorId: admin.id,
      actorType: 'platform_admin',
      action: created ? 'platform_subscription_create' : 'platform_subscription_change',
      entityType: 'PlatformSubscription',
      entityId: subscription.id,
      accountId: id,
      before: subscriptionView(before),
      after: subscriptionView(subscription),
      request,
    });

    return NextResponse.json(subscriptionView(subscription));
  } catch (error) {
    if (error instanceof BillingDomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    console.error('[platform/billing/subscription PATCH]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
