"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";

interface UseDriverGpsOptions {
  /** Only track when the driver is not offline */
  isEnabled: boolean;
}

/**
 * Hook that manages GPS tracking for a driver.
 * Uses navigator.geolocation.watchPosition to send live coordinates
 * to the server and periodically pings with current status.
 */
export function useDriverGps({ isEnabled }: UseDriverGpsOptions) {
  const { apiFetch } = useAuth();
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await apiFetch("/api/driver-me", {
            method: "PATCH",
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          });
        } catch { /* ignore GPS errors */ }
      },
      () => { /* GPS denied */ },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
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

    // Periodic status heartbeat
    intervalRef.current = setInterval(async () => {
      try {
        await apiFetch("/api/driver-me", { method: "PATCH", body: JSON.stringify({}) });
      } catch { /* ignore */ }
    }, 15000);

    return () => {
      stopTracking();
    };
  }, [isEnabled, startTracking, stopTracking, apiFetch]);

  return { startTracking, stopTracking, isTracking: isEnabled };
}
