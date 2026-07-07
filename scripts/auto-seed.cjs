/**
 * auto-seed.cjs — Seeds the database ONLY if it's empty (no restaurants).
 *
 * Creates a coherent SaaS structure:
 *   Account (KFM Delice, plan=pro)
 *     → Restaurant (principal, accountId=account.id)
 *       → Admin principal (canCreateRestaurant=true, restaurantCreationLimit=4)
 *       → Manager (canCreateRestaurant=false, restaurantCreationLimit=0)
 *       → Staff    (canCreateRestaurant=false, restaurantCreationLimit=0)
 *
 * Uses Prisma Client exclusively (no raw SQL). Now that the Prisma Client
 * is regenerated at runtime by render-start.sh with the correct provider
 * (postgres on Render, sqlite locally), Prisma model queries work reliably
 * — no more raw SQL workarounds needed.
 *
 * Gate: ALLOW_AUTO_SEED=true is REQUIRED in production (NODE_ENV=production).
 * Dev environments auto-seed for convenience.
 *
 * CommonJS for maximum compatibility with Prisma + bcryptjs.
 */

// ─── Database URL resolution (mirror of src/lib/db.ts) ───────────
if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[auto-seed] FATAL: DATABASE_URL is not set in production.');
    process.exit(1);
  }
  process.env.DATABASE_URL = 'file:./data/kfm-delice.db';
  console.warn('[auto-seed] DATABASE_URL missing — defaulting to: file:./data/kfm-delice.db');
}

const _url = process.env.DATABASE_URL || '';
const _isPostgres = _url.startsWith('postgresql://') || _url.startsWith('postgres://');
const _isValid = _url.startsWith('file:') || _isPostgres;
if (!_isValid) {
  console.error('[auto-seed] FATAL: Invalid DATABASE_URL. Expected file:, postgresql:// or postgres://');
  process.exit(1);
}
// Log only the provider (never the full URL — it contains credentials).
console.log(`[auto-seed] Database provider: ${_isPostgres ? 'postgres' : 'sqlite'}`);

const { PrismaClient } = require('@prisma/client');
const { hashSync } = require('bcryptjs');

const prisma = new PrismaClient({ log: ['error', 'warn'] });

// ── Provider detection ─────────────────────────────────────────
// In PostgreSQL, monetary fields are BigInt. In SQLite they are Int.
// We need to use the correct type when creating rows.
const IS_POSTGRES = _isPostgres;
// Helper: cast a number to BigInt on Postgres, leave as Int on SQLite.
const money = (n) => (IS_POSTGRES ? BigInt(n) : n);

// ── SaaS plan limits (must match PLAN_LIMITS in backfill-accounts.cjs) ──
const PLAN_LIMITS = {
  free:       { maxRestaurants: 1, maxSecondaryRestaurants: 0, maxAdmins: 2, maxUsers: 5 },
  starter:    { maxRestaurants: 2, maxSecondaryRestaurants: 1, maxAdmins: 5, maxUsers: 15 },
  pro:        { maxRestaurants: 5, maxSecondaryRestaurants: 4, maxAdmins: 15, maxUsers: 50 },
  enterprise: { maxRestaurants: 20, maxSecondaryRestaurants: 19, maxAdmins: 50, maxUsers: 200 },
  custom:     { maxRestaurants: 10, maxSecondaryRestaurants: 5, maxAdmins: 10, maxUsers: 30 },
};

async function main() {
  try {
    console.log('[auto-seed] Checking database...');

    // ── Production gate ──
    const isProduction = process.env.NODE_ENV === 'production';
    const allowAutoSeed = process.env.ALLOW_AUTO_SEED === 'true';
    if (isProduction && !allowAutoSeed) {
      console.log('[auto-seed] Production mode + ALLOW_AUTO_SEED not "true" → skipping.');
      console.log('[auto-seed] Set ALLOW_AUTO_SEED=true in Render Environment to enable demo seeding.');
      return;
    }

    await prisma.$connect();
    console.log('[auto-seed] Database connected.');

    // Idempotency: if at least one restaurant exists, skip everything.
    // We use prisma.restaurant.count() — Prisma Client now has the
    // correct provider so this works on both SQLite and PostgreSQL.
    let restaurantCount = 0;
    try {
      restaurantCount = await prisma.restaurant.count();
    } catch (countErr) {
      console.log('[auto-seed] Could not count restaurants:', countErr.message);
      console.log('[auto-seed] Assuming empty database and attempting seed.');
    }
    if (restaurantCount > 0) {
      console.log(`[auto-seed] Database already has ${restaurantCount} restaurant(s), skipping.`);
      return;
    }

    console.log('[auto-seed] Empty database detected — seeding SaaS-coherent demo data...');

    // ── 1. Create PlatformAdmin (super-admin for the SaaS platform itself) ──
    // NOTE: This is for the SaaS platform admin (manages ALL accounts),
    // NOT the restaurant admin. Demo password is "platform2024" — only
    // safe because ALLOW_AUTO_SEED=true is explicitly opt-in.
    const platformPw = hashSync('platform2024', 10);
    try {
      await prisma.platformAdmin.upsert({
        where: { email: 'admin@restaurantpro.com' },
        update: { password: platformPw },
        create: {
          email: 'admin@restaurantpro.com',
          password: platformPw,
          name: 'Super Admin',
          role: 'super_admin',
          status: 'active',
        },
      });
      console.log('[auto-seed] Platform admin ensured (admin@restaurantpro.com).');
    } catch (e) {
      console.log('[auto-seed] Platform admin upsert warning:', e.message);
    }

    // ── 2. Create Account (SaaS customer — owns the restaurant) ──
    const plan = 'pro';
    const limits = PLAN_LIMITS[plan];
    const account = await prisma.account.create({
      data: {
        name: 'KFM Delice',
        ownerName: 'Admin KFM Delice',
        ownerEmail: 'admin@kfm-delice.com',
        ownerPhone: '+224 622 34 56 78',
        status: 'active',
        plan,
        maxRestaurants: limits.maxRestaurants,
        maxSecondaryRestaurants: limits.maxSecondaryRestaurants,
        maxAdmins: limits.maxAdmins,
        maxUsers: limits.maxUsers,
      },
    });
    console.log(`[auto-seed] Account created: ${account.id} (plan=${plan}, maxRestaurants=${limits.maxRestaurants}, maxSecondary=${limits.maxSecondaryRestaurants})`);

    // ── 3. Create Restaurant (principal, attached to Account) ──
    const restaurant = await prisma.restaurant.create({
      data: {
        name: 'KFM Delice',
        slug: 'kfm-delice',
        tagline: "L'Art du Goût Guinéen",
        description: 'Restaurant gastronomique au cœur de Conakry.',
        phone: '+224 622 34 56 78',
        whatsapp: '+224 622 34 56 78',
        email: 'reservation@kfm-delice.com',
        address: 'Almamya, Corniche Nord, Conakry, Guinée',
        hours: 'Lun-Dim : 11h00 - 23h00',
        rating: 4.9,
        tables: 25,
        deliveryFee: money(5000),
        minDelivery: money(15000),
        deliveryZones: 'Kaloum:Dixinn:Matam:Matoto',
        plan,
        status: 'active',
        currency: 'GNF',
        locale: 'fr',
        ownerEmail: 'admin@kfm-delice.com',
        ownerName: 'Admin KFM Delice',
        ownerPhone: '+224 622 34 56 78',
        // ── SaaS fields ──
        accountId: account.id,
        type: 'principal',
        parentRestaurantId: null,
      },
    });
    console.log(`[auto-seed] Restaurant created: ${restaurant.id} (accountId=${restaurant.accountId}, type=${restaurant.type})`);

    // ── 4. Create RestaurantConfig ──
    await prisma.restaurantConfig.create({
      data: {
        restaurantId: restaurant.id,
        heroImage: '/images/kfm-hero.png',
        primaryColor: '#ea580c',
        accentColor: '#f97316',
        menuCategories: JSON.stringify([
          { id: 'entrees', name: 'Entrées' },
          { id: 'plats', name: 'Plats Principaux' },
          { id: 'mer', name: 'Fruits de Mer' },
          { id: 'desserts', name: 'Desserts' },
          { id: 'boissons', name: 'Boissons' },
        ]),
        features: JSON.stringify({
          delivery: true, reservations: true, reviews: true, loyalty: true,
          pos: true, invoices: true, quotes: true, expenses: true, staff: true, drivers: true,
        }),
        openingHours: JSON.stringify({ open: 11, close: 23, timezone: 'Africa/Conakry' }),
        socialLinks: JSON.stringify({ facebook: '', instagram: '', twitter: '' }),
      },
    });
    console.log('[auto-seed] RestaurantConfig created.');

    // ── 5. Create Admins (all linked to Account) ──
    const adminPw1 = hashSync('kfm2024', 10);
    const adminPw2 = hashSync('manager2024', 10);
    const adminPw3 = hashSync('staff2024', 10);

    const adminsToCreate = [
      {
        email: 'admin@kfm-delice.com',
        password: adminPw1,
        name: 'Admin KFM Delice',
        role: 'admin',
        canCreateRestaurant: true,
        restaurantCreationLimit: limits.maxSecondaryRestaurants,
      },
      {
        email: 'manager@kfm-delice.com',
        password: adminPw2,
        name: 'Aminata Diallo',
        role: 'manager',
        canCreateRestaurant: false,
        restaurantCreationLimit: 0,
      },
      {
        email: 'staff@kfm-delice.com',
        password: adminPw3,
        name: 'Ibrahima Touré',
        role: 'staff',
        canCreateRestaurant: false,
        restaurantCreationLimit: 0,
      },
    ];

    for (const a of adminsToCreate) {
      await prisma.admin.create({
        data: {
          email: a.email,
          password: a.password,
          name: a.name,
          role: a.role,
          status: 'active',
          restaurantId: restaurant.id,
          accountId: account.id,
          canCreateRestaurant: a.canCreateRestaurant,
          restaurantCreationLimit: a.restaurantCreationLimit,
          restaurantsCreatedCount: 0,
          mustChangePassword: false,
        },
      });
    }
    console.log(`[auto-seed] ${adminsToCreate.length} admins created (all linked to Account, SaaS fields set).`);

    // ── 6. Create Customers ──
    const clientPw = hashSync('client123', 10);
    const customerData = [
      { email: 'aminata@gmail.com', name: 'Aminata Camara', phone: '+224 620 11 22 33', address: 'Kaloum, Conakry', loyaltyPoints: 250, totalOrders: 8, totalSpent: money(680000), status: 'active' },
      { email: 'mamadou@gmail.com', name: 'Mamadou Bah', phone: '+224 628 44 55 66', address: 'Dixinn, Conakry', loyaltyPoints: 180, totalOrders: 5, totalSpent: money(425000), status: 'active' },
      { email: 'fatoumata@gmail.com', name: 'Fatoumata Diallo', phone: '+224 622 77 88 99', address: 'Matam, Conakry', loyaltyPoints: 350, totalOrders: 12, totalSpent: money(1150000), status: 'active' },
    ];
    for (const c of customerData) {
      await prisma.customer.create({
        data: { ...c, password: clientPw, restaurantId: restaurant.id },
      });
    }
    console.log(`[auto-seed] ${customerData.length} customers created.`);

    // ── 7. Create Drivers ──
    const driverPw = hashSync('driver123', 10);
    const driverData = [
      { email: 'moussa@kfm-delice.com', name: 'Moussa Condé', phone: '+224 620 11 22 33', vehicle: 'moto', status: 'available', rating: 4.8, totalDeliveries: 156, zone: 'Kaloum' },
      { email: 'ibrahima@kfm-delice.com', name: 'Ibrahima Sow', phone: '+224 628 44 55 66', vehicle: 'moto', status: 'busy', rating: 4.6, totalDeliveries: 98, zone: 'Dixinn' },
      { email: 'abdoulaye@kfm-delice.com', name: 'Abdoulaye Diallo', phone: '+224 622 77 88 99', vehicle: 'velo', status: 'available', rating: 4.9, totalDeliveries: 210, zone: 'Matam' },
    ];
    for (const d of driverData) {
      await prisma.driver.create({
        data: { ...d, password: driverPw, restaurantId: restaurant.id },
      });
    }
    console.log(`[auto-seed] ${driverData.length} drivers created.`);

    // ── 8. Create Menu Items ──
    const menuItems = [
      { name: 'Salade KFM', description: 'Salade fraîche aux légumes de saison', price: money(15000), category: 'entrees', image: '/images/kfm-dish-3.png', badge: 'Végétarien', popular: true, order: 1, restaurantId: restaurant.id },
      { name: 'Brochettes de Crevettes', description: 'Crevettes marinées aux épices guinéennes', price: money(25000), category: 'entrees', image: '/images/kfm-dish-2.png', badge: 'Mer', popular: false, order: 2, restaurantId: restaurant.id },
      { name: 'Riz Jollof KFM Spécial', description: 'Notre riz jollof signature avec poulet braisé', price: money(35000), category: 'plats', image: '/images/dish-1.png', badge: 'Signature', popular: true, order: 5, restaurantId: restaurant.id },
      { name: 'Agneau Braisé aux Épices', description: 'Agneau fondant braisé, alloco et sauce yassa', price: money(40000), category: 'plats', image: '/images/kfm-dish-1.png', badge: 'Premium', popular: true, order: 6, restaurantId: restaurant.id },
      { name: 'Poisson Grillé Entier', description: 'Poisson frais du jour grillé au charbon', price: money(30000), category: 'plats', image: '/images/dish-3.png', badge: 'Frais', popular: false, order: 7, restaurantId: restaurant.id },
      { name: 'Poulet Yassa Maison', description: 'Poulet mariné au citron, oignons caramélisés', price: money(28000), category: 'plats', image: '/images/kfm-dish-5.png', badge: 'Maison', popular: true, order: 9, restaurantId: restaurant.id },
      { name: 'Thieboudienne KFM', description: 'Riz au poisson, sauce tomate traditionnelle', price: money(30000), category: 'plats', image: '/images/kfm-dish-6.png', badge: 'Chef', popular: true, order: 10, restaurantId: restaurant.id },
      { name: 'Plateau Fruits de Mer', description: 'Crevettes, crabes, huîtres pour 2 personnes', price: money(55000), category: 'mer', image: '/images/kfm-dish-2.png', badge: '2 pers.', popular: true, order: 13, restaurantId: restaurant.id },
      { name: 'Homard Grillé', description: 'Homard entier grillé au beurre d\'ail', price: money(75000), category: 'mer', image: '/images/kfm-dish-10.png', badge: 'Luxe', popular: true, order: 15, restaurantId: restaurant.id },
      { name: 'Assiette Fruits Tropicaux', description: 'Mangue, ananas, papaye de saison', price: money(12000), category: 'desserts', image: '/images/kfm-dish-3.png', badge: 'Frais', popular: true, order: 16, restaurantId: restaurant.id },
      { name: 'Bissap', description: 'Jus d\'hibiscus glacé traditionnel', price: money(5000), category: 'boissons', image: '/images/kfm-dish-11.png', badge: 'Traditionnel', popular: true, order: 18, restaurantId: restaurant.id },
      { name: 'Jus de Gingembre', description: 'Gingembre frais au citron et miel', price: money(5000), category: 'boissons', image: '/images/kfm-dish-12.png', badge: 'Épicé', popular: true, order: 19, restaurantId: restaurant.id },
    ];
    await prisma.menuItem.createMany({ data: menuItems });
    console.log(`[auto-seed] ${menuItems.length} menu items created.`);

    // ── 9. Create Reviews ──
    await prisma.review.createMany({
      data: [
        { customerName: 'Aminata Camara', rating: 5, comment: 'Le meilleur restaurant de Conakry !', date: 'Mai 2026', restaurantId: restaurant.id },
        { customerName: 'Mamadou Bah', rating: 5, comment: 'Espace VIP parfait pour les dîners d\'affaires.', date: 'Avril 2026', restaurantId: restaurant.id },
        { customerName: 'Fatoumata Diallo', rating: 5, comment: 'Surprise d\'anniversaire inoubliable !', date: 'Mars 2026', restaurantId: restaurant.id },
        { customerName: 'Ibrahim Touré', rating: 4, comment: 'Fruits de mer très frais, menu digital moderne.', date: 'Février 2026', restaurantId: restaurant.id },
        { customerName: 'Kadiatou Sylla', rating: 5, comment: 'Ambiance terrasse au coucher du soleil, magique.', date: 'Janvier 2026', restaurantId: restaurant.id },
      ],
    });
    console.log('[auto-seed] 5 reviews created.');

    // ── 10. Create Staff ──
    await prisma.staff.createMany({
      data: [
        { name: 'Chefs de Cuisine Mamadou', phone: '+224 620 99 88 77', role: 'cuisinier', salary: money(1500000), status: 'active', hireDate: '2023-03-15', notes: 'Chef principal', restaurantId: restaurant.id },
        { name: 'Fatoumata Camara', phone: '+224 621 55 44 33', role: 'serveur', salary: money(600000), status: 'active', hireDate: '2023-06-01', notes: 'Service en salle', restaurantId: restaurant.id },
        { name: 'Ibrahima Diallo', phone: '+224 622 33 22 11', role: 'barman', salary: money(700000), status: 'active', hireDate: '2023-08-20', notes: 'Spécialiste cocktails', restaurantId: restaurant.id },
        { name: 'Alpha Sow', phone: '+224 627 88 99 00', role: 'gerant', salary: money(1200000), status: 'active', hireDate: '2022-01-15', notes: 'Gérant adjoint', restaurantId: restaurant.id },
      ],
    });
    console.log('[auto-seed] 4 staff created.');

    console.log('[auto-seed] ✓ SaaS-coherent seed complete!');
    console.log('[auto-seed]   Account  →', account.id);
    console.log('[auto-seed]   Restaurant →', restaurant.id, '(type=principal, accountId set)');
    console.log('[auto-seed]   Admins   → 3 (admin can create secondaries, manager/staff cannot)');
  } catch (error) {
    console.error('[auto-seed] Error:', error.message);
    console.error('[auto-seed] Stack:', error.stack);
    // Don't exit non-zero — let the server start anyway. Backfill will
    // run next and may fix partial state.
  } finally {
    await prisma.$disconnect();
  }
}

main();
