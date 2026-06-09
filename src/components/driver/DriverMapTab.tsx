"use client";

import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DeliveryMap } from "@/components/DeliveryMap";
import { formatPrice } from "@/lib/constants";
import { useAuth } from "@/lib/auth-context";
import type { OrderDB, DriverUser } from "@/lib/types";

const RESTAURANT_LAT = 9.5092;
const RESTAURANT_LNG = -13.7122;

interface DriverMapTabProps {
  driverProfile: DriverUser;
  activeOrder: OrderDB | undefined;
}

export function DriverMapTab({ driverProfile, activeOrder }: DriverMapTabProps) {
  const { apiFetch } = useAuth();

  return (
    <div className="max-w-4xl mx-auto">
      <DeliveryMap
        drivers={[{
          id: driverProfile.id,
          email: driverProfile.email || '',
          name: driverProfile.name,
          phone: driverProfile.phone,
          vehicle: driverProfile.vehicle,
          status: driverProfile.status,
          lat: driverProfile.lat || RESTAURANT_LAT,
          lng: driverProfile.lng || RESTAURANT_LNG,
          currentOrderId: driverProfile.currentOrderId,
          totalDeliveries: driverProfile.totalDeliveries,
          rating: driverProfile.rating,
          zone: driverProfile.zone,
          lastLocationUpdate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }]}
        orders={activeOrder ? [activeOrder] : []}
        apiFetch={apiFetch}
        simple={false}
        focusDriverId={driverProfile.id}
      />
      {activeOrder && (
        <Card className="mt-4 dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Destination</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{activeOrder.deliveryAddress || "Non spécifiée"}</p>
            <p className="text-sm font-bold text-orange-600 dark:text-orange-400 mt-1">{formatPrice(activeOrder.total)}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
