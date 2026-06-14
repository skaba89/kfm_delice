"use client";
import { useState, useCallback } from "react";
import type { StaffDB } from "@/lib/types";

const DEFAULT_STAFF_FORM = { name: "", phone: "", role: "serveur", salary: 0, status: "active", hireDate: "", notes: "" };

export function useStaffCrud(
  apiPatch: (url: string, body: object) => Promise<{ success: boolean; error?: string }>,
  apiPost: (url: string, body: object) => Promise<{ success: boolean; error?: string }>,
) {
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffDB | null>(null);
  const [deleteStaffConfirm, setDeleteStaffConfirm] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState(DEFAULT_STAFF_FORM);

  const openAddStaff = useCallback(() => {
    setEditingStaff(null);
    setStaffForm({ ...DEFAULT_STAFF_FORM, hireDate: new Date().toISOString().split("T")[0] });
    setShowStaffForm(true);
  }, []);

  const openEditStaff = useCallback((s: StaffDB) => {
    setEditingStaff(s);
    setStaffForm({ name: s.name, phone: s.phone, role: s.role, salary: s.salary, status: s.status, hireDate: s.hireDate, notes: s.notes });
    setShowStaffForm(true);
  }, []);

  const saveStaff = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (editingStaff) {
      const result = await apiPatch("/api/staff", { id: editingStaff.id, ...staffForm });
      if (!result.success) return result;
    } else {
      const result = await apiPost("/api/staff", staffForm);
      if (!result.success) return result;
    }
    setShowStaffForm(false);
    setEditingStaff(null);
    return { success: true };
  }, [editingStaff, staffForm, apiPatch, apiPost]);

  return {
    showStaffForm, setShowStaffForm, editingStaff, deleteStaffConfirm, setDeleteStaffConfirm,
    staffForm, setStaffForm, openAddStaff, openEditStaff, saveStaff,
  };
}
