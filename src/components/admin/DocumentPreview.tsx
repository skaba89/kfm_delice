"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Printer, Download, FileText, Wallet, ClipboardList, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RESTO, formatPrice, invoiceStatusLabels, invoiceStatusColors, quoteStatusLabels, quoteStatusColors, expenseCategoryLabels, expenseCategoryColors, statusLabels, statusColors, orderTypeLabels, paymentLabels } from "@/lib/constants";
import type { InvoiceDB, QuoteDB, ExpenseDB, OrderDB } from "@/lib/types";

interface DocumentPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  type: "invoice" | "quote" | "expense" | "receipt";
  data: InvoiceDB | QuoteDB | ExpenseDB | OrderDB | null;
  onDownloadPDF?: () => void;
}

export function DocumentPreview({ isOpen, onClose, type, data, onDownloadPDF }: DocumentPreviewProps) {
  if (!data) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={onClose}
          data-print-target="true"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={e => e.stopPropagation()}
            className="print-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="print-header bg-gradient-to-r from-orange-500 to-red-500 text-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {type === "invoice" && <FileText className="w-6 h-6" />}
                  {type === "quote" && <ClipboardList className="w-6 h-6" />}
                  {type === "expense" && <Wallet className="w-6 h-6" />}
                  {type === "receipt" && <Receipt className="w-6 h-6" />}
                  <div>
                    <h3 className="text-lg font-bold">{RESTO.name}</h3>
                    <p className="text-xs opacity-80">{RESTO.tagline}</p>
                  </div>
                </div>
                <button onClick={onClose} className="no-print p-2 rounded-lg hover:bg-white/20 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {type === "invoice" && <InvoicePreviewContent data={data as InvoiceDB} />}
              {type === "quote" && <QuotePreviewContent data={data as QuoteDB} />}
              {type === "expense" && <ExpensePreviewContent data={data as ExpenseDB} />}
              {type === "receipt" && <ReceiptPreviewContent data={data as OrderDB} />}
            </div>

            {/* Footer Actions — hidden during print */}
            <div className="no-print p-4 bg-gray-50 dark:bg-gray-700/50 flex gap-2 border-t dark:border-gray-700">
              {onDownloadPDF && (
                <Button onClick={onDownloadPDF} className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl">
                  <Download className="w-4 h-4 mr-2" /> Télécharger PDF
                </Button>
              )}
              <Button variant="outline" onClick={() => window.print()} className="flex-1 rounded-xl dark:border-gray-600">
                <Printer className="w-4 h-4 mr-2" /> Imprimer
              </Button>
              <Button variant="outline" onClick={onClose} className="rounded-xl dark:border-gray-600">
                Fermer
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InvoicePreviewContent({ data }: { data: InvoiceDB }) {
  let lineItems: { description: string; qty: number; unitPrice: number; total: number }[] = [];
  try { lineItems = JSON.parse(data.items); } catch { /* */ }

  return (
    <div className="space-y-4">
      {/* Invoice header */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-2xl font-bold text-gray-900 dark:text-gray-100">FACTURE</h4>
          <p className="text-sm font-mono text-gray-600 dark:text-gray-400">{data.number}</p>
        </div>
        <Badge className={`${invoiceStatusColors[data.status] || ""} text-sm px-3 py-1`}>
          {invoiceStatusLabels[data.status] || data.status}
        </Badge>
      </div>

      <Separator />

      {/* Client & dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Facturé à</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{data.customerName}</p>
          {data.customerPhone && <p className="text-sm text-gray-600 dark:text-gray-400">{data.customerPhone}</p>}
        </div>
        <div className="text-right">
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">Date :</span> {new Date(data.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
            {data.dueDate && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">Échéance :</span> {new Date(data.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Items table */}
      {lineItems.length > 0 && (
        <div className="overflow-hidden rounded-lg border dark:border-gray-700">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <th className="px-4 py-2.5 text-left text-xs font-semibold">Description</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold">Qté</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold">Prix unitaire</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {lineItems.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-amber-50/50 dark:bg-amber-900/10" : "bg-white dark:bg-gray-800"}>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{item.description}</td>
                  <td className="px-4 py-2 text-sm text-center text-gray-700 dark:text-gray-300">{item.qty}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-300">{formatPrice(item.unitPrice)}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">{formatPrice(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Sous-total</span>
            <span>{formatPrice(data.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Taxe</span>
            <span>{formatPrice(data.tax)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-gray-100 bg-amber-50 dark:bg-amber-900/20 -mx-2 px-2 py-1.5 rounded-lg">
            <span>TOTAL</span>
            <span className="text-orange-600 dark:text-orange-400">{formatPrice(data.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{data.notes}</p>
        </div>
      )}

      {/* Footer info */}
      <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-2">
        <p>{RESTO.name} — {RESTO.address}</p>
        <p>{RESTO.phone} — {RESTO.email}</p>
      </div>
    </div>
  );
}

function QuotePreviewContent({ data }: { data: QuoteDB }) {
  let lineItems: { description: string; qty: number; unitPrice: number; total: number }[] = [];
  try { lineItems = JSON.parse(data.items); } catch { /* */ }

  return (
    <div className="space-y-4">
      {/* Quote header */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-2xl font-bold text-gray-900 dark:text-gray-100">DEVIS</h4>
          <p className="text-sm font-mono text-gray-600 dark:text-gray-400">{data.number}</p>
        </div>
        <Badge className={`${quoteStatusColors[data.status] || ""} text-sm px-3 py-1`}>
          {quoteStatusLabels[data.status] || data.status}
        </Badge>
      </div>

      <Separator />

      {/* Client & dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Client</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{data.customerName}</p>
          {data.customerPhone && <p className="text-sm text-gray-600 dark:text-gray-400">{data.customerPhone}</p>}
        </div>
        <div className="text-right">
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">Date :</span> {new Date(data.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
            {data.validUntil && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">Valide jusqu&apos;au :</span> {new Date(data.validUntil).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Items table */}
      {lineItems.length > 0 && (
        <div className="overflow-hidden rounded-lg border dark:border-gray-700">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <th className="px-4 py-2.5 text-left text-xs font-semibold">Description</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold">Qté</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold">Prix unitaire</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {lineItems.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-amber-50/50 dark:bg-amber-900/10" : "bg-white dark:bg-gray-800"}>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{item.description}</td>
                  <td className="px-4 py-2 text-sm text-center text-gray-700 dark:text-gray-300">{item.qty}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-300">{formatPrice(item.unitPrice)}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">{formatPrice(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Sous-total</span>
            <span>{formatPrice(data.subtotal)}</span>
          </div>
          {data.discount > 0 && (
            <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
              <span>Remise</span>
              <span>-{formatPrice(data.discount)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-gray-100 bg-amber-50 dark:bg-amber-900/20 -mx-2 px-2 py-1.5 rounded-lg">
            <span>TOTAL</span>
            <span className="text-orange-600 dark:text-orange-400">{formatPrice(data.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{data.notes}</p>
        </div>
      )}

      {/* Footer info */}
      <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-2">
        <p>{RESTO.name} — {RESTO.address}</p>
        <p>{RESTO.phone} — {RESTO.email}</p>
        {data.validUntil && <p className="mt-1 italic">Ce devis est valable jusqu&apos;au {new Date(data.validUntil).toLocaleDateString("fr-FR")}</p>}
      </div>
    </div>
  );
}

function SafeDate({ value }: { value: string | Date | undefined }) {
  if (!value) return <span>-</span>;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return <span>-</span>;
    return <>{d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</>;
  } catch {
    return <span>-</span>;
  }
}

function ExpensePreviewContent({ data }: { data: ExpenseDB }) {
  return (
    <div className="space-y-4">
      {/* Expense header */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-2xl font-bold text-gray-900 dark:text-gray-100">REÇU DE DÉPENSE</h4>
          <p className="text-sm font-mono text-gray-600 dark:text-gray-400">EXP-{(data.id || "").slice(-6).toUpperCase()}</p>
        </div>
        <Badge className={`${expenseCategoryColors[data.category] || "bg-gray-100 text-gray-700"} text-sm px-3 py-1`}>
          {expenseCategoryLabels[data.category] || data.category}
        </Badge>
      </div>

      <Separator />

      {/* Restaurant info */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <p className="font-semibold text-gray-900 dark:text-gray-100">{RESTO.name}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{RESTO.address}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{RESTO.phone} — {RESTO.email}</p>
      </div>

      <Separator />

      {/* Details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Description</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{data.description}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Montant</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatPrice(data.amount)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Catégorie</p>
          <Badge className={`${expenseCategoryColors[data.category] || "bg-gray-100 text-gray-700"} text-xs`}>
            {expenseCategoryLabels[data.category] || data.category}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Date</p>
          <p className="text-sm text-gray-900 dark:text-gray-100"><SafeDate value={data.date} /></p>
        </div>
        {data.paidBy && (
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Payé par</p>
            <p className="text-sm text-gray-900 dark:text-gray-100">{data.paidBy}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Enregistré le</p>
          <p className="text-sm text-gray-900 dark:text-gray-100"><SafeDate value={data.createdAt} /></p>
        </div>
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{data.notes}</p>
        </div>
      )}

      <Separator />

      {/* Signature area */}
      <div className="grid grid-cols-2 gap-8 mt-6">
        <div className="text-center">
          <div className="border-b-2 border-gray-300 dark:border-gray-600 pb-1 mb-1" />
          <p className="text-xs text-gray-500 dark:text-gray-400">Signature du bénéficiaire</p>
        </div>
        <div className="text-center">
          <div className="border-b-2 border-gray-300 dark:border-gray-600 pb-1 mb-1" />
          <p className="text-xs text-gray-500 dark:text-gray-400">Visa du responsable</p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-2">
        <p>{RESTO.name} — {RESTO.address}</p>
      </div>
    </div>
  );
}

function ReceiptPreviewContent({ data }: { data: OrderDB }) {
  let items: { name: string; price: number; qty: number }[] = [];
  try { items = JSON.parse(data.items); } catch { /* */ }

  const orderNum = (data.id || "").slice(-6).toUpperCase();
  const subtotal = items.reduce((s, item) => s + item.price * item.qty, 0);

  return (
    <div className="space-y-4">
      {/* Receipt header */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-2xl font-bold text-gray-900 dark:text-gray-100">REÇU DE COMMANDE</h4>
          <p className="text-sm font-mono text-gray-600 dark:text-gray-400">N° {orderNum}</p>
        </div>
        <Badge className={`${statusColors[data.status] || "bg-gray-100 text-gray-700"} text-sm px-3 py-1`}>
          {statusLabels[data.status] || data.status}
        </Badge>
      </div>

      <Separator />

      {/* Restaurant info */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <p className="font-semibold text-gray-900 dark:text-gray-100">{RESTO.name}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{RESTO.address}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{RESTO.phone} — {RESTO.email}</p>
      </div>

      <Separator />

      {/* Order info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Client</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{data.customerName || "Client sur place"}</p>
          {data.phone && <p className="text-sm text-gray-600 dark:text-gray-400">{data.phone}</p>}
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">Date :</span> {new Date(data.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">Type :</span> {orderTypeLabels[data.orderType] || data.orderType}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">Paiement :</span> {paymentLabels[data.paymentMethod] || data.paymentMethod}
          </p>
        </div>
      </div>

      {/* Delivery / Table info */}
      {data.orderType === "delivery" && data.deliveryAddress && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
          <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase mb-1">Adresse de livraison</p>
          <p className="text-sm text-gray-900 dark:text-gray-100">{data.deliveryAddress}</p>
        </div>
      )}
      {data.orderType === "dine_in" && data.tableNumber > 0 && (
        <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-3">
          <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400 uppercase mb-1">Table</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">N° {data.tableNumber}</p>
        </div>
      )}

      <Separator />

      {/* Items table */}
      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border dark:border-gray-700">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <th className="px-4 py-2.5 text-left text-xs font-semibold">Article</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold">Qté</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold">Prix</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {items.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-amber-50/50 dark:bg-amber-900/10" : "bg-white dark:bg-gray-800"}>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{item.name}</td>
                  <td className="px-4 py-2 text-sm text-center text-gray-700 dark:text-gray-300">{item.qty}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-300">{formatPrice(item.price)}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">{formatPrice(item.price * item.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Sous-total</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {data.discount > 0 && (
            <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
              <span>Remise</span>
              <span>-{formatPrice(data.discount)}</span>
            </div>
          )}
          {data.tax > 0 && (
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Taxe</span>
              <span>{formatPrice(data.tax)}</span>
            </div>
          )}
          {data.deliveryFee > 0 && (
            <div className="flex justify-between text-sm text-purple-600 dark:text-purple-400">
              <span>Livraison</span>
              <span>{formatPrice(data.deliveryFee)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-gray-100 bg-amber-50 dark:bg-amber-900/20 -mx-2 px-2 py-1.5 rounded-lg">
            <span>TOTAL</span>
            <span className="text-orange-600 dark:text-orange-400">{formatPrice(data.total)}</span>
          </div>
        </div>
      </div>

      {/* Note */}
      {data.note && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Note</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{data.note}</p>
        </div>
      )}

      <Separator />

      {/* Footer info */}
      <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-2">
        <p>Merci de votre visite !</p>
        <p>{RESTO.name} — {RESTO.address}</p>
        <p>{RESTO.phone} — {RESTO.email}</p>
      </div>
    </div>
  );
}
