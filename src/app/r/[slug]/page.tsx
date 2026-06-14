"use client";

import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRestaurant } from "@/lib/restaurant-context";
import { PublicNavbarDynamic } from "@/components/PublicNavbarDynamic";
import { HeroSectionDynamic } from "@/components/HeroSectionDynamic";
import { MenuSectionDynamic } from "@/components/MenuSectionDynamic";
import { ReservationSectionDynamic } from "@/components/ReservationSectionDynamic";
import { AvisSectionDynamic } from "@/components/AvisSectionDynamic";
import { AboutSectionDynamic } from "@/components/AboutSectionDynamic";
import { PublicFooterDynamic } from "@/components/PublicFooterDynamic";
import { RestaurantLoading } from "@/components/RestaurantLoading";

export default function RestaurantHomePage() {
  const { customer, driver } = useAuth();
  const { restaurant, slug, loading, error } = useRestaurant();
  const router = useRouter();

  if (loading) return <RestaurantLoading />;

  if (error || !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error || "Restaurant introuvable"}</p>
          <button onClick={() => router.push("/")} className="text-orange-500 hover:text-orange-600 font-medium">
            Retour à l&apos;accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbarDynamic
        restaurant={restaurant}
        slug={slug}
        onAdminClick={() => router.push("/admin/login")}
        onCustomerClick={() => { if (customer) router.push("/client"); else router.push("/client/login"); }}
        onDriverClick={() => { if (driver) router.push("/driver"); else router.push("/driver/login"); }}
        customer={customer}
      />
      <HeroSectionDynamic restaurant={restaurant} slug={slug} />
      <MenuSectionDynamic restaurant={restaurant} slug={slug} />
      <ReservationSectionDynamic restaurant={restaurant} slug={slug} />
      <AvisSectionDynamic restaurant={restaurant} />
      <AboutSectionDynamic restaurant={restaurant} />
      <PublicFooterDynamic restaurant={restaurant} />
      {restaurant.whatsapp && (
        <a
          href={`https://wa.me/${restaurant.whatsapp.replace(/\s/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg shadow-green-500/30 transition-colors"
          title="Commander via WhatsApp"
        >
          <MessageCircle className="w-6 h-6" />
        </a>
      )}
    </div>
  );
}
