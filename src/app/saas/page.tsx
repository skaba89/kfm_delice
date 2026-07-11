"use client";

import { motion } from "framer-motion";
import { UtensilsCrossed, QrCode, ShoppingCart, Truck, Shield, Globe, Smartphone, TrendingUp, Star, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: QrCode,
    title: "Menu QR Code",
    description: "Générez des QR codes pour chaque table. Les clients scannent, voient le menu, commandent et paient depuis leur téléphone.",
    color: "from-orange-500 to-red-600",
  },
  {
    icon: ShoppingCart,
    title: "Commandes en ligne",
    description: "Sur place, à emporter ou en livraison. Paiement Orange Money, MTN, Wave, carte bancaire ou espèces.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    icon: Truck,
    title: "Gestion livreurs",
    description: "Suivez vos livreurs en temps réel. Attribuez les commandes, calculez les commissions automatiquement.",
    color: "from-green-500 to-emerald-600",
  },
  {
    icon: TrendingUp,
    title: "Dashboard & Analytics",
    description: "Chiffre d'affaires, plats populaires, heures d'affluence. Toutes vos données en temps réel.",
    color: "from-purple-500 to-violet-600",
  },
  {
    icon: Shield,
    title: "SaaS Multi-tenant",
    description: "Gérez plusieurs restaurants par compte. Quotas de création, restaurants secondaires, audit logs.",
    color: "from-red-500 to-rose-600",
  },
  {
    icon: Smartphone,
    title: "PWA Mobile",
    description: "Installez l'app sur votre téléphone. Fonctionne hors-ligne pour les livreurs. Multi-langue FR/EN.",
    color: "from-cyan-500 to-blue-600",
  },
];

const stats = [
  { value: "43/43", label: "Tests E2E passent" },
  { value: "5", label: "Modes de paiement" },
  { value: "FR/EN", label: "Langues supportées" },
  { value: "100%", label: "Open source" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-black">
        <div className="absolute top-20 right-20 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-red-500/20 rounded-full blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <Badge className="mb-6 bg-orange-500/10 text-orange-400 border-orange-500/30">
              <Star className="w-3 h-3 mr-1 fill-orange-400" /> Plateforme SaaS Restaurant
            </Badge>
            <h1 className="text-4xl sm:text-6xl font-bold text-white mb-6">
              La solution complète pour
              <span className="block bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                restaurants modernes
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              Menu QR code, commandes en ligne, paiements mobile money, gestion livreurs,
              dashboard analytics. Tout-en-un, pensé pour la Guinée.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/admin/login">
                <Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl px-8 py-6 text-lg">
                  Essayer la démo <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </a>
              <a href="/pricing">
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/5 rounded-xl px-8 py-6 text-lg">
                  Voir les tarifs
                </Button>
              </a>
            </div>
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6">
              {stats.map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">{stat.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Tout ce dont votre restaurant a besoin
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Une plateforme pensée pour le marché guinéen, avec les paiements locaux et le support multilingue.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="h-full bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10 hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-orange-500 to-red-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Prêt à digitaliser votre restaurant ?
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Démarrez gratuitement. Sans engagement. Configuration en 5 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/admin/login">
              <Button size="lg" className="bg-white text-orange-600 hover:bg-gray-100 rounded-xl px-8 py-6 text-lg font-semibold">
                Commencer maintenant
              </Button>
            </a>
            <a href="/contact">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-xl px-8 py-6 text-lg">
                Nous contacter
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <UtensilsCrossed className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white">KFM Delice</span>
              </div>
              <p className="text-sm">La plateforme SaaS pour restaurants en Guinée.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Produit</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/pricing" className="hover:text-orange-400">Tarifs</a></li>
                <li><a href="/" className="hover:text-orange-400">Menu démo</a></li>
                <li><a href="/admin/login" className="hover:text-orange-400">Espace admin</a></li>
                <li><a href="/docs/onboarding" className="hover:text-orange-400">Guide onboarding</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Légal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/legal/privacy" className="hover:text-orange-400">Confidentialité</a></li>
                <li><a href="/legal/cgv" className="hover:text-orange-400">CGV</a></li>
                <li><a href="/legal/mentions" className="hover:text-orange-400">Mentions légales</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/contact" className="hover:text-orange-400">Page contact</a></li>
                <li>+224 622 34 56 78</li>
                <li>contact@kfm-delice.com</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-8 text-center text-sm">
            <p>© {new Date().getFullYear()} KFM Delice. Tous droits réservés. Conakry, Guinée.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
