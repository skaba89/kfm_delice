"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import type { StaffDB } from "@/lib/types";
import { formatPrice, staffRoleLabels, staffStatusColors, staffStatusLabels, expenseCategoryColors } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { AdminFormCard } from "@/components/admin/shared/AdminFormCard";
import { DeleteConfirmButton } from "@/components/admin/shared/DeleteConfirmButton";
import { EditButton } from "@/components/admin/shared/EditButton";
import { FormField } from "@/components/admin/shared/FormField";
import { FormSelect } from "@/components/admin/shared/FormSelect";

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
  openAddStaff, openEditStaff, saveStaff, setShowStaffForm,
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

      <AdminFormCard
        show={showStaffForm}
        editing={!!editingStaff}
        addTitle="Ajouter un membre"
        editTitle="Modifier le membre"
        onSave={handleSaveStaff}
        onCancel={() => setShowStaffForm(false)}
      >
        <FormField label="Nom" value={staffForm.name} onChange={v => setStaffForm({ ...staffForm, name: v })} placeholder="Nom complet" required />
        <FormField label="Téléphone" value={staffForm.phone} onChange={v => setStaffForm({ ...staffForm, phone: v })} placeholder="+224 6XX XX XX XX" />
        <FormSelect label="Rôle" value={staffForm.role} onChange={v => setStaffForm({ ...staffForm, role: v })} options={Object.entries(staffRoleLabels).map(([k, v]) => ({ value: k, label: v }))} required />
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Salaire (GNF)</label>
          <Input type="number" value={staffForm.salary || ""} onChange={e => setStaffForm({ ...staffForm, salary: parseInt(e.target.value) || 0 })} placeholder="600000" className="dark:bg-gray-800 dark:border-gray-600" />
        </div>
        <FormSelect label="Statut" value={staffForm.status} onChange={v => setStaffForm({ ...staffForm, status: v })} options={[{ value: "active", label: "Actif" }, { value: "on_leave", label: "En congé" }, { value: "inactive", label: "Inactif" }]} />
        <FormField label="Date d'embauche" value={staffForm.hireDate} onChange={v => setStaffForm({ ...staffForm, hireDate: v })} type="date" />
        <div className="sm:col-span-2 lg:col-span-3">
          <FormField label="Notes" value={staffForm.notes} onChange={v => setStaffForm({ ...staffForm, notes: v })} placeholder="Notes supplémentaires" />
        </div>
      </AdminFormCard>

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
                    <EditButton onClick={() => openEditStaff(s)} />
                    <DeleteConfirmButton
                      confirming={deleteStaffConfirm === s.id}
                      onConfirm={() => handleDeleteStaff(s)}
                      onRequestConfirm={() => setDeleteStaffConfirm(s.id)}
                      onCancel={() => setDeleteStaffConfirm(null)}
                    />
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
