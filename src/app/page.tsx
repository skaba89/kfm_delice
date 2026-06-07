"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
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
  Flame,
  Leaf,
  Fish,
  CakeSlice,
  Copy,
  Check,
  Settings,
  Palette,
  Code2,
  Layout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ═══════════════════════════════════════════════════════════════
   CONFIG RESTAURANT - Modifier ici pour adapter à un autre resto
   ═══════════════════════════════════════════════════════════════ */
const RESTO = {
  name: "KFM Delice",
  slug: "kfm-delice",
  tagline: "L'Art du Goût Guinéen",
  description:
    "Restaurant gastronomique au cœur de Conakry, KFM Delice vous propose une cuisine guinéenne revisitée avec une touche contemporaine. Produits frais, saveurs authentiques et service impeccable.",
  phone: "+224 622 34 56 78",
  whatsapp: "+224 622 34 56 78",
  email: "reservation@kfm-delice.com",
  address: "Almamya, Corniche Nord, Conakry, Guinée",
  hours: "Lun-Dim : 11h00 - 23h00",
  currency: "GNF",
  heroImage: "/images/kfm-hero.png",
  primaryColor: "orange", // orange | green | blue | red
  rating: 4.9,
  reviewCount: 327,
  tables: 25,
  foundedYear: 2019,
  socialLinks: {
    facebook: "kfm.delice.conakry",
    instagram: "@kfm_delice",
    tiktok: "@kfm_delice_gn",
  },
};

/* ═══════════════════════════════════════════════════════════════
   DONNÉES MENU - Adaptées à KFM Delice
   ═══════════════════════════════════════════════════════════════ */
const MENU_CATEGORIES = [
  {
    id: "entrees",
    name: "Entrées",
    icon: Leaf,
    items: [
      {
        name: "Salade KFM",
        description:
          "Salade fraîche aux légumes de saison, avocat, mangue verte et vinaigrette au citron",
        price: 15000,
        image: "/images/kfm-dish-3.png",
        badge: "Végétarien",
        popular: true,
      },
      {
        name: "Brochettes de Crevettes",
        description:
          "Crevettes marinées aux épices guinéennes, grillées au charbon, sauce pimentée maison",
        price: 25000,
        image: "/images/kfm-dish-2.png",
        badge: "Mer",
        popular: false,
      },
      {
        name: "Soupe de Poisson KFM",
        description:
          "Soupe traditionnelle de poisson frais aux légumes et épices locales",
        price: 18000,
        image: "/images/kfm-dish-4.png",
        badge: "Maison",
        popular: true,
      },
    ],
  },
  {
    id: "plats",
    name: "Plats Principaux",
    icon: Flame,
    items: [
      {
        name: "Riz Jollof KFM Spécial",
        description:
          "Notre riz jollof signature avec poulet braisé aux herbes, légumes grillés et sauce pimentée KFM",
        price: 35000,
        image: "/images/dish-1.png",
        badge: "Signature",
        popular: true,
      },
      {
        name: "Agneau Braisé aux Épices",
        description:
          "Agneau fondant braisé aux épices guinéennes, alloco croustillant et sauce yassa",
        price: 40000,
        image: "/images/kfm-dish-1.png",
        badge: "Premium",
        popular: true,
      },
      {
        name: "Poisson Grillé Entier",
        description:
          "Poisson frais du jour grillé au charbon, sauce diable, alloco et légumes sautés",
        price: 30000,
        image: "/images/dish-3.png",
        badge: "Frais",
        popular: false,
      },
      {
        name: "Plasas Traditionnel",
        description:
          "Plasas aux feuilles de manioc, poisson fumé, viande et huile de palme, servi avec riz blanc",
        price: 25000,
        image: "/images/dish-2.png",
        badge: "Traditionnel",
        popular: false,
      },
    ],
  },
  {
    id: "mer",
    name: "Fruits de Mer",
    icon: Fish,
    items: [
      {
        name: "Plateau Fruits de Mer KFM",
        description:
          "Crevettes, crabes, huîtres et poisson fumé, accompagnés de sauces maison",
        price: 55000,
        image: "/images/kfm-dish-2.png",
        badge: "2 pers.",
        popular: true,
      },
      {
        name: "Crevettes Sauce Curry",
        description:
          "Crevettes sautées au curry doux, lait de coco et légumes croquants",
        price: 38000,
        image: "/images/kfm-dish-2.png",
        badge: "Chef",
        popular: false,
      },
    ],
  },
  {
    id: "desserts",
    name: "Desserts",
    icon: CakeSlice,
    items: [
      {
        name: "Assiette de Fruits Tropicaux",
        description:
          "Mangue, ananas, papaye et banane fraîche, accompagnés de glace coco maison",
        price: 12000,
        image: "/images/kfm-dish-3.png",
        badge: "Frais",
        popular: true,
      },
      {
        name: "Gâteau Chocolat-Coco",
        description:
          "Fondant au chocolat et noix de coco, crème anglaise et coulis de mangue",
        price: 15000,
        image: "/images/kfm-dish-3.png",
        badge: "Maison",
        popular: false,
      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   COMPOSANTS RÉUTILISABLES
   ═══════════════════════════════════════════════════════════════ */

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
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 35 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 35 }}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function AnimatedCounter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const inc = end / (2000 / 16);
    const timer = setInterval(() => {
      start += inc;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, end]);
  return (
    <span ref={ref} className="font-bold">
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

function formatPrice(price: number) {
  return price.toLocaleString("fr-FR") + " " + RESTO.currency;
}

/* ═══════════════════════════════════════════════════════════════
   NAVBAR
   ═══════════════════════════════════════════════════════════════ */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const links = [
    { href: "#menu", label: "Menu" },
    { href: "#reservation", label: "Réserver" },
    { href: "#avis", label: "Avis" },
    { href: "#apropos", label: "À Propos" },
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
          <a href="#" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <span
                className={`text-xl font-extrabold tracking-tight transition-colors ${
                  scrolled ? "text-gray-900" : "text-white"
                }`}
              >
                KFM{" "}
                <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                  Delice
                </span>
              </span>
              <p
                className={`text-[10px] font-medium tracking-widest uppercase ${
                  scrolled ? "text-gray-400" : "text-white/60"
                }`}
              >
                Restaurant & Bar
              </p>
            </div>
          </a>

          <div className="hidden lg:flex items-center gap-7">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`text-sm font-medium transition-colors hover:text-orange-500 ${
                  scrolled ? "text-gray-700" : "text-white/90"
                }`}
              >
                {l.label}
              </a>
            ))}
            <a href="#reservation">
              <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full px-6 shadow-lg shadow-orange-500/25">
                Réserver
              </Button>
            </a>
          </div>

          <button className="lg:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? (
              <X className={scrolled ? "text-gray-900" : "text-white"} />
            ) : (
              <Menu className={scrolled ? "text-gray-900" : "text-white"} />
            )}
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="lg:hidden bg-white rounded-2xl shadow-xl p-4 mb-4"
            >
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="block py-3 px-4 text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg"
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </a>
              ))}
              <a href="#reservation" onClick={() => setMenuOpen(false)}>
                <Button className="w-full mt-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full">
                  Réserver une Table
                </Button>
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════════ */
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={RESTO.heroImage}
          alt={RESTO.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      </div>

      <div className="absolute top-32 right-16 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-32 left-10 w-72 h-72 bg-red-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 px-4 py-1.5 text-sm mb-6">
                <UtensilsCrossed className="w-3.5 h-3.5 mr-1.5" />
                {RESTO.tagline}
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] mb-6"
            >
              KFM{" "}
              <span className="bg-gradient-to-r from-orange-400 via-red-400 to-amber-400 bg-clip-text text-transparent">
                Delice
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-gray-300 mb-4 max-w-lg leading-relaxed"
            >
              {RESTO.description}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="flex items-center gap-4 mb-8"
            >
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${
                      i <= Math.floor(RESTO.rating)
                        ? "fill-amber-400 text-amber-400"
                        : "fill-amber-200 text-amber-200"
                    }`}
                  />
                ))}
              </div>
              <span className="text-white font-bold">{RESTO.rating}/5</span>
              <span className="text-gray-400">({RESTO.reviewCount} avis)</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <a href="#reservation">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full px-8 py-6 text-lg shadow-xl shadow-orange-500/30"
                >
                  <CalendarCheck className="mr-2 w-5 h-5" />
                  Réserver une Table
                </Button>
              </a>
              <a href="#menu">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10 rounded-full px-8 py-6 text-lg"
                >
                  Voir le Menu
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-wrap items-center gap-6 mt-8 text-sm text-gray-400"
            >
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-orange-400" />
                {RESTO.hours}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-orange-400" />
                {RESTO.address}
              </span>
            </motion.div>
          </div>

          {/* Carte réservation flottante */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="hidden lg:block"
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl max-w-sm ml-auto">
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
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-gray-300 text-sm">
                    <Clock className="w-4 h-4 text-orange-400" />
                    Samedi 7 Juin, 20:00
                  </div>
                  <div className="flex items-center gap-2 text-gray-300 text-sm">
                    <MapPin className="w-4 h-4 text-orange-400" />
                    KFM Delice - Terrasse VIP
                  </div>
                  <div className="flex items-center gap-2 text-gray-300 text-sm">
                    <Users className="w-4 h-4 text-orange-400" />
                    Zone VIP, vue mer
                  </div>
                </div>
                <Separator className="bg-white/10 mb-4" />
                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-semibold text-sm">
                    +50 pts fidélité
                  </span>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                    Confirmé ✓
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

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

/* ═══════════════════════════════════════════════════════════════
   STATS RAPIDES
   ═══════════════════════════════════════════════════════════════ */
function StatsBar() {
  const stats = [
    { value: RESTO.tables, suffix: "", label: "Tables Disponibles", icon: UtensilsCrossed },
    { value: RESTO.reviewCount, suffix: "+", label: "Avis Clients", icon: Star },
    { value: 15, suffix: "+", label: "Plats au Menu", icon: Flame },
    { value: 6, suffix: "", label: "Années d'Excellence", icon: TrendingUp },
  ];
  return (
    <section className="py-14 bg-gradient-to-r from-orange-500 via-red-500 to-orange-600 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-white rounded-full blur-3xl" />
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <AnimatedSection key={i} delay={i * 0.08}>
              <div className="text-center text-white">
                <s.icon className="w-7 h-7 mx-auto mb-2 opacity-80" />
                <div className="text-3xl lg:text-4xl font-extrabold">
                  <AnimatedCounter end={s.value} suffix={s.suffix} />
                </div>
                <p className="text-white/80 text-sm mt-1">{s.label}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MENU DIGITAL
   ═══════════════════════════════════════════════════════════════ */
function MenuSection() {
  const [activeCategory, setActiveCategory] = useState("plats");
  const [cart, setCart] = useState<{ name: string; price: number }[]>([]);

  const addItem = (name: string, price: number) => {
    setCart([...cart, { name, price }]);
  };

  const total = cart.reduce((s, i) => s + i.price, 0);

  const currentCategory = MENU_CATEGORIES.find((c) => c.id === activeCategory);

  return (
    <section id="menu" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <Badge className="bg-orange-100 text-orange-600 border-orange-200 mb-4">
            Notre Carte
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Le Menu{" "}
            <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              KFM Delice
            </span>
          </h2>
          <p className="text-gray-600 max-w-xl mx-auto">
            Des plats préparés avec passion, des produits frais sélectionnés chaque
            jour au marché de Conakry.
          </p>
        </AnimatedSection>

        {/* Category Tabs */}
        <AnimatedSection delay={0.1}>
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {MENU_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat.id
                    ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <cat.icon className="w-4 h-4" />
                {cat.name}
              </button>
            ))}
          </div>
        </AnimatedSection>

        {/* Menu Items Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentCategory?.items.map((item, i) => (
            <AnimatedSection key={item.name} delay={i * 0.08}>
              <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="relative h-52 overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  {item.badge && (
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-orange-500 text-white text-xs">
                        {item.badge}
                      </Badge>
                    </div>
                  )}
                  {item.popular && (
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-amber-500 text-white text-xs flex items-center gap-1">
                        <Star className="w-3 h-3 fill-white" /> Populaire
                      </Badge>
                    </div>
                  )}
                  <div className="absolute bottom-3 right-3">
                    <span className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-bold text-orange-600">
                      {formatPrice(item.price)}
                    </span>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-bold text-gray-900 text-base mb-1.5">
                    {item.name}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-3">
                    {item.description}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-orange-200 text-orange-600 hover:bg-orange-50 rounded-xl"
                    onClick={() => addItem(item.name, item.price)}
                  >
                    <PlusIcon className="w-4 h-4 mr-1" />
                    Ajouter
                  </Button>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>

        {/* Mini Cart */}
        <AnimatePresence>
          {cart.length > 0 && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white rounded-2xl shadow-2xl border border-orange-200 px-6 py-4 flex items-center gap-4"
            >
              <div className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                {cart.length}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Votre commande</p>
                <p className="text-orange-600 font-bold">{formatPrice(total)}</p>
              </div>
              <Button
                size="sm"
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl ml-2"
              >
                Commander
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <button
                onClick={() => setCart([])}
                className="text-gray-400 hover:text-red-500 ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR Code Notice */}
        <AnimatedSection className="text-center mt-12">
          <div className="inline-flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-6 py-4">
            <div className="w-14 h-14 bg-white rounded-xl shadow flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-orange-500" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm">
                Scannez le QR Code sur votre table
              </p>
              <p className="text-xs text-gray-500">
                Menu digital interactif - Commandez directement depuis votre téléphone
              </p>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RÉSERVATION
   ═══════════════════════════════════════════════════════════════ */
function ReservationSection() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    date: "",
    time: "",
    guests: "2",
    zone: "interieur",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  const zones = [
    { id: "interieur", name: "Intérieur", desc: "Climatisé, ambiance cosy" },
    { id: "terrasse", name: "Terrasse", desc: "Vue mer, brise fraîche" },
    { id: "vip", name: "VIP", desc: "Espace privé, service premium" },
  ];

  return (
    <section id="reservation" className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <AnimatedSection>
            <Badge className="bg-red-100 text-red-600 border-red-200 mb-4">
              Réservation
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Réservez Votre Table{" "}
              <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                KFM Delice
              </span>
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              Garantissez votre place au KFM Delice. Réservation confirmée par
              SMS et WhatsApp en quelques secondes.
            </p>

            <div className="space-y-4 mb-8">
              {[
                {
                  icon: Zap,
                  title: "Confirmation Instantanée",
                  desc: "SMS + WhatsApp automatiques",
                },
                {
                  icon: Clock,
                  title: "Rappel 2h Avant",
                  desc: "Pour ne jamais oublier votre réservation",
                },
                {
                  icon: Heart,
                  title: "+50 Points Fidélité",
                  desc: "À chaque réservation honorée",
                },
                {
                  icon: MessageCircle,
                  title: "Notes Spéciales",
                  desc: "Allergies, anniversaires, préférences",
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
                    <h4 className="font-semibold text-gray-900 text-sm">
                      {item.title}
                    </h4>
                    <p className="text-gray-500 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm text-orange-800 font-medium mb-2">
                📞 Réservation par téléphone
              </p>
              <p className="text-orange-600 font-bold text-lg">{RESTO.phone}</p>
              <p className="text-xs text-orange-500 mt-1">
                Ou WhatsApp : {RESTO.whatsapp}
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.15}>
            <Card className="shadow-2xl border-0">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    Réserver une Table
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {RESTO.name} - {RESTO.address}
                  </p>
                </div>

                {submitted ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-10"
                  >
                    <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h4 className="font-bold text-gray-900 text-xl mb-2">
                      Réservation Confirmée !
                    </h4>
                    <p className="text-gray-600 mb-1">
                      Merci <strong>{form.name}</strong> !
                    </p>
                    <p className="text-gray-500 text-sm">
                      Confirmation envoyée par SMS et WhatsApp.
                    </p>
                    <p className="text-orange-600 text-sm mt-3 font-medium">
                      +50 points fidélité KFM Delice
                    </p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Nom complet
                        </label>
                        <Input
                          placeholder="Ex: Amadou Diallo"
                          value={form.name}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          className="rounded-xl"
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Téléphone
                        </label>
                        <Input
                          placeholder="+224 6XX XX XX XX"
                          value={form.phone}
                          onChange={(e) =>
                            setForm({ ...form, phone: e.target.value })
                          }
                          className="rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Date
                        </label>
                        <Input
                          type="date"
                          value={form.date}
                          onChange={(e) =>
                            setForm({ ...form, date: e.target.value })
                          }
                          className="rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Heure
                        </label>
                        <select
                          value={form.time}
                          onChange={(e) =>
                            setForm({ ...form, time: e.target.value })
                          }
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                          required
                        >
                          <option value="">Choisir</option>
                          {[
                            "11:00",
                            "11:30",
                            "12:00",
                            "12:30",
                            "13:00",
                            "13:30",
                            "19:00",
                            "19:30",
                            "20:00",
                            "20:30",
                            "21:00",
                          ].map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Personnes
                        </label>
                        <select
                          value={form.guests}
                          onChange={(e) =>
                            setForm({ ...form, guests: e.target.value })
                          }
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, "9+"].map((n) => (
                            <option key={n} value={n}>
                              {n} {n === 1 ? "personne" : "personnes"}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Zone
                        </label>
                        <select
                          value={form.zone}
                          onChange={(e) =>
                            setForm({ ...form, zone: e.target.value })
                          }
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        >
                          {zones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name} - {z.desc}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Notes (allergies, anniversaire...)
                        </label>
                        <Input
                          placeholder="Ex: Anniversaire de ma femme, allergie arachide..."
                          value={form.notes}
                          onChange={(e) =>
                            setForm({ ...form, notes: e.target.value })
                          }
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl py-6 text-lg shadow-lg shadow-orange-500/25"
                    >
                      Confirmer la Réservation
                      <CalendarCheck className="ml-2 w-5 h-5" />
                    </Button>
                    <p className="text-center text-xs text-gray-400">
                      Confirmation gratuite par SMS & WhatsApp
                    </p>
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

/* ═══════════════════════════════════════════════════════════════
   AVIS CLIENTS
   ═══════════════════════════════════════════════════════════════ */
function ReviewsSection() {
  const reviews = [
    {
      name: "Aminata Camara",
      role: "Cliente régulière",
      text: "Le meilleur restaurant de Conakry ! Le riz jollof KFM est incomparable, le service est toujours impeccable et l'ambiance de la terrasse au coucher du soleil est magique. Je recommande à 100%.",
      rating: 5,
      initials: "AC",
      date: "Mai 2026",
    },
    {
      name: "Mamadou Bah",
      role: "Business dinner",
      text: "J'ai organisé un dîner d'affaires dans le VIP et tout était parfait. L'espace privé, le service attentionné et la qualité des plats ont impressionné mes partenaires. Merci KFM Delice !",
      rating: 5,
      initials: "MB",
      date: "Avril 2026",
    },
    {
      name: "Fatoumata Diallo",
      role: "Fête d'anniversaire",
      text: "L'équipe KFM a préparé une surprise d'anniversaire pour mon mari. Le gâteau, la décoration de la table, tout était prévu. Un moment inoubliable pour toute la famille. Service 5 étoiles !",
      rating: 5,
      initials: "FD",
      date: "Mars 2026",
    },
    {
      name: "Ibrahim Touré",
      role: "Touriste - Paris",
      text: "De passage à Conakry, on m'a conseillé KFM Delice. Les fruits de mer sont d'une fraîcheur incroyable et le plasas est le meilleur que j'ai goûté. Le menu digital par QR code c'est très moderne !",
      rating: 5,
      initials: "IT",
      date: "Février 2026",
    },
  ];

  return (
    <section id="avis" className="py-20 lg:py-28 bg-orange-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 mb-4">
            Avis Clients
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Ce Que Disent Nos{" "}
            <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              Clients
            </span>
          </h2>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`w-6 h-6 ${
                    i <= Math.floor(RESTO.rating)
                      ? "fill-amber-400 text-amber-400"
                      : "fill-gray-200 text-gray-200"
                  }`}
                />
              ))}
            </div>
            <span className="text-2xl font-bold text-gray-900">{RESTO.rating}/5</span>
            <span className="text-gray-500">({RESTO.reviewCount} avis)</span>
          </div>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {reviews.map((r, i) => (
            <AnimatedSection key={i} delay={i * 0.1}>
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: r.rating }).map((_, j) => (
                      <Star
                        key={j}
                        className="w-4 h-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                    &ldquo;{r.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 mt-auto">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold">
                      {r.initials}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.date}</p>
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

/* ═══════════════════════════════════════════════════════════════
   À PROPOS
   ═══════════════════════════════════════════════════════════════ */
function AboutSection() {
  return (
    <section id="apropos" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <AnimatedSection>
            <Badge className="bg-red-100 text-red-600 border-red-200 mb-4">
              Notre Histoire
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
              KFM Delice,{" "}
              <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                Depuis 2019
              </span>
            </h2>
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>
                Fondé en 2019 au cœur de Conakry, KFM Delice est né de la passion
                d'une famille guinéenne pour la gastronomie. Notre mission :
                sublimer les saveurs traditionnelles guinéennes avec une touche de
                modernité et d'élégance.
              </p>
              <p>
                Chaque jour, notre chef sélectionne les meilleurs produits frais au
                marché de Madina et de Niger pour vous garantir une qualité
                incomparable. Du riz jollof signature aux fruits de mer frais, nos
                plats racontent l'histoire et la richesse culinaire de la Guinée.
              </p>
              <p>
                Avec 25 tables, une terrasse avec vue mer et un espace VIP privé,
                KFM Delice est l'adresse idéale pour vos dîners en famille, vos
                rendez-vous affaires ou vos célébrations spéciales.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-8">
              <div className="text-center p-4 bg-orange-50 rounded-xl">
                <p className="text-2xl font-extrabold text-orange-600">2019</p>
                <p className="text-xs text-gray-500 mt-1">Année de création</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-xl">
                <p className="text-2xl font-extrabold text-red-600">25</p>
                <p className="text-xs text-gray-500 mt-1">Tables</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-xl">
                <p className="text-2xl font-extrabold text-amber-600">4.9</p>
                <p className="text-xs text-gray-500 mt-1">Note moyenne</p>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.2}>
            <div className="relative">
              <img
                src={RESTO.heroImage}
                alt="KFM Delice Restaurant"
                className="w-full rounded-2xl shadow-xl"
              />
              <div className="absolute -bottom-6 -left-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-5 text-white shadow-lg">
                <p className="text-3xl font-extrabold">6+</p>
                <p className="text-sm opacity-90">Années d&apos;excellence</p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION ADAPTABILITÉ - Montrer que c'est un modèle
   ═══════════════════════════════════════════════════════════════ */
function AdaptabilitySection() {
  const [copied, setCopied] = useState(false);
  const codeSnippet = `// config-restaurant.ts - Changez ces valeurs pour un autre restaurant
const RESTO = {
  name: "Votre Restaurant",
  tagline: "Votre Slogan",
  phone: "+224 XXX XX XX XX",
  address: "Votre Adresse, Conakry",
  primaryColor: "orange", // orange | green | red | blue
  heroImage: "/images/votre-hero.png",
  // ... le menu, les horaires, les avis, etc.
};`;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const adaptationSteps = [
    {
      icon: Palette,
      title: "1. Personnaliser",
      desc: "Changez le nom, les couleurs, les images et le logo du restaurant en quelques minutes",
    },
    {
      icon: Layout,
      title: "2. Configurer le Menu",
      desc: "Ajoutez vos plats, prix en GNF, photos et catégories via le fichier de configuration",
    },
    {
      icon: Settings,
      title: "3. Paramétrer",
      desc: "Horaires, zones, options de réservation, paiements Orange Money/MTN Money",
    },
    {
      icon: Code2,
      title: "4. Déployer",
      desc: "Mettez en ligne le site du restaurant en moins de 24h avec votre domaine personnalisé",
    },
  ];

  return (
    <section className="py-20 lg:py-28 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 relative overflow-hidden">
      <div className="absolute top-20 right-20 w-96 h-96 bg-orange-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-72 h-72 bg-red-500/8 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <AnimatedSection className="text-center mb-16">
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 mb-4">
            Modèle Adaptable
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Un Seul Modèle,{" "}
            <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              Tous les Restaurants
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            KFM Delice est notre premier client. Ce même modèle peut être adapté
            à n&apos;importe quel restaurant en Guinée en changeant simplement la
            configuration.
          </p>
        </AnimatedSection>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Steps */}
          <div className="space-y-4">
            {adaptationSteps.map((step, i) => (
              <AnimatedSection key={i} delay={i * 0.1}>
                <div className="flex items-start gap-4 p-5 bg-white/5 backdrop-blur border border-white/10 rounded-xl hover:border-orange-500/30 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center shrink-0">
                    <step.icon className="w-6 h-6 text-orange-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">{step.title}</h4>
                    <p className="text-gray-400 text-sm">{step.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>

          {/* Code Snippet */}
          <AnimatedSection delay={0.2}>
            <div className="bg-gray-950 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs text-gray-500 ml-2">
                  config-restaurant.ts
                </span>
              </div>
              <pre className="p-5 text-sm text-gray-300 overflow-x-auto">
                <code>{codeSnippet}</code>
              </pre>
              <div className="px-4 py-3 border-t border-white/10 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-white"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1" /> Copié !
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" /> Copier
                    </>
                  )}
                </Button>
              </div>
            </div>
          </AnimatedSection>
        </div>

        {/* Restaurant examples */}
        <AnimatedSection className="mt-16">
          <p className="text-center text-gray-500 text-sm mb-6">
            Exemples de restaurants adaptables avec ce modèle
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { name: "KFM Delice", city: "Conakry", active: true },
              { name: "Le Jardin", city: "Kankan", active: false },
              { name: "Saveurs GN", city: "Nzérékoré", active: false },
              { name: "Terrasse Belle", city: "Kindia", active: false },
              { name: "Maquis Central", city: "Labé", active: false },
              { name: "Chez Maman", city: "Boké", active: false },
            ].map((r, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl text-center border transition-all ${
                  r.active
                    ? "bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-500/30"
                    : "bg-white/5 border-white/10 hover:border-white/20"
                }`}
              >
                <p
                  className={`font-semibold text-sm ${
                    r.active ? "text-orange-400" : "text-gray-400"
                  }`}
                >
                  {r.name}
                </p>
                <p className="text-xs text-gray-500">{r.city}</p>
                {r.active && (
                  <Badge className="mt-1.5 bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] px-1.5 py-0">
                    En ligne
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONTACT
   ═══════════════════════════════════════════════════════════════ */
function ContactSection() {
  return (
    <section id="contact" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <Badge className="bg-green-100 text-green-600 border-green-200 mb-4">
            Contact
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Rejoignez-Nous chez{" "}
            <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              KFM Delice
            </span>
          </h2>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {[
            {
              icon: Phone,
              title: "Téléphone",
              value: RESTO.phone,
              sub: "Appel direct",
              color: "bg-orange-100 text-orange-600",
            },
            {
              icon: MessageCircle,
              title: "WhatsApp",
              value: RESTO.whatsapp,
              sub: "Réponse rapide",
              color: "bg-green-100 text-green-600",
            },
            {
              icon: Mail,
              title: "Email",
              value: RESTO.email,
              sub: "Réservation & infos",
              color: "bg-blue-100 text-blue-600",
            },
            {
              icon: MapPin,
              title: "Adresse",
              value: RESTO.address,
              sub: RESTO.hours,
              color: "bg-red-100 text-red-600",
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
                  <p className="text-gray-600 text-sm font-medium">{item.value}</p>
                  <p className="text-gray-400 text-xs mt-1">{item.sub}</p>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-extrabold text-white">
                  KFM{" "}
                  <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                    Delice
                  </span>
                </span>
                <p className="text-[10px] text-gray-500 tracking-wider uppercase">
                  Restaurant & Bar
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-4">
              {RESTO.tagline} - Restaurant gastronomique au cœur de Conakry,
              Guinée. Cuisine authentique revisitée avec passion.
            </p>
            <p className="text-xs text-gray-500">{RESTO.hours}</p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Navigation</h4>
            <ul className="space-y-2 text-sm">
              {["Menu", "Réserver", "Avis Clients", "À Propos", "Contact"].map(
                (item) => (
                  <li key={item}>
                    <a
                      href={`#${item.toLowerCase().replace(/\s/g, "")}`}
                      className="hover:text-orange-400 transition-colors"
                    >
                      {item}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Suivez-Nous</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-orange-400 transition-colors">
                  Facebook : {RESTO.socialLinks.facebook}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-orange-400 transition-colors">
                  Instagram : {RESTO.socialLinks.instagram}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-orange-400 transition-colors">
                  TikTok : {RESTO.socialLinks.tiktok}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Paiements Acceptés</h4>
            <div className="flex flex-wrap gap-2">
              {["Orange Money", "MTN Money", "Espèces", "Carte Visa"].map((p) => (
                <Badge
                  key={p}
                  variant="outline"
                  className="border-gray-700 text-gray-400 text-xs"
                >
                  {p}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              🇬🇳 Fait en Guinée pour la Guinée
            </p>
          </div>
        </div>

        <Separator className="bg-gray-800 mb-6" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p>© 2026 {RESTO.name}. Tous droits réservés.</p>
          <p className="text-gray-600">
            Propulsé par{" "}
            <span className="text-orange-500 font-medium">RestoPro GN</span> -
            Plateforme de réservation pour restaurants en Guinée
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <StatsBar />
        <MenuSection />
        <ReservationSection />
        <ReviewsSection />
        <AboutSection />
        <AdaptabilitySection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
