"use client";

import { useState, useEffect, useCallback } from "react";
import type { Reservation, OrderDB, ReviewDB, CustomerUser, MenuItemDB } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/lib/notifications";

export function useCustomerData(customer: CustomerUser, onUpdate: (c: CustomerUser) => void) {
  const { apiFetch } = useAuth();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [orders, setOrders] = useState<OrderDB[]>([]);
  const [reviews, setReviews] = useState<ReviewDB[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemDB[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile edit form
  const [profileForm, setProfileForm] = useState({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
  });
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // Review form
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewMsg, setReviewMsg] = useState("");

  // Reservation form
  const [showQuickReserve, setShowQuickReserve] = useState(false);
  const [reserveForm, setReserveForm] = useState({
    date: new Date().toISOString().split("T")[0],
    time: "19:00",
    guests: 2,
    zone: "interieur",
    notes: "",
  });
  const [reserveSaving, setReserveSaving] = useState(false);

  // Order filter
  const [orderFilter, setOrderFilter] = useState<"all" | "active" | "completed" | "cancelled">("all");
  const [orderSearch, setOrderSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const allParams = "?limit=1000";
      const [r, o, rv, m] = await Promise.all([
        apiFetch(`/api/reservations${allParams}`).then(r => r.json()).catch(() => ({ data: [] })),
        apiFetch(`/api/orders${allParams}`).then(r => r.json()).catch(() => ({ data: [] })),
        apiFetch(`/api/reviews${allParams}`).then(r => r.json()).catch(() => ({ data: [] })),
        apiFetch(`/api/menu${allParams}`).then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      setReservations(Array.isArray(r) ? r : (r.data || []));
      setOrders(Array.isArray(o) ? o : (o.data || []));
      setReviews(Array.isArray(rv) ? rv : (rv.data || []));
      setMenuItems(Array.isArray(m) ? m : (m.data || []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg("");
    try {
      const res = await apiFetch("/api/customers", {
        method: "PATCH",
        body: JSON.stringify({ id: customer.id, ...profileForm }),
      });
      if (res.ok) {
        onUpdate({ ...customer, ...profileForm });
        setProfileMsg("Profil mis à jour avec succès !");
        notify.profileUpdated();
      } else {
        setProfileMsg("Erreur lors de la mise à jour");
      }
    } catch {
      setProfileMsg("Erreur de connexion");
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async () => {
    if (!passwordForm.current || !passwordForm.new) return;
    setProfileSaving(true);
    setProfileMsg("");
    try {
      const res = await apiFetch("/api/customers", {
        method: "PATCH",
        body: JSON.stringify({
          id: customer.id,
          currentPassword: passwordForm.current,
          password: passwordForm.new,
        }),
      });
      if (res.ok) {
        setProfileMsg("Mot de passe modifié !");
        setPasswordForm({ current: "", new: "" });
        notify.passwordChanged();
      } else {
        const data = await res.json().catch(() => null);
        setProfileMsg(data?.error || "Erreur lors du changement de mot de passe");
      }
    } catch {
      setProfileMsg("Erreur de connexion");
    } finally {
      setProfileSaving(false);
    }
  };

  const submitReview = async () => {
    setReviewSaving(true);
    setReviewMsg("");
    try {
      const months = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
      ];
      const now = new Date();
      const dateStr = `${months[now.getMonth()]} ${now.getFullYear()}`;
      const res = await apiFetch("/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          customerName: customer.name,
          rating: reviewForm.rating,
          comment: reviewForm.comment,
          date: dateStr,
        }),
      });
      if (res.ok) {
        setReviewMsg("Avis publié avec succès !");
        setReviewForm({ rating: 5, comment: "" });
        loadData();
        notify.reviewPublished();
      } else {
        setReviewMsg("Erreur lors de la publication");
      }
    } catch {
      setReviewMsg("Erreur de connexion");
    } finally {
      setReviewSaving(false);
    }
  };

  const submitReservation = async () => {
    setReserveSaving(true);
    try {
      const res = await apiFetch("/api/reservations", {
        method: "POST",
        body: JSON.stringify({ customerName: customer.name, phone: customer.phone, ...reserveForm }),
      });
      if (res.ok) {
        setShowQuickReserve(false);
        setReserveForm({
          date: new Date().toISOString().split("T")[0],
          time: "19:00",
          guests: 2,
          zone: "interieur",
          notes: "",
        });
        loadData();
        notify.success("Réservation envoyée avec succès !");
      }
    } catch {
      notify.error("Erreur de connexion");
    } finally {
      setReserveSaving(false);
    }
  };

  const reorder = async (order: OrderDB) => {
    try {
      const items: { name: string; price: number; qty: number }[] = JSON.parse(order.items);
      const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
      const res = await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: customer.name,
          phone: customer.phone,
          items: order.items,
          total,
          orderType: order.orderType,
          paymentMethod: order.paymentMethod,
          deliveryAddress: order.deliveryAddress,
          deliveryFee: order.deliveryFee,
          note: "Recommande",
        }),
      });
      if (res.ok) {
        loadData();
        notify.success("Commande re-passée avec succès !");
      }
    } catch {
      notify.error("Erreur de connexion");
    }
  };

  return {
    reservations,
    orders,
    reviews,
    menuItems,
    loading,
    loadData,
    // Profile
    profileForm,
    setProfileForm,
    passwordForm,
    setPasswordForm,
    profileSaving,
    profileMsg,
    saveProfile,
    savePassword,
    // Review
    reviewForm,
    setReviewForm,
    reviewSaving,
    reviewMsg,
    submitReview,
    // Reservation
    showQuickReserve,
    setShowQuickReserve,
    reserveForm,
    setReserveForm,
    reserveSaving,
    submitReservation,
    // Order filter
    orderFilter,
    setOrderFilter,
    orderSearch,
    setOrderSearch,
    // Reorder
    reorder,
  };
}
