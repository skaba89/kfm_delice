"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import type { Reservation } from "@/lib/types";
import { statusColors, statusLabels, zoneLabels } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{reservations.filter(r => r.status === "pending").length} En attente</Badge>
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{reservations.filter(r => r.status === "confirmed").length} Confirmées</Badge>
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{reservations.filter(r => r.status === "completed").length} Terminées</Badge>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Client</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date & Heure</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Pers.</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Zone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Notes</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr></thead>
            <tbody className="divide-y dark:divide-gray-700">
              {paginatedItems.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.customerName}</p><p className="text-xs text-gray-500 dark:text-gray-400">{r.phone}</p></td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{r.date} à {r.time}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{r.guests}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">{zoneLabels[r.zone] || r.zone}</Badge></td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-[200px] truncate">{r.notes || "-"}</td>
                  <td className="px-4 py-3"><Badge className={`${statusColors[r.status] || ""} text-xs`}>{statusLabels[r.status] || r.status}</Badge></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1">
                    {r.status === "pending" && <button onClick={() => handlePatch("/api/reservations", { id: r.id, status: "confirmed" }, r)} className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400" title="Confirmer"><CheckCircle2 className="w-4 h-4" /></button>}
                    {r.status !== "cancelled" && r.status !== "completed" && <button onClick={() => handlePatch("/api/reservations", { id: r.id, status: "cancelled" }, r)} className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400" title="Annuler"><XCircle className="w-4 h-4" /></button>}
                    {r.status === "confirmed" && <button onClick={() => handlePatch("/api/reservations", { id: r.id, status: "completed" }, r)} className="p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400" title="Terminer"><CheckCircle2 className="w-4 h-4" /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="réservations" />
    </div>
  );
}
