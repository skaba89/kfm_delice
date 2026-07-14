import { db } from "./db";

/**
 * Loyalty tiers logic (Mission P3.8)
 *
 * Tiers are configurable per restaurant. The default tiers are:
 *   - bronze    : 0 GNF spent        — no discount
 *   - silver    : 500,000 GNF        — 5% discount
 *   - gold      : 2,000,000 GNF      — 10% discount + free delivery
 *   - platinum  : 5,000,000 GNF      — 15% discount + free delivery + free dish
 *
 * The restaurant admin can customize these via /api/loyalty/tiers.
 * When a customer's totalSpent crosses a threshold, their `tier`
 * field is updated automatically (called from the order delivery flow).
 */

export const DEFAULT_TIERS = [
  {
    name: "bronze",
    label: "Bronze",
    minSpent: 0,
    discountPercent: 0,
    freeDelivery: false,
    freeDish: false,
    color: "#cd7f32",
    icon: "🥉",
  },
  {
    name: "silver",
    label: "Argent",
    minSpent: 500_000,
    discountPercent: 5,
    freeDelivery: false,
    freeDish: false,
    color: "#c0c0c0",
    icon: "🥈",
  },
  {
    name: "gold",
    label: "Or",
    minSpent: 2_000_000,
    discountPercent: 10,
    freeDelivery: true,
    freeDish: false,
    color: "#ffd700",
    icon: "🥇",
  },
  {
    name: "platinum",
    label: "Platine",
    minSpent: 5_000_000,
    discountPercent: 15,
    freeDelivery: true,
    freeDish: true,
    color: "#e5e4e2",
    icon: "💎",
  },
] as const;

/**
 * Ensure default tiers exist for a restaurant.
 * Called on restaurant creation — idempotent.
 */
export async function ensureDefaultTiers(restaurantId: string): Promise<void> {
  for (const tier of DEFAULT_TIERS) {
    try {
      await db.loyaltyTier.upsert({
        where: { restaurantId_name: { restaurantId, name: tier.name } },
        create: {
          restaurantId,
          name: tier.name,
          label: tier.label,
          minSpent: tier.minSpent,
          discountPercent: tier.discountPercent,
          freeDelivery: tier.freeDelivery,
          freeDish: tier.freeDish,
          color: tier.color,
          icon: tier.icon,
        },
        update: {}, // no-op if already exists
      });
    } catch {
      /* non-blocking — table may not exist yet */
    }
  }
}

/**
 * Resolve the customer's tier based on their totalSpent.
 * Returns the highest tier whose minSpent <= customer.totalSpent.
 *
 * @param customerTotalSpent - The customer's total spent (in GNF)
 * @param restaurantId - The restaurant ID (to fetch configured tiers)
 * @returns The tier name (e.g. "bronze", "silver", "gold", "platinum")
 */
export async function resolveCustomerTier(
  customerTotalSpent: number,
  restaurantId: string
): Promise<string> {
  try {
    const tiers = await db.loyaltyTier.findMany({
      where: { restaurantId, active: true },
      orderBy: { minSpent: "asc" },
    });

    if (tiers.length === 0) {
      // No configured tiers — fall back to default logic
      return DEFAULT_TIERS.reduce((highest, tier) => {
        return customerTotalSpent >= tier.minSpent ? tier.name : highest;
      }, "bronze");
    }

    // Find the highest tier the customer qualifies for
    let resolvedTier = tiers[0]?.name || "bronze";
    for (const tier of tiers) {
      if (customerTotalSpent >= Number(tier.minSpent)) {
        resolvedTier = tier.name;
      }
    }
    return resolvedTier;
  } catch {
    return "bronze";
  }
}

/**
 * Update the customer's tier if it has changed.
 * Called after each delivered order (when totalSpent increases).
 *
 * @returns The new tier (or null if unchanged)
 */
export async function updateCustomerTier(
  customerId: string,
  restaurantId: string
): Promise<string | null> {
  try {
    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: { totalSpent: true, tier: true },
    });
    if (!customer) return null;

    const newTier = await resolveCustomerTier(Number(customer.totalSpent), restaurantId);
    if (newTier !== customer.tier) {
      await db.customer.update({
        where: { id: customerId },
        data: { tier: newTier },
      });
      return newTier;
    }
    return null; // no change
  } catch {
    return null;
  }
}

/**
 * Get the tier configuration for a customer.
 * Returns the tier object (with discountPercent, freeDelivery, etc.)
 * or null if not found.
 */
export async function getCustomerTierConfig(
  customerTier: string,
  restaurantId: string
): Promise<{
  name: string;
  label: string;
  discountPercent: number;
  freeDelivery: boolean;
  freeDish: boolean;
  color: string;
  icon: string;
} | null> {
  try {
    const tier = await db.loyaltyTier.findFirst({
      where: { restaurantId, name: customerTier, active: true },
    });
    if (!tier) {
      // Fall back to default
      const defaultTier = DEFAULT_TIERS.find((t) => t.name === customerTier);
      return defaultTier || null;
    }
    return {
      name: tier.name,
      label: tier.label,
      discountPercent: tier.discountPercent,
      freeDelivery: tier.freeDelivery,
      freeDish: tier.freeDish,
      color: tier.color,
      icon: tier.icon,
    };
  } catch {
    return null;
  }
}
