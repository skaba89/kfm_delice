"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VehicleIcon } from "@/components/VehicleIcon";
import { Bike } from "lucide-react";
import type { DriverDB } from "@/lib/types";
import { vehicleLabels, driverStatusColors, driverStatusLabels } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { AdminFormCard, CrudHeader, DeleteConfirmButton, EditButton, EmptyState, FormField, FormSelect } from "@/components/admin/shared";
import type { CrudStateReturn } from "@/lib/hooks/use-crud-state";

type DriverForm = { name: string; phone: string; vehicle: string; zone: string };

export interface DriversTabProps {
  drivers: DriverDB[];
  crud: CrudStateReturn<DriverDB, DriverForm>;
  apiPatch: (url: string, body: object) => Promise<void>;
  apiDelete: (url: string, body: object) => Promise<void>;
}

export function DriversTab({ drivers, crud, apiPatch, apiDelete }: DriversTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(drivers, 10);

  const handleSave = async () => {
    await crud.save();
    notify.driverSaved(crud.form.name, !!crud.editing);
  };

  const handleDelete = async (d: DriverDB) => {
    await apiDelete("/api/drivers", { id: d.id });
    crud.setDeleteConfirm(null);
    notify.driverDeleted(d.name);
  };

  return (
    <div className="space-y-4">
      <CrudHeader
        badges={[
          { count: drivers.filter(d => d.status === "available").length, label: "Disponibles", color: "green" },
          { count: drivers.filter(d => d.status === "busy").length, label: "En livraison", color: "orange" },
          { count: drivers.filter(d => d.status === "offline").length, label: "Hors ligne", color: "gray" },
        ]}
        addLabel="Ajouter un livreur"
        onAdd={crud.openAdd}
      />

      <AdminFormCard
        show={crud.showForm}
        editing={!!crud.editing}
        addTitle="Ajouter un livreur"
        editTitle="Modifier le livreur"
        onSave={handleSave}
        onCancel={() => crud.setShowForm(false)}
      >
        <FormField label="Nom" value={crud.form.name} onChange={v => crud.setForm({...crud.form, name: v})} placeholder="Nom complet" required />
        <FormField label="Téléphone" value={crud.form.phone} onChange={v => crud.setForm({...crud.form, phone: v})} placeholder="+224 6XX XX XX XX" required />
        <FormSelect label="Véhicule" value={crud.form.vehicle} onChange={v => crud.setForm({...crud.form, vehicle: v})} options={[{value: "moto", label: "Moto"}, {value: "velo", label: "Vélo"}, {value: "voiture", label: "Voiture"}]} />
        <FormField label="Zone" value={crud.form.zone} onChange={v => crud.setForm({...crud.form, zone: v})} placeholder="Conakry" />
      </AdminFormCard>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState icon={Bike} message="Aucun livreur enregistré" />
          </div>
        )}
        {paginatedItems.map(d => (
          <Card key={d.id} className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 flex items-center justify-center">
                  <VehicleIcon vehicle={d.vehicle} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{d.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{d.phone}</p>
                </div>
                <Badge className={`${driverStatusColors[d.status] || ""} text-xs`}>{driverStatusLabels[d.status] || d.status}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{d.totalDeliveries}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Livraisons</p>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{d.rating}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Note</p>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{vehicleLabels[d.vehicle] || d.vehicle}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{d.zone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => {
                  const newStatus = d.status === "available" ? "offline" : "available";
                  apiPatch("/api/drivers", { id: d.id, status: newStatus });
                }} className={`flex-1 text-xs px-2 py-1.5 rounded-lg border ${d.status === "available" ? "text-orange-600 border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-900/30" : "text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/30"}`}>
                  {d.status === "available" ? "M hors ligne" : "M dispo"}
                </button>
                <EditButton onClick={() => crud.openEdit(d)} />
                <DeleteConfirmButton
                  confirming={crud.deleteConfirm === d.id}
                  onConfirm={() => handleDelete(d)}
                  onRequestConfirm={() => crud.setDeleteConfirm(d.id)}
                  onCancel={() => crud.setDeleteConfirm(null)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="livreurs" />
    </div>
  );
}
