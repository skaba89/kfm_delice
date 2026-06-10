"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Edit3, Trash2, Save } from "lucide-react";
import type { ExpenseDB } from "@/lib/types";
import { formatPrice, expenseCategoryLabels, expenseCategoryColors } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";

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

      <AnimatePresence>
        {showExpenseForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-900/10">
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{editingExpense ? "Modifier la dépense" : "Ajouter une dépense"}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Description *</label><Input value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Description de la dépense" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Montant (GNF) *</label><Input type="number" value={expenseForm.amount || ""} onChange={e => setExpenseForm({ ...expenseForm, amount: parseInt(e.target.value) || 0 })} placeholder="500000" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Catégorie *</label>
                    <select value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm dark:text-gray-100">
                      {Object.entries(expenseCategoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Date *</label><Input type="date" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Payé par</label><Input value={expenseForm.paidBy} onChange={e => setExpenseForm({ ...expenseForm, paidBy: e.target.value })} placeholder="Nom" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Notes</label><Input value={expenseForm.notes} onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })} placeholder="Notes" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleSaveExpense} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl"><Save className="w-4 h-4 mr-1" /> {editingExpense ? "Enregistrer" : "Ajouter"}</Button>
                  <Button variant="outline" onClick={() => { setShowExpenseForm(false); }} className="dark:border-gray-600">Annuler</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

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
                    <button onClick={() => openEditExpense(e)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-orange-900/30 dark:hover:text-orange-400" title="Modifier"><Edit3 className="w-4 h-4" /></button>
                    {deleteExpenseConfirm === e.id ? (
                      <div className="flex items-center gap-1"><button onClick={() => handleDeleteExpense(e)} className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Oui</button><button onClick={() => setDeleteExpenseConfirm(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">Non</button></div>
                    ) : (
                      <button onClick={() => setDeleteExpenseConfirm(e.id)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                    )}
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
