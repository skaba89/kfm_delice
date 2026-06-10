"use client";

import { useState, useCallback } from "react";

/**
 * Configuration for a generic CRUD state hook.
 * Replaces the 7+ nearly-identical per-entity hooks (useDriverCrud,
 * useStaffCrud, useExpenseCrud, useCustomerCrud, useAdminCrud,
 * useInvoiceCrud, useQuoteCrud, useMenuCrud).
 *
 * @template TEntity - The DB entity type (e.g. DriverDB, StaffDB)
 * @template TForm  - The form state type (e.g. { name: string; phone: string; ... })
 */
export interface CrudConfig<TEntity, TForm> {
  /** The API endpoint (e.g. "/api/drivers") */
  apiEndpoint: string;

  /** Default form values when adding a new entity */
  defaultForm: TForm;

  /** Map a DB entity to form values for editing */
  mapEntityToForm: (entity: TEntity) => TForm;

  /**
   * Transform form data before creating (POST).
   * Use this to add computed fields like { status: "available" } on creation.
   * Defaults to the form as-is.
   */
  prepareCreate?: (form: TForm) => Record<string, unknown>;

  /**
   * Transform form data before updating (PATCH).
   * Use this to strip empty fields (e.g. password if blank).
   * Defaults to the form as-is.
   */
  prepareUpdate?: (form: TForm, entity: TEntity) => Record<string, unknown>;

  /**
   * Override default form when opening the Add form.
   * Use this for dynamic defaults (e.g. invoice number based on count).
   * Receives an optional context object (e.g. { count: number }).
   */
  getAddForm?: (context?: Record<string, unknown>) => TForm;
}

export interface CrudStateReturn<TEntity, TForm> {
  /** Whether the form is visible */
  showForm: boolean;
  /** Set form visibility */
  setShowForm: (v: boolean) => void;
  /** The entity being edited, or null if adding */
  editing: TEntity | null;
  /** Current form values */
  form: TForm;
  /** Update form values */
  setForm: (v: TForm) => void;
  /** ID of the entity pending delete confirmation */
  deleteConfirm: string | null;
  /** Set the ID pending delete confirmation */
  setDeleteConfirm: (v: string | null) => void;
  /** Open the Add form (resets form to defaults) */
  openAdd: (context?: Record<string, unknown>) => void;
  /** Open the Edit form for a specific entity */
  openEdit: (entity: TEntity) => void;
  /** Save the current form (calls POST or PATCH) */
  save: () => Promise<void>;
}

/**
 * Generic CRUD state management hook.
 *
 * Replaces all per-entity hooks with a single configurable hook.
 *
 * @example
 * ```ts
 * const driverCrud = useCrudState({
 *   apiEndpoint: "/api/drivers",
 *   defaultForm: { name: "", phone: "", vehicle: "moto", zone: "Conakry" },
 *   mapEntityToForm: (d) => ({ name: d.name, phone: d.phone, vehicle: d.vehicle, zone: d.zone }),
 *   prepareCreate: (form) => ({ ...form, status: "available", rating: 5.0, totalDeliveries: 0 }),
 * }, apiPatch, apiPost);
 * ```
 */
export function useCrudState<TEntity, TForm>(
  config: CrudConfig<TEntity, TForm>,
  apiPatch: (url: string, body: object) => Promise<void>,
  apiPost: (url: string, body: object) => Promise<Response>,
): CrudStateReturn<TEntity, TForm> {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TEntity | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState<TForm>(config.defaultForm);

  const openAdd = useCallback((context?: Record<string, unknown>) => {
    setEditing(null);
    setForm(config.getAddForm ? config.getAddForm(context) : config.defaultForm);
    setShowForm(true);
  }, [config]);

  const openEdit = useCallback((entity: TEntity) => {
    setEditing(entity);
    setForm(config.mapEntityToForm(entity));
    setShowForm(true);
  }, [config]);

  const save = useCallback(async () => {
    if (editing) {
      const body = config.prepareUpdate
        ? config.prepareUpdate(form, editing)
        : (form as Record<string, unknown>);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await apiPatch(config.apiEndpoint, { id: (editing as any).id, ...body });
    } else {
      const body = config.prepareCreate
        ? config.prepareCreate(form)
        : (form as Record<string, unknown>);
      await apiPost(config.apiEndpoint, body);
    }
    setShowForm(false);
    setEditing(null);
  }, [editing, form, config, apiPatch, apiPost]);

  return {
    showForm,
    setShowForm,
    editing,
    form,
    setForm,
    deleteConfirm,
    setDeleteConfirm,
    openAdd,
    openEdit,
    save,
  };
}
