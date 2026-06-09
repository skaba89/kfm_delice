"use client";

import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Bike, MapPin, Navigation, Phone, Timer, Truck, XCircle,
  Package, Play, Square, Route,
} from "lucide-react";
import { VehicleIcon } from "@/components/VehicleIcon";
import { DeliveryMap } from "@/components/DeliveryMap";
import type { OrderDB, DriverDB } from "@/lib/types";
import { formatPrice, statusColors, statusLabels, vehicleLabels, driverStatusColors, driverStatusLabels } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { useAuth } from "@/lib/auth-context";

export interface DeliveriesTabProps {
  orders: OrderDB[];
  drivers: DriverDB[];
  apiPatch: (url: string, body: object) => Promise<void>;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  assigningOrderId: string | null;
  setAssigningOrderId: (v: string | null) => void;
  loadData: () => void;
}

// Restaurant location (Almamya, Corniche Nord)
const RESTO_LAT = 9.5092;
const RESTO_LNG = -13.7122;

// Simulated delivery destinations in Conakry
const SIMULATED_DESTINATIONS = [
  { lat: 9.505, lng: -13.735, name: "Kaloum Centre" },
  { lat: 9.518, lng: -13.710, name: "Dixinn" },
  { lat: 9.530, lng: -13.690, name: "Matam" },
  { lat: 9.545, lng: -13.670, name: "Matoto" },
  { lat: 9.538, lng: -13.710, name: "Belle Vue" },
  { lat: 9.512, lng: -13.695, name: "Cameroun" },
];

export function DeliveriesTab({ orders, drivers, apiPatch, apiFetch, assigningOrderId, setAssigningOrderId, loadData }: DeliveriesTabProps) {
  const deliveryOrders = orders.filter(o => o.orderType === "delivery" && o.status !== "delivered" && o.status !== "cancelled");
  const availableDrivers = drivers.filter(d => d.status === "available");
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(deliveryOrders, 10);

  // Highlighted driver from map click
  const [highlightedDriverId, setHighlightedDriverId] = useState<string | null>(null);

  // Simulation state
  const [simulating, setSimulating] = useState(false);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const simStepRef = useRef(0);

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    await apiPatch("/api/orders", { id: orderId, driverId });
    setAssigningOrderId(null);
    if (driver) notify.deliveryAssigned(driver.name);
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    await apiPatch("/api/orders", { id: orderId, status });
    notify.orderStatusChanged(statusLabels[status] || status);
  };

  const handlePickup = async (o: OrderDB) => {
    await apiPatch("/api/orders", { id: o.id, status: "picking_up" });
    if (o.driverId) await apiPatch("/api/drivers", { id: o.driverId, status: "busy", currentOrderId: o.id });
    notify.orderStatusChanged("Enlèvement");
  };

  const handleDelivering = async (o: OrderDB) => {
    await apiPatch("/api/orders", { id: o.id, status: "delivering", estimatedDeliveryTime: new Date(Date.now() + 30 * 60000).toISOString() });
    notify.orderStatusChanged("En livraison");
  };

  const handleDelivered = async (o: OrderDB) => {
    await apiPatch("/api/orders", { id: o.id, status: "delivered" });
    if (o.driverId) await apiPatch("/api/drivers", { id: o.driverId, status: "available", currentOrderId: "" });
    notify.orderStatusChanged("Livré");
  };

  // Driver simulation
  const startSimulation = useCallback(() => {
    if (simulating) return;
    setSimulating(true);
    simStepRef.current = 0;

    // Initialize busy drivers with positions near the restaurant
    const busyDrivers = drivers.filter(d => d.status === "busy" && d.currentOrderId);
    busyDrivers.forEach(async (driver, idx) => {
      const dest = SIMULATED_DESTINATIONS[idx % SIMULATED_DESTINATIONS.length];
      await apiFetch("/api/driver-location", {
        method: "PATCH",
        body: JSON.stringify({ driverId: driver.id, lat: RESTO_LAT + (Math.random() - 0.5) * 0.005, lng: RESTO_LNG + (Math.random() - 0.5) * 0.005, orderId: driver.currentOrderId }),
      });
    });

    // Also give available drivers some positions around Conakry
    const availDrivers = drivers.filter(d => d.status === "available" && (d.lat === 0 || d.lng === 0));
    availDrivers.forEach(async (driver, idx) => {
      const dest = SIMULATED_DESTINATIONS[(idx + 3) % SIMULATED_DESTINATIONS.length];
      await apiFetch("/api/driver-location", {
        method: "PATCH",
        body: JSON.stringify({ driverId: driver.id, lat: dest.lat + (Math.random() - 0.5) * 0.005, lng: dest.lng + (Math.random() - 0.5) * 0.005 }),
      });
    });

    loadData();

    simIntervalRef.current = setInterval(async () => {
      simStepRef.current += 1;
      const step = simStepRef.current;

      const busyDriversNow = drivers.filter(d => d.status === "busy" && d.currentOrderId);
      for (let idx = 0; idx < busyDriversNow.length; idx++) {
        const driver = busyDriversNow[idx];
        const dest = SIMULATED_DESTINATIONS[idx % SIMULATED_DESTINATIONS.length];
        // Interpolate between restaurant and destination
        const progress = Math.min((step * 0.08) + (Math.random() - 0.5) * 0.01, 0.95);
        const newLat = RESTO_LAT + (dest.lat - RESTO_LAT) * progress;
        const newLng = RESTO_LNG + (dest.lng - RESTO_LNG) * progress;
        // Add some randomness for realism
        const jitterLat = (Math.random() - 0.5) * 0.002;
        const jitterLng = (Math.random() - 0.5) * 0.002;
        await apiFetch("/api/driver-location", {
          method: "PATCH",
          body: JSON.stringify({ driverId: driver.id, lat: newLat + jitterLat, lng: newLng + jitterLng, orderId: driver.currentOrderId }),
        });
      }

      // Move available drivers slightly (patrolling)
      const availDriversNow = drivers.filter(d => d.status === "available" && d.lat !== 0);
      for (const driver of availDriversNow) {
        const jitterLat = (Math.random() - 0.5) * 0.003;
        const jitterLng = (Math.random() - 0.5) * 0.003;
        await apiFetch("/api/driver-location", {
          method: "PATCH",
          body: JSON.stringify({ driverId: driver.id, lat: driver.lat + jitterLat, lng: driver.lng + jitterLng }),
        });
      }

      loadData();
    }, 3000);
  }, [simulating, drivers, apiFetch, loadData]);

  const stopSimulation = useCallback(() => {
    setSimulating(false);
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Live Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{orders.filter(o => o.orderType === "delivery" && o.status === "pending").length}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">En attente</p>
        </CardContent></Card>
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 dark:from-orange-900/20 dark:to-red-900/20 dark:border-orange-800"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{orders.filter(o => o.orderType === "delivery" && ["confirmed", "preparing"].includes(o.status)).length}</p>
          <p className="text-xs text-orange-600 dark:text-orange-400">En préparation</p>
        </CardContent></Card>
        <Card className="bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200 dark:from-cyan-900/20 dark:to-blue-900/20 dark:border-cyan-800"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">{orders.filter(o => o.orderType === "delivery" && ["ready", "picking_up"].includes(o.status)).length}</p>
          <p className="text-xs text-cyan-600 dark:text-cyan-400">Prêts / Enlèvement</p>
        </CardContent></Card>
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200 dark:from-purple-900/20 dark:to-indigo-900/20 dark:border-purple-800"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{orders.filter(o => o.orderType === "delivery" && o.status === "delivering").length}</p>
          <p className="text-xs text-purple-600 dark:text-purple-400">En livraison</p>
          {drivers.filter(d => d.status === "available").length > 0 && <p className="text-[10px] text-green-600 dark:text-green-400 mt-1">{drivers.filter(d => d.status === "available").length} livreur(s) dispo</p>}
        </CardContent></Card>
      </div>

      {/* Interactive Map */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Route className="w-4 h-4 text-purple-500" />
            Carte en temps réel — Conakry
          </div>
          <div className="flex items-center gap-2">
            <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-xs text-gray-500 dark:text-gray-400">MAJ auto 15s</span>
          </div>
        </div>
        <DeliveryMap
          drivers={drivers}
          orders={orders}
          apiFetch={apiFetch}
          onDriverClick={(driver) => setHighlightedDriverId(driver.id)}
        />
      </div>

      {/* Simulation controls */}
      <div className="flex items-center gap-3">
        {simulating ? (
          <Button size="sm" variant="outline" onClick={stopSimulation} className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30">
            <Square className="w-3 h-3 mr-1.5" /> Arrêter simulation
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={startSimulation} className="border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900/30">
            <Play className="w-3 h-3 mr-1.5" /> Simuler mouvement
          </Button>
        )}
        {simulating && (
          <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
            Simulation en cours...
          </span>
        )}
      </div>

      {/* Delivery orders with live tracking */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedItems.map(o => {
          let items: { name: string; price: number; qty: number }[] = [];
          try { items = JSON.parse(o.items); } catch { /* */ }
          const isLive = ["picking_up", "delivering"].includes(o.status);
          const isHighlighted = highlightedDriverId && o.driverId === highlightedDriverId;
          const progressSteps = ["confirmed", "preparing", "ready", "picking_up", "delivering", "delivered"];
          const currentStepIdx = progressSteps.indexOf(o.status);
          const progressPct = o.status === "pending" ? 0 : currentStepIdx >= 0 ? Math.round(((currentStepIdx + 1) / progressSteps.length) * 100) : 0;

          return (
            <Card key={o.id} className={`hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700 ${isLive ? "border-2 border-purple-300 dark:border-purple-600 shadow-md shadow-purple-100 dark:shadow-purple-900/30" : ""} ${isHighlighted ? "ring-2 ring-emerald-400 dark:ring-emerald-600" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`${statusColors[o.status] || ""} text-xs`}>{statusLabels[o.status] || o.status}</Badge>
                    {isLive && <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-2 h-2 bg-purple-500 rounded-full" />}
                  </div>
                  <Badge variant="outline" className="text-xs flex items-center gap-1 dark:border-gray-600 dark:text-gray-300"><Bike className="w-3 h-3" /> Livraison</Badge>
                </div>
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{o.customerName}</p>
                <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 my-1"><MapPin className="w-3 h-3" /><span className="truncate">{o.deliveryAddress || "Adresse non spécifiée"}</span></div>

                {o.status !== "pending" && (
                  <div className="my-2">
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.8 }} className={`h-full rounded-full ${isLive ? "bg-gradient-to-r from-purple-500 to-indigo-500" : "bg-gradient-to-r from-orange-500 to-red-500"}`} />
                    </div>
                    <div className="flex justify-between mt-1">
                      {progressSteps.slice(0, -1).map((step, si) => (
                        <span key={step} className={`text-[8px] ${si <= currentStepIdx ? "text-gray-700 dark:text-gray-300 font-medium" : "text-gray-300 dark:text-gray-600"}`}>
                          {si === 0 ? "Confirmé" : si === 1 ? "Prép." : si === 2 ? "Prêt" : si === 3 ? "Enlèv." : "Livraison"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-0.5 mb-2">
                  {items.slice(0, 3).map((item, j) => <div key={j} className="flex justify-between text-xs"><span className="text-gray-600 dark:text-gray-400">{item.qty}x {item.name}</span><span className="font-medium dark:text-gray-300">{formatPrice(item.price * item.qty)}</span></div>)}
                  {items.length > 3 && <p className="text-[10px] text-gray-400 dark:text-gray-500">+{items.length - 3} autres</p>}
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold dark:text-gray-200">Total</span>
                  <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{formatPrice(o.total + (o.deliveryFee || 0))}</span>
                </div>
                {o.deliveryFee > 0 && <p className="text-[10px] text-gray-400 dark:text-gray-500">dont {formatPrice(o.deliveryFee)} livraison</p>}

                {o.driver ? (
                  <div className={`mt-2 p-3 rounded-xl ${isLive ? "bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 dark:from-purple-900/20 dark:to-indigo-900/20 dark:border-purple-800" : "bg-gray-50 dark:bg-gray-700/50"}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isLive ? "bg-purple-500 animate-pulse" : "bg-purple-100 dark:bg-purple-900/30"}`}>
                        <Truck className={`w-4 h-4 ${isLive ? "text-white" : "text-purple-600 dark:text-purple-400"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{o.driver.name}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{o.driver.phone} • {vehicleLabels[o.driver.vehicle]}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <a href={`tel:${o.driver.phone}`} className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"><Phone className="w-3 h-3" /></a>
                        <Badge className={`${driverStatusColors[o.driver.status]} text-[10px]`}>{driverStatusLabels[o.driver.status]}</Badge>
                      </div>
                    </div>
                    {isLive && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-purple-600 dark:text-purple-400">
                        <Navigation className="w-3 h-3 animate-pulse" /> GPS actif — dernière MAJ {o.driver.lastLocationUpdate ? new Date(o.driver.lastLocationUpdate).toLocaleTimeString("fr-FR") : ""}
                      </div>
                    )}
                    {isLive && o.estimatedDeliveryTime && (
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-indigo-600 dark:text-indigo-400">
                        <Timer className="w-3 h-3" /> Arrivée estimée : {new Date(o.estimatedDeliveryTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2">
                    {assigningOrderId === o.id ? (
                      <div className="space-y-2">
                        <select onChange={async (e) => { if (e.target.value) { await handleAssignDriver(o.id, e.target.value); } }} className="w-full h-8 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-xs dark:text-gray-100">
                          <option value="">Choisir un livreur...</option>
                          {availableDrivers.map(d => <option key={d.id} value={d.id}>{d.name} - {vehicleLabels[d.vehicle]} ({d.zone})</option>)}
                        </select>
                        <button onClick={() => setAssigningOrderId(null)} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Annuler</button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setAssigningOrderId(o.id)} className="w-full text-xs rounded-lg dark:border-gray-600" disabled={availableDrivers.length === 0}>
                        <Bike className="w-3 h-3 mr-1" /> {availableDrivers.length === 0 ? "Aucun livreur dispo" : "Assigner un livreur"}
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {o.status === "pending" && <Button size="sm" onClick={() => handleStatusChange(o.id, "confirmed")} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg h-7">Confirmer</Button>}
                  {o.status === "confirmed" && <Button size="sm" onClick={() => handleStatusChange(o.id, "preparing")} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg h-7">Préparer</Button>}
                  {o.status === "preparing" && <Button size="sm" onClick={() => handleStatusChange(o.id, "ready")} className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white text-xs rounded-lg h-7">Prêt</Button>}
                  {o.status === "ready" && o.driverId && <Button size="sm" onClick={() => handlePickup(o)} className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs rounded-lg h-7"><Navigation className="w-3 h-3 mr-1" /> Partir chercher</Button>}
                  {o.status === "picking_up" && <Button size="sm" onClick={() => handleDelivering(o)} className="flex-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg h-7"><Truck className="w-3 h-3 mr-1" /> En livraison</Button>}
                  {o.status === "delivering" && <Button size="sm" onClick={() => handleDelivered(o)} className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg h-7">Livré ✓</Button>}
                  {!["cancelled", "delivered"].includes(o.status) && <Button size="sm" variant="outline" onClick={() => handleStatusChange(o.id, "cancelled")} className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 text-xs rounded-lg h-7"><XCircle className="w-3 h-3" /></Button>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="livraisons" />
      {deliveryOrders.length === 0 && (
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-8 text-center"><Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400">Aucune livraison active</p></CardContent></Card>
      )}
    </div>
  );
}
