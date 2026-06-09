"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/lib/notifications";
import type { Stats, Reservation, MenuItemDB, OrderDB, DriverDB, ReviewDB, StaffDB, AdminDB, InvoiceDB, QuoteDB, ExpenseDB } from "@/lib/types";

export function useAdminData() {
  const { apiFetch } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemDB[]>([]);
  const [orders, setOrders] = useState<OrderDB[]>([]);
  const [drivers, setDrivers] = useState<DriverDB[]>([]);
  const [reviews, setReviews] = useState<ReviewDB[]>([]);
  const [staffList, setStaffList] = useState<StaffDB[]>([]);
  const [admins, setAdmins] = useState<AdminDB[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDB[]>([]);
  const [quotes, setQuotes] = useState<QuoteDB[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDB[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Admin dashboard needs all data — request with high limit
      const allParams = "?limit=1000";
      const [s, r, m, o, d, rv, st, ad, inv, quo, exp] = await Promise.all([
        apiFetch("/api/stats").then(r => r.json()),
        apiFetch(`/api/reservations${allParams}`).then(r => r.json()),
        apiFetch(`/api/menu${allParams}`).then(r => r.json()),
        apiFetch(`/api/orders${allParams}`).then(r => r.json()),
        apiFetch(`/api/drivers${allParams}`).then(r => r.json()),
        apiFetch(`/api/reviews${allParams}`).then(r => r.json()).catch(() => ({ data: [] })),
        apiFetch(`/api/staff${allParams}`).then(r => r.json()).catch(() => ({ data: [] })),
        apiFetch(`/api/admins${allParams}`).then(r => r.json()).catch(() => ({ data: [] })),
        apiFetch(`/api/invoices${allParams}`).then(r => r.json()).catch(() => ({ data: [] })),
        apiFetch(`/api/quotes${allParams}`).then(r => r.json()).catch(() => ({ data: [] })),
        apiFetch(`/api/expenses${allParams}`).then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      // Handle paginated responses (reviews returns {data, pagination})
      setStats(s);
      setReservations(Array.isArray(r) ? r : (r.data || []));
      setMenuItems(Array.isArray(m) ? m : (m.data || []));
      setOrders(Array.isArray(o) ? o : (o.data || []));
      setDrivers(Array.isArray(d) ? d : (d.data || []));
      setReviews(Array.isArray(rv) ? rv : (rv.data || []));
      setStaffList(Array.isArray(st) ? st : (st.data || []));
      setAdmins(Array.isArray(ad) ? ad : (ad.data || []));
      setInvoices(Array.isArray(inv) ? inv : (inv.data || []));
      setQuotes(Array.isArray(quo) ? quo : (quo.data || []));
      setExpenses(Array.isArray(exp) ? exp : (exp.data || []));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  // Notification polling
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch("/api/stats");
        if (res.ok) {
          const newStats = await res.json();
          if (stats && newStats.pendingReservations > (stats.pendingReservations || 0)) {
            notify.newReservation("Nouveau client");
          }
          if (stats && newStats.activeOrders > (stats.activeOrders || 0)) {
            notify.newOrder("Nouveau client");
          }
          setStats(newStats);
        }
      } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [apiFetch, stats?.pendingReservations, stats?.activeOrders]);

  // Generic CRUD helpers
  const apiPatch = useCallback(async (url: string, body: object) => {
    await apiFetch(url, { method: "PATCH", body: JSON.stringify(body) });
    loadData();
  }, [apiFetch, loadData]);

  const apiPost = useCallback(async (url: string, body: object) => {
    const res = await apiFetch(url, { method: "POST", body: JSON.stringify(body) });
    loadData();
    return res;
  }, [apiFetch, loadData]);

  const apiDelete = useCallback(async (url: string, body: object) => {
    await apiFetch(url, { method: "DELETE", body: JSON.stringify(body) });
    loadData();
  }, [apiFetch, loadData]);

  return {
    stats, reservations, menuItems, orders, drivers, reviews,
    staffList, admins, invoices, quotes, expenses, loading,
    loadData, apiPatch, apiPost, apiDelete, apiFetch,
  };
}
