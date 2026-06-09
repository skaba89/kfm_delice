"use client";

import { UtensilsCrossed, Clock, Smartphone, Heart, ShieldCheck, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedSection } from "@/components/AnimatedSection";
import { RESTO } from "@/lib/constants";

export function AboutSection() {
  const features = [
    { icon: UtensilsCrossed, title: "Cuisine Authentique", desc: "Des plats traditionnels guinéens préparés avec passion et savoir-faire" },
    { icon: Clock, title: "Service Rapide", desc: "Un service efficace et attentionné pour votre plus grand confort" },
    { icon: Smartphone, title: "Commande en Ligne", desc: "Commandez facilement via WhatsApp et recevez chez vous" },
    { icon: Heart, title: "Fait avec Amour", desc: "Chaque plat est préparé avec des ingrédients frais et sélectionnés" },
    { icon: ShieldCheck, title: "Hygiène Certifiée", desc: "Respect strict des normes d'hygiène et de sécurité alimentaire" },
    { icon: MapPin, title: "Emplacement Idéal", desc: "Au cœur de Conakry, sur la Corniche Nord avec vue magnifique" },
  ];
  return (
    <section id="apropos" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <Badge className="bg-orange-100 text-orange-700 mb-4">À Propos</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Pourquoi Choisir <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">KFM Delice</span></h2>
          <p className="text-gray-500 max-w-2xl mx-auto">{RESTO.description}</p>
        </AnimatedSection>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <AnimatedSection key={i} delay={i * 0.1}>
              <Card className="h-full hover:shadow-lg transition-shadow border-none shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center mx-auto mb-4">
                    <f.icon className="w-7 h-7 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500">{f.desc}</p>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
