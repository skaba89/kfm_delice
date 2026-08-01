"use client";

import { Plus, Minus, Trash2, ShoppingCart, ChevronRight, Navigation, RefreshCw, ShoppingBag, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { MenuItemDB } from "@/lib/types";
import { formatPrice, MENU_CATS, paymentLabels } from "@/lib/constants";
import type { CartItem, CheckoutForm } from "@/lib/hooks/use-customer-cart";

interface CustomerOrderingProps {
  menuItems: MenuItemDB[];
  cart: CartItem[];
  addToCart: (item: MenuItemDB) => void;
  removeFromCart: (itemId: string) => void;
  updateCartQty: (itemId: string, qty: number) => void;
  cartSubtotal: number;
  cartTotal: number;
  discountPercent: number;
  discountAmount: number;
  deliveryFee: number;
  orderCategoryFilter: string;
  setOrderCategoryFilter: (filter: string) => void;
  checkoutStep: "menu" | "cart" | "checkout";
  setCheckoutStep: (step: "menu" | "cart" | "checkout") => void;
  checkoutForm: CheckoutForm;
  setCheckoutForm: (form: CheckoutForm) => void;
  orderSubmitting: boolean;
  submitOrder: () => void;
}

export function CustomerOrdering({
  menuItems,
  cart,
  addToCart,
  removeFromCart,
  updateCartQty,
  cartSubtotal,
  cartTotal,
  discountPercent,
  discountAmount,
  deliveryFee,
  orderCategoryFilter,
  setOrderCategoryFilter,
  checkoutStep,
  setCheckoutStep,
  checkoutForm,
  setCheckoutForm,
  orderSubmitting,
  submitOrder,
}: CustomerOrderingProps) {
  return (
    <div className="space-y-4">
      {/* Loyalty discount banner */}
      {discountPercent > 0 && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Réduction fidélité de <strong>{discountPercent}%</strong> appliquée automatiquement !
          </p>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(["menu", "cart", "checkout"] as const).map((step, idx) => (
          <button key={step} onClick={() => { if (step === "menu" || (step === "cart" && cart.length > 0)) setCheckoutStep(step); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${checkoutStep === step ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}>
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">{idx + 1}</span>
            {step === "menu" ? "Menu" : step === "cart" ? `Panier (${cart.length})` : "Livraison"}
          </button>
        ))}
      </div>

      {checkoutStep === "menu" && (
        <>
          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant={orderCategoryFilter === "all" ? "default" : "outline"} onClick={() => setOrderCategoryFilter("all")} className={`text-xs rounded-lg ${orderCategoryFilter === "all" ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white" : "dark:border-gray-600"}`}>Tous</Button>
            {MENU_CATS.map(cat => (
              <Button key={cat.id} size="sm" variant={orderCategoryFilter === cat.id ? "default" : "outline"} onClick={() => setOrderCategoryFilter(cat.id)} className={`text-xs rounded-lg ${orderCategoryFilter === cat.id ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white" : "dark:border-gray-600"}`}>
                <cat.icon className="w-3 h-3 mr-1" /> {cat.name}
              </Button>
            ))}
          </div>

          {/* Menu items grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {menuItems
              .filter(m => m.available)
              .filter(m => orderCategoryFilter === "all" || m.category === orderCategoryFilter)
              .map(item => {
                const inCart = cart.find(c => c.item.id === item.id);
                return (
                  <Card key={item.id} className="dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-shadow overflow-hidden">
                    <CardContent className="p-0">
                      {/* Photo du plat (si disponible) */}
                      {item.image ? (
                        <div className="relative h-32 w-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                          {item.badge && (
                            <Badge className="absolute top-2 right-2 bg-amber-500/90 text-white text-[10px] backdrop-blur-sm">{item.badge}</Badge>
                          )}
                          {item.popular && (
                            <Badge className="absolute top-2 left-2 bg-orange-500/90 text-white text-[10px] backdrop-blur-sm">⭐ Populaire</Badge>
                          )}
                        </div>
                      ) : (
                        <div className="relative h-20 w-full bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                          <span className="text-3xl">🍽️</span>
                          {item.badge && (
                            <Badge className="absolute top-2 right-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">{item.badge}</Badge>
                          )}
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{item.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{item.description}</p>
                          </div>
                          {!item.image && item.badge && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] ml-2 shrink-0">{item.badge}</Badge>}
                        </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(item.price)}</span>
                        {inCart ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => updateCartQty(item.id, inCart.qty - 1)} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"><Minus className="w-3 h-3" /></button>
                            <span className="text-sm font-semibold w-6 text-center dark:text-gray-200">{inCart.qty}</span>
                            <button onClick={() => updateCartQty(item.id, inCart.qty + 1)} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"><Plus className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => addToCart(item)} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs rounded-lg h-7">
                            <Plus className="w-3 h-3 mr-1" /> Ajouter
                          </Button>
                        )}
                      </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
          {cart.length > 0 && (
            <div className="sticky bottom-4 z-20">
              <Button onClick={() => setCheckoutStep("cart")} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl shadow-lg h-12">
                <ShoppingCart className="w-5 h-5 mr-2" /> Voir le panier ({cart.reduce((s, c) => s + c.qty, 0)} articles) — {formatPrice(cartTotal + deliveryFee)}
              </Button>
            </div>
          )}
        </>
      )}

      {checkoutStep === "cart" && (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-emerald-500" /> Votre panier</h3>
            {cart.length === 0 ? (
              <div className="text-center py-6">
                <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Votre panier est vide</p>
                <Button size="sm" variant="outline" onClick={() => setCheckoutStep("menu")} className="mt-3 dark:border-gray-600">Voir le menu</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(c => (
                  <div key={c.item.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatPrice(c.item.price)} x {c.qty}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateCartQty(c.item.id, c.qty - 1)} className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center"><Minus className="w-3 h-3 text-gray-600 dark:text-gray-300" /></button>
                      <span className="text-sm font-semibold w-5 text-center dark:text-gray-200">{c.qty}</span>
                      <button onClick={() => updateCartQty(c.item.id, c.qty + 1)} className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center"><Plus className="w-3 h-3 text-gray-600 dark:text-gray-300" /></button>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 w-20 text-right">{formatPrice(c.item.price * c.qty)}</span>
                    <button onClick={() => removeFromCart(c.item.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-gray-400">Sous-total</span><span className="font-medium dark:text-gray-200">{formatPrice(cartSubtotal)}</span></div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-emerald-600 dark:text-emerald-400">Réduction fidélité ({discountPercent}%)</span><span className="font-medium text-emerald-600 dark:text-emerald-400">-{formatPrice(discountAmount)}</span></div>
                )}
                <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-gray-400">Frais de livraison</span><span className="font-medium dark:text-gray-200">{formatPrice(deliveryFee)}</span></div>
                <div className="flex justify-between font-bold text-lg"><span className="dark:text-gray-100">Total</span><span className="text-emerald-600 dark:text-emerald-400">{formatPrice(cartTotal + deliveryFee)}</span></div>
                <div className="flex gap-3 mt-4">
                  <Button variant="outline" onClick={() => setCheckoutStep("menu")} className="dark:border-gray-600">Retour au menu</Button>
                  <Button onClick={() => setCheckoutStep("checkout")} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                    <ChevronRight className="w-4 h-4 mr-1" /> Passer la commande
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {checkoutStep === "checkout" && (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><Navigation className="w-5 h-5 text-emerald-500" /> Commande</h3>
            <div className="space-y-4">
              {/* Order type selector */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Type de commande</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "dine_in", label: "Sur place", icon: "🍽️" },
                    { id: "takeaway", label: "À emporter", icon: "🥡" },
                    { id: "delivery", label: "Moto-taxi", icon: "🛵" },
                  ] as const).map(t => (
                    <button key={t.id} onClick={() => setCheckoutForm({ ...checkoutForm, orderType: t.id })} className={`p-3 rounded-xl border text-sm font-medium transition-colors ${checkoutForm.orderType === t.id ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-emerald-300"}`}>
                      <span className="block text-xl mb-1">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
                {checkoutForm.orderType === "delivery" && (
                  <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span>🛵</span> Livraison par moto-taxi — un livreur sera assigné rapidement.
                  </p>
                )}
              </div>

              {/* Conditional fields based on order type */}
              {checkoutForm.orderType === "delivery" && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Adresse de livraison *</label>
                  <Input value={checkoutForm.address} onChange={e => setCheckoutForm({ ...checkoutForm, address: e.target.value })} placeholder="Votre adresse à Conakry..." className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
                </div>
              )}
              {checkoutForm.orderType === "dine_in" && (
                <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Numéro de table *</label><Input type="number" min="1" value={checkoutForm.tableNumber} onChange={e => setCheckoutForm({ ...checkoutForm, tableNumber: e.target.value })} placeholder="Ex: 5" className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></div>
              )}
              {checkoutForm.orderType === "takeaway" && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-700 dark:text-amber-300">
                  🥡 À emporter — Votre commande sera prête à être récupérée au restaurant. Aucune adresse requise.
                </div>
              )}

              <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Téléphone *</label><Input type="tel" value={checkoutForm.phone} onChange={e => setCheckoutForm({ ...checkoutForm, phone: e.target.value })} placeholder="+224 6XX XXX XXX" className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></div>

              <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Mode de paiement</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["cash", "orange_money", "mtn_money", "wave"] as const).map(m => (
                    <button key={m} onClick={() => setCheckoutForm({ ...checkoutForm, paymentMethod: m })} className={`p-3 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${checkoutForm.paymentMethod === m ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-emerald-300"}`}>
                      {m === "cash" ? "💵" : m === "orange_money" ? "🟠" : m === "mtn_money" ? "🟡" : "🔵"} {paymentLabels[m]}
                    </button>
                  ))}
                </div>
                {(checkoutForm.paymentMethod === "orange_money" || checkoutForm.paymentMethod === "mtn_money" || checkoutForm.paymentMethod === "wave") && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    📱 Vous recevrez une notification sur votre téléphone pour confirmer le paiement.
                  </p>
                )}
              </div>
              <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Notes (optionnel)</label><Textarea value={checkoutForm.note} onChange={e => setCheckoutForm({ ...checkoutForm, note: e.target.value })} placeholder="Instructions spéciales..." rows={2} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-gray-400">Sous-total</span><span className="dark:text-gray-200">{formatPrice(cartSubtotal)}</span></div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-emerald-600 dark:text-emerald-400">Réduction fidélité ({discountPercent}%)</span><span className="text-emerald-600 dark:text-emerald-400">-{formatPrice(discountAmount)}</span></div>
                )}
                {checkoutForm.orderType === "delivery" && (
                  <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-gray-400">Livraison</span><span className="dark:text-gray-200">{formatPrice(deliveryFee)}</span></div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg"><span className="dark:text-gray-100">Total</span><span className="text-emerald-600 dark:text-emerald-400">{formatPrice(cartTotal + (checkoutForm.orderType === "delivery" ? deliveryFee : 0))}</span></div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setCheckoutStep("cart")} className="dark:border-gray-600">Retour</Button>
                <Button onClick={submitOrder} disabled={orderSubmitting || (checkoutForm.orderType === "delivery" ? !checkoutForm.address : checkoutForm.orderType === "dine_in" ? !checkoutForm.tableNumber : false)} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                  {orderSubmitting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ShoppingBag className="w-4 h-4 mr-2" />} Confirmer la commande
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
