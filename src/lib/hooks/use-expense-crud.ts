"use client";
import { useState, useCallback } from "react";
import type { ExpenseDB } from "@/lib/types";

const DEFAULT_EXPENSE_FORM = { description: "", amount: 0, category: "other", date: "", paidBy: "", notes: "" };

export function useExpenseCrud(
  apiPatch: (url: string, body: object) => Promise<{ success: boolean; error?: string }>,
  apiPost: (url: string, body: object) => Promise<{ success: boolean; error?: string }>,
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

  const saveExpense = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (editingExpense) {
      const result = await apiPatch("/api/expenses", { id: editingExpense.id, ...expenseForm });
      if (!result.success) return result;
    } else {
      const result = await apiPost("/api/expenses", expenseForm);
      if (!result.success) return result;
    }
    setShowExpenseForm(false);
    setEditingExpense(null);
    return { success: true };
  }, [editingExpense, expenseForm, apiPatch, apiPost]);

  return {
    showExpenseForm, setShowExpenseForm, editingExpense, deleteExpenseConfirm, setDeleteExpenseConfirm,
    expenseForm, setExpenseForm, openAddExpense, openEditExpense, saveExpense,
  };
}
