"use client";

import { UtensilsCrossed, Phone, MapPin, Clock, Star, User, Truck } from "lucide-react";
import type { RestaurantDB } from "@/lib/types";

interface Props {
  restaurant: RestaurantDB;
  slug: string | null;
  onAdminClick: () => void;
  onCustomerClick: () => void;
  onDriverClick: () => void;
  customer?: { name: string } | null;
}

export function PublicNavbarDynamic({ restaurant, slug, onAdminClick, onCustomerClick, onDriverClick, customer }: Props) {
  const rPath = slug ? `/r/${slug}` : "";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <a href={rPath || "/"} className="flex items-center gap-2">
          {restaurant.logo ? (
            <img src={restaurant.logo} alt={restaurant.name} loading="lazy" className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: restaurant.primaryColor || "#ea580c" }}>
              {restaurant.name.charAt(0)}
            </div>
          )}
          <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate max-w-[150px]">{restaurant.name}</span>
        </a>
        <div className="flex items-center gap-1 sm:gap-2">
          <a href={`${rPath}/menu`} className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
            <UtensilsCrossed className="w-4 h-4" /> Menu
          </a>
          <a href={`${rPath}/reservation`} className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Clock className="w-4 h-4" /> Réserver
          </a>
          <button onClick={onCustomerClick} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
            <User className="w-4 h-4" /> <span className="hidden sm:inline">{customer ? "Mon compte" : "Connexion"}</span>
          </button>
          <button onClick={onDriverClick} className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Truck className="w-4 h-4" /> Livreur
          </button>
        </div>
      </div>
    </nav>
  );
}
