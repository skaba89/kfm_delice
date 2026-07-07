"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Receipt } from "lucide-react";
import type { ExpenseDB } from "@/lib/types";
import { formatPrice, expenseCategoryLabels, expenseCategoryColors } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { AdminFormCard, CrudHeader, DataTable, type DataTableColumn, DeleteConfirmButton, EditButton, EmptyState, FormField, FormSelect, SummaryCards } from "@/components/admin/shared";
import type { CrudStateReturn } from "@/lib/hooks/use-crud-state";

type ExpenseForm = { description: string; amount: number; category: string; date: string; paidBy: string; notes: string };

export interface ExpensesTabProps {
  expenses: ExpenseDB[];
  crud: CrudStateReturn<ExpenseDB, ExpenseForm>;
  apiDelete: (url: string, body: object) => Promise<void>;
}

export function ExpensesTab({ expenses, crud, apiDelete }: ExpensesTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(expenses, 10);

  const handleSave = async () => {
    try {
      await crud.save();
      notify.expenseSaved(crud.form.description);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (e: ExpenseDB) => {
    try {
      await apiDelete("/api/expenses", { id: e.id });
      crud.setDeleteConfirm(null);
      notify.expenseDeleted(e.description);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Erreur lors de la suppression");
    }
  };

  const columns: DataTableColumn<ExpenseDB>[] = [
    { header: "Description", cell: (e) => (<><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{e.description}</p>{e.notes && <p className="text-xs text-gray-500 dark:text-gray-400">{e.notes}</p>}</>) },
    { header: "Montant", cell: (e) => <span className="text-sm font-bold text-red-600 dark:text-red-400">{formatPrice(e.amount)}</span> },
    { header: "Catégorie", cell: (e) => <Badge className={`${expenseCategoryColors[e.category] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"} text-xs`}>{expenseCategoryLabels[e.category] || e.category}</Badge> },
    { header: "Date", cell: (e) => <span className="text-sm text-gray-700 dark:text-gray-300">{e.date}</span> },
    { header: "Payé par", cell: (e) => <span className="text-sm text-gray-700 dark:text-gray-300">{e.paidBy || "-"}</span> },
    { header: "Actions", cell: (e) => (
      <div className="flex items-center gap-1">
        <EditButton onClick={() => crud.openEdit(e)} />
        <DeleteConfirmButton confirming={crud.deleteConfirm === e.id} onConfirm={() => handleDelete(e)} onRequestConfirm={() => crud.setDeleteConfirm(e.id)} onCancel={() => crud.setDeleteConfirm(null)} />
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <CrudHeader
        leftContent={
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total: <span className="font-bold text-gray-900 dark:text-gray-100">{formatPrice(expenses.reduce((s, e) => s + e.amount, 0))}</span>
          </p>
        }
        addLabel="Ajouter une dépense"
        onAdd={crud.openAdd}
      />

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
        show={crud.showForm}
        editing={!!crud.editing}
        addTitle="Ajouter une dépense"
        editTitle="Modifier la dépense"
        onSave={handleSave}
        onCancel={() => crud.setShowForm(false)}
      >
        <FormField label="Description" value={crud.form.description} onChange={v => crud.setForm({ ...crud.form, description: v })} placeholder="Description de la dépense" required />
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Montant (GNF) *</label>
          <Input type="number" value={crud.form.amount || ""} onChange={e => crud.setForm({ ...crud.form, amount: parseInt(e.target.value) || 0 })} placeholder="500000" className="dark:bg-gray-800 dark:border-gray-600" />
        </div>
        <FormSelect label="Catégorie" value={crud.form.category} onChange={v => crud.setForm({ ...crud.form, category: v })} options={Object.entries(expenseCategoryLabels).map(([k, v]) => ({ value: k, label: v }))} required />
        <FormField label="Date" value={crud.form.date} onChange={v => crud.setForm({ ...crud.form, date: v })} type="date" required />
        <FormField label="Payé par" value={crud.form.paidBy} onChange={v => crud.setForm({ ...crud.form, paidBy: v })} placeholder="Nom" />
        <FormField label="Notes" value={crud.form.notes} onChange={v => crud.setForm({ ...crud.form, notes: v })} placeholder="Notes" />
      </AdminFormCard>

      <DataTable columns={columns} data={paginatedItems} emptyContent={<EmptyState icon={Receipt} message="Aucune dépense enregistrée" />} />
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="dépenses" />
    </div>
  );
}
