"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import L from "leaflet";
import { RefreshCw, Package, MapPin, Phone, Clock, CheckCircle2, Bike, Store, Star, ChevronRight, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { formatPrice } from "@/lib/constants";
import { OrderTrackingMap } from "@/components/OrderTrackingMap";

interface Order {
  id: string;
  status: string;
  orderType: string;
  customerName: string;
  total: number;
  items: unknown;
  createdAt: string;
  estimatedDeliveryTime: string;
  paymentStatus: string;
  paymentMethod: string;
  timeline: Array<{ key: string; label: string; icon: string; done: boolean }>;
  driver: { name: string; phone: string; vehicle: string; rating: number; lat: number; lng: number } | null;
  restaurant: { name: string; address: string; phone: string; lat: number; lng: number };
  deliveryAddress: string;
  tableNumber: number;
}

const statusLabels: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready: "Prête",
  picking_up: "Récupération en cours",
  delivering: "En livraison",
  delivered: "Livrée ✓",
  cancelled: "Annulée",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  preparing: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  ready: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  picking_up: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  delivering: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function ClientOrderTracking({ orderId }: { orderId: string }) {
  const { apiFetch } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/orders/track/${orderId}`);
      if (!res.ok) return;
      const data = await res.json();
      setOrder(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [apiFetch, orderId]);

  useEffect(() => {
    fetchOrder();
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(fetchOrder, 5000);
    return () => clearInterval(interval);
  }, [fetchOrder]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return <p className="text-center text-gray-500 py-8">Commande non trouvée</p>;
  }

  const isActive = order.status !== "delivered" && order.status !== "cancelled";

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <Card className={`border-2 ${order.status === "delivered" ? "border-green-300 dark:border-green-500/30" : "border-orange-300 dark:border-orange-500/30"}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500">Commande N°</p>
              <p className="font-bold text-gray-900 dark:text-white">{order.id.slice(-8).toUpperCase()}</p>
            </div>
            <Badge className={`${statusColors[order.status] || ""} text-sm px-3 py-1`}>
              {statusLabels[order.status] || order.status}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Total</span>
            <span className="font-bold text-orange-600">{formatPrice(order.total)}</span>
          </div>
          {order.estimatedDeliveryTime && (
            <div className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 mt-2">
              <Clock className="w-4 h-4" />
              <span>Livraison estimée: {order.estimatedDeliveryTime}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Map (only if delivery + driver assigned) */}
      {order.driver && order.driver.lat && order.driver.lng && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 flex items-center gap-2">
              <Bike className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                  {order.driver.name} est en route !
                </p>
                <p className="text-xs text-gray-500">
                  {order.driver.vehicle === "moto" ? "🏍️ Moto" : order.driver.vehicle === "voiture" ? "🚗 Voiture" : "🚲 Vélo"}
                  · ⭐ {order.driver.rating?.toFixed(1) || "5.0"}
                </p>
              </div>
              <a href={`tel:${order.driver.phone}`}>
                <Button size="sm" variant="outline" className="rounded-full">
                  <Phone className="w-4 h-4 mr-1" /> Appeler
                </Button>
              </a>
            </div>
            <OrderTrackingMap
              driverLat={order.driver.lat}
              driverLng={order.driver.lng}
              restaurantLat={order.restaurant.lat}
              restaurantLng={order.restaurant.lng}
            />
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Suivi de votre commande</h3>
          <div className="space-y-3">
            {order.timeline.map((step, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                  step.done
                    ? "bg-green-100 dark:bg-green-900/30"
                    : order.timeline[idx]?.key === order.status
                      ? "bg-orange-100 dark:bg-orange-900/30 ring-2 ring-orange-400 animate-pulse"
                      : "bg-gray-100 dark:bg-gray-800"
                }`}>
                  {step.done ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <span>{step.icon}</span>}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    step.done
                      ? "text-gray-900 dark:text-white"
                      : order.timeline[idx]?.key === order.status
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-gray-400 dark:text-gray-600"
                  }`}>
                    {step.label}
                  </p>
                </div>
                {order.timeline[idx]?.key === order.status && isActive && (
                  <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Restaurant Info */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
            <Store className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{order.restaurant.name}</p>
            <p className="text-xs text-gray-500 truncate">{order.restaurant.address}</p>
          </div>
          <a href={`tel:${order.restaurant.phone}`}>
            <Button size="sm" variant="ghost" className="text-gray-400">
              <Phone className="w-4 h-4" />
            </Button>
          </a>
        </CardContent>
      </Card>

      {/* Items Summary */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Détails de la commande</h3>
          <div className="space-y-1">
            {Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>{item.qty}× {item.name}</span>
                <span>{formatPrice(Number(item.price) * item.qty)}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-2 pt-2 flex justify-between font-bold text-gray-900 dark:text-white">
            <span>Total</span>
            <span className="text-orange-600">{formatPrice(order.total)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
