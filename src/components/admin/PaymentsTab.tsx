"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import type { PaymentDB } from "@/lib/types";
import { formatPrice, paymentLabels, paymentStatusColors, paymentStatusLabels } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { CrudHeader, DataTable, type DataTableColumn, EmptyState, SummaryCards } from "@/components/admin/shared";

export interface PaymentsTabProps {
  payments: PaymentDB[];
  apiPatch: (url: string, body: object) => Promise<void>;
}

export function PaymentsTab({ payments, apiPatch }: PaymentsTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(payments, 10);

  const totalAmount = payments.reduce((s, p) => s + p.amount, 0);
  const paidAmount = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pendingAmount = payments.filter(p => p.status === "pending" || p.status === "processing").reduce((s, p) => s + p.amount, 0);

  const columns: DataTableColumn<PaymentDB>[] = [
    { header: "Client", cell: (p) => (<><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.customerName || "-"}</p>{p.phone && <p className="text-xs text-gray-500 dark:text-gray-400">{p.phone}</p>}</>) },
    { header: "Montant", cell: (p) => <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatPrice(p.amount)}</span> },
    { header: "Méthode", cell: (p) => <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 text-xs">{paymentLabels[p.method] || p.method}</Badge> },
    { header: "Statut", cell: (p) => <Badge className={`${paymentStatusColors[p.status] || ""} text-xs`}>{paymentStatusLabels[p.status] || p.status}</Badge> },
    { header: "Réf.", cell: (p) => <span className="text-xs text-gray-500 dark:text-gray-400">{p.transactionRef || "-"}</span> },
    { header: "Date", cell: (p) => <span className="text-xs text-gray-500 dark:text-gray-400">{p.paidAt || new Date(p.createdAt).toLocaleDateString("fr-FR")}</span> },
    { header: "Actions", cell: (p) => (
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
    )},
  ];

  return (
    <div className="space-y-4">
      <CrudHeader
        badges={[
          { count: payments.filter(p => p.status === "paid").length, label: "Payés", color: "green" },
          { count: payments.filter(p => p.status === "pending").length, label: "En attente", color: "amber" },
          { count: payments.filter(p => p.status === "failed").length, label: "Échoués", color: "red" },
        ]}
      />

      <SummaryCards columns={4} items={[
        { label: "Total paiements", value: formatPrice(totalAmount) },
        { label: "Payé", value: formatPrice(paidAmount), valueColor: "text-green-600 dark:text-green-400" },
        { label: "En attente", value: formatPrice(pendingAmount), valueColor: "text-amber-600 dark:text-amber-400" },
        { label: "Transactions", value: payments.length, valueColor: "text-blue-600 dark:text-blue-400" },
      ]} />

      <DataTable columns={columns} data={paginatedItems} emptyContent={<EmptyState icon={CreditCard} message="Aucun paiement" />} />
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="paiements" />
    </div>
  );
}
