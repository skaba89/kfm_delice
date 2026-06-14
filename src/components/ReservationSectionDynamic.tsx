"use client";

import { motion } from "framer-motion";
import { CalendarCheck, Clock, Phone, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RestaurantDB } from "@/lib/types";

interface Props {
  restaurant: RestaurantDB;
  slug: string | null;
}

export function ReservationSectionDynamic({ restaurant, slug }: Props) {
  const rPath = slug ? `/r/${slug}` : "";
  const primaryColor = restaurant.primaryColor || "#ea580c";

  return (
    <section className="py-16 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Réservez votre table</h2>
          <p className="text-gray-500 dark:text-gray-400">Une expérience gastronomique vous attend</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 text-center">
            <CalendarCheck className="w-12 h-12 mx-auto mb-4" style={{ color: primaryColor }} />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Réservation en ligne
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Réservez votre table en quelques clics. Intérieur, terrasse ou VIP.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600 dark:text-gray-300 mb-6">
              {restaurant.hours && <span className="flex items-center gap-1"><Clock className="w-4 h-4" style={{ color: primaryColor }} /> {restaurant.hours}</span>}
              {restaurant.phone && <span className="flex items-center gap-1"><Phone className="w-4 h-4" style={{ color: primaryColor }} /> {restaurant.phone}</span>}
            </div>
            <Button asChild size="lg" className="rounded-xl px-8 text-white" style={{ backgroundColor: primaryColor }}>
              <a href={`${rPath}/reservation`}>
                <CalendarCheck className="w-5 h-5 mr-2" /> Réserver maintenant
                <ChevronRight className="w-4 h-4 ml-1" />
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
