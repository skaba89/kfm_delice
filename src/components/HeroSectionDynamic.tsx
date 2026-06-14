"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { MapPin, Star, Clock, Phone, ChevronRight, ShoppingBag, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RestaurantDB } from "@/lib/types";

interface Props {
  restaurant: RestaurantDB;
  slug: string | null;
}

export function HeroSectionDynamic({ restaurant, slug }: Props) {
  const rPath = slug ? `/r/${slug}` : "";
  const primaryColor = restaurant.primaryColor || "#ea580c";
  const secondaryColor = restaurant.secondaryColor || "#dc2626";

  return (
    <section className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor}, ${primaryColor})` }}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl" style={{ backgroundColor: `${primaryColor}33` }} />
      <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full blur-3xl" style={{ backgroundColor: `${secondaryColor}33` }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <Badge className="bg-white/20 text-white border-0 mb-4 backdrop-blur-sm text-sm px-4 py-1.5">
            <Star className="w-4 h-4 mr-1 fill-amber-400 text-amber-400" /> {restaurant.rating}/5
          </Badge>

          {restaurant.logo ? (
            <img src={restaurant.logo} alt={restaurant.name} className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-xl object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-xl flex items-center justify-center text-white text-3xl font-bold bg-white/20 backdrop-blur-sm">
              {restaurant.name.charAt(0)}
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-3 tracking-tight">
            {restaurant.name}
          </h1>
          {restaurant.tagline && (
            <p className="text-white/80 text-lg sm:text-xl mb-6 max-w-2xl mx-auto">
              {restaurant.tagline}
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-4 text-white/70 text-sm mb-8">
            {restaurant.address && (
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {restaurant.address}</span>
            )}
            {restaurant.hours && (
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {restaurant.hours}</span>
            )}
            {restaurant.phone && (
              <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {restaurant.phone}</span>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="bg-white text-gray-900 hover:bg-gray-100 rounded-xl px-8 shadow-xl">
              <a href={`${rPath}/menu`}>
                <ShoppingBag className="w-5 h-5 mr-2" /> Commander
                <ChevronRight className="w-4 h-4 ml-1" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 rounded-xl px-8 backdrop-blur-sm">
              <a href={`${rPath}/reservation`}>
                <CalendarCheck className="w-5 h-5 mr-2" /> Réserver
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
