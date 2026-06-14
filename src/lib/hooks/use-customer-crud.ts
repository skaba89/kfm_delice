"use client";
import { useState, useCallback } from "react";
import type { CustomerDB } from "@/lib/types";

const DEFAULT_CUSTOMER_FORM = { name: "", email: "", phone: "", address: "", status: "active" };

export function useCustomerCrud(
  apiPatch: (url: string, body: object) => Promise<{ success: boolean; error?: string }>,
  apiPost: (url: string, body: object) => Promise<{ success: boolean; error?: string }>,
) {
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDB | null>(null);
  const [deleteCustomerConfirm, setDeleteCustomerConfirm] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState(DEFAULT_CUSTOMER_FORM);

  const openAddCustomer = useCallback(() => {
    setEditingCustomer(null);
    setCustomerForm(DEFAULT_CUSTOMER_FORM);
    setShowCustomerForm(true);
  }, []);

  const openEditCustomer = useCallback((c: CustomerDB) => {
    setEditingCustomer(c);
    setCustomerForm({ name: c.name, email: c.email, phone: c.phone, address: c.address, status: c.status });
    setShowCustomerForm(true);
  }, []);

  const saveCustomer = useCallback(async () => {
    if (editingCustomer) {
      const result = await apiPatch("/api/customers", { id: editingCustomer.id, ...customerForm });
      if (!result.success) return;
    } else {
      const result = await apiPost("/api/customers", customerForm);
      if (!result.success) return;
    }
    setShowCustomerForm(false);
    setEditingCustomer(null);
  }, [editingCustomer, customerForm, apiPatch, apiPost]);

  return {
    showCustomerForm, setShowCustomerForm, editingCustomer, deleteCustomerConfirm, setDeleteCustomerConfirm,
    customerForm, setCustomerForm, openAddCustomer, openEditCustomer, saveCustomer,
  };
}
