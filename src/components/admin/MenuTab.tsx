"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit3, Trash2, Save, Star, UtensilsCrossed, Upload } from "lucide-react";
import { useState } from "react";
import type { MenuItemDB } from "@/lib/types";
import { MENU_CATS, formatPrice } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";

export interface MenuTabProps {
  menuItems: MenuItemDB[];
  filteredMenuItems: MenuItemDB[];
  menuFilter: string;
  setMenuFilter: (v: string) => void;
  showMenuForm: boolean;
  editingItem: MenuItemDB | null;
  menuForm: { name: string; description: string; price: number; category: string; image: string; badge: string; popular: boolean; available: boolean };
  setMenuForm: (v: { name: string; description: string; price: number; category: string; image: string; badge: string; popular: boolean; available: boolean }) => void;
  openAddMenu: () => void;
  openEditMenu: (item: MenuItemDB) => void;
  saveMenu: () => Promise<void>;
  setShowMenuForm: (v: boolean) => void;
  apiPatch: (url: string, body: object) => Promise<void>;
  apiDelete: (url: string, body: object) => Promise<void>;
  deleteConfirm: string | null;
  setDeleteConfirm: (v: string | null) => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export function MenuTab({
  menuItems, filteredMenuItems, menuFilter, setMenuFilter,
  showMenuForm, editingItem, menuForm, setMenuForm,
  openAddMenu, openEditMenu, saveMenu, setShowMenuForm,
  apiPatch, apiDelete, deleteConfirm, setDeleteConfirm, apiFetch,
}: MenuTabProps) {
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

  const handleSaveMenu = async () => {
    await saveMenu();
    notify.menuItemSaved(menuForm.name, !!editingItem);
  };

  const handleDeleteMenu = async (item: MenuItemDB) => {
    await apiDelete("/api/menu", { id: item.id });
    setDeleteConfirm(null);
    notify.menuItemDeleted(item.name);
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
        <Button onClick={openAddMenu} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
      </div>

      {/* Menu Add/Edit Form */}
      <AnimatePresence>
        {showMenuForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-900/10">
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{editingItem ? "Modifier le plat" : "Ajouter un plat"}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Nom *</label><Input value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="Nom du plat" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Prix (GNF) *</label><Input type="number" value={menuForm.price || ""} onChange={e => setMenuForm({ ...menuForm, price: parseInt(e.target.value) || 0 })} placeholder="35000" className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Catégorie *</label>
                    <select value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm dark:text-gray-100">
                      {MENU_CATS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Description</label><Textarea value={menuForm.description} onChange={e => setMenuForm({ ...menuForm, description: e.target.value })} placeholder="Description du plat" rows={2} className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Image du plat</label>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Input value={menuForm.image || ''} onChange={e => setMenuForm({ ...menuForm, image: e.target.value })} placeholder="URL de l'image ou télécharger" className="rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600" />
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
                              if (url) setMenuForm({ ...menuForm, image: url });
                              setUploadingImage(false);
                            }
                          }}
                        />
                      </label>
                    </div>
                    {uploadingImage && <p className="text-xs text-orange-500 mt-1">Téléchargement en cours...</p>}
                    {menuForm.image && (
                      <div className="mt-2 w-24 h-24 rounded-lg overflow-hidden border dark:border-gray-600">
                        <img src={menuForm.image} alt="Aperçu" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Badge</label><Input value={menuForm.badge} onChange={e => setMenuForm({ ...menuForm, badge: e.target.value })} placeholder="Signature, Premium..." className="dark:bg-gray-800 dark:border-gray-600" /></div>
                  <div className="flex items-center gap-6 pt-5">
                    <div className="flex items-center gap-2"><Switch checked={menuForm.popular} onCheckedChange={v => setMenuForm({ ...menuForm, popular: v })} /><span className="text-sm text-gray-600 dark:text-gray-400">Populaire</span></div>
                    <div className="flex items-center gap-2"><Switch checked={menuForm.available} onCheckedChange={v => setMenuForm({ ...menuForm, available: v })} /><span className="text-sm text-gray-600 dark:text-gray-400">Disponible</span></div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleSaveMenu} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl"><Save className="w-4 h-4 mr-1" /> {editingItem ? "Enregistrer" : "Ajouter"}</Button>
                  <Button variant="outline" onClick={() => { setShowMenuForm(false); }} className="dark:border-gray-600">Annuler</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu Items Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                  <button onClick={() => apiPatch("/api/menu", { id: item.id, available: !item.available })}
                    className={`text-xs px-2 py-0.5 rounded-full ${item.available ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                    {item.available ? "Disponible" : "Indisponible"}
                  </button>
                  {item.badge && <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-[10px]">{item.badge}</Badge>}
                  <Badge variant="outline" className="text-[10px] dark:border-gray-600 dark:text-gray-400">{MENU_CATS.find(c => c.id === item.category)?.name || item.category}</Badge>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <button onClick={() => openEditMenu(item)} className="p-1 rounded-md bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-orange-900/30 dark:hover:text-orange-400" title="Modifier"><Edit3 className="w-3.5 h-3.5" /></button>
                  {deleteConfirm === item.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDeleteMenu(item)} className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Oui</button>
                      <button onClick={() => setDeleteConfirm(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">Non</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(item.id)} className="p-1 rounded-md bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="plats" />
    </div>
  );
}
