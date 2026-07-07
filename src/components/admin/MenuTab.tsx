"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Star, UtensilsCrossed, Upload } from "lucide-react";
import { useState } from "react";
import type { MenuItemDB } from "@/lib/types";
import { MENU_CATS, formatPrice } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { AdminFormCard, DeleteConfirmButton, EditButton, EmptyState, FormSelect } from "@/components/admin/shared";
import type { CrudStateReturn } from "@/lib/hooks/use-crud-state";

type MenuForm = { name: string; description: string; price: number; category: string; image: string; badge: string; popular: boolean; available: boolean };

export interface MenuTabProps {
  menuItems: MenuItemDB[];
  menuFilter: string;
  setMenuFilter: (v: string) => void;
  crud: CrudStateReturn<MenuItemDB, MenuForm>;
  apiPatch: (url: string, body: object) => Promise<void>;
  apiDelete: (url: string, body: object) => Promise<void>;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  /** When true, hides add/edit/delete buttons — used for kitchen role (read-only recipe view). */
  readOnly?: boolean;
}

export function MenuTab({
  menuItems, menuFilter, setMenuFilter,
  crud, apiPatch, apiDelete, apiFetch, readOnly = false,
}: MenuTabProps) {
  const filteredMenuItems = menuFilter === "all" ? menuItems : menuItems.filter(m => m.category === menuFilter);
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(filteredMenuItems, 12);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        return data.url;
      }
    } catch (e) {
      console.error('Upload failed:', e);
    }
    return null;
  };

  const handleSave = async () => {
    try {
      await crud.save();
      notify.menuItemSaved(crud.form.name, !!crud.editing);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (item: MenuItemDB) => {
    try {
      await apiDelete("/api/menu", { id: item.id });
      crud.setDeleteConfirm(null);
      notify.menuItemDeleted(item.name);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Erreur lors de la suppression");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">{menuItems.length} plats</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setMenuFilter("all")} className={`text-xs px-2 py-1 rounded-lg ${menuFilter === "all" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"}`}>Tous</button>
            {MENU_CATS.map(c => <button key={c.id} onClick={() => setMenuFilter(c.id)} className={`text-xs px-2 py-1 rounded-lg ${menuFilter === c.id ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"}`}>{c.name}</button>)}
          </div>
        </div>
        {!readOnly && (
          <button onClick={() => crud.openAdd()} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm px-4 py-2 flex items-center gap-1">
            <span className="text-lg leading-none">+</span> Ajouter
          </button>
        )}
        {readOnly && (
          <span className="text-xs text-gray-500 dark:text-gray-400 italic">Lecture seule — recettes visibles en consultation</span>
        )}
      </div>

      <AdminFormCard
        show={crud.showForm}
        editing={!!crud.editing}
        addTitle="Ajouter un plat"
        editTitle="Modifier le plat"
        onSave={handleSave}
        onCancel={() => crud.setShowForm(false)}
      >
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Nom *</label>
          <Input value={crud.form.name} onChange={e => crud.setForm({ ...crud.form, name: e.target.value })} placeholder="Nom du plat" className="dark:bg-gray-800 dark:border-gray-600" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Prix (GNF) *</label>
          <Input type="number" value={crud.form.price || ""} onChange={e => crud.setForm({ ...crud.form, price: parseInt(e.target.value) || 0 })} placeholder="35000" className="dark:bg-gray-800 dark:border-gray-600" />
        </div>
        <FormSelect label="Catégorie" value={crud.form.category} onChange={v => crud.setForm({ ...crud.form, category: v })} options={MENU_CATS.map(c => ({ value: c.id, label: c.name }))} required />
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Description</label>
          <Textarea value={crud.form.description} onChange={e => crud.setForm({ ...crud.form, description: e.target.value })} placeholder="Description du plat" rows={2} className="dark:bg-gray-800 dark:border-gray-600" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Image du plat</label>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input value={crud.form.image || ''} onChange={e => crud.setForm({ ...crud.form, image: e.target.value })} placeholder="URL de l'image ou télécharger" className="rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600" />
            </div>
            <label className="cursor-pointer px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-sm text-gray-600 dark:text-gray-400 transition-colors flex items-center gap-1.5 shrink-0">
              <Upload className="w-4 h-4" />
              <span>Télécharger</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadingImage(true);
                    const url = await handleImageUpload(file);
                    if (url) crud.setForm({ ...crud.form, image: url });
                    setUploadingImage(false);
                  }
                }}
              />
            </label>
          </div>
          {uploadingImage && <p className="text-xs text-orange-500 mt-1">Téléchargement en cours...</p>}
          {crud.form.image && (
            <div className="mt-2 w-24 h-24 rounded-lg overflow-hidden border dark:border-gray-600">
              <img src={crud.form.image} alt="Aperçu" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Badge</label>
          <Input value={crud.form.badge} onChange={e => crud.setForm({ ...crud.form, badge: e.target.value })} placeholder="Signature, Premium..." className="dark:bg-gray-800 dark:border-gray-600" />
        </div>
        <div className="flex items-center gap-6 pt-5">
          <div className="flex items-center gap-2"><Switch checked={crud.form.popular} onCheckedChange={v => crud.setForm({ ...crud.form, popular: v })} /><span className="text-sm text-gray-600 dark:text-gray-400">Populaire</span></div>
          <div className="flex items-center gap-2"><Switch checked={crud.form.available} onCheckedChange={v => crud.setForm({ ...crud.form, available: v })} /><span className="text-sm text-gray-600 dark:text-gray-400">Disponible</span></div>
        </div>
      </AdminFormCard>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredMenuItems.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState icon={UtensilsCrossed} message={menuItems.length === 0 ? "Aucun plat au menu. Cliquez sur Ajouter pour commencer." : "Aucun plat dans cette catégorie"} />
          </div>
        )}
        {paginatedItems.map((item) => (
          <Card key={item.id} className={`overflow-hidden ${!item.available ? "opacity-60" : ""} hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700`}>
            <div className="flex">
              <div className="w-24 h-24 shrink-0 bg-gray-100 dark:bg-gray-700">
                {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><UtensilsCrossed className="w-8 h-8 text-gray-300 dark:text-gray-500" /></div>}
              </div>
              <div className="flex-1 p-3 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {item.popular && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{item.description}</p>
                <p className="text-sm font-bold text-orange-600 dark:text-orange-400 mt-1">{formatPrice(item.price)}</p>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {readOnly ? (
                    <Badge className={`text-[10px] ${item.available ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                      {item.available ? "Disponible" : "Indisponible"}
                    </Badge>
                  ) : (
                    <button onClick={() => apiPatch("/api/menu", { id: item.id, available: !item.available })}
                      className={`text-xs px-2 py-0.5 rounded-full ${item.available ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                      {item.available ? "Disponible" : "Indisponible"}
                    </button>
                  )}
                  {item.badge && <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-[10px]">{item.badge}</Badge>}
                  <Badge variant="outline" className="text-[10px] dark:border-gray-600 dark:text-gray-400">{MENU_CATS.find(c => c.id === item.category)?.name || item.category}</Badge>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1 mt-2">
                    <EditButton onClick={() => crud.openEdit(item)} />
                    <DeleteConfirmButton
                      confirming={crud.deleteConfirm === item.id}
                      onConfirm={() => handleDelete(item)}
                      onRequestConfirm={() => crud.setDeleteConfirm(item.id)}
                      onCancel={() => crud.setDeleteConfirm(null)}
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="plats" />
    </div>
  );
}
