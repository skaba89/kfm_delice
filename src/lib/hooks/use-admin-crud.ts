"use client";
import { useState, useCallback } from "react";
import type { AdminDB } from "@/lib/types";

const DEFAULT_ADMIN_FORM = { email: "", password: "", name: "", role: "staff", status: "active" };

export function useAdminCrud(
  apiPatch: (url: string, body: object) => Promise<void>,
  apiPost: (url: string, body: object) => Promise<Response>,
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
    setAdminForm({ email: a.email, password: "", name: a.name, role: a.role, status: a.status || "active" });
    setShowAdminForm(true);
  }, []);

  const saveAdmin = useCallback(async () => {
    const body: Record<string, string> = { ...adminForm };
    if (editingAdmin) {
      if (!body.password) delete body.password;
      await apiPatch("/api/admins", { id: editingAdmin.id, ...body });
    } else {
      await apiPost("/api/admins", body);
    }
    setShowAdminForm(false);
    setEditingAdmin(null);
  }, [editingAdmin, adminForm, apiPatch, apiPost]);

  return {
    showAdminForm, setShowAdminForm, editingAdmin, deleteAdminConfirm, setDeleteAdminConfirm,
    adminForm, setAdminForm, openAddAdmin, openEditAdmin, saveAdmin,
  };
}
