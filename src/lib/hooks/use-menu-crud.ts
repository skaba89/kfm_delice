"use client";
import { useState, useCallback } from "react";
import type { MenuItemDB } from "@/lib/types";

const DEFAULT_MENU_FORM = {
  name: "", description: "", price: 0, category: "entrees",
  image: "", badge: "", popular: false, available: true,
};

export function useMenuCrud(
  menuItems: MenuItemDB[],
  apiPatch: (url: string, body: object) => Promise<void>,
  apiPost: (url: string, body: object) => Promise<Response>,
) {
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemDB | null>(null);
  const [menuFilter, setMenuFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [menuForm, setMenuForm] = useState(DEFAULT_MENU_FORM);

  const openAddMenu = useCallback(() => {
    setEditingItem(null);
    setMenuForm(DEFAULT_MENU_FORM);
    setShowMenuForm(true);
  }, []);

  const openEditMenu = useCallback((item: MenuItemDB) => {
    setEditingItem(item);
    setMenuForm({
      name: item.name, description: item.description, price: item.price,
      category: item.category, image: item.image, badge: item.badge,
      popular: item.popular, available: item.available,
    });
    setShowMenuForm(true);
  }, []);

  const saveMenu = useCallback(async () => {
    if (editingItem) {
      await apiPatch("/api/menu", { id: editingItem.id, ...menuForm });
    } else {
      await apiPost("/api/menu", { ...menuForm, order: menuItems.length + 1 });
    }
    setShowMenuForm(false);
    setEditingItem(null);
  }, [editingItem, menuForm, menuItems.length, apiPatch, apiPost]);

  const filteredMenuItems = menuFilter === "all" ? menuItems : menuItems.filter(m => m.category === menuFilter);

  return {
    showMenuForm, setShowMenuForm, editingItem, menuFilter, setMenuFilter,
    deleteConfirm, setDeleteConfirm, menuForm, setMenuForm,
    openAddMenu, openEditMenu, saveMenu, filteredMenuItems,
  };
}
