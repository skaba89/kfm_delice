"use client";
import { useState, useCallback } from "react";
import type { InvoiceDB } from "@/lib/types";

const createDefaultInvoice = (count: number) => {
  const today = new Date().toISOString().split("T")[0];
  return {
    number: `FAC-${new Date().getFullYear()}-${String(count).padStart(3, "0")}`,
    customerName: "", customerPhone: "", items: "[]",
    subtotal: 0, tax: 0, total: 0, status: "pending", dueDate: today, notes: "",
  };
};

export function useInvoiceCrud(
  invoices: InvoiceDB[],
  apiPatch: (url: string, body: object) => Promise<{ success: boolean; error?: string }>,
  apiPost: (url: string, body: object) => Promise<{ success: boolean; error?: string }>,
) {
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceDB | null>(null);
  const [deleteInvoiceConfirm, setDeleteInvoiceConfirm] = useState<string | null>(null);
  const [invoiceForm, setInvoiceForm] = useState(createDefaultInvoice(0));

  const openAddInvoice = useCallback(() => {
    setEditingInvoice(null);
    setInvoiceForm(createDefaultInvoice(invoices.length + 1));
    setShowInvoiceForm(true);
  }, [invoices.length]);

  const openEditInvoice = useCallback((inv: InvoiceDB) => {
    setEditingInvoice(inv);
    setInvoiceForm({
      number: inv.number, customerName: inv.customerName, customerPhone: inv.customerPhone,
      items: inv.items, subtotal: inv.subtotal, tax: inv.tax, total: inv.total,
      status: inv.status, dueDate: inv.dueDate, notes: inv.notes,
    });
    setShowInvoiceForm(true);
  }, []);

  const saveInvoice = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (editingInvoice) {
      const result = await apiPatch("/api/invoices", { id: editingInvoice.id, ...invoiceForm });
      if (!result.success) return result;
    } else {
      const result = await apiPost("/api/invoices", invoiceForm);
      if (!result.success) return result;
    }
    setShowInvoiceForm(false);
    setEditingInvoice(null);
    return { success: true };
  }, [editingInvoice, invoiceForm, apiPatch, apiPost]);

  return {
    showInvoiceForm, setShowInvoiceForm, editingInvoice, deleteInvoiceConfirm, setDeleteInvoiceConfirm,
    invoiceForm, setInvoiceForm, openAddInvoice, openEditInvoice, saveInvoice,
  };
}
