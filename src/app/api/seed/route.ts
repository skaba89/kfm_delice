import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { hashPassword, authenticateAdmin, hasRole } from "@/lib/auth";

// ─── Seed Token Configuration ───────────────────────────────────
const SEED_TOKEN = process.env.SEED_TOKEN;

// ─── In-memory Rate Limiter for Seed Endpoint ───────────────────
const seedRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const SEED_RATE_LIMIT_MAX = 3;       // max attempts per window
const SEED_RATE_LIMIT_WINDOW = 60000; // 1 minute window

function checkSeedRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = seedRateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // No entry or window expired — start fresh
    seedRateLimitMap.set(ip, { count: 1, resetAt: now + SEED_RATE_LIMIT_WINDOW });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= SEED_RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

export async function GET() {
  try {
    const adminCount = await db.admin.count();
    const seeded = adminCount > 0;
    return NextResponse.json({ seeded, needsSeed: !seeded });
  } catch {
    return NextResponse.json({ seeded: false, needsSeed: true });
  }
}

export async function POST(request: Request) {
  try {
    // ─── Rate Limiting ──────────────────────────────────────────
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";
    const rateCheck = checkSeedRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez dans quelques instants." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rateCheck.retryAfterMs / 1000)) } }
      );
    }

    // ─── Authentication / Authorization ──────────────────────────
    const existingAdminCount = await db.admin.count();
    if (existingAdminCount > 0) {
      // Existing admin — require admin auth
      const admin = await authenticateAdmin(request);
      if (!admin) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      }
      if (!hasRole(admin.role, ["admin"])) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else {
      // Bootstrap mode — no admin exists yet
      if (process.env.NODE_ENV === "production") {
        // In production, require seed token to prevent unauthorized bootstrap
        let providedToken: string | undefined;
        try {
          const body = await request.clone().json();
          providedToken = body.seedToken;
        } catch {
          // Body might not be JSON or empty
        }
        if (!providedToken) {
          providedToken = new URL(request.url).searchParams.get("seedToken") || undefined;
        }

        if (!SEED_TOKEN) {
          console.error("[SEED] SEED_TOKEN non configuré en production. Définissez la variable d'environnement SEED_TOKEN.");
          return NextResponse.json(
            { error: "SEED_TOKEN non configuré. Définissez la variable d'environnement SEED_TOKEN." },
            { status: 500 }
          );
        }
        if (providedToken !== SEED_TOKEN) {
          return NextResponse.json(
            { error: "Token d'initialisation invalide" },
            { status: 401 }
          );
        }
      }
      // In development, allow unauthenticated bootstrap for convenience
    }

    // Check if reset is requested
    const url = new URL(request.url);
    const reset = url.searchParams.get("reset") === "true";

    if (reset) {
      // Delete in reverse dependency order within a transaction
      await db.$transaction([
        db.expense.deleteMany(),
        db.quote.deleteMany(),
        db.invoice.deleteMany(),
        db.review.deleteMany(),
        db.order.deleteMany(),
        db.reservation.deleteMany(),
        db.staff.deleteMany(),
        db.menuItem.deleteMany(),
        db.driver.deleteMany(),
        db.customer.deleteMany(),
        db.admin.deleteMany(),
        db.restaurant.deleteMany(),
      ]);
    }

    // Use upsert for idempotency — safe to call multiple times
    // Hash all passwords in parallel
    const [admin1Pw, admin2Pw, admin3Pw, clientPw, driverPw] = await Promise.all([
      hashPassword("kfm2024"),
      hashPassword("manager2024"),
      hashPassword("staff2024"),
      hashPassword("client123"),
      hashPassword("driver123"),
    ]);

    // Upsert admins
    await Promise.all([
      db.admin.upsert({
        where: { email: "admin@kfm-delice.com" },
        update: { password: admin1Pw },
        create: { email: "admin@kfm-delice.com", password: admin1Pw, name: "Admin KFM Delice", role: "admin", status: "active" },
      }),
      db.admin.upsert({
        where: { email: "manager@kfm-delice.com" },
        update: { password: admin2Pw },
        create: { email: "manager@kfm-delice.com", password: admin2Pw, name: "Aminata Diallo", role: "manager", status: "active" },
      }),
      db.admin.upsert({
        where: { email: "staff@kfm-delice.com" },
        update: { password: admin3Pw },
        create: { email: "staff@kfm-delice.com", password: admin3Pw, name: "Ibrahima Touré", role: "staff", status: "active" },
      }),
    ]);

    // Upsert customers and capture their IDs for FK relations
    const [c1, c2, c3, c4, c5] = await Promise.all([
      db.customer.upsert({ where: { email: "aminata@gmail.com" }, update: { password: clientPw }, create: { email: "aminata@gmail.com", password: clientPw, name: "Aminata Camara", phone: "+224 620 11 22 33", address: "Kaloum, Conakry", loyaltyPoints: 250, totalOrders: 8, totalSpent: 680000, status: "active" } }),
      db.customer.upsert({ where: { email: "mamadou@gmail.com" }, update: { password: clientPw }, create: { email: "mamadou@gmail.com", password: clientPw, name: "Mamadou Bah", phone: "+224 628 44 55 66", address: "Dixinn, Conakry", loyaltyPoints: 180, totalOrders: 5, totalSpent: 425000, status: "active" } }),
      db.customer.upsert({ where: { email: "fatoumata@gmail.com" }, update: { password: clientPw }, create: { email: "fatoumata@gmail.com", password: clientPw, name: "Fatoumata Diallo", phone: "+224 622 77 88 99", address: "Matam, Conakry", loyaltyPoints: 350, totalOrders: 12, totalSpent: 1150000, status: "active" } }),
      db.customer.upsert({ where: { email: "ibrahim@gmail.com" }, update: { password: clientPw }, create: { email: "ibrahim@gmail.com", password: clientPw, name: "Ibrahim Touré", phone: "+224 621 22 33 44", address: "Matoto, Conakry", loyaltyPoints: 100, totalOrders: 3, totalSpent: 195000, status: "active" } }),
      db.customer.upsert({ where: { email: "kadiatou@gmail.com" }, update: { password: clientPw }, create: { email: "kadiatou@gmail.com", password: clientPw, name: "Kadiatou Sylla", phone: "+224 625 55 66 77", address: "Corniche Nord, Conakry", loyaltyPoints: 420, totalOrders: 15, totalSpent: 1890000, status: "active" } }),
    ]);

    // Build customer name→id map for linking seed data via FK
    const customerMap = new Map<string, string>();
    for (const c of [c1, c2, c3, c4, c5]) {
      customerMap.set(c.name, c.id);
    }

    // Upsert restaurant
    const restaurant = await db.restaurant.upsert({
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
      },
    });

    // Upsert drivers
    const drivers = await Promise.all([
      db.driver.upsert({ where: { email: "moussa@kfm-delice.com" }, update: { password: driverPw }, create: { email: "moussa@kfm-delice.com", password: driverPw, name: "Moussa Condé", phone: "+224 620 11 22 33", vehicle: "moto", status: "available", rating: 4.8, totalDeliveries: 156, zone: "Kaloum", restaurantId: restaurant.id } }),
      db.driver.upsert({ where: { email: "ibrahima@kfm-delice.com" }, update: { password: driverPw }, create: { email: "ibrahima@kfm-delice.com", password: driverPw, name: "Ibrahima Sow", phone: "+224 628 44 55 66", vehicle: "moto", status: "busy", rating: 4.6, totalDeliveries: 98, zone: "Dixinn", restaurantId: restaurant.id } }),
      db.driver.upsert({ where: { email: "abdoulaye@kfm-delice.com" }, update: { password: driverPw }, create: { email: "abdoulaye@kfm-delice.com", password: driverPw, name: "Abdoulaye Diallo", phone: "+224 622 77 88 99", vehicle: "velo", status: "available", rating: 4.9, totalDeliveries: 210, zone: "Matam", restaurantId: restaurant.id } }),
      db.driver.upsert({ where: { email: "ousmane@kfm-delice.com" }, update: { password: driverPw }, create: { email: "ousmane@kfm-delice.com", password: driverPw, name: "Ousmane Camara", phone: "+224 625 55 66 77", vehicle: "moto", status: "offline", rating: 4.3, totalDeliveries: 45, zone: "Matoto", restaurantId: restaurant.id } }),
      db.driver.upsert({ where: { email: "mamadou-driver@kfm-delice.com" }, update: { password: driverPw }, create: { email: "mamadou-driver@kfm-delice.com", password: driverPw, name: "Mamadou Bah", phone: "+224 621 22 33 44", vehicle: "voiture", status: "available", rating: 4.7, totalDeliveries: 67, zone: "Conakry", restaurantId: restaurant.id } }),
    ]);

    // Bulk data: only create if count is 0 (idempotent — won't duplicate on re-seed)
    const [menuCount, orderCount, reservationCount, reviewCount, staffCount, invoiceCount, quoteCount, expenseCount] = await Promise.all([
      db.menuItem.count({ where: { restaurantId: restaurant.id } }),
      db.order.count({ where: { restaurantId: restaurant.id } }),
      db.reservation.count({ where: { restaurantId: restaurant.id } }),
      db.review.count({ where: { restaurantId: restaurant.id } }),
      db.staff.count({ where: { restaurantId: restaurant.id } }),
      db.invoice.count({ where: { restaurantId: restaurant.id } }),
      db.quote.count({ where: { restaurantId: restaurant.id } }),
      db.expense.count({ where: { restaurantId: restaurant.id } }),
    ]);

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    // Create missing data in a transaction for atomicity
    await db.$transaction(async (tx) => {
      if (menuCount === 0) {
        await tx.menuItem.createMany({
          data: [
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
          ],
        });
      }

      if (reservationCount === 0) {
        await tx.reservation.createMany({
          data: [
            { customerName: "Aminata Camara", phone: "+224 620 11 22 33", date: today, time: "12:00", guests: 4, zone: "terrasse", notes: "Anniversaire de ma fille", status: "confirmed", loyaltyPoint: 50, customerId: customerMap.get("Aminata Camara") ?? null, restaurantId: restaurant.id },
            { customerName: "Mamadou Bah", phone: "+224 628 44 55 66", date: today, time: "13:00", guests: 2, zone: "interieur", status: "confirmed", loyaltyPoint: 50, customerId: customerMap.get("Mamadou Bah") ?? null, restaurantId: restaurant.id },
            { customerName: "Fatoumata Diallo", phone: "+224 622 77 88 99", date: today, time: "19:30", guests: 6, zone: "vip", notes: "Dîner d'affaires", status: "pending", loyaltyPoint: 50, customerId: customerMap.get("Fatoumata Diallo") ?? null, restaurantId: restaurant.id },
            { customerName: "Ibrahim Touré", phone: "+224 621 22 33 44", date: today, time: "20:00", guests: 3, zone: "terrasse", notes: "Allergie arachide", status: "confirmed", loyaltyPoint: 50, customerId: customerMap.get("Ibrahim Touré") ?? null, restaurantId: restaurant.id },
            { customerName: "Kadiatou Sylla", phone: "+224 625 55 66 77", date: tomorrow, time: "12:30", guests: 8, zone: "vip", notes: "Repas de famille", status: "pending", loyaltyPoint: 50, customerId: customerMap.get("Kadiatou Sylla") ?? null, restaurantId: restaurant.id },
          ],
        });
      }

      if (orderCount === 0) {
        await tx.order.createMany({
          data: [
            { customerName: "Aminata Camara", phone: "+224 620 11 22 33", items: JSON.stringify([{ name: "Riz Jollof KFM Spécial", price: 35000, qty: 2 }, { name: "Salade KFM", price: 15000, qty: 1 }]), total: 85000, status: "preparing", orderType: "dine_in", paymentMethod: "orange_money", deliveryFee: 0, customerId: customerMap.get("Aminata Camara") ?? null, restaurantId: restaurant.id },
            { customerName: "Walk-in Client", items: JSON.stringify([{ name: "Agneau Braisé aux Épices", price: 40000, qty: 1 }, { name: "Plateau Fruits de Mer KFM", price: 55000, qty: 1 }]), total: 95000, status: "ready", orderType: "dine_in", paymentMethod: "cash", deliveryFee: 0, restaurantId: restaurant.id },
            { customerName: "Aissatou Touré", phone: "+224 623 88 99 00", items: JSON.stringify([{ name: "Riz Jollof KFM Spécial", price: 35000, qty: 2 }, { name: "Assiette de Fruits Tropicaux", price: 12000, qty: 1 }]), total: 82000, status: "delivering", orderType: "delivery", paymentMethod: "orange_money", deliveryAddress: "Cité Chemin de Fer, Dixinn", deliveryFee: 5000, driverId: drivers[1]?.id || null, restaurantId: restaurant.id },
            { customerName: "Sekou Bangoura", phone: "+224 627 11 22 33", items: JSON.stringify([{ name: "Agneau Braisé aux Épices", price: 40000, qty: 1 }, { name: "Salade KFM", price: 15000, qty: 2 }]), total: 75000, status: "ready", orderType: "delivery", paymentMethod: "mtn_money", deliveryAddress: "Belle Vue, Kaloum", deliveryFee: 5000, restaurantId: restaurant.id },
            { customerName: "Djenabou Sylla", phone: "+224 624 33 44 55", items: JSON.stringify([{ name: "Poisson Grillé Entier", price: 30000, qty: 1 }]), total: 35000, status: "delivered", orderType: "delivery", paymentMethod: "cash", deliveryAddress: "Hamdallaye, Matam", deliveryFee: 5000, driverId: drivers[0]?.id || null, restaurantId: restaurant.id },
            { customerName: "Mamadou Bah", phone: "+224 628 44 55 66", items: JSON.stringify([{ name: "Plasas Traditionnel", price: 25000, qty: 2 }, { name: "Brochettes de Crevettes", price: 25000, qty: 1 }]), total: 75000, status: "pending", orderType: "takeaway", paymentMethod: "cash", deliveryFee: 0, customerId: customerMap.get("Mamadou Bah") ?? null, restaurantId: restaurant.id },
            { customerName: "Thierno Bah", phone: "+224 626 66 77 88", items: JSON.stringify([{ name: "Brochettes de Crevettes", price: 25000, qty: 1 }, { name: "Gâteau Chocolat-Coco", price: 15000, qty: 1 }]), total: 45000, status: "pending", orderType: "delivery", paymentMethod: "orange_money", deliveryAddress: "Nongo, Matoto", deliveryFee: 5000, restaurantId: restaurant.id },
          ],
        });
      }

      if (reviewCount === 0) {
        await tx.review.createMany({
          data: [
            { customerName: "Aminata Camara", rating: 5, comment: "Le meilleur restaurant de Conakry !", date: "Mai 2026", customerId: customerMap.get("Aminata Camara") ?? null, restaurantId: restaurant.id },
            { customerName: "Mamadou Bah", rating: 5, comment: "Espace VIP parfait pour les dîners d'affaires.", date: "Avril 2026", customerId: customerMap.get("Mamadou Bah") ?? null, restaurantId: restaurant.id },
            { customerName: "Fatoumata Diallo", rating: 5, comment: "Surprise d'anniversaire inoubliable !", date: "Mars 2026", customerId: customerMap.get("Fatoumata Diallo") ?? null, restaurantId: restaurant.id },
            { customerName: "Ibrahim Touré", rating: 4, comment: "Fruits de mer très frais, menu digital moderne.", date: "Février 2026", customerId: customerMap.get("Ibrahim Touré") ?? null, restaurantId: restaurant.id },
            { customerName: "Kadiatou Sylla", rating: 5, comment: "Ambiance terrasse au coucher du soleil, magique.", date: "Janvier 2026", customerId: customerMap.get("Kadiatou Sylla") ?? null, restaurantId: restaurant.id },
          ],
        });
      }

      if (staffCount === 0) {
        await tx.staff.createMany({
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
      }

      if (invoiceCount === 0) {
        await tx.invoice.createMany({
          data: [
            { number: "FAC-2026-001", customerName: "Société Minière de Guinée", customerPhone: "+224 630 11 22 33", items: JSON.stringify([{ description: "Dîner d'affaires VIP", qty: 1, unitPrice: 350000, total: 350000 }]), subtotal: 350000, tax: 52500, total: 402500, status: "paid", dueDate: today, notes: "Dîner du 15 mai 2026, salle VIP", restaurantId: restaurant.id },
            { number: "FAC-2026-002", customerName: "Ambassade de France", customerPhone: "+224 631 44 55 66", items: JSON.stringify([{ description: "Cocktail réception", qty: 1, unitPrice: 500000, total: 500000 }, { description: "Service traiteur", qty: 1, unitPrice: 200000, total: 200000 }]), subtotal: 700000, tax: 105000, total: 805000, status: "pending", dueDate: tomorrow, notes: "Réception du 20 juin 2026", restaurantId: restaurant.id },
            { number: "FAC-2026-003", customerName: "KFM Events", customerPhone: "+224 632 77 88 99", items: JSON.stringify([{ description: "Buffet anniversaire", qty: 1, unitPrice: 250000, total: 250000 }]), subtotal: 250000, tax: 37500, total: 287500, status: "overdue", dueDate: "2026-05-01", notes: "Événement privé, 30 convives", restaurantId: restaurant.id },
            { number: "FAC-2026-004", customerName: "World Bank Conakry", customerPhone: "+224 633 00 11 22", items: JSON.stringify([{ description: "Déjeuner séminaire", qty: 1, unitPrice: 180000, total: 180000 }]), subtotal: 180000, tax: 27000, total: 207000, status: "paid", dueDate: today, notes: "Séminaire 15 personnes", restaurantId: restaurant.id },
          ],
        });
      }

      if (quoteCount === 0) {
        await tx.quote.createMany({
          data: [
            { number: "DEV-2026-001", customerName: "Orange Guinée", customerPhone: "+224 640 11 22 33", items: JSON.stringify([{ description: "Cocktail d'inauguration", qty: 1, unitPrice: 750000, total: 750000 }, { description: "Décoration florale", qty: 1, unitPrice: 150000, total: 150000 }]), subtotal: 900000, discount: 50000, total: 850000, status: "sent", validUntil: "2026-07-01", notes: "Inauguration nouveau siège, 100 invités", restaurantId: restaurant.id },
            { number: "DEV-2026-002", customerName: "MTN Guinée", customerPhone: "+224 641 44 55 66", items: JSON.stringify([{ description: "Dîner gala annuel", qty: 1, unitPrice: 1200000, total: 1200000 }]), subtotal: 1200000, discount: 100000, total: 1100000, status: "accepted", validUntil: "2026-06-30", notes: "Gala annuel 80 personnes", restaurantId: restaurant.id },
            { number: "DEV-2026-003", customerName: "Particulier - M. Bangoura", customerPhone: "+224 642 77 88 99", items: JSON.stringify([{ description: "Réception mariage", qty: 1, unitPrice: 2000000, total: 2000000 }, { description: "Gâteau de mariage", qty: 1, unitPrice: 300000, total: 300000 }]), subtotal: 2300000, discount: 200000, total: 2100000, status: "draft", validUntil: "2026-08-01", notes: "Mariage prévu août 2026, 150 invités", restaurantId: restaurant.id },
          ],
        });
      }

      if (expenseCount === 0) {
        await tx.expense.createMany({
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
      }
    });

    return NextResponse.json({
      success: true,
      message: reset ? "Base réinitialisée et re-seedée avec succès" : "Base KFM Delice initialisée",
      reset,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// DELETE: Reset the database (admin only)
export async function DELETE(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    await db.$transaction([
      db.expense.deleteMany(),
      db.quote.deleteMany(),
      db.invoice.deleteMany(),
      db.review.deleteMany(),
      db.order.deleteMany(),
      db.reservation.deleteMany(),
      db.staff.deleteMany(),
      db.menuItem.deleteMany(),
      db.driver.deleteMany(),
      db.customer.deleteMany(),
      db.admin.deleteMany(),
      db.restaurant.deleteMany(),
    ]);

    return NextResponse.json({ success: true, message: "Base de données vidée avec succès" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
