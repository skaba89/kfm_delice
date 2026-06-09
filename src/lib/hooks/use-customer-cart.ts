"use client";

import { useState, useCallback } from "react";
import type { MenuItemDB, CustomerUser } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/lib/notifications";
import { getTier } from "@/lib/hooks/use-loyalty";

export interface CartItem {
  item: MenuItemDB;
  qty: number;
}

export interface CheckoutForm {
  address: string;
  paymentMethod: string;
  note: string;
}

export function useCustomerCart(customer: CustomerUser, onOrderPlaced: () => void) {
  const { apiFetch } = useAuth();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderCategoryFilter, setOrderCategoryFilter] = useState("all");
  const [checkoutStep, setCheckoutStep] = useState<"menu" | "cart" | "checkout">("menu");
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    address: customer.address || "",
    paymentMethod: "cash",
    note: "",
  });
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(5000);

  // Calculate loyalty discount
  const tier = getTier(customer.loyaltyPoints);
  const discountPercent = parseFloat(tier.discount) || 0;

  const addToCart = useCallback((item: MenuItemDB) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { item, qty: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => prev.filter(c => c.item.id !== itemId));
  }, []);

  const updateCartQty = useCallback((itemId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(c => c.item.id !== itemId));
      return;
    }
    setCart(prev => prev.map(c => c.item.id === itemId ? { ...c, qty } : c));
  }, []);

  const cartSubtotal = cart.reduce((sum, c) => sum + c.item.price * c.qty, 0);
  const discountAmount = Math.round(cartSubtotal * (discountPercent / 100));
  const cartTotal = cartSubtotal - discountAmount;

  // Fetch delivery fee from restaurant settings
  const fetchDeliveryFee = useCallback(async () => {
    try {
      const res = await fetch("/api/menu?limit=1");
      if (res.ok) {
        // The menu API returns restaurant data that includes deliveryFee
        // We can also fetch it from the stats endpoint
        const token = localStorage.getItem('kfm_delice_token');
        if (token) {
          const statsRes = await fetch("/api/stats", {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            if (statsData.deliveryFee) {
              setDeliveryFee(statsData.deliveryFee);
            }
          }
        }
      }
    } catch {
      // Keep default fee
    }
  }, []);

  const submitOrder = useCallback(async () => {
    if (cart.length === 0) return;
    setOrderSubmitting(true);
    try {
      const items = cart.map(c => ({ name: c.item.name, price: c.item.price, qty: c.qty }));
      const res = await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: customer.name,
          phone: customer.phone,
          items: JSON.stringify(items),
          total: cartTotal,
          orderType: "delivery",
          paymentMethod: checkoutForm.paymentMethod,
          deliveryAddress: checkoutForm.address,
          deliveryFee,
          discount: discountAmount,
          note: checkoutForm.note,
        }),
      });
      if (res.ok) {
        setCart([]);
        setCheckoutStep("menu");
        setCheckoutForm({ address: customer.address || "", paymentMethod: "cash", note: "" });
        onOrderPlaced();
        notify.success("Commande passée avec succès !");
      } else {
        notify.error("Erreur lors de la commande");
      }
    } catch {
      notify.error("Erreur de connexion");
    } finally {
      setOrderSubmitting(false);
    }
  }, [cart, cartTotal, checkoutForm, customer, apiFetch, onOrderPlaced, deliveryFee, discountAmount]);

  return {
    cart,
    addToCart,
    removeFromCart,
    updateCartQty,
    cartSubtotal,
    cartTotal,
    discountPercent,
    discountAmount,
    deliveryFee,
    orderCategoryFilter,
    setOrderCategoryFilter,
    checkoutStep,
    setCheckoutStep,
    checkoutForm,
    setCheckoutForm,
    orderSubmitting,
    submitOrder,
    fetchDeliveryFee,
  };
}
