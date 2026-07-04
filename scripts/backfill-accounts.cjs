/**
 * backfill-accounts.cjs — Create Account for each existing Restaurant
 *
 * For each restaurant without an accountId:
 *   1. Create an Account with the restaurant's plan
 *   2. Link the restaurant to the Account (accountId + type='principal')
 *   3. Link all admins of that restaurant to the Account
 *   4. Set canCreateRestaurant=true for the main admin (role='admin')
 *
 * Idempotent: safe to run multiple times.
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
  
  const restaurants = await prisma.restaurant.findMany({
    where: { OR: [{ accountId: null }, { accountId: '' }] },
    include: { admins: true },
  });

  console.log(`[backfill-accounts] Found ${restaurants.length} restaurant(s) without accountId`);

  for (const restaurant of restaurants) {
    const plan = restaurant.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    
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

    // Link restaurant to account
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { accountId: account.id, type: 'principal' },
    });

    // Link admins to account
    for (const admin of restaurant.admins) {
      const canCreate = admin.role === 'admin';
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          accountId: account.id,
          canCreateRestaurant: canCreate,
          restaurantCreationLimit: canCreate ? limits.maxSecondaryRestaurants : 0,
        },
      });
    }

    console.log(`[backfill-accounts] ✓ Account ${account.id} created for "${restaurant.name}"`);
  }

  console.log('[backfill-accounts] Done.');
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[backfill-accounts] FATAL:', e.message);
    prisma.$disconnect().finally(() => process.exit(1));
  });
