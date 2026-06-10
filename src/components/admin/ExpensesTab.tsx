"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import type { ExpenseDB } from "@/lib/types";
import { formatPrice, expenseCategoryLabels, expenseCategoryColors } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { AdminFormCard } from "@/components/admin/shared/AdminFormCard";
import { DeleteConfirmButton } from "@/components/admin/shared/DeleteConfirmButton";
import { EditButton } from "@/components/admin/shared/EditButton";
import { FormField } from "@/components/admin/shared/FormField";
import { FormSelect } from "@/components/admin/shared/FormSelect";

export interface ExpensesTabProps {
  expenses: ExpenseDB[];
  showExpenseForm: boolean;
  editingExpense: ExpenseDB | null;
  expenseForm: { description: string; amount: number; category: string; date: string; paidBy: string; notes: string };
  setExpenseForm: (v: { description: string; amount: number; category: string; date: string; paidBy: string; notes: string }) => void;
  openAddExpense: () => void;
  openEditExpense: (e: ExpenseDB) => void;
  saveExpense: () => Promise<void>;
  setShowExpenseForm: (v: boolean) => void;
  apiPatch: (url: string, body: object) => Promise<void>;
  apiDelete: (url: string, body: object) => Promise<void>;
  deleteExpenseConfirm: string | null;
  setDeleteExpenseConfirm: (v: string | null) => void;
}

export function ExpensesTab({
  expenses, showExpenseForm, editingExpense, expenseForm, setExpenseForm,
  openAddExpense, openEditExpense, saveExpense, setShowExpenseForm,
  apiPatch, apiDelete, deleteExpenseConfirm, setDeleteExpenseConfirm,
}: ExpensesTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(expenses, 10);

  const handleSaveExpense = async () => {
    await saveExpense();
    notify.expenseSaved(expenseForm.description);
  };

  const handleDeleteExpense = async (e: ExpenseDB) => {
    await apiDelete("/api/expenses", { id: e.id });
    setDeleteExpenseConfirm(null);
    notify.expenseDeleted(e.description);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total: <span className="font-bold text-gray-900 dark:text-gray-100">{formatPrice(expenses.reduce((s, e) => s + e.amount, 0))}</span></p>
        </div>
        <Button onClick={openAddExpense} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
          <Plus className="w-4 h-4 mr-1" /> Ajouter une dépense
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {Object.entries(expenseCategoryLabels).map(([key, label]) => {
          const total = expenses.filter(e => e.category === key).reduce((s, e) => s + e.amount, 0);
          return (
            <Card key={key} className="hover:shadow-sm transition-shadow dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-2.5 text-center">
              <Badge className={`${expenseCategoryColors[key]} text-[10px] mb-1`}>{label}</Badge>
              <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{formatPrice(total)}</p>
            </CardContent></Card>
          );
        })}
      </div>

      <AdminFormCard
        show={showExpenseForm}
        editing={!!editingExpense}
        addTitle="Ajouter une dépense"
        editTitle="Modifier la dépense"
        onSave={handleSaveExpense}
        onCancel={() => setShowExpenseForm(false)}
      >
        <FormField label="Description" value={expenseForm.description} onChange={v => setExpenseForm({ ...expenseForm, description: v })} placeholder="Description de la dépense" required />
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Montant (GNF) *</label>
          <Input type="number" value={expenseForm.amount || ""} onChange={e => setExpenseForm({ ...expenseForm, amount: parseInt(e.target.value) || 0 })} placeholder="500000" className="dark:bg-gray-800 dark:border-gray-600" />
        </div>
        <FormSelect label="Catégorie" value={expenseForm.category} onChange={v => setExpenseForm({ ...expenseForm, category: v })} options={Object.entries(expenseCategoryLabels).map(([k, v]) => ({ value: k, label: v }))} required />
        <FormField label="Date" value={expenseForm.date} onChange={v => setExpenseForm({ ...expenseForm, date: v })} type="date" required />
        <FormField label="Payé par" value={expenseForm.paidBy} onChange={v => setExpenseForm({ ...expenseForm, paidBy: v })} placeholder="Nom" />
        <FormField label="Notes" value={expenseForm.notes} onChange={v => setExpenseForm({ ...expenseForm, notes: v })} placeholder="Notes" />
      </AdminFormCard>

      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Montant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Catégorie</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Payé par</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr></thead>
            <tbody className="divide-y dark:divide-gray-700">
              {paginatedItems.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{e.description}</p>{e.notes && <p className="text-xs text-gray-500 dark:text-gray-400">{e.notes}</p>}</td>
                  <td className="px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400">{formatPrice(e.amount)}</td>
                  <td className="px-4 py-3"><Badge className={`${expenseCategoryColors[e.category] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"} text-xs`}>{expenseCategoryLabels[e.category] || e.category}</Badge></td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{e.date}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{e.paidBy || "-"}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1">
                    <EditButton onClick={() => openEditExpense(e)} />
                    <DeleteConfirmButton
                      confirming={deleteExpenseConfirm === e.id}
                      onConfirm={() => handleDeleteExpense(e)}
                      onRequestConfirm={() => setDeleteExpenseConfirm(e.id)}
                      onCancel={() => setDeleteExpenseConfirm(null)}
                    />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="dépenses" />
    </div>
  );
}
