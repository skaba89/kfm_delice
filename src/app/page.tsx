"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  UtensilsCrossed,
  CalendarCheck,
  Clock,
  Users,
  Star,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  Menu,
  X,
  Globe,
  Smartphone,
  BarChart3,
  ShieldCheck,
  Heart,
  Zap,
  TrendingUp,
  CreditCard,
  HeadphonesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/* ──────────────────── Animated Section Wrapper ──────────────────── */
function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ──────────────────── Counter Animation ──────────────────── */
function AnimatedCounter({
  end,
  suffix = "",
  prefix = "",
}: {
  end: number;
  suffix?: string;
  prefix?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 2000;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, end]);

  return (
    <span ref={ref} className="font-bold">
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ──────────────────── Navbar ──────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "#features", label: "Fonctionnalités" },
    { href: "#menu", label: "Menu Digital" },
    { href: "#reservation", label: "Réservation" },
    { href: "#pricing", label: "Tarifs" },
    { href: "#testimonials", label: "Témoignages" },
    { href: "#contact", label: "Contact" },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-lg border-b border-orange-100"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <a href="#" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <span
              className={`text-xl font-bold transition-colors ${
                scrolled ? "text-gray-900" : "text-white"
              }`}
            >
              RestoPro
              <span className="text-orange-500">GN</span>
            </span>
          </a>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-orange-500 ${
                  scrolled ? "text-gray-700" : "text-white/90"
                }`}
              >
                {link.label}
              </a>
            ))}
            <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-full px-6 shadow-lg shadow-orange-500/25">
              Essai Gratuit
            </Button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? (
              <X className={scrolled ? "text-gray-900" : "text-white"} />
            ) : (
              <Menu className={scrolled ? "text-gray-900" : "text-white"} />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:hidden bg-white rounded-2xl shadow-xl p-4 mb-4"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block py-3 px-4 text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Button className="w-full mt-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full">
              Essai Gratuit
            </Button>
          </motion.div>
        )}
      </div>
    </motion.nav>
  );
}

/* ──────────────────── Hero Section ──────────────────── */
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="/images/restaurant-hero.png"
          alt="Restaurant en Guinée"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 px-4 py-1.5 text-sm mb-6">
                🇬🇳 Solution #1 pour Restaurants en Guinée
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6"
            >
              Gérez Votre{" "}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                Restaurant
              </span>{" "}
              avec Simplicité
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-gray-300 mb-8 max-w-lg"
            >
              La plateforme tout-en-un pour les restaurants guinéens : réservations
              en ligne, menu digital, gestion des commandes, fidélité clients et
              paiements mobiles Orange Money & MTN Money.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-full px-8 py-6 text-lg shadow-xl shadow-orange-500/30 animate-pulse-glow"
              >
                Démarrer Gratuitement
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 rounded-full px-8 py-6 text-lg"
              >
                Voir la Démo
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex items-center gap-6 mt-8"
            >
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white text-xs font-bold"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <div className="text-white">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-400">
                  +150 restaurants en Guinée
                </p>
              </div>
            </motion.div>
          </div>

          {/* Floating Reservation Card */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="hidden lg:block"
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CalendarCheck className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">
                      Réservation Confirmée
                    </h3>
                    <p className="text-gray-400 text-sm">Table pour 4 personnes</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-300 text-sm">
                    <Clock className="w-4 h-4 text-orange-400" />
                    Vendredi 7 Juin, 19:30
                  </div>
                  <div className="flex items-center gap-2 text-gray-300 text-sm">
                    <MapPin className="w-4 h-4 text-orange-400" />
                    La Terrasse, Conakry
                  </div>
                  <div className="flex items-center gap-2 text-gray-300 text-sm">
                    <Users className="w-4 h-4 text-orange-400" />
                    Zone VIP - Terrasse
                  </div>
                </div>
                <Separator className="my-4 bg-white/10" />
                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-semibold">
                    🎉 Fidélité : +50 pts
                  </span>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    Confirmé
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="w-6 h-10 rounded-full border-2 border-white/30 flex justify-center pt-2">
          <div className="w-1.5 h-3 rounded-full bg-white/60" />
        </div>
      </motion.div>
    </section>
  );
}

/* ──────────────────── Stats Section ──────────────────── */
function StatsSection() {
  const stats = [
    {
      icon: UtensilsCrossed,
      value: 150,
      suffix: "+",
      label: "Restaurants Partenaires",
      color: "from-orange-500 to-amber-500",
    },
    {
      icon: Users,
      value: 25000,
      suffix: "+",
      label: "Clients Satisfaits",
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: CalendarCheck,
      value: 120000,
      suffix: "+",
      label: "Réservations Traitées",
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: Star,
      value: 4,
      suffix: ".8/5",
      label: "Note Moyenne",
      color: "from-amber-500 to-yellow-500",
    },
  ];

  return (
    <section className="py-16 bg-gradient-to-r from-orange-500 to-amber-500 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <AnimatedSection key={i} delay={i * 0.1}>
              <div className="text-center text-white">
                <div
                  className={`w-14 h-14 mx-auto rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mb-3`}
                >
                  <stat.icon className="w-7 h-7 text-white" />
                </div>
                <div className="text-3xl lg:text-4xl font-bold mb-1">
                  <AnimatedCounter
                    end={stat.value}
                    suffix={stat.suffix}
                  />
                </div>
                <p className="text-white/80 text-sm">{stat.label}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Features Section ──────────────────── */
function FeaturesSection() {
  const features = [
    {
      icon: Smartphone,
      title: "Menu Digital QR Code",
      description:
        "Vos clients scannent un QR code pour voir votre menu interactif avec photos, prix en GNF et descriptions. Mise à jour instantanée, zéro impression nécessaire.",
      color: "bg-orange-100 text-orange-600",
    },
    {
      icon: CalendarCheck,
      title: "Réservations en Ligne",
      description:
        "Système de réservation 24h/24 avec confirmation automatique par SMS et WhatsApp. Gestion des tables, des créneaux et des disponibilités en temps réel.",
      color: "bg-green-100 text-green-600",
    },
    {
      icon: CreditCard,
      title: "Paiement Mobile",
      description:
        "Acceptez Orange Money, MTN Money et les paiements par carte. Encaissement rapide, reçus numériques et suivi des transactions en temps réel.",
      color: "bg-blue-100 text-blue-600",
    },
    {
      icon: BarChart3,
      title: "Tableau de Bord",
      description:
        "Suivez vos revenus, vos réservations, vos plats les plus populaires et vos heures de pointe. Rapports quotidiens, hebdomadaires et mensuels détaillés.",
      color: "bg-purple-100 text-purple-600",
    },
    {
      icon: Heart,
      title: "Programme de Fidélité",
      description:
        "Récompensez vos clients fidèles avec des points, des réductions et des offres spéciales. Système de parrainage intégré pour développer votre clientèle.",
      color: "bg-pink-100 text-pink-600",
    },
    {
      icon: MessageCircle,
      title: "Chatbot WhatsApp",
      description:
        "Un assistant intelligent répond aux questions de vos clients sur WhatsApp : menu, horaires, réservations, livraison. Disponible 24h/24 en français et soussou.",
      color: "bg-emerald-100 text-emerald-600",
    },
    {
      icon: Globe,
      title: "Multi-Langues",
      description:
        "Interface disponible en français, soussou, malinké et poular. Touchez tous les clients guinéens quelle que soit leur langue préférée.",
      color: "bg-cyan-100 text-cyan-600",
    },
    {
      icon: ShieldCheck,
      title: "Sécurité & Conformité",
      description:
        "Données protégées et conformes aux standards internationaux. Sauvegarde automatique, gestion des accès et traçabilité complète des opérations.",
      color: "bg-amber-100 text-amber-700",
    },
  ];

  return (
    <section id="features" className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <Badge className="bg-orange-100 text-orange-600 border-orange-200 mb-4">
            Fonctionnalités
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Tout ce dont votre restaurant a{" "}
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              besoin
            </span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Une suite complète d&apos;outils conçus spécifiquement pour les
            restaurants en Guinée, adaptés aux réalités locales et aux besoins
            des restaurateurs guinéens.
          </p>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <AnimatedSection key={i} delay={i * 0.05}>
              <Card className="h-full hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-transparent hover:border-orange-200 group">
                <CardContent className="p-6">
                  <div
                    className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                  >
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Menu Digital Section ──────────────────── */
function MenuDigitalSection() {
  const dishes = [
    {
      name: "Riz Jollof au Poulet Braisé",
      price: "35 000",
      description:
        "Riz jollof épicé accompagné de poulet braisé aux herbes, légumes grillés et sauce pimentée maison.",
      image: "/images/dish-1.png",
      badge: "Populaire",
      badgeColor: "bg-orange-500",
    },
    {
      name: "Plasas & Riz",
      price: "25 000",
      description:
        "Plasas traditionnel aux feuilles de manioc, poisson fumé et huile de palme, servi avec du riz blanc.",
      image: "/images/dish-2.png",
      badge: "Traditionnel",
      badgeColor: "bg-green-600",
    },
    {
      name: "Poisson Grillé & Alloco",
      price: "30 000",
      description:
        "Poisson frais grillé aux épices guinéennes, accompagné d&apos;alloco croustillant et de sauce pimentée.",
      image: "/images/dish-3.png",
      badge: "Chef ★",
      badgeColor: "bg-amber-600",
    },
  ];

  return (
    <section id="menu" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <Badge className="bg-green-100 text-green-600 border-green-200 mb-4">
            Menu Digital
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Votre Menu,{" "}
            <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
              Toujours à Jour
            </span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Un menu digital interactif accessible par QR code. Vos clients
            découvrent vos plats avec des photos appétissantes et commandent en
            un clic.
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8">
          {dishes.map((dish, i) => (
            <AnimatedSection key={i} delay={i * 0.15}>
              <Card className="overflow-hidden hover:shadow-2xl transition-all duration-300 group">
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={dish.image}
                    alt={dish.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3">
                    <Badge className={`${dish.badgeColor} text-white`}>
                      {dish.badge}
                    </Badge>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-3 left-3">
                    <span className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-bold text-orange-600">
                      {dish.price} GNF
                    </span>
                  </div>
                </div>
                <CardContent className="p-5">
                  <h3 className="font-bold text-gray-900 text-lg mb-2">
                    {dish.name}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {dish.description}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className="w-4 h-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                    <span className="text-xs text-gray-500">(48 avis)</span>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection className="text-center mt-12">
          <div className="inline-flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-6 py-4">
            <div className="w-16 h-16 bg-white rounded-xl shadow-md flex items-center justify-center">
              <div className="grid grid-cols-3 gap-0.5">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-sm ${
                      i % 2 === 0 ? "bg-gray-900" : "bg-gray-400"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900">
                Scan du QR Code = Menu Instantané
              </p>
              <p className="text-sm text-gray-600">
                Vos clients accèdent au menu en 2 secondes
              </p>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ──────────────────── Dashboard Preview ──────────────────── */
function DashboardPreview() {
  return (
    <section className="py-20 lg:py-28 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 relative overflow-hidden">
      <div className="absolute top-20 right-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <AnimatedSection className="text-center mb-16">
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 mb-4">
            Tableau de Bord
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Pilotage en{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              Temps Réel
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Un tableau de bord complet pour suivre toutes les métriques de votre
            restaurant : revenus, réservations, plats populaires et plus encore.
          </p>
        </AnimatedSection>

        <AnimatedSection>
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <img
              src="/images/dashboard-preview.png"
              alt="Tableau de bord restaurant"
              className="w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/50 to-transparent" />
          </div>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
          {[
            {
              icon: TrendingUp,
              label: "Revenus du jour",
              value: "2.5M GNF",
              change: "+18%",
            },
            {
              icon: CalendarCheck,
              label: "Réservations",
              value: "42 aujourd&apos;hui",
              change: "+12%",
            },
            {
              icon: Clock,
              label: "Temps d&apos;attente",
              value: "12 min",
              change: "-5 min",
            },
            {
              icon: Heart,
              label: "Satisfaction",
              value: "96%",
              change: "+3%",
            },
          ].map((item, i) => (
            <AnimatedSection key={i} delay={i * 0.1}>
              <Card className="bg-white/5 backdrop-blur border-white/10 hover:border-orange-500/30 transition-all">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <item.icon className="w-5 h-5 text-orange-400" />
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                      {item.change}
                    </Badge>
                  </div>
                  <p className="text-white font-bold text-xl">{item.value}</p>
                  <p className="text-gray-400 text-sm">{item.label}</p>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Reservation Section ──────────────────── */
function ReservationSection() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    date: "",
    time: "",
    guests: "2",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <section id="reservation" className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <AnimatedSection>
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 mb-4">
              Réservation
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Réservez en{" "}
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                30 Secondes
              </span>
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              Vos clients réservent facilement en ligne. Vous recevez une
              notification instantanée et gérez les tables depuis votre tableau
              de bord. Plus d&apos;appels manqués, plus de carnets perdus.
            </p>

            <div className="space-y-4">
              {[
                {
                  icon: Zap,
                  title: "Confirmation Instantanée",
                  desc: "SMS et notification WhatsApp automatiques",
                },
                {
                  icon: Clock,
                  title: "Rappels Intelligents",
                  desc: "Rappel 2h avant la réservation au client",
                },
                {
                  icon: Users,
                  title: "Gestion des Tables",
                  desc: "Plan de salle interactif en temps réel",
                },
                {
                  icon: MessageCircle,
                  title: "Notes Spéciales",
                  desc: "Allergies, anniversaires, préférences enregistrées",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-4 bg-white rounded-xl hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {item.title}
                    </h4>
                    <p className="text-gray-600 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.2}>
            <Card className="shadow-2xl border-0">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    Réserver une Table
                  </h3>
                  <p className="text-gray-500 text-sm">
                    Essayez notre système de réservation
                  </p>
                </div>

                {submitted ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h4 className="font-bold text-gray-900 text-lg mb-2">
                      Réservation Envoyée !
                    </h4>
                    <p className="text-gray-600">
                      Vous recevrez une confirmation par SMS et WhatsApp.
                    </p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Nom complet
                      </label>
                      <Input
                        placeholder="Amadou Diallo"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="rounded-xl"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Téléphone
                      </label>
                      <Input
                        placeholder="+224 620 00 00 00"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        className="rounded-xl"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Date
                        </label>
                        <Input
                          type="date"
                          value={formData.date}
                          onChange={(e) =>
                            setFormData({ ...formData, date: e.target.value })
                          }
                          className="rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Heure
                        </label>
                        <Input
                          type="time"
                          value={formData.time}
                          onChange={(e) =>
                            setFormData({ ...formData, time: e.target.value })
                          }
                          className="rounded-xl"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Nombre de personnes
                      </label>
                      <select
                        value={formData.guests}
                        onChange={(e) =>
                          setFormData({ ...formData, guests: e.target.value })
                        }
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, "9+"].map((n) => (
                          <option key={n} value={n}>
                            {n} personne{n !== 1 ? "s" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Notes spéciales
                      </label>
                      <Input
                        placeholder="Allergies, anniversaire, préférences..."
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        className="rounded-xl"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl py-6 text-lg shadow-lg shadow-orange-500/25"
                    >
                      Confirmer la Réservation
                      <CalendarCheck className="ml-2 w-5 h-5" />
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Pricing Section ──────────────────── */
function PricingSection() {
  const plans = [
    {
      name: "Starter",
      price: "150 000",
      period: "/mois",
      description: "Idéal pour les petits restaurants et maquis",
      features: [
        "Menu digital QR Code",
        "Réservations en ligne",
        "Notifications SMS",
        "Tableau de bord basique",
        "Support WhatsApp",
      ],
      excluded: [
        "Programme de fidélité",
        "Paiements mobiles intégrés",
        "Chatbot IA WhatsApp",
        "Multi-langues locales",
      ],
      popular: false,
      color: "border-gray-200",
    },
    {
      name: "Professionnel",
      price: "350 000",
      period: "/mois",
      description: "Pour les restaurants en croissance",
      features: [
        "Tout dans Starter +",
        "Programme de fidélité",
        "Paiements Orange Money & MTN",
        "Chatbot WhatsApp IA",
        "Multi-langues (FR, Soussou, Malinké)",
        "Rapports avancés",
        "Gestion du personnel",
        "Support prioritaire",
      ],
      excluded: ["API personnalisée", "Multi-établissements"],
      popular: true,
      color: "border-orange-500",
    },
    {
      name: "Enterprise",
      price: "Sur Devis",
      period: "",
      description: "Pour les chaînes et grands établissements",
      features: [
        "Tout dans Professionnel +",
        "API personnalisée",
        "Multi-établissements",
        "Intégrations sur mesure",
        "Formation équipe complète",
        "Manager de compte dédié",
        "SLA garanti 99.9%",
        "Déploiement sur site optionnel",
      ],
      excluded: [],
      popular: false,
      color: "border-gray-200",
    },
  ];

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <Badge className="bg-orange-100 text-orange-600 border-orange-200 mb-4">
            Tarifs
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Des Prix{" "}
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              Adaptés
            </span>{" "}
            à la Guinée
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Des tarifs pensés pour les restaurateurs guinéens. Commencez
            gratuitement et évoluez selon vos besoins.
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <AnimatedSection key={i} delay={i * 0.15}>
              <Card
                className={`relative h-full ${plan.color} ${
                  plan.popular
                    ? "border-2 shadow-xl shadow-orange-500/10 scale-105"
                    : "border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-1 shadow-lg">
                      Le Plus Populaire
                    </Badge>
                  </div>
                )}
                <CardContent className="p-6 lg:p-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4">
                    {plan.description}
                  </p>
                  <div className="mb-6">
                    <span className="text-3xl font-bold text-gray-900">
                      {plan.price}
                    </span>
                    <span className="text-gray-500 text-sm">
                      {" "}
                      GNF{plan.period}
                    </span>
                  </div>
                  <Button
                    className={`w-full rounded-xl py-5 ${
                      plan.popular
                        ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25"
                        : "bg-gray-900 hover:bg-gray-800 text-white"
                    }`}
                  >
                    {plan.price === "Sur Devis"
                      ? "Nous Contacter"
                      : "Commencer"}
                    <ChevronRight className="ml-1 w-4 h-4" />
                  </Button>
                  <Separator className="my-6" />
                  <div className="space-y-3">
                    {plan.features.map((feature, j) => (
                      <div key={j} className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>
                    ))}
                    {plan.excluded.map((feature, j) => (
                      <div
                        key={`ex-${j}`}
                        className="flex items-start gap-2 opacity-40"
                      >
                        <X className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-500">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Testimonials ──────────────────── */
function TestimonialsSection() {
  const testimonials = [
    {
      name: "Mamadou Bah",
      role: "Propriétaire, Le Jardin Gourmand - Conakry",
      text: "Depuis que nous utilisons RestoPro GN, nos réservations ont augmenté de 40%. Le menu digital a réduit nos coûts d'impression et nos clients adorent le système de fidélité. C'est exactement ce qu'il nous fallait pour moderniser notre restaurant.",
      rating: 5,
      initials: "MB",
    },
    {
      name: "Fatoumata Diallo",
      role: "Gérante, Saveurs de Guinée - Kankan",
      text: "Le paiement Orange Money intégré a transformé notre restaurant. Plus besoin de gérer du cash, tout est tracé. Le chatbot WhatsApp répond à nos clients même quand nous sommes occupés en cuisine. Un investissement qui vaut chaque GNF.",
      rating: 5,
      initials: "FD",
    },
    {
      name: "Ibrahim Touré",
      role: "Chef, La Terrasse - Conakry",
      text: "Le tableau de bord me permet de voir en temps réel quels plats fonctionnent le mieux. J'ai pu ajuster mon menu et réduire le gaspillage de 30%. Le support est exceptionnel et toujours disponible par WhatsApp.",
      rating: 5,
      initials: "IT",
    },
  ];

  return (
    <section id="testimonials" className="py-20 lg:py-28 bg-orange-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <Badge className="bg-orange-100 text-orange-600 border-orange-200 mb-4">
            Témoignages
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Ils Nous Font{" "}
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              Confiance
            </span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Découvrez ce que les restaurateurs guinéens disent de notre
            plateforme.
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <AnimatedSection key={i} delay={i * 0.15}>
              <Card className="h-full hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star
                        key={j}
                        className="w-5 h-5 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                  <p className="text-gray-700 leading-relaxed mb-6 italic">
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold">
                      {t.initials}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{t.name}</p>
                      <p className="text-sm text-gray-500">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── CTA Section ──────────────────── */
function CTASection() {
  return (
    <section className="py-20 lg:py-28 bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-80 h-80 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        <AnimatedSection>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6">
            Prêt à Digitaliser Votre Restaurant ?
          </h2>
          <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
            Rejoignez plus de 150 restaurants en Guinée qui ont déjà boosté
            leur activité avec RestoPro GN. Essai gratuit de 14 jours, sans
            engagement.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-orange-600 hover:bg-gray-100 rounded-full px-10 py-7 text-lg font-bold shadow-xl"
            >
              Commencer l&apos;Essai Gratuit
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 rounded-full px-10 py-7 text-lg"
            >
              <Phone className="mr-2 w-5 h-5" />
              Nous Appeler
            </Button>
          </div>
          <p className="text-white/70 mt-6 text-sm">
            ✓ Aucune carte bancaire requise &nbsp; | &nbsp; ✓ Setup en 24h
            &nbsp; | &nbsp; ✓ Support local en Guinée
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ──────────────────── Contact Section ──────────────────── */
function ContactSection() {
  return (
    <section id="contact" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <Badge className="bg-green-100 text-green-600 border-green-200 mb-4">
            Contact
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Contactez-{" "}
            <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
              Nous
            </span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Notre équipe locale en Guinée est disponible pour vous accompagner
            dans la mise en place de votre solution.
          </p>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {[
            {
              icon: Phone,
              title: "Téléphone",
              value: "+224 620 00 00 00",
              color: "bg-orange-100 text-orange-600",
            },
            {
              icon: MessageCircle,
              title: "WhatsApp",
              value: "+224 628 00 00 00",
              color: "bg-green-100 text-green-600",
            },
            {
              icon: Mail,
              title: "Email",
              value: "contact@restopro-gn.com",
              color: "bg-blue-100 text-blue-600",
            },
            {
              icon: MapPin,
              title: "Adresse",
              value: "Conakry, Kaloum, GN",
              color: "bg-amber-100 text-amber-700",
            },
          ].map((item, i) => (
            <AnimatedSection key={i} delay={i * 0.1}>
              <Card className="text-center hover:shadow-lg transition-shadow h-full">
                <CardContent className="p-6">
                  <div
                    className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center mx-auto mb-4`}
                  >
                    <item.icon className="w-7 h-7" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {item.title}
                  </h4>
                  <p className="text-gray-600 text-sm">{item.value}</p>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Footer ──────────────────── */
function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <UtensilsCrossed className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">
                RestoPro<span className="text-orange-500">GN</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-4">
              La plateforme de réservation et gestion N°1 pour les restaurants
              en Guinée. Solution complète adaptée aux réalités locales.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-lg">🇬🇳</span>
              <span>Fait en Guinée pour la Guinée</span>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Produit</h4>
            <ul className="space-y-2 text-sm">
              {[
                "Menu Digital",
                "Réservations",
                "Paiements Mobiles",
                "Programme Fidélité",
                "Chatbot WhatsApp",
                "Tableau de Bord",
              ].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-orange-400 transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Entreprise</h4>
            <ul className="space-y-2 text-sm">
              {[
                "À Propos",
                "Carrières",
                "Blog",
                "Presse",
                "Partenaires",
              ].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-orange-400 transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              {[
                "Centre d'Aide",
                "Documentation",
                "Statut du Service",
                "Contactez-Nous",
                "Conditions d'Utilisation",
                "Politique de Confidentialité",
              ].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-orange-400 transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="bg-gray-800 mb-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm">
            © 2026 RestoPro GN. Tous droits réservés.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">
              Paiements sécurisés :
            </span>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-gray-700 text-gray-400 text-xs"
              >
                Orange Money
              </Badge>
              <Badge
                variant="outline"
                className="border-gray-700 text-gray-400 text-xs"
              >
                MTN Money
              </Badge>
              <Badge
                variant="outline"
                className="border-gray-700 text-gray-400 text-xs"
              >
                Visa
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────── Main Page ──────────────────── */
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <MenuDigitalSection />
        <DashboardPreview />
        <ReservationSection />
        <PricingSection />
        <TestimonialsSection />
        <CTASection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
