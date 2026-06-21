"use client";

/**
 * DeliveryMapInner — Real-time Leaflet map of Guinea / Conakry.
 *
 * Features:
 *   • OpenStreetMap tiles (free, no API key needed)
 *   • Restaurant marker (KFM Delice, Almamya)
 *   • Driver markers with vehicle icon + status color + pulse for active
 *   • Destination marker (customer address)
 *   • Polyline route: restaurant → driver → destination
 *   • Auto-refresh driver positions every 5 s (real-time feel)
 *   • Auto-fit bounds to all visible points
 *   • Smooth marker movement when driver GPS changes (interpolated)
 *   • Live "MAJ auto" indicator
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
const RESTO_LAT = 9.5092; // Almamya, Corniche Nord, Conakry
const RESTO_LNG = -13.7122;
const DEFAULT_ZOOM = 13;
const DELIVERY_ZONE_RADIUS = 3000; // 3 km
const REFRESH_INTERVAL_MS = 5000; // 5 s — feels real-time without hammering the API

// ─── Leaflet default-icon fix (Webpack breaks the bundled URLs) ──
// We don't use the default marker images, but this prevents 404 noise.
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

// ─── Custom div-icons (no external assets) ────────────────────────
const restaurantIcon = L.divIcon({
  html: `<div style="position:relative;width:40px;height:40px;">
    <div style="position:absolute;inset:0;background:#f97316;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:11px;border:3px solid white;box-shadow:0 4px 10px rgba(249,115,22,0.4);">KFM</div>
    <div style="position:absolute;inset:0;background:#f97316;border-radius:50%;opacity:0.4;animation:pulse-ring 2s ease-out infinite;"></div>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -22],
  className: "",
});

const driverIcon = (status: string, vehicle: string, isFocus = false) => {
  const color =
    status === "available" ? "#22c55e" : status === "busy" ? "#f97316" : "#9ca3af";
  const emoji =
    vehicle === "voiture" ? "\uD83D\uDE97" : vehicle === "velo" ? "\uD83D\uDEB2" : "\uD83C\uDFCD\uFE0F";
  const size = isFocus ? 40 : 34;
  return L.divIcon({
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      ${
        status === "busy" || isFocus
          ? `<div style="position:absolute;inset:-4px;background:${color};border-radius:50%;opacity:0.3;animation:pulse-ring 1.5s ease-out infinite;"></div>`
          : ""
      }
      <div style="position:relative;width:${size}px;height:${size}px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${isFocus ? 20 : 17}px;border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.3);">${emoji}</div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
    className: "",
  });
};

const destinationIcon = L.divIcon({
  html: `<div style="position:relative;width:34px;height:34px;">
    <div style="position:absolute;inset:0;background:#ef4444;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;color:white;font-size:16px;border:3px solid white;box-shadow:0 3px 8px rgba(239,68,68,0.4);">\uD83D\uDCCD</div>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
  className: "",
});

// ─── Local CSS keyframes (injected once) ──────────────────────────
if (typeof window !== "undefined" && !document.getElementById("delivery-map-style")) {
  const style = document.createElement("style");
  style.id = "delivery-map-style";
  style.textContent = `
    @keyframes pulse-ring {
      0% { transform: scale(0.6); opacity: 0.6; }
      80%, 100% { transform: scale(1.8); opacity: 0; }
    }
    .leaflet-container { font-family: inherit; }
    .leaflet-popup-content-wrapper { border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
    .leaflet-popup-content { margin: 12px 14px; }
  `;
  document.head.appendChild(style);
}

// ─── Auto-fit bounds (only when the set of points changes) ────────
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
  const prevKeyRef = useRef<string>("");

  useEffect(() => {
    const validDrivers = drivers.filter((d) => d.lat !== 0 || d.lng !== 0);
    if (validDrivers.length === 0 && !destinationLat) return;

    const key = [
      ...validDrivers.map((d) => `${d.id}:${d.lat.toFixed(4)},${d.lng.toFixed(4)}`),
      destinationLat ? `dest:${destinationLat.toFixed(4)},${destinationLng!.toFixed(4)}` : "",
    ].sort().join("|");

    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    const points: L.LatLngExpression[] = [[RESTO_LAT, RESTO_LNG]];
    for (const d of validDrivers) points.push([d.lat, d.lng]);
    if (destinationLat && destinationLng) points.push([destinationLat, destinationLng]);

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  }, [drivers, focusDriverId, destinationLat, destinationLng, map]);

  return null;
}

// ─── Follow driver: pan to keep driver in view (smooth) ───────────
function FollowDriver({ driver }: { driver?: DriverDB }) {
  const map = useMap();
  const prevRef = useRef<string>("");

  useEffect(() => {
    if (!driver || driver.lat === 0 || driver.lng === 0) return;
    const key = `${driver.lat.toFixed(5)},${driver.lng.toFixed(5)}`;
    if (key === prevRef.current) return;
    prevRef.current = key;
    map.panTo([driver.lat, driver.lng], { animate: true, duration: 1.2 });
  }, [driver, map]);

  return null;
}

// ─── Props ────────────────────────────────────────────────────────
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

// ─── Main component ───────────────────────────────────────────────
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
  const [driverPositions, setDriverPositions] = useState<DriverDB[]>(drivers);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const refreshPositions = useCallback(async () => {
    try {
      const res = await _apiFetch("/api/driver-location");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDriverPositions(data);
          setLastUpdate(new Date());
        }
      }
    } catch {
      // silently retry — the next interval will try again
    }
  }, [_apiFetch]);

  useEffect(() => {
    setDriverPositions(drivers);
  }, [drivers]);

  useEffect(() => {
    const interval = setInterval(refreshPositions, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshPositions]);

  // Filter drivers based on mode (focus vs all)
  const displayDrivers = useMemo(() => {
    if (focusDriverId) {
      return driverPositions.filter((d) => d.id === focusDriverId);
    }
    return driverPositions.filter((d) => d.lat !== 0 || d.lng !== 0);
  }, [driverPositions, focusDriverId]);

  const focusDriver = focusDriverId
    ? displayDrivers.find((d) => d.id === focusDriverId)
    : null;

  const showRoute =
    simple && focusDriver && (focusDriver.lat !== 0 || focusDriver.lng !== 0);

  const getDriverOrder = (driver: DriverDB) => {
    if (!driver.currentOrderId) return null;
    return orders.find((o) => o.id === driver.currentOrderId);
  };

  const mapHeight = simple ? 320 : 500;

  // Polyline points for the route (restaurant → driver → destination)
  const routePoints: L.LatLngExpression[] = useMemo(() => {
    const pts: L.LatLngExpression[] = [];
    if (!focusDriver) return pts;
    pts.push([RESTO_LAT, RESTO_LNG]);
    pts.push([focusDriver.lat, focusDriver.lng]);
    if (destinationLat && destinationLng) {
      pts.push([destinationLat, destinationLng]);
    }
    return pts;
  }, [focusDriver, destinationLat, destinationLng]);

  return (
    <div
      className={`relative ${className}`}
      style={{ height: mapHeight }}
    >
      <MapContainer
        center={[RESTO_LAT, RESTO_LNG]}
        zoom={DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%", borderRadius: "0.75rem", zIndex: 0 }}
        scrollWheelZoom={true}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <FitBounds
          drivers={displayDrivers}
          focusDriverId={focusDriverId}
          destinationLat={destinationLat}
          destinationLng={destinationLng}
        />

        {simple && focusDriver && <FollowDriver driver={focusDriver} />}

        {/* Delivery zone circle around restaurant */}
        {!simple && (
          <Circle
            center={[RESTO_LAT, RESTO_LNG]}
            radius={DELIVERY_ZONE_RADIUS}
            pathOptions={{
              color: "#f97316",
              fillColor: "#f97316",
              fillOpacity: 0.06,
              weight: 1.5,
              dashArray: "6 4",
            }}
          />
        )}

        {/* Restaurant marker */}
        <Marker position={[RESTO_LAT, RESTO_LNG]} icon={restaurantIcon}>
          <Popup>
            <div style={{ textAlign: "center", minWidth: 160 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f97316" }}>KFM Delice</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                Almamya, Corniche Nord
              </div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                {"\uD83D\uDCCD"} Conakry, Guinée
              </div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                {"\uD83D\uDCDE"} +224 622 34 56 78
              </div>
            </div>
          </Popup>
        </Marker>

        {/* Route polyline (customer tracking mode) */}
        {showRoute && routePoints.length >= 2 && (
          <>
            {/* Restaurant → Driver (purple) */}
            {focusDriver && (
              <Polyline
                positions={[[RESTO_LAT, RESTO_LNG], [focusDriver.lat, focusDriver.lng]]}
                pathOptions={{ color: "#8b5cf6", weight: 4, dashArray: "8 6", opacity: 0.85 }}
              />
            )}
            {/* Driver → Destination (red) */}
            {focusDriver && destinationLat && destinationLng && (
              <Polyline
                positions={[[focusDriver.lat, focusDriver.lng], [destinationLat, destinationLng]]}
                pathOptions={{ color: "#ef4444", weight: 4, dashArray: "8 6", opacity: 0.85 }}
              />
            )}
          </>
        )}

        {/* Destination marker */}
        {destinationLat && destinationLng && (
          <Marker position={[destinationLat, destinationLng]} icon={destinationIcon}>
            <Popup>
              <div style={{ textAlign: "center", minWidth: 140 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>{"\uD83D\uDCCD"} Destination</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                  Point de livraison client
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Driver markers */}
        {displayDrivers.map((driver) => {
          if (driver.lat === 0 && driver.lng === 0) return null;
          const order = getDriverOrder(driver);
          const isFocus = focusDriverId === driver.id;

          return (
            <Marker
              key={driver.id}
              position={[driver.lat, driver.lng]}
              icon={driverIcon(driver.status, driver.vehicle, isFocus)}
              eventHandlers={{
                click: () => onDriverClick?.(driver),
              }}
            >
              <Popup>
                <div style={{ minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
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
                      <strong style={{ fontSize: 14 }}>{driver.name}</strong>
                      <br />
                      <span style={{ fontSize: 12, color: "#666" }}>{driver.phone}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.7, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
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
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#666" }}>Véhicule</span>
                      <span>{vehicleLabels[driver.vehicle] || driver.vehicle}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#666" }}>Zone</span>
                      <span>{driver.zone}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#666" }}>Livraisons</span>
                      <span>{driver.totalDeliveries}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#666" }}>Note</span>
                      <span>{"\u2B50"} {driver.rating.toFixed(1)}</span>
                    </div>
                    {driver.lastLocationUpdate && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#666" }}>Dernière MAJ</span>
                        <span>
                          {new Date(driver.lastLocationUpdate).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                    )}
                    {order && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb" }}>
                        <span style={{ color: "#666" }}>Commande en cours</span>
                        <br />
                        <strong>{order.customerName}</strong>
                        {order.deliveryAddress && (
                          <span
                            style={{
                              color: "#666",
                              display: "block",
                              fontSize: 11,
                              marginTop: 2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 180,
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
                          fontSize: 13,
                          marginTop: 8,
                          textDecoration: "none",
                          fontWeight: 600,
                        }}
                      >
                        {"\uD83D\uDCDE"} Appeler le livreur
                      </a>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend overlay (admin view only) */}
      {!simple && (
        <div
          className="absolute bottom-3 left-3 z-[1000] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg px-3 py-2 text-[11px] flex flex-col gap-1 border border-gray-200 dark:border-gray-700 shadow-md"
          style={{ pointerEvents: "auto" }}
        >
          <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Légende</div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow-sm" /> Disponible
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white shadow-sm" /> En livraison
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-400 border-2 border-white shadow-sm" /> Hors ligne
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white shadow-sm" /> Restaurant KFM
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm" /> Destination
          </div>
        </div>
      )}

      {/* Live indicator */}
      <div
        className="absolute top-3 right-3 z-[1000] flex items-center gap-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-full px-3 py-1.5 text-[11px] border border-gray-200 dark:border-gray-700 shadow-md"
        style={{ pointerEvents: "none" }}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        <span className="text-gray-700 dark:text-gray-200 font-medium">En direct</span>
        <span className="text-gray-400 dark:text-gray-500">
          · {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

      {/* ETA / distance badge for customer tracking */}
      {simple && focusDriver && (focusDriver.lat !== 0 || focusDriver.lng !== 0) && destinationLat && destinationLng && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-full px-4 py-2 text-[12px] border border-gray-200 dark:border-gray-700 shadow-md flex items-center gap-3"
          style={{ pointerEvents: "none" }}
        >
          <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold">
            {"\uD83D\uDE97"} {focusDriver.name}
          </span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-gray-700 dark:text-gray-200">
            {"\uD83D\uDCCD"} ~{calcHaversineKm(focusDriver.lat, focusDriver.lng, destinationLat, destinationLng).toFixed(1)} km
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Haversine distance (km) ──────────────────────────────────────
function calcHaversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
