"use client";
import { useState, useCallback } from "react";
import type { QuoteDB } from "@/lib/types";

const createDefaultQuote = (count: number) => ({
  number: `DEV-2026-${String(count).padStart(3, "0")}`,
  customerName: "", customerPhone: "", items: "[]",
  subtotal: 0, discount: 0, total: 0, status: "draft", validUntil: "", notes: "",
});

export function useQuoteCrud(
  quotes: QuoteDB[],
  apiPatch: (url: string, body: object) => Promise<void>,
  apiPost: (url: string, body: object) => Promise<Response>,
) {
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuoteDB | null>(null);
  const [deleteQuoteConfirm, setDeleteQuoteConfirm] = useState<string | null>(null);
  const [quoteForm, setQuoteForm] = useState(createDefaultQuote(0));

  const openAddQuote = useCallback(() => {
    setEditingQuote(null);
    setQuoteForm(createDefaultQuote(quotes.length + 1));
    setShowQuoteForm(true);
  }, [quotes.length]);

  const openEditQuote = useCallback((q: QuoteDB) => {
    setEditingQuote(q);
    setQuoteForm({
      number: q.number, customerName: q.customerName, customerPhone: q.customerPhone,
      items: q.items, subtotal: q.subtotal, discount: q.discount, total: q.total,
      status: q.status, validUntil: q.validUntil, notes: q.notes,
    });
    setShowQuoteForm(true);
  }, []);

  const saveQuote = useCallback(async () => {
    if (editingQuote) {
      await apiPatch("/api/quotes", { id: editingQuote.id, ...quoteForm });
    } else {
      await apiPost("/api/quotes", quoteForm);
    }
    setShowQuoteForm(false);
    setEditingQuote(null);
  }, [editingQuote, quoteForm, apiPatch, apiPost]);

  return {
    showQuoteForm, setShowQuoteForm, editingQuote, deleteQuoteConfirm, setDeleteQuoteConfirm,
    quoteForm, setQuoteForm, openAddQuote, openEditQuote, saveQuote,
  };
}
