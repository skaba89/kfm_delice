"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/lib/auth-context";

interface UseDriverGpsOptions {
  /** Only track when the driver is not offline */
  isEnabled: boolean;
}

export type GpsPermissionState = "unknown" | "granted" | "denied" | "prompt";

/**
 * Hook that manages GPS tracking for a driver.
 *
 * Uses navigator.geolocation.watchPosition to send live coordinates
 * to the server and periodically pings with current status.
 *
 * Returns the current permission state so the UI can prompt the user
 * to enable location services if they were denied.
 */
export function useDriverGps({ isEnabled }: UseDriverGpsOptions) {
  const { apiFetch } = useAuth();
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [permission, setPermission] = useState<GpsPermissionState>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Try to read the current permission state up-front (Chromium only).
  useEffect(() => {
    if (!("permissions" in navigator)) return;
    let active = true;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (!active) return;
        setPermission(status.state as GpsPermissionState);
        status.onchange = () => {
          if (active) setPermission(status.state as GpsPermissionState);
        };
      })
      .catch(() => { /* ignore — not all browsers support this */ });
    return () => {
      active = false;
    };
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas supportée par ce navigateur");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!latitude || !longitude) return;
        setPermission("granted");
        setError(null);
        setLastUpdate(new Date());
        try {
          await apiFetch("/api/driver-me", {
            method: "PATCH",
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          });
        } catch { /* ignore GPS errors */ }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermission("denied");
          setError("GPS refusé — activez la géolocalisation dans votre navigateur");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Position GPS indisponible — vérifiez votre connexion");
        } else if (err.code === err.TIMEOUT) {
          // Silent — will retry automatically
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }, [apiFetch]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isEnabled) {
      stopTracking();
      return;
    }

    startTracking();

    // Periodic status heartbeat (keeps lastLocationUpdate fresh even if GPS is idle)
    intervalRef.current = setInterval(async () => {
      try {
        await apiFetch("/api/driver-me", { method: "PATCH", body: JSON.stringify({}) });
      } catch { /* ignore */ }
    }, 15000);

    return () => {
      stopTracking();
    };
  }, [isEnabled, startTracking, stopTracking, apiFetch]);

  return {
    startTracking,
    stopTracking,
    isTracking: isEnabled && permission !== "denied",
    permission,
    error,
    lastUpdate,
  };
}
