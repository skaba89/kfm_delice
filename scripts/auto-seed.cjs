/**
 * Auto-seed script — runs before Next.js starts on Render
 * Seeds the database only if it's empty (no restaurants)
 * Uses CommonJS for maximum compatibility with Prisma + bcryptjs
 */

// ─── Database URL resolution (mirror of src/lib/db.ts) ───────────
// Accept file:, postgresql://, postgres://. In production, a missing
// DATABASE_URL is a fatal misconfiguration. Never override a valid
// PostgreSQL URL with a SQLite fallback.
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

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function main() {
  try {
    console.log('[auto-seed] Checking database...');
    // (Don't log DATABASE_URL here — it contains credentials. Provider
    // is already logged above.)

    // ── Production auto-seed gate ────────────────────────────────
    // In production, automatically seeding a fresh database with known
    // demo credentials (admin@kfm-delice.com / kfm2024, etc.) is a
    // security risk: anyone who reads the source code can log in.
    //
    // We require an explicit opt-in via ALLOW_AUTO_SEED=true for
    // production deployments. Dev/staging environments continue to
    // auto-seed for convenience.
    //
    // KFM Delice currently uses ALLOW_AUTO_SEED=true on Render to keep
    // the demo working. Set it to "false" (or remove it) once real
    // production data is in place.
    const isProduction = process.env.NODE_ENV === 'production';
    const allowAutoSeed = process.env.ALLOW_AUTO_SEED === 'true';
    if (isProduction && !allowAutoSeed) {
      console.log('[auto-seed] Production mode + ALLOW_AUTO_SEED not "true" → skipping auto-seed.');
      console.log('[auto-seed] Set ALLOW_AUTO_SEED=true in Render Environment to enable demo seeding.');
      return;
    }

    // Test DB connection
    await prisma.$connect();
    console.log('[auto-seed] Database connected.');

    const restaurantCount = await prisma.restaurant.count();
    if (restaurantCount > 0) {
      console.log(`[auto-seed] Database already has ${restaurantCount} restaurant(s), skipping.`);
      return;
    }

    console.log('[auto-seed] Empty database detected, seeding...');

    // Create platform admin
    const platformPw = hashSync('platform2024', 10);
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
    console.log('[auto-seed] Platform admin created.');

    // Create restaurant
    const restaurant = await prisma.restaurant.upsert({
      where: { slug: 'kfm-delice' },
      update: {},
      create: {
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
        deliveryFee: 5000,
        minDelivery: 15000,
        deliveryZones: 'Kaloum:Dixinn:Matam:Matoto',
        plan: 'pro',
        status: 'active',
        currency: 'GNF',
        locale: 'fr',
        ownerEmail: 'admin@kfm-delice.com',
        ownerName: 'Admin KFM Delice',
        ownerPhone: '+224 622 34 56 78',
      },
    });
    console.log(`[auto-seed] Restaurant created (id: ${restaurant.id}).`);

    // Create restaurant config
    await prisma.restaurantConfig.upsert({
      where: { restaurantId: restaurant.id },
      update: {},
      create: {
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
    console.log('[auto-seed] Restaurant config created.');

    // Create admins
    const adminPw1 = hashSync('kfm2024', 10);
    const adminPw2 = hashSync('manager2024', 10);
    const adminPw3 = hashSync('staff2024', 10);

    await prisma.admin.upsert({
      where: { email: 'admin@kfm-delice.com' },
      update: { password: adminPw1 },
      create: { email: 'admin@kfm-delice.com', password: adminPw1, name: 'Admin KFM Delice', role: 'admin', status: 'active', restaurantId: restaurant.id },
    });
    await prisma.admin.upsert({
      where: { email: 'manager@kfm-delice.com' },
      update: { password: adminPw2 },
      create: { email: 'manager@kfm-delice.com', password: adminPw2, name: 'Aminata Diallo', role: 'manager', status: 'active', restaurantId: restaurant.id },
    });
    await prisma.admin.upsert({
      where: { email: 'staff@kfm-delice.com' },
      update: { password: adminPw3 },
      create: { email: 'staff@kfm-delice.com', password: adminPw3, name: 'Ibrahima Touré', role: 'staff', status: 'active', restaurantId: restaurant.id },
    });
    console.log('[auto-seed] 3 admins created.');

    // Create customers
    const clientPw = hashSync('client123', 10);
    const customerData = [
      { email: 'aminata@gmail.com', name: 'Aminata Camara', phone: '+224 620 11 22 33', address: 'Kaloum, Conakry', loyaltyPoints: 250, totalOrders: 8, totalSpent: 680000, status: 'active' },
      { email: 'mamadou@gmail.com', name: 'Mamadou Bah', phone: '+224 628 44 55 66', address: 'Dixinn, Conakry', loyaltyPoints: 180, totalOrders: 5, totalSpent: 425000, status: 'active' },
      { email: 'fatoumata@gmail.com', name: 'Fatoumata Diallo', phone: '+224 622 77 88 99', address: 'Matam, Conakry', loyaltyPoints: 350, totalOrders: 12, totalSpent: 1150000, status: 'active' },
    ];
    for (const c of customerData) {
      const existing = await prisma.customer.findFirst({ where: { email: c.email, restaurantId: restaurant.id } });
      if (!existing) {
        await prisma.customer.create({ data: { ...c, password: clientPw, restaurantId: restaurant.id } });
      }
    }
    console.log(`[auto-seed] ${customerData.length} customers created.`);

    // Create drivers
    const driverPw = hashSync('driver123', 10);
    const driverData = [
      { email: 'moussa@kfm-delice.com', name: 'Moussa Condé', phone: '+224 620 11 22 33', vehicle: 'moto', status: 'available', rating: 4.8, totalDeliveries: 156, zone: 'Kaloum' },
      { email: 'ibrahima@kfm-delice.com', name: 'Ibrahima Sow', phone: '+224 628 44 55 66', vehicle: 'moto', status: 'busy', rating: 4.6, totalDeliveries: 98, zone: 'Dixinn' },
      { email: 'abdoulaye@kfm-delice.com', name: 'Abdoulaye Diallo', phone: '+224 622 77 88 99', vehicle: 'velo', status: 'available', rating: 4.9, totalDeliveries: 210, zone: 'Matam' },
    ];
    for (const d of driverData) {
      const existing = await prisma.driver.findFirst({ where: { email: d.email, restaurantId: restaurant.id } });
      if (!existing) {
        await prisma.driver.create({ data: { ...d, password: driverPw, restaurantId: restaurant.id } });
      }
    }
    console.log(`[auto-seed] ${driverData.length} drivers created.`);

    // Create menu items
    const menuCount = await prisma.menuItem.count({ where: { restaurantId: restaurant.id } });
    if (menuCount === 0) {
      const menuItems = [
        { name: 'Salade KFM', description: 'Salade fraîche aux légumes de saison', price: 15000, category: 'entrees', image: '/images/kfm-dish-3.png', badge: 'Végétarien', popular: true, order: 1, restaurantId: restaurant.id },
        { name: 'Brochettes de Crevettes', description: 'Crevettes marinées aux épices guinéennes', price: 25000, category: 'entrees', image: '/images/kfm-dish-2.png', badge: 'Mer', popular: false, order: 2, restaurantId: restaurant.id },
        { name: 'Riz Jollof KFM Spécial', description: 'Notre riz jollof signature avec poulet braisé', price: 35000, category: 'plats', image: '/images/dish-1.png', badge: 'Signature', popular: true, order: 5, restaurantId: restaurant.id },
        { name: 'Agneau Braisé aux Épices', description: 'Agneau fondant braisé, alloco et sauce yassa', price: 40000, category: 'plats', image: '/images/kfm-dish-1.png', badge: 'Premium', popular: true, order: 6, restaurantId: restaurant.id },
        { name: 'Poisson Grillé Entier', description: 'Poisson frais du jour grillé au charbon', price: 30000, category: 'plats', image: '/images/dish-3.png', badge: 'Frais', popular: false, order: 7, restaurantId: restaurant.id },
        { name: 'Poulet Yassa Maison', description: 'Poulet mariné au citron, oignons caramélisés', price: 28000, category: 'plats', image: '/images/kfm-dish-5.png', badge: 'Maison', popular: true, order: 9, restaurantId: restaurant.id },
        { name: 'Thieboudienne KFM', description: 'Riz au poisson, sauce tomate traditionnelle', price: 30000, category: 'plats', image: '/images/kfm-dish-6.png', badge: 'Chef', popular: true, order: 10, restaurantId: restaurant.id },
        { name: 'Plateau Fruits de Mer', description: 'Crevettes, crabes, huîtres pour 2 personnes', price: 55000, category: 'mer', image: '/images/kfm-dish-2.png', badge: '2 pers.', popular: true, order: 13, restaurantId: restaurant.id },
        { name: 'Homard Grillé', description: 'Homard entier grillé au beurre d\'ail', price: 75000, category: 'mer', image: '/images/kfm-dish-10.png', badge: 'Luxe', popular: true, order: 15, restaurantId: restaurant.id },
        { name: 'Assiette Fruits Tropicaux', description: 'Mangue, ananas, papaye de saison', price: 12000, category: 'desserts', image: '/images/kfm-dish-3.png', badge: 'Frais', popular: true, order: 16, restaurantId: restaurant.id },
        { name: 'Bissap', description: 'Jus d\'hibiscus glacé traditionnel', price: 5000, category: 'boissons', image: '/images/kfm-dish-11.png', badge: 'Traditionnel', popular: true, order: 18, restaurantId: restaurant.id },
        { name: 'Jus de Gingembre', description: 'Gingembre frais au citron et miel', price: 5000, category: 'boissons', image: '/images/kfm-dish-12.png', badge: 'Épicé', popular: true, order: 19, restaurantId: restaurant.id },
      ];
      await prisma.menuItem.createMany({ data: menuItems });
      console.log(`[auto-seed] ${menuItems.length} menu items created.`);
    }

    // Create reviews
    const reviewCount = await prisma.review.count({ where: { restaurantId: restaurant.id } });
    if (reviewCount === 0) {
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
    }

    // Create staff
    const staffCount = await prisma.staff.count({ where: { restaurantId: restaurant.id } });
    if (staffCount === 0) {
      await prisma.staff.createMany({
        data: [
          { name: 'Chefs de Cuisine Mamadou', phone: '+224 620 99 88 77', role: 'cuisinier', salary: 1500000, status: 'active', hireDate: '2023-03-15', notes: 'Chef principal', restaurantId: restaurant.id },
          { name: 'Fatoumata Camara', phone: '+224 621 55 44 33', role: 'serveur', salary: 600000, status: 'active', hireDate: '2023-06-01', notes: 'Service en salle', restaurantId: restaurant.id },
          { name: 'Ibrahima Diallo', phone: '+224 622 33 22 11', role: 'barman', salary: 700000, status: 'active', hireDate: '2023-08-20', notes: 'Spécialiste cocktails', restaurantId: restaurant.id },
          { name: 'Alpha Sow', phone: '+224 627 88 99 00', role: 'gerant', salary: 1200000, status: 'active', hireDate: '2022-01-15', notes: 'Gérant adjoint', restaurantId: restaurant.id },
        ],
      });
      console.log('[auto-seed] 4 staff created.');
    }

    console.log('[auto-seed] Seeding complete!');
  } catch (error) {
    console.error('[auto-seed] Error:', error.message);
    console.error('[auto-seed] Stack:', error.stack);
    // Don't exit with error code — let the server start anyway
  } finally {
    await prisma.$disconnect();
  }
}

main();
