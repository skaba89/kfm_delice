import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const reset = process.argv.includes("--reset");

  if (reset) {
    console.log("[seed] Resetting database...");
    // Delete in reverse dependency order
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
    console.log("[seed] Database cleared.");
  }

  // --- Platform Admin (upsert) ---
  const platformPw = await hash("platform2024", 10);
  const platformAdmin = await prisma.platformAdmin.upsert({
    where: { email: "admin@restaurantpro.com" },
    update: { password: platformPw },
    create: {
      email: "admin@restaurantpro.com",
      password: platformPw,
      name: "Super Admin",
      role: "super_admin",
      status: "active",
    },
  });
  console.log(`[seed] Platform admin ready (${platformAdmin.email}).`);

  // --- Restaurant (upsert by slug) ---
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "kfm-delice" },
    update: {},
    create: {
      name: "KFM Delice", slug: "kfm-delice", tagline: "L'Art du Goût Guinéen",
      description: "Restaurant gastronomique au cœur de Conakry.",
      phone: "+224 622 34 56 78", whatsapp: "+224 622 34 56 78",
      email: "reservation@kfm-delice.com",
      address: "Almamya, Corniche Nord, Conakry, Guinée",
      hours: "Lun-Dim : 11h00 - 23h00", rating: 4.9, tables: 25,
      deliveryFee: 5000, minDelivery: 15000,
      deliveryZones: "Kaloum:Dixinn:Matam:Matoto",
      plan: "pro", status: "active", currency: "GNF", locale: "fr",
      ownerEmail: "admin@kfm-delice.com", ownerName: "Admin KFM Delice", ownerPhone: "+224 622 34 56 78",
    },
  });
  console.log(`[seed] Restaurant ready (id: ${restaurant.id}).`);

  // --- Restaurant Config (upsert) ---
  await prisma.restaurantConfig.upsert({
    where: { restaurantId: restaurant.id },
    update: {},
    create: {
      restaurantId: restaurant.id,
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
        delivery: true, reservations: true, reviews: true, loyalty: true,
        pos: true, invoices: true, quotes: true, expenses: true, staff: true, drivers: true,
      }),
      openingHours: JSON.stringify({ open: 11, close: 23, timezone: "Africa/Conakry" }),
      socialLinks: JSON.stringify({ facebook: "", instagram: "", twitter: "" }),
    },
  });
  console.log("[seed] Restaurant config ready.");

  // --- Admins (upsert for idempotency) ---
  const adminPasswords = await Promise.all([
    hash("kfm2024", 10),
    hash("manager2024", 10),
    hash("staff2024", 10),
  ]);

  const admins = await Promise.all([
    prisma.admin.upsert({
      where: { email: "admin@kfm-delice.com" },
      update: { password: adminPasswords[0], mustChangePassword: true },
      create: { email: "admin@kfm-delice.com", password: adminPasswords[0], name: "Admin KFM Delice", role: "admin", status: "active", mustChangePassword: true, restaurantId: restaurant.id },
    }),
    prisma.admin.upsert({
      where: { email: "manager@kfm-delice.com" },
      update: { password: adminPasswords[1], mustChangePassword: true },
      create: { email: "manager@kfm-delice.com", password: adminPasswords[1], name: "Aminata Diallo", role: "manager", status: "active", mustChangePassword: true, restaurantId: restaurant.id },
    }),
    prisma.admin.upsert({
      where: { email: "staff@kfm-delice.com" },
      update: { password: adminPasswords[2], mustChangePassword: true },
      create: { email: "staff@kfm-delice.com", password: adminPasswords[2], name: "Ibrahima Touré", role: "staff", status: "active", mustChangePassword: true, restaurantId: restaurant.id },
    }),
  ]);
  console.log(`[seed] ${admins.length} admins ready.`);

  // --- Customers (upsert with composite key) ---
  const clientPw = await hash("client123", 10);
  const customerData = [
    { email: "aminata@gmail.com", name: "Aminata Camara", phone: "+224 620 11 22 33", address: "Kaloum, Conakry", loyaltyPoints: 250, totalOrders: 8, totalSpent: 680000, status: "active" as const },
    { email: "mamadou@gmail.com", name: "Mamadou Bah", phone: "+224 628 44 55 66", address: "Dixinn, Conakry", loyaltyPoints: 180, totalOrders: 5, totalSpent: 425000, status: "active" as const },
    { email: "fatoumata@gmail.com", name: "Fatoumata Diallo", phone: "+224 622 77 88 99", address: "Matam, Conakry", loyaltyPoints: 350, totalOrders: 12, totalSpent: 1150000, status: "active" as const },
    { email: "ibrahim@gmail.com", name: "Ibrahim Touré", phone: "+224 621 22 33 44", address: "Matoto, Conakry", loyaltyPoints: 100, totalOrders: 3, totalSpent: 195000, status: "active" as const },
    { email: "kadiatou@gmail.com", name: "Kadiatou Sylla", phone: "+224 625 55 66 77", address: "Corniche Nord, Conakry", loyaltyPoints: 420, totalOrders: 15, totalSpent: 1890000, status: "active" as const },
  ];

  // For customers with composite unique key (email + restaurantId), we need upsert workaround
  for (const c of customerData) {
    const existing = await prisma.customer.findFirst({
      where: { email: c.email, restaurantId: restaurant.id },
    });
    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: { password: clientPw, mustChangePassword: true },
      });
    } else {
      await prisma.customer.create({
        data: { ...c, password: clientPw, mustChangePassword: true, restaurantId: restaurant.id },
      });
    }
  }
  console.log(`[seed] ${customerData.length} customers ready.`);

  // --- Menu Items (createMany only if none exist) ---
  const menuCount = await prisma.menuItem.count({ where: { restaurantId: restaurant.id } });
  if (menuCount === 0) {
    const menuItems = [
      { name: "Salade KFM", description: "Salade fraîche aux légumes de saison, avocat, mangue verte", price: 15000, category: "entrees", image: "/images/kfm-dish-3.png", badge: "Végétarien", popular: true, order: 1, restaurantId: restaurant.id },
      { name: "Brochettes de Crevettes", description: "Crevettes marinées aux épices guinéennes, grillées au charbon", price: 25000, category: "entrees", image: "/images/kfm-dish-2.png", badge: "Mer", popular: false, order: 2, restaurantId: restaurant.id },
      { name: "Soupe de Poisson KFM", description: "Soupe traditionnelle de poisson frais du jour", price: 18000, category: "entrees", image: "/images/kfm-dish-4.png", badge: "Maison", popular: true, order: 3, restaurantId: restaurant.id },
      { name: "Alloco Complet", description: "Alloco croustillant, sauce tomate pimentée et poisson fumé", price: 12000, category: "entrees", image: "/images/kfm-dish-8.png", badge: "Local", popular: true, order: 4, restaurantId: restaurant.id },
      { name: "Riz Jollof KFM Spécial", description: "Notre riz jollof signature avec poulet braisé aux herbes", price: 35000, category: "plats", image: "/images/dish-1.png", badge: "Signature", popular: true, order: 5, restaurantId: restaurant.id },
      { name: "Agneau Braisé aux Épices", description: "Agneau fondant braisé, alloco croustillant et sauce yassa", price: 40000, category: "plats", image: "/images/kfm-dish-1.png", badge: "Premium", popular: true, order: 6, restaurantId: restaurant.id },
      { name: "Poisson Grillé Entier", description: "Poisson frais du jour grillé au charbon de bois", price: 30000, category: "plats", image: "/images/dish-3.png", badge: "Frais", popular: false, order: 7, restaurantId: restaurant.id },
      { name: "Plasas Traditionnel", description: "Plasas aux feuilles de manioc, poisson fumé, viande de chèvre", price: 25000, category: "plats", image: "/images/dish-2.png", badge: "Traditionnel", popular: false, order: 8, restaurantId: restaurant.id },
      { name: "Poulet Yassa Maison", description: "Poulet mariné au citron et oignons caramélisés, riz blanc", price: 28000, category: "plats", image: "/images/kfm-dish-5.png", badge: "Maison", popular: true, order: 9, restaurantId: restaurant.id },
      { name: "Thieboudienne KFM", description: "Riz au poisson et légumes, sauce tomate traditionnelle", price: 30000, category: "plats", image: "/images/kfm-dish-6.png", badge: "Chef", popular: true, order: 10, restaurantId: restaurant.id },
      { name: "Mafé Viande", description: "Ragoût d'arachide à la viande de bœuf, riz ou foufou", price: 27000, category: "plats", image: "/images/kfm-dish-9.png", badge: "Traditionnel", popular: false, order: 11, restaurantId: restaurant.id },
      { name: "Attiéké Poisson", description: "Semoule de manioc au poisson grillé, piment et tomate", price: 25000, category: "plats", image: "/images/kfm-dish-7.png", badge: "Ivoirien", popular: true, order: 12, restaurantId: restaurant.id },
      { name: "Plateau Fruits de Mer KFM", description: "Crevettes, crabes, huîtres et poisson fumé pour 2 personnes", price: 55000, category: "mer", image: "/images/kfm-dish-2.png", badge: "2 pers.", popular: true, order: 13, restaurantId: restaurant.id },
      { name: "Crevettes Sauce Curry", description: "Crevettes sautées au curry doux, lait de coco et riz basmati", price: 38000, category: "mer", image: "/images/kfm-dish-2.png", badge: "Chef", popular: false, order: 14, restaurantId: restaurant.id },
      { name: "Homard Grillé", description: "Homard entier grillé au beurre d'ail et citron", price: 75000, category: "mer", image: "/images/kfm-dish-10.png", badge: "Luxe", popular: true, order: 15, restaurantId: restaurant.id },
      { name: "Assiette de Fruits Tropicaux", description: "Mangue, ananas, papaye et banane fraîche de saison", price: 12000, category: "desserts", image: "/images/kfm-dish-3.png", badge: "Frais", popular: true, order: 16, restaurantId: restaurant.id },
      { name: "Gâteau Chocolat-Coco", description: "Fondant au chocolat noir et noix de coco râpée", price: 15000, category: "desserts", image: "/images/kfm-dish-3.png", badge: "Maison", popular: false, order: 17, restaurantId: restaurant.id },
      { name: "Bissap", description: "Jus d'hibiscus glacé traditionnel, sucré et rafraîchissant", price: 5000, category: "boissons", image: "/images/kfm-dish-11.png", badge: "Traditionnel", popular: true, order: 18, restaurantId: restaurant.id },
      { name: "Jus de Gingembre", description: "Jus de gingembre frais au citron et miel, pétillant", price: 5000, category: "boissons", image: "/images/kfm-dish-12.png", badge: "Épicé", popular: true, order: 19, restaurantId: restaurant.id },
      { name: "Cocktail Mangue-Passion", description: "Cocktail sans alcool mangue et fruit de la passion", price: 8000, category: "boissons", image: "/images/kfm-dish-11.png", badge: "Exotique", popular: false, order: 20, restaurantId: restaurant.id },
      { name: "Eau Minérale", description: "Eau minérale gazeuse ou plate 50cl", price: 3000, category: "boissons", image: "/images/kfm-dish-12.png", badge: "", popular: false, order: 21, restaurantId: restaurant.id },
    ];
    await prisma.menuItem.createMany({ data: menuItems });
    console.log(`[seed] ${menuItems.length} menu items created.`);
  } else {
    console.log(`[seed] Menu items already exist (${menuCount}), skipping.`);
  }

  // --- Drivers ---
  const driverPw = await hash("driver123", 10);
  const driverData = [
    { email: "moussa@kfm-delice.com", name: "Moussa Condé", phone: "+224 620 11 22 33", vehicle: "moto" as const, status: "available" as const, rating: 4.8, totalDeliveries: 156, zone: "Kaloum", restaurantId: restaurant.id },
    { email: "ibrahima@kfm-delice.com", name: "Ibrahima Sow", phone: "+224 628 44 55 66", vehicle: "moto" as const, status: "busy" as const, rating: 4.6, totalDeliveries: 98, zone: "Dixinn", restaurantId: restaurant.id },
    { email: "abdoulaye@kfm-delice.com", name: "Abdoulaye Diallo", phone: "+224 622 77 88 99", vehicle: "velo" as const, status: "available" as const, rating: 4.9, totalDeliveries: 210, zone: "Matam", restaurantId: restaurant.id },
    { email: "ousmane@kfm-delice.com", name: "Ousmane Camara", phone: "+224 625 55 66 77", vehicle: "moto" as const, status: "offline" as const, rating: 4.3, totalDeliveries: 45, zone: "Matoto", restaurantId: restaurant.id },
    { email: "mamadou-driver@kfm-delice.com", name: "Mamadou Bah", phone: "+224 621 22 33 44", vehicle: "voiture" as const, status: "available" as const, rating: 4.7, totalDeliveries: 67, zone: "Conakry", restaurantId: restaurant.id },
  ];

  for (const d of driverData) {
    const existing = await prisma.driver.findFirst({
      where: { email: d.email, restaurantId: restaurant.id },
    });
    if (existing) {
      await prisma.driver.update({ where: { id: existing.id }, data: { password: driverPw, mustChangePassword: true } });
    } else {
      await prisma.driver.create({ data: { ...d, password: driverPw, mustChangePassword: true } });
    }
  }
  console.log(`[seed] ${driverData.length} drivers ready.`);

  // --- Orders ---
  const orderCount = await prisma.order.count({ where: { restaurantId: restaurant.id } });
  if (orderCount === 0) {
    await prisma.order.createMany({
      data: [
        { customerName: "Aminata Camara", phone: "+224 620 11 22 33", items: JSON.stringify([{ name: "Riz Jollof KFM Spécial", price: 35000, qty: 2 }, { name: "Salade KFM", price: 15000, qty: 1 }]), total: 85000, status: "preparing", orderType: "dine_in", paymentMethod: "orange_money", deliveryFee: 0, restaurantId: restaurant.id },
        { customerName: "Walk-in Client", items: JSON.stringify([{ name: "Agneau Braisé aux Épices", price: 40000, qty: 1 }, { name: "Plateau Fruits de Mer KFM", price: 55000, qty: 1 }]), total: 95000, status: "ready", orderType: "dine_in", paymentMethod: "cash", deliveryFee: 0, restaurantId: restaurant.id },
        { customerName: "Aissatou Touré", phone: "+224 623 88 99 00", items: JSON.stringify([{ name: "Riz Jollof KFM Spécial", price: 35000, qty: 2 }, { name: "Assiette de Fruits Tropicaux", price: 12000, qty: 1 }]), total: 82000, status: "delivering", orderType: "delivery", paymentMethod: "orange_money", deliveryAddress: "Cité Chemin de Fer, Dixinn", deliveryFee: 5000, restaurantId: restaurant.id },
        { customerName: "Sekou Bangoura", phone: "+224 627 11 22 33", items: JSON.stringify([{ name: "Agneau Braisé aux Épices", price: 40000, qty: 1 }, { name: "Salade KFM", price: 15000, qty: 2 }]), total: 75000, status: "ready", orderType: "delivery", paymentMethod: "mtn_money", deliveryAddress: "Belle Vue, Kaloum", deliveryFee: 5000, restaurantId: restaurant.id },
        { customerName: "Djenabou Sylla", phone: "+224 624 33 44 55", items: JSON.stringify([{ name: "Poisson Grillé Entier", price: 30000, qty: 1 }]), total: 35000, status: "delivered", orderType: "delivery", paymentMethod: "cash", deliveryAddress: "Hamdallaye, Matam", deliveryFee: 5000, restaurantId: restaurant.id },
        { customerName: "Mamadou Bah", phone: "+224 628 44 55 66", items: JSON.stringify([{ name: "Plasas Traditionnel", price: 25000, qty: 2 }, { name: "Brochettes de Crevettes", price: 25000, qty: 1 }]), total: 75000, status: "pending", orderType: "takeaway", paymentMethod: "cash", deliveryFee: 0, restaurantId: restaurant.id },
        { customerName: "Thierno Bah", phone: "+224 626 66 77 88", items: JSON.stringify([{ name: "Brochettes de Crevettes", price: 25000, qty: 1 }, { name: "Gâteau Chocolat-Coco", price: 15000, qty: 1 }]), total: 45000, status: "pending", orderType: "delivery", paymentMethod: "orange_money", deliveryAddress: "Nongo, Matoto", deliveryFee: 5000, restaurantId: restaurant.id },
      ],
    });
    console.log("[seed] 7 orders created.");
  }

  // --- Reservations ---
  const reservationCount = await prisma.reservation.count({ where: { restaurantId: restaurant.id } });
  if (reservationCount === 0) {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    await prisma.reservation.createMany({
      data: [
        { customerName: "Aminata Camara", phone: "+224 620 11 22 33", date: today, time: "12:00", guests: 4, zone: "terrasse", notes: "Anniversaire de ma fille", status: "confirmed", loyaltyPoint: 50, restaurantId: restaurant.id },
        { customerName: "Mamadou Bah", phone: "+224 628 44 55 66", date: today, time: "13:00", guests: 2, zone: "interieur", status: "confirmed", loyaltyPoint: 50, restaurantId: restaurant.id },
        { customerName: "Fatoumata Diallo", phone: "+224 622 77 88 99", date: today, time: "19:30", guests: 6, zone: "vip", notes: "Dîner d'affaires", status: "pending", loyaltyPoint: 50, restaurantId: restaurant.id },
        { customerName: "Ibrahim Touré", phone: "+224 621 22 33 44", date: today, time: "20:00", guests: 3, zone: "terrasse", notes: "Allergie arachide", status: "confirmed", loyaltyPoint: 50, restaurantId: restaurant.id },
        { customerName: "Kadiatou Sylla", phone: "+224 625 55 66 77", date: tomorrow, time: "12:30", guests: 8, zone: "vip", notes: "Repas de famille", status: "pending", loyaltyPoint: 50, restaurantId: restaurant.id },
      ],
    });
    console.log("[seed] 5 reservations created.");
  }

  // --- Reviews ---
  const reviewCount = await prisma.review.count({ where: { restaurantId: restaurant.id } });
  if (reviewCount === 0) {
    await prisma.review.createMany({
      data: [
        { customerName: "Aminata Camara", rating: 5, comment: "Le meilleur restaurant de Conakry !", date: "Mai 2026", restaurantId: restaurant.id },
        { customerName: "Mamadou Bah", rating: 5, comment: "Espace VIP parfait pour les dîners d'affaires.", date: "Avril 2026", restaurantId: restaurant.id },
        { customerName: "Fatoumata Diallo", rating: 5, comment: "Surprise d'anniversaire inoubliable !", date: "Mars 2026", restaurantId: restaurant.id },
        { customerName: "Ibrahim Touré", rating: 4, comment: "Fruits de mer très frais, menu digital moderne.", date: "Février 2026", restaurantId: restaurant.id },
        { customerName: "Kadiatou Sylla", rating: 5, comment: "Ambiance terrasse au coucher du soleil, magique.", date: "Janvier 2026", restaurantId: restaurant.id },
      ],
    });
    console.log("[seed] 5 reviews created.");
  }

  // --- Staff ---
  const staffCount = await prisma.staff.count({ where: { restaurantId: restaurant.id } });
  if (staffCount === 0) {
    await prisma.staff.createMany({
      data: [
        { name: "Chefs de Cuisine Mamadou", phone: "+224 620 99 88 77", role: "cuisinier", salary: 1500000, status: "active", hireDate: "2023-03-15", notes: "Chef principal, 10 ans d'expérience", restaurantId: restaurant.id },
        { name: "Fatoumata Camara", phone: "+224 621 55 44 33", role: "serveur", salary: 600000, status: "active", hireDate: "2023-06-01", notes: "Service en salle", restaurantId: restaurant.id },
        { name: "Ibrahima Diallo", phone: "+224 622 33 22 11", role: "barman", salary: 700000, status: "active", hireDate: "2023-08-20", notes: "Spécialiste cocktails", restaurantId: restaurant.id },
        { name: "Aissatou Bah", phone: "+224 623 44 55 66", role: "serveur", salary: 600000, status: "on_leave", hireDate: "2024-01-10", notes: "Congé maternité jusqu'en juillet", restaurantId: restaurant.id },
        { name: "Moussa Sylla", phone: "+224 624 77 88 99", role: "plongeur", salary: 400000, status: "active", hireDate: "2024-02-01", notes: "", restaurantId: restaurant.id },
        { name: "Ousmane Touré", phone: "+224 625 11 22 33", role: "securite", salary: 500000, status: "active", hireDate: "2023-11-15", notes: "Agent de sécurité nocturne", restaurantId: restaurant.id },
        { name: "Mariama Condé", phone: "+224 626 55 66 77", role: "caissier", salary: 650000, status: "active", hireDate: "2023-05-01", notes: "Gestion caisse et Orange Money", restaurantId: restaurant.id },
        { name: "Alpha Sow", phone: "+224 627 88 99 00", role: "gerant", salary: 1200000, status: "active", hireDate: "2022-01-15", notes: "Gérant adjoint", restaurantId: restaurant.id },
      ],
    });
    console.log("[seed] 8 staff created.");
  }

  // --- Invoices ---
  const invoiceCount = await prisma.invoice.count({ where: { restaurantId: restaurant.id } });
  if (invoiceCount === 0) {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    await prisma.invoice.createMany({
      data: [
        { number: "FAC-2026-001", customerName: "Société Minière de Guinée", customerPhone: "+224 630 11 22 33", items: JSON.stringify([{ description: "Dîner d'affaires VIP", qty: 1, unitPrice: 350000, total: 350000 }]), subtotal: 350000, tax: 52500, total: 402500, status: "paid", dueDate: today, notes: "Dîner du 15 mai 2026, salle VIP", restaurantId: restaurant.id },
        { number: "FAC-2026-002", customerName: "Ambassade de France", customerPhone: "+224 631 44 55 66", items: JSON.stringify([{ description: "Cocktail réception", qty: 1, unitPrice: 500000, total: 500000 }, { description: "Service traiteur", qty: 1, unitPrice: 200000, total: 200000 }]), subtotal: 700000, tax: 105000, total: 805000, status: "pending", dueDate: tomorrow, notes: "Réception du 20 juin 2026", restaurantId: restaurant.id },
        { number: "FAC-2026-003", customerName: "KFM Events", customerPhone: "+224 632 77 88 99", items: JSON.stringify([{ description: "Buffet anniversaire", qty: 1, unitPrice: 250000, total: 250000 }]), subtotal: 250000, tax: 37500, total: 287500, status: "overdue", dueDate: "2026-05-01", notes: "Événement privé, 30 convives", restaurantId: restaurant.id },
        { number: "FAC-2026-004", customerName: "World Bank Conakry", customerPhone: "+224 633 00 11 22", items: JSON.stringify([{ description: "Déjeuner séminaire", qty: 1, unitPrice: 180000, total: 180000 }]), subtotal: 180000, tax: 27000, total: 207000, status: "paid", dueDate: today, notes: "Séminaire 15 personnes", restaurantId: restaurant.id },
      ],
    });
    console.log("[seed] 4 invoices created.");
  }

  // --- Quotes ---
  const quoteCount = await prisma.quote.count({ where: { restaurantId: restaurant.id } });
  if (quoteCount === 0) {
    await prisma.quote.createMany({
      data: [
        { number: "DEV-2026-001", customerName: "Orange Guinée", customerPhone: "+224 640 11 22 33", items: JSON.stringify([{ description: "Cocktail d'inauguration", qty: 1, unitPrice: 750000, total: 750000 }, { description: "Décoration florale", qty: 1, unitPrice: 150000, total: 150000 }]), subtotal: 900000, discount: 50000, total: 850000, status: "sent", validUntil: "2026-07-01", notes: "Inauguration nouveau siège, 100 invités", restaurantId: restaurant.id },
        { number: "DEV-2026-002", customerName: "MTN Guinée", customerPhone: "+224 641 44 55 66", items: JSON.stringify([{ description: "Dîner gala annuel", qty: 1, unitPrice: 1200000, total: 1200000 }]), subtotal: 1200000, discount: 100000, total: 1100000, status: "accepted", validUntil: "2026-06-30", notes: "Gala annuel 80 personnes", restaurantId: restaurant.id },
        { number: "DEV-2026-003", customerName: "Particulier - M. Bangoura", customerPhone: "+224 642 77 88 99", items: JSON.stringify([{ description: "Réception mariage", qty: 1, unitPrice: 2000000, total: 2000000 }, { description: "Gâteau de mariage", qty: 1, unitPrice: 300000, total: 300000 }]), subtotal: 2300000, discount: 200000, total: 2100000, status: "draft", validUntil: "2026-08-01", notes: "Mariage prévu août 2026, 150 invités", restaurantId: restaurant.id },
      ],
    });
    console.log("[seed] 3 quotes created.");
  }

  // --- Expenses ---
  const expenseCount = await prisma.expense.count({ where: { restaurantId: restaurant.id } });
  if (expenseCount === 0) {
    const today = new Date().toISOString().split("T")[0];
    await prisma.expense.createMany({
      data: [
        { description: "Achat poissons frais au marché", amount: 450000, category: "ingredients", date: today, paidBy: "Alpha Sow", notes: "Poisson, crevettes, crabes", restaurantId: restaurant.id },
        { description: "Facture électricité juin", amount: 850000, category: "utilities", date: today, paidBy: "Admin", notes: "EDG facture mensuelle", restaurantId: restaurant.id },
        { description: "Loyer local juin 2026", amount: 5000000, category: "rent", date: "2026-06-01", paidBy: "Admin", notes: "Loyer mensuel Corniche Nord", restaurantId: restaurant.id },
        { description: "Salaires mai 2026", amount: 6150000, category: "salary", date: "2026-05-31", paidBy: "Admin", notes: "8 employés", restaurantId: restaurant.id },
        { description: "Réparation cuisinière professionnelle", amount: 350000, category: "equipment", date: "2026-05-28", paidBy: "Alpha Sow", notes: "Pièce détachée et main d'œuvre", restaurantId: restaurant.id },
        { description: "Carburant livraisons", amount: 200000, category: "transport", date: "2026-05-29", paidBy: "Moussa Condé", notes: "Essence motos livraison semaine", restaurantId: restaurant.id },
        { description: "Emballages et sacs livraison", amount: 75000, category: "other", date: "2026-05-30", paidBy: "Admin", notes: "Barquettes, sacs isothermes", restaurantId: restaurant.id },
        { description: "Achat viande et volaille", amount: 600000, category: "ingredients", date: "2026-05-30", paidBy: "Chefs de Cuisine Mamadou", notes: "Agneau, poulet, bœuf", restaurantId: restaurant.id },
      ],
    });
    console.log("[seed] 8 expenses created.");
  }

  console.log("[seed] Seeding complete!");
}

main()
  .catch((e) => {
    console.error("[seed] Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
