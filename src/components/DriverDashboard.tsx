"use client";

import { useState } from "react";
import { Bike, Car, RefreshCw, LogOut, Star, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth-context";
import { vehicleLabels } from "@/lib/constants";
import type { DriverUser } from "@/lib/types";
import { useDriverGps } from "@/lib/hooks/use-driver-gps";
import { useDriverData } from "@/lib/hooks/use-driver-data";
import { DriverOrders } from "@/components/driver/DriverOrders";
import { DriverMapTab } from "@/components/driver/DriverMapTab";
import { DriverHistory } from "@/components/driver/DriverHistory";
import { DriverProfile } from "@/components/driver/DriverProfile";
import { DriverEarnings } from "@/components/driver/DriverEarnings";
import { DriverPendingDeliveries } from "@/components/driver/DriverPendingDeliveries";

interface DriverDashboardProps {
  driver: DriverUser;
  onLogout: () => void;
}

export function DriverDashboard({ driver, onLogout }: DriverDashboardProps) {
  const [activeTab, setActiveTab] = useState<"orders" | "map" | "history" | "earnings" | "profile">("orders");
  const {
    driverProfile, loading, updateStatus, acceptOrder, updateOrderStatus,
    availableOrders, activeOrder, completedOrders,
  } = useDriverData({ driver });

  useDriverGps({ isEnabled: !!driverProfile && driverProfile.status !== "offline" });

  const VehicleIcon = driverProfile.vehicle === "voiture" ? Car : Bike;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
            <VehicleIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">{driverProfile.name}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              {vehicleLabels[driverProfile.vehicle] || driverProfile.vehicle} · {driverProfile.zone}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={onLogout} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" title="Déconnexion">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600 dark:text-gray-400">Statut :</span>
          <div className="flex gap-2">
            {(["available", "busy", "offline"] as const).map(s => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  driverProfile.status === s
                    ? s === "available"
                      ? "bg-green-500 text-white shadow-md shadow-green-500/30"
                      : s === "busy"
                        ? "bg-orange-500 text-white shadow-md shadow-orange-500/30"
                        : "bg-gray-400 text-white shadow-md"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {s === "available" ? "Disponible" : s === "busy" ? "En livraison" : "Hors ligne"}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> {(driverProfile.rating ?? 5).toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5" /> {driverProfile.totalDeliveries}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 flex gap-1 overflow-x-auto">
        {([
          { id: "orders" as const, label: "Commandes", count: availableOrders.length + (activeOrder ? 1 : 0) },
          { id: "map" as const, label: "Carte", count: 0 },
          { id: "history" as const, label: "Historique", count: 0 },
          { id: "earnings" as const, label: "Gains", count: 0 },
          { id: "profile" as const, label: "Profil", count: 0 },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <Badge className="ml-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px]">
                {tab.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Pending delivery proposals — shown on all tabs when available */}
        <DriverPendingDeliveries driverToken={driver.token} onAccepted={loadData} />

        {activeTab === "orders" && (
          <DriverOrders
            availableOrders={availableOrders}
            activeOrder={activeOrder}
            driverProfile={driverProfile}
            onAcceptOrder={acceptOrder}
            onUpdateOrderStatus={updateOrderStatus}
          />
        )}
        {activeTab === "map" && (
          <DriverMapTab driverProfile={driverProfile} activeOrder={activeOrder} />
        )}
        {activeTab === "history" && (
          <DriverHistory completedOrders={completedOrders} />
        )}
        {activeTab === "earnings" && (
          <DriverEarnings />
        )}
        {activeTab === "profile" && (
          <DriverProfile driverProfile={driverProfile} />
        )}
      </div>
    </div>
  );
}
