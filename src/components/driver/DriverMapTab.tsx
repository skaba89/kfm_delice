"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, Navigation, Clock, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeliveryMap } from "@/components/DeliveryMap";
import { formatPrice } from "@/lib/constants";
import { useAuth } from "@/lib/auth-context";
import { geocodeAddress, estimateRoadKm, estimateEtaMinutes } from "@/lib/geocode";
import type { OrderDB, DriverUser } from "@/lib/types";

const RESTAURANT_LAT = 9.5092;
const RESTAURANT_LNG = -13.7122;

interface DriverMapTabProps {
  driverProfile: DriverUser;
  activeOrder: OrderDB | undefined;
}

export function DriverMapTab({ driverProfile, activeOrder }: DriverMapTabProps) {
  const { apiFetch } = useAuth();
  const [driverPosition, setDriverPosition] = useState<{ lat: number; lng: number }>({
    lat: driverProfile.lat || RESTAURANT_LAT,
    lng: driverProfile.lng || RESTAURANT_LNG,
  });
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);

  // Live-poll the driver's own GPS position from the server
  // (the use-driver-gps hook writes to the DB; this reads it back so the map stays in sync)
  useEffect(() => {
    const fetchPosition = async () => {
      try {
        const res = await apiFetch("/api/driver-location");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const me = data.find((d: { id: string }) => d.id === driverProfile.id);
            if (me && (me.lat !== 0 || me.lng !== 0)) {
              setDriverPosition({ lat: me.lat, lng: me.lng });
              setGpsError(null);
            }
          } else if (data && !Array.isArray(data) && data.id === driverProfile.id) {
            if (data.lat !== 0 || data.lng !== 0) {
              setDriverPosition({ lat: data.lat, lng: data.lng });
              setGpsError(null);
            }
          }
        }
      } catch { /* ignore — retry next tick */ }
    };

    fetchPosition();
    const interval = setInterval(fetchPosition, 5000);
    return () => clearInterval(interval);
  }, [apiFetch, driverProfile.id]);

  // Try to get the driver's actual browser GPS (high accuracy) for a smoother map
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (latitude && longitude) {
          setDriverPosition({ lat: latitude, lng: longitude });
          setGpsError(null);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError("GPS refusé — activez la géolocalisation pour une meilleure précision");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError("Position GPS indisponible");
        } else if (err.code === err.TIMEOUT) {
          // Silent — server polling will keep position fresh
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Geocode the active order's delivery address
  useEffect(() => {
    if (!activeOrder?.deliveryAddress) {
      setDestination(null);
      return;
    }

    geocodeAbortRef.current?.abort();
    const ctrl = new AbortController();
    geocodeAbortRef.current = ctrl;

    setGeocoding(true);
    geocodeAddress(activeOrder.deliveryAddress, ctrl.signal)
      .then((result) => {
        if (ctrl.signal.aborted) return;
        if (result) {
          setDestination({ lat: result.lat, lng: result.lng });
        } else {
          // Fallback: random point in Conakry
          const seed = activeOrder.deliveryAddress.length;
          setDestination({
            lat: RESTAURANT_LAT + ((seed * 7) % 50) / 1000,
            lng: RESTAURANT_LNG + ((seed * 13) % 60) / 1000,
          });
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setGeocoding(false);
      });

    return () => ctrl.abort();
  }, [activeOrder?.deliveryAddress]);

  const etaMinutes =
    destination && (driverPosition.lat !== 0 || driverPosition.lng !== 0)
      ? estimateEtaMinutes(
          estimateRoadKm(driverPosition.lat, driverPosition.lng, destination.lat, destination.lng)
        )
      : null;

  const drivers = [
    {
      id: driverProfile.id,
      email: driverProfile.email || "",
      name: driverProfile.name,
      phone: driverProfile.phone,
      vehicle: driverProfile.vehicle,
      status: driverProfile.status,
      lat: driverPosition.lat,
      lng: driverPosition.lng,
      currentOrderId: driverProfile.currentOrderId,
      totalDeliveries: driverProfile.totalDeliveries,
      rating: driverProfile.rating,
      zone: driverProfile.zone,
      lastLocationUpdate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* GPS status banner */}
      {gpsError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Live map */}
      <DeliveryMap
        drivers={drivers}
        orders={activeOrder ? [activeOrder] : []}
        apiFetch={apiFetch}
        simple={false}
        focusDriverId={driverProfile.id}
        destinationLat={destination?.lat}
        destinationLng={destination?.lng}
      />

      {/* Active order summary */}
      {activeOrder && (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Destination
                  </span>
                  {geocoding && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Géocodage…
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
                  {activeOrder.deliveryAddress || "Non spécifiée"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Montant</p>
                <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                  {formatPrice(activeOrder.total)}
                </p>
              </div>
            </div>

            {destination && (
              <div className="grid grid-cols-2 gap-3 pt-3 border-t dark:border-gray-700">
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <Navigation className="w-3.5 h-3.5 text-purple-500" />
                  <span>
                    Distance:{" "}
                    <strong className="text-gray-900 dark:text-gray-100">
                      {estimateRoadKm(
                        driverPosition.lat,
                        driverPosition.lng,
                        destination.lat,
                        destination.lng
                      ).toFixed(1)}{" "}
                      km
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <Clock className="w-3.5 h-3.5 text-orange-500" />
                  <span>
                    ETA:{" "}
                    <strong className="text-gray-900 dark:text-gray-100">
                      {etaMinutes ? `~${etaMinutes} min` : "—"}
                    </strong>
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t dark:border-gray-700">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Position: {driverPosition.lat.toFixed(5)}, {driverPosition.lng.toFixed(5)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {!activeOrder && (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            <Navigation className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            Aucune livraison active. Votre position GPS est partagée en temps réel avec le restaurant.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
