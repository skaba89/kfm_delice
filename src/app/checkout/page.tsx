"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  ShoppingBag,
  Utensils,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { publicApiFetch } from "@/lib/public-api";
import { formatPrice } from "@/lib/constants";
import { computeCheckoutPricing } from "@/lib/checkout-pricing";

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

type OrderType = "delivery" | "takeaway" | "dine_in";
type PaymentMethod = "cash" | "orange_money" | "mtn_money" | "wave" | "card";

interface PromoValidation {
  valid: boolean;
  code?: string;
  description?: string;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
  newTotal?: number;
  error?: string;
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={(
        <div className="min-h-screen flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      )}
    >
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const { customer, apiFetch } = useAuth();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ orderId: string; paymentMessage?: string } | null>(null);
  const [tableQrToken, setTableQrToken] = useState("");

  const [deliveryAddress, setDeliveryAddress] = useState(customer?.address || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [customerName, setCustomerName] = useState(customer?.name || "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [tipPercent, setTipPercent] = useState(0);
  const [customTip, setCustomTip] = useState("");

  const [promoCode, setPromoCode] = useState("");
  const [promoValidation, setPromoValidation] = useState<PromoValidation | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const [restaurantRules, setRestaurantRules] = useState({ deliveryFee: 0, minDelivery: 0 });
  const [restaurantRulesLoading, setRestaurantRulesLoading] = useState(true);
  const [restaurantRulesError, setRestaurantRulesError] = useState(false);

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
    if (storedType) setOrderType(storedType as OrderType);
    setTableQrToken(sessionStorage.getItem("kfm-checkout-table-token") || "");

    const cartFingerprint = `${storedCart}|${storedType || "delivery"}`;
    const previousFingerprint = sessionStorage.getItem("kfm-order-idempotency-cart");
    if (previousFingerprint !== cartFingerprint) {
      sessionStorage.removeItem("kfm-order-idempotency-key");
      sessionStorage.setItem("kfm-order-idempotency-cart", cartFingerprint);
    }
  }, [router]);

  useEffect(() => {
    if (customer) {
      setCustomerName((value) => value || customer.name || "");
      setPhone((value) => value || customer.phone || "");
      setDeliveryAddress((value) => value || customer.address || "");
    }
  }, [customer]);

  useEffect(() => {
    let cancelled = false;
    setRestaurantRulesLoading(true);
    setRestaurantRulesError(false);

    publicApiFetch("/api/restaurant")
      .then(async (response) => {
        if (!response.ok) throw new Error(`restaurant ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setRestaurantRules({
          deliveryFee: Math.max(0, Number(data.deliveryFee || 0)),
          minDelivery: Math.max(0, Number(data.minDelivery || 0)),
        });
      })
      .catch(() => {
        if (!cancelled) setRestaurantRulesError(true);
      })
      .finally(() => {
        if (!cancelled) setRestaurantRulesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const promoDiscount = promoValidation?.valid ? (promoValidation.discountAmount || 0) : 0;
  const pricing = computeCheckoutPricing({
    subtotal: cartTotal,
    promoDiscount,
    deliveryFee: restaurantRules.deliveryFee,
    minDelivery: restaurantRules.minDelivery,
    orderType,
    tipPercent,
    customTip: customTip.trim() ? (parseInt(customTip, 10) || 0) : null,
  });

  const validatePromo = async () => {
    if (!promoCode.trim()) {
      setPromoValidation(null);
      return;
    }

    setPromoLoading(true);
    try {
      const response = await publicApiFetch("/api/promo-codes/validate", {
        method: "POST",
        body: JSON.stringify({ code: promoCode.trim(), cartTotal }),
      });
      const data = await response.json();
      if (response.ok && data.valid) {
        setPromoValidation(data);
        toast.success(
          `Code "${data.code}" appliqué — ${Number(data.discountAmount || 0).toLocaleString("fr-FR")} GNF de remise`
        );
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

  const getOrCreateOrderIdempotencyKey = () => {
    const existing = sessionStorage.getItem("kfm-order-idempotency-key");
    if (existing) return existing;

    const key = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("kfm-order-idempotency-key", key);
    return key;
  };

  const clearCheckoutSession = () => {
    sessionStorage.removeItem("kfm-cart");
    sessionStorage.removeItem("kfm-cart-total");
    sessionStorage.removeItem("kfm-order-type");
    sessionStorage.removeItem("kfm-checkout-table-token");
    sessionStorage.removeItem("kfm-order-idempotency-key");
    sessionStorage.removeItem("kfm-order-idempotency-cart");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (orderType === "delivery" && restaurantRulesError) {
      toast.error("Tarification de livraison indisponible. Réessayez dans un instant.");
      return;
    }
    if (orderType === "delivery" && !pricing.deliveryMinimumMet) {
      toast.error(`Minimum de livraison non atteint. Ajoutez ${formatPrice(pricing.deliveryMinimumMissing)} au panier.`);
      return;
    }
    if (paymentMethod !== "cash" && !customer) {
      toast.error("Connectez-vous pour initier un paiement électronique.");
      router.push("/client/login?redirect=/checkout");
      return;
    }

    setLoading(true);
    try {
      const idempotencyKey = getOrCreateOrderIdempotencyKey();
      const body = {
        items: cart.map((item) => ({ menuItemId: item.id, quantity: item.qty })),
        tip: pricing.tip,
        promoCode: promoValidation?.valid ? promoValidation.code : undefined,
        orderType,
        customerName: customerName || customer?.name || "Client",
        phone,
        paymentMethod,
        ...(orderType === "delivery" && { deliveryAddress }),
        ...(tableQrToken && { tableQrToken }),
        idempotencyKey,
      };

      // Connected customers MUST send their JWT on the creation request so
      // customerId is bound server-side in the same order transaction.
      const orderRequest = customer ? apiFetch : publicApiFetch;
      const response = await orderRequest("/api/orders", {
        method: "POST",
        headers: { "x-idempotency-key": idempotencyKey },
        body: JSON.stringify(body),
      });
      const order = await response.json();

      if (!response.ok) {
        if (order.code === "IDEMPOTENCY_HASH_MISMATCH") {
          sessionStorage.removeItem("kfm-order-idempotency-key");
          toast.error("La commande a changé depuis la tentative précédente. Réessayez pour créer une nouvelle tentative.");
        } else {
          toast.error(order.error || "Erreur lors de la commande");
        }
        return;
      }

      let paymentMessage = paymentMethod === "cash"
        ? "Paiement en espèces à confirmer par le restaurant."
        : undefined;

      if (paymentMethod !== "cash") {
        const paymentKey = `checkout-${order.id}-${paymentMethod}`;
        const paymentResponse = await apiFetch("/api/payment", {
          method: "POST",
          headers: { "x-idempotency-key": paymentKey },
          body: JSON.stringify({
            orderId: order.id,
            method: paymentMethod,
            phone,
            customerName: customerName || customer?.name || "Client",
            idempotencyKey: paymentKey,
          }),
        });
        const payment = await paymentResponse.json();

        if (!paymentResponse.ok) {
          paymentMessage = `Commande créée, mais le paiement n'a pas pu être initié : ${payment.error || "service indisponible"}.`;
          toast.error(paymentMessage);
        } else {
          paymentMessage = payment.message || "Paiement initié. Confirmez l'opération auprès du fournisseur.";
          if (payment.paymentUrl) {
            clearCheckoutSession();
            window.location.assign(payment.paymentUrl);
            return;
          }
        }
      }

      clearCheckoutSession();
      setSuccess({ orderId: order.id, paymentMessage });
      toast.success("Commande créée avec succès !");
    } catch {
      toast.error("Erreur de connexion. Vous pouvez réessayer sans créer de doublon.");
    } finally {
      setLoading(false);
    }
  };

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

              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Fidélité</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Les points sont calculés et crédités uniquement après la livraison effective de la commande.
                </p>
                {success.paymentMessage && (
                  <p className="text-xs text-gray-700 dark:text-gray-300 mt-3">{success.paymentMessage}</p>
                )}
              </div>

              <div className="space-y-2">
                <Button
                  onClick={() => router.push("/client")}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl py-6"
                >
                  Suivre ma commande
                </Button>
                <Button onClick={() => router.push("/")} variant="outline" className="w-full rounded-xl py-6">
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

  const orderTypeLabels: Record<OrderType, { label: string; icon: typeof Bike }> = {
    delivery: { label: "Livraison", icon: Bike },
    takeaway: { label: "À emporter", icon: ShoppingBag },
    dine_in: { label: "Sur place", icon: Utensils },
  };

  const paymentMethods: { value: PaymentMethod; label: string }[] = [
    { value: "cash", label: "Espèces" },
    { value: "orange_money", label: "Orange Money" },
    { value: "mtn_money", label: "MTN MoMo" },
    { value: "wave", label: "Wave" },
    { value: "card", label: "Carte" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-gray-500 hover:text-orange-600 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Retour au menu
        </button>

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
                  <p className="text-sm text-gray-700 dark:text-gray-300">Connectez-vous pour payer en ligne et suivre la commande.</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => router.push("/client/login?redirect=/checkout")}
                  className="bg-orange-500 text-white rounded-lg"
                >
                  Se connecter
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Récapitulatif</h2>
              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                {orderTypeLabels[orderType].label}
              </Badge>
            </div>

            <div className="space-y-2 mb-4">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{item.qty}× {item.name}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatPrice(Number(item.price) * item.qty)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 flex items-center justify-between">
              <span className="text-lg font-bold text-gray-900 dark:text-white">Sous-total</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">{formatPrice(cartTotal)}</span>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Code promo <span className="text-gray-400">(optionnel)</span>
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(event) => {
                    setPromoCode(event.target.value.toUpperCase());
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

            {promoDiscount > 0 && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Remise promo</span>
                <span className="font-medium text-red-500">-{formatPrice(promoDiscount)}</span>
              </div>
            )}

            {orderType === "delivery" && (
              <>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Frais de livraison</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {restaurantRulesLoading
                      ? "…"
                      : restaurantRulesError
                        ? "Indisponible"
                        : formatPrice(pricing.deliveryFee)}
                  </span>
                </div>
                {!restaurantRulesLoading && !restaurantRulesError && restaurantRules.minDelivery > 0 && (
                  <div
                    className={`mt-2 text-xs rounded-lg px-3 py-2 ${
                      pricing.deliveryMinimumMet
                        ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                        : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                    }`}
                  >
                    {pricing.deliveryMinimumMet
                      ? `Minimum livraison atteint (${formatPrice(restaurantRules.minDelivery)}).`
                      : `Minimum livraison : ${formatPrice(restaurantRules.minDelivery)} — ajoutez ${formatPrice(pricing.deliveryMinimumMissing)}.`}
                  </div>
                )}
              </>
            )}

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Pourboire <span className="text-gray-400">(optionnel)</span>
              </p>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[0, 5, 10, 15].map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    onClick={() => {
                      setTipPercent(percent);
                      setCustomTip("");
                    }}
                    className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                      tipPercent === percent && customTip === ""
                        ? "bg-orange-500 text-white shadow-md"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {percent === 0 ? "Aucun" : `${percent}%`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Ou montant libre :</span>
                <input
                  type="number"
                  min={0}
                  max={pricing.maxTip}
                  value={customTip}
                  onChange={(event) => {
                    setCustomTip(event.target.value);
                    setTipPercent(0);
                  }}
                  placeholder="0"
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-xs text-gray-500">GNF</span>
              </div>
              {pricing.tip > 0 && (
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Pourboire</span>
                  <span className="font-medium text-green-600 dark:text-green-400">+{formatPrice(pricing.tip)}</span>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-lg font-bold text-gray-900 dark:text-white">Total estimé</span>
              <span className="text-2xl font-extrabold text-orange-600">{formatPrice(pricing.total)}</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Le montant définitif est recalculé par le serveur à partir des prix et règles du restaurant.
            </p>
            <div className="mt-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 text-center">
              <p className="text-sm text-orange-600 dark:text-orange-400">
                💎 Les points de fidélité seront calculés et crédités après livraison.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Finaliser la commande</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Nom complet *</Label>
                <Input
                  required
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Votre nom"
                  className="rounded-xl mt-1"
                />
              </div>

              <div>
                <Label className="text-gray-700 dark:text-gray-300">Téléphone *</Label>
                <Input
                  required
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+224 6XX XX XX XX"
                  className="rounded-xl mt-1"
                />
              </div>

              {orderType === "delivery" && (
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Adresse de livraison *</Label>
                  <Input
                    required
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    placeholder="Quartier, rue, repère..."
                    className="rounded-xl mt-1"
                  />
                </div>
              )}

              {orderType === "dine_in" && (
                <div className="rounded-xl bg-orange-50 dark:bg-orange-900/20 px-4 py-3 text-sm text-orange-700 dark:text-orange-400">
                  {tableQrToken
                    ? "Table identifiée automatiquement par le QR code."
                    : "Commande sur place sans table liée. Pour identifier automatiquement une table, scannez son QR code."}
                </div>
              )}

              <div>
                <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Mode de paiement</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPaymentMethod(method.value)}
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

              <Button
                type="submit"
                disabled={
                  loading ||
                  restaurantRulesLoading ||
                  (orderType === "delivery" && (restaurantRulesError || !pricing.deliveryMinimumMet))
                }
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl py-6 text-lg font-bold"
              >
                {loading ? (
                  <><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Envoi...</>
                ) : (
                  <><CreditCard className="w-5 h-5 mr-2" /> Commander — {formatPrice(pricing.total)}</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
