"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, UserCheck } from "lucide-react";
import type { CustomerDB } from "@/lib/types";
import { formatPrice } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { AdminFormCard } from "@/components/admin/shared/AdminFormCard";
import { FormField } from "@/components/admin/shared/FormField";
import { FormSelect } from "@/components/admin/shared/FormSelect";
import { DeleteConfirmButton } from "@/components/admin/shared/DeleteConfirmButton";
import { EditButton } from "@/components/admin/shared/EditButton";

export interface CustomersTabProps {
  customers: CustomerDB[];
  showCustomerForm: boolean;
  editingCustomer: CustomerDB | null;
  customerForm: { name: string; email: string; phone: string; address: string; status: string };
  setCustomerForm: (v: { name: string; email: string; phone: string; address: string; status: string }) => void;
  openAddCustomer: () => void;
  openEditCustomer: (c: CustomerDB) => void;
  saveCustomer: () => Promise<void>;
  setShowCustomerForm: (v: boolean) => void;
  apiPatch: (url: string, body: object) => Promise<void>;
  apiDelete: (url: string, body: object) => Promise<void>;
  deleteCustomerConfirm: string | null;
  setDeleteCustomerConfirm: (v: string | null) => void;
}

export function CustomersTab({
  customers, showCustomerForm, editingCustomer, customerForm, setCustomerForm,
  openAddCustomer, openEditCustomer, saveCustomer, setShowCustomerForm,
  apiPatch, apiDelete, deleteCustomerConfirm, setDeleteCustomerConfirm,
}: CustomersTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(customers, 10);

  const handleSaveCustomer = async () => {
    await saveCustomer();
    notify.customerSaved(customerForm.name, !!editingCustomer);
  };

  const handleDeleteCustomer = async (c: CustomerDB) => {
    await apiDelete("/api/customers", { id: c.id });
    setDeleteCustomerConfirm(null);
    notify.customerDeleted(c.name);
  };

  const totalSpent = customers.reduce((s, c) => s + c.totalSpent, 0);
  const totalLoyalty = customers.reduce((s, c) => s + c.loyaltyPoints, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{customers.filter(c => c.status === "active").length} Actifs</Badge>
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{customers.filter(c => c.status === "inactive").length} Inactifs</Badge>
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{customers.length} Total</Badge>
        </div>
        <Button onClick={openAddCustomer} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
          <Plus className="w-4 h-4 mr-1" /> Ajouter un client
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-3"><p className="text-xs text-gray-500 dark:text-gray-400">Clients</p><p className="text-lg font-bold text-gray-900 dark:text-gray-100">{customers.length}</p></CardContent></Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-3"><p className="text-xs text-gray-500 dark:text-gray-400">Total dépensé</p><p className="text-lg font-bold text-green-600 dark:text-green-400">{formatPrice(totalSpent)}</p></CardContent></Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-3"><p className="text-xs text-gray-500 dark:text-gray-400">Points fidélité</p><p className="text-lg font-bold text-orange-600 dark:text-orange-400">{totalLoyalty.toLocaleString()}</p></CardContent></Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-3"><p className="text-xs text-gray-500 dark:text-gray-400">Commandes totales</p><p className="text-lg font-bold text-blue-600 dark:text-blue-400">{customers.reduce((s, c) => s + c.totalOrders, 0)}</p></CardContent></Card>
      </div>

      <AdminFormCard
        show={showCustomerForm}
        editing={!!editingCustomer}
        addTitle="Ajouter un client"
        editTitle="Modifier le client"
        onSave={handleSaveCustomer}
        onCancel={() => setShowCustomerForm(false)}
      >
        <FormField label="Nom" value={customerForm.name} onChange={v => setCustomerForm({...customerForm, name: v})} placeholder="Nom complet" required />
        <FormField label="Email" value={customerForm.email} onChange={v => setCustomerForm({...customerForm, email: v})} placeholder="email@exemple.com" type="email" required />
        <FormField label="Téléphone" value={customerForm.phone} onChange={v => setCustomerForm({...customerForm, phone: v})} placeholder="+224 6XX XX XX XX" />
        <div className="sm:col-span-2">
          <FormField label="Adresse" value={customerForm.address} onChange={v => setCustomerForm({...customerForm, address: v})} placeholder="Adresse de livraison" />
        </div>
        <FormSelect label="Statut" value={customerForm.status} onChange={v => setCustomerForm({...customerForm, status: v})} options={[{value: "active", label: "Actif"}, {value: "inactive", label: "Inactif"}]} />
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
                <EditButton onClick={() => openEditCustomer(c)} />
                <DeleteConfirmButton
                  confirming={deleteCustomerConfirm === c.id}
                  onConfirm={() => handleDeleteCustomer(c)}
                  onRequestConfirm={() => setDeleteCustomerConfirm(c.id)}
                  onCancel={() => setDeleteCustomerConfirm(null)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {customers.length === 0 && <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-8 text-center"><UserCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400">Aucun client enregistré</p></CardContent></Card>}
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="clients" />
    </div>
  );
}
