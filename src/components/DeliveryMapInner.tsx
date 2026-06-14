"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { DriverDB, OrderDB } from "@/lib/types";
import { vehicleLabels, driverStatusLabels } from "@/lib/constants";

// ─── Constants ────────────────────────────────────────────────────
const RESTO_LAT = 9.5092;
const RESTO_LNG = -13.7122;
const DEFAULT_ZOOM = 13;
const DELIVERY_ZONE_RADIUS = 3000; // 3km

// ─── Custom Icons ─────────────────────────────────────────────────
const restaurantIcon = L.divIcon({
  html: `<div style="background:#f97316;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">KFM</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
  className: "",
});

const driverIcon = (status: string, vehicle: string) =>
  L.divIcon({
    html: `<div style="background:${
      status === "available" ? "#22c55e" : status === "busy" ? "#f97316" : "#9ca3af"
    };width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${
      vehicle === "moto" ? "\uD83C\uDFCD\uFE0F" : vehicle === "velo" ? "\uD83D\uDEB2" : "\uD83D\uDE97"
    }</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
    className: "",
  });

const destinationIcon = L.divIcon({
  html: `<div style="background:#ef4444;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">\uD83D\uDCCD</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
  className: "",
});

// ─── Auto-fit bounds component ────────────────────────────────────
function FitBounds({
  drivers,
  focusDriverId,
  destinationLat,
  destinationLng,
}: {
  drivers: DriverDB[];
  focusDriverId?: string;
  destinationLat?: number;
  destinationLng?: number;
}) {
  const map = useMap();
  const prevDriverIdsRef = useRef<string>("");

  useEffect(() => {
    const validDrivers = drivers.filter((d) => d.lat !== 0 || d.lng !== 0);
    if (validDrivers.length === 0) return;

    // Create a stable key to avoid re-fitting on every render
    const driverKey = validDrivers
      .map((d) => `${d.id}:${d.lat.toFixed(4)},${d.lng.toFixed(4)}`)
      .sort()
      .join("|");
    if (driverKey === prevDriverIdsRef.current) return;
    prevDriverIdsRef.current = driverKey;

    const points: L.LatLngExpression[] = [[RESTO_LAT, RESTO_LNG]];

    for (const d of validDrivers) {
      points.push([d.lat, d.lng]);
    }

    if (destinationLat && destinationLng) {
      points.push([destinationLat, destinationLng]);
    }

    if (focusDriverId) {
      // In focus mode, just center on the focus driver + restaurant + destination
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (validDrivers.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [drivers, focusDriverId, destinationLat, destinationLng, map]);

  return null;
}

// ─── Props Interface ──────────────────────────────────────────────
interface DeliveryMapInnerProps {
  drivers: DriverDB[];
  orders: OrderDB[];
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  className?: string;
  focusDriverId?: string;
  destinationLat?: number;
  destinationLng?: number;
  simple?: boolean;
  onDriverClick?: (driver: DriverDB) => void;
}

// ─── Main Inner Component ─────────────────────────────────────────
export function DeliveryMapInner({
  drivers,
  orders,
  apiFetch: _apiFetch,
  className = "",
  focusDriverId,
  destinationLat,
  destinationLng,
  simple = false,
  onDriverClick,
}: DeliveryMapInnerProps) {
  // Auto-refresh driver positions every 15 seconds
  const [driverPositions, setDriverPositions] = useState<DriverDB[]>(drivers);

  const refreshPositions = useCallback(async () => {
    try {
      const res = await _apiFetch("/api/driver-location");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDriverPositions(data);
        }
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

  // Filter drivers based on mode
  const displayDrivers = focusDriverId
    ? driverPositions.filter((d) => d.id === focusDriverId)
    : driverPositions.filter((d) => d.lat !== 0 || d.lng !== 0);

  // Focus driver (for simple mode route)
  const focusDriver = focusDriverId
    ? displayDrivers.find((d) => d.id === focusDriverId)
    : null;

  // Whether to show route in simple mode
  const showRoute = simple && focusDriver && (focusDriver.lat !== 0 || focusDriver.lng !== 0);

  // Get order for a driver
  const getDriverOrder = (driver: DriverDB) => {
    if (!driver.currentOrderId) return null;
    return orders.find((o) => o.id === driver.currentOrderId);
  };

  const mapHeight = simple ? "300px" : "500px";

  return (
    <div
      className={`relative ${className}`}
      style={{ height: mapHeight }}
    >
      <MapContainer
        center={[RESTO_LAT, RESTO_LNG]}
        zoom={DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%", borderRadius: "0.75rem" }}
        scrollWheelZoom={true}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Auto-fit bounds */}
        <FitBounds
          drivers={displayDrivers}
          focusDriverId={focusDriverId}
          destinationLat={destinationLat}
          destinationLng={destinationLng}
        />

        {/* Delivery zone circle around restaurant */}
        {!simple && (
          <Circle
            center={[RESTO_LAT, RESTO_LNG]}
            radius={DELIVERY_ZONE_RADIUS}
            pathOptions={{
              color: "#f97316",
              fillColor: "#f97316",
              fillOpacity: 0.08,
              weight: 1.5,
              dashArray: "6 4",
            }}
          />
        )}

        {/* Restaurant marker */}
        <Marker position={[RESTO_LAT, RESTO_LNG]} icon={restaurantIcon}>
          <Popup>
            <div style={{ textAlign: "center", minWidth: 140 }}>
              <strong style={{ fontSize: 14, color: "#f97316" }}>KFM Delice</strong>
              <br />
              <span style={{ fontSize: 12, color: "#666" }}>
                Almamya, Corniche Nord
              </span>
              <br />
              <span style={{ fontSize: 11, color: "#999" }}>
                📞 +224 622 34 56 78
              </span>
            </div>
          </Popup>
        </Marker>

        {/* Route polyline (simple/customer tracking mode) */}
        {showRoute && (
          <>
            {/* Restaurant → Driver segment (purple) */}
            {focusDriver && (
              <Polyline
                positions={[[RESTO_LAT, RESTO_LNG], [focusDriver.lat, focusDriver.lng]]}
                pathOptions={{
                  color: "#8b5cf6",
                  weight: 3,
                  dashArray: "8 6",
                  opacity: 0.8,
                }}
              />
            )}
            {/* Driver → Destination segment (red) */}
            {focusDriver && destinationLat && destinationLng && (
              <Polyline
                positions={[[focusDriver.lat, focusDriver.lng], [destinationLat, destinationLng]]}
                pathOptions={{
                  color: "#ef4444",
                  weight: 3,
                  dashArray: "8 6",
                  opacity: 0.8,
                }}
              />
            )}
          </>
        )}

        {/* Destination marker (for customer tracking) */}
        {destinationLat && destinationLng && (
          <Marker
            position={[destinationLat, destinationLng]}
            icon={destinationIcon}
          >
            <Popup>
              <div style={{ textAlign: "center" }}>
                <strong style={{ color: "#ef4444" }}>Destination</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Driver markers */}
        {displayDrivers.map((driver) => {
          if (driver.lat === 0 && driver.lng === 0) return null;

          const order = getDriverOrder(driver);

          return (
            <Marker
              key={driver.id}
              position={[driver.lat, driver.lng]}
              icon={driverIcon(driver.status, driver.vehicle)}
              eventHandlers={{
                click: () => {
                  onDriverClick?.(driver);
                },
              }}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        background:
                          driver.status === "available"
                            ? "#dcfce7"
                            : driver.status === "busy"
                            ? "#ffedd5"
                            : "#f3f4f6",
                      }}
                    >
                      {driver.vehicle === "voiture"
                        ? "\uD83D\uDE97"
                        : driver.vehicle === "velo"
                        ? "\uD83D\uDEB2"
                        : "\uD83C\uDFCD\uFE0F"}
                    </div>
                    <div>
                      <strong style={{ fontSize: 13 }}>{driver.name}</strong>
                      <br />
                      <span style={{ fontSize: 11, color: "#666" }}>
                        {driver.phone}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.6,
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: 6,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#666" }}>Statut</span>
                      <span
                        style={{
                          fontWeight: 600,
                          color:
                            driver.status === "available"
                              ? "#16a34a"
                              : driver.status === "busy"
                              ? "#ea580c"
                              : "#9ca3af",
                        }}
                      >
                        {driverStatusLabels[driver.status] || driver.status}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#666" }}>Vehicule</span>
                      <span>
                        {vehicleLabels[driver.vehicle] || driver.vehicle}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#666" }}>Zone</span>
                      <span>{driver.zone}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#666" }}>Livraisons</span>
                      <span>{driver.totalDeliveries}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#666" }}>Note</span>
                      <span>
                        {"\u2B50"} {driver.rating.toFixed(1)}
                      </span>
                    </div>
                    {order && (
                      <div
                        style={{
                          marginTop: 6,
                          paddingTop: 6,
                          borderTop: "1px solid #e5e7eb",
                        }}
                      >
                        <span style={{ color: "#666" }}>
                          Commande en cours
                        </span>
                        <br />
                        <strong>{order.customerName}</strong>
                        {order.deliveryAddress && (
                          <span
                            style={{
                              color: "#666",
                              display: "block",
                              fontSize: 11,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 160,
                            }}
                          >
                            {order.deliveryAddress}
                          </span>
                        )}
                      </div>
                    )}
                    {driver.phone && (
                      <a
                        href={`tel:${driver.phone}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "#16a34a",
                          fontSize: 12,
                          marginTop: 6,
                          textDecoration: "none",
                        }}
                      >
                        {"\uD83D\uDCDE"} Appeler
                      </a>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend overlay */}
      {!simple && (
        <div
          className="absolute bottom-3 left-3 z-[1000] bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 text-[10px] flex gap-3 border border-gray-200 dark:border-gray-700"
          style={{ pointerEvents: "auto" }}
        >
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />{" "}
            Disponible
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />{" "}
            En livraison
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />{" "}
            Hors ligne
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-white" />{" "}
            Restaurant
          </div>
        </div>
      )}

      {/* Live indicator */}
      <div
        className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-[10px] border border-gray-200 dark:border-gray-700"
        style={{ pointerEvents: "none" }}
      >
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-gray-600 dark:text-gray-300">MAJ auto 15s</span>
      </div>
    </div>
  );
}
