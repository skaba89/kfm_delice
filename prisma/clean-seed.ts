import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("[clean-seed] Wiping all data...");

  // Delete in reverse dependency order
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

  // --- Platform Admin ---
  const platformPw = await hash("Platform2024!", 10);
  const platformAdmin = await prisma.platformAdmin.create({
    data: {
      email: "admin@platform.com",
      password: platformPw,
      name: "Super Admin",
      role: "super_admin",
      status: "active",
    },
  });
  console.log(`[clean-seed] Platform admin: admin@platform.com / Platform2024!`);

  // --- Restaurant ---
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Mon Restaurant",
      slug: "mon-restaurant",
      tagline: "Bienvenue dans votre restaurant",
      description: "Restaurant de test pour validation complète de la plateforme.",
      phone: "+224 600 00 00 00",
      whatsapp: "+224 600 00 00 00",
      email: "contact@monrestaurant.com",
      address: "Conakry, Guinée",
      hours: "Lun-Dim : 11h00 - 23h00",
      rating: 4.5,
      tables: 20,
      deliveryFee: 5000,
      minDelivery: 15000,
      deliveryZones: "Kaloum:Dixinn:Matam:Matoto",
      plan: "pro",
      status: "active",
      currency: "GNF",
      locale: "fr",
      ownerEmail: "admin@monrestaurant.com",
      ownerName: "Propriétaire",
      ownerPhone: "+224 600 00 00 00",
    },
  });
  console.log(`[clean-seed] Restaurant créé: ${restaurant.name} (${restaurant.slug})`);

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
      socialLinks: JSON.stringify({ facebook: "", instagram: "", twitter: "" }),
    },
  });
  console.log("[clean-seed] Config restaurant créée.");

  // --- Admin (restaurant) ---
  const adminPw = await hash("Admin2024!", 10);
  await prisma.admin.create({
    data: {
      email: "admin@monrestaurant.com",
      password: adminPw,
      name: "Admin Restaurant",
      role: "admin",
      status: "active",
      mustChangePassword: false,
      restaurantId: restaurant.id,
    },
  });
  console.log(`[clean-seed] Admin restaurant: admin@monrestaurant.com / Admin2024!`);

  // --- Manager ---
  const managerPw = await hash("Manager2024!", 10);
  await prisma.admin.create({
    data: {
      email: "manager@monrestaurant.com",
      password: managerPw,
      name: "Manager Test",
      role: "manager",
      status: "active",
      mustChangePassword: false,
      restaurantId: restaurant.id,
    },
  });
  console.log(`[clean-seed] Manager: manager@monrestaurant.com / Manager2024!`);

  // --- Customer ---
  const clientPw = await hash("Client2024!", 10);
  await prisma.customer.create({
    data: {
      email: "client@test.com",
      password: clientPw,
      name: "Client Test",
      phone: "+224 611 11 11 11",
      address: "Kaloum, Conakry",
      loyaltyPoints: 0,
      totalOrders: 0,
      totalSpent: 0,
      status: "active",
      mustChangePassword: false,
      restaurantId: restaurant.id,
    },
  });
  console.log(`[clean-seed] Client: client@test.com / Client2024!`);

  // --- Driver ---
  const driverPw = await hash("Driver2024!", 10);
  await prisma.driver.create({
    data: {
      email: "driver@test.com",
      password: driverPw,
      name: "Livreur Test",
      phone: "+224 622 22 22 22",
      vehicle: "moto",
      status: "available",
      rating: 5.0,
      totalDeliveries: 0,
      zone: "Kaloum",
      mustChangePassword: false,
      restaurantId: restaurant.id,
    },
  });
  console.log(`[clean-seed] Livreur: driver@test.com / Driver2024!`);

  // --- A few menu items for testing ---
  const menuItems = [
    { name: "Riz Jollof Spécial", description: "Riz jollof signature avec poulet braisé", price: 35000, category: "plats", badge: "Signature", popular: true, order: 1, restaurantId: restaurant.id },
    { name: "Salade Fraîche", description: "Salade aux légumes de saison", price: 15000, category: "entrees", badge: "Végétarien", popular: true, order: 2, restaurantId: restaurant.id },
    { name: "Poisson Grillé", description: "Poisson frais du jour grillé au charbon", price: 30000, category: "plats", badge: "Frais", popular: false, order: 3, restaurantId: restaurant.id },
    { name: "Bissap", description: "Jus d'hibiscus glacé traditionnel", price: 5000, category: "boissons", badge: "Traditionnel", popular: true, order: 4, restaurantId: restaurant.id },
    { name: "Fruits Tropicaux", description: "Mangue, ananas, papaye", price: 12000, category: "desserts", badge: "Frais", popular: false, order: 5, restaurantId: restaurant.id },
  ];
  await prisma.menuItem.createMany({ data: menuItems });
  console.log(`[clean-seed] ${menuItems.length} items menu créés.`);

  // --- Loyalty Rewards for testing ---
  const rewards = [
    { name: "Réduction 10%", description: "10% de réduction sur votre prochaine commande", category: "discount", pointsCost: 100, value: 10, active: true, restaurantId: restaurant.id },
    { name: "Boisson offerte", description: "Une boisson gratuite avec votre repas", category: "free_item", pointsCost: 50, value: 5000, active: true, restaurantId: restaurant.id },
    { name: "Dessert VIP", description: "Dessert premium offert", category: "vip", pointsCost: 200, value: 15000, active: true, restaurantId: restaurant.id },
  ];
  await prisma.loyaltyReward.createMany({ data: rewards });
  console.log(`[clean-seed] ${rewards.length} récompenses fidélité créées.`);

  console.log("\n[clean-seed] ✅ TERMINÉ — Comptes de test:");
  console.log("  Platform: admin@platform.com / Platform2024!");
  console.log("  Admin:    admin@monrestaurant.com / Admin2024!");
  console.log("  Manager:  manager@monrestaurant.com / Manager2024!");
  console.log("  Client:   client@test.com / Client2024!");
  console.log("  Livreur:  driver@test.com / Driver2024!");
}

main()
  .catch((e) => {
    console.error("[clean-seed] Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
