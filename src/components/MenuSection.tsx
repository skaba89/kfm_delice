"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Star, RefreshCw, ShoppingCart, Plus, Minus, X, CreditCard, Utensils, Bike, ShoppingBag, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedSection } from "@/components/AnimatedSection";
import type { MenuItemDB } from "@/lib/types";
import { MENU_CATS, formatPrice } from "@/lib/constants";
import { publicApiFetch } from "@/lib/public-api";
import { useAuth } from "@/lib/auth-context";

interface CartItem extends MenuItemDB {
  qty: number;
}

export function MenuSection() {
  const router = useRouter();
  const { customer } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItemDB[]>([]);
  const [activeCat, setActiveCat] = useState("entrees");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    publicApiFetch("/api/menu?limit=1000")
      .then(r => r.ok ? r.json() : Promise.reject(new Error("menu " + r.status)))
      .then(d => Array.isArray(d) ? d : (d.data || []))
      .catch(() => { setLoadError(true); return []; })
      .then(items => { setMenuItems(items); setLoading(false); });
  }, []);

  const items = menuItems.filter(i => i.category === activeCat && i.available);

  const addToCart = (item: MenuItemDB) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(0, c.qty - 1) } : c).filter(c => c.qty > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const handleCheckout = (orderType: "delivery" | "takeaway" | "dine_in") => {
    // Save cart to sessionStorage for the checkout page
    sessionStorage.setItem("kfm-cart", JSON.stringify(cart));
    sessionStorage.setItem("kfm-cart-total", String(cartTotal));
    sessionStorage.setItem("kfm-order-type", orderType);

    // If not logged in, redirect to login with return URL
    if (!customer) {
      router.push("/client/login?redirect=/checkout");
      return;
    }
    router.push("/checkout");
  };

  return (
    <section id="menu" className="py-20 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 mb-4">Notre Carte</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
            Le Menu <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">KFM Delice</span>
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Des plats préparés avec passion, des ingrédients frais et un savoir-faire guinéen authentique
          </p>
        </AnimatedSection>

        {/* Categories */}
        <div className="flex justify-center gap-2 sm:gap-4 mb-10 flex-wrap">
          {MENU_CATS.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                activeCat === c.id
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <c.icon className="w-4 h-4" /> {c.name}
            </button>
          ))}
        </div>

        {/* Menu items */}
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : loadError && items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium mb-2">Le menu est temporairement indisponible.</p>
            <p className="text-sm">Veuillez réessayer dans quelques instants.</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">Aucun plat disponible dans cette catégorie pour le moment.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => {
              const cartItem = cart.find(c => c.id === item.id);
              return (
                <AnimatedSection key={item.id}>
                  <Card className="overflow-hidden hover:shadow-xl transition-all group dark:bg-gray-900 dark:border-gray-800">
                    <div className="h-48 overflow-hidden relative bg-gradient-to-br from-orange-100 to-amber-100 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <span className="text-6xl opacity-30">🍽️</span>
                      )}
                      {item.badge && <Badge className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs">{item.badge}</Badge>}
                      {item.popular && <Badge className="absolute top-3 left-3 bg-amber-500 text-white text-xs"><Star className="w-3 h-3 mr-1 fill-white" /> Populaire</Badge>}
                    </div>
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{item.name}</h3>
                        <span className="text-lg font-extrabold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">{formatPrice(Number(item.price))}</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{item.description}</p>

                      {/* Add to cart / Quantity selector */}
                      {cartItem ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => removeFromCart(item.id)} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                            <Minus className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                          </button>
                          <span className="font-bold w-8 text-center text-gray-900 dark:text-white">{cartItem.qty}</span>
                          <button onClick={() => addToCart(item)} className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg p-2 transition-all">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(item)}
                          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" /> Ajouter au panier
                        </button>
                      )}
                    </CardContent>
                  </Card>
                </AnimatedSection>
              );
            })}
          </div>
        )}

        {/* Floating Cart Button */}
        <AnimatePresence>
          {cartCount > 0 && !showCart && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => setShowCart(true)}
              className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-full p-4 shadow-2xl shadow-orange-500/40 hover:scale-105 transition-transform"
            >
              <ShoppingCart className="w-6 h-6" />
              <span className="absolute -top-2 -right-2 bg-white text-orange-600 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                {cartCount}
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Cart Modal */}
        <AnimatePresence>
          {showCart && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex"
            >
              <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                className="relative ml-auto w-full max-w-md bg-white dark:bg-gray-900 h-full flex flex-col shadow-2xl"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4 flex items-center justify-between flex-shrink-0">
                  <h2 className="text-lg font-bold">Votre panier</h2>
                  <button onClick={() => setShowCart(false)} className="p-2 hover:bg-white/20 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Cart items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {cart.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Votre panier est vide</p>
                  ) : (
                    cart.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">{item.name}</p>
                          <p className="text-sm text-gray-500">{formatPrice(Number(item.price))} × {item.qty}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => removeFromCart(item.id)} className="bg-gray-200 dark:bg-gray-700 rounded-lg p-2">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-bold w-6 text-center text-gray-900 dark:text-white">{item.qty}</span>
                          <button onClick={() => addToCart(item)} className="bg-orange-500 text-white rounded-lg p-2">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="font-bold text-orange-600 w-20 text-right text-sm">{formatPrice(Number(item.price) * item.qty)}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer with total + order type selection */}
                {cart.length > 0 && (
                  <div className="border-t bg-white dark:bg-gray-900 p-4 flex-shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">Total</span>
                      <span className="text-2xl font-extrabold text-orange-600">{formatPrice(cartTotal)}</span>
                    </div>

                    {/* User status */}
                    <div className="mb-3 flex items-center gap-2 text-sm">
                      {customer ? (
                        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                          <User className="w-4 h-4" />
                          <span className="font-medium">{customer.name}</span>
                          <span className="text-gray-400">· {customer.loyaltyPoints || 0} pts fidélité</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                          <User className="w-4 h-4" />
                          <span>Connexion requise pour finaliser</span>
                        </div>
                      )}
                    </div>

                    {/* Order type buttons */}
                    <div className="space-y-2">
                      <button
                        onClick={() => handleCheckout("delivery")}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl py-3 font-bold hover:shadow-lg transition-all"
                      >
                        <Bike className="w-5 h-5" /> Livraison à domicile
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleCheckout("takeaway")}
                          className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl py-3 font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-sm"
                        >
                          <ShoppingBag className="w-4 h-4" /> À emporter
                        </button>
                        <button
                          onClick={() => handleCheckout("dine_in")}
                          className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl py-3 font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-sm"
                        >
                          <Utensils className="w-4 h-4" /> Sur place
                        </button>
                      </div>
                    </div>

                    {/* Loyalty info */}
                    <p className="text-xs text-gray-400 text-center mt-3">
                      💎 Gagnez <strong>{Math.floor(cartTotal / 1000)}</strong> points de fidélité sur cette commande
                    </p>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
