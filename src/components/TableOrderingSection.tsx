"use client";

import { useState, useEffect } from "react";
import { Star, RefreshCw, MessageCircle, ShoppingCart, Plus, Minus, X, CreditCard, CalendarCheck, CheckCircle2, Utensils, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AnimatedSection } from "@/components/AnimatedSection";
import type { MenuItemDB } from "@/lib/types";
import { MENU_CATS, formatPrice } from "@/lib/constants";
import { useLocale } from "@/lib/i18n";

const FALLBACK_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "224622345678";

interface CartItem extends MenuItemDB {
  qty: number;
}

export function TableOrderingSection({ tableNumber }: { tableNumber: number }) {
  const { t } = useLocale();
  const [menuItems, setMenuItems] = useState<MenuItemDB[]>([]);
  const [activeCat, setActiveCat] = useState("entrees");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState<string>(FALLBACK_WHATSAPP);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{ success: boolean; message: string; orderId?: string } | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "orange_money" | "mtn_money" | "wave" | "card">("cash");

  // ── Reservation state ──
  const [activeTab, setActiveTab] = useState<"order" | "reservation">("order");
  const [resForm, setResForm] = useState({ customerName: "", phone: "", date: "", time: "", guests: 2, zone: "interieur", notes: "" });
  const [resSubmitted, setResSubmitted] = useState(false);
  const [resSubmitting, setResSubmitting] = useState(false);

  useEffect(() => {
    // Resolve restaurant slug from localStorage, URL query, or URL path.
    // No hardcoded default — each restaurant has its own slug derived
    // from its name.
    let restaurantSlug = "";
    try {
      const stored = localStorage.getItem("restaurantpro_slug");
      if (stored) restaurantSlug = stored;
    } catch {}
    if (!restaurantSlug && typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const qSlug = sp.get("restaurant") || sp.get("slug");
      if (qSlug) restaurantSlug = qSlug;
      if (!restaurantSlug) {
        const m = window.location.pathname.match(/^\/r\/([^/]+)/);
        if (m) restaurantSlug = decodeURIComponent(m[1]);
      }
    }
    const slugHeader: Record<string, string> = restaurantSlug ? { "x-restaurant-slug": restaurantSlug } : {};

    Promise.all([
      fetch("/api/menu?limit=1000", { headers: slugHeader })
        .then(r => r.ok ? r.json() : Promise.reject(new Error("menu " + r.status)))
        .then(d => Array.isArray(d) ? d : (d.data || []))
        .catch(() => { setLoadError(true); return []; }),
      fetch("/api/restaurant", { headers: slugHeader })
        .then(r => r.ok ? r.json() : null)
        .then(d => d?.whatsapp ? String(d.whatsapp).replace(/[^0-9]/g, "") : null)
        .catch(() => null),
    ]).then(([items, wa]) => {
      setMenuItems(items);
      if (wa) setWhatsappNumber(wa);
      setLoading(false);
    });
  }, []);

  const items = menuItems.filter(i => i.category === activeCat && i.available);

  const addToCart = (item: MenuItemDB) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(0, c.qty - 1) } : c).filter(c => c.qty > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const submitOrder = async () => {
    console.log("[submitOrder] START — cart.length:", cart.length, "submitting:", submitting);
    if (cart.length === 0) {
      console.log("[submitOrder] ABORT — cart is empty");
      return;
    }
    if (submitting) {
      console.log("[submitOrder] ABORT — already submitting");
      return;
    }
    setSubmitting(true);
    setOrderResult(null);

    try {
      let restaurantSlug = "";
      try {
        const stored = localStorage.getItem("restaurantpro_slug");
        if (stored) restaurantSlug = stored;
      } catch {}
      if (!restaurantSlug && typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        const qSlug = sp.get("restaurant") || sp.get("slug");
        if (qSlug) restaurantSlug = qSlug;
        if (!restaurantSlug) {
          const m = window.location.pathname.match(/^\/r\/([^/]+)/);
          if (m) restaurantSlug = decodeURIComponent(m[1]);
        }
      }
      const slugHeader: Record<string, string> = restaurantSlug ? { "x-restaurant-slug": restaurantSlug } : {};

      const orderItems = cart.map(item => ({
        name: item.name,
        price: Number(item.price),
        qty: item.qty,
      }));

      console.log("[submitOrder] Sending request to /api/orders", {
        itemsCount: orderItems.length,
        total: cartTotal,
        tableNumber,
      });

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...slugHeader },
        body: JSON.stringify({
          items: JSON.stringify(orderItems),
          total: cartTotal,
          orderType: "dine_in",
          tableNumber: tableNumber,
          customerName: customerName || `Table ${tableNumber}`,
          phone: phone,
          paymentMethod: paymentMethod,
        }),
      });

      const data = await response.json().catch(() => ({}));

      console.log("[submitOrder] Response received", {
        ok: response.ok,
        status: response.status,
        dataId: data?.id,
        dataError: data?.error,
      });

      if (response.ok) {
        setOrderResult({
          success: true,
          message: `Commande envoyée ! Table ${tableNumber}. Les préparer bientôt.`,
          orderId: data.id,
        });
        setCart([]);
        setShowCart(false);

        // If payment method is not cash, initiate payment
        if (paymentMethod !== "cash" && data.id) {
          try {
            const payResponse = await fetch("/api/payment", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...slugHeader },
              body: JSON.stringify({
                orderId: data.id,
                method: paymentMethod,
                phone: phone,
                customerName: customerName || `Table ${tableNumber}`,
              }),
            });
            const payData = await payResponse.json().catch(() => ({}));
            if (payData.payment) {
              setOrderResult({
                success: true,
                message: `Commande #${data.id.slice(-6).toUpperCase()} créée pour Table ${tableNumber}. Paiement ${paymentMethod === 'card' ? 'carte' : paymentMethod} en cours.`,
                orderId: data.id,
              });
            }
          } catch (e) {
            // Payment failed but order is created
          }
        }
      } else {
        // Show the EXACT error from the server (not a generic message)
        const errorMsg = data.error || data.message || `Erreur ${response.status}`;
        setOrderResult({
          success: false,
          message: errorMsg,
        });
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Erreur inconnue";
      setOrderResult({
        success: false,
        message: `Erreur de connexion: ${errMsg}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reservation submit ──
  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setResSubmitting(true);
    try {
      let restaurantSlug = "";
      try {
        const stored = localStorage.getItem("restaurantpro_slug");
        if (stored) restaurantSlug = stored;
      } catch {}
      if (!restaurantSlug && typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        const qSlug = sp.get("restaurant") || sp.get("slug");
        if (qSlug) restaurantSlug = qSlug;
        if (!restaurantSlug) {
          const m = window.location.pathname.match(/^\/r\/([^/]+)/);
          if (m) restaurantSlug = decodeURIComponent(m[1]);
        }
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (restaurantSlug) headers["x-restaurant-slug"] = restaurantSlug;
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...resForm,
          status: "pending",
          loyaltyPoint: 50,
          notes: `Table ${tableNumber}${resForm.notes ? ' — ' + resForm.notes : ''}`,
        }),
      });
      if (response.ok) setResSubmitted(true);
      else {
        const errData = await response.json().catch(() => ({}));
        setResSubmitted(false);
        alert(errData.error || "Erreur lors de la réservation. Réessayez.");
      }
    } catch { /* */ }
    finally { setResSubmitting(false); }
  };

  if (orderResult) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 to-amber-50">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${orderResult.success ? 'bg-green-100' : 'bg-red-100'}`}>
              {orderResult.success ? '✓' : '✗'}
            </div>
            <h2 className="text-xl font-bold mb-2">{orderResult.success ? 'Commande envoyée !' : 'Erreur'}</h2>
            <p className="text-gray-600 mb-4">{orderResult.message}</p>
            {orderResult.success && (
              <p className="text-sm text-gray-400 mb-4">Table {tableNumber} • Servez-vous à nouveau quand vous voulez</p>
            )}
            <Button
              onClick={() => setOrderResult(null)}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white"
            >
              {t('cart.checkout')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header avec numéro de table */}
      <div className="sticky top-0 z-30 bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍽️</span>
            <div>
              <p className="font-bold text-lg">Table {tableNumber}</p>
              <p className="text-xs opacity-90">Commandez directement depuis votre table</p>
            </div>
          </div>
          {cartCount > 0 && (
            <button
              onClick={() => setShowCart(true)}
              className="relative bg-white/20 hover:bg-white/30 rounded-full p-3 transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-white text-orange-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Onglets Commander / Réserver */}
      <div className="sticky top-[64px] z-20 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex gap-2">
          <button
            onClick={() => setActiveTab("order")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "order" ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            <Utensils className="w-4 h-4" /> {t('cart.checkout')}
          </button>
          <button
            onClick={() => setActiveTab("reservation")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "reservation" ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            <Calendar className="w-4 h-4" /> {t('reservation.title')}
          </button>
        </div>
      </div>

      {/* ── Onglet Réservation ── */}
      {activeTab === "reservation" && (
        <div className="max-w-2xl mx-auto px-4 py-8">
          {resSubmitted ? (
            <Card className="shadow-xl">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Réservation Confirmée !</h3>
                <p className="text-gray-500 mb-2">Table {tableNumber} — {resForm.guests} personne(s)</p>
                <p className="text-gray-500 mb-4">{resForm.date} à {resForm.time}</p>
                <p className="text-sm text-gray-400 mb-4">+50 points de fidélité offerts</p>
                <Button
                  onClick={() => { setResSubmitted(false); setResForm({ customerName: "", phone: "", date: "", time: "", guests: 2, zone: "interieur", notes: "" }); }}
                  className="bg-gradient-to-r from-orange-500 to-red-500 text-white"
                >
                  Nouvelle réservation
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-xl">
              <CardContent className="p-6 sm:p-8">
                <h2 className="text-xl font-bold mb-1">{t('reservation.title')} — {t('cart.table')} {tableNumber}</h2>
                <p className="text-sm text-gray-500 mb-6">Réservez votre table et gagnez 50 points de fidélité</p>
                <form onSubmit={handleReservation} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">{t('auth.name')} *</label>
                      <Input required value={resForm.customerName} onChange={e => setResForm({ ...resForm, customerName: e.target.value })} placeholder="Votre nom" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Téléphone *</label>
                      <Input required value={resForm.phone} onChange={e => setResForm({ ...resForm, phone: e.target.value })} placeholder="+224 6XX XX XX XX" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Date *</label>
                      <Input required type="date" value={resForm.date} onChange={e => setResForm({ ...resForm, date: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Heure *</label>
                      <Input required type="time" value={resForm.time} onChange={e => setResForm({ ...resForm, time: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">{t('reservation.guests')}</label>
                      <Input type="number" min={1} max={20} value={resForm.guests} onChange={e => setResForm({ ...resForm, guests: parseInt(e.target.value) || 2 })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">{t('reservation.zone')}</label>
                      <select value={resForm.zone} onChange={e => setResForm({ ...resForm, zone: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                        <option value="interieur">{t('reservation.zone.interieur')}</option>
                        <option value="terrasse">{t('reservation.zone.terrasse')}</option>
                        <option value="vip">VIP</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Notes spéciales</label>
                    <Textarea value={resForm.notes} onChange={e => setResForm({ ...resForm, notes: e.target.value })} placeholder="Allergies, occasions spéciales..." rows={3} />
                  </div>
                  <Button type="submit" disabled={resSubmitting} className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl py-6 text-lg">
                    {resSubmitting ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : <><CalendarCheck className="mr-2 w-5 h-5" />{t('reservation.confirm')} — {t('cart.table')} {tableNumber}</>}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Onglet Commander (contenu existant) ── */}
      {activeTab === "order" && (
        <>
      {/* Catégories */}
      <div className="sticky top-[112px] z-20 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-start gap-2 overflow-x-auto pb-1">
            {MENU_CATS.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${activeCat === c.id ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                <c.icon className="w-4 h-4" /> {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div className="max-w-7xl mx-auto px-4 py-6">
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const cartItem = cart.find(c => c.id === item.id);
              return (
                <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-all">
                  <div className="h-40 overflow-hidden relative bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl opacity-30">🍽️</span>
                    )}
                    {item.badge && <Badge className="absolute top-2 right-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs">{item.badge}</Badge>}
                    {item.popular && <Badge className="absolute top-2 left-2 bg-amber-500 text-white text-xs"><Star className="w-3 h-3 mr-1 fill-white" /> Populaire</Badge>}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-900">{item.name}</h3>
                      <span className="font-extrabold text-orange-600">{formatPrice(Number(item.price))}</span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{item.description}</p>
                    <div className="flex items-center gap-2">
                      {cartItem ? (
                        <>
                          <button onClick={() => removeFromCart(item.id)} className="bg-gray-100 hover:bg-gray-200 rounded-lg p-2 transition-all">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-bold w-8 text-center">{cartItem.qty}</span>
                          <button onClick={() => addToCart(item)} className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg p-2 transition-all">
                            <Plus className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => addToCart(item)} className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg py-2 text-sm font-semibold hover:shadow-lg transition-all">
                          Ajouter
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Panier coulissant — mobile-friendly */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex">
          {/* Overlay (z-10) — clique pour fermer */}
          <div
            className="absolute inset-0 bg-black/50 z-10"
            onClick={() => setShowCart(false)}
          />
          {/* Panier (z-20) — au-dessus de l'overlay pour recevoir les clics */}
          <div
            className="relative ml-auto w-full max-w-md bg-white h-full flex flex-col shadow-2xl z-20"
            style={{ touchAction: "manipulation" }}
          >
            {/* Header fixe */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold">{t('cart.title')} — {t('cart.table')} {tableNumber}</h2>
              <button onClick={() => setShowCart(false)} className="p-2 hover:bg-white/20 rounded-full" aria-label="Fermer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-center text-gray-500 py-8">{t('cart.empty')}</p>
              ) : (
                <>
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{item.name}</p>
                        <p className="text-sm text-gray-500">{formatPrice(Number(item.price))} × {item.qty}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => removeFromCart(item.id)} className="bg-gray-200 rounded-lg p-2" aria-label="Retirer">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-bold w-6 text-center">{item.qty}</span>
                        <button onClick={() => addToCart(item)} className="bg-orange-500 text-white rounded-lg p-2" aria-label="Ajouter">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="font-bold text-orange-600 w-20 text-right text-sm">{formatPrice(Number(item.price) * item.qty)}</span>
                    </div>
                  ))}

                  {/* Infos client */}
                  <div className="pt-4 space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">{t('auth.name')} (optionnel)</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder="Votre nom"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Téléphone (pour paiement mobile)</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+224 ..."
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">{t('order.payment.cash').includes('Cash') ? 'Payment method' : 'Mode de paiement'}</label>
                      <select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value as typeof paymentMethod)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="cash">{t('order.payment.cash')}</option>
                        <option value="orange_money">{t('order.payment.orange_money')}</option>
                        <option value="mtn_money">{t('order.payment.mtn_money')}</option>
                        <option value="wave">{t('order.payment.wave')}</option>
                        <option value="card">{t('order.payment.card')}</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer fixe avec Total + Bouton Commander — toujours visible */}
            {cart.length > 0 && (
              <div className="border-t bg-white p-4 flex-shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-lg font-bold">{t('cart.total')}</span>
                  <span className="text-2xl font-extrabold text-orange-600">{formatPrice(cartTotal)}</span>
                </div>
                <button
                  onClick={submitOrder}
                  disabled={submitting}
                  style={{ minHeight: "52px", WebkitTapHighlightColor: "transparent" }}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <><RefreshCw className="w-5 h-5 animate-spin" /> Envoi...</>
                  ) : (
                    <><CreditCard className="w-5 h-5" /> {t('cart.checkout')} — {t('cart.table')} {tableNumber}</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
