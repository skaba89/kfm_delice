"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Car } from "lucide-react";
import { VehicleIcon } from "@/components/VehicleIcon";
import type { DriverDB } from "@/lib/types";
import { vehicleLabels, driverStatusColors, driverStatusLabels } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { AdminFormCard } from "@/components/admin/shared/AdminFormCard";
import { FormField } from "@/components/admin/shared/FormField";
import { FormSelect } from "@/components/admin/shared/FormSelect";
import { DeleteConfirmButton } from "@/components/admin/shared/DeleteConfirmButton";
import { EditButton } from "@/components/admin/shared/EditButton";

export interface DriversTabProps {
  drivers: DriverDB[];
  showDriverForm: boolean;
  editingDriver: DriverDB | null;
  driverForm: { name: string; phone: string; vehicle: string; zone: string };
  setDriverForm: (v: { name: string; phone: string; vehicle: string; zone: string }) => void;
  openAddDriver: () => void;
  openEditDriver: (d: DriverDB) => void;
  saveDriver: () => Promise<void>;
  setShowDriverForm: (v: boolean) => void;
  apiPatch: (url: string, body: object) => Promise<void>;
  apiDelete: (url: string, body: object) => Promise<void>;
  deleteDriverConfirm: string | null;
  setDeleteDriverConfirm: (v: string | null) => void;
}

export function DriversTab({
  drivers, showDriverForm, editingDriver, driverForm, setDriverForm,
  openAddDriver, openEditDriver, saveDriver, setShowDriverForm,
  apiPatch, apiDelete, deleteDriverConfirm, setDeleteDriverConfirm,
}: DriversTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(drivers, 10);

  const handleSaveDriver = async () => {
    await saveDriver();
    notify.driverSaved(driverForm.name, !!editingDriver);
  };

  const handleDeleteDriver = async (d: DriverDB) => {
    await apiDelete("/api/drivers", { id: d.id });
    setDeleteDriverConfirm(null);
    notify.driverDeleted(d.name);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{drivers.filter(d => d.status === "available").length} Disponibles</Badge>
          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">{drivers.filter(d => d.status === "busy").length} En livraison</Badge>
          <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">{drivers.filter(d => d.status === "offline").length} Hors ligne</Badge>
        </div>
        <Button onClick={openAddDriver} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
          <Plus className="w-4 h-4 mr-1" /> Ajouter un livreur
        </Button>
      </div>

      <AdminFormCard
        show={showDriverForm}
        editing={!!editingDriver}
        addTitle="Ajouter un livreur"
        editTitle="Modifier le livreur"
        onSave={handleSaveDriver}
        onCancel={() => setShowDriverForm(false)}
      >
        <FormField label="Nom" value={driverForm.name} onChange={v => setDriverForm({...driverForm, name: v})} placeholder="Nom complet" required />
        <FormField label="Téléphone" value={driverForm.phone} onChange={v => setDriverForm({...driverForm, phone: v})} placeholder="+224 6XX XX XX XX" required />
        <FormSelect label="Véhicule" value={driverForm.vehicle} onChange={v => setDriverForm({...driverForm, vehicle: v})} options={[{value: "moto", label: "Moto"}, {value: "velo", label: "Vélo"}, {value: "voiture", label: "Voiture"}]} />
        <FormField label="Zone" value={driverForm.zone} onChange={v => setDriverForm({...driverForm, zone: v})} placeholder="Conakry" />
      </AdminFormCard>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <Button size="sm" variant="outline" onClick={() => {
                  const newStatus = d.status === "available" ? "offline" : "available";
                  apiPatch("/api/drivers", { id: d.id, status: newStatus });
                }} className={`flex-1 text-xs rounded-lg ${d.status === "available" ? "text-orange-600 border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-900/30" : "text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/30"}`}>
                  {d.status === "available" ? "M hors ligne" : "M dispo"}
                </Button>
                <EditButton onClick={() => openEditDriver(d)} />
                <DeleteConfirmButton
                  confirming={deleteDriverConfirm === d.id}
                  onConfirm={() => handleDeleteDriver(d)}
                  onRequestConfirm={() => setDeleteDriverConfirm(d.id)}
                  onCancel={() => setDeleteDriverConfirm(null)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="livreurs" />
      {drivers.length === 0 && (
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-8 text-center"><Car className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400">Aucun livreur enregistré</p></CardContent></Card>
      )}
    </div>
  );
}
