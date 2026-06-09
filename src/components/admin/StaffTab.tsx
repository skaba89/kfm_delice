"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Edit3, Trash2, Save } from "lucide-react";
import type { StaffDB } from "@/lib/types";
import { formatPrice, staffRoleLabels, staffStatusColors, staffStatusLabels, expenseCategoryColors } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";

export interface StaffTabProps {
  staffList: StaffDB[];
  showStaffForm: boolean;
  editingStaff: StaffDB | null;
  staffForm: { name: string; phone: string; role: string; salary: number; status: string; hireDate: string; notes: string };
  setStaffForm: (v: { name: string; phone: string; role: string; salary: number; status: string; hireDate: string; notes: string }) => void;
  openAddStaff: () => void;
  openEditStaff: (s: StaffDB) => void;
  saveStaff: () => Promise<void>;
  setShowStaffForm: (v: boolean) => void;
  apiPatch: (url: string, body: object) => Promise<void>;
  apiDelete: (url: string, body: object) => Promise<void>;
  deleteStaffConfirm: string | null;
  setDeleteStaffConfirm: (v: string | null) => void;
}

export function StaffTab({
  staffList, showStaffForm, editingStaff, staffForm, setStaffForm,
  openAddStaff, saveStaff, setShowStaffForm,
  apiPatch, apiDelete, deleteStaffConfirm, setDeleteStaffConfirm,
}: StaffTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(staffList, 10);

  const handleSaveStaff = async () => {
    await saveStaff();
    notify.staffSaved(staffForm.name, !!editingStaff);
  };

  const handleDeleteStaff = async (s: StaffDB) => {
    await apiDelete("/api/staff", { id: s.id });
    setDeleteStaffConfirm(null);
    notify.staffDeleted(s.name);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{staffList.filter(s => s.status === "active").length} Actifs</Badge>
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{staffList.filter(s => s.status === "on_leave").length} En congé</Badge>
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{staffList.filter(s => s.status === "inactive").length} Inactifs</Badge>
        </div>
        <Button onClick={openAddStaff} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
      </div>

      <AnimatePresence>
        {showStaffForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-900/10">
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{editingStaff ? "Modifier le membre" : "Ajouter un membre"}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Nom *</label><Input value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} placeholder="Nom complet" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Téléphone</label><Input value={staffForm.phone} onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })} placeholder="+224 6XX XX XX XX" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Rôle *</label>
                    <select value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm dark:text-gray-100">
                      {Object.entries(staffRoleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Salaire (GNF)</label><Input type="number" value={staffForm.salary || ""} onChange={e => setStaffForm({ ...staffForm, salary: parseInt(e.target.value) || 0 })} placeholder="600000" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Statut</label>
                    <select value={staffForm.status} onChange={e => setStaffForm({ ...staffForm, status: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm dark:text-gray-100">
                      <option value="active">Actif</option><option value="on_leave">En congé</option><option value="inactive">Inactif</option>
                    </select>
                  </div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Date d&apos;embauche</label><Input type="date" value={staffForm.hireDate} onChange={e => setStaffForm({ ...staffForm, hireDate: e.target.value })} className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div className="sm:col-span-2 lg:col-span-3"><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Notes</label><Input value={staffForm.notes} onChange={e => setStaffForm({ ...staffForm, notes: e.target.value })} placeholder="Notes supplémentaires" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleSaveStaff} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl"><Save className="w-4 h-4 mr-1" /> {editingStaff ? "Enregistrer" : "Ajouter"}</Button>
                  <Button variant="outline" onClick={() => { setShowStaffForm(false); }} className="dark:border-gray-600">Annuler</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Rôle</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Téléphone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Salaire</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr></thead>
            <tbody className="divide-y dark:divide-gray-700">
              {paginatedItems.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">Depuis {s.hireDate || "-"}</p></td>
                  <td className="px-4 py-3"><Badge className={`${expenseCategoryColors[s.role] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"} text-xs`}>{staffRoleLabels[s.role] || s.role}</Badge></td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{s.phone || "-"}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{formatPrice(s.salary)}</td>
                  <td className="px-4 py-3"><Badge className={`${staffStatusColors[s.status] || ""} text-xs`}>{staffStatusLabels[s.status] || s.status}</Badge></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1">
                    <button onClick={() => { setStaffForm({ name: s.name, phone: s.phone, role: s.role, salary: s.salary, status: s.status, hireDate: s.hireDate, notes: s.notes }); setShowStaffForm(true); }} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-orange-900/30 dark:hover:text-orange-400" title="Modifier"><Edit3 className="w-4 h-4" /></button>
                    {deleteStaffConfirm === s.id ? (
                      <div className="flex items-center gap-1"><button onClick={() => handleDeleteStaff(s)} className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Oui</button><button onClick={() => setDeleteStaffConfirm(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">Non</button></div>
                    ) : (
                      <button onClick={() => setDeleteStaffConfirm(s.id)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="personnel" />
    </div>
  );
}
