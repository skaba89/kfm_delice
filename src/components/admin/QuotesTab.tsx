"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ClipboardList } from "lucide-react";
import type { QuoteDB } from "@/lib/types";
import { formatPrice, quoteStatusColors, quoteStatusLabels } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { AdminFormCard, CrudHeader, DeleteConfirmButton, EditButton, EmptyState, FormField } from "@/components/admin/shared";
import type { CrudStateReturn } from "@/lib/hooks/use-crud-state";

type QuoteForm = { number: string; customerName: string; customerPhone: string; items: string; subtotal: number; discount: number; total: number; status: string; validUntil: string; notes: string };

export interface QuotesTabProps {
  quotes: QuoteDB[];
  crud: CrudStateReturn<QuoteDB, QuoteForm>;
  apiPatch: (url: string, body: object) => Promise<void>;
  apiDelete: (url: string, body: object) => Promise<void>;
}

export function QuotesTab({ quotes, crud, apiPatch, apiDelete }: QuotesTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(quotes, 10);

  const handleSave = async () => {
    try {
      await crud.save();
      notify.quoteSaved(crud.form.number);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (q: QuoteDB) => {
    try {
      await apiDelete("/api/quotes", { id: q.id });
      crud.setDeleteConfirm(null);
      notify.quoteDeleted(q.number);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Erreur lors de la suppression");
    }
  };

  return (
    <div className="space-y-4">
      <CrudHeader
        badges={[
          { count: quotes.filter(q => q.status === "draft").length, label: "Brouillons", color: "gray" },
          { count: quotes.filter(q => q.status === "sent").length, label: "Envoyés", color: "blue" },
          { count: quotes.filter(q => q.status === "accepted").length, label: "Acceptés", color: "green" },
        ]}
        addLabel="Nouveau devis"
        onAdd={crud.openAdd}
      />

      <AdminFormCard
        show={crud.showForm}
        editing={!!crud.editing}
        addTitle="Nouveau devis"
        editTitle="Modifier le devis"
        onSave={handleSave}
        onCancel={() => crud.setShowForm(false)}
      >
        <FormField label="N° Devis" value={crud.form.number} onChange={v => crud.setForm({ ...crud.form, number: v })} placeholder="DEV-2026-001" required />
        <FormField label="Client" value={crud.form.customerName} onChange={v => crud.setForm({ ...crud.form, customerName: v })} placeholder="Nom du client" required />
        <FormField label="Téléphone" value={crud.form.customerPhone} onChange={v => crud.setForm({ ...crud.form, customerPhone: v })} placeholder="+224 ..." />
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Sous-total (GNF)</label>
          <Input type="number" value={crud.form.subtotal || ""} onChange={e => { const v = parseInt(e.target.value) || 0; crud.setForm({ ...crud.form, subtotal: v, total: v - crud.form.discount }); }} className="dark:bg-gray-800 dark:border-gray-600" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Remise (GNF)</label>
          <Input type="number" value={crud.form.discount || ""} onChange={e => { const v = parseInt(e.target.value) || 0; crud.setForm({ ...crud.form, discount: v, total: crud.form.subtotal - v }); }} className="dark:bg-gray-800 dark:border-gray-600" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Total (GNF)</label>
          <p className="h-9 flex items-center text-sm font-bold text-orange-600 dark:text-orange-400">{formatPrice(crud.form.total)}</p>
        </div>
        <FormField label="Valide jusqu'au" value={crud.form.validUntil} onChange={v => crud.setForm({ ...crud.form, validUntil: v })} type="date" />
        <div className="sm:col-span-2">
          <FormField label="Notes" value={crud.form.notes} onChange={v => crud.setForm({ ...crud.form, notes: v })} placeholder="Notes" />
        </div>
      </AdminFormCard>

      <div className="space-y-3">
        {paginatedItems.map(q => {
          let lineItems: { description: string; qty: number; unitPrice: number; total: number }[] = [];
          try { lineItems = JSON.parse(q.items); } catch { /* */ }
          return (
            <Card key={q.id} className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2"><p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{q.number}</p><Badge className={`${quoteStatusColors[q.status] || ""} text-xs`}>{quoteStatusLabels[q.status] || q.status}</Badge></div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{q.customerName}</p>
                  </div>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatPrice(q.total)}</p>
                </div>
                {lineItems.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 mb-2 text-xs space-y-1">
                    {lineItems.map((li, j) => <div key={j} className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{li.description} x{li.qty}</span><span className="font-medium dark:text-gray-300">{formatPrice(li.total)}</span></div>)}
                    {q.discount > 0 && <div className="flex justify-between text-green-600 dark:text-green-400"><span>Remise</span><span>-{formatPrice(q.discount)}</span></div>}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span>Valide jusqu&apos;au: {q.validUntil || "-"}</span>
                  {q.notes && <span>• {q.notes}</span>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {q.status === "draft" && <Button size="sm" onClick={() => apiPatch("/api/quotes", { id: q.id, status: "sent" })} className="bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg">Envoyer</Button>}
                  {q.status === "sent" && <><Button size="sm" onClick={() => apiPatch("/api/quotes", { id: q.id, status: "accepted" })} className="bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg">Accepter</Button><Button size="sm" variant="outline" onClick={() => apiPatch("/api/quotes", { id: q.id, status: "refused" })} className="text-red-500 border-red-200 dark:border-red-800 text-xs rounded-lg">Refuser</Button></>}
                  <EditButton onClick={() => crud.openEdit(q)} />
                  <DeleteConfirmButton
                    confirming={crud.deleteConfirm === q.id}
                    onConfirm={() => handleDelete(q)}
                    onRequestConfirm={() => crud.setDeleteConfirm(q.id)}
                    onCancel={() => crud.setDeleteConfirm(null)}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
        {quotes.length === 0 && <EmptyState icon={ClipboardList} message="Aucun devis" />}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="devis" />
    </div>
  );
}
