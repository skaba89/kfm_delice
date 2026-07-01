"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, CalendarCheck } from "lucide-react";
import type { Reservation } from "@/lib/types";
import { statusColors, statusLabels, zoneLabels } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { CrudHeader, DataTable, type DataTableColumn, EmptyState, StatusBadgeBar } from "@/components/admin/shared";

export interface ReservationsTabProps {
  reservations: Reservation[];
  apiPatch: (url: string, body: object) => Promise<void>;
}

export function ReservationsTab({ reservations, apiPatch }: ReservationsTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(reservations, 10);

  const handlePatch = async (url: string, body: object, r: Reservation) => {
    await apiPatch(url, body);
    if (body instanceof Object && "status" in body) {
      const status = (body as { status: string }).status;
      if (status === "confirmed") notify.reservationConfirmed(r.customerName);
      else if (status === "cancelled") notify.reservationCancelled(r.customerName);
      else if (status === "completed") notify.reservationCompleted(r.customerName);
    }
  };

  const columns: DataTableColumn<Reservation>[] = [
    { header: "Client", cell: (r) => (<><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.customerName}</p><p className="text-xs text-gray-500 dark:text-gray-400">{r.phone}</p></>) },
    { header: "Date & Heure", cell: (r) => <span className="text-sm text-gray-700 dark:text-gray-300">{r.date} à {r.time}</span> },
    { header: "Pers.", cell: (r) => <span className="text-sm text-gray-700 dark:text-gray-300">{r.guests}</span> },
    { header: "Zone", cell: (r) => <Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">{zoneLabels[r.zone] || r.zone}</Badge> },
    { header: "Notes", cell: (r) => <span className="text-sm text-gray-500 dark:text-gray-400 max-w-[200px] truncate block">{r.notes || "-"}</span> },
    { header: "Statut", cell: (r) => <Badge className={`${statusColors[r.status] || ""} text-xs`}>{statusLabels[r.status] || r.status}</Badge> },
    { header: "Actions", cell: (r) => (
      <div className="flex items-center gap-1">
        {r.status === "pending" && <button onClick={() => handlePatch("/api/reservations", { id: r.id, status: "confirmed" }, r)} className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400" title="Confirmer"><CheckCircle2 className="w-4 h-4" /></button>}
        {r.status !== "cancelled" && r.status !== "completed" && <button onClick={() => handlePatch("/api/reservations", { id: r.id, status: "cancelled" }, r)} className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400" title="Annuler"><XCircle className="w-4 h-4" /></button>}
        {r.status === "confirmed" && <button onClick={() => handlePatch("/api/reservations", { id: r.id, status: "completed" }, r)} className="p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400" title="Terminer"><CheckCircle2 className="w-4 h-4" /></button>}
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <CrudHeader
        badges={[
          { count: reservations.filter(r => r.status === "pending").length, label: "En attente", color: "amber" },
          { count: reservations.filter(r => r.status === "confirmed").length, label: "Confirmées", color: "green" },
          { count: reservations.filter(r => r.status === "completed").length, label: "Terminées", color: "blue" },
        ]}
      />
      <DataTable columns={columns} data={paginatedItems} emptyContent={<EmptyState icon={CalendarCheck} message="Aucune réservation" />} />
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="réservations" />
    </div>
  );
}
