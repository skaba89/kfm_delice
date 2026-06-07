import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Create admin
    const existingAdmin = await db.admin.findFirst();
    if (!existingAdmin) {
      await db.admin.create({
        data: {
          email: "admin@kfm-delice.com",
          password: "kfm2024",
          name: "Admin KFM Delice",
          role: "admin",
        },
      });
    }

    // Create restaurant
    let restaurant = await db.restaurant.findFirst();
    if (!restaurant) {
      restaurant = await db.restaurant.create({
        data: {
          name: "KFM Delice",
          slug: "kfm-delice",
          tagline: "L'Art du Goût Guinéen",
          description:
            "Restaurant gastronomique au cœur de Conakry, KFM Delice vous propose une cuisine guinéenne revisitée avec une touche contemporaine.",
          phone: "+224 622 34 56 78",
          whatsapp: "+224 622 34 56 78",
          email: "reservation@kfm-delice.com",
          address: "Almamya, Corniche Nord, Conakry, Guinée",
          hours: "Lun-Dim : 11h00 - 23h00",
          rating: 4.9,
          tables: 25,
        },
      });

      // Create menu items
      const menuItems = [
        // Entrées
        { name: "Salade KFM", description: "Salade fraîche aux légumes de saison, avocat, mangue verte et vinaigrette au citron", price: 15000, category: "entrees", image: "/images/kfm-dish-3.png", badge: "Végétarien", popular: true, order: 1, restaurantId: restaurant.id },
        { name: "Brochettes de Crevettes", description: "Crevettes marinées aux épices guinéennes, grillées au charbon", price: 25000, category: "entrees", image: "/images/kfm-dish-2.png", badge: "Mer", popular: false, order: 2, restaurantId: restaurant.id },
        { name: "Soupe de Poisson KFM", description: "Soupe traditionnelle de poisson frais aux légumes et épices locales", price: 18000, category: "entrees", image: "/images/kfm-dish-4.png", badge: "Maison", popular: true, order: 3, restaurantId: restaurant.id },
        // Plats
        { name: "Riz Jollof KFM Spécial", description: "Notre riz jollof signature avec poulet braisé aux herbes, légumes grillés et sauce pimentée KFM", price: 35000, category: "plats", image: "/images/dish-1.png", badge: "Signature", popular: true, order: 4, restaurantId: restaurant.id },
        { name: "Agneau Braisé aux Épices", description: "Agneau fondant braisé aux épices guinéennes, alloco croustillant et sauce yassa", price: 40000, category: "plats", image: "/images/kfm-dish-1.png", badge: "Premium", popular: true, order: 5, restaurantId: restaurant.id },
        { name: "Poisson Grillé Entier", description: "Poisson frais du jour grillé au charbon, sauce diable, alloco et légumes sautés", price: 30000, category: "plats", image: "/images/dish-3.png", badge: "Frais", popular: false, order: 6, restaurantId: restaurant.id },
        { name: "Plasas Traditionnel", description: "Plasas aux feuilles de manioc, poisson fumé, viande et huile de palme, servi avec riz blanc", price: 25000, category: "plats", image: "/images/dish-2.png", badge: "Traditionnel", popular: false, order: 7, restaurantId: restaurant.id },
        // Fruits de Mer
        { name: "Plateau Fruits de Mer KFM", description: "Crevettes, crabes, huîtres et poisson fumé, accompagnés de sauces maison", price: 55000, category: "mer", image: "/images/kfm-dish-2.png", badge: "2 pers.", popular: true, order: 8, restaurantId: restaurant.id },
        { name: "Crevettes Sauce Curry", description: "Crevettes sautées au curry doux, lait de coco et légumes croquants", price: 38000, category: "mer", image: "/images/kfm-dish-2.png", badge: "Chef", popular: false, order: 9, restaurantId: restaurant.id },
        // Desserts
        { name: "Assiette de Fruits Tropicaux", description: "Mangue, ananas, papaye et banane fraîche, glace coco maison", price: 12000, category: "desserts", image: "/images/kfm-dish-3.png", badge: "Frais", popular: true, order: 10, restaurantId: restaurant.id },
        { name: "Gâteau Chocolat-Coco", description: "Fondant au chocolat et noix de coco, crème anglaise et coulis de mangue", price: 15000, category: "desserts", image: "/images/kfm-dish-3.png", badge: "Maison", popular: false, order: 11, restaurantId: restaurant.id },
      ];
      await db.menuItem.createMany({ data: menuItems });

      // Create sample reservations
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const reservations = [
        { customerName: "Aminata Camara", phone: "+224 620 11 22 33", date: today, time: "12:00", guests: 4, zone: "terrasse", notes: "Anniversaire de ma fille", status: "confirmed", loyaltyPoint: 50, restaurantId: restaurant.id },
        { customerName: "Mamadou Bah", phone: "+224 628 44 55 66", date: today, time: "13:00", guests: 2, zone: "interieur", notes: "", status: "confirmed", loyaltyPoint: 50, restaurantId: restaurant.id },
        { customerName: "Fatoumata Diallo", phone: "+224 622 77 88 99", date: today, time: "19:30", guests: 6, zone: "vip", notes: "Dîner d'affaires, table calme", status: "pending", loyaltyPoint: 50, restaurantId: restaurant.id },
        { customerName: "Ibrahim Touré", phone: "+224 621 22 33 44", date: today, time: "20:00", guests: 3, zone: "terrasse", notes: "Allergie arachide", status: "confirmed", loyaltyPoint: 50, restaurantId: restaurant.id },
        { customerName: "Kadiatou Sylla", phone: "+224 625 55 66 77", date: tomorrow, time: "12:30", guests: 8, zone: "vip", notes: "Repas de famille, décoration demandée", status: "pending", loyaltyPoint: 50, restaurantId: restaurant.id },
        { customerName: "Alpha Condé", phone: "+224 623 88 99 00", date: tomorrow, time: "19:00", guests: 2, zone: "interieur", notes: "", status: "confirmed", loyaltyPoint: 50, restaurantId: restaurant.id },
        { customerName: "Mariama Bangoura", phone: "+224 627 11 22 33", date: today, time: "20:30", guests: 5, zone: "terrasse", notes: "Client régulier, table habituelle", status: "confirmed", loyaltyPoint: 75, restaurantId: restaurant.id },
      ];
      await db.reservation.createMany({ data: reservations });

      // Create sample orders
      const orders = [
        { customerName: "Aminata Camara", phone: "+224 620 11 22 33", items: JSON.stringify([{ name: "Riz Jollof KFM Spécial", price: 35000, qty: 2 }, { name: "Salade KFM", price: 15000, qty: 1 }]), total: 85000, status: "preparing", paymentMethod: "orange_money", restaurantId: restaurant.id },
        { customerName: "Walk-in Client", phone: "", items: JSON.stringify([{ name: "Agneau Braisé aux Épices", price: 40000, qty: 1 }, { name: "Plateau Fruits de Mer KFM", price: 55000, qty: 1 }]), total: 95000, status: "ready", paymentMethod: "cash", restaurantId: restaurant.id },
        { customerName: "Ibrahim Touré", phone: "+224 621 22 33 44", items: JSON.stringify([{ name: "Poisson Grillé Entier", price: 30000, qty: 1 }, { name: "Assiette de Fruits Tropicaux", price: 12000, qty: 2 }]), total: 54000, status: "delivered", paymentMethod: "mtn_money", restaurantId: restaurant.id },
        { customerName: "Mamadou Bah", phone: "+224 628 44 55 66", items: JSON.stringify([{ name: "Plasas Traditionnel", price: 25000, qty: 2 }, { name: "Brochettes de Crevettes", price: 25000, qty: 1 }]), total: 75000, status: "pending", paymentMethod: "cash", restaurantId: restaurant.id },
      ];
      await db.order.createMany({ data: orders });

      // Create sample reviews
      const reviews = [
        { customerName: "Aminata Camara", rating: 5, comment: "Le meilleur restaurant de Conakry ! Le riz jollof KFM est incomparable, le service est toujours impeccable.", date: "Mai 2026", restaurantId: restaurant.id },
        { customerName: "Mamadou Bah", rating: 5, comment: "L'espace VIP est parfait pour les dîners d'affaires. Service attentionné et plats de qualité.", date: "Avril 2026", restaurantId: restaurant.id },
        { customerName: "Fatoumata Diallo", rating: 5, comment: "L'équipe a préparé une surprise d'anniversaire pour mon mari. Un moment inoubliable !", date: "Mars 2026", restaurantId: restaurant.id },
        { customerName: "Ibrahim Touré", rating: 4, comment: "Fruits de mer très frais, le plasas est excellent. Le menu digital par QR code c'est très moderne !", date: "Février 2026", restaurantId: restaurant.id },
        { customerName: "Kadiatou Sylla", rating: 5, comment: "Toujours un plaisir de venir au KFM. L'ambiance terrasse au coucher du soleil est magique.", date: "Janvier 2026", restaurantId: restaurant.id },
      ];
      await db.review.createMany({ data: reviews });
    }

    return NextResponse.json({ success: true, message: "Base de données KFM Delice initialisée" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur d'initialisation" }, { status: 500 });
  }
}
