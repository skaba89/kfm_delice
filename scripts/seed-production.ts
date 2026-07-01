/**
 * KFM Delice — Production Re-Seed Script (Slim Version)
 * ------------------------------------------------------
 * Behavior (as requested 2026-06-24):
 *   1. PURGES every table EXCEPT:
 *        - Restaurant            (tenant container, kept idempotent)
 *        - RestaurantConfig      (per-tenant branding, kept idempotent)
 *        - MenuItem              (the menu — explicitly preserved)
 *   2. After purge, exactly ONE user remains in the whole DB:
 *        - Admin { role: "admin", status: "active", mustChangePassword: true }
 *   This single Admin is the "super admin" of the restaurant. From the
 *   dashboard UI (Users / Équipe pages), they can create every other
 *   role. The platform now supports 8 admin login roles:
 *
 *     admin              — Super Admin restaurant (full access)
 *     manager            — Gérant adjoint (operational management)
 *     staff              — Personnel polyvalent (orders, reservations, kitchen view)
 *     cashier            — Caissier (POS, payments, invoices, customer list)
 *     kitchen            — Chef Cuisine (kitchen display, stock view, order status)
 *     delivery_manager   — Responsable Livraison (drivers, deliveries)
 *     host               — Hôte d'Accueil (reservations only)
 *     accountant         — Comptable (invoices, expenses, quotes, analytics — no ops)
 *
 *   And 15 staff (no-login) roles for HR records:
 *     cuisinier, commis, patissier, serveur, barman, sommelier,
 *     receptionniste, gerant, caissier, plongeur, securite,
 *     voiturier, maintenance, dj, animateur
 *
 *   The /api/admins, /api/customers, /api/drivers, /api/staff routes
 *   all authorize on role="admin" so this single super-admin account
 *   is enough to bootstrap the entire team.
 *
 *   3. PlatformAdmin table is also purged. The platform dashboard is
 *      not used in single-restaurant deployments on Render free tier.
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
 *   --dry-run        : print what would happen, do not write
 *   --yes            : skip the interactive confirmation prompt
 *   --keep-menu      : (default) keep MenuItem rows
 *   --purge-menu     : ALSO wipe MenuItem rows (rare — full reset)
 *
 * Environment overrides:
 *   SUPER_ADMIN_EMAIL     (default: admin@kfm-delice.com)
 *   SUPER_ADMIN_PASSWORD  (default: auto-generated 24-char random)
 *   SUPER_ADMIN_NAME      (default: Super Admin)
 *   RESTAURANT_SLUG       (default: kfm-delice)
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { createInterface } from "readline";

const prisma = new PrismaClient();

const FLAGS = {
  dryRun: process.argv.includes("--dry-run"),
  yes: process.argv.includes("--yes"),
  keepMenu: !process.argv.includes("--purge-menu"),
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function genPassword(): string {
  // 12 bytes → 24 hex chars; ensure complexity markers
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
  console.log("║   KFM DELICE — PRODUCTION RE-SEED (SLIM)                 ║");
  console.log("║   Purge everything EXCEPT menus + 1 super admin          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Mode        : ${FLAGS.dryRun ? "DRY-RUN (no writes)" : "LIVE"}`);
  console.log(`  Database    : ${process.env.DATABASE_URL ? "via DATABASE_URL" : "default (prisma)"}`);
  console.log(`  Keep menu   : ${FLAGS.keepMenu ? "YES" : "NO (will purge)"}`);
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
      "\n  ⚠️  DESTRUCTIVE OPERATION\n" +
        "  This will PURGE every table EXCEPT Restaurant, RestaurantConfig and MenuItem.\n" +
        "  After this run, exactly ONE user will remain (super admin).\n" +
        "  Type 'yes' to continue, anything else to abort: "
    );
    if (!ok) {
      console.log("Aborted. No changes made.");
      return;
    }
  }

  // ============================================================
  // 1. PURGE EVERYTHING EXCEPT Restaurant / RestaurantConfig / MenuItem
  // ============================================================
  section("1. Purging all transactional & user data (menus preserved)");

  // Order matters: children first, parents last.
  // deleteMany() returns PrismaPromise<BatchPayload> where BatchPayload = { count: number }.
  const purgeOrder: Array<[string, () => Promise<{ count: number }>]> = [
    ["PushSubscription", () => prisma.pushSubscription.deleteMany()],
    ["StockMovement", () => prisma.stockMovement.deleteMany()],
    ["StockItem", () => prisma.stockItem.deleteMany()],
    ["LoyaltyPointsHistory", () => prisma.loyaltyPointsHistory.deleteMany()],
    ["LoyaltyReward", () => prisma.loyaltyReward.deleteMany()],
    ["Payment", () => prisma.payment.deleteMany()],
    ["Expense", () => prisma.expense.deleteMany()],
    ["Quote", () => prisma.quote.deleteMany()],
    ["Invoice", () => prisma.invoice.deleteMany()],
    ["Review", () => prisma.review.deleteMany()],
    ["Reservation", () => prisma.reservation.deleteMany()],
    ["Order", () => prisma.order.deleteMany()],
    ["Driver", () => prisma.driver.deleteMany()],
    ["Staff", () => prisma.staff.deleteMany()],
    ["Customer", () => prisma.customer.deleteMany()],
    ["Admin", () => prisma.admin.deleteMany()],
    ["PlatformAdmin", () => prisma.platformAdmin.deleteMany()],
    ...(FLAGS.keepMenu
      ? []
      : ([["MenuItem", () => prisma.menuItem.deleteMany()]] as Array<[string, () => Promise<{ count: number }>]>)),
  ];

  let totalDeleted = 0;
  for (const [name, fn] of purgeOrder) {
    if (FLAGS.dryRun) {
      console.log(`  [dry-run] would DELETE from ${name}`);
      continue;
    }
    const r = await fn();
    totalDeleted += r.count;
    console.log(`  ✓ ${name.padEnd(22)} : ${r.count} rows deleted`);
  }
  if (!FLAGS.dryRun) {
    console.log(`  ───────────────────────────────────────────`);
    console.log(`  Total rows purged: ${totalDeleted}`);
  }

  // ============================================================
  // 2. ENSURE RESTAURANT + CONFIG (idempotent, no user data)
  // ============================================================
  section("2. Ensuring restaurant entity (config only, no users)");

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
    ownerEmail: process.env.SUPER_ADMIN_EMAIL || "admin@kfm-delice.com",
    ownerName: process.env.SUPER_ADMIN_NAME || "Super Admin",
    ownerPhone: process.env.RESTAURANT_PHONE || "+224 622 34 56 78",
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
  // 3. MENU ITEMS — keep existing, only seed if menu is empty
  // ============================================================
  section("3. Verifying menu items");

  const menuCount = await prisma.menuItem.count({ where: { restaurantId } });
  if (menuCount > 0) {
    console.log(`  ✓ Menu preserved (${menuCount} items)`);
  } else if (FLAGS.dryRun) {
    console.log("  [dry-run] would insert 21 default menu items");
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
    console.log(`  ✓ ${menuItems.length} default menu items created (menu was empty)`);
  }

  // ============================================================
  // 4. SINGLE SUPER ADMIN
  // ============================================================
  section("4. Creating the unique super admin");

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "admin@kfm-delice.com";
  const superAdminName = process.env.SUPER_ADMIN_NAME || "Super Admin";
  const superAdminPw = process.env.SUPER_ADMIN_PASSWORD || genPassword();

  if (FLAGS.dryRun) {
    console.log(`  [dry-run] would upsert Admin { email: ${superAdminEmail}, role: "admin" }`);
  } else {
    await prisma.admin.upsert({
      where: { email: superAdminEmail },
      update: {
        password: await hash(superAdminPw, 10),
        name: superAdminName,
        role: "admin", // highest role in the Admin model → full dashboard access
        status: "active",
        mustChangePassword: true,
        restaurantId,
      },
      create: {
        email: superAdminEmail,
        password: await hash(superAdminPw, 10),
        name: superAdminName,
        role: "admin",
        status: "active",
        mustChangePassword: true,
        restaurantId,
      },
    });
  }
  console.log(`  ✓ Super admin: ${superAdminEmail}`);
  console.log(`    Password   : ${superAdminPw}  ⚠️ SAVE THIS SECURELY`);
  console.log(`    Role       : admin  (highest restaurant role)`);
  console.log(`    Restaurant : ${restaurantSlug}`);

  // ============================================================
  // 5. FINAL REPORT
  // ============================================================
  section("5. Credential report & next steps");

  console.log("\n  ╔══════════════════════════════════════════════════════════╗");
  console.log("  ║  ⚠️  SAVE THESE CREDENTIALS IN A SECURE VAULT           ║");
  console.log("  ║  Password must be changed at first login                ║");
  console.log("  ╚══════════════════════════════════════════════════════════╝\n");

  console.log("  ── Super Admin (only user in DB) ──");
  console.log(`    Login URL : https://<your-render-url>/login`);
  console.log(`    Email     : ${superAdminEmail}`);
  console.log(`    Password  : ${superAdminPw}`);
  console.log(`    Role      : admin\n`);

  console.log("  ── What this super admin can do ──");
  console.log("    From the dashboard, open the Users / Équipe section:");
  console.log("      • /admin/admins    → create 8 admin login roles:");
  console.log("                            admin, manager, staff, cashier,");
  console.log("                            kitchen, delivery_manager, host, accountant");
  console.log("      • /admin/customers → create customer accounts");
  console.log("      • /admin/drivers   → create driver accounts");
  console.log("      • /admin/staff     → create 15 staff (no-login) roles:");
  console.log("                            cuisinier, commis, patissier, serveur,");
  console.log("                            barman, sommelier, receptionniste,");
  console.log("                            gerant, caissier, plongeur, securite,");
  console.log("                            voiturier, maintenance, dj, animateur");
  console.log("    Every new account gets role-based permissions enforced");
  console.log("    by /api/* routes (see PERMISSION_GROUPS in src/lib/auth.ts).\n");

  console.log("  ── Post-seed checklist ──");
  console.log("    [ ] Set JWT_SECRET env var on Render (32+ random chars)");
  console.log("    [ ] Set DATABASE_URL on Render (PostgreSQL connection string)");
  console.log("    [ ] Set NODE_ENV=production");
  console.log("    [ ] Distribute the credentials above via a secure channel");
  console.log("    [ ] Force a password reset on first login (mustChangePassword=true)");
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
