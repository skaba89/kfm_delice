"use client";

import { MapPin, Phone, Clock, Mail, Facebook, Instagram, Twitter } from "lucide-react";
import type { RestaurantDB } from "@/lib/types";

interface Props {
  restaurant: RestaurantDB;
}

export function AboutSectionDynamic({ restaurant }: Props) {
  const primaryColor = restaurant.primaryColor || "#ea580c";

  return (
    <section className="py-16 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">À propos</h2>
          {restaurant.description && <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">{restaurant.description}</p>}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {restaurant.address && (
            <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl">
              <MapPin className="w-8 h-8 mx-auto mb-3" style={{ color: primaryColor }} />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Adresse</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{restaurant.address}</p>
            </div>
          )}
          {restaurant.hours && (
            <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl">
              <Clock className="w-8 h-8 mx-auto mb-3" style={{ color: primaryColor }} />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Horaires</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{restaurant.hours}</p>
            </div>
          )}
          {restaurant.phone && (
            <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl">
              <Phone className="w-8 h-8 mx-auto mb-3" style={{ color: primaryColor }} />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Téléphone</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{restaurant.phone}</p>
            </div>
          )}
          {restaurant.email && (
            <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl">
              <Mail className="w-8 h-8 mx-auto mb-3" style={{ color: primaryColor }} />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Email</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{restaurant.email}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
