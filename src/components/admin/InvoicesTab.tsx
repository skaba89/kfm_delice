"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Plus, Edit3, Trash2, Save, XCircle, Receipt } from "lucide-react";
import type { InvoiceDB } from "@/lib/types";
import { formatPrice, invoiceStatusColors, invoiceStatusLabels } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";

export interface InvoicesTabProps {
  invoices: InvoiceDB[];
  showInvoiceForm: boolean;
  editingInvoice: InvoiceDB | null;
  invoiceForm: { number: string; customerName: string; customerPhone: string; items: string; subtotal: number; tax: number; total: number; status: string; dueDate: string; notes: string };
  setInvoiceForm: (v: { number: string; customerName: string; customerPhone: string; items: string; subtotal: number; tax: number; total: number; status: string; dueDate: string; notes: string }) => void;
  openAddInvoice: () => void;
  openEditInvoice: (inv: InvoiceDB) => void;
  saveInvoice: () => Promise<void>;
  setShowInvoiceForm: (v: boolean) => void;
  apiPatch: (url: string, body: object) => Promise<void>;
  apiDelete: (url: string, body: object) => Promise<void>;
  deleteInvoiceConfirm: string | null;
  setDeleteInvoiceConfirm: (v: string | null) => void;
}

export function InvoicesTab({
  invoices, showInvoiceForm, editingInvoice, invoiceForm, setInvoiceForm,
  openAddInvoice, saveInvoice, setShowInvoiceForm,
  apiPatch, apiDelete, deleteInvoiceConfirm, setDeleteInvoiceConfirm,
}: InvoicesTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(invoices, 10);

  const handleSaveInvoice = async () => {
    await saveInvoice();
    notify.invoiceSaved(invoiceForm.number);
  };

  const handleDeleteInvoice = async (inv: InvoiceDB) => {
    await apiDelete("/api/invoices", { id: inv.id });
    setDeleteInvoiceConfirm(null);
    notify.invoiceDeleted(inv.number);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{invoices.filter(i => i.status === "pending").length} En attente</Badge>
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{invoices.filter(i => i.status === "paid").length} Payées</Badge>
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{invoices.filter(i => i.status === "overdue").length} En retard</Badge>
        </div>
        <Button onClick={openAddInvoice} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
          <Plus className="w-4 h-4 mr-1" /> Nouvelle facture
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-3"><p className="text-xs text-gray-500 dark:text-gray-400">Total facturé</p><p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatPrice(invoices.reduce((s, i) => s + i.total, 0))}</p></CardContent></Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-3"><p className="text-xs text-gray-500 dark:text-gray-400">Payé</p><p className="text-lg font-bold text-green-600 dark:text-green-400">{formatPrice(invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0))}</p></CardContent></Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-3"><p className="text-xs text-gray-500 dark:text-gray-400">En attente</p><p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatPrice(invoices.filter(i => i.status === "pending").reduce((s, i) => s + i.total, 0))}</p></CardContent></Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-3"><p className="text-xs text-gray-500 dark:text-gray-400">En retard</p><p className="text-lg font-bold text-red-600 dark:text-red-400">{formatPrice(invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.total, 0))}</p></CardContent></Card>
      </div>

      <AnimatePresence>
        {showInvoiceForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-900/10">
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{editingInvoice ? "Modifier la facture" : "Nouvelle facture"}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">N° Facture *</label><Input value={invoiceForm.number} onChange={e => setInvoiceForm({ ...invoiceForm, number: e.target.value })} placeholder="FAC-2026-001" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Client *</label><Input value={invoiceForm.customerName} onChange={e => setInvoiceForm({ ...invoiceForm, customerName: e.target.value })} placeholder="Nom du client" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Téléphone</label><Input value={invoiceForm.customerPhone} onChange={e => setInvoiceForm({ ...invoiceForm, customerPhone: e.target.value })} placeholder="+224 ..." className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Sous-total (GNF)</label><Input type="number" value={invoiceForm.subtotal || ""} onChange={e => { const v = parseInt(e.target.value) || 0; setInvoiceForm({ ...invoiceForm, subtotal: v, total: v + invoiceForm.tax }); }} placeholder="350000" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Taxe (GNF)</label><Input type="number" value={invoiceForm.tax || ""} onChange={e => { const v = parseInt(e.target.value) || 0; setInvoiceForm({ ...invoiceForm, tax: v, total: invoiceForm.subtotal + v }); }} placeholder="52500" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Total (GNF)</label><p className="h-9 flex items-center text-sm font-bold text-orange-600 dark:text-orange-400">{formatPrice(invoiceForm.total)}</p></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Échéance</label><Input type="date" value={invoiceForm.dueDate} onChange={e => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Notes</label><Input value={invoiceForm.notes} onChange={e => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} placeholder="Notes" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleSaveInvoice} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl"><Save className="w-4 h-4 mr-1" /> {editingInvoice ? "Enregistrer" : "Créer"}</Button>
                  <Button variant="outline" onClick={() => { setShowInvoiceForm(false); }} className="dark:border-gray-600">Annuler</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

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
                <div className="flex gap-2">
                  {inv.status === "pending" && <Button size="sm" onClick={() => apiPatch("/api/invoices", { id: inv.id, status: "paid" })} className="bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg">Marquer payée</Button>}
                  {inv.status === "pending" && <Button size="sm" variant="outline" onClick={() => apiPatch("/api/invoices", { id: inv.id, status: "overdue" })} className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 text-xs rounded-lg">En retard</Button>}
                  {inv.status === "overdue" && <Button size="sm" onClick={() => apiPatch("/api/invoices", { id: inv.id, status: "paid" })} className="bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg">Marquer payée</Button>}
                  {inv.status !== "cancelled" && inv.status !== "paid" && <Button size="sm" variant="outline" onClick={() => apiPatch("/api/invoices", { id: inv.id, status: "cancelled" })} className="text-red-500 border-red-200 dark:border-red-800 text-xs rounded-lg"><XCircle className="w-3 h-3" /></Button>}
                  <button onClick={() => { setInvoiceForm({ number: inv.number, customerName: inv.customerName, customerPhone: inv.customerPhone, items: inv.items, subtotal: inv.subtotal, tax: inv.tax, total: inv.total, status: inv.status, dueDate: inv.dueDate, notes: inv.notes }); setShowInvoiceForm(true); }} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-orange-900/30 dark:hover:text-orange-400" title="Modifier"><Edit3 className="w-4 h-4" /></button>
                  {deleteInvoiceConfirm === inv.id ? (
                    <div className="flex items-center gap-1"><button onClick={() => handleDeleteInvoice(inv)} className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Oui</button><button onClick={() => setDeleteInvoiceConfirm(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">Non</button></div>
                  ) : (
                    <button onClick={() => setDeleteInvoiceConfirm(inv.id)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {invoices.length === 0 && <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-8 text-center"><Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400">Aucune facture</p></CardContent></Card>}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="factures" />
    </div>
  );
}
