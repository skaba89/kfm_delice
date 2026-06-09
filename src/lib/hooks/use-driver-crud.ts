"use client";
import { useState, useCallback } from "react";
import type { DriverDB } from "@/lib/types";

const DEFAULT_DRIVER_FORM: { name: string; phone: string; vehicle: string; zone: string } = { name: "", phone: "", vehicle: "moto", zone: "Conakry" };

export function useDriverCrud(
  apiPatch: (url: string, body: object) => Promise<void>,
  apiPost: (url: string, body: object) => Promise<Response>,
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
    setDriverForm({ name: d.name, phone: d.phone, vehicle: d.vehicle, zone: d.zone });
    setShowDriverForm(true);
  }, []);

  const saveDriver = useCallback(async () => {
    if (editingDriver) {
      await apiPatch("/api/drivers", { id: editingDriver.id, ...driverForm });
    } else {
      await apiPost("/api/drivers", { ...driverForm, status: "available", rating: 5.0, totalDeliveries: 0 });
    }
    setShowDriverForm(false);
    setEditingDriver(null);
  }, [editingDriver, driverForm, apiPatch, apiPost]);

  return {
    showDriverForm, setShowDriverForm, editingDriver, deleteDriverConfirm, setDeleteDriverConfirm,
    driverForm, setDriverForm, openAddDriver, openEditDriver, saveDriver,
  };
}
