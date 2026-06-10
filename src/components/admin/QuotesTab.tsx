"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Plus, Edit3, Trash2, Save, ClipboardList } from "lucide-react";
import type { QuoteDB } from "@/lib/types";
import { formatPrice, quoteStatusColors, quoteStatusLabels } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";

export interface QuotesTabProps {
  quotes: QuoteDB[];
  showQuoteForm: boolean;
  editingQuote: QuoteDB | null;
  quoteForm: { number: string; customerName: string; customerPhone: string; items: string; subtotal: number; discount: number; total: number; status: string; validUntil: string; notes: string };
  setQuoteForm: (v: { number: string; customerName: string; customerPhone: string; items: string; subtotal: number; discount: number; total: number; status: string; validUntil: string; notes: string }) => void;
  openAddQuote: () => void;
  openEditQuote: (q: QuoteDB) => void;
  saveQuote: () => Promise<void>;
  setShowQuoteForm: (v: boolean) => void;
  apiPatch: (url: string, body: object) => Promise<void>;
  apiDelete: (url: string, body: object) => Promise<void>;
  deleteQuoteConfirm: string | null;
  setDeleteQuoteConfirm: (v: string | null) => void;
}

export function QuotesTab({
  quotes, showQuoteForm, editingQuote, quoteForm, setQuoteForm,
  openAddQuote, openEditQuote, saveQuote, setShowQuoteForm,
  apiPatch, apiDelete, deleteQuoteConfirm, setDeleteQuoteConfirm,
}: QuotesTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(quotes, 10);

  const handleSaveQuote = async () => {
    await saveQuote();
    notify.quoteSaved(quoteForm.number);
  };

  const handleDeleteQuote = async (q: QuoteDB) => {
    await apiDelete("/api/quotes", { id: q.id });
    setDeleteQuoteConfirm(null);
    notify.quoteDeleted(q.number);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">{quotes.filter(q => q.status === "draft").length} Brouillons</Badge>
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{quotes.filter(q => q.status === "sent").length} Envoyés</Badge>
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{quotes.filter(q => q.status === "accepted").length} Acceptés</Badge>
        </div>
        <Button onClick={openAddQuote} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
          <Plus className="w-4 h-4 mr-1" /> Nouveau devis
        </Button>
      </div>

      <AnimatePresence>
        {showQuoteForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-900/10">
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{editingQuote ? "Modifier le devis" : "Nouveau devis"}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">N° Devis *</label><Input value={quoteForm.number} onChange={e => setQuoteForm({ ...quoteForm, number: e.target.value })} placeholder="DEV-2026-001" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Client *</label><Input value={quoteForm.customerName} onChange={e => setQuoteForm({ ...quoteForm, customerName: e.target.value })} placeholder="Nom du client" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Téléphone</label><Input value={quoteForm.customerPhone} onChange={e => setQuoteForm({ ...quoteForm, customerPhone: e.target.value })} placeholder="+224 ..." className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Sous-total (GNF)</label><Input type="number" value={quoteForm.subtotal || ""} onChange={e => { const v = parseInt(e.target.value) || 0; setQuoteForm({ ...quoteForm, subtotal: v, total: v - quoteForm.discount }); }} className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Remise (GNF)</label><Input type="number" value={quoteForm.discount || ""} onChange={e => { const v = parseInt(e.target.value) || 0; setQuoteForm({ ...quoteForm, discount: v, total: quoteForm.subtotal - v }); }} className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Total (GNF)</label><p className="h-9 flex items-center text-sm font-bold text-orange-600 dark:text-orange-400">{formatPrice(quoteForm.total)}</p></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Valide jusqu&apos;au</label><Input type="date" value={quoteForm.validUntil} onChange={e => setQuoteForm({ ...quoteForm, validUntil: e.target.value })} className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Notes</label><Input value={quoteForm.notes} onChange={e => setQuoteForm({ ...quoteForm, notes: e.target.value })} placeholder="Notes" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleSaveQuote} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl"><Save className="w-4 h-4 mr-1" /> {editingQuote ? "Enregistrer" : "Créer"}</Button>
                  <Button variant="outline" onClick={() => { setShowQuoteForm(false); }} className="dark:border-gray-600">Annuler</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <button onClick={() => openEditQuote(q)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-orange-900/30 dark:hover:text-orange-400" title="Modifier"><Edit3 className="w-4 h-4" /></button>
                  {deleteQuoteConfirm === q.id ? (
                    <div className="flex items-center gap-1"><button onClick={() => handleDeleteQuote(q)} className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Oui</button><button onClick={() => setDeleteQuoteConfirm(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">Non</button></div>
                  ) : (
                    <button onClick={() => setDeleteQuoteConfirm(q.id)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {quotes.length === 0 && <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-8 text-center"><ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400">Aucun devis</p></CardContent></Card>}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="devis" />
    </div>
  );
}
