"use client";

import { Phone, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { vehicleLabels, RESTO } from "@/lib/constants";
import type { DriverUser } from "@/lib/types";

interface DriverProfileProps {
  driverProfile: DriverUser;
}

export function DriverProfile({ driverProfile }: DriverProfileProps) {
  return (
    <div className="max-w-md mx-auto space-y-4">
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
            {driverProfile.name[0]}
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{driverProfile.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{driverProfile.email}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1 mt-1">
            <Phone className="w-3.5 h-3.5" /> {driverProfile.phone}
          </p>
        </CardContent>
      </Card>

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Statistiques</h3>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{driverProfile.totalDeliveries}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Livraisons</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{(driverProfile.rating ?? 5).toFixed(1)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Note moyenne</p>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Véhicule</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{vehicleLabels[driverProfile.vehicle] || driverProfile.vehicle}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Zone</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{driverProfile.zone}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-gray-500 dark:text-gray-400">Statut</span>
              <Badge className={`${
                driverProfile.status === "available" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : driverProfile.status === "busy" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              } text-[10px]`}>
                {driverProfile.status === "available" ? "Disponible" : driverProfile.status === "busy" ? "En livraison" : "Hors ligne"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Restaurant</h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{RESTO.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{RESTO.address}</p>
              <a href={`tel:${RESTO.phone}`} className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <Phone className="w-3 h-3" /> {RESTO.phone}
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
