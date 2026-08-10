import { describe, expect, it } from "vitest";
import { normalizePublicOrderBody } from "@/lib/public-api";

describe("normalizePublicOrderBody", () => {
  it("converts legacy menu items to the strict server-authoritative contract", () => {
    const normalized = normalizePublicOrderBody({
      slug: "kfm-delice",
      items: [
        { id: "menu-1", name: "Poulet", price: 25000, qty: 2 },
        { menuItemId: "menu-2", quantity: 1, note: "sans piment" },
      ],
      total: 55000,
      deliveryFee: 5000,
      discount: 1000,
      tax: 0,
      status: "delivered",
      paymentStatus: "paid",
      orderType: "delivery",
      paymentMethod: "cash",
      deliveryAddress: "Kaloum",
      customerName: "Client Test",
      phone: "620000000",
    });

    expect(normalized).toEqual({
      items: [
        { menuItemId: "menu-1", quantity: 2 },
        { menuItemId: "menu-2", quantity: 1, note: "sans piment" },
      ],
      orderType: "delivery",
      customerName: "Client Test",
      phone: "620000000",
      deliveryAddress: "Kaloum",
      paymentMethod: "cash",
    });

    expect(normalized).not.toHaveProperty("slug");
    expect(normalized).not.toHaveProperty("total");
    expect(normalized).not.toHaveProperty("deliveryFee");
    expect(normalized).not.toHaveProperty("discount");
    expect(normalized).not.toHaveProperty("tax");
    expect(normalized).not.toHaveProperty("status");
    expect(normalized).not.toHaveProperty("paymentStatus");
  });

  it("supports historical JSON-string item payloads used by E2E scripts", () => {
    const normalized = normalizePublicOrderBody({
      items: JSON.stringify([{ id: "menu-qr", qty: 1, price: 5000 }]),
      orderType: "dine_in",
      paymentMethod: "cash",
      tableQrToken: "qr-token",
    });

    expect(normalized.items).toEqual([{ menuItemId: "menu-qr", quantity: 1 }]);
    expect(normalized.tableQrToken).toBe("qr-token");
  });

  it("preserves a manual table number as a non-authoritative kitchen note", () => {
    const normalized = normalizePublicOrderBody({
      items: [{ id: "menu-1", qty: 1 }],
      orderType: "dine_in",
      paymentMethod: "cash",
      tableNumber: 12,
      note: "Anniversaire",
    });

    expect(normalized.note).toBe("Table 12 — Anniversaire");
    expect(normalized).not.toHaveProperty("tableNumber");
  });
});
