"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useWebSocket } from "@/hooks/use-websocket";
import { notify } from "@/lib/notifications";
import { WSEvents } from "@/lib/ws-events";
import type { Stats, Reservation, MenuItemDB, OrderDB, DriverDB, ReviewDB, StaffDB, AdminDB, InvoiceDB, QuoteDB, ExpenseDB, CustomerDB, PaymentDB } from "@/lib/types";

// ─── Tab → API mapping ────────────────────────────────────────────
const TAB_API_MAP: Record<string, string> = {
  overview: "/api/stats",
  reservations: "/api/reservations",
  orders: "/api/orders",
  menu: "/api/menu",
  deliveries: "/api/orders",
  drivers: "/api/drivers",
  reviews: "/api/reviews",
  staff: "/api/staff",
  admins: "/api/admins",
  invoices: "/api/invoices",
  quotes: "/api/quotes",
  expenses: "/api/expenses",
  customers: "/api/customers",
  payments: "/api/payment",
  pos: "/api/menu",
};

// ─── Data shape for each tab ──────────────────────────────────────
interface TabData {
  reservations: Reservation[];
  menuItems: MenuItemDB[];
  orders: OrderDB[];
  drivers: DriverDB[];
  reviews: ReviewDB[];
  staffList: StaffDB[];
  admins: AdminDB[];
  invoices: InvoiceDB[];
  quotes: QuoteDB[];
  expenses: ExpenseDB[];
  customers: CustomerDB[];
  payments: PaymentDB[];
}

const EMPTY_TAB_DATA: TabData = {
  reservations: [],
  menuItems: [],
  orders: [],
  drivers: [],
  reviews: [],
  staffList: [],
  admins: [],
  invoices: [],
  quotes: [],
  expenses: [],
  customers: [],
  payments: [],
};

// ─── Helper: extract data from paginated or raw API response ──────
function extractData<T>(raw: T[] | { data: T[] }): T[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "data" in raw) return (raw as { data: T[] }).data;
  return [];
}

export function useAdminData(activeTab: string, adminId: string) {
  const { apiFetch } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [tabData, setTabData] = useState<TabData>(EMPTY_TAB_DATA);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);

  // Track which tabs have been loaded (cache)
  const loadedTabs = useRef<Set<string>>(new Set());
  // Track the currently loading tab to prevent duplicate fetches
  const loadingTabRef = useRef<string | null>(null);

  // ─── Load stats (lightweight, always needed for sidebar) ───────
  const loadStats = useCallback(async () => {
    try {
      const res = await apiFetch("/api/stats");
      if (res.ok) {
        const newStats = await res.json();
        setStats(newStats);
        return newStats;
      }
    } catch (e) { console.error("[admin-data] Stats load error:", e); }
    return null;
  }, [apiFetch]);

  // ─── Load data for a specific tab ──────────────────────────────
  const loadTabData = useCallback(async (tab: string, forceRefresh = false) => {
    if (!forceRefresh && loadedTabs.current.has(tab) && tab !== "overview") {
      // Already cached — skip (unless force refresh)
      return;
    }
    if (loadingTabRef.current === tab) return; // Prevent duplicate
    loadingTabRef.current = tab;

    if (tab !== "overview") setTabLoading(true);

    try {
      const endpoints: string[] = [];
      // Map tab to the endpoint(s) it needs
      switch (tab) {
        case "reservations":
          endpoints.push("/api/reservations?limit=100");
          break;
        case "orders":
        case "deliveries":
          endpoints.push("/api/orders?limit=100");
          break;
        case "menu":
        case "pos":
          endpoints.push("/api/menu?limit=200");
          break;
        case "drivers":
          endpoints.push("/api/drivers?limit=100");
          break;
        case "reviews":
          endpoints.push("/api/reviews?limit=100");
          break;
        case "staff":
          endpoints.push("/api/staff?limit=100");
          break;
        case "admins":
          endpoints.push("/api/admins?limit=100");
          break;
        case "invoices":
          endpoints.push("/api/invoices?limit=100");
          break;
        case "quotes":
          endpoints.push("/api/quotes?limit=100");
          break;
        case "expenses":
          endpoints.push("/api/expenses?limit=100");
          break;
        case "customers":
          endpoints.push("/api/customers?limit=100");
          break;
        case "payments":
          endpoints.push("/api/payment?limit=100");
          break;
        default:
          break;
      }

      // For "deliveries" tab, also load drivers
      if (tab === "deliveries") {
        endpoints.push("/api/drivers?limit=100");
      }

      // For "pos" tab, also load orders
      if (tab === "pos") {
        endpoints.push("/api/orders?limit=100");
      }

      if (endpoints.length === 0) {
        loadedTabs.current.add(tab);
        loadingTabRef.current = null;
        if (tab !== "overview") setTabLoading(false);
        return;
      }

      const results = await Promise.all(
        endpoints.map(url => apiFetch(url).then(r => r.json()).catch(() => []))
      );

      setTabData(prev => {
        const updated = { ...prev };
        if (tab === "reservations" || (tab === "overview" && endpoints[0]?.includes("reservations"))) {
          updated.reservations = extractData<Reservation>(results[0]);
        }
        if (tab === "orders" || tab === "deliveries") {
          updated.orders = extractData<OrderDB>(results[0]);
        }
        if (tab === "menu" || tab === "pos") {
          updated.menuItems = extractData<MenuItemDB>(results[0]);
        }
        if (tab === "drivers" || tab === "deliveries") {
          const driverIdx = tab === "deliveries" ? 1 : 0;
          updated.drivers = extractData<DriverDB>(results[driverIdx] || []);
        }
        if (tab === "reviews") {
          updated.reviews = extractData<ReviewDB>(results[0]);
        }
        if (tab === "staff") {
          updated.staffList = extractData<StaffDB>(results[0]);
        }
        if (tab === "admins") {
          updated.admins = extractData<AdminDB>(results[0]);
        }
        if (tab === "invoices") {
          updated.invoices = extractData<InvoiceDB>(results[0]);
        }
        if (tab === "quotes") {
          updated.quotes = extractData<QuoteDB>(results[0]);
        }
        if (tab === "expenses") {
          updated.expenses = extractData<ExpenseDB>(results[0]);
        }
        if (tab === "customers") {
          updated.customers = extractData<CustomerDB>(results[0]);
        }
        if (tab === "payments") {
          updated.payments = extractData<PaymentDB>(results[0]);
        }
        if (tab === "pos") {
          updated.orders = extractData<OrderDB>(results[1] || []);
        }
        return updated;
      });

      loadedTabs.current.add(tab);
    } catch (e) {
      console.error("[admin-data] Tab load error:", e);
    } finally {
      loadingTabRef.current = null;
      if (tab !== "overview") setTabLoading(false);
    }
  }, [apiFetch]);

  // ─── Initial load: stats only, then active tab data ────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const newStats = await loadStats();
      if (!cancelled && newStats) {
        // Load the initially active tab's data
        await loadTabData(activeTab);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Load tab data when activeTab changes ──────────────────────
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      loadTabData(activeTab);
    }
  }, [activeTab, loadTabData]);

  // ─── WebSocket integration for real-time updates ───────────────
  const { connected: wsConnected, on, off } = useWebSocket(adminId, "admin", {
    enabled: !!adminId,
    autoReconnect: true,
  });

  // WS event handlers — refresh specific data on events
  useEffect(() => {
    const handleNewOrder = () => {
      notify.newOrder("Nouveau client");
      loadStats(); // Refresh badge counts
      // Invalidate orders cache so next visit reloads
      loadedTabs.current.delete("orders");
      loadedTabs.current.delete("deliveries");
      // If currently on orders/deliveries tab, reload
      if (activeTab === "orders" || activeTab === "deliveries") {
        loadTabData(activeTab, true);
      }
    };

    const handleOrderStatusChanged = () => {
      loadStats();
      loadedTabs.current.delete("orders");
      loadedTabs.current.delete("deliveries");
      if (activeTab === "orders" || activeTab === "deliveries") {
        loadTabData(activeTab, true);
      }
    };

    const handleNewReservation = () => {
      notify.newReservation("Nouveau client");
      loadStats();
      loadedTabs.current.delete("reservations");
      if (activeTab === "reservations") {
        loadTabData(activeTab, true);
      }
    };

    const handleReservationStatusChanged = () => {
      loadStats();
      loadedTabs.current.delete("reservations");
      if (activeTab === "reservations") {
        loadTabData(activeTab, true);
      }
    };

    const handleDriverStatusChanged = () => {
      loadStats();
      loadedTabs.current.delete("drivers");
      if (activeTab === "drivers") {
        loadTabData(activeTab, true);
      }
    };

    const handleDriverLocationUpdate = () => {
      // Only refresh if on deliveries tab (shows map)
      if (activeTab === "deliveries") {
        loadedTabs.current.delete("deliveries");
        loadTabData("deliveries", true);
      }
    };

    const handleAdminNotification = () => {
      loadStats(); // Refresh badge counts
    };

    // Register WS listeners
    on(WSEvents.ORDER_NEW, handleNewOrder);
    on(WSEvents.ORDER_STATUS_CHANGED, handleOrderStatusChanged);
    on(WSEvents.ORDER_ASSIGNED, handleOrderStatusChanged);
    on(WSEvents.RESERVATION_NEW, handleNewReservation);
    on(WSEvents.RESERVATION_STATUS_CHANGED, handleReservationStatusChanged);
    on(WSEvents.DRIVER_STATUS_CHANGED, handleDriverStatusChanged);
    on(WSEvents.DRIVER_LOCATION_UPDATE, handleDriverLocationUpdate);
    on(WSEvents.ADMIN_NOTIFICATION, handleAdminNotification);

    return () => {
      off(WSEvents.ORDER_NEW, handleNewOrder);
      off(WSEvents.ORDER_STATUS_CHANGED, handleOrderStatusChanged);
      off(WSEvents.ORDER_ASSIGNED, handleOrderStatusChanged);
      off(WSEvents.RESERVATION_NEW, handleNewReservation);
      off(WSEvents.RESERVATION_STATUS_CHANGED, handleReservationStatusChanged);
      off(WSEvents.DRIVER_STATUS_CHANGED, handleDriverStatusChanged);
      off(WSEvents.DRIVER_LOCATION_UPDATE, handleDriverLocationUpdate);
      off(WSEvents.ADMIN_NOTIFICATION, handleAdminNotification);
    };
  }, [on, off, activeTab, loadStats, loadTabData]);

  // ─── Full refresh (manual) ─────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    await loadStats();
    // Invalidate all caches and reload active tab
    loadedTabs.current.clear();
    await loadTabData(activeTab, true);
    setLoading(false);
  }, [loadStats, loadTabData, activeTab]);

  // ─── Refresh after CRUD: refresh stats + active tab ────────────
  const refreshAfterMutation = useCallback(async () => {
    await loadStats();
    loadedTabs.current.delete(activeTab);
    await loadTabData(activeTab, true);
  }, [loadStats, loadTabData, activeTab]);

  // ─── Generic CRUD helpers ──────────────────────────────────────
  const apiPatch = useCallback(async (url: string, body: object) => {
    await apiFetch(url, { method: "PATCH", body: JSON.stringify(body) });
    await refreshAfterMutation();
  }, [apiFetch, refreshAfterMutation]);

  const apiPost = useCallback(async (url: string, body: object) => {
    const res = await apiFetch(url, { method: "POST", body: JSON.stringify(body) });
    await refreshAfterMutation();
    return res;
  }, [apiFetch, refreshAfterMutation]);

  const apiDelete = useCallback(async (url: string, body: object) => {
    await apiFetch(url, { method: "DELETE", body: JSON.stringify(body) });
    await refreshAfterMutation();
  }, [apiFetch, refreshAfterMutation]);

  return {
    stats,
    reservations: tabData.reservations,
    menuItems: tabData.menuItems,
    orders: tabData.orders,
    drivers: tabData.drivers,
    reviews: tabData.reviews,
    staffList: tabData.staffList,
    admins: tabData.admins,
    invoices: tabData.invoices,
    quotes: tabData.quotes,
    expenses: tabData.expenses,
    customers: tabData.customers,
    payments: tabData.payments,
    loading,
    tabLoading,
    wsConnected,
    loadData,
    apiPatch,
    apiPost,
    apiDelete,
    apiFetch,
  };
}
