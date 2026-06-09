"use client";

import { Bike, CheckCircle2, Navigation, Package, AlertCircle } from "lucide-react";
import { DriverOrderCard } from "@/components/driver/DriverOrderCard";
import type { OrderDB, DriverUser } from "@/lib/types";

interface DriverOrdersProps {
  availableOrders: OrderDB[];
  activeOrder: OrderDB | undefined;
  driverProfile: DriverUser;
  onAcceptOrder: (orderId: string, status: string) => void;
  onUpdateOrderStatus: (orderId: string, status: string) => void;
}

export function DriverOrders({
  availableOrders,
  activeOrder,
  driverProfile,
  onAcceptOrder,
  onUpdateOrderStatus,
}: DriverOrdersProps) {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {activeOrder && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-orange-500" /> Livraison en cours
          </h3>
          <DriverOrderCard
            order={activeOrder}
            isMyOrder
            onAction={
              activeOrder.status === "picking_up"
                ? { label: "Départ livraison", status: "delivering", icon: Bike }
                : activeOrder.status === "delivering"
                  ? { label: "Livré !", status: "delivered", icon: CheckCircle2 }
                  : undefined
            }
            onActionClick={onUpdateOrderStatus}
          />
        </div>
      )}

      {driverProfile.status !== "offline" && availableOrders.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" /> Commandes disponibles
          </h3>
          <div className="space-y-3">
            {availableOrders.map(order => (
              <DriverOrderCard
                key={order.id}
                order={order}
                onAction={{ label: "Accepter", status: "picking_up", icon: CheckCircle2 }}
                onActionClick={onAcceptOrder}
              />
            ))}
          </div>
        </div>
      )}

      {!activeOrder && availableOrders.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Package className="w-10 h-10 text-gray-300 dark:text-gray-600" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Aucune commande en attente</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Les nouvelles commandes apparaîtront ici</p>
        </div>
      )}

      {driverProfile.status === "offline" && (
        <div className="text-center py-8 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-amber-700 dark:text-amber-400 font-medium">Vous êtes hors ligne</p>
          <p className="text-sm text-amber-600 dark:text-amber-500">Passez en Disponible pour recevoir des commandes</p>
        </div>
      )}
    </div>
  );
}
