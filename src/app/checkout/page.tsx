"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { RefreshCw, CreditCard, MapPin, Phone, Bike, ShoppingBag, Utensils, CheckCircle2, ArrowLeft, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { publicApiFetch } from "@/lib/public-api";
import { formatPrice } from "@/lib/constants";

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><RefreshCw className="w-8 h-8 animate-spin text-orange-500" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { customer, apiFetch } = useAuth();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [orderType, setOrderType] = useState<"delivery" | "takeaway" | "dine_in">("delivery");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ orderId: string; points: number } | null>(null);

  // Form fields
  const [deliveryAddress, setDeliveryAddress] = useState(customer?.address || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [customerName, setCustomerName] = useState(customer?.name || "");
  const [tableNumber, setTableNumber] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "orange_money" | "mtn_money" | "wave" | "card">("cash");
  // 💰 Mission P2.5 — Tip (pourboire) state
  const [tipPercent, setTipPercent] = useState<number>(0); // 0, 5, 10, 15, or custom
  const [customTip, setCustomTip] = useState<string>(""); // custom amount in GNF

  // 🎟️ Mission P2.6 — Promo code state
  const [promoCode, setPromoCode] = useState<string>("");
  const [promoValidation, setPromoValidation] = useState<{
    valid: boolean;
    code?: string;
    description?: string;
    discountType?: string;
    discountValue?: number;
    discountAmount?: number;
    newTotal?: number;
    error?: string;
  } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    const storedCart = sessionStorage.getItem("kfm-cart");
    const storedTotal = sessionStorage.getItem("kfm-cart-total");
    const storedType = sessionStorage.getItem("kfm-order-type");

    if (!storedCart) {
      router.push("/");
      return;
    }

    setCart(JSON.parse(storedCart));
    setCartTotal(Number(storedTotal || 0));
    if (storedType) setOrderType(storedType as "delivery" | "takeaway" | "dine_in");
  }, [router]);

  // ── Mission 11.7: pull table QR token from sessionStorage if set ──
  // The MenuSection component sets this when the customer came via a QR scan.
  const tableQrToken = typeof window !== "undefined"
    ? sessionStorage.getItem("kfm-checkout-table-token") || ""
    : "";

  const loyaltyPoints = Math.floor(cartTotal / 1000);

  // 🎟️ Mission P2.6 — Promo discount
  const promoDiscount = promoValidation?.valid ? (promoValidation.discountAmount || 0) : 0;
  const cartAfterPromo = Math.max(0, cartTotal - promoDiscount);

  // 💰 Mission P2.5 — Tip calculation (based on cart AFTER promo discount)
  // tipPercent is 0, 5, 10, or 15. If customTip is non-empty, it
  // overrides the percentage. The backend clamps to [0, 50% of total].
  const calculatedTip = customTip.trim() !== ""
    ? Math.max(0, parseInt(customTip, 10) || 0)
    : Math.round(cartAfterPromo * (tipPercent / 100));
  const grandTotal = cartAfterPromo + calculatedTip;

  // 🎟️ Mission P2.6 — Validate promo code via API
  const validatePromo = async () => {
    if (!promoCode.trim()) {
      setPromoValidation(null);
      return;
    }
    setPromoLoading(true);
    try {
      const res = await publicApiFetch("/api/promo-codes/validate", {
        method: "POST",
        body: JSON.stringify({ code: promoCode.trim(), cartTotal }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setPromoValidation(data);
        toast.success(`Code "${data.code}" appliqué — ${data.discountAmount.toLocaleString("fr-FR")} GNF de remise`);
      } else {
        setPromoValidation({ valid: false, error: data.error || "Code invalide" });
        toast.error(data.error || "Code promo invalide");
      }
    } catch {
      setPromoValidation({ valid: false, error: "Erreur de validation" });
      toast.error("Erreur de validation du code promo");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const orderItems = cart.map(item => ({
        name: item.name,
        price: Number(item.price),
        qty: item.qty,
      }));

      // ── Mission 11.15: idempotency key ──
      // Prevents accidental double-submit (e.g. network glitch + retry).
      // The backend looks up this key in the order.note field.
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const body = {
        items: JSON.stringify(orderItems),
        total: cartTotal, // subtotal (without tip/discount) — server recalculates
        tip: calculatedTip, // Mission P2.5: pourboire
        promoCode: promoValidation?.valid ? promoValidation.code : undefined, // Mission P2.6
        orderType,
        customerName: customerName || customer?.name || "Client",
        phone,
        paymentMethod,
        ...(orderType === "delivery" && { deliveryAddress }),
        ...(orderType === "dine_in" && { tableNumber }),
        // Attach the table QR token so the backend resolves the real
        // restaurant/table. The backend NEVER trusts client-sent
        // restaurantId — it always re-resolves from the token.
        ...(tableQrToken && { tableQrToken }),
        idempotencyKey,
      };

      const res = await publicApiFetch("/api/orders", {
        method: "POST",
        headers: {
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Erreur lors de la commande");
        return;
      }

      // If customer is logged in, link the order to their account
      if (customer) {
        try {
          await apiFetch(`/api/orders`, {
            method: "PATCH",
            body: JSON.stringify({ id: data.id, customerId: customer.id }),
          });
        } catch { /* non-blocking */ }
      }

      // Clear cart + table context
      sessionStorage.removeItem("kfm-cart");
      sessionStorage.removeItem("kfm-cart-total");
      sessionStorage.removeItem("kfm-order-type");
      sessionStorage.removeItem("kfm-checkout-table-token");

      setSuccess({ orderId: data.id, points: loyaltyPoints });
      toast.success("Commande passée avec succès !");
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="shadow-2xl">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Commande confirmée !</h2>
              <p className="text-gray-500 mb-4">N° {success.orderId.slice(-8).toUpperCase()}</p>

              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">Vous avez gagné</p>
                <p className="text-3xl font-bold text-orange-600">{success.points} points</p>
                <p className="text-xs text-gray-500">de fidélité sur cette commande</p>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={() => router.push("/client")}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl py-6"
                >
                  Suivre ma commande
                </Button>
                <Button
                  onClick={() => router.push("/")}
                  variant="outline"
                  className="w-full rounded-xl py-6"
                >
                  Retour au menu
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const orderTypeLabels = {
    delivery: { label: "Livraison", icon: Bike },
    takeaway: { label: "À emporter", icon: ShoppingBag },
    dine_in: { label: "Sur place", icon: Utensils },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Back button */}
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-gray-500 hover:text-orange-600 mb-6">
          <ArrowLeft className="w-4 h-4" /> Retour au menu
        </button>

        {/* Customer status */}
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10 mb-6">
          <CardContent className="p-4 flex items-center gap-3">
            {customer ? (
              <>
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{customer.name}</p>
                  <p className="text-xs text-gray-500">{customer.email} · {customer.loyaltyPoints || 0} pts fidélité</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 dark:text-gray-300">Pas encore connecté ?</p>
                </div>
                <Button size="sm" onClick={() => router.push("/client/login?redirect=/checkout")} className="bg-orange-500 text-white rounded-lg">
                  Se connecter
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Order summary */}
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Récapitulatif</h2>
              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                {orderTypeLabels[orderType].label}
              </Badge>
            </div>
            <div className="space-y-2 mb-4">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{item.qty}× {item.name}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatPrice(Number(item.price) * item.qty)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="text-lg font-bold text-gray-900 dark:text-white">Sous-total</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">{formatPrice(cartTotal)}</span>
            </div>

            {/* 🎟️ Mission P2.6 — Promo code */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Code promo <span className="text-gray-400">(optionnel)</span>
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    setPromoValidation(null);
                  }}
                  placeholder="BIENVENUE10"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono uppercase"
                />
                <button
                  type="button"
                  onClick={validatePromo}
                  disabled={promoLoading || !promoCode.trim()}
                  className="px-4 py-2 text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {promoLoading ? "..." : "Appliquer"}
                </button>
              </div>
              {promoValidation?.valid && (
                <div className="mt-2 flex items-center justify-between text-sm bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                  <span className="text-green-700 dark:text-green-400 font-medium">
                    ✓ {promoValidation.code}
                    {promoValidation.description ? ` — ${promoValidation.description}` : ""}
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-bold">
                    -{formatPrice(promoValidation.discountAmount || 0)}
                  </span>
                </div>
              )}
              {promoValidation && !promoValidation.valid && (
                <p className="mt-2 text-xs text-red-500">✗ {promoValidation.error}</p>
              )}
            </div>

            {/* Promo discount line (if applied) */}
            {promoDiscount > 0 && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Remise promo</span>
                <span className="font-medium text-red-500">-{formatPrice(promoDiscount)}</span>
              </div>
            )}

            {/* 💰 Mission P2.5 — Tip selector */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Pourboire <span className="text-gray-400">(optionnel)</span>
              </p>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[0, 5, 10, 15].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => { setTipPercent(pct); setCustomTip(""); }}
                    className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                      tipPercent === pct && customTip === ""
                        ? "bg-orange-500 text-white shadow-md"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {pct === 0 ? "Aucun" : `${pct}%`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Ou montant libre :</span>
                <input
                  type="number"
                  min={0}
                  value={customTip}
                  onChange={(e) => {
                    setCustomTip(e.target.value);
                    setTipPercent(0);
                  }}
                  placeholder="0"
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-xs text-gray-500">GNF</span>
              </div>
              {calculatedTip > 0 && (
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Pourboire</span>
                  <span className="font-medium text-green-600 dark:text-green-400">+{formatPrice(calculatedTip)}</span>
                </div>
              )}
            </div>

            {/* Grand total (subtotal + tip) */}
            {calculatedTip > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900 dark:text-white">Total à payer</span>
                <span className="text-2xl font-extrabold text-orange-600">{formatPrice(grandTotal)}</span>
              </div>
            )}
            <div className="mt-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 text-center">
              <p className="text-sm text-orange-600 dark:text-orange-400">
                💎 +{loyaltyPoints} points de fidélité sur cette commande
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Checkout form */}
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Finaliser la commande</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Nom complet *</Label>
                <Input
                  required
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Votre nom"
                  className="rounded-xl mt-1"
                />
              </div>

              {/* Phone */}
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Téléphone *</Label>
                <Input
                  required
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+224 6XX XX XX XX"
                  className="rounded-xl mt-1"
                />
              </div>

              {/* Delivery address (only for delivery) */}
              {orderType === "delivery" && (
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Adresse de livraison *</Label>
                  <Input
                    required
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder="Quartier, rue, repère..."
                    className="rounded-xl mt-1"
                  />
                </div>
              )}

              {/* Table number (only for dine_in) */}
              {orderType === "dine_in" && (
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Numéro de table *</Label>
                  <Input
                    required
                    type="number"
                    min={1}
                    max={200}
                    value={tableNumber || ""}
                    onChange={e => setTableNumber(parseInt(e.target.value) || 0)}
                    placeholder="Ex: 5"
                    className="rounded-xl mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Le numéro de table est indiqué sur le QR code de votre table.</p>
                </div>
              )}

              {/* Payment method */}
              <div>
                <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Mode de paiement</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "cash", label: "Espèces" },
                    { value: "orange_money", label: "Orange Money" },
                    { value: "mtn_money", label: "MTN MoMo" },
                    { value: "wave", label: "Wave" },
                  ].map(method => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPaymentMethod(method.value as typeof paymentMethod)}
                      className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                        paymentMethod === method.value
                          ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl py-6 text-lg font-bold"
              >
                {loading ? (
                  <><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Envoi...</>
                ) : (
                  <><CreditCard className="w-5 h-5 mr-2" /> Commander — {formatPrice(grandTotal)}</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
