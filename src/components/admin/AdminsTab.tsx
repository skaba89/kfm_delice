"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminDB, AdminUser } from "@/lib/types";
import { adminRoleLabels, adminRoleColors } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { AdminFormCard, CrudHeader, DeleteConfirmButton, EditButton, FormField, FormSelect } from "@/components/admin/shared";
import type { CrudStateReturn } from "@/lib/hooks/use-crud-state";

type AdminForm = { email: string; password: string; name: string; role: string; status: string };

export interface AdminsTabProps {
  admins: AdminDB[];
  admin: AdminUser;
  crud: CrudStateReturn<AdminDB, AdminForm>;
  apiPatch: (url: string, body: object) => Promise<void>;
  apiDelete: (url: string, body: object) => Promise<void>;
}

export function AdminsTab({ admins, admin, crud, apiPatch, apiDelete }: AdminsTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(admins, 10);

  const handleSave = async () => {
    try {
      await crud.save();
      notify.adminSaved(crud.form.name, !!crud.editing);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (a: AdminDB) => {
    try {
      await apiDelete("/api/admins", { id: a.id });
      crud.setDeleteConfirm(null);
      notify.adminDeleted(a.name);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Erreur lors de la suppression");
    }
  };

  return (
    <div className="space-y-4">
      <CrudHeader
        badges={[
          { count: admins.filter(a => a.status === "active").length, label: "Actifs", color: "green" },
          { count: admins.filter(a => a.status === "inactive").length, label: "Inactifs", color: "red" },
        ]}
        addLabel="Ajouter un utilisateur"
        onAdd={crud.openAdd}
      />

      <AdminFormCard
        show={crud.showForm}
        editing={!!crud.editing}
        addTitle="Ajouter un utilisateur"
        editTitle="Modifier l'utilisateur"
        onSave={handleSave}
        onCancel={() => crud.setShowForm(false)}
      >
        <FormField label="Nom" value={crud.form.name} onChange={v => crud.setForm({ ...crud.form, name: v })} placeholder="Nom complet" required />
        <FormField label="Email" value={crud.form.email} onChange={v => crud.setForm({ ...crud.form, email: v })} placeholder="email@exemple.com" type="email" required />
        <FormField label={`Mot de passe${!crud.editing ? " *" : ""}`} value={crud.form.password} onChange={v => crud.setForm({ ...crud.form, password: v })} placeholder={crud.editing ? "Laisser vide pour ne pas changer" : "Mot de passe"} type="password" />
        <FormSelect label="Rôle" value={crud.form.role} onChange={v => crud.setForm({ ...crud.form, role: v })} options={Object.entries(adminRoleLabels).map(([k, v]) => ({ value: k, label: v }))} required />
        <p className="col-span-full text-xs text-gray-500 dark:text-gray-400 -mt-2">
          {crud.form.role === "admin" && "Accès complet — gestion des utilisateurs, menu, finances, opérations."}
          {crud.form.role === "manager" && "Gestion opérationnelle — sauf gestion des utilisateurs."}
          {crud.form.role === "staff" && "Opérations — commandes, réservations, cuisine, caisse POS."}
          {crud.form.role === "cashier" && "Caisse — POS, paiements, factures, liste clients."}
          {crud.form.role === "kitchen" && "Cuisine — affichage cuisine, stock (lecture), statut commandes."}
          {crud.form.role === "delivery_manager" && "Livraison — livreurs, livraisons, commandes."}
          {crud.form.role === "host" && "Accueil — réservations uniquement."}
          {crud.form.role === "accountant" && "Comptabilité — factures, devis, dépenses, paiements, analytique."}
        </p>
        <FormSelect label="Statut" value={crud.form.status} onChange={v => crud.setForm({ ...crud.form, status: v })} options={[{ value: "active", label: "Actif" }, { value: "inactive", label: "Inactif" }]} />
      </AdminFormCard>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedItems.map(a => (
          <Card key={a.id} className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 flex items-center justify-center text-sm font-bold text-orange-600 dark:text-orange-400">{a.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{a.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{a.email}</p>
                </div>
                <Badge className={`${a.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"} text-xs`}>{a.status === "active" ? "Actif" : "Inactif"}</Badge>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={`text-xs ${adminRoleColors[a.role] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"}`}>{adminRoleLabels[a.role] || a.role}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={async () => { try { await apiPatch("/api/admins", { id: a.id, status: a.status === "active" ? "inactive" : "active" }); } catch (e) { notify.error(e instanceof Error ? e.message : "Erreur"); } }} className={`flex-1 text-xs rounded-lg ${a.status === "active" ? "text-red-500 border-red-200 dark:border-red-800" : "text-green-500 border-green-200 dark:border-green-800"}`}>
                  {a.status === "active" ? "Désactiver" : "Activer"}
                </Button>
                <EditButton onClick={() => crud.openEdit(a)} />
                {a.id !== admin.id && (
                  <DeleteConfirmButton
                    confirming={crud.deleteConfirm === a.id}
                    onConfirm={() => handleDelete(a)}
                    onRequestConfirm={() => crud.setDeleteConfirm(a.id)}
                    onCancel={() => crud.setDeleteConfirm(null)}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="utilisateurs" />
    </div>
  );
}
