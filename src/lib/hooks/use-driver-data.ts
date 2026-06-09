"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/lib/notifications";
import type { DriverUser, OrderDB } from "@/lib/types";

interface UseDriverDataOptions {
  driver: DriverUser;
}

export function useDriverData({ driver }: UseDriverDataOptions) {
  const { apiFetch } = useAuth();
  const [orders, setOrders] = useState<OrderDB[]>([]);
  const [driverProfile, setDriverProfile] = useState<DriverUser>(driver);
  const [loading, setLoading] = useState(true);

  /** Reload orders + driver profile from the server */
  const loadData = useCallback(async () => {
    try {
      const [ordersRes, meRes] = await Promise.all([
        apiFetch("/api/driver-orders?limit=1000"),
        apiFetch("/api/driver-me"),
      ]);
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(Array.isArray(ordersData) ? ordersData : (ordersData.data || []));
      }
      if (meRes.ok) {
        const me = await meRes.json();
        setDriverProfile(prev => ({ ...prev, ...me }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  /** Change the driver's availability status */
  const updateStatus = useCallback(async (status: string) => {
    try {
      const res = await apiFetch("/api/driver-me", {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDriverProfile(prev => ({ ...prev, ...updated }));
        notify.success("Statut mis à jour");
      }
    } catch (e) { console.error(e); }
  }, [apiFetch]);

  /** Accept an available order */
  const acceptOrder = useCallback(async (orderId: string) => {
    try {
      const res = await apiFetch("/api/driver-orders", {
        method: "PATCH",
        body: JSON.stringify({ orderId, status: "picking_up" }),
      });
      if (res.ok) { notify.success("Commande acceptée !"); loadData(); }
    } catch (e) { console.error(e); }
  }, [apiFetch, loadData]);

  /** Move an order to a new status (e.g. delivering → delivered) */
  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    try {
      const res = await apiFetch("/api/driver-orders", {
        method: "PATCH",
        body: JSON.stringify({ orderId, status }),
      });
      if (res.ok) {
        notify.success(status === "delivered" ? "Livraison terminée !" : "Statut mis à jour");
        loadData();
      }
    } catch (e) { console.error(e); }
  }, [apiFetch, loadData]);

  // Derived data
  const availableOrders = orders.filter(o => o.status === "ready" && !o.driverId);
  const activeOrder = orders.find(o => o.status === "picking_up" || o.status === "delivering");
  const completedOrders = orders.filter(o => o.status === "delivered" || o.status === "cancelled");

  return {
    orders,
    driverProfile,
    loading,
    loadData,
    updateStatus,
    acceptOrder,
    updateOrderStatus,
    availableOrders,
    activeOrder,
    completedOrders,
  };
}
