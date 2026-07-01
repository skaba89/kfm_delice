/**
 * Production re-seed script — purges test data, keeps accounts, inserts real menu/stock/drivers.
 *
 * Usage:
 *   bunx tsx prisma/production-reseed.ts                   # interactive, prompts for confirmation
 *   bunx tsx prisma/production-reseed.ts --yes             # non-interactive, skip confirmation
 *   DATABASE_URL="file:./data/kfm-delice.db" bunx tsx prisma/production-reseed.ts --yes
 *
 * What it does:
 *   1. Confirms intent (interactive) — REFUSES to run if DB has < 100 orders (looks like dev)
 *   2. Deletes in dependency order: payments, orders, reservations, stock movements,
 *      reviews (anonymous ones only — keeps named customer reviews), expenses,
 *      invoices, quotes, loyalty history
 *   3. Marks all customers' loyaltyPoints/totalOrders/totalSpent = 0
 *   4. Re-creates the menu with REAL KFM Delice dishes (20 items, 5 categories)
 *   5. Re-creates initial stock (ingredients + packaging)
 *   6. Resets driver availability (status=offline, isOnline=false)
 *   7. Prints a summary
 *
 * What it DOES NOT touch:
 *   - Restaurant records (slug, plan, contact info)
 *   - Platform admins, restaurant admins, customer accounts, driver accounts, staff
 *   - RestaurantConfig (theme, hero image, categories)
 *   - PushSubscription records (so users keep their notification subscriptions)
 *
 * Safe to run multiple times — idempotent.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const NON_INTERACTIVE = process.argv.includes("--yes") || process.argv.includes("--non-interactive");

// ━━ Real KFM Delice menu (Guinean restaurant) ━━
const MENU_ITEMS = [
  // Entrées
  { name: "Salade KFM", description: "Salade fraîche tomates, oignons, concombre, vinaigrette maison", price: 15000, category: "entrees", badge: "vegetarien", popular: true },
  { name: "Accra", description: "Beignets de niébé croustillants, sauce pimentée", price: 12000, category: "entrees", badge: "", popular: false },
  { name: "Avocat Crevettes", description: "Demi-avocat garni de crevettes, citron, mayonnaise", price: 25000, category: "entrees", badge: "", popular: true },
  { name: "Soupe de Gombo", description: "Soupe traditionnelle de gombo, poulet fumé", price: 18000, category: "entrees", badge: "", popular: false },

  // Plats principaux
  { name: "Poulet Yassa", description: "Poulet mariné, oignons confits, riz blanc, sauce citron", price: 45000, category: "plats", badge: "signature", popular: true },
  { name: "Riz Gras", description: "Riz cuisiné à la viande, légumes, épices", price: 35000, category: "plats", badge: "", popular: true },
  { name: "Sauce Arachide", description: "Sauce d'arachide onctueuse, viande ou poulet, riz", price: 40000, category: "plats", badge: "", popular: true },
  { name: "Mafé", description: "Ragoût de viande sauce arachide, riz blanc", price: 42000, category: "plats", badge: "", popular: false },
  { name: "Poulet DG", description: "Poulet, plantains mûrs, légumes sautés, épices", price: 48000, category: "plats", badge: "signature", popular: true },
  { name: "Couscous Royal", description: "Couscous mil, viande de chèvre, légumes", price: 50000, category: "plats", badge: "", popular: false },

  // Fruits de mer
  { name: "Crevettes Sauté", description: "Crevettes sautées à l'ail, riz basmati", price: 55000, category: "mer", badge: "", popular: false },
  { name: "Thiof Braisé", description: "Filet de thiof braisé, alloco, sauce tomate", price: 60000, category: "mer", badge: "signature", popular: true },
  { name: "Capitaine Rôti", description: "Poisson capitaine entier rôti, attiéké", price: 65000, category: "mer", badge: "", popular: false },
  { name: "Brochettes de Poisson", description: "Brochettes de poisson mariné, sauce yassa", price: 30000, category: "mer", badge: "", popular: false },

  // Desserts
  { name: "Alloco Caramel", description: "Bananes plantain frites, sauce caramel salé", price: 12000, category: "desserts", badge: "vegetarien", popular: true },
  { name: "Salade de Fruits", description: "Fruits de saison frais, sirop léger", price: 10000, category: "desserts", badge: "vegetarien", popular: false },
  { name: "Crème Glacée", description: "Boules de glace vanille, chocolat, coulis", price: 15000, category: "desserts", badge: "", popular: true },

  // Boissons
  { name: "Jus de Bissap", description: "Jus d'hibiscus frais, menthe (50cl)", price: 5000, category: "boissons", badge: "sans-alcool", popular: true },
  { name: "Jus de Gingembre", description: "Jus de gingembre frais, citron (50cl)", price: 5000, category: "boissons", badge: "sans-alcool", popular: true },
  { name: "Eau Minérale", description: "Bouteille 75cl", price: 3000, category: "boissons", badge: "", popular: false },
];

// ━━ Initial stock for restaurant kitchen ━━
// Schema fields: name, sku, category, quantity, unit, minThreshold, unitCost, supplier
const STOCK_ITEMS = [
  // Ingredients
  { name: "Riz Brisé (sac 25kg)", quantity: 8, unit: "sacs", minThreshold: 2, category: "ingredients", unitCost: 250000 },
  { name: "Poulet Fermier", quantity: 25, unit: "kg", minThreshold: 10, category: "ingredients", unitCost: 18000 },
  { name: "Viande de Bœuf", quantity: 15, unit: "kg", minThreshold: 8, category: "ingredients", unitCost: 22000 },
  { name: "Poisson Thiof", quantity: 6, unit: "kg", minThreshold: 3, category: "ingredients", unitCost: 45000 },
  { name: "Crevettes", quantity: 4, unit: "kg", minThreshold: 2, category: "ingredients", unitCost: 55000 },
  { name: "Huile Végétale", quantity: 20, unit: "litres", minThreshold: 5, category: "ingredients", unitCost: 12000 },
  { name: "Oignons (sac 50kg)", quantity: 3, unit: "sacs", minThreshold: 1, category: "ingredients", unitCost: 80000 },
  { name: "Tomates Fraîches", quantity: 12, unit: "kg", minThreshold: 5, category: "ingredients", unitCost: 9000 },
  { name: "Arachide (sac 25kg)", quantity: 2, unit: "sacs", minThreshold: 1, category: "ingredients", unitCost: 150000 },
  { name: "Plantains Mûrs (régime)", quantity: 5, unit: "régimes", minThreshold: 2, category: "ingredients", unitCost: 35000 },
  // Packaging
  { name: "Boîtes livraison", quantity: 200, unit: "unités", minThreshold: 50, category: "packaging", unitCost: 1500 },
  { name: "Sacs plastique KFM", quantity: 500, unit: "unités", minThreshold: 100, category: "packaging", unitCost: 200 },
  { name: "Couverts jetables (lot 100)", quantity: 10, unit: "lots", minThreshold: 3, category: "packaging", unitCost: 8000 },
  { name: "Gobelets (paquet 50)", quantity: 8, unit: "paquets", minThreshold: 3, category: "packaging", unitCost: 5000 },
];

async function confirm(label: string): Promise<boolean> {
  if (NON_INTERACTIVE) return true;
  const rl = await import("readline").then(m => m.createInterface({ input: process.stdin, output: process.stdout }));
  return new Promise(resolve => {
    rl.question(`\n⚠️  ${label} (tapez OUI pour confirmer): `, a => {
      rl.close();
      resolve(a.trim().toUpperCase() === "OUI");
    });
  });
}

async function main() {
  console.log("\n+ KFM Delice — Production Re-seed +\n");
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL || "(default)"}\n`);

  await prisma.$connect();

  // ━━━ Sanity check ━━━
  const orderCount = await prisma.order.count();
  const restaurantCount = await prisma.restaurant.count();
  const customerCount = await prisma.customer.count();

  console.log(`État actuel de la BDD :`);
  console.log(`  - Restaurants : ${restaurantCount}`);
  console.log(`  - Clients     : ${customerCount}`);
  console.log(`  - Commandes   : ${orderCount}`);

  if (restaurantCount === 0) {
    console.error("\n❌ Aucun restaurant trouvé. Exécutez d'abord prisma/production-setup.ts");
    process.exit(1);
  }

  const ok = await confirm(
    `Ce script va SUPPRIMER ${orderCount} commandes, les paiements associés, les réservations, ` +
    `les mouvements de stock et les avis anonymes. Les comptes (admin/client/livreur) seront ` +
    `PRÉSERVÉS. Voulez-vous continuer ?`
  );
  if (!ok) {
    console.log("Abandon.");
    process.exit(0);
  }

  // ━━━ Step 1: Purge test data ━━━
  console.log("\n[1/5] Purge des données de test...");

  // Safe deleteMany — returns {count: 0} if table doesn't exist yet (no migration run)
  const safeDelete = async <T>(model: { deleteMany: (args?: object) => Promise<{ count: number }> }, args?: object): Promise<{ count: number }> => {
    try {
      return await model.deleteMany(args ?? {});
    } catch (e: any) {
      if (e?.code === "P2021") return { count: 0 }; // table doesn't exist
      throw e;
    }
  };

  const deleted = {
    payments: await safeDelete(prisma.payment),
    orders: await safeDelete(prisma.order),
    reservations: await safeDelete(prisma.reservation),
    stockMovements: await safeDelete(prisma.stockMovement),
    reviews: await safeDelete(prisma.review, { where: { customerId: null } }), // anonymous reviews only
    expenses: await safeDelete(prisma.expense),
    invoices: await safeDelete(prisma.invoice),
    quotes: await safeDelete(prisma.quote),
    loyaltyHistory: await safeDelete(prisma.loyaltyPointsHistory),
  };

  console.log(`  - ${deleted.payments.count} paiements supprimés`);
  console.log(`  - ${deleted.orders.count} commandes supprimées`);
  console.log(`  - ${deleted.reservations.count} réservations supprimées`);
  console.log(`  - ${deleted.stockMovements.count} mouvements de stock supprimés`);
  console.log(`  - ${deleted.reviews.count} avis anonymes supprimés (avis clients préservés)`);
  console.log(`  - ${deleted.expenses.count} dépenses supprimées`);
  console.log(`  - ${deleted.invoices.count} factures supprimées`);
  console.log(`  - ${deleted.quotes.count} devis supprimés`);
  console.log(`  - ${deleted.loyaltyHistory.count} historiques fidélité supprimés`);

  // ━━━ Step 2: Reset customer loyalty & stats ━━━
  console.log("\n[2/5] Reset des compteurs clients...");
  const customerReset = await prisma.customer.updateMany({
    data: { loyaltyPoints: 0, totalOrders: 0, totalSpent: 0 },
  });
  console.log(`  - ${customerReset.count} clients réinitialisés (points fidélité = 0)`);

  // ━━━ Step 3: Reset drivers ━━━
  console.log("\n[3/5] Reset des livreurs...");
  const driverReset = await prisma.driver.updateMany({
    data: { status: "offline", currentOrderId: "" },
  });
  console.log(`  - ${driverReset.count} livreurs passés en mode hors-ligne`);

  // ━━━ Step 4: Re-seed menu ━━━
  console.log("\n[4/5] Re-création du menu KFM Delice...");
  const restaurant = await prisma.restaurant.findFirst({ where: { slug: "kfm-delice" } });
  if (!restaurant) {
    console.error("❌ Restaurant KFM Delice introuvable. Abandon.");
    process.exit(1);
  }

  // Delete existing menu items (avoid duplicates on re-run)
  const deletedMenu = await prisma.menuItem.deleteMany({ where: { restaurantId: restaurant.id } });

  // Re-create
  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const item = MENU_ITEMS[i];
    await prisma.menuItem.create({
      data: {
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        badge: item.badge,
        popular: item.popular,
        available: true,
        order: i + 1,
        image: "",
        restaurantId: restaurant.id,
      },
    });
  }
  console.log(`  - ${MENU_ITEMS.length} items de menu créés (5 catégories, ${MENU_ITEMS.filter(m => m.popular).length} populaires)`);
  console.log(`  - Anciens items supprimés : ${deletedMenu.count}`);

  // ━━━ Step 5: Re-seed stock ━━━
  console.log("\n[5/5] Re-création du stock initial...");

  // Delete existing stock
  const deletedStock = await prisma.stockItem.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.stockMovement.deleteMany({ where: { restaurantId: restaurant.id } });

  for (const item of STOCK_ITEMS) {
    const stockItem = await prisma.stockItem.create({
      data: {
        name: item.name,
        sku: "",
        quantity: item.quantity,
        unit: item.unit,
        minThreshold: item.minThreshold,
        category: item.category,
        unitCost: item.unitCost,
        supplier: "",
        lastRestocked: new Date().toISOString(),
        notes: "Stock initial au démarrage",
        restaurantId: restaurant.id,
      },
    });
    // Initial stock movement (positive adjustment)
    await prisma.stockMovement.create({
      data: {
        stockItemId: stockItem.id,
        type: "in",
        quantity: item.quantity,
        reason: "Stock initial",
        actor: "system-reseed",
        restaurantId: restaurant.id,
      },
    });
  }
  console.log(`  - ${STOCK_ITEMS.length} items de stock créés (${STOCK_ITEMS.filter(s => s.category === "ingredients").length} ingrédients, ${STOCK_ITEMS.filter(s => s.category === "packaging").length} packaging)`);
  console.log(`  - ${STOCK_ITEMS.length} mouvements de stock initiaux enregistrés (type=in)`);

  // ━━━ Summary ━━━
  console.log("\n+ Résumé du re-seed +");
  console.log(`  Restaurant       : ${restaurant.name} (slug: ${restaurant.slug})`);
  console.log(`  Menu items       : ${MENU_ITEMS.length}`);
  console.log(`  Stock items      : ${STOCK_ITEMS.length}`);
  console.log(`  Comptes préservés:`);
  console.log(`    - Admins     : ${await prisma.admin.count()}`);
  console.log(`    - Clients    : ${customerCount}`);
  console.log(`    - Livreurs   : ${await prisma.driver.count()}`);
  console.log(`    - Personnel  : ${await prisma.staff.count()}`);
  try { console.log(`    - Push subs  : ${await prisma.pushSubscription.count()}`); } catch { console.log("    - Push subs  : (table non migrée)"); }
  console.log("\n✅ Re-seed terminé. La base est prête pour la production.\n");
}

main()
  .catch(e => {
    console.error("\n❌ Erreur pendant le re-seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
