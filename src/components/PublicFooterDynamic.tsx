"use client";

import type { RestaurantDB } from "@/lib/types";

interface Props {
  restaurant: RestaurantDB;
}

export function PublicFooterDynamic({ restaurant }: Props) {
  const primaryColor = restaurant.primaryColor || "#ea580c";
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white font-bold text-lg mb-3">{restaurant.name}</h3>
            {restaurant.tagline && <p className="text-sm mb-2">{restaurant.tagline}</p>}
            {restaurant.description && <p className="text-xs line-clamp-3">{restaurant.description}</p>}
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Contact</h4>
            {restaurant.address && <p className="text-sm mb-1">{restaurant.address}</p>}
            {restaurant.phone && <p className="text-sm mb-1">{restaurant.phone}</p>}
            {restaurant.email && <p className="text-sm mb-1">{restaurant.email}</p>}
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Suivez-nous</h4>
            <div className="flex gap-3">
              {restaurant.facebook && <a href={restaurant.facebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors" style={{ color: primaryColor }}>FB</a>}
              {restaurant.instagram && <a href={restaurant.instagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors" style={{ color: primaryColor }}>IG</a>}
              {restaurant.twitter && <a href={restaurant.twitter} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors" style={{ color: primaryColor }}>TW</a>}
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-xs">
          <p>&copy; {year} {restaurant.name}. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
