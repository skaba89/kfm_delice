"use client";
import { useState, useCallback } from "react";
import type { InvoiceDB } from "@/lib/types";

const createDefaultInvoice = (count: number) => {
  const today = new Date().toISOString().split("T")[0];
  return {
    number: `FAC-2026-${String(count).padStart(3, "0")}`,
    customerName: "", customerPhone: "", items: "[]",
    subtotal: 0, tax: 0, total: 0, status: "pending", dueDate: today, notes: "",
  };
};

export function useInvoiceCrud(
  invoices: InvoiceDB[],
  apiPatch: (url: string, body: object) => Promise<void>,
  apiPost: (url: string, body: object) => Promise<Response>,
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

  const saveInvoice = useCallback(async () => {
    if (editingInvoice) {
      await apiPatch("/api/invoices", { id: editingInvoice.id, ...invoiceForm });
    } else {
      await apiPost("/api/invoices", invoiceForm);
    }
    setShowInvoiceForm(false);
    setEditingInvoice(null);
  }, [editingInvoice, invoiceForm, apiPatch, apiPost]);

  return {
    showInvoiceForm, setShowInvoiceForm, editingInvoice, deleteInvoiceConfirm, setDeleteInvoiceConfirm,
    invoiceForm, setInvoiceForm, openAddInvoice, openEditInvoice, saveInvoice,
  };
}
