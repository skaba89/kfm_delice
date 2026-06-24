"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { StaffDB } from "@/lib/types";
import { formatPrice, staffRoleLabels, staffRoleColors, staffStatusColors, staffStatusLabels } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { AdminFormCard, CrudHeader, DataTable, type DataTableColumn, DeleteConfirmButton, EditButton, FormField, FormSelect } from "@/components/admin/shared";
import type { CrudStateReturn } from "@/lib/hooks/use-crud-state";

type StaffForm = { name: string; phone: string; role: string; salary: number; status: string; hireDate: string; notes: string };

export interface StaffTabProps {
  staffList: StaffDB[];
  crud: CrudStateReturn<StaffDB, StaffForm>;
  apiDelete: (url: string, body: object) => Promise<void>;
}

export function StaffTab({ staffList, crud, apiDelete }: StaffTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(staffList, 10);

  const handleSave = async () => {
    await crud.save();
    notify.staffSaved(crud.form.name, !!crud.editing);
  };

  const handleDelete = async (s: StaffDB) => {
    await apiDelete("/api/staff", { id: s.id });
    crud.setDeleteConfirm(null);
    notify.staffDeleted(s.name);
  };

  const columns: DataTableColumn<StaffDB>[] = [
    { header: "Nom", cell: (s) => (<><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">Depuis {s.hireDate || "-"}</p></>) },
    { header: "Rôle", cell: (s) => <Badge className={`${staffRoleColors[s.role] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"} text-xs`}>{staffRoleLabels[s.role] || s.role}</Badge> },
    { header: "Téléphone", cell: (s) => <span className="text-sm text-gray-700 dark:text-gray-300">{s.phone || "-"}</span> },
    { header: "Salaire", cell: (s) => <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatPrice(s.salary)}</span> },
    { header: "Statut", cell: (s) => <Badge className={`${staffStatusColors[s.status] || ""} text-xs`}>{staffStatusLabels[s.status] || s.status}</Badge> },
    { header: "Actions", cell: (s) => (
      <div className="flex items-center gap-1">
        <EditButton onClick={() => crud.openEdit(s)} />
        <DeleteConfirmButton confirming={crud.deleteConfirm === s.id} onConfirm={() => handleDelete(s)} onRequestConfirm={() => crud.setDeleteConfirm(s.id)} onCancel={() => crud.setDeleteConfirm(null)} />
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <CrudHeader
        badges={[
          { count: staffList.filter(s => s.status === "active").length, label: "Actifs", color: "green" },
          { count: staffList.filter(s => s.status === "on_leave").length, label: "En congé", color: "amber" },
          { count: staffList.filter(s => s.status === "inactive").length, label: "Inactifs", color: "red" },
        ]}
        addLabel="Ajouter"
        onAdd={crud.openAdd}
      />

      <AdminFormCard
        show={crud.showForm}
        editing={!!crud.editing}
        addTitle="Ajouter un membre"
        editTitle="Modifier le membre"
        onSave={handleSave}
        onCancel={() => crud.setShowForm(false)}
      >
        <FormField label="Nom" value={crud.form.name} onChange={v => crud.setForm({ ...crud.form, name: v })} placeholder="Nom complet" required />
        <FormField label="Téléphone" value={crud.form.phone} onChange={v => crud.setForm({ ...crud.form, phone: v })} placeholder="+224 6XX XX XX XX" />
        <FormSelect label="Rôle" value={crud.form.role} onChange={v => crud.setForm({ ...crud.form, role: v })} options={Object.entries(staffRoleLabels).map(([k, v]) => ({ value: k, label: v }))} required />
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Salaire (GNF)</label>
          <Input type="number" value={crud.form.salary || ""} onChange={e => crud.setForm({ ...crud.form, salary: parseInt(e.target.value) || 0 })} placeholder="600000" className="dark:bg-gray-800 dark:border-gray-600" />
        </div>
        <FormSelect label="Statut" value={crud.form.status} onChange={v => crud.setForm({ ...crud.form, status: v })} options={[{ value: "active", label: "Actif" }, { value: "on_leave", label: "En congé" }, { value: "inactive", label: "Inactif" }]} />
        <FormField label="Date d'embauche" value={crud.form.hireDate} onChange={v => crud.setForm({ ...crud.form, hireDate: v })} type="date" />
        <div className="sm:col-span-2 lg:col-span-3">
          <FormField label="Notes" value={crud.form.notes} onChange={v => crud.setForm({ ...crud.form, notes: v })} placeholder="Notes supplémentaires" />
        </div>
      </AdminFormCard>

      <DataTable columns={columns} data={paginatedItems} />
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="personnel" />
    </div>
  );
}
