"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Minus, Trash2, ShoppingCart, ShoppingBag, ChevronRight,
  RefreshCw, Search, UtensilsCrossed, Star, MessageCircle,
  Tag, Navigation, Clock, MapPin, Phone, ArrowLeft, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetFooter, SheetDescription,
} from "@/components/ui/sheet";
import { useRestaurant } from "@/lib/restaurant-context";
import { useAuth } from "@/lib/auth-context";
import { formatPrice, paymentLabels, orderTypeLabels, isRestaurantOpen } from "@/lib/constants";
import { getTier } from "@/lib/hooks/use-loyalty";
import { notify } from "@/lib/notifications";
import { publicApiFetch, getRestaurantSlug } from "@/lib/public-api";
import type { MenuItemDB } from "@/lib/types";
import { PublicNavbarDynamic } from "@/components/PublicNavbarDynamic";
import { PublicFooterDynamic } from "@/components/PublicFooterDynamic";
import { RestaurantLoading } from "@/components/RestaurantLoading";

// ────────────────────────────────────────────────────────────────
// Cart item type
// ────────────────────────────────────────────────────────────────
interface CartItem {
  item: MenuItemDB;
  qty: number;
}

// ────────────────────────────────────────────────────────────────
// Order type & payment method
// ────────────────────────────────────────────────────────────────
type OrderType = "dine_in" | "takeaway" | "delivery";
type PaymentMethod = "cash" | "orange_money" | "mtn_money" | "card";

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────
export function MenuOrderingPageDynamic() {
  const router = useRouter();
  const { restaurant, slug, loading: restLoading, error: restError } = useRestaurant();
  const { customer, driver } = useAuth();

  // ── Menu items ────────────────────────────────────────────
  const [menuItems, setMenuItems] = useState<MenuItemDB[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setMenuLoading(true);
    const url = `/api/menu?slug=${encodeURIComponent(slug)}&limit=1000`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const items = Array.isArray(d) ? d : d.data || [];
        setMenuItems(items);
      })
      .catch(() => {
        notify.error("Erreur lors du chargement du menu");
      })
      .finally(() => setMenuLoading(false));
  }, [slug]);

  // ── Categories (extracted dynamically) ────────────────────
  const categories = useMemo(() => {
    const catSet = [...new Set(menuItems.map((i) => i.category))];
    return catSet.map((c) => ({
      id: c,
      name: c.charAt(0).toUpperCase() + c.slice(1),
    }));
  }, [menuItems]);

  // ── State ─────────────────────────────────────────────────
  const [activeCat, setActiveCat] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"menu" | "checkout">("menu");
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [note, setNote] = useState("");
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // ── Set initial category ──────────────────────────────────
  useEffect(() => {
    if (categories.length > 0 && activeCat === "all") {
      // keep "all" as default; user can select a specific one
    }
  }, [categories, activeCat]);

  // ── Derived values ────────────────────────────────────────
  const primaryColor = restaurant?.primaryColor || "#ea580c";
  const secondaryColor = restaurant?.secondaryColor || primaryColor;
  const currency = restaurant?.currency || "GNF";
  const deliveryFee = restaurant?.deliveryFee ?? 5000;

  const formatPriceLocal = useCallback(
    (p: number) => p.toLocaleString("fr-FR") + " " + currency,
    [currency]
  );

  // ── Loyalty discount ──────────────────────────────────────
  const loyaltyPoints = customer?.loyaltyPoints ?? 0;
  const tier = getTier(loyaltyPoints);
  const discountPercent = customer ? parseInt(tier.discount) : 0;

  // ── Cart operations ───────────────────────────────────────
  const addToCart = useCallback((item: MenuItemDB) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prev, { item, qty: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  }, []);

  const updateCartQty = useCallback((itemId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.item.id !== itemId));
      return;
    }
    setCart((prev) =>
      prev.map((c) => (c.item.id === itemId ? { ...c, qty } : c))
    );
  }, []);

  const cartSubtotal = useMemo(
    () => cart.reduce((s, c) => s + c.item.price * c.qty, 0),
    [cart]
  );

  const discountAmount = useMemo(
    () => Math.round(cartSubtotal * (discountPercent / 100)),
    [cartSubtotal, discountPercent]
  );

  const effectiveDeliveryFee = orderType === "delivery" ? deliveryFee : 0;

  const cartTotal = useMemo(
    () => cartSubtotal - discountAmount,
    [cartSubtotal, discountAmount]
  );

  const grandTotal = cartTotal + effectiveDeliveryFee;

  const cartItemCount = useMemo(
    () => cart.reduce((s, c) => s + c.qty, 0),
    [cart]
  );

  // ── Filtered menu items ───────────────────────────────────
  const filteredItems = useMemo(() => {
    return menuItems
      .filter((i) => i.available)
      .filter((i) => activeCat === "all" || i.category === activeCat)
      .filter((i) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          i.name.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q))
        );
      });
  }, [menuItems, activeCat, searchQuery]);

  // ── Submit order ──────────────────────────────────────────
  const submitOrder = useCallback(async () => {
    if (cart.length === 0) {
      notify.error("Votre panier est vide");
      return;
    }

    if (orderType === "delivery" && !deliveryAddress.trim()) {
      notify.error("Veuillez entrer une adresse de livraison");
      return;
    }

    if (orderType === "dine_in" && !tableNumber.trim()) {
      notify.error("Veuillez entrer le numéro de table");
      return;
    }

    setOrderSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        slug,
        customerName: customer?.name || "Client",
        phone: customer?.phone || "",
        items: cart.map((c) => ({
          id: c.item.id,
          name: c.item.name,
          price: c.item.price,
          qty: c.qty,
        })),
        total: grandTotal,
        orderType,
        paymentMethod,
        deliveryAddress: orderType === "delivery" ? deliveryAddress : "",
        deliveryFee: effectiveDeliveryFee,
        tableNumber: orderType === "dine_in" ? parseInt(tableNumber) || 0 : 0,
        discount: discountAmount,
        tax: 0,
        note,
      };

      const res = await publicApiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la commande");
      }

      notify.success("Commande envoyée avec succès !");
      setCart([]);
      setCartOpen(false);
      setCheckoutStep("menu");
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 5000);
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : "Erreur lors de la commande"
      );
    } finally {
      setOrderSubmitting(false);
    }
  }, [
    cart, slug, customer, grandTotal, orderType, paymentMethod,
    deliveryAddress, effectiveDeliveryFee, tableNumber, discountAmount, note,
  ]);

  // ── Loading / error states ────────────────────────────────
  if (restLoading || menuLoading) {
    return <RestaurantLoading />;
  }

  if (restError || !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {restError || "Restaurant introuvable"}
          </p>
          <button
            onClick={() => router.push("/")}
            className="font-medium hover:underline"
            style={{ color: primaryColor }}
          >
            Retour à l&apos;accueil
          </button>
        </div>
      </div>
    );
  }

  const isOpen = isRestaurantOpen();
  const rPath = slug ? `/r/${slug}` : "";

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* ── Navbar ─────────────────────────────────────────── */}
      <PublicNavbarDynamic
        restaurant={restaurant}
        slug={slug}
        onAdminClick={() => router.push("/admin/login")}
        onCustomerClick={() => {
          if (customer) router.push("/client");
          else router.push("/client/login");
        }}
        onDriverClick={() => {
          if (driver) router.push("/driver");
          else router.push("/driver/login");
        }}
        customer={customer}
      />

      {/* ── Hero Banner ────────────────────────────────────── */}
      <section className="relative pt-16">
        <div
          className="h-48 sm:h-64 bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
          }}
        >
          <div className="text-center text-white px-4">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl sm:text-4xl font-extrabold mb-2 drop-shadow-lg"
            >
              {restaurant.name}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-white/80 text-sm sm:text-base mb-3"
            >
              {restaurant.tagline}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Badge
                className={`text-xs px-3 py-1 ${
                  isOpen
                    ? "bg-green-500/90 text-white"
                    : "bg-red-500/90 text-white"
                }`}
              >
                <Clock className="w-3 h-3 mr-1" />
                {isOpen ? "Ouvert maintenant" : "Fermé"}
              </Badge>
            </motion.div>
          </div>
        </div>

        {/* Navigation links */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-12 overflow-x-auto">
            <a
              href={`${rPath}/menu`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white whitespace-nowrap"
              style={{ backgroundColor: primaryColor }}
            >
              <UtensilsCrossed className="w-4 h-4" /> Commander
            </a>
            <a
              href={`${rPath}/reservation`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-nowrap transition-colors"
            >
              <Clock className="w-4 h-4" /> Réserver
            </a>
            <a
              href={`${rPath}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-nowrap transition-colors"
            >
              <MapPin className="w-4 h-4" /> Accueil
            </a>
          </div>
        </div>
      </section>

      {/* ── Main content ───────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Success message */}
        <AnimatePresence>
          {orderSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-center gap-3"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                <Check className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300 text-sm">
                  Commande envoyée !
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Votre commande a été transmise au restaurant.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {checkoutStep === "menu" ? (
          <div className="flex gap-6">
            {/* ── Category sidebar (desktop) ────────────────── */}
            <aside className="hidden lg:block w-52 shrink-0">
              <div className="sticky top-24 space-y-1">
                <button
                  onClick={() => setActiveCat("all")}
                  className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                    activeCat === "all"
                      ? "text-white shadow-lg"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                  style={
                    activeCat === "all"
                      ? { backgroundColor: primaryColor }
                      : undefined
                  }
                >
                  Tous
                  <span
                    className={`ml-auto text-xs ${
                      activeCat === "all"
                        ? "text-white/70"
                        : "text-gray-400"
                    }`}
                  >
                    {menuItems.filter((i) => i.available).length}
                  </span>
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                      activeCat === c.id
                        ? "text-white shadow-lg"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    style={
                      activeCat === c.id
                        ? { backgroundColor: primaryColor }
                        : undefined
                    }
                  >
                    {c.name}
                    <span
                      className={`ml-auto text-xs ${
                        activeCat === c.id
                          ? "text-white/70"
                          : "text-gray-400"
                      }`}
                    >
                      {menuItems.filter(
                        (i) => i.category === c.id && i.available
                      ).length}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            {/* ── Items area ────────────────────────────────── */}
            <div className="flex-1 min-w-0">
              {/* Search bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un plat..."
                  className="pl-9 bg-white dark:bg-gray-800"
                />
              </div>

              {/* Mobile category scroll */}
              <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 mb-4">
                <button
                  onClick={() => setActiveCat("all")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all shrink-0 ${
                    activeCat === "all"
                      ? "text-white shadow-lg"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                  }`}
                  style={
                    activeCat === "all"
                      ? { backgroundColor: primaryColor }
                      : undefined
                  }
                >
                  Tous
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all shrink-0 ${
                      activeCat === c.id
                        ? "text-white shadow-lg"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                    }`}
                    style={
                      activeCat === c.id
                        ? { backgroundColor: primaryColor }
                        : undefined
                    }
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* Loyalty discount banner */}
              {discountPercent > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl mb-4"
                >
                  <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    Réduction fidélité de{" "}
                    <strong>{discountPercent}%</strong> appliquée
                    automatiquement !
                  </p>
                </motion.div>
              )}

              {/* Empty state */}
              {filteredItems.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingBag className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-lg font-medium mb-1">
                    Aucun article trouvé
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm">
                    Essayez une autre catégorie ou recherche
                  </p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredItems.map((item, idx) => {
                    const inCart = cart.find((c) => c.item.id === item.id);
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: Math.min(idx * 0.04, 0.4),
                        }}
                      >
                        <Card className="overflow-hidden hover:shadow-lg transition-all group dark:bg-gray-800 dark:border-gray-700">
                          <div className="h-40 overflow-hidden relative">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center"
                                style={{
                                  background: `linear-gradient(135deg, ${primaryColor}22, ${primaryColor}11)`,
                                }}
                              >
                                <UtensilsCrossed
                                  className="w-8 h-8"
                                  style={{ color: `${primaryColor}66` }}
                                />
                              </div>
                            )}
                            {item.badge && (
                              <Badge
                                className="absolute top-2 right-2 text-white text-[10px]"
                                style={{
                                  background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
                                }}
                              >
                                {item.badge}
                              </Badge>
                            )}
                            {item.popular && (
                              <Badge className="absolute top-2 left-2 bg-amber-500 text-white text-[10px]">
                                <Star className="w-3 h-3 mr-0.5 fill-white" />{" "}
                                Populaire
                              </Badge>
                            )}
                            {inCart && (
                              <div className="absolute bottom-2 right-2">
                                <Badge
                                  className="text-white text-[10px] px-2"
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  {inCart.qty} dans le panier
                                </Badge>
                              </div>
                            )}
                          </div>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight flex-1 min-w-0 mr-2">
                                {item.name}
                              </h3>
                              <span
                                className="text-sm font-extrabold whitespace-nowrap"
                                style={{ color: primaryColor }}
                              >
                                {formatPriceLocal(item.price)}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                                {item.description}
                              </p>
                            )}
                            <div className="flex items-center justify-end">
                              {inCart ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() =>
                                      updateCartQty(item.id, inCart.qty - 1)
                                    }
                                    className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="text-sm font-semibold w-6 text-center dark:text-gray-200">
                                    {inCart.qty}
                                  </span>
                                  <button
                                    onClick={() =>
                                      updateCartQty(item.id, inCart.qty + 1)
                                    }
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white transition-colors"
                                    style={{ backgroundColor: primaryColor }}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => addToCart(item)}
                                  className="text-white text-xs rounded-lg h-8"
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  <Plus className="w-3 h-3 mr-1" /> Ajouter
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Checkout step ──────────────────────────────── */
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Button
              variant="ghost"
              onClick={() => setCheckoutStep("menu")}
              className="mb-4 text-gray-600 dark:text-gray-400"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Retour au menu
            </Button>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Order details */}
              <div className="lg:col-span-2 space-y-4">
                {/* Order type selection */}
                <Card className="dark:bg-gray-800 dark:border-gray-700">
                  <CardContent className="p-4 sm:p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <UtensilsCrossed className="w-5 h-5" style={{ color: primaryColor }} />
                      Type de commande
                    </h3>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {(["dine_in", "takeaway", "delivery"] as OrderType[]).map(
                        (type) => (
                          <button
                            key={type}
                            onClick={() => setOrderType(type)}
                            className={`p-3 sm:p-4 rounded-xl border text-sm font-medium transition-all ${
                              orderType === type
                                ? "border-current bg-opacity-5"
                                : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                            }`}
                            style={
                              orderType === type
                                ? {
                                    borderColor: primaryColor,
                                    backgroundColor: `${primaryColor}0D`,
                                    color: primaryColor,
                                  }
                                : undefined
                            }
                          >
                            {orderTypeLabels[type]}
                          </button>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Conditional fields */}
                <Card className="dark:bg-gray-800 dark:border-gray-700">
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    {orderType === "delivery" && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                          <MapPin className="w-4 h-4 inline mr-1" />
                          Adresse de livraison
                        </label>
                        <Input
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="Votre adresse de livraison..."
                          className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                        />
                      </div>
                    )}

                    {orderType === "dine_in" && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                          Numéro de table
                        </label>
                        <Input
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value)}
                          placeholder="Ex: 5"
                          type="number"
                          className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                        />
                      </div>
                    )}

                    {orderType === "takeaway" && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                          <Phone className="w-4 h-4 inline mr-1" />
                          Numéro de téléphone
                        </label>
                        <Input
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Votre numéro de téléphone..."
                          className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                        />
                      </div>
                    )}

                    {/* Payment method */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Mode de paiement
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            "cash",
                            "orange_money",
                            "mtn_money",
                            "card",
                          ] as PaymentMethod[]
                        ).map((m) => (
                          <button
                            key={m}
                            onClick={() => setPaymentMethod(m)}
                            className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                              paymentMethod === m
                                ? "border-current bg-opacity-5"
                                : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                            }`}
                            style={
                              paymentMethod === m
                                ? {
                                    borderColor: primaryColor,
                                    backgroundColor: `${primaryColor}0D`,
                                    color: primaryColor,
                                  }
                                : undefined
                            }
                          >
                            {paymentLabels[m]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Note */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                        Notes (optionnel)
                      </label>
                      <Textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Instructions spéciales, allergies..."
                        rows={2}
                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Order summary */}
              <div>
                <Card className="dark:bg-gray-800 dark:border-gray-700 sticky top-24">
                  <CardContent className="p-4 sm:p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5" style={{ color: primaryColor }} />
                      Résumé de commande
                    </h3>

                    {cart.length === 0 ? (
                      <div className="text-center py-6">
                        <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                          Votre panier est vide
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Cart items summary */}
                        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                          {cart.map((c) => (
                            <div
                              key={c.item.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() =>
                                    updateCartQty(c.item.id, c.qty - 1)
                                  }
                                  className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                                >
                                  <Minus className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                                </button>
                                <span className="text-xs font-semibold w-5 text-center dark:text-gray-200">
                                  {c.qty}
                                </span>
                                <button
                                  onClick={() =>
                                    updateCartQty(c.item.id, c.qty + 1)
                                  }
                                  className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                                >
                                  <Plus className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                                </button>
                              </div>
                              <span className="flex-1 min-w-0 truncate dark:text-gray-200">
                                {c.item.name}
                              </span>
                              <span className="font-medium dark:text-gray-200 whitespace-nowrap">
                                {formatPriceLocal(c.item.price * c.qty)}
                              </span>
                              <button
                                onClick={() => removeFromCart(c.item.id)}
                                className="p-0.5 text-red-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        <Separator />

                        {/* Totals */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">
                              Sous-total
                            </span>
                            <span className="font-medium dark:text-gray-200">
                              {formatPriceLocal(cartSubtotal)}
                            </span>
                          </div>

                          {discountAmount > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Réduction fidélité ({discountPercent}%)
                              </span>
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                -{formatPriceLocal(discountAmount)}
                              </span>
                            </div>
                          )}

                          {effectiveDeliveryFee > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500 dark:text-gray-400">
                                Frais de livraison
                              </span>
                              <span className="font-medium dark:text-gray-200">
                                {formatPriceLocal(effectiveDeliveryFee)}
                              </span>
                            </div>
                          )}

                          <Separator />

                          <div className="flex justify-between font-bold text-lg pt-1">
                            <span className="dark:text-gray-100">Total</span>
                            <span style={{ color: primaryColor }}>
                              {formatPriceLocal(grandTotal)}
                            </span>
                          </div>
                        </div>

                        {/* Submit button */}
                        <Button
                          onClick={submitOrder}
                          disabled={
                            orderSubmitting ||
                            cart.length === 0 ||
                            (orderType === "delivery" &&
                              !deliveryAddress.trim()) ||
                            (orderType === "dine_in" && !tableNumber.trim())
                          }
                          className="w-full text-white rounded-xl h-12 text-base font-semibold"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {orderSubmitting ? (
                            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                          ) : (
                            <ShoppingBag className="w-5 h-5 mr-2" />
                          )}
                          Confirmer — {formatPriceLocal(grandTotal)}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* ── Sticky cart bar (mobile) ─────────────────────────── */}
      {checkoutStep === "menu" && cart.length > 0 && (
        <div className="sticky bottom-0 z-30 p-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 sm:hidden">
          <Button
            onClick={() => setCartOpen(true)}
            className="w-full text-white rounded-xl h-12 shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Voir le panier ({cartItemCount}) — {formatPriceLocal(grandTotal)}
          </Button>
        </div>
      )}

      {/* ── Desktop floating cart button ─────────────────────── */}
      {checkoutStep === "menu" && cart.length > 0 && (
        <div className="hidden sm:block fixed bottom-6 right-6 z-40">
          <Button
            onClick={() => setCartOpen(true)}
            className="rounded-full h-14 px-6 shadow-xl text-white"
            style={{
              backgroundColor: primaryColor,
              boxShadow: `0 4px 14px ${primaryColor}44`,
            }}
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            {cartItemCount} — {formatPriceLocal(grandTotal)}
          </Button>
        </div>
      )}

      {/* ── Cart Sheet (slide-in sidebar) ─────────────────────── */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="p-4 border-b dark:border-gray-700">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" style={{ color: primaryColor }} />
              Votre panier ({cartItemCount})
            </SheetTitle>
            <SheetDescription>
              Vérifiez vos articles avant de commander
            </SheetDescription>
          </SheetHeader>

          {cart.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <ShoppingCart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-3">
                  Votre panier est vide
                </p>
                <Button
                  variant="outline"
                  onClick={() => setCartOpen(false)}
                  className="dark:border-gray-600"
                >
                  Voir le menu
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Cart items list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.map((c) => (
                  <motion.div
                    key={c.item.id}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                  >
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0">
                      {c.item.image ? (
                        <img
                          src={c.item.image}
                          alt={c.item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${primaryColor}22, ${primaryColor}11)`,
                          }}
                        >
                          <UtensilsCrossed
                            className="w-5 h-5"
                            style={{ color: `${primaryColor}66` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {c.item.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatPriceLocal(c.item.price)} x {c.qty}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateCartQty(c.item.id, c.qty - 1)}
                        className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                      </button>
                      <span className="text-sm font-semibold w-5 text-center dark:text-gray-200">
                        {c.qty}
                      </span>
                      <button
                        onClick={() => updateCartQty(c.item.id, c.qty + 1)}
                        className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 w-20 text-right">
                      {formatPriceLocal(c.item.price * c.qty)}
                    </span>
                    <button
                      onClick={() => removeFromCart(c.item.id)}
                      className="p-1 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Cart footer with totals */}
              <SheetFooter className="border-t dark:border-gray-700 p-4 space-y-3">
                {/* Loyalty discount */}
                {discountPercent > 0 && (
                  <div className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      Réduction {discountPercent}% (fidélité)
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Sous-total
                    </span>
                    <span className="font-medium dark:text-gray-200">
                      {formatPriceLocal(cartSubtotal)}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Réduction ({discountPercent}%)
                      </span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        -{formatPriceLocal(discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Livraison
                    </span>
                    <span className="font-medium dark:text-gray-200">
                      {effectiveDeliveryFee > 0
                        ? formatPriceLocal(effectiveDeliveryFee)
                        : "Gratuite"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg pt-1">
                    <span className="dark:text-gray-100">Total</span>
                    <span style={{ color: primaryColor }}>
                      {formatPriceLocal(grandTotal)}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setCartOpen(false);
                    setCheckoutStep("checkout");
                  }}
                  className="w-full text-white rounded-xl h-12 font-semibold"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Navigation className="w-4 h-4 mr-2" /> Passer la commande
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── WhatsApp button ───────────────────────────────────── */}
      {restaurant.whatsapp && (
        <a
          href={`https://wa.me/${restaurant.whatsapp.replace(/\s/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg shadow-green-500/30 transition-colors"
          title="Commander via WhatsApp"
        >
          <MessageCircle className="w-6 h-6" />
        </a>
      )}

      {/* ── Footer ─────────────────────────────────────────────── */}
      <PublicFooterDynamic restaurant={restaurant} />
    </div>
  );
}
