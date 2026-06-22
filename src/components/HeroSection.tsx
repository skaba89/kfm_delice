"use client";

import { motion } from "framer-motion";
import { UtensilsCrossed, CalendarCheck, Star, ArrowRight, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RESTO } from "@/lib/constants";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0"><img src={RESTO.heroImage} alt={RESTO.name} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/45" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" /></div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 px-4 py-1.5 text-sm mb-6"><UtensilsCrossed className="w-3.5 h-3.5 mr-1.5" />{RESTO.tagline}</Badge>
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] mb-6">KFM <span className="bg-gradient-to-r from-orange-400 via-red-400 to-amber-400 bg-clip-text text-transparent">Delice</span></motion.h1>
            <motion.p initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="text-lg text-gray-300 mb-4 max-w-lg leading-relaxed">{RESTO.description}</motion.p>
            <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }} className="flex items-center gap-4 mb-8">
              <div className="flex items-center gap-1">{[1,2,3,4,5].map(i => <Star key={i} className={`w-5 h-5 ${i <= Math.floor(RESTO.rating) ? "fill-amber-400 text-amber-400" : "fill-amber-200 text-amber-200"}`} />)}</div>
              <span className="text-white font-bold">{RESTO.rating}/5</span>
              <span className="text-gray-400">({RESTO.reviewCount} avis)</span>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="flex flex-col sm:flex-row gap-4">
              <a href="/client/register"><Button size="lg" className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-full px-8 py-6 text-lg shadow-xl shadow-emerald-500/30"><ShoppingCart className="mr-2 w-5 h-5" />Commander en ligne</Button></a>
              <a href="#reservation"><Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full px-8 py-6 text-lg shadow-xl shadow-orange-500/30"><CalendarCheck className="mr-2 w-5 h-5" />Réserver une Table</Button></a>
              <a href="#menu"><Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-full px-8 py-6 text-lg">Voir le Menu<ArrowRight className="ml-2 w-5 h-5" /></Button></a>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
