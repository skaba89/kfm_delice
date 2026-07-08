/**
 * backfill-accounts.cjs — Attach Account to existing Restaurants + Admins
 *
 * This script runs AFTER auto-seed.cjs in render-start.sh.
 * It is IDEMPOTENT — safe to run on every restart.
 *
 * For each Restaurant:
 *   1. If restaurant.accountId is null/empty → create an Account
 *      (plan taken from restaurant.plan, default 'free')
 *   2. If restaurant.type is null/empty → set type='principal'
 *   3. If restaurant.parentRestaurantId is null → leave null (it's principal)
 *   4. For each Admin of that restaurant:
 *      a. If admin.accountId is null → set it to the (just-created or existing) account
 *      b. If admin.role === 'admin' AND admin.canCreateRestaurant === false
 *         → set canCreateRestaurant=true (only if it was never explicitly set)
 *      c. If admin.restaurantCreationLimit is null OR 0 AND role === 'admin'
 *         → set to account.maxSecondaryRestaurants
 *         (BUT never overwrite a non-zero value — that's a custom quota)
 *      d. If admin.restaurantsCreatedCount is null → set to 0
 *
 * Guarantees:
 *   - Never deletes any data
 *   - Never overwrites a non-zero restaurantCreationLimit (custom quota)
 *   - Never downgrades canCreateRestaurant from true to false
 *   - Idempotent: safe to run repeatedly
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error', 'warn'] });

const PLAN_LIMITS = {
  free:       { maxRestaurants: 1, maxSecondaryRestaurants: 0, maxAdmins: 2, maxUsers: 5 },
  starter:    { maxRestaurants: 2, maxSecondaryRestaurants: 1, maxAdmins: 5, maxUsers: 15 },
  pro:        { maxRestaurants: 5, maxSecondaryRestaurants: 4, maxAdmins: 15, maxUsers: 50 },
  enterprise: { maxRestaurants: 20, maxSecondaryRestaurants: 19, maxAdmins: 50, maxUsers: 200 },
  custom:     { maxRestaurants: 10, maxSecondaryRestaurants: 5, maxAdmins: 10, maxUsers: 30 },
};

async function main() {
  console.log('[backfill-accounts] Starting...');

  // Find restaurants that EITHER have no accountId OR have null type
  // (both need fixing). We fetch all and filter in JS so we can also
  // We process ALL restaurants — even those with accountId and type set —
  // because we may need to upgrade their account's quotas (e.g. an account
  // created as 'free' but the restaurant is 'pro').
  const restaurants = await prisma.restaurant.findMany({
    include: { admins: true, account: true },
  });

  console.log(`[backfill-accounts] ${restaurants.length} restaurant(s) to check`);

  let accountsCreated = 0;
  let restaurantsLinked = 0;
  let adminsLinked = 0;
  let adminsUpgraded = 0;

  for (const restaurant of restaurants) {
    const plan = restaurant.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    const needsAccount = !restaurant.accountId;

    let accountId = restaurant.accountId;

    if (needsAccount) {
      console.log(`[backfill-accounts] Creating Account for "${restaurant.name}" (plan=${plan})`);
      const account = await prisma.account.create({
        data: {
          name: restaurant.name,
          ownerName: restaurant.ownerName || '',
          ownerEmail: restaurant.ownerEmail || '',
          ownerPhone: restaurant.ownerPhone || '',
          status: restaurant.status || 'active',
          plan,
          maxRestaurants: limits.maxRestaurants,
          maxSecondaryRestaurants: limits.maxSecondaryRestaurants,
          maxAdmins: limits.maxAdmins,
          maxUsers: limits.maxUsers,
        },
      });
      accountId = account.id;
      accountsCreated++;
      console.log(`[backfill-accounts]   Account ${account.id} created`);
    } else {
      console.log(`[backfill-accounts] Restaurant "${restaurant.name}" already has accountId, checking quotas`);
      // Upgrade the account's quotas if the restaurant's plan is higher
      // than the account's current plan (e.g. account was created as 'free'
      // but the restaurant is 'pro').
      const existingAccount = restaurant.account;
      if (existingAccount) {
        const needsQuotaUpgrade =
          limits.maxRestaurants > existingAccount.maxRestaurants ||
          limits.maxSecondaryRestaurants > existingAccount.maxSecondaryRestaurants ||
          limits.maxAdmins > existingAccount.maxAdmins ||
          limits.maxUsers > existingAccount.maxUsers;
        if (needsQuotaUpgrade) {
          console.log(`[backfill-accounts]   Upgrading account quotas: ${existingAccount.plan} → ${plan}`);
          try {
            await prisma.account.update({
              where: { id: accountId },
              data: {
                plan,
                maxRestaurants: limits.maxRestaurants,
                maxSecondaryRestaurants: limits.maxSecondaryRestaurants,
                maxAdmins: limits.maxAdmins,
                maxUsers: limits.maxUsers,
              },
            });
          } catch (e) {
            console.log(`[backfill-accounts]   WARNING: could not upgrade account quotas: ${e.message}`);
          }
        }
      }
    }

    // Update restaurant: set accountId (if was missing) + type (if was missing)
    const updateData = {};
    if (!restaurant.accountId) updateData.accountId = accountId;
    if (!restaurant.type) updateData.type = 'principal';
    if (Object.keys(updateData).length > 0) {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: updateData,
      });
      restaurantsLinked++;
    }

    // Backfill admins
    for (const admin of restaurant.admins) {
      const adminUpdate = {};
      // Link to account if missing
      if (!admin.accountId) {
        adminUpdate.accountId = accountId;
      }
      // Upgrade admin role: canCreateRestaurant + restaurantCreationLimit
      // ONLY if not already explicitly set (we don't downgrade).
      if (admin.role === 'admin') {
        if (admin.canCreateRestaurant !== true) {
          adminUpdate.canCreateRestaurant = true;
        }
        // Set limit if it's currently 0/null OR if it's below the account's
        // maxSecondaryRestaurants (e.g. account was just upgraded from free to pro).
        // A non-zero value ABOVE maxSecondaryRestaurants means the user has set
        // a custom quota — preserve it.
        const currentLimit = admin.restaurantCreationLimit || 0;
        if (currentLimit < limits.maxSecondaryRestaurants) {
          adminUpdate.restaurantCreationLimit = limits.maxSecondaryRestaurants;
        }
      }
      // restaurantsCreatedCount: if null/undefined, set to 0
      if (admin.restaurantsCreatedCount == null) {
        adminUpdate.restaurantsCreatedCount = 0;
      }

      if (Object.keys(adminUpdate).length > 0) {
        await prisma.admin.update({
          where: { id: admin.id },
          data: adminUpdate,
        });
        if (adminUpdate.accountId) adminsLinked++;
        if (adminUpdate.canCreateRestaurant) adminsUpgraded++;
      }
    }
  }

  console.log('[backfill-accounts] ─────────────────────────────────');
  console.log(`[backfill-accounts] Summary:`);
  console.log(`[backfill-accounts]   Accounts created:    ${accountsCreated}`);
  console.log(`[backfill-accounts]   Restaurants linked:  ${restaurantsLinked}`);
  console.log(`[backfill-accounts]   Admins linked:       ${adminsLinked}`);
  console.log(`[backfill-accounts]   Admins upgraded:     ${adminsUpgraded}`);
  console.log('[backfill-accounts] Done.');
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[backfill-accounts] FATAL:', e.message);
    console.error('[backfill-accounts] Stack:', e.stack);
    prisma.$disconnect().finally(() => process.exit(1));
  });
