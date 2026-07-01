import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("[clean-seed] Wiping all data...");

  // Delete in reverse dependency order
  await prisma.stockMovement.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.loyaltyPointsHistory.deleteMany();
  await prisma.loyaltyReward.deleteMany();
  await prisma.restaurantConfig.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.order.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.platformAdmin.deleteMany();
  console.log("[clean-seed] Database cleared.");

  // ═══════════════════════════════════════════════════════════════
  //  PLATFORM ADMIN
  // ═══════════════════════════════════════════════════════════════
  const platformPw = await hash("Platform2024!", 10);
  await prisma.platformAdmin.create({
    data: {
      email: "admin@platform.com",
      password: platformPw,
      name: "Super Admin",
      role: "super_admin",
      status: "active",
    },
  });
  console.log("[clean-seed] Platform admin: admin@platform.com / Platform2024!");

  // ═══════════════════════════════════════════════════════════════
  //  RESTAURANT
  // ═══════════════════════════════════════════════════════════════
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "KFM Delice",
      slug: "mon-restaurant",
      tagline: "Les saveurs authentiques de Guinée",
      description: "Restaurant guinéen proposant des plats traditionnels et modernes, livraison à Conakry.",
      phone: "+224 620 00 00 00",
      whatsapp: "+224 620 00 00 00",
      email: "contact@kfmdelice.com",
      address: "Almamya, Conakry, Guinée",
      hours: "Lun-Dim : 11h00 - 23h00",
      rating: 4.7,
      tables: 20,
      deliveryFee: 5000,
      minDelivery: 15000,
      deliveryZones: "Kaloum:Dixinn:Matam:Matoto",
      plan: "pro",
      status: "active",
      currency: "GNF",
      locale: "fr",
      ownerEmail: "admin@monrestaurant.com",
      ownerName: "Mamadou Bailo",
      ownerPhone: "+224 620 00 00 00",
    },
  });
  console.log(`[clean-seed] Restaurant: ${restaurant.name} (${restaurant.slug})`);

  // --- Restaurant Config ---
  await prisma.restaurantConfig.create({
    data: {
      restaurantId: restaurant.id,
      heroImage: "",
      primaryColor: "#ea580c",
      accentColor: "#f97316",
      menuCategories: JSON.stringify([
        { id: "entrees", name: "Entrées" },
        { id: "plats", name: "Plats Principaux" },
        { id: "desserts", name: "Desserts" },
        { id: "boissons", name: "Boissons" },
      ]),
      features: JSON.stringify({
        delivery: true, reservations: true, reviews: true, loyalty: true,
        pos: true, invoices: true, quotes: true, expenses: true, staff: true, drivers: true,
      }),
      openingHours: JSON.stringify({ open: 11, close: 23, timezone: "Africa/Conakry" }),
      socialLinks: JSON.stringify({ facebook: "https://facebook.com/kfmdelice", instagram: "https://instagram.com/kfmdelice", twitter: "" }),
    },
  });
  console.log("[clean-seed] Config restaurant créée.");

  // ═══════════════════════════════════════════════════════════════
  //  ADMIN ACCOUNTS (8 roles)
  // ═══════════════════════════════════════════════════════════════
  const adminAccounts = [
    { email: "admin@monrestaurant.com", password: "Admin2024!", name: "Mamadou Bailo", role: "admin" },
    { email: "manager@monrestaurant.com", password: "Manager2024!", name: "Aminata Diallo", role: "manager" },
    { email: "staff@monrestaurant.com", password: "Staff2024!", name: "Ibrahim Touré", role: "staff" },
    { email: "cashier@monrestaurant.com", password: "Caissier2024!", name: "Fatoumata Bamba", role: "cashier" },
    { email: "kitchen@monrestaurant.com", password: "Cuisine2024!", name: "Chef Moussa", role: "kitchen" },
    { email: "delivery@monrestaurant.com", password: "Livraison2024!", name: "Ousmane Camara", role: "delivery_manager" },
    { email: "host@monrestaurant.com", password: "Accueil2024!", name: "Mariama Condé", role: "host" },
    { email: "accountant@monrestaurant.com", password: "Compta2024!", name: "Alpha Souaré", role: "accountant" },
  ];
  for (const a of adminAccounts) {
    const pw = await hash(a.password, 10);
    await prisma.admin.create({
      data: { email: a.email, password: pw, name: a.name, role: a.role, status: "active", mustChangePassword: false, restaurantId: restaurant.id },
    });
  }
  console.log(`[clean-seed] ${adminAccounts.length} comptes admin créés (8 rôles).`);

  // ═══════════════════════════════════════════════════════════════
  //  CUSTOMER
  // ═══════════════════════════════════════════════════════════════
  const clientPw = await hash("Client2024!", 10);
  const customer = await prisma.customer.create({
    data: {
      email: "client@test.com",
      password: clientPw,
      name: "Adama Bah",
      phone: "+224 611 11 11 11",
      address: "Kaloum, Conakry",
      loyaltyPoints: 120,
      totalOrders: 5,
      totalSpent: 175000,
      status: "active",
      mustChangePassword: false,
      restaurantId: restaurant.id,
    },
  });
  console.log("[clean-seed] Client: client@test.com / Client2024!");

  // ═══════════════════════════════════════════════════════════════
  //  DRIVERS
  // ═══════════════════════════════════════════════════════════════
  const driverPw = await hash("Driver2024!", 10);
  const driver1 = await prisma.driver.create({
    data: {
      email: "driver@test.com",
      password: driverPw,
      name: "Youssouf Sylla",
      phone: "+224 622 22 22 22",
      vehicle: "moto",
      status: "available",
      rating: 4.8,
      totalDeliveries: 34,
      zone: "Kaloum",
      mustChangePassword: false,
      restaurantId: restaurant.id,
    },
  });
  const driver2Pw = await hash("Driver2024!", 10);
  const driver2 = await prisma.driver.create({
    data: {
      email: "driver2@test.com",
      password: driver2Pw,
      name: "Mamadou Sow",
      phone: "+224 633 33 33 33",
      vehicle: "velo",
      status: "busy",
      rating: 4.5,
      totalDeliveries: 21,
      zone: "Dixinn",
      mustChangePassword: false,
      restaurantId: restaurant.id,
    },
  });
  console.log("[clean-seed] 2 livreurs créés.");

  // ═══════════════════════════════════════════════════════════════
  //  MENU ITEMS (10 plats)
  // ═══════════════════════════════════════════════════════════════
  const menuItems = [
    { name: "Riz Jollof Spécial", description: "Riz jollof signature avec poulet braisé, légumes et sauce piquante maison. Notre plat le plus demandé !", price: 35000, category: "plats", badge: "Signature", popular: true, order: 1, restaurantId: restaurant.id },
    { name: "Salade Fraîche", description: "Salade aux légumes de saison, avocat, tomates cerises et vinaigrette maison", price: 15000, category: "entrees", badge: "Végétarien", popular: true, order: 2, restaurantId: restaurant.id },
    { name: "Poisson Grillé", description: "Poisson frais du jour grillé au charbon, accompagné de riz et sauce tomate", price: 30000, category: "plats", badge: "Frais", popular: false, order: 3, restaurantId: restaurant.id },
    { name: "Bissap", description: "Jus d'hibiscus glacé traditionnel, menthe et gingembre", price: 5000, category: "boissons", badge: "Traditionnel", popular: true, order: 4, restaurantId: restaurant.id },
    { name: "Fruits Tropicaux", description: "Mangue, ananas, papaye frais de saison", price: 12000, category: "desserts", badge: "Frais", popular: false, order: 5, restaurantId: restaurant.id },
    { name: "Poulet Yassa", description: "Poulet mariné au citron et oignons caramélisés, servi avec riz blanc", price: 28000, category: "plats", badge: "Populaire", popular: true, order: 6, restaurantId: restaurant.id },
    { name: "Attiéké Poisson", description: "Attiéké frais accompagné de poisson grillé et piment", price: 25000, category: "plats", badge: "", popular: true, order: 7, restaurantId: restaurant.id },
    { name: "Soupe de Manioc", description: "Soupe traditionnelle de manioc aux feuilles de patate douce", price: 18000, category: "entrees", badge: "Traditionnel", popular: false, order: 8, restaurantId: restaurant.id },
    { name: "Jus de Gingembre", description: "Jus de gingembre frais sucré au miel, piment optional", price: 5000, category: "boissons", badge: "Épicé", popular: true, order: 9, restaurantId: restaurant.id },
    { name: "Banane Flambée", description: "Banane plantain flambée au rhum et cannelle", price: 10000, category: "desserts", badge: "Dessert", popular: false, order: 10, restaurantId: restaurant.id },
  ];
  const createdMenuItems = [];
  for (const item of menuItems) {
    createdMenuItems.push(await prisma.menuItem.create({ data: item }));
  }
  console.log(`[clean-seed] ${menuItems.length} items menu créés.`);

  // ═══════════════════════════════════════════════════════════════
  //  ORDERS (10 commandes dans différents statuts)
  // ═══════════════════════════════════════════════════════════════
  const now = new Date();
  const orders = [
    // pending — vient d'arriver
    { customerName: "Adama Bah", phone: "+224 611 11 11 11", items: JSON.stringify([{ name: "Riz Jollof Spécial", qty: 2, price: 35000 }, { name: "Bissap", qty: 2, price: 5000 }]), total: 80000, status: "pending", orderType: "delivery", paymentMethod: "cash", paymentStatus: "pending", deliveryAddress: "Kaloum, Conakry", deliveryFee: 5000, customerId: customer.id, restaurantId: restaurant.id, createdAt: new Date(now.getTime() - 5 * 60000) },
    // confirmed — validé par admin
    { customerName: "Ibrahima Keïta", phone: "+224 644 44 44 44", items: JSON.stringify([{ name: "Poulet Yassa", qty: 1, price: 28000 }, { name: "Jus de Gingembre", qty: 1, price: 5000 }]), total: 33000, status: "confirmed", orderType: "dine_in", paymentMethod: "cash", paymentStatus: "pending", tableNumber: 5, customerId: null, restaurantId: restaurant.id, createdAt: new Date(now.getTime() - 12 * 60000) },
    // preparing — en cuisine
    { customerName: "Fatoumata Bamba", phone: "+224 655 55 55 55", items: JSON.stringify([{ name: "Attiéké Poisson", qty: 1, price: 25000 }, { name: "Salade Fraîche", qty: 1, price: 15000 }]), total: 40000, status: "preparing", orderType: "takeaway", paymentMethod: "orange_money", paymentStatus: "paid", customerId: null, restaurantId: restaurant.id, createdAt: new Date(now.getTime() - 18 * 60000) },
    // preparing — autre commande en cuisine
    { customerName: "Adama Bah", phone: "+224 611 11 11 11", items: JSON.stringify([{ name: "Riz Jollof Spécial", qty: 1, price: 35000 }, { name: "Fruits Tropicaux", qty: 1, price: 12000 }]), total: 47000, status: "preparing", orderType: "delivery", paymentMethod: "cash", paymentStatus: "pending", deliveryAddress: "Dixinn, Conakry", deliveryFee: 5000, customerId: customer.id, restaurantId: restaurant.id, createdAt: new Date(now.getTime() - 20 * 60000) },
    // ready — prêt à servir / emporter / livrer
    { customerName: "Ousmane Diallo", phone: "+224 666 66 66 66", items: JSON.stringify([{ name: "Poisson Grillé", qty: 1, price: 30000 }, { name: "Bissap", qty: 2, price: 5000 }]), total: 40000, status: "ready", orderType: "dine_in", paymentMethod: "cash", paymentStatus: "pending", tableNumber: 3, customerId: null, restaurantId: restaurant.id, createdAt: new Date(now.getTime() - 25 * 60000) },
    // ready — takeaway
    { customerName: "Mariama Condé", phone: "+224 677 77 77 77", items: JSON.stringify([{ name: "Poulet Yassa", qty: 2, price: 28000 }]), total: 56000, status: "ready", orderType: "takeaway", paymentMethod: "mtn_momo", paymentStatus: "paid", customerId: null, restaurantId: restaurant.id, createdAt: new Date(now.getTime() - 28 * 60000) },
    // ready — delivery (prêt pour livraison)
    { customerName: "Adama Bah", phone: "+224 611 11 11 11", items: JSON.stringify([{ name: "Soupe de Manioc", qty: 1, price: 18000 }, { name: "Banane Flambée", qty: 1, price: 10000 }]), total: 28000, status: "ready", orderType: "delivery", paymentMethod: "cash", paymentStatus: "pending", deliveryAddress: "Matam, Conakry", deliveryFee: 5000, driverEarning: 3000, customerId: customer.id, restaurantId: restaurant.id, createdAt: new Date(now.getTime() - 30 * 60000) },
    // delivering — en livraison
    { customerName: "Kadiatou Bah", phone: "+224 688 88 88 88", items: JSON.stringify([{ name: "Riz Jollof Spécial", qty: 1, price: 35000 }, { name: "Jus de Gingembre", qty: 1, price: 5000 }]), total: 40000, status: "delivering", orderType: "delivery", paymentMethod: "orange_money", paymentStatus: "paid", deliveryAddress: "Matoto, Conakry", deliveryFee: 5000, driverId: driver2.id, driverEarning: 3500, customerId: null, restaurantId: restaurant.id, createdAt: new Date(now.getTime() - 35 * 60000) },
    // delivered — livrée
    { customerName: "Adama Bah", phone: "+224 611 11 11 11", items: JSON.stringify([{ name: "Attiéké Poisson", qty: 1, price: 25000 }]), total: 25000, status: "delivered", orderType: "delivery", paymentMethod: "cash", paymentStatus: "paid", deliveryAddress: "Kaloum, Conakry", deliveryFee: 5000, driverId: driver1.id, driverEarning: 2500, customerId: customer.id, restaurantId: restaurant.id, createdAt: new Date(now.getTime() - 120 * 60000) },
    // cancelled — annulée
    { customerName: "Lamine Traoré", phone: "+224 699 99 99 99", items: JSON.stringify([{ name: "Poisson Grillé", qty: 1, price: 30000 }]), total: 30000, status: "cancelled", orderType: "dine_in", paymentMethod: "cash", paymentStatus: "pending", tableNumber: 8, note: "Client a quitté", customerId: null, restaurantId: restaurant.id, createdAt: new Date(now.getTime() - 180 * 60000) },
  ];
  const createdOrders = [];
  for (const o of orders) {
    createdOrders.push(await prisma.order.create({ data: o }));
  }
  console.log(`[clean-seed] ${orders.length} commandes créées (multi-statuts).`);

  // ═══════════════════════════════════════════════════════════════
  //  RESERVATIONS
  // ═══════════════════════════════════════════════════════════════
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const reservations = [
    { customerName: "Adama Bah", phone: "+224 611 11 11 11", date: today, time: "12:30", guests: 4, zone: "Salon", status: "confirmed", restaurantId: restaurant.id },
    { customerName: "Mamadou Keïta", phone: "+224 644 44 44 44", date: today, time: "19:00", guests: 2, zone: "Terrasse", status: "pending", restaurantId: restaurant.id },
    { customerName: "Fatoumata Bamba", phone: "+224 655 55 55 55", date: tomorrow, time: "13:00", guests: 6, zone: "Salon VIP", status: "pending", restaurantId: restaurant.id },
  ];
  for (const r of reservations) {
    await prisma.reservation.create({ data: r });
  }
  console.log(`[clean-seed] ${reservations.length} réservations créées.`);

  // ═══════════════════════════════════════════════════════════════
  //  STAFF (personnel sans login)
  // ═══════════════════════════════════════════════════════════════
  const staffMembers = [
    { name: "Moussa Condé", phone: "+224 610 10 10 10", role: "cuisinier", salary: 800000, status: "active", hireDate: "2024-01-15", notes: "Chef de cuisine principal", restaurantId: restaurant.id },
    { name: "Aïssatou Diallo", phone: "+224 610 20 20 20", role: "serveur", salary: 450000, status: "active", hireDate: "2024-03-01", notes: "", restaurantId: restaurant.id },
    { name: "Ibrahima Touré", phone: "+224 610 30 30 30", role: "barman", salary: 400000, status: "active", hireDate: "2024-02-10", notes: "Spécialiste cocktails", restaurantId: restaurant.id },
    { name: "Kadiatou Sylla", phone: "+224 610 40 40 40", role: "caissier", salary: 500000, status: "active", hireDate: "2023-11-20", notes: "", restaurantId: restaurant.id },
    { name: "Abdoulaye Camara", phone: "+224 610 50 50 50", role: "plongeur", salary: 350000, status: "active", hireDate: "2024-06-01", notes: "", restaurantId: restaurant.id },
    { name: "Sekou Bamba", phone: "+224 610 60 60 60", role: "securite", salary: 400000, status: "active", hireDate: "2024-01-01", notes: "Garde de nuit", restaurantId: restaurant.id },
    { name: "Fatoumata Souaré", phone: "+224 610 70 70 70", role: "gerant", salary: 900000, status: "on_leave", hireDate: "2023-05-15", notes: "En congé maternité", restaurantId: restaurant.id },
  ];
  for (const s of staffMembers) {
    await prisma.staff.create({ data: s });
  }
  console.log(`[clean-seed] ${staffMembers.length} membres du personnel créés.`);

  // ═══════════════════════════════════════════════════════════════
  //  STOCK / INVENTORY
  // ═══════════════════════════════════════════════════════════════
  const stockItems = [
    { name: "Riz basmati (25kg)", sku: "RIZ-001", category: "ingredients", quantity: 12, unit: "sac", minThreshold: 3, unitCost: 150000, supplier: "Import Guinée SA", lastRestocked: today, notes: "Stock principal", restaurantId: restaurant.id },
    { name: "Poulet entier", sku: "POU-001", category: "ingredients", quantity: 35, unit: "kg", minThreshold: 10, unitCost: 25000, supplier: "Volaille de Guinée", lastRestocked: today, notes: "", restaurantId: restaurant.id },
    { name: "Poisson frais", sku: "POI-001", category: "ingredients", quantity: 8, unit: "kg", minThreshold: 5, unitCost: 30000, supplier: "Pêcheurs de Kaloum", lastRestocked: today, notes: "Livraison quotidienne", restaurantId: restaurant.id },
    { name: "Huile végétale (5L)", sku: "HUI-001", category: "ingredients", quantity: 6, unit: "bidon", minThreshold: 2, unitCost: 45000, supplier: "SOGUIP", lastRestocked: today, notes: "", restaurantId: restaurant.id },
    { name: "Tomates", sku: "TOM-001", category: "ingredients", quantity: 15, unit: "kg", minThreshold: 5, unitCost: 8000, supplier: "Marché Madina", lastRestocked: today, notes: "", restaurantId: restaurant.id },
    { name: "Oignons", sku: "OIG-001", category: "ingredients", quantity: 20, unit: "kg", minThreshold: 5, unitCost: 5000, supplier: "Marché Madina", lastRestocked: today, notes: "", restaurantId: restaurant.id },
    { name: "Bissap (1kg)", sku: "BIS-001", category: "drinks", quantity: 4, unit: "sac", minThreshold: 2, unitCost: 15000, supplier: "Herboristerie Conakry", lastRestocked: today, notes: "", restaurantId: restaurant.id },
    { name: "Gingembre (1kg)", sku: "GIN-001", category: "drinks", quantity: 3, unit: "kg", minThreshold: 1, unitCost: 10000, supplier: "Marché Madina", lastRestocked: today, notes: "", restaurantId: restaurant.id },
    { name: "Emballages livraison", sku: "EMB-001", category: "packaging", quantity: 200, unit: "unité", minThreshold: 50, unitCost: 1500, supplier: "Emballage Guinée", lastRestocked: today, notes: "Boîtes isothermes", restaurantId: restaurant.id },
    { name: "Produit vaisselle (5L)", sku: "VAI-001", category: "cleaning", quantity: 2, unit: "bidon", minThreshold: 1, unitCost: 25000, supplier: "Supermarché Kaloum", lastRestocked: today, notes: "⚠️ Stock bas", restaurantId: restaurant.id },
  ];
  const createdStockItems = [];
  for (const si of stockItems) {
    createdStockItems.push(await prisma.stockItem.create({ data: si }));
  }
  console.log(`[clean-seed] ${stockItems.length} articles de stock créés.`);

  // Stock movements (historique)
  const stockMovements = [
    { stockItemId: createdStockItems[0].id, type: "in", quantity: 5, reason: "Réappro Import Guinée SA", actor: "Mamadou Bailo", restaurantId: restaurant.id },
    { stockItemId: createdStockItems[0].id, type: "out", quantity: 3, reason: "Sortie cuisine — service midi", actor: "Chef Moussa", restaurantId: restaurant.id },
    { stockItemId: createdStockItems[1].id, type: "in", quantity: 20, reason: "Livraison Volaille de Guinée", actor: "Mamadou Bailo", restaurantId: restaurant.id },
    { stockItemId: createdStockItems[1].id, type: "out", quantity: 8, reason: "Sortie cuisine — poulet yassa + jollof", actor: "Chef Moussa", restaurantId: restaurant.id },
    { stockItemId: createdStockItems[2].id, type: "in", quantity: 10, reason: "Pêcheurs de Kaloum — matin", actor: "Mamadou Bailo", restaurantId: restaurant.id },
    { stockItemId: createdStockItems[2].id, type: "out", quantity: 5, reason: "Sortie cuisine — poisson grillé", actor: "Chef Moussa", restaurantId: restaurant.id },
    { stockItemId: createdStockItems[8].id, type: "in", quantity: 100, reason: "Réappro Emballage Guinée", actor: "Aminata Diallo", restaurantId: restaurant.id },
    { stockItemId: createdStockItems[9].id, type: "adjust", quantity: 2, reason: "Correction inventaire", actor: "Alpha Souaré", restaurantId: restaurant.id },
  ];
  for (const sm of stockMovements) {
    await prisma.stockMovement.create({ data: sm });
  }
  console.log(`[clean-seed] ${stockMovements.length} mouvements de stock créés.`);

  // ═══════════════════════════════════════════════════════════════
  //  INVOICES
  // ═══════════════════════════════════════════════════════════════
  const invoices = [
    { number: "FAC-2024-001", customerName: "Entreprise SOGUIP", customerPhone: "+224 630 00 00 00", subtotal: 350000, tax: 0, total: 350000, status: "paid", dueDate: "2024-12-31", items: JSON.stringify([{ name: "Riz Jollof x10", qty: 10, price: 35000 }]), restaurantId: restaurant.id },
    { number: "FAC-2024-002", customerName: "ONG Guinée Solidarité", customerPhone: "+224 631 00 00 00", subtotal: 520000, tax: 0, total: 520000, status: "pending", dueDate: "2025-01-15", items: JSON.stringify([{ name: "Poulet Yassa x10", qty: 10, price: 28000 }, { name: "Bissap x20", qty: 20, price: 5000 }]), restaurantId: restaurant.id },
    { number: "FAC-2024-003", customerName: "Ambassade du Sénégal", customerPhone: "+224 632 00 00 00", subtotal: 180000, tax: 0, total: 180000, status: "overdue", dueDate: "2024-11-30", items: JSON.stringify([{ name: "Attiéké Poisson x6", qty: 6, price: 25000 }, { name: "Jus de Gingembre x6", qty: 6, price: 5000 }]), restaurantId: restaurant.id },
  ];
  for (const inv of invoices) {
    await prisma.invoice.create({ data: inv });
  }
  console.log(`[clean-seed] ${invoices.length} factures créées.`);

  // ═══════════════════════════════════════════════════════════════
  //  QUOTES (Devis)
  // ═══════════════════════════════════════════════════════════════
  const quotes = [
    { number: "DEV-2024-001", customerName: "Hôtel Riviera", customerPhone: "+224 640 00 00 00", subtotal: 1500000, discount: 0, total: 1500000, status: "sent", validUntil: "2025-02-28", items: JSON.stringify([{ name: "Buffet 50 personnes", qty: 1, price: 1500000 }]), restaurantId: restaurant.id },
    { number: "DEV-2024-002", customerName: "Ministère de la Culture", customerPhone: "+224 641 00 00 00", subtotal: 800000, discount: 0, total: 800000, status: "draft", validUntil: "2025-01-31", items: JSON.stringify([{ name: "Cocktail dinatoire 30 personnes", qty: 1, price: 800000 }]), restaurantId: restaurant.id },
  ];
  for (const q of quotes) {
    await prisma.quote.create({ data: q });
  }
  console.log(`[clean-seed] ${quotes.length} devis créés.`);

  // ═══════════════════════════════════════════════════════════════
  //  EXPENSES
  // ═══════════════════════════════════════════════════════════════
  const expenses = [
    { description: "Loyer décembre 2024", category: "rent", amount: 5000000, date: "2024-12-01", restaurantId: restaurant.id },
    { description: "Électricité décembre", category: "utilities", amount: 800000, date: "2024-12-05", restaurantId: restaurant.id },
    { description: "Réappro riz basmati x5 sacs", category: "ingredients", amount: 750000, date: "2024-12-10", restaurantId: restaurant.id },
    { description: "Salaires décembre — équipe cuisine", category: "salary", amount: 2400000, date: "2024-12-31", restaurantId: restaurant.id },
    { description: "Réparation cuisinière", category: "equipment", amount: 350000, date: "2024-12-15", restaurantId: restaurant.id },
  ];
  for (const e of expenses) {
    await prisma.expense.create({ data: e });
  }
  console.log(`[clean-seed] ${expenses.length} dépenses créées.`);

  // ═══════════════════════════════════════════════════════════════
  //  PAYMENTS
  // ═══════════════════════════════════════════════════════════════
  const payments = [
    { orderId: createdOrders[2].id, method: "orange_money", amount: 40000, status: "paid", customerName: "Fatoumata Bamba", phone: "+224 655 55 55 55", transactionRef: "OM-2024-ABC123", paidAt: new Date(now.getTime() - 18 * 60000).toISOString(), restaurantId: restaurant.id },
    { orderId: createdOrders[5].id, method: "mtn_momo", amount: 56000, status: "paid", customerName: "Mariama Condé", phone: "+224 677 77 77 77", transactionRef: "MTN-2024-XYZ789", paidAt: new Date(now.getTime() - 28 * 60000).toISOString(), restaurantId: restaurant.id },
    { orderId: createdOrders[7].id, method: "orange_money", amount: 40000, status: "paid", customerName: "Kadiatou Bah", phone: "+224 688 88 88 88", transactionRef: "OM-2024-DEF456", paidAt: new Date(now.getTime() - 35 * 60000).toISOString(), restaurantId: restaurant.id },
    { orderId: createdOrders[8].id, method: "cash", amount: 25000, status: "paid", customerName: "Adama Bah", phone: "+224 611 11 11 11", transactionRef: "", paidAt: new Date(now.getTime() - 120 * 60000).toISOString(), restaurantId: restaurant.id },
  ];
  for (const p of payments) {
    await prisma.payment.create({ data: p });
  }
  console.log(`[clean-seed] ${payments.length} paiements créés.`);

  // ═══════════════════════════════════════════════════════════════
  //  REVIEWS
  // ═══════════════════════════════════════════════════════════════
  const reviews = [
    { customerName: "Adama Bah", rating: 5, comment: "Excellent ! Le riz jollof est divin. Livraison rapide.", date: today, customerId: customer.id, restaurantId: restaurant.id },
    { customerName: "Kadiatou Bah", rating: 4, comment: "Très bon poisson grillé. Un peu d'attente mais ça vaut le coup.", date: today, customerId: null, restaurantId: restaurant.id },
    { customerName: "Lamine Traoré", rating: 3, comment: "Service correct, le bissap est top mais le plat était tiède.", date: new Date(Date.now() - 86400000).toISOString().split("T")[0], customerId: null, restaurantId: restaurant.id },
  ];
  for (const r of reviews) {
    await prisma.review.create({ data: r });
  }
  console.log(`[clean-seed] ${reviews.length} avis créés.`);

  // ═══════════════════════════════════════════════════════════════
  //  LOYALTY REWARDS
  // ═══════════════════════════════════════════════════════════════
  const rewards = [
    { name: "Réduction 10%", description: "10% de réduction sur votre prochaine commande", category: "discount", pointsCost: 100, value: 10, active: true, restaurantId: restaurant.id },
    { name: "Boisson offerte", description: "Une boisson gratuite avec votre repas", category: "free_item", pointsCost: 50, value: 5000, active: true, restaurantId: restaurant.id },
    { name: "Dessert VIP", description: "Dessert premium offert", category: "vip", pointsCost: 200, value: 15000, active: true, restaurantId: restaurant.id },
  ];
  await prisma.loyaltyReward.createMany({ data: rewards });
  console.log(`[clean-seed] ${rewards.length} récompenses fidélité créées.`);

  // ═══════════════════════════════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log("\n[clean-seed] ✅ TERMINÉ — Comptes de test:");
  console.log("  ┌─────────────────────────────────────────────────────────────────────┐");
  console.log("  │  RÔLE              │  EMAIL                          │  MOT DE PASSE  │");
  console.log("  ├─────────────────────────────────────────────────────────────────────┤");
  console.log("  │  Super Admin       │  admin@platform.com             │  Platform2024! │");
  console.log("  │  Admin Restaurant  │  admin@monrestaurant.com        │  Admin2024!    │");
  console.log("  │  Gérant            │  manager@monrestaurant.com      │  Manager2024!  │");
  console.log("  │  Personnel         │  staff@monrestaurant.com        │  Staff2024!    │");
  console.log("  │  Caissier          │  cashier@monrestaurant.com      │  Caissier2024! │");
  console.log("  │  Chef Cuisine      │  kitchen@monrestaurant.com      │  Cuisine2024!  │");
  console.log("  │  Resp. Livraison   │  delivery@monrestaurant.com     │  Livraison2024!│");
  console.log("  │  Hôte d'Accueil    │  host@monrestaurant.com         │  Accueil2024!  │");
  console.log("  │  Comptable         │  accountant@monrestaurant.com   │  Compta2024!   │");
  console.log("  │  Client            │  client@test.com                │  Client2024!   │");
  console.log("  │  Livreur 1         │  driver@test.com                │  Driver2024!   │");
  console.log("  │  Livreur 2         │  driver2@test.com               │  Driver2024!   │");
  console.log("  └─────────────────────────────────────────────────────────────────────┘");
}

main()
  .catch((e) => {
    console.error("[clean-seed] Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
