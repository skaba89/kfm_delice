"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarCheck,
  RefreshCw,
  CheckCircle2,
  MapPin,
  Clock,
  Phone,
  Star,
  Users,
  Armchair,
  TreePalm,
  Crown,
  Minus,
  Plus,
  AlertTriangle,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useRestaurant } from "@/lib/restaurant-context";
import { useAuth } from "@/lib/auth-context";
import { isRestaurantOpen, zoneLabels } from "@/lib/constants";
import { notify } from "@/lib/notifications";
import { PublicNavbarDynamic } from "@/components/PublicNavbarDynamic";
import { PublicFooterDynamic } from "@/components/PublicFooterDynamic";

// ────────────────────────────────────────────────────────────────
// Time slot generation (11:00 → 22:30, 30-min intervals)
// ────────────────────────────────────────────────────────────────
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 11; h <= 22; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

// ────────────────────────────────────────────────────────────────
// Zone config
// ────────────────────────────────────────────────────────────────
const ZONES = [
  { id: "interieur" as const, icon: Armchair, label: zoneLabels.interieur },
  { id: "terrasse" as const, icon: TreePalm, label: zoneLabels.terrasse },
  { id: "vip" as const, icon: Crown, label: zoneLabels.vip },
];

// ────────────────────────────────────────────────────────────────
// Animated variants
// ────────────────────────────────────────────────────────────────
const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────
interface ReservationResult {
  id: string;
  customerName: string;
  date: string;
  time: string;
  guests: number;
  zone: string;
  [key: string]: unknown;
}

export function ReservationPageDynamic() {
  const { restaurant, slug, loading, error } = useRestaurant();
  const { customer } = useAuth();

  // ── Form state ─────────────────────────────────────────────
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    date: "",
    time: "",
    guests: 2,
    zone: "interieur",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reservationResult, setReservationResult] = useState<ReservationResult | null>(null);

  // ── Derived values ─────────────────────────────────────────
  const primaryColor = restaurant?.primaryColor || "#ea580c";
  const currency = restaurant?.currency || "GNF";
  const isOpen = isRestaurantOpen();

  const rPath = slug ? `/r/${slug}` : "";

  // Pre-fill customer info when available
  useEffect(() => {
    if (customer) {
      setForm((prev) => ({
        ...prev,
        customerName: prev.customerName || customer.name,
        phone: prev.phone || customer.phone,
      }));
    }
  }, [customer]);

  // ── Min date (today) ───────────────────────────────────────
  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);

  // ── Submit handler ─────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          slug: slug || restaurant.slug,
          status: "pending",
          loyaltyPoint: 50,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la réservation");
      }

      const data: ReservationResult = await res.json();
      setReservationResult(data);
      setSubmitted(true);
      notify.success("Réservation envoyée avec succès !");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Erreur lors de la réservation");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reset ──────────────────────────────────────────────────
  const handleReset = () => {
    setSubmitted(false);
    setReservationResult(null);
    setForm({
      customerName: customer?.name || "",
      phone: customer?.phone || "",
      date: "",
      time: "",
      guests: 2,
      zone: "interieur",
      notes: "",
    });
  };

  // ── Guest count controls ───────────────────────────────────
  const incrementGuests = () => setForm((p) => ({ ...p, guests: Math.min(20, p.guests + 1) }));
  const decrementGuests = () => setForm((p) => ({ ...p, guests: Math.max(1, p.guests - 1) }));

  // ── Loading / error states ─────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: primaryColor }} />
          <p className="text-gray-500 dark:text-gray-400">Chargement du restaurant...</p>
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Restaurant introuvable
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            {error || "Impossible de charger les informations du restaurant."}
          </p>
        </div>
      </div>
    );
  }

  // ── Confirmation code ──────────────────────────────────────
  const confirmationCode = reservationResult
    ? `${restaurant.name.substring(0, 3).toUpperCase()}-${reservationResult.id.slice(-6).toUpperCase()}`
    : "";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* ── Navbar ──────────────────────────────────────────── */}
      <PublicNavbarDynamic
        restaurant={restaurant}
        slug={slug}
        onAdminClick={() => (window.location.href = "/admin/login")}
        onCustomerClick={() => (window.location.href = "/client/login")}
        onDriverClick={() => (window.location.href = "/driver/login")}
        customer={customer}
      />

      {/* ── Main content ────────────────────────────────────── */}
      <main className="flex-1 pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="text-center mb-10"
          >
            <Badge
              className="mb-4 text-sm font-medium"
              style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
            >
              <CalendarCheck className="w-3.5 h-3.5 mr-1" />
              Réservation
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
              Réservez Votre{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(to right, ${primaryColor}, ${restaurant.secondaryColor || primaryColor})`,
                }}
              >
                Table
              </span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
              Réservez en ligne et profitez de 50 points de fidélité offerts pour chaque réservation
            </p>

            {/* Open / Closed indicator */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                  isOpen
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${isOpen ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
                />
                {isOpen ? "Ouvert maintenant" : "Fermé actuellement"}
              </span>
            </div>
          </motion.div>

          {/* Two-column layout */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* ── Sidebar: Restaurant info ──────────────────── */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="lg:col-span-1"
            >
              <Card className="shadow-lg border-0 dark:border dark:border-gray-800 overflow-hidden">
                {/* Color header bar */}
                <div className="h-2" style={{ backgroundColor: primaryColor }} />
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-5">
                    {restaurant.logo ? (
                      <img
                        src={restaurant.logo}
                        alt={restaurant.name}
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                    ) : (
                      <div
                        className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {restaurant.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{restaurant.name}</h3>
                      {restaurant.tagline && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{restaurant.tagline}</p>
                      )}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-3">
                    {restaurant.address && (
                      <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: primaryColor }} />
                        <span>{restaurant.address}</span>
                      </div>
                    )}
                    {restaurant.hours && (
                      <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
                        <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: primaryColor }} />
                        <span>{restaurant.hours}</span>
                      </div>
                    )}
                    {restaurant.phone && (
                      <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
                        <Phone className="w-4 h-4 mt-0.5 shrink-0" style={{ color: primaryColor }} />
                        <span>{restaurant.phone}</span>
                      </div>
                    )}
                    {restaurant.rating > 0 && (
                      <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
                        <Star className="w-4 h-4 mt-0.5 shrink-0 fill-amber-400 text-amber-400" />
                        <span>
                          {restaurant.rating.toFixed(1)} / 5 —{" "}
                          <span className="text-gray-400">évaluations clients</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  {/* Loyalty points info */}
                  <div
                    className="rounded-xl p-4"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-5 h-5" style={{ color: primaryColor }} />
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">
                        Points de fidélité
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Gagnez <strong className="text-gray-900 dark:text-white">50 points</strong> pour
                      chaque réservation. Cumulez des points et profitez de réductions sur vos
                      prochaines visites !
                    </p>
                    {customer && (
                      <div className="mt-3 flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{ borderColor: primaryColor, color: primaryColor }}
                        >
                          <Star className="w-3 h-3 mr-1" />
                          {customer.loyaltyPoints} pts
                        </Badge>
                        <span className="text-xs text-gray-500">sur votre compte</span>
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  {/* Quick nav links */}
                  <div className="space-y-2">
                    <a
                      href={`${rPath}/menu`}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      <UtensilsCrossed className="w-4 h-4" style={{ color: primaryColor }} />
                      Voir le menu
                    </a>
                    <a
                      href={rPath || "/"}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      <MapPin className="w-4 h-4" style={{ color: primaryColor }} />
                      Page d&apos;accueil
                    </a>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* ── Form area ──────────────────────────────────── */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="lg:col-span-2"
            >
              <AnimatePresence mode="wait">
                {submitted && reservationResult ? (
                  /* ── Success confirmation ────────────────────── */
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4 }}
                  >
                    <Card className="shadow-xl border-0 dark:border dark:border-gray-800 overflow-hidden">
                      <div className="h-2" style={{ backgroundColor: primaryColor }} />
                      <CardContent className="p-8 sm:p-10 text-center">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                        >
                          <CheckCircle2
                            className="w-20 h-20 mx-auto mb-6"
                            style={{ color: primaryColor }}
                          />
                        </motion.div>

                        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
                          Réservation Confirmée !
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">
                          Votre réservation a été enregistrée. Nous vous contacterons pour confirmer.
                        </p>

                        {/* Confirmation code */}
                        <div
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl mb-8"
                          style={{ backgroundColor: `${primaryColor}15` }}
                        >
                          <CalendarCheck className="w-5 h-5" style={{ color: primaryColor }} />
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Code de confirmation
                          </span>
                          <span
                            className="text-lg font-bold tracking-wider"
                            style={{ color: primaryColor }}
                          >
                            {confirmationCode}
                          </span>
                        </div>

                        {/* Reservation details summary */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6 text-left max-w-md mx-auto mb-8">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-4 text-center">
                            Détails de la réservation
                          </h4>
                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Nom</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {reservationResult.customerName}
                              </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Date</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {reservationResult.date}
                              </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Heure</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {reservationResult.time}
                              </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Convives</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {reservationResult.guests} personne{reservationResult.guests > 1 ? "s" : ""}
                              </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Zone</span>
                              <Badge
                                variant="outline"
                                style={{ borderColor: primaryColor, color: primaryColor }}
                              >
                                {zoneLabels[reservationResult.zone] || reservationResult.zone}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={handleReset}
                          size="lg"
                          className="rounded-xl px-8 text-white"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <CalendarCheck className="w-5 h-5 mr-2" />
                          Nouvelle réservation
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ) : (
                  /* ── Reservation form ────────────────────────── */
                  <motion.div
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="shadow-xl border-0 dark:border dark:border-gray-800 overflow-hidden">
                      <div className="h-2" style={{ backgroundColor: primaryColor }} />
                      <CardContent className="p-6 sm:p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                          {/* Name & Phone */}
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                                Nom complet <span className="text-red-500">*</span>
                              </label>
                              <Input
                                required
                                value={form.customerName}
                                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                                placeholder="Votre nom"
                                className="rounded-xl"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                                Téléphone <span className="text-red-500">*</span>
                              </label>
                              <Input
                                required
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                placeholder="+224 6XX XX XX XX"
                                className="rounded-xl"
                              />
                            </div>
                          </div>

                          {/* Date & Time */}
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                                Date <span className="text-red-500">*</span>
                              </label>
                              <Input
                                required
                                type="date"
                                min={today}
                                value={form.date}
                                onChange={(e) => setForm({ ...form, date: e.target.value })}
                                className="rounded-xl"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                                Heure <span className="text-red-500">*</span>
                              </label>
                              <select
                                required
                                value={form.time}
                                onChange={(e) => setForm({ ...form, time: e.target.value })}
                                className="w-full h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-offset-0 outline-none"
                              >
                                <option value="" disabled>
                                  Sélectionnez une heure
                                </option>
                                {TIME_SLOTS.map((slot) => (
                                  <option key={slot} value={slot}>
                                    {slot}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Guest count */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                              Nombre de convives
                            </label>
                            <div className="flex items-center gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={decrementGuests}
                                disabled={form.guests <= 1}
                                className="rounded-xl h-10 w-10"
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                              <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl min-w-[100px] justify-center">
                                <Users className="w-4 h-4 text-gray-500" />
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {form.guests}
                                </span>
                                <span className="text-sm text-gray-500">
                                  personne{form.guests > 1 ? "s" : ""}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={incrementGuests}
                                disabled={form.guests >= 20}
                                className="rounded-xl h-10 w-10"
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Zone selection */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                              Zone
                            </label>
                            <motion.div
                              variants={staggerContainer}
                              initial="hidden"
                              animate="visible"
                              className="grid grid-cols-3 gap-3"
                            >
                              {ZONES.map((zone) => {
                                const Icon = zone.icon;
                                const isSelected = form.zone === zone.id;
                                return (
                                  <motion.button
                                    key={zone.id}
                                    variants={staggerItem}
                                    type="button"
                                    onClick={() => setForm({ ...form, zone: zone.id })}
                                    className={`
                                      relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer
                                      ${
                                        isSelected
                                          ? "border-current shadow-md scale-[1.02]"
                                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                      }
                                    `}
                                    style={isSelected ? { borderColor: primaryColor, color: primaryColor } : {}}
                                  >
                                    <Icon className="w-6 h-6" />
                                    <span className="text-xs font-medium">{zone.label}</span>
                                    {isSelected && (
                                      <motion.div
                                        layoutId="zoneIndicator"
                                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]"
                                        style={{ backgroundColor: primaryColor }}
                                      >
                                        ✓
                                      </motion.div>
                                    )}
                                  </motion.button>
                                );
                              })}
                            </motion.div>
                          </div>

                          {/* Notes */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                              Notes spéciales
                            </label>
                            <Textarea
                              value={form.notes}
                              onChange={(e) => setForm({ ...form, notes: e.target.value })}
                              placeholder="Allergies, occasions spéciales, demandes particulières..."
                              rows={3}
                              className="rounded-xl resize-none"
                            />
                          </div>

                          {/* Loyalty bonus reminder */}
                          <div
                            className="flex items-center gap-3 p-3 rounded-xl"
                            style={{ backgroundColor: `${primaryColor}08` }}
                          >
                            <Star className="w-5 h-5 shrink-0" style={{ color: primaryColor }} />
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Vous gagnerez <strong className="text-gray-900 dark:text-white">50 points de fidélité</strong> avec
                              cette réservation. Cumulez des points pour des réductions futures !
                            </p>
                          </div>

                          {/* Closed warning */}
                          {!isOpen && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <p className="text-xs text-amber-700 dark:text-amber-300">
                                Le restaurant est actuellement fermé. Votre réservation sera traitée
                                lors de la réouverture.
                              </p>
                            </div>
                          )}

                          {/* Submit button */}
                          <Button
                            type="submit"
                            disabled={submitting}
                            size="lg"
                            className="w-full rounded-xl py-6 text-lg text-white transition-all duration-200 hover:opacity-90"
                            style={{ backgroundColor: primaryColor }}
                          >
                            {submitting ? (
                              <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                            ) : (
                              <>
                                <CalendarCheck className="mr-2 w-5 h-5" />
                                Réserver maintenant
                              </>
                            )}
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className="mt-auto">
        <PublicFooterDynamic restaurant={restaurant} />
      </div>
    </div>
  );
}
