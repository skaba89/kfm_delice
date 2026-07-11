"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, MapPin, Package, Clock, Phone, Store, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatPrice } from "@/lib/constants";

interface PendingDelivery {
  id: string;
  customerName: string;
  phone: string;
  deliveryAddress: string;
  total: number;
  deliveryFee: number;
  itemsCount: number;
  remainingSeconds: number;
  restaurant: {
    name: string;
    address: string;
    phone: string;
    lat: number;
    lng: number;
  };
}

export function DriverPendingDeliveries({ driverToken, onAccepted }: { driverToken: string; onAccepted?: () => void }) {
  const [pending, setPending] = useState<PendingDelivery[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/driver-orders/pending", {
        headers: { Authorization: `Bearer ${driverToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setPending(data.data || []);
    } catch {
      // silent
    }
  }, [driverToken]);

  // Poll every 3 seconds for new proposals
  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 3000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  const handleAccept = async (orderId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${driverToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return;
      }
      toast.success("Livraison acceptée ! Récupérez la commande.");
      setPending(prev => prev.filter(p => p.id !== orderId));
      onAccepted?.();
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (orderId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${driverToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return;
      }
      toast.info("Livraison refusée");
      setPending(prev => prev.filter(p => p.id !== orderId));
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  if (pending.length === 0) return null;

  return (
    <div className="space-y-3 mb-4">
      <AnimatePresence>
        {pending.map((delivery) => (
          <motion.div
            key={delivery.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <Card className="border-2 border-orange-400 dark:border-orange-500/50 shadow-xl overflow-hidden">
              {/* Timer bar */}
              <div className="h-1.5 bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all duration-1000"
                  style={{ width: `${(delivery.remainingSeconds / 60) * 100}%` }}
                />
              </div>

              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Package className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">Nouvelle livraison !</p>
                      <p className="text-xs text-gray-500">{delivery.itemsCount} article(s) · {formatPrice(delivery.total)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                    <Clock className="w-4 h-4" />
                    <span className="font-bold text-lg">{delivery.remainingSeconds}s</span>
                  </div>
                </div>

                {/* Restaurant info */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-2">
                  <div className="flex items-start gap-2">
                    <Store className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Récupérer chez</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{delivery.restaurant.name}</p>
                      <p className="text-xs text-gray-500">{delivery.restaurant.address}</p>
                    </div>
                  </div>
                </div>

                {/* Customer info */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-3">
                  <div className="flex items-start gap-2">
                    <Navigation className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">Livrer à</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{delivery.customerName}</p>
                      <p className="text-xs text-gray-500">{delivery.deliveryAddress || "Adresse à confirmer"}</p>
                      {delivery.phone && (
                        <a href={`tel:${delivery.phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3" /> {delivery.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fee */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-sm text-gray-500">Votre commission</span>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    +{formatPrice(delivery.deliveryFee)}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleReject(delivery.id)}
                    disabled={loading}
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 rounded-xl"
                  >
                    <X className="w-4 h-4 mr-1" /> Refuser
                  </Button>
                  <Button
                    onClick={() => handleAccept(delivery.id)}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl"
                  >
                    <Check className="w-4 h-4 mr-1" /> Accepter
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
