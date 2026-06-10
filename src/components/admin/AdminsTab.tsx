"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Edit3, Trash2, Save } from "lucide-react";
import type { AdminDB, AdminUser } from "@/lib/types";
import { adminRoleLabels } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";

export interface AdminsTabProps {
  admins: AdminDB[];
  admin: AdminUser;
  showAdminForm: boolean;
  editingAdmin: AdminDB | null;
  adminForm: { email: string; password: string; name: string; role: string; status: string };
  setAdminForm: (v: { email: string; password: string; name: string; role: string; status: string }) => void;
  openAddAdmin: () => void;
  openEditAdmin: (a: AdminDB) => void;
  saveAdmin: () => Promise<void>;
  setShowAdminForm: (v: boolean) => void;
  apiPatch: (url: string, body: object) => Promise<void>;
  apiDelete: (url: string, body: object) => Promise<void>;
  deleteAdminConfirm: string | null;
  setDeleteAdminConfirm: (v: string | null) => void;
}

export function AdminsTab({
  admins, admin, showAdminForm, editingAdmin, adminForm, setAdminForm,
  openAddAdmin, openEditAdmin, saveAdmin, setShowAdminForm,
  apiPatch, apiDelete, deleteAdminConfirm, setDeleteAdminConfirm,
}: AdminsTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(admins, 10);

  const handleSaveAdmin = async () => {
    await saveAdmin();
    notify.adminSaved(adminForm.name, !!editingAdmin);
  };

  const handleDeleteAdmin = async (a: AdminDB) => {
    await apiDelete("/api/admins", { id: a.id });
    setDeleteAdminConfirm(null);
    notify.adminDeleted(a.name);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{admins.filter(a => a.status === "active").length} Actifs</Badge>
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{admins.filter(a => a.status === "inactive").length} Inactifs</Badge>
        </div>
        <Button onClick={openAddAdmin} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
          <Plus className="w-4 h-4 mr-1" /> Ajouter un utilisateur
        </Button>
      </div>

      <AnimatePresence>
        {showAdminForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-900/10">
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{editingAdmin ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Nom *</label><Input value={adminForm.name} onChange={e => setAdminForm({ ...adminForm, name: e.target.value })} placeholder="Nom complet" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Email *</label><Input type="email" value={adminForm.email} onChange={e => setAdminForm({ ...adminForm, email: e.target.value })} placeholder="email@exemple.com" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Mot de passe {!editingAdmin && "*"}</label><Input type="password" value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} placeholder={editingAdmin ? "Laisser vide pour ne pas changer" : "Mot de passe"} className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Rôle *</label>
                    <select value={adminForm.role} onChange={e => setAdminForm({ ...adminForm, role: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm dark:text-gray-100">
                      {Object.entries(adminRoleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Statut</label>
                    <select value={adminForm.status} onChange={e => setAdminForm({ ...adminForm, status: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm dark:text-gray-100">
                      <option value="active">Actif</option><option value="inactive">Inactif</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleSaveAdmin} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl"><Save className="w-4 h-4 mr-1" /> {editingAdmin ? "Enregistrer" : "Ajouter"}</Button>
                  <Button variant="outline" onClick={() => { setShowAdminForm(false); }} className="dark:border-gray-600">Annuler</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

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
                <Badge variant="outline" className="text-xs dark:border-gray-600 dark:text-gray-300">{adminRoleLabels[a.role] || a.role}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => apiPatch("/api/admins", { id: a.id, status: a.status === "active" ? "inactive" : "active" })} className={`flex-1 text-xs rounded-lg ${a.status === "active" ? "text-red-500 border-red-200 dark:border-red-800" : "text-green-500 border-green-200 dark:border-green-800"}`}>
                  {a.status === "active" ? "Désactiver" : "Activer"}
                </Button>
                <button onClick={() => openEditAdmin(a)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-orange-900/30 dark:hover:text-orange-400" title="Modifier"><Edit3 className="w-4 h-4" /></button>
                {a.id !== admin.id && (deleteAdminConfirm === a.id ? (
                  <div className="flex items-center gap-1"><button onClick={() => handleDeleteAdmin(a)} className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Oui</button><button onClick={() => setDeleteAdminConfirm(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">Non</button></div>
                ) : (
                  <button onClick={() => setDeleteAdminConfirm(a.id)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="utilisateurs" />
    </div>
  );
}
