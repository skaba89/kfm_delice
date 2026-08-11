export interface MonthlyOrderQuotaResult {
  allowed: boolean;
  code?: 'ACCOUNT_UNAVAILABLE' | 'ACCOUNT_MONTHLY_ORDER_QUOTA_REACHED';
  error?: string;
  usage?: number;
  limit?: number;
  monthStart?: Date;
  nextMonthStart?: Date;
}

export function getUtcMonthWindow(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

/**
 * Check whether an Account may create one more order.
 *
 * This function is designed to run *inside* the same Serializable transaction
 * as order creation. PostgreSQL can then abort/retry concurrent transactions
 * that both observe the last available slot, preventing silent quota overruns.
 * CI runs this change against the current main including subscription,
 * trusted-proxy enforcement and the national capacity baseline before merge.
 */
export async function checkMonthlyOrderEntitlement(
  tx: any,
  restaurantId: string,
  now: Date = new Date()
): Promise<MonthlyOrderQuotaResult> {
  const restaurant = await tx.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      account: {
        select: {
          id: true,
          status: true,
          maxOrdersPerMonth: true,
        },
      },
    },
  });

  // Legacy restaurants created before Account hierarchy remain operational.
  const account = restaurant?.account;
  if (!account) return { allowed: true };

  if (account.status === 'suspended' || account.status === 'cancelled') {
    return {
      allowed: false,
      code: 'ACCOUNT_UNAVAILABLE',
      error: 'Le compte SaaS est suspendu ou résilié',
    };
  }

  const limit = Number(account.maxOrdersPerMonth);
  const { start, end } = getUtcMonthWindow(now);

  const restaurants = await tx.restaurant.findMany({
    where: { accountId: account.id },
    select: { id: true },
  });
  const restaurantIds = restaurants.map((item: { id: string }) => item.id);

  const usage = restaurantIds.length === 0
    ? 0
    : await tx.order.count({
        where: {
          restaurantId: { in: restaurantIds },
          createdAt: { gte: start, lt: end },
        },
      });

  if (usage >= limit) {
    return {
      allowed: false,
      code: 'ACCOUNT_MONTHLY_ORDER_QUOTA_REACHED',
      error: `Quota mensuel de commandes atteint (${usage}/${limit})`,
      usage,
      limit,
      monthStart: start,
      nextMonthStart: end,
    };
  }

  return {
    allowed: true,
    usage,
    limit,
    monthStart: start,
    nextMonthStart: end,
  };
}
