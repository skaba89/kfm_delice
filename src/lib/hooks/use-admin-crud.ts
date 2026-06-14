"use client";
import { useState, useCallback } from "react";
import type { AdminDB } from "@/lib/types";

const DEFAULT_ADMIN_FORM = { email: "", password: "", name: "", role: "staff", status: "active" };

export function useAdminCrud(
  apiPatch: (url: string, body: object) => Promise<{ success: boolean; error?: string }>,
  apiPost: (url: string, body: object) => Promise<{ success: boolean; error?: string }>,
) {
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminDB | null>(null);
  const [deleteAdminConfirm, setDeleteAdminConfirm] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState(DEFAULT_ADMIN_FORM);

  const openAddAdmin = useCallback(() => {
    setEditingAdmin(null);
    setAdminForm(DEFAULT_ADMIN_FORM);
    setShowAdminForm(true);
  }, []);

  const openEditAdmin = useCallback((a: AdminDB) => {
    setEditingAdmin(a);
    setAdminForm({ email: a.email, password: "", name: a.name, role: a.role, status: a.status });
    setShowAdminForm(true);
  }, []);

  const saveAdmin = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    const body: Record<string, string> = { ...adminForm };
    if (editingAdmin) {
      if (!body.password) delete body.password;
      const result = await apiPatch("/api/admins", { id: editingAdmin.id, ...body });
      if (!result.success) return result;
    } else {
      const result = await apiPost("/api/admins", body);
      if (!result.success) return result;
    }
    setShowAdminForm(false);
    setEditingAdmin(null);
    return { success: true };
  }, [editingAdmin, adminForm, apiPatch, apiPost]);

  return {
    showAdminForm, setShowAdminForm, editingAdmin, deleteAdminConfirm, setDeleteAdminConfirm,
    adminForm, setAdminForm, openAddAdmin, openEditAdmin, saveAdmin,
  };
}
