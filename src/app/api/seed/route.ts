import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Create admin
    const existingAdmin = await db.admin.findFirst();
    if (!existingAdmin) {
      await db.admin.create({
        data: { email: "admin@kfm-delice.com", password: "kfm2024", name: "Admin KFM Delice", role: "admin" },
      });
    }

    // Create or get restaurant
    let restaurant = await db.restaurant.findFirst();
    if (!restaurant) {
      restaurant = await db.restaurant.create({
        data: {
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

      // Menu items
      const menuItems = [
        { name: "Salade KFM", description: "Salade fraîche aux légumes de saison, avocat, mangue verte", price: 15000, category: "entrees", image: "/images/kfm-dish-3.png", badge: "Végétarien", popular: true, order: 1, restaurantId: restaurant.id },
        { name: "Brochettes de Crevettes", description: "Crevettes marinées aux épices guinéennes, grillées au charbon", price: 25000, category: "entrees", image: "/images/kfm-dish-2.png", badge: "Mer", popular: false, order: 2, restaurantId: restaurant.id },
        { name: "Soupe de Poisson KFM", description: "Soupe traditionnelle de poisson frais", price: 18000, category: "entrees", image: "/images/kfm-dish-4.png", badge: "Maison", popular: true, order: 3, restaurantId: restaurant.id },
        { name: "Riz Jollof KFM Spécial", description: "Notre riz jollof signature avec poulet braisé aux herbes", price: 35000, category: "plats", image: "/images/dish-1.png", badge: "Signature", popular: true, order: 4, restaurantId: restaurant.id },
        { name: "Agneau Braisé aux Épices", description: "Agneau fondant braisé, alloco croustillant et sauce yassa", price: 40000, category: "plats", image: "/images/kfm-dish-1.png", badge: "Premium", popular: true, order: 5, restaurantId: restaurant.id },
        { name: "Poisson Grillé Entier", description: "Poisson frais du jour grillé au charbon", price: 30000, category: "plats", image: "/images/dish-3.png", badge: "Frais", popular: false, order: 6, restaurantId: restaurant.id },
        { name: "Plasas Traditionnel", description: "Plasas aux feuilles de manioc, poisson fumé, viande", price: 25000, category: "plats", image: "/images/dish-2.png", badge: "Traditionnel", popular: false, order: 7, restaurantId: restaurant.id },
        { name: "Plateau Fruits de Mer KFM", description: "Crevettes, crabes, huîtres et poisson fumé", price: 55000, category: "mer", image: "/images/kfm-dish-2.png", badge: "2 pers.", popular: true, order: 8, restaurantId: restaurant.id },
        { name: "Crevettes Sauce Curry", description: "Crevettes sautées au curry doux, lait de coco", price: 38000, category: "mer", image: "/images/kfm-dish-2.png", badge: "Chef", popular: false, order: 9, restaurantId: restaurant.id },
        { name: "Assiette de Fruits Tropicaux", description: "Mangue, ananas, papaye et banane fraîche", price: 12000, category: "desserts", image: "/images/kfm-dish-3.png", badge: "Frais", popular: true, order: 10, restaurantId: restaurant.id },
        { name: "Gâteau Chocolat-Coco", description: "Fondant au chocolat et noix de coco", price: 15000, category: "desserts", image: "/images/kfm-dish-3.png", badge: "Maison", popular: false, order: 11, restaurantId: restaurant.id },
      ];
      await db.menuItem.createMany({ data: menuItems });

      // Reservations
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      await db.reservation.createMany({
        data: [
          { customerName: "Aminata Camara", phone: "+224 620 11 22 33", date: today, time: "12:00", guests: 4, zone: "terrasse", notes: "Anniversaire de ma fille", status: "confirmed", loyaltyPoint: 50, restaurantId: restaurant.id },
          { customerName: "Mamadou Bah", phone: "+224 628 44 55 66", date: today, time: "13:00", guests: 2, zone: "interieur", status: "confirmed", loyaltyPoint: 50, restaurantId: restaurant.id },
          { customerName: "Fatoumata Diallo", phone: "+224 622 77 88 99", date: today, time: "19:30", guests: 6, zone: "vip", notes: "Dîner d'affaires", status: "pending", loyaltyPoint: 50, restaurantId: restaurant.id },
          { customerName: "Ibrahim Touré", phone: "+224 621 22 33 44", date: today, time: "20:00", guests: 3, zone: "terrasse", notes: "Allergie arachide", status: "confirmed", loyaltyPoint: 50, restaurantId: restaurant.id },
          { customerName: "Kadiatou Sylla", phone: "+224 625 55 66 77", date: tomorrow, time: "12:30", guests: 8, zone: "vip", notes: "Repas de famille", status: "pending", loyaltyPoint: 50, restaurantId: restaurant.id },
        ],
      });

      // Drivers
      await db.driver.createMany({
        data: [
          { name: "Moussa Condé", phone: "+224 620 11 22 33", vehicle: "moto", status: "available", rating: 4.8, totalDeliveries: 156, zone: "Kaloum", restaurantId: restaurant.id },
          { name: "Ibrahima Sow", phone: "+224 628 44 55 66", vehicle: "moto", status: "busy", rating: 4.6, totalDeliveries: 98, zone: "Dixinn", restaurantId: restaurant.id },
          { name: "Abdoulaye Diallo", phone: "+224 622 77 88 99", vehicle: "velo", status: "available", rating: 4.9, totalDeliveries: 210, zone: "Matam", restaurantId: restaurant.id },
          { name: "Ousmane Camara", phone: "+224 625 55 66 77", vehicle: "moto", status: "offline", rating: 4.3, totalDeliveries: 45, zone: "Matoto", restaurantId: restaurant.id },
          { name: "Mamadou Bah", phone: "+224 621 22 33 44", vehicle: "voiture", status: "available", rating: 4.7, totalDeliveries: 67, zone: "Conakry", restaurantId: restaurant.id },
        ],
      });

      // Orders with mixed types
      const drivers = await db.driver.findMany({ where: { restaurantId: restaurant.id } });
      await db.order.createMany({
        data: [
          { customerName: "Aminata Camara", phone: "+224 620 11 22 33", items: JSON.stringify([{ name: "Riz Jollof KFM Spécial", price: 35000, qty: 2 }, { name: "Salade KFM", price: 15000, qty: 1 }]), total: 85000, status: "preparing", orderType: "dine_in", paymentMethod: "orange_money", deliveryFee: 0, restaurantId: restaurant.id },
          { customerName: "Walk-in Client", items: JSON.stringify([{ name: "Agneau Braisé aux Épices", price: 40000, qty: 1 }, { name: "Plateau Fruits de Mer KFM", price: 55000, qty: 1 }]), total: 95000, status: "ready", orderType: "dine_in", paymentMethod: "cash", deliveryFee: 0, restaurantId: restaurant.id },
          { customerName: "Aissatou Touré", phone: "+224 623 88 99 00", items: JSON.stringify([{ name: "Riz Jollof KFM Spécial", price: 35000, qty: 2 }, { name: "Assiette de Fruits Tropicaux", price: 12000, qty: 1 }]), total: 82000, status: "delivering", orderType: "delivery", paymentMethod: "orange_money", deliveryAddress: "Cité Chemin de Fer, Dixinn", deliveryFee: 5000, driverId: drivers[1]?.id || null, restaurantId: restaurant.id },
          { customerName: "Sekou Bangoura", phone: "+224 627 11 22 33", items: JSON.stringify([{ name: "Agneau Braisé aux Épices", price: 40000, qty: 1 }, { name: "Salade KFM", price: 15000, qty: 2 }]), total: 75000, status: "ready", orderType: "delivery", paymentMethod: "mtn_money", deliveryAddress: "Belle Vue, Kaloum", deliveryFee: 5000, restaurantId: restaurant.id },
          { customerName: "Djenabou Sylla", phone: "+224 624 33 44 55", items: JSON.stringify([{ name: "Poisson Grillé Entier", price: 30000, qty: 1 }]), total: 35000, status: "delivered", orderType: "delivery", paymentMethod: "cash", deliveryAddress: "Hamdallaye, Matam", deliveryFee: 5000, driverId: drivers[0]?.id || null, restaurantId: restaurant.id },
          { customerName: "Mamadou Bah", phone: "+224 628 44 55 66", items: JSON.stringify([{ name: "Plasas Traditionnel", price: 25000, qty: 2 }, { name: "Brochettes de Crevettes", price: 25000, qty: 1 }]), total: 75000, status: "pending", orderType: "takeaway", paymentMethod: "cash", deliveryFee: 0, restaurantId: restaurant.id },
          { customerName: "Thierno Bah", phone: "+224 626 66 77 88", items: JSON.stringify([{ name: "Brochettes de Crevettes", price: 25000, qty: 1 }, { name: "Gâteau Chocolat-Coco", price: 15000, qty: 1 }]), total: 45000, status: "pending", orderType: "delivery", paymentMethod: "orange_money", deliveryAddress: "Nongo, Matoto", deliveryFee: 5000, restaurantId: restaurant.id },
        ],
      });

      // Reviews
      await db.review.createMany({
        data: [
          { customerName: "Aminata Camara", rating: 5, comment: "Le meilleur restaurant de Conakry !", date: "Mai 2026", restaurantId: restaurant.id },
          { customerName: "Mamadou Bah", rating: 5, comment: "Espace VIP parfait pour les dîners d'affaires.", date: "Avril 2026", restaurantId: restaurant.id },
          { customerName: "Fatoumata Diallo", rating: 5, comment: "Surprise d'anniversaire inoubliable !", date: "Mars 2026", restaurantId: restaurant.id },
          { customerName: "Ibrahim Touré", rating: 4, comment: "Fruits de mer très frais, menu digital moderne.", date: "Février 2026", restaurantId: restaurant.id },
          { customerName: "Kadiatou Sylla", rating: 5, comment: "Ambiance terrasse au coucher du soleil, magique.", date: "Janvier 2026", restaurantId: restaurant.id },
        ],
      });
    }

    return NextResponse.json({ success: true, message: "Base KFM Delice initialisée" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
