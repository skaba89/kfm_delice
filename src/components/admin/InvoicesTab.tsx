"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { XCircle, Receipt, FileDown } from "lucide-react";
import type { InvoiceDB } from "@/lib/types";
import { formatPrice, invoiceStatusColors, invoiceStatusLabels } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { AdminFormCard, CrudHeader, DeleteConfirmButton, EditButton, EmptyState, FormField, SummaryCards } from "@/components/admin/shared";
import type { CrudStateReturn } from "@/lib/hooks/use-crud-state";

type InvoiceForm = { number: string; customerName: string; customerPhone: string; items: string; subtotal: number; tax: number; total: number; status: string; dueDate: string; notes: string };

export interface InvoicesTabProps {
  invoices: InvoiceDB[];
  crud: CrudStateReturn<InvoiceDB, InvoiceForm>;
  apiPatch: (url: string, body: object) => Promise<void>;
  apiDelete: (url: string, body: object) => Promise<void>;
}

export function InvoicesTab({ invoices, crud, apiPatch, apiDelete }: InvoicesTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(invoices, 10);

  const handleSave = async () => {
    try {
      await crud.save();
      notify.invoiceSaved(crud.form.number);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (inv: InvoiceDB) => {
    try {
      await apiDelete("/api/invoices", { id: inv.id });
      crud.setDeleteConfirm(null);
      notify.invoiceDeleted(inv.number);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Erreur lors de la suppression");
    }
  };

  return (
    <div className="space-y-4">
      <CrudHeader
        badges={[
          { count: invoices.filter(i => i.status === "pending").length, label: "En attente", color: "amber" },
          { count: invoices.filter(i => i.status === "paid").length, label: "Payées", color: "green" },
          { count: invoices.filter(i => i.status === "overdue").length, label: "En retard", color: "red" },
        ]}
        addLabel="Nouvelle facture"
        onAdd={crud.openAdd}
      />

      <SummaryCards columns={4} items={[
        { label: "Total facturé", value: formatPrice(invoices.reduce((s, i) => s + i.total, 0)) },
        { label: "Payé", value: formatPrice(invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0)), valueColor: "text-green-600 dark:text-green-400" },
        { label: "En attente", value: formatPrice(invoices.filter(i => i.status === "pending").reduce((s, i) => s + i.total, 0)), valueColor: "text-amber-600 dark:text-amber-400" },
        { label: "En retard", value: formatPrice(invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.total, 0)), valueColor: "text-red-600 dark:text-red-400" },
      ]} />

      <AdminFormCard
        show={crud.showForm}
        editing={!!crud.editing}
        addTitle="Nouvelle facture"
        editTitle="Modifier la facture"
        onSave={handleSave}
        onCancel={() => crud.setShowForm(false)}
      >
        <FormField label="N° Facture" value={crud.form.number} onChange={v => crud.setForm({ ...crud.form, number: v })} placeholder="FAC-2026-001" required />
        <FormField label="Client" value={crud.form.customerName} onChange={v => crud.setForm({ ...crud.form, customerName: v })} placeholder="Nom du client" required />
        <FormField label="Téléphone" value={crud.form.customerPhone} onChange={v => crud.setForm({ ...crud.form, customerPhone: v })} placeholder="+224 ..." />
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Sous-total (GNF)</label>
          <Input type="number" value={crud.form.subtotal || ""} onChange={e => { const v = parseInt(e.target.value) || 0; crud.setForm({ ...crud.form, subtotal: v, total: v + crud.form.tax }); }} placeholder="350000" className="dark:bg-gray-800 dark:border-gray-600" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Taxe (GNF)</label>
          <Input type="number" value={crud.form.tax || ""} onChange={e => { const v = parseInt(e.target.value) || 0; crud.setForm({ ...crud.form, tax: v, total: crud.form.subtotal + v }); }} placeholder="52500" className="dark:bg-gray-800 dark:border-gray-600" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Total (GNF)</label>
          <p className="h-9 flex items-center text-sm font-bold text-orange-600 dark:text-orange-400">{formatPrice(crud.form.total)}</p>
        </div>
        <FormField label="Échéance" value={crud.form.dueDate} onChange={v => crud.setForm({ ...crud.form, dueDate: v })} type="date" />
        <div className="sm:col-span-2">
          <FormField label="Notes" value={crud.form.notes} onChange={v => crud.setForm({ ...crud.form, notes: v })} placeholder="Notes" />
        </div>
      </AdminFormCard>

      <div className="space-y-3">
        {paginatedItems.map(inv => {
          let lineItems: { description: string; qty: number; unitPrice: number; total: number }[] = [];
          try { lineItems = JSON.parse(inv.items); } catch { /* */ }
          return (
            <Card key={inv.id} className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2"><p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{inv.number}</p><Badge className={`${invoiceStatusColors[inv.status] || ""} text-xs`}>{invoiceStatusLabels[inv.status] || inv.status}</Badge></div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{inv.customerName}</p>
                    {inv.customerPhone && <p className="text-xs text-gray-500 dark:text-gray-400">{inv.customerPhone}</p>}
                  </div>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatPrice(inv.total)}</p>
                </div>
                {lineItems.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 mb-2 text-xs space-y-1">
                    {lineItems.map((li, j) => <div key={j} className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{li.description} x{li.qty}</span><span className="font-medium dark:text-gray-300">{formatPrice(li.total)}</span></div>)}
                    <Separator className="my-1" />
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Sous-total: {formatPrice(inv.subtotal)}</span><span className="text-gray-500 dark:text-gray-400">Taxe: {formatPrice(inv.tax)}</span></div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span>Échéance: {inv.dueDate || "-"}</span>
                  {inv.notes && <span>• {inv.notes}</span>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {inv.status === "pending" && <Button size="sm" onClick={() => apiPatch("/api/invoices", { id: inv.id, status: "paid" })} className="bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg">Marquer payée</Button>}
                  {inv.status === "pending" && <Button size="sm" variant="outline" onClick={() => apiPatch("/api/invoices", { id: inv.id, status: "overdue" })} className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 text-xs rounded-lg">En retard</Button>}
                  {inv.status === "overdue" && <Button size="sm" onClick={() => apiPatch("/api/invoices", { id: inv.id, status: "paid" })} className="bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg">Marquer payée</Button>}
                  <a href={`/api/invoices/${inv.id}?format=pdf`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="text-blue-500 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30 text-xs rounded-lg" title="Télécharger PDF">
                      <FileDown className="w-3 h-3" />
                    </Button>
                  </a>
                  {inv.status !== "cancelled" && inv.status !== "paid" && <Button size="sm" variant="outline" onClick={() => apiPatch("/api/invoices", { id: inv.id, status: "cancelled" })} className="text-red-500 border-red-200 dark:border-red-800 text-xs rounded-lg"><XCircle className="w-3 h-3" /></Button>}
                  <EditButton onClick={() => crud.openEdit(inv)} />
                  <DeleteConfirmButton
                    confirming={crud.deleteConfirm === inv.id}
                    onConfirm={() => handleDelete(inv)}
                    onRequestConfirm={() => crud.setDeleteConfirm(inv.id)}
                    onCancel={() => crud.setDeleteConfirm(null)}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
        {invoices.length === 0 && <EmptyState icon={Receipt} message="Aucune facture" />}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="factures" />
    </div>
  );
}
