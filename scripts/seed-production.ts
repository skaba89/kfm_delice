/**
 * KFM Delice — Production Re-Seed Script
 * ---------------------------------------
 * Purges ALL transactional/test data and inserts clean, production-ready data.
 *
 * Key differences from prisma/seed.ts:
 *   - Forces random 16-char passwords for every account (admin, customer, driver)
 *   - Sets `mustChangePassword = true` on every account (forced reset at first login)
 *   - Removes ALL test orders, reservations, reviews, invoices, quotes, expenses
 *   - Keeps reference data only: restaurant config, menu, staff, drivers, customers
 *   - Prints a credential report at the end (save it securely!)
 *
 * Usage:
 *   # Local dev (SQLite)
 *   bunx tsx scripts/seed-production.ts
 *
 *   # Production (PostgreSQL — set DATABASE_URL first)
 *   DATABASE_URL="postgresql://user:pass@host:5432/db" \
 *   JWT_SECRET="..." \
 *   bunx tsx scripts/seed-production.ts
 *
 * Flags:
 *   --keep-orders    : do not delete existing orders (rare, only if you have real orders already)
 *   --dry-run        : print what would happen, do not write
 *   --yes            : skip the interactive confirmation prompt
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { createInterface } from "readline";

const prisma = new PrismaClient();

const FLAGS = {
  keepOrders: process.argv.includes("--keep-orders"),
  dryRun: process.argv.includes("--dry-run"),
  yes: process.argv.includes("--yes"),
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function genPassword(): string {
  // 12 bytes → 24 hex chars; ensure complexity by injecting markers
  const raw = randomBytes(12).toString("hex");
  return `Kfm-${raw}-2026`;
}

function now(): string {
  return new Date().toISOString();
}

function section(title: string) {
  console.log("\n" + "─".repeat(60));
  console.log(`▶ ${title}`);
  console.log("─".repeat(60));
}

async function confirm(prompt: string): Promise<boolean> {
  if (FLAGS.yes) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase().startsWith("y"));
    });
  });
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   KFM DELICE — PRODUCTION RE-SEED                        ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Mode        : ${FLAGS.dryRun ? "DRY-RUN (no writes)" : "LIVE"}`);
  console.log(`  Database    : ${process.env.DATABASE_URL ? "via DATABASE_URL" : "default (prisma)"}`);
  console.log(`  Keep orders : ${FLAGS.keepOrders ? "YES" : "NO (will purge)"}`);
  console.log(`  Started     : ${now()}`);

  if (process.env.NODE_ENV !== "production") {
    console.log("\n  ⚠️  WARNING: NODE_ENV is not 'production'.");
    console.log("     This script is designed for production use.");
    console.log("     Make sure DATABASE_URL points to the production DB.");
  }

  if (!process.env.JWT_SECRET) {
    console.log("\n  ⚠️  WARNING: JWT_SECRET is not set in env.");
    console.log("     It MUST be set in production before starting the app.");
  }

  // ---- Safety confirmation ----
  if (!FLAGS.dryRun) {
    const ok = await confirm(
      "\n  This will PURGE all transactional data and reset all account passwords.\n  Type 'yes' to continue, anything else to abort: "
    );
    if (!ok) {
      console.log("Aborted. No changes made.");
      return;
    }
  }

  // ============================================================
  // 1. PURGE TRANSACTIONAL DATA
  // ============================================================
  section("1. Purging transactional & test data");

  const purgeOrder: Array<[string, () => Promise<number>]> = [
    ["PushSubscription", () => prisma.pushSubscription.deleteMany()],
    ["StockMovement", () => prisma.stockMovement.deleteMany()],
    ["LoyaltyPointsHistory", () => prisma.loyaltyPointsHistory.deleteMany()],
    ["LoyaltyReward", () => prisma.loyaltyReward.deleteMany()],
    ["Payment", () => prisma.payment.deleteMany()],
    ["Expense", () => prisma.expense.deleteMany()],
    ["Quote", () => prisma.quote.deleteMany()],
    ["Invoice", () => prisma.invoice.deleteMany()],
    ["Review", () => prisma.review.deleteMany()],
    ["Reservation", () => prisma.reservation.deleteMany()],
    ...(FLAGS.keepOrders ? [] : ([["Order", () => prisma.order.deleteMany()]] as Array<[string, () => Promise<number>]>)),
    ["StockItem", () => prisma.stockItem.deleteMany()],
    ["Staff", () => prisma.staff.deleteMany()],
    ["Driver", () => prisma.driver.deleteMany()],
    ["Customer", () => prisma.customer.deleteMany()],
    ["Admin", () => prisma.admin.deleteMany()],
  ];

  for (const [name, fn] of purgeOrder) {
    if (FLAGS.dryRun) {
      console.log(`  [dry-run] would DELETE from ${name}`);
      continue;
    }
    const r = await fn();
    console.log(`  ✓ ${name}: ${r.count} rows deleted`);
  }

  // ============================================================
  // 2. PLATFORM ADMIN (single super-admin)
  // ============================================================
  section("2. Creating platform admin");

  const platformPw = genPassword();
  const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL || "admin@restaurantpro.com";
  if (!FLAGS.dryRun) {
    await prisma.platformAdmin.upsert({
      where: { email: platformAdminEmail },
      update: { password: await hash(platformPw, 10), status: "active" },
      create: {
        email: platformAdminEmail,
        password: await hash(platformPw, 10),
        name: "Super Admin",
        role: "super_admin",
        status: "active",
      },
    });
  }
  console.log(`  ✓ Platform admin: ${platformAdminEmail}`);
  console.log(`    Password: ${platformPw}  ⚠️ SAVE THIS SECURELY`);

  // ============================================================
  // 3. RESTAURANT + CONFIG (idempotent)
  // ============================================================
  section("3. Ensuring restaurant entity");

  const restaurantSlug = process.env.RESTAURANT_SLUG || "kfm-delice";
  const restaurantData = {
    name: "KFM Delice",
    slug: restaurantSlug,
    tagline: "L'Art du Goût Guinéen",
    description:
      "Restaurant gastronomique au cœur de Conakry. Cuisine guinéenne raffinée, fruits de mer frais et ambiance VIP avec vue sur l'Atlantique.",
    phone: process.env.RESTAURANT_PHONE || "+224 622 34 56 78",
    whatsapp: process.env.RESTAURANT_WHATSAPP || "+224 622 34 56 78",
    email: process.env.RESTAURANT_EMAIL || "reservation@kfm-delice.com",
    address: "Almamya, Corniche Nord, Conakry, Guinée",
    hours: "Lun-Dim : 11h00 - 23h00",
    rating: 4.9,
    tables: 25,
    deliveryFee: 5000,
    minDelivery: 15000,
    deliveryZones: "Kaloum:Dixinn:Matam:Matoto",
    plan: "pro",
    status: "active",
    currency: "GNF",
    locale: "fr",
    ownerEmail: "admin@kfm-delice.com",
    ownerName: "Admin KFM Delice",
    ownerPhone: "+224 622 34 56 78",
  };

  let restaurantId: string;
  if (FLAGS.dryRun) {
    const existing = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug } });
    restaurantId = existing?.id ?? "dry-run-id";
    console.log(`  [dry-run] would upsert restaurant ${restaurantSlug}`);
  } else {
    const r = await prisma.restaurant.upsert({
      where: { slug: restaurantSlug },
      update: { ...restaurantData, status: "active" },
      create: restaurantData,
    });
    restaurantId = r.id;
    console.log(`  ✓ Restaurant ready (id: ${restaurantId})`);
  }

  if (!FLAGS.dryRun) {
    await prisma.restaurantConfig.upsert({
      where: { restaurantId },
      update: {},
      create: {
        restaurantId,
        heroImage: "/images/kfm-hero.png",
        primaryColor: "#ea580c",
        accentColor: "#f97316",
        menuCategories: JSON.stringify([
          { id: "entrees", name: "Entrées" },
          { id: "plats", name: "Plats Principaux" },
          { id: "mer", name: "Fruits de Mer" },
          { id: "desserts", name: "Desserts" },
          { id: "boissons", name: "Boissons" },
        ]),
        features: JSON.stringify({
          delivery: true,
          reservations: true,
          reviews: true,
          loyalty: true,
          pos: true,
          invoices: true,
          quotes: true,
          expenses: true,
          staff: true,
          drivers: true,
        }),
        openingHours: JSON.stringify({ open: 11, close: 23, timezone: "Africa/Conakry" }),
        socialLinks: JSON.stringify({
          facebook: "https://facebook.com/kfmdelice",
          instagram: "https://instagram.com/kfmdelice",
          twitter: "",
        }),
      },
    });
    console.log("  ✓ Restaurant config ready");
  }

  // ============================================================
  // 4. ADMINS (3 — forced random passwords)
  // ============================================================
  section("4. Creating admin accounts");

  const adminSpecs = [
    { email: "admin@kfm-delice.com", name: "Admin KFM Delice", role: "admin" as const },
    { email: "manager@kfm-delice.com", name: "Aminata Diallo", role: "manager" as const },
    { email: "staff@kfm-delice.com", name: "Ibrahima Touré", role: "staff" as const },
  ];
  const adminCreds: Array<{ email: string; password: string; role: string }> = [];

  for (const a of adminSpecs) {
    const pw = genPassword();
    adminCreds.push({ email: a.email, password: pw, role: a.role });
    if (!FLAGS.dryRun) {
      await prisma.admin.upsert({
        where: { email: a.email },
        update: { password: await hash(pw, 10), name: a.name, role: a.role, status: "active", mustChangePassword: true, restaurantId },
        create: {
          email: a.email,
          password: await hash(pw, 10),
          name: a.name,
          role: a.role,
          status: "active",
          mustChangePassword: true,
          restaurantId,
        },
      });
    }
    console.log(`  ✓ ${a.role.padEnd(8)} | ${a.email} | password: ${pw}`);
  }

  // ============================================================
  // 5. CUSTOMERS (real Guinean names, no test garbage)
  // ============================================================
  section("5. Creating customer accounts");

  const customerSpecs = [
    { email: "aminata.camara@gmail.com", name: "Aminata Camara", phone: "+224 620 11 22 33", address: "Kaloum, Conakry" },
    { email: "mamadou.bah@gmail.com", name: "Mamadou Bah", phone: "+224 628 44 55 66", address: "Dixinn, Conakry" },
    { email: "fatoumata.diallo@gmail.com", name: "Fatoumata Diallo", phone: "+224 622 77 88 99", address: "Matam, Conakry" },
    { email: "ibrahim.toure@gmail.com", name: "Ibrahim Touré", phone: "+224 621 22 33 44", address: "Matoto, Conakry" },
    { email: "kadiatou.sylla@gmail.com", name: "Kadiatou Sylla", phone: "+224 625 55 66 77", address: "Corniche Nord, Conakry" },
  ];
  const customerCreds: Array<{ email: string; password: string }> = [];

  for (const c of customerSpecs) {
    const pw = genPassword();
    customerCreds.push({ email: c.email, password: pw });
    if (!FLAGS.dryRun) {
      // Composite unique key (email + restaurantId) — must do findFirst then create/update
      const existing = await prisma.customer.findFirst({
        where: { email: c.email, restaurantId },
      });
      const base = {
        name: c.name,
        phone: c.phone,
        address: c.address,
        loyaltyPoints: 0,
        totalOrders: 0,
        totalSpent: 0,
        status: "active" as const,
        password: await hash(pw, 10),
        mustChangePassword: true,
        restaurantId,
      };
      if (existing) {
        await prisma.customer.update({ where: { id: existing.id }, data: base });
      } else {
        await prisma.customer.create({ data: { email: c.email, ...base } });
      }
    }
    console.log(`  ✓ ${c.email} | password: ${pw}`);
  }

  // ============================================================
  // 6. DRIVERS (moto-taxi delivery team)
  // ============================================================
  section("6. Creating driver accounts");

  const driverSpecs = [
    { email: "moussa.conde@kfm-delice.com", name: "Moussa Condé", phone: "+224 620 11 22 33", vehicle: "moto" as const, zone: "Kaloum" },
    { email: "ibrahima.sow@kfm-delice.com", name: "Ibrahima Sow", phone: "+224 628 44 55 66", vehicle: "moto" as const, zone: "Dixinn" },
    { email: "abdoulaye.diallo@kfm-delice.com", name: "Abdoulaye Diallo", phone: "+224 622 77 88 99", vehicle: "velo" as const, zone: "Matam" },
    { email: "ousmane.camara@kfm-delice.com", name: "Ousmane Camara", phone: "+224 625 55 66 77", vehicle: "moto" as const, zone: "Matoto" },
    { email: "mamadou.driver@kfm-delice.com", name: "Mamadou Bah", phone: "+224 621 22 33 44", vehicle: "voiture" as const, zone: "Conakry" },
  ];
  const driverCreds: Array<{ email: string; password: string }> = [];

  for (const d of driverSpecs) {
    const pw = genPassword();
    driverCreds.push({ email: d.email, password: pw });
    if (!FLAGS.dryRun) {
      const existing = await prisma.driver.findFirst({
        where: { email: d.email, restaurantId },
      });
      const base = {
        name: d.name,
        phone: d.phone,
        vehicle: d.vehicle,
        zone: d.zone,
        status: "available" as const,
        rating: 0,
        totalDeliveries: 0,
        password: await hash(pw, 10),
        mustChangePassword: true,
        restaurantId,
      };
      if (existing) {
        await prisma.driver.update({ where: { id: existing.id }, data: base });
      } else {
        await prisma.driver.create({ data: { email: d.email, ...base } });
      }
    }
    console.log(`  ✓ ${d.email} (${d.vehicle}/${d.zone}) | password: ${pw}`);
  }

  // ============================================================
  // 7. MENU ITEMS (full menu — idempotent via count check)
  // ============================================================
  section("7. Ensuring menu items");

  const menuCount = await prisma.menuItem.count({ where: { restaurantId } });
  if (menuCount > 0) {
    console.log(`  ✓ Menu already populated (${menuCount} items), keeping existing`);
  } else if (FLAGS.dryRun) {
    console.log("  [dry-run] would insert 21 menu items");
  } else {
    const menuItems = [
      { name: "Salade KFM", description: "Salade fraîche aux légumes de saison, avocat, mangue verte", price: 15000, category: "entrees", image: "/images/kfm-dish-3.png", badge: "Végétarien", popular: true, order: 1, restaurantId },
      { name: "Brochettes de Crevettes", description: "Crevettes marinées aux épices guinéennes, grillées au charbon", price: 25000, category: "entrees", image: "/images/kfm-dish-2.png", badge: "Mer", popular: false, order: 2, restaurantId },
      { name: "Soupe de Poisson KFM", description: "Soupe traditionnelle de poisson frais du jour", price: 18000, category: "entrees", image: "/images/kfm-dish-4.png", badge: "Maison", popular: true, order: 3, restaurantId },
      { name: "Alloco Complet", description: "Alloco croustillant, sauce tomate pimentée et poisson fumé", price: 12000, category: "entrees", image: "/images/kfm-dish-8.png", badge: "Local", popular: true, order: 4, restaurantId },
      { name: "Riz Jollof KFM Spécial", description: "Notre riz jollof signature avec poulet braisé aux herbes", price: 35000, category: "plats", image: "/images/dish-1.png", badge: "Signature", popular: true, order: 5, restaurantId },
      { name: "Agneau Braisé aux Épices", description: "Agneau fondant braisé, alloco croustillant et sauce yassa", price: 40000, category: "plats", image: "/images/kfm-dish-1.png", badge: "Premium", popular: true, order: 6, restaurantId },
      { name: "Poisson Grillé Entier", description: "Poisson frais du jour grillé au charbon de bois", price: 30000, category: "plats", image: "/images/dish-3.png", badge: "Frais", popular: false, order: 7, restaurantId },
      { name: "Plasas Traditionnel", description: "Plasas aux feuilles de manioc, poisson fumé, viande de chèvre", price: 25000, category: "plats", image: "/images/dish-2.png", badge: "Traditionnel", popular: false, order: 8, restaurantId },
      { name: "Poulet Yassa Maison", description: "Poulet mariné au citron et oignons caramélisés, riz blanc", price: 28000, category: "plats", image: "/images/kfm-dish-5.png", badge: "Maison", popular: true, order: 9, restaurantId },
      { name: "Thieboudienne KFM", description: "Riz au poisson et légumes, sauce tomate traditionnelle", price: 30000, category: "plats", image: "/images/kfm-dish-6.png", badge: "Chef", popular: true, order: 10, restaurantId },
      { name: "Mafé Viande", description: "Ragoût d'arachide à la viande de bœuf, riz ou foufou", price: 27000, category: "plats", image: "/images/kfm-dish-9.png", badge: "Traditionnel", popular: false, order: 11, restaurantId },
      { name: "Attiéké Poisson", description: "Semoule de manioc au poisson grillé, piment et tomate", price: 25000, category: "plats", image: "/images/kfm-dish-7.png", badge: "Ivoirien", popular: true, order: 12, restaurantId },
      { name: "Plateau Fruits de Mer KFM", description: "Crevettes, crabes, huîtres et poisson fumé pour 2 personnes", price: 55000, category: "mer", image: "/images/kfm-dish-2.png", badge: "2 pers.", popular: true, order: 13, restaurantId },
      { name: "Crevettes Sauce Curry", description: "Crevettes sautées au curry doux, lait de coco et riz basmati", price: 38000, category: "mer", image: "/images/kfm-dish-2.png", badge: "Chef", popular: false, order: 14, restaurantId },
      { name: "Homard Grillé", description: "Homard entier grillé au beurre d'ail et citron", price: 75000, category: "mer", image: "/images/kfm-dish-10.png", badge: "Luxe", popular: true, order: 15, restaurantId },
      { name: "Assiette de Fruits Tropicaux", description: "Mangue, ananas, papaye et banane fraîche de saison", price: 12000, category: "desserts", image: "/images/kfm-dish-3.png", badge: "Frais", popular: true, order: 16, restaurantId },
      { name: "Gâteau Chocolat-Coco", description: "Fondant au chocolat noir et noix de coco râpée", price: 15000, category: "desserts", image: "/images/kfm-dish-3.png", badge: "Maison", popular: false, order: 17, restaurantId },
      { name: "Bissap", description: "Jus d'hibiscus glacé traditionnel, sucré et rafraîchissant", price: 5000, category: "boissons", image: "/images/kfm-dish-11.png", badge: "Traditionnel", popular: true, order: 18, restaurantId },
      { name: "Jus de Gingembre", description: "Jus de gingembre frais au citron et miel, pétillant", price: 5000, category: "boissons", image: "/images/kfm-dish-12.png", badge: "Épicé", popular: true, order: 19, restaurantId },
      { name: "Cocktail Mangue-Passion", description: "Cocktail sans alcool mangue et fruit de la passion", price: 8000, category: "boissons", image: "/images/kfm-dish-11.png", badge: "Exotique", popular: false, order: 20, restaurantId },
      { name: "Eau Minérale", description: "Eau minérale gazeuse ou plate 50cl", price: 3000, category: "boissons", image: "/images/kfm-dish-12.png", badge: "", popular: false, order: 21, restaurantId },
    ];
    await prisma.menuItem.createMany({ data: menuItems });
    console.log(`  ✓ ${menuItems.length} menu items created`);
  }

  // ============================================================
  // 8. STAFF (real team — no test entries)
  // ============================================================
  section("8. Creating staff records (no login)");

  const staffSpecs = [
    { name: "Mamadou Chef", phone: "+224 620 99 88 77", role: "cuisinier", salary: 1500000, hireDate: "2023-03-15", notes: "Chef principal, 10 ans d'expérience" },
    { name: "Fatoumata Camara", phone: "+224 621 55 44 33", role: "serveur", salary: 600000, hireDate: "2023-06-01", notes: "Service en salle" },
    { name: "Ibrahima Diallo", phone: "+224 622 33 22 11", role: "barman", salary: 700000, hireDate: "2023-08-20", notes: "Spécialiste cocktails" },
    { name: "Aissatou Bah", phone: "+224 623 44 55 66", role: "serveur", salary: 600000, hireDate: "2024-01-10", notes: "Congé maternité jusqu'en juillet" },
    { name: "Moussa Sylla", phone: "+224 624 77 88 99", role: "plongeur", salary: 400000, hireDate: "2024-02-01", notes: "" },
    { name: "Ousmane Touré", phone: "+224 625 11 22 33", role: "securite", salary: 500000, hireDate: "2023-11-15", notes: "Agent de sécurité nocturne" },
    { name: "Mariama Condé", phone: "+224 626 55 66 77", role: "caissier", salary: 650000, hireDate: "2023-05-01", notes: "Gestion caisse et Orange Money" },
    { name: "Alpha Sow", phone: "+224 627 88 99 00", role: "gerant", salary: 1200000, hireDate: "2022-01-15", notes: "Gérant adjoint" },
  ];

  if (FLAGS.dryRun) {
    console.log(`  [dry-run] would insert ${staffSpecs.length} staff`);
  } else {
    await prisma.staff.createMany({
      data: staffSpecs.map((s) => ({ ...s, status: "active" as const, restaurantId })),
    });
    console.log(`  ✓ ${staffSpecs.length} staff created`);
  }

  // ============================================================
  // 9. FINAL REPORT
  // ============================================================
  section("9. Credential report");

  console.log("\n  ╔══════════════════════════════════════════════════════════╗");
  console.log("  ║  ⚠️  SAVE THESE CREDENTIALS IN A SECURE VAULT           ║");
  console.log("  ║  All accounts must change password at first login       ║");
  console.log("  ╚══════════════════════════════════════════════════════════╝\n");

  console.log("  ── Platform Admin ──");
  console.log(`    Email    : ${platformAdminEmail}`);
  console.log(`    Password : ${platformPw}\n`);

  console.log("  ── Restaurant Admins ──");
  for (const a of adminCreds) {
    console.log(`    [${a.role.padEnd(8)}] ${a.email}`);
    console.log(`             password: ${a.password}\n`);
  }

  console.log("  ── Customers ──");
  for (const c of customerCreds) {
    console.log(`    ${c.email}`);
    console.log(`      password: ${c.password}`);
  }

  console.log("\n  ── Drivers ──");
  for (const d of driverCreds) {
    console.log(`    ${d.email}`);
    console.log(`      password: ${d.password}`);
  }

  console.log("\n  ── Post-seed checklist ──");
  console.log("    [ ] Set JWT_SECRET env var on Render (32+ random chars)");
  console.log("    [ ] Set DATABASE_URL on Render (PostgreSQL connection string)");
  console.log("    [ ] Set NODE_ENV=production");
  console.log("    [ ] Revoke the 4 leaked GitHub tokens (P0)");
  console.log("    [ ] Distribute the credentials above to each user via a secure channel");
  console.log("    [ ] Rotate these credentials again in 90 days");

  console.log(`\n  Completed at: ${now()}`);
  console.log(`  Mode: ${FLAGS.dryRun ? "DRY-RUN (no changes persisted)" : "LIVE — data has been written"}\n`);
}

main()
  .catch(async (e) => {
    console.error("\n[seed-production] Fatal error:", e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
