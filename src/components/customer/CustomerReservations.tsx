"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { Reservation } from "@/lib/types";
import { statusColors, statusLabels, zoneLabels } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";

interface CustomerReservationsProps {
  reservations: Reservation[];
  showQuickReserve: boolean;
  setShowQuickReserve: (show: boolean) => void;
  reserveForm: { date: string; time: string; guests: number; zone: string; notes: string };
  setReserveForm: (form: { date: string; time: string; guests: number; zone: string; notes: string }) => void;
  reserveSaving: boolean;
  submitReservation: () => void;
}

export function CustomerReservations({
  reservations,
  showQuickReserve,
  setShowQuickReserve,
  reserveForm,
  setReserveForm,
  reserveSaving,
  submitReservation,
}: CustomerReservationsProps) {
  const reservationsPagination = usePagination(reservations, 5);
  const upcomingReservations = reservations.filter(r => r.status === "confirmed" || r.status === "pending").slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Mes réservations</h3>
        <Button size="sm" onClick={() => setShowQuickReserve(!showQuickReserve)} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg">
          <Plus className="w-4 h-4 mr-1" /> Nouvelle réservation
        </Button>
      </div>

      {/* Quick reservation form */}
      <AnimatePresence>
        {showQuickReserve && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <Card className="dark:bg-gray-800 dark:border-gray-700 border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-5">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-emerald-500" /> Réserver une table</h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Date</label><Input type="date" value={reserveForm.date} onChange={e => setReserveForm({ ...reserveForm, date: e.target.value })} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></div>
                  <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Heure</label><Input type="time" value={reserveForm.time} onChange={e => setReserveForm({ ...reserveForm, time: e.target.value })} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></div>
                  <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Nombre de personnes</label><Input type="number" min={1} max={20} value={reserveForm.guests} onChange={e => setReserveForm({ ...reserveForm, guests: parseInt(e.target.value) || 1 })} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></div>
                  <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Zone</label>
                    <select value={reserveForm.zone} onChange={e => setReserveForm({ ...reserveForm, zone: e.target.value })} className="w-full h-10 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm dark:text-gray-100">
                      <option value="interieur">Intérieur</option>
                      <option value="terrasse">Terrasse</option>
                      <option value="vip">VIP</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2"><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Notes</label><Textarea value={reserveForm.notes} onChange={e => setReserveForm({ ...reserveForm, notes: e.target.value })} placeholder="Allergies, préférences..." rows={2} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></div>
                </div>
                <div className="flex gap-3 mt-4">
                  <Button onClick={submitReservation} disabled={reserveSaving} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                    {reserveSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CalendarCheck className="w-4 h-4 mr-2" />} Confirmer la réservation
                  </Button>
                  <Button variant="outline" onClick={() => setShowQuickReserve(false)} className="dark:border-gray-600">Annuler</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upcoming reservations highlighted */}
      {upcomingReservations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-2">À venir</h4>
          <div className="space-y-2">
            {upcomingReservations.map(r => (
              <Card key={r.id} className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 text-white">
                    <div className="text-center"><p className="text-lg font-bold leading-none">{r.date.slice(0, 2)}</p><p className="text-[10px]">{r.date.slice(3, 5)}</p></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{r.time} — {r.guests} pers.</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{zoneLabels[r.zone] || r.zone} {r.notes ? `• ${r.notes}` : ""}</p>
                  </div>
                  <Badge className={`${statusColors[r.status]} text-xs`}>{statusLabels[r.status]}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {reservations.length === 0 ? (
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-8 text-center"><CalendarCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400">Aucune réservation trouvée</p></CardContent></Card>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date & Heure</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Pers.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Zone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Notes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Statut</th>
              </tr></thead>
              <tbody className="divide-y dark:divide-gray-700">
                {reservationsPagination.paginatedItems.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{r.date} à {r.time}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{r.guests}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">{zoneLabels[r.zone] || r.zone}</Badge></td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-[200px] truncate">{r.notes || "-"}</td>
                    <td className="px-4 py-3"><Badge className={`${statusColors[r.status] || ""} text-xs`}>{statusLabels[r.status] || r.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Pagination currentPage={reservationsPagination.currentPage} totalPages={reservationsPagination.totalPages} totalItems={reservationsPagination.totalItems} itemsPerPage={reservationsPagination.itemsPerPage} onPageChange={reservationsPagination.setCurrentPage} label="réservations" />
    </div>
  );
}
