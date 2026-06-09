"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Phone, Bike, Car, ChevronRight, X, Navigation,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DriverDB, OrderDB } from "@/lib/types";
import { vehicleLabels, driverStatusColors, driverStatusLabels, statusLabels } from "@/lib/constants";

// ─── Conakry bounds & projection ─────────────────────────────────
const CONAKRY_BOUNDS = { minLat: 9.44, maxLat: 9.58, minLng: -13.76, maxLng: -13.62 };

function projectPoint(lat: number, lng: number, viewBox: { x: number; y: number; w: number; h: number }) {
  const x = viewBox.x + ((lng - CONAKRY_BOUNDS.minLng) / (CONAKRY_BOUNDS.maxLng - CONAKRY_BOUNDS.minLng)) * viewBox.w;
  const y = viewBox.y + ((CONAKRY_BOUNDS.maxLat - lat) / (CONAKRY_BOUNDS.maxLat - CONAKRY_BOUNDS.minLat)) * viewBox.h;
  return { x, y };
}

// Restaurant location (Almamya, Corniche Nord)
const RESTO_LAT = 9.5092;
const RESTO_LNG = -13.7122;

// Simplified Conakry peninsula polygon (approximate coastline)
const CONAKRY_POLYGON = [
  [9.505, -13.758], [9.498, -13.752], [9.492, -13.745], [9.487, -13.738],
  [9.483, -13.730], [9.480, -13.720], [9.478, -13.710], [9.476, -13.700],
  [9.475, -13.690], [9.478, -13.680], [9.482, -13.672], [9.488, -13.665],
  [9.495, -13.660], [9.503, -13.656], [9.510, -13.653], [9.518, -13.651],
  [9.526, -13.650], [9.533, -13.651], [9.540, -13.654], [9.546, -13.659],
  [9.550, -13.665], [9.553, -13.672], [9.555, -13.680], [9.556, -13.688],
  [9.555, -13.696], [9.553, -13.704], [9.549, -13.712], [9.544, -13.718],
  [9.538, -13.724], [9.531, -13.730], [9.524, -13.736], [9.517, -13.742],
  [9.511, -13.748], [9.508, -13.754], [9.505, -13.758],
].map(([lat, lng]) => ({ lat, lng }));

// Key area labels
const AREA_LABELS = [
  { lat: 9.508, lng: -13.730, name: "Kaloum" },
  { lat: 9.520, lng: -13.700, name: "Dixinn" },
  { lat: 9.535, lng: -13.680, name: "Matam" },
  { lat: 9.550, lng: -13.660, name: "Matoto" },
];

interface DeliveryMapProps {
  drivers: DriverDB[];
  orders: OrderDB[];
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  className?: string;
  /** If set, only show this driver (for customer tracking) */
  focusDriverId?: string;
  /** If set, draw a line from restaurant to this destination */
  destinationLat?: number;
  destinationLng?: number;
  /** Simple mode for customer tracking */
  simple?: boolean;
  onDriverClick?: (driver: DriverDB) => void;
}

export function DeliveryMap({
  drivers,
  orders,
  apiFetch: _apiFetch,
  className = "",
  focusDriverId,
  destinationLat,
  destinationLng,
  simple = false,
  onDriverClick,
}: DeliveryMapProps) {
  const [selectedDriver, setSelectedDriver] = useState<DriverDB | null>(null);
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);

  // Auto-refresh driver positions every 15 seconds
  const [driverPositions, setDriverPositions] = useState<DriverDB[]>(drivers);

  const refreshPositions = useCallback(async () => {
    try {
      const res = await _apiFetch("/api/driver-location");
      if (res.ok) {
        const data = await res.json();
        setDriverPositions(data);
      }
    } catch {
      // silently retry
    }
  }, [_apiFetch]);

  useEffect(() => {
    setDriverPositions(drivers);
  }, [drivers]);

  useEffect(() => {
    const interval = setInterval(refreshPositions, 15000);
    return () => clearInterval(interval);
  }, [refreshPositions]);

  const VB = { x: 0, y: 0, w: 600, h: 500 };

  // Filter drivers based on mode
  const displayDrivers = focusDriverId
    ? driverPositions.filter(d => d.id === focusDriverId)
    : driverPositions.filter(d => d.lat !== 0 || d.lng !== 0);

  // Projected restaurant point
  const restPt = projectPoint(RESTO_LAT, RESTO_LNG, VB);

  // Projected destination (if provided)
  const destPt = destinationLat && destinationLng ? projectPoint(destinationLat, destinationLng, VB) : null;

  // Projected focus driver
  const focusDriver = focusDriverId ? displayDrivers.find(d => d.id === focusDriverId) : null;
  const focusDriverPt = focusDriver && focusDriver.lat ? projectPoint(focusDriver.lat, focusDriver.lng, VB) : null;

  const getDriverColor = (status: string) => {
    if (status === "available") return "#22c55e";
    if (status === "busy") return "#f97316";
    return "#9ca3af";
  };

  const getDriverOrder = (driver: DriverDB) => {
    if (!driver.currentOrderId) return null;
    return orders.find(o => o.id === driver.currentOrderId);
  };

  // Projected polygon
  const polygonPath = CONAKRY_POLYGON.map(p => {
    const pt = projectPoint(p.lat, p.lng, VB);
    return `${pt.x},${pt.y}`;
  }).join(" ");

  return (
    <Card className={`overflow-hidden dark:bg-gray-800 dark:border-gray-700 ${className}`}>
      <CardContent className="p-0 relative">
        <svg
          viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
          className="w-full h-auto"
          style={{ minHeight: simple ? 200 : 320 }}
        >
          {/* Background */}
          <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill={simple ? "#f0fdf4" : "#e0f2fe"} className="dark:fill-gray-900" rx="8" />

          {/* Water patterns */}
          <text x="30" y="40" className="fill-sky-300 dark:fill-sky-900 text-[10px] font-light" fontStyle="italic">Atlantique</text>
          <text x="20" y="55" className="fill-sky-300 dark:fill-sky-900 text-[10px] font-light" fontStyle="italic">Océan</text>

          {/* Conakry peninsula */}
          <polygon
            points={polygonPath}
            fill="#d1fae5"
            className="dark:fill-emerald-900/40"
            stroke="#6ee7b7"
            strokeWidth="1.5"

          />

          {/* District labels */}
          {!simple && AREA_LABELS.map(area => {
            const pt = projectPoint(area.lat, area.lng, VB);
            return (
              <text key={area.name} x={pt.x} y={pt.y} textAnchor="middle" className="fill-emerald-700/60 dark:fill-emerald-400/40 text-[9px] font-medium">
                {area.name}
              </text>
            );
          })}

          {/* Roads (simplified main roads) */}
          {!simple && (
            <>
              <line x1={projectPoint(9.509, -13.748, VB).x} y1={projectPoint(9.509, -13.748, VB).y} x2={projectPoint(9.545, -13.660, VB).x} y2={projectPoint(9.545, -13.660, VB).y} stroke="#a7f3d0" strokeWidth="2" strokeDasharray="4,4" className="dark:stroke-emerald-800" />
              <text x={projectPoint(9.527, -13.704, VB).x} y={projectPoint(9.527, -13.704, VB).y + 14} textAnchor="middle" className="fill-emerald-600/40 dark:fill-emerald-500/30 text-[7px]">Route Nationale</text>
            </>
          )}

          {/* Destination marker (for customer tracking) */}
          {destPt && (
            <g>
              <circle cx={destPt.x} cy={destPt.y} r="6" fill="#ef4444" opacity="0.3" />
              <circle cx={destPt.x} cy={destPt.y} r="4" fill="#ef4444" />
              <text x={destPt.x} y={destPt.y - 10} textAnchor="middle" className="fill-red-600 dark:fill-red-400 text-[8px] font-semibold">Destination</text>
            </g>
          )}

          {/* Line from restaurant to destination (for customer tracking) */}
          {focusDriverPt && destPt && (
            <g>
              <line x1={restPt.x} y1={restPt.y} x2={focusDriverPt.x} y2={focusDriverPt.y} stroke="#8b5cf6" strokeWidth="2" strokeDasharray="6,3" opacity="0.7" />
              <line x1={focusDriverPt.x} y1={focusDriverPt.y} x2={destPt.x} y2={destPt.y} stroke="#ef4444" strokeWidth="2" strokeDasharray="6,3" opacity="0.7" />
            </g>
          )}
          {focusDriverPt && !destPt && (
            <line x1={restPt.x} y1={restPt.y} x2={focusDriverPt.x} y2={focusDriverPt.y} stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="6,3" opacity="0.5" />
          )}

          {/* Restaurant marker */}
          <g>
            <circle cx={restPt.x} cy={restPt.y} r="12" fill="#f97316" opacity="0.15">
              <animate attributeName="r" values="12;18;12" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.15;0.05;0.15" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx={restPt.x} cy={restPt.y} r="8" fill="#f97316" className="dark:fill-orange-500" stroke="white" strokeWidth="2" />
            <text x={restPt.x} y={restPt.y + 1} textAnchor="middle" dominantBaseline="middle" className="fill-white text-[8px]" fontWeight="bold">KFM</text>
            <text x={restPt.x} y={restPt.y + 18} textAnchor="middle" className="fill-orange-600 dark:fill-orange-400 text-[8px] font-semibold">KFM Delice</text>
          </g>

          {/* Driver markers */}
          {displayDrivers.map(driver => {
            const pt = projectPoint(driver.lat, driver.lng, VB);
            const color = getDriverColor(driver.status);
            const isHovered = hoveredDriver === driver.id;
            const isSelected = selectedDriver?.id === driver.id;
            const order = getDriverOrder(driver);
            const isFocus = focusDriverId === driver.id;

            return (
              <g
                key={driver.id}
                className={simple ? "" : "cursor-pointer"}
                onMouseEnter={() => !simple && setHoveredDriver(driver.id)}
                onMouseLeave={() => !simple && setHoveredDriver(null)}
                onClick={() => {
                  if (!simple) {
                    setSelectedDriver(isSelected ? null : driver);
                    onDriverClick?.(driver);
                  }
                }}
              >
                {/* Pulse for active drivers */}
                {(driver.status === "busy" || isFocus) && (
                  <circle cx={pt.x} cy={pt.y} r="10" fill={color} opacity="0.2">
                    <animate attributeName="r" values="10;18;10" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.2;0;0.2" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Driver dot */}
                <circle
                  cx={pt.x} cy={pt.y}
                  r={isHovered || isSelected ? 9 : isFocus ? 8 : 6}
                  fill={color}
                  stroke="white"
                  strokeWidth={isHovered || isSelected ? 3 : 2}
                  className="transition-all duration-200"
                />

                {/* Vehicle icon in the dot */}
                <text x={pt.x} y={pt.y + 1} textAnchor="middle" dominantBaseline="middle" className="fill-white text-[6px]" fontWeight="bold">
                  {driver.vehicle === "voiture" ? "🚗" : driver.vehicle === "velo" ? "🚲" : "🏍"}
                </text>

                {/* Driver name label */}
                {(isHovered || isSelected || isFocus) && (
                  <g>
                    <rect x={pt.x - 30} y={pt.y - 22} width="60" height="14" rx="4" fill="white" className="dark:fill-gray-800" stroke={color} strokeWidth="0.5" />
                    <text x={pt.x} y={pt.y - 13} textAnchor="middle" className="fill-gray-800 dark:fill-gray-200 text-[7px] font-semibold">
                      {driver.name}
                    </text>
                  </g>
                )}

                {/* Order info on hover */}
                {isHovered && order && (
                  <g>
                    <rect x={pt.x - 45} y={pt.y + 14} width="90" height="20" rx="4" fill="white" className="dark:fill-gray-800" stroke="#e5e7eb" strokeWidth="0.5" />
                    <text x={pt.x} y={pt.y + 25} textAnchor="middle" className="fill-gray-600 dark:fill-gray-400 text-[6px]">
                      {order.customerName} — {statusLabels[order.status] || order.status}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Compass */}
          <g transform={`translate(${VB.x + VB.w - 40}, ${VB.y + 35})`}>
            <circle r="12" fill="white" opacity="0.8" className="dark:fill-gray-700" stroke="#d1d5db" strokeWidth="0.5" />
            <text y={-3} textAnchor="middle" className="fill-red-500 text-[8px]" fontWeight="bold">N</text>
            <polygon points="0,-8 -3,-3 3,-3" fill="#ef4444" />
            <polygon points="0,8 -3,3 3,3" fill="#9ca3af" />
          </g>
        </svg>

        {/* Legend */}
        {!simple && (
          <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 text-[10px] flex gap-3 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Disponible</div>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> En livraison</div>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> Hors ligne</div>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-white" /> Restaurant</div>
          </div>
        )}

        {/* Selected driver popup */}
        <AnimatePresence>
          {selectedDriver && !simple && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-3 right-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 w-64"
            >
              <button onClick={() => setSelectedDriver(null)} className="absolute top-2 right-2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"><X className="w-4 h-4" /></button>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: getDriverColor(selectedDriver.status) + "20" }}>
                  {selectedDriver.vehicle === "voiture" ? <Car className="w-5 h-5" style={{ color: getDriverColor(selectedDriver.status) }} /> : <Bike className="w-5 h-5" style={{ color: getDriverColor(selectedDriver.status) }} />}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{selectedDriver.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{selectedDriver.phone}</p>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Statut</span>
                  <Badge className={`${driverStatusColors[selectedDriver.status]} text-[10px]`}>{driverStatusLabels[selectedDriver.status]}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Véhicule</span>
                  <span className="text-gray-700 dark:text-gray-300">{vehicleLabels[selectedDriver.vehicle]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Zone</span>
                  <span className="text-gray-700 dark:text-gray-300">{selectedDriver.zone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Livraisons</span>
                  <span className="text-gray-700 dark:text-gray-300">{selectedDriver.totalDeliveries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Note</span>
                  <span className="text-gray-700 dark:text-gray-300">⭐ {selectedDriver.rating.toFixed(1)}</span>
                </div>
                {getDriverOrder(selectedDriver) && (
                  <div className="pt-2 border-t dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Commande en cours</p>
                    <p className="text-gray-700 dark:text-gray-300 font-medium">{getDriverOrder(selectedDriver)!.customerName}</p>
                    <p className="text-gray-500 dark:text-gray-400 truncate">{getDriverOrder(selectedDriver)!.deliveryAddress}</p>
                  </div>
                )}
                {selectedDriver.phone && (
                  <a href={`tel:${selectedDriver.phone}`} className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline pt-1">
                    <Phone className="w-3 h-3" /> Appeler
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
