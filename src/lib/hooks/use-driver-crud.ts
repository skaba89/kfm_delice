"use client";
import { useState, useCallback } from "react";
import type { DriverDB } from "@/lib/types";

const DEFAULT_DRIVER_FORM: { email: string; name: string; phone: string; vehicle: string; zone: string } = { email: "", name: "", phone: "", vehicle: "moto", zone: "Conakry" };

export function useDriverCrud(
  apiPatch: (url: string, body: object) => Promise<{ success: boolean; error?: string }>,
  apiPost: (url: string, body: object) => Promise<{ success: boolean; error?: string }>,
) {
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverDB | null>(null);
  const [deleteDriverConfirm, setDeleteDriverConfirm] = useState<string | null>(null);
  const [driverForm, setDriverForm] = useState(DEFAULT_DRIVER_FORM);

  const openAddDriver = useCallback(() => {
    setEditingDriver(null);
    setDriverForm(DEFAULT_DRIVER_FORM);
    setShowDriverForm(true);
  }, []);

  const openEditDriver = useCallback((d: DriverDB) => {
    setEditingDriver(d);
    setDriverForm({ email: d.email || "", name: d.name, phone: d.phone, vehicle: d.vehicle, zone: d.zone });
    setShowDriverForm(true);
  }, []);

  const saveDriver = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (editingDriver) {
      const result = await apiPatch("/api/drivers", { id: editingDriver.id, ...driverForm });
      if (!result.success) return result;
    } else {
      // Generate unique email if not provided to avoid unique constraint violation
      const driverEmail = driverForm.email || `driver-${Date.now()}@kfm-delice.com`;
      const result = await apiPost("/api/drivers", { ...driverForm, email: driverEmail, status: "available", rating: 5.0, totalDeliveries: 0 });
      if (!result.success) return result;
    }
    setShowDriverForm(false);
    setEditingDriver(null);
    return { success: true };
  }, [editingDriver, driverForm, apiPatch, apiPost]);

  return {
    showDriverForm, setShowDriverForm, editingDriver, deleteDriverConfirm, setDeleteDriverConfirm,
    driverForm, setDriverForm, openAddDriver, openEditDriver, saveDriver,
  };
}
