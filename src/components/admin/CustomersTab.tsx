"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCheck } from "lucide-react";
import type { CustomerDB } from "@/lib/types";
import { formatPrice } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { AdminFormCard, CrudHeader, DeleteConfirmButton, EditButton, EmptyState, FormField, FormSelect, SummaryCards } from "@/components/admin/shared";
import type { CrudStateReturn } from "@/lib/hooks/use-crud-state";

type CustomerForm = { name: string; email: string; phone: string; address: string; status: string };

export interface CustomersTabProps {
  customers: CustomerDB[];
  crud: CrudStateReturn<CustomerDB, CustomerForm>;
  apiPatch: (url: string, body: object) => Promise<void>;
  apiDelete: (url: string, body: object) => Promise<void>;
}

export function CustomersTab({ customers, crud, apiPatch, apiDelete }: CustomersTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(customers, 10);

  const handleSave = async () => {
    await crud.save();
    notify.customerSaved(crud.form.name, !!crud.editing);
  };

  const handleDelete = async (c: CustomerDB) => {
    await apiDelete("/api/customers", { id: c.id });
    crud.setDeleteConfirm(null);
    notify.customerDeleted(c.name);
  };

  const totalSpent = customers.reduce((s, c) => s + c.totalSpent, 0);
  const totalLoyalty = customers.reduce((s, c) => s + c.loyaltyPoints, 0);

  return (
    <div className="space-y-4">
      <CrudHeader
        badges={[
          { count: customers.filter(c => c.status === "active").length, label: "Actifs", color: "green" },
          { count: customers.filter(c => c.status === "inactive").length, label: "Inactifs", color: "red" },
          { count: customers.length, label: "Total", color: "blue" },
        ]}
        addLabel="Ajouter un client"
        onAdd={crud.openAdd}
      />

      <SummaryCards columns={4} items={[
        { label: "Clients", value: customers.length },
        { label: "Total dépensé", value: formatPrice(totalSpent), valueColor: "text-green-600 dark:text-green-400" },
        { label: "Points fidélité", value: totalLoyalty.toLocaleString(), valueColor: "text-orange-600 dark:text-orange-400" },
        { label: "Commandes totales", value: customers.reduce((s, c) => s + c.totalOrders, 0), valueColor: "text-blue-600 dark:text-blue-400" },
      ]} />

      <AdminFormCard
        show={crud.showForm}
        editing={!!crud.editing}
        addTitle="Ajouter un client"
        editTitle="Modifier le client"
        onSave={handleSave}
        onCancel={() => crud.setShowForm(false)}
      >
        <FormField label="Nom" value={crud.form.name} onChange={v => crud.setForm({...crud.form, name: v})} placeholder="Nom complet" required />
        <FormField label="Email" value={crud.form.email} onChange={v => crud.setForm({...crud.form, email: v})} placeholder="email@exemple.com" type="email" required />
        <FormField label="Téléphone" value={crud.form.phone} onChange={v => crud.setForm({...crud.form, phone: v})} placeholder="+224 6XX XX XX XX" />
        <div className="sm:col-span-2">
          <FormField label="Adresse" value={crud.form.address} onChange={v => crud.setForm({...crud.form, address: v})} placeholder="Adresse de livraison" />
        </div>
        <FormSelect label="Statut" value={crud.form.status} onChange={v => crud.setForm({...crud.form, status: v})} options={[{value: "active", label: "Actif"}, {value: "inactive", label: "Inactif"}]} />
      </AdminFormCard>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedItems.map(c => (
          <Card key={c.id} className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400">{c.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.email}</p>
                </div>
                <Badge className={`${c.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"} text-xs`}>{c.status === "active" ? "Actif" : "Inactif"}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center"><p className="text-xs text-gray-500 dark:text-gray-400">Commandes</p><p className="text-sm font-bold text-gray-900 dark:text-gray-100">{c.totalOrders}</p></div>
                <div className="text-center"><p className="text-xs text-gray-500 dark:text-gray-400">Dépensé</p><p className="text-sm font-bold text-green-600 dark:text-green-400">{formatPrice(c.totalSpent)}</p></div>
                <div className="text-center"><p className="text-xs text-gray-500 dark:text-gray-400">Points</p><p className="text-sm font-bold text-orange-600 dark:text-orange-400">{c.loyaltyPoints}</p></div>
              </div>
              {c.phone && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{c.phone}</p>}
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => apiPatch("/api/customers", { id: c.id, status: c.status === "active" ? "inactive" : "active" })} className={`flex-1 text-xs rounded-lg ${c.status === "active" ? "text-red-500 border-red-200 dark:border-red-800" : "text-green-500 border-green-200 dark:border-green-800"}`}>
                  {c.status === "active" ? "Désactiver" : "Activer"}
                </Button>
                <EditButton onClick={() => crud.openEdit(c)} />
                <DeleteConfirmButton
                  confirming={crud.deleteConfirm === c.id}
                  onConfirm={() => handleDelete(c)}
                  onRequestConfirm={() => crud.setDeleteConfirm(c.id)}
                  onCancel={() => crud.setDeleteConfirm(null)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {customers.length === 0 && <EmptyState icon={UserCheck} message="Aucun client enregistré" />}
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="clients" />
    </div>
  );
}
