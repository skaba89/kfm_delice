import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCrudState } from "@/lib/hooks/use-crud-state";
import type { DriverDB } from "@/lib/types";

// ─── Test fixtures ───────────────────────────────────────────────
const mockDriver: DriverDB = {
  id: "driver-1",
  email: "driver@test.com",
  name: "Amadou Diallo",
  phone: "+224 622 11 22 33",
  vehicle: "moto",
  status: "available",
  rating: 4.5,
  totalDeliveries: 42,
  zone: "Conakry",
  lat: 9.5,
  lng: -13.7,
  currentOrderId: "",
  lastLocationUpdate: "",
  createdAt: "2026-01-01",
};

const driverConfig = {
  apiEndpoint: "/api/drivers",
  defaultForm: { name: "", phone: "", vehicle: "moto", zone: "Conakry" } as { name: string; phone: string; vehicle: string; zone: string },
  mapEntityToForm: (d: DriverDB) => ({ name: d.name, phone: d.phone, vehicle: d.vehicle, zone: d.zone }),
  prepareCreate: (form: { name: string; phone: string; vehicle: string; zone: string }) => ({
    ...form,
    status: "available",
    rating: 5.0,
    totalDeliveries: 0,
  }),
};

const adminConfig = {
  apiEndpoint: "/api/admins",
  defaultForm: { email: "", password: "", name: "", role: "staff", status: "active" },
  mapEntityToForm: (a: { email: string; name: string; role: string; status: string }) => ({
    email: a.email,
    password: "",
    name: a.name,
    role: a.role,
    status: a.status || "active",
  }),
  prepareUpdate: (form: { email: string; password: string; name: string; role: string; status: string }) => {
    const body: Record<string, string> = { ...form };
    if (!body.password) delete body.password;
    return body;
  },
};

const invoiceConfig = {
  apiEndpoint: "/api/invoices",
  defaultForm: { number: "FAC-2026-001", customerName: "", customerPhone: "", items: "[]", subtotal: 0, tax: 0, total: 0, status: "pending", dueDate: "", notes: "" },
  mapEntityToForm: (inv: { number: string; customerName: string; customerPhone: string; items: string; subtotal: number; tax: number; total: number; status: string; dueDate: string; notes: string }) => ({
    number: inv.number,
    customerName: inv.customerName,
    customerPhone: inv.customerPhone,
    items: inv.items,
    subtotal: inv.subtotal,
    tax: inv.tax,
    total: inv.total,
    status: inv.status,
    dueDate: inv.dueDate,
    notes: inv.notes,
  }),
  getAddForm: (context?: Record<string, unknown>) => {
    const count = (context?.count as number) || 0;
    return {
      number: `FAC-2026-${String(count + 1).padStart(3, "0")}`,
      customerName: "",
      customerPhone: "",
      items: "[]",
      subtotal: 0,
      tax: 0,
      total: 0,
      status: "pending",
      dueDate: new Date().toISOString().split("T")[0],
      notes: "",
    };
  },
};

describe("useCrudState", () => {
  const mockApiPatch = vi.fn().mockResolvedValue(undefined);
  const mockApiPost = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

  beforeEach(() => {
    mockApiPatch.mockClear();
    mockApiPost.mockClear();
  });

  // ─── Initial state ────────────────────────────────────────────
  it("should initialize with default state", () => {
    const { result } = renderHook(() => useCrudState(driverConfig, mockApiPatch, mockApiPost));

    expect(result.current.showForm).toBe(false);
    expect(result.current.editing).toBe(null);
    expect(result.current.deleteConfirm).toBe(null);
    expect(result.current.form).toEqual(driverConfig.defaultForm);
  });

  // ─── openAdd ──────────────────────────────────────────────────
  it("should open add form with default values", () => {
    const { result } = renderHook(() => useCrudState(driverConfig, mockApiPatch, mockApiPost));

    act(() => {
      result.current.openAdd();
    });

    expect(result.current.showForm).toBe(true);
    expect(result.current.editing).toBe(null);
    expect(result.current.form).toEqual(driverConfig.defaultForm);
  });

  it("should use getAddForm when provided", () => {
    const { result } = renderHook(() => useCrudState(invoiceConfig, mockApiPatch, mockApiPost));

    act(() => {
      result.current.openAdd({ count: 5 });
    });

    expect(result.current.showForm).toBe(true);
    expect(result.current.form.number).toBe("FAC-2026-006");
  });

  it("should reset editing when opening add form", () => {
    const { result } = renderHook(() => useCrudState(driverConfig, mockApiPatch, mockApiPost));

    // First open edit
    act(() => {
      result.current.openEdit(mockDriver);
    });
    expect(result.current.editing).toBe(mockDriver);

    // Then open add
    act(() => {
      result.current.openAdd();
    });
    expect(result.current.editing).toBe(null);
    expect(result.current.form).toEqual(driverConfig.defaultForm);
  });

  // ─── openEdit ─────────────────────────────────────────────────
  it("should open edit form with entity values", () => {
    const { result } = renderHook(() => useCrudState(driverConfig, mockApiPatch, mockApiPost));

    act(() => {
      result.current.openEdit(mockDriver);
    });

    expect(result.current.showForm).toBe(true);
    expect(result.current.editing).toBe(mockDriver);
    expect(result.current.form).toEqual({
      name: "Amadou Diallo",
      phone: "+224 622 11 22 33",
      vehicle: "moto",
      zone: "Conakry",
    });
  });

  // ─── save (create) ────────────────────────────────────────────
  it("should call apiPost when creating new entity", async () => {
    const { result } = renderHook(() => useCrudState(driverConfig, mockApiPatch, mockApiPost));

    act(() => {
      result.current.openAdd();
    });

    act(() => {
      result.current.setForm({ name: "New Driver", phone: "+224 600", vehicle: "velo", zone: "Kamsar" });
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockApiPost).toHaveBeenCalledWith("/api/drivers", {
      name: "New Driver",
      phone: "+224 600",
      vehicle: "velo",
      zone: "Kamsar",
      status: "available",
      rating: 5.0,
      totalDeliveries: 0,
    });
    expect(result.current.showForm).toBe(false);
    expect(result.current.editing).toBe(null);
  });

  // ─── save (update) ────────────────────────────────────────────
  it("should call apiPatch when updating existing entity", async () => {
    const { result } = renderHook(() => useCrudState(driverConfig, mockApiPatch, mockApiPost));

    act(() => {
      result.current.openEdit(mockDriver);
    });

    act(() => {
      result.current.setForm({ ...result.current.form, name: "Updated Name" });
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockApiPatch).toHaveBeenCalledWith("/api/drivers", {
      id: "driver-1",
      name: "Updated Name",
      phone: "+224 622 11 22 33",
      vehicle: "moto",
      zone: "Conakry",
    });
    expect(result.current.showForm).toBe(false);
  });

  // ─── prepareUpdate ────────────────────────────────────────────
  it("should use prepareUpdate to transform update body", async () => {
    const { result } = renderHook(() => useCrudState(
      adminConfig as any,
      mockApiPatch,
      mockApiPost,
    ));

    act(() => {
      result.current.openEdit({ email: "a@b.com", name: "Admin", role: "admin", status: "active", id: "admin-1", createdAt: "" });
    });

    // Password is empty, should be stripped
    await act(async () => {
      await result.current.save();
    });

    const patchCall = mockApiPatch.mock.calls[0];
    const body = patchCall[1] as Record<string, string>;
    expect(body).not.toHaveProperty("password");
    expect(body).toHaveProperty("email", "a@b.com");
  });

  // ─── setShowForm ──────────────────────────────────────────────
  it("should close form when setShowForm(false)", () => {
    const { result } = renderHook(() => useCrudState(driverConfig, mockApiPatch, mockApiPost));

    act(() => {
      result.current.openAdd();
    });
    expect(result.current.showForm).toBe(true);

    act(() => {
      result.current.setShowForm(false);
    });
    expect(result.current.showForm).toBe(false);
  });

  // ─── deleteConfirm ────────────────────────────────────────────
  it("should track delete confirmation ID", () => {
    const { result } = renderHook(() => useCrudState(driverConfig, mockApiPatch, mockApiPost));

    act(() => {
      result.current.setDeleteConfirm("driver-1");
    });
    expect(result.current.deleteConfirm).toBe("driver-1");

    act(() => {
      result.current.setDeleteConfirm(null);
    });
    expect(result.current.deleteConfirm).toBe(null);
  });

  // ─── setForm ──────────────────────────────────────────────────
  it("should update form state", () => {
    const { result } = renderHook(() => useCrudState(driverConfig, mockApiPatch, mockApiPost));

    act(() => {
      result.current.setForm({ name: "Test", phone: "123", vehicle: "voiture", zone: "Kamsar" });
    });
    expect(result.current.form.name).toBe("Test");
    expect(result.current.form.vehicle).toBe("voiture");
  });
});
