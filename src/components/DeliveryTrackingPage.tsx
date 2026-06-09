"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, UtensilsCrossed, Package, Navigation, Truck,
  ChevronLeft, Radio, XCircle, Phone, MessageCircle, MapPin,
  CreditCard, Timer, Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DeliveryMap } from "@/components/DeliveryMap";
import type { OrderDB, DriverDB } from "@/lib/types";
import { RESTO, vehicleLabels, paymentLabels, formatPrice } from "@/lib/constants";
import { useAuth } from "@/lib/auth-context";

const DELIVERY_STEPS = [
  { id: "confirmed", label: "Commande reçue", icon: CheckCircle2, desc: "Votre commande a été confirmée" },
  { id: "preparing", label: "En préparation", icon: UtensilsCrossed, desc: "Le chef prépare votre commande" },
  { id: "ready", label: "Prêt", icon: Package, desc: "Votre commande est prête" },
  { id: "picking_up", label: "Livreur en route", icon: Navigation, desc: "Le livreur se dirige vers le restaurant" },
  { id: "delivering", label: "En livraison", icon: Truck, desc: "Votre commande est en route" },
  { id: "delivered", label: "Livré", icon: CheckCircle2, desc: "Votre commande a été livrée !" },
];

function getStepIndex(status: string) {
  const idx = DELIVERY_STEPS.findIndex(s => s.id === status);
  if (status === "pending") return -1;
  if (status === "cancelled") return -2;
  return idx;
}

// Restaurant location
const RESTO_LAT = 9.5092;
const RESTO_LNG = -13.7122;

// Generate a simulated destination based on delivery address
function getDestinationFromAddress(address: string): { lat: number; lng: number } {
  // Generate a deterministic but varied position based on address string
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) - hash) + address.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);
  const lat = 9.48 + (absHash % 1000) / 1000 * 0.10;
  const lng = -13.75 + ((absHash >> 10) % 1000) / 1000 * 0.13;
  return { lat, lng };
}

export function DeliveryTrackingPage({ trackingOrder, onBack }: { trackingOrder: OrderDB; onBack: () => void }) {
  const { apiFetch } = useAuth();
  const [order, setOrder] = useState<OrderDB>(trackingOrder);
  const [driverData, setDriverData] = useState<DriverDB | null>(trackingOrder.driver);
  const [showMap, setShowMap] = useState(true);

  // Poll for updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tracking?orderId=${order.id}`);
        if (res.ok) {
          const updated = await res.json();
          setOrder(updated);
          if (updated.driver) setDriverData(updated.driver);
        }
      } catch { /* silently retry */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [order.id]);

  // Also poll driver location if there's a driver
  useEffect(() => {
    if (!order.driverId) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/driver-location?driverId=${order.driverId}`);
        if (res.ok) {
          const data = await res.json();
          if (data && !Array.isArray(data)) {
            setDriverData(prev => prev ? { ...prev, lat: data.lat, lng: data.lng, lastLocationUpdate: data.lastLocationUpdate } : prev);
          }
        }
      } catch { /* silently retry */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [order.driverId, apiFetch]);

  const stepIdx = getStepIndex(order.status);
  const isCancelled = order.status === "cancelled";
  const isDelivered = order.status === "delivered";
  let items: { name: string; price: number; qty: number }[] = [];
  try { items = JSON.parse(order.items); } catch { /* */ }

  // Simulated progress percentage
  const progressPercent = isCancelled ? 0 : isDelivered ? 100 : stepIdx >= 0 ? Math.round(((stepIdx + 1) / DELIVERY_STEPS.length) * 100) : 5;

  // Destination for map
  const dest = order.deliveryAddress ? getDestinationFromAddress(order.deliveryAddress) : null;

  // Drivers array for the map (just the one driver if available)
  const mapDrivers = driverData ? [driverData] : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={onBack} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
            <div className="flex-1"><h1 className="text-lg font-bold">Suivi de livraison</h1><p className="text-xs opacity-80">{RESTO.name}</p></div>
            <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span className="text-xs font-medium">En direct</span>
            </div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-80">Commande #{order.id.slice(-6).toUpperCase()}</span>
              <Badge className={`${isCancelled ? "bg-red-500" : isDelivered ? "bg-green-500" : "bg-white/20"} text-white text-xs`}>
                {isCancelled ? "Annulée" : isDelivered ? "Livrée" : "En cours"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>{order.customerName}</span>
              <span>{new Date(order.createdAt).toLocaleString("fr-FR")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Live Map */}
        {(order.status === "picking_up" || order.status === "delivering") && showMap && (
          <Card className="border-none shadow-md overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-b dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-400">
                  <Map className="w-4 h-4" />
                  Position du livreur
                </div>
                <button onClick={() => setShowMap(false)} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Masquer</button>
              </div>
              <DeliveryMap
                drivers={mapDrivers}
                orders={[order]}
                apiFetch={apiFetch}
                focusDriverId={order.driverId || undefined}
                destinationLat={dest?.lat}
                destinationLng={dest?.lng}
                simple
                className="border-0 shadow-none rounded-none"
              />
            </CardContent>
          </Card>
        )}

        {!showMap && (order.status === "picking_up" || order.status === "delivering") && (
          <Button size="sm" variant="outline" onClick={() => setShowMap(true)} className="w-full border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400">
            <Map className="w-4 h-4 mr-2" /> Afficher la carte
          </Button>
        )}

        {/* Progress Bar */}
        {!isCancelled && (
          <Card className="border-none shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Progression</span>
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{progressPercent}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card className="border-none shadow-md dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">État de votre commande</h3>
            {isCancelled ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3"><XCircle className="w-8 h-8 text-red-500" /></div>
                <p className="font-semibold text-red-600 dark:text-red-400">Commande annulée</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Votre commande a été annulée. Contactez-nous pour plus d&apos;informations.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {DELIVERY_STEPS.map((step, idx) => {
                  const isCompleted = idx <= stepIdx;
                  const isCurrent = idx === stepIdx;
                  const isPending = idx > stepIdx;
                  return (
                    <div key={step.id} className="flex gap-3">
                      {/* Timeline line & dot */}
                      <div className="flex flex-col items-center">
                        <motion.div initial={{ scale: 0.8 }} animate={{ scale: isCurrent ? 1.1 : 1 }} className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${isCompleted ? "bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30" : isPending ? "bg-gray-100 dark:bg-gray-700 text-gray-400" : "bg-gray-100 dark:bg-gray-700 text-gray-400"}`}>
                          <step.icon className="w-5 h-5" />
                        </motion.div>
                        {idx < DELIVERY_STEPS.length - 1 && (
                          <div className={`w-0.5 h-12 transition-colors ${idx < stepIdx ? "bg-orange-400" : "bg-gray-200 dark:bg-gray-700"}`} />
                        )}
                      </div>
                      {/* Content */}
                      <div className={`pb-6 ${idx === DELIVERY_STEPS.length - 1 ? "pb-0" : ""}`}>
                        <p className={`font-medium text-sm ${isCompleted ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}`}>{step.label}</p>
                        <p className={`text-xs mt-0.5 ${isCurrent ? "text-orange-600 dark:text-orange-400" : "text-gray-400 dark:text-gray-500"}`}>{step.desc}</p>
                        {isCurrent && order.status === "delivering" && driverData && (
                          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center"><Truck className="w-4 h-4 text-white" /></div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{driverData.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{driverData.phone} • {vehicleLabels[driverData.vehicle]}</p>
                              </div>
                              <a href={`tel:${driverData.phone}`} className="ml-auto p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 transition-colors"><Phone className="w-4 h-4" /></a>
                            </div>
                          </motion.div>
                        )}
                        {isCurrent && (order.status === "picking_up" || order.status === "delivering") && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
                            <Navigation className="w-3 h-3 animate-pulse" /> Position du livreur mise à jour en direct
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card className="border-none shadow-md dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Détails de la commande</h3>
            <div className="space-y-2">
              {items.map((item, j) => (
                <div key={j} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{item.qty}x {item.name}</span>
                  <span className="font-medium dark:text-gray-200">{formatPrice(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="flex justify-between font-bold dark:text-gray-100"><span>Total</span><span className="text-orange-600 dark:text-orange-400">{formatPrice(order.total)}</span></div>
            {order.deliveryAddress && (
              <div className="mt-3 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-orange-500" />
                <span>{order.deliveryAddress}</span>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <CreditCard className="w-3.5 h-3.5" /> {paymentLabels[order.paymentMethod] || order.paymentMethod}
            </div>
          </CardContent>
        </Card>

        {/* ETA */}
        {!isCancelled && !isDelivered && (order.status === "delivering" || order.status === "picking_up") && (
          <Card className="border-none shadow-md bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Timer className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Arrivée estimée</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {order.estimatedDeliveryTime ? new Date(order.estimatedDeliveryTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "~30 min"}
                  </p>
                </div>
                <div className="ml-auto">
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-4 h-4 bg-green-500 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact */}
        <Card className="border-none shadow-md dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Besoin d&apos;aide ?</h3>
            <div className="grid grid-cols-2 gap-2">
              <a href={`tel:${RESTO.phone}`} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"><Phone className="w-4 h-4" /> Appeler</a>
              <a href={`https://wa.me/${RESTO.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-800 transition-colors text-sm font-medium text-green-700 dark:text-green-400"><MessageCircle className="w-4 h-4" /> WhatsApp</a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
