"use client";
import { useState, useCallback } from "react";
import type { MenuItemDB, OrderDB } from "@/lib/types";

export function usePosCart(loadData: () => Promise<void>, apiFetch: (url: string, options?: RequestInit) => Promise<Response>) {
  const [posCart, setPosCart] = useState<{ menuItem: MenuItemDB; qty: number; note: string }[]>([]);
  const [posTable, setPosTable] = useState(1);
  const [posOrderType, setPosOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [posPayment, setPosPayment] = useState("cash");
  const [posDiscount, setPosDiscount] = useState(0);
  const [posCustomerName, setPosCustomerName] = useState("");
  const [posCustomerPhone, setPosCustomerPhone] = useState("");
  const [posNote, setPosNote] = useState("");
  const [posCategoryFilter, setPosCategoryFilter] = useState("all");
  const [posSearch, setPosSearch] = useState("");
  const [posReceipt, setPosReceipt] = useState<OrderDB | null>(null);
  const [posSubmitting, setPosSubmitting] = useState(false);

  const posTotal = posCart.reduce((sum, item) => sum + item.menuItem.price * item.qty, 0);

  const submitPosOrder = useCallback(async () => {
    if (posCart.length === 0) return;
    setPosSubmitting(true);
    try {
      const res = await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          items: JSON.stringify(posCart.map(c => ({ name: c.menuItem.name, price: c.menuItem.price, qty: c.qty, note: c.note }))),
          total: posTotal - posDiscount,
          orderType: posOrderType,
          paymentMethod: posPayment,
          tableNumber: posTable,
          discount: posDiscount,
          customerName: posCustomerName || "Walk-in Client",
          phone: posCustomerPhone,
          note: posNote,
          deliveryFee: 0,
          tax: 0,
        }),
      });
      if (res.ok) {
        const order = await res.json();
        setPosReceipt(order);
        setPosCart([]);
        setPosDiscount(0);
        setPosCustomerName("");
        setPosCustomerPhone("");
        setPosNote("");
        setPosTable(1);
        await loadData();
      }
    } catch { /* error */ }
    finally { setPosSubmitting(false); }
  }, [posCart, posTotal, posDiscount, posOrderType, posPayment, posTable, posCustomerName, posCustomerPhone, posNote, apiFetch, loadData]);

  return {
    posCart, setPosCart, posTable, setPosTable, posOrderType, setPosOrderType,
    posPayment, setPosPayment, posDiscount, setPosDiscount, posCustomerName, setPosCustomerName,
    posCustomerPhone, setPosCustomerPhone, posNote, setPosNote, posCategoryFilter, setPosCategoryFilter,
    posSearch, setPosSearch, posReceipt, setPosReceipt, posSubmitting, setPosSubmitting,
    posTotal, submitPosOrder,
  };
}
