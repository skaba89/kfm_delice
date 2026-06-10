"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, RefreshCw } from "lucide-react";
import type { PaymentDB } from "@/lib/types";
import { formatPrice } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";

const paymentMethodLabels: Record<string, string> = {
  cash: "Espèces",
  orange_money: "Orange Money",
  mtn_money: "MTN Money",
  card: "Carte",
};

const paymentStatusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  refunded: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const paymentStatusLabels: Record<string, string> = {
  pending: "En attente",
  processing: "En cours",
  paid: "Payé",
  failed: "Échoué",
  refunded: "Remboursé",
};

export interface PaymentsTabProps {
  payments: PaymentDB[];
  apiPatch: (url: string, body: object) => Promise<void>;
}

export function PaymentsTab({ payments, apiPatch }: PaymentsTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(payments, 10);

  const totalAmount = payments.reduce((s, p) => s + p.amount, 0);
  const paidAmount = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pendingAmount = payments.filter(p => p.status === "pending" || p.status === "processing").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{payments.filter(p => p.status === "paid").length} Payés</Badge>
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{payments.filter(p => p.status === "pending").length} En attente</Badge>
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{payments.filter(p => p.status === "failed").length} Échoués</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-3"><p className="text-xs text-gray-500 dark:text-gray-400">Total paiements</p><p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatPrice(totalAmount)}</p></CardContent></Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-3"><p className="text-xs text-gray-500 dark:text-gray-400">Payé</p><p className="text-lg font-bold text-green-600 dark:text-green-400">{formatPrice(paidAmount)}</p></CardContent></Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-3"><p className="text-xs text-gray-500 dark:text-gray-400">En attente</p><p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatPrice(pendingAmount)}</p></CardContent></Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-3"><p className="text-xs text-gray-500 dark:text-gray-400">Transactions</p><p className="text-lg font-bold text-blue-600 dark:text-blue-400">{payments.length}</p></CardContent></Card>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Client</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Montant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Méthode</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Réf.</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr></thead>
            <tbody className="divide-y dark:divide-gray-700">
              {paginatedItems.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.customerName || "-"}</p>{p.phone && <p className="text-xs text-gray-500 dark:text-gray-400">{p.phone}</p>}</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-gray-100">{formatPrice(p.amount)}</td>
                  <td className="px-4 py-3"><Badge className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 text-xs">{paymentMethodLabels[p.method] || p.method}</Badge></td>
                  <td className="px-4 py-3"><Badge className={`${paymentStatusColors[p.status] || ""} text-xs`}>{paymentStatusLabels[p.status] || p.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{p.transactionRef || "-"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{p.paidAt || new Date(p.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {p.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => apiPatch("/api/payment", { id: p.id, status: "paid" })} className="text-xs text-green-600 border-green-200 dark:border-green-800 rounded-lg">Confirmer</Button>
                      )}
                      {p.status === "processing" && (
                        <Button size="sm" variant="outline" onClick={() => apiPatch("/api/payment", { id: p.id, status: "paid" })} className="text-xs text-green-600 border-green-200 dark:border-green-800 rounded-lg">Valider</Button>
                      )}
                      {p.status === "failed" && (
                        <Button size="sm" variant="outline" onClick={() => apiPatch("/api/payment", { id: p.id, status: "refunded" })} className="text-xs text-purple-600 border-purple-200 dark:border-purple-800 rounded-lg">Rembourser</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {payments.length === 0 && <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-8 text-center"><CreditCard className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400">Aucun paiement</p></CardContent></Card>}
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="paiements" />
    </div>
  );
}
