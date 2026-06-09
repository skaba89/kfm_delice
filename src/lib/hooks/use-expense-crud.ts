"use client";
import { useState, useCallback } from "react";
import type { ExpenseDB } from "@/lib/types";

const DEFAULT_EXPENSE_FORM = { description: "", amount: 0, category: "other", date: "", paidBy: "", notes: "" };

export function useExpenseCrud(
  apiPatch: (url: string, body: object) => Promise<void>,
  apiPost: (url: string, body: object) => Promise<Response>,
) {
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseDB | null>(null);
  const [deleteExpenseConfirm, setDeleteExpenseConfirm] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState(DEFAULT_EXPENSE_FORM);

  const openAddExpense = useCallback(() => {
    setEditingExpense(null);
    setExpenseForm({ ...DEFAULT_EXPENSE_FORM, date: new Date().toISOString().split("T")[0] });
    setShowExpenseForm(true);
  }, []);

  const openEditExpense = useCallback((e: ExpenseDB) => {
    setEditingExpense(e);
    setExpenseForm({ description: e.description, amount: e.amount, category: e.category, date: e.date, paidBy: e.paidBy, notes: e.notes });
    setShowExpenseForm(true);
  }, []);

  const saveExpense = useCallback(async () => {
    if (editingExpense) {
      await apiPatch("/api/expenses", { id: editingExpense.id, ...expenseForm });
    } else {
      await apiPost("/api/expenses", expenseForm);
    }
    setShowExpenseForm(false);
    setEditingExpense(null);
  }, [editingExpense, expenseForm, apiPatch, apiPost]);

  return {
    showExpenseForm, setShowExpenseForm, editingExpense, deleteExpenseConfirm, setDeleteExpenseConfirm,
    expenseForm, setExpenseForm, openAddExpense, openEditExpense, saveExpense,
  };
}
