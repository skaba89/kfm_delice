import { describe, it, expect } from "vitest";
import { formatPrice, MENU_CATS, isRestaurantOpen, RESTO_HOURS, statusColors, statusLabels, paymentLabels, vehicleLabels, driverStatusLabels, staffRoleLabels, adminRoleLabels, adminRoleOrder, invoiceStatusLabels, quoteStatusLabels, expenseCategoryLabels } from "@/lib/constants";

describe("formatPrice", () => {
  it("should format price in GNF with French locale", () => {
    expect(formatPrice(1000)).toBe("1\u202f000 GNF");
  });

  it("should format zero", () => {
    expect(formatPrice(0)).toBe("0 GNF");
  });

  it("should format large numbers", () => {
    const result = formatPrice(1000000);
    expect(result).toContain("GNF");
    expect(result).toContain("1");
  });

  it("should format decimal numbers", () => {
    const result = formatPrice(1500);
    expect(result).toContain("GNF");
  });
});

describe("MENU_CATS", () => {
  it("should have 5 categories", () => {
    expect(MENU_CATS).toHaveLength(5);
  });

  it("should have correct category IDs", () => {
    const ids = MENU_CATS.map(c => c.id);
    expect(ids).toContain("entrees");
    expect(ids).toContain("plats");
    expect(ids).toContain("mer");
    expect(ids).toContain("desserts");
    expect(ids).toContain("boissons");
  });

  it("should have name and icon for each category", () => {
    MENU_CATS.forEach(cat => {
      expect(cat.id).toBeTruthy();
      expect(cat.name).toBeTruthy();
      expect(cat.icon).toBeDefined();
    });
  });
});

describe("isRestaurantOpen", () => {
  it("should return boolean", () => {
    const result = isRestaurantOpen();
    expect(typeof result).toBe("boolean");
  });
});

describe("RESTO_HOURS", () => {
  it("should have open and close hours", () => {
    expect(RESTO_HOURS.open).toBe(11);
    expect(RESTO_HOURS.close).toBe(23);
  });
});

describe("Status labels and colors", () => {
  it("should have status labels for all common statuses", () => {
    expect(statusLabels.pending).toBe("En attente");
    expect(statusLabels.confirmed).toBe("Confirmée");
    expect(statusLabels.cancelled).toBe("Annulée");
    expect(statusLabels.completed).toBe("Terminée");
    expect(statusLabels.preparing).toBe("En préparation");
    expect(statusLabels.ready).toBe("Prêt");
    expect(statusLabels.delivered).toBe("Livré");
  });

  it("should have status colors for all common statuses", () => {
    expect(statusColors.pending).toBeTruthy();
    expect(statusColors.confirmed).toBeTruthy();
    expect(statusColors.cancelled).toBeTruthy();
    expect(statusColors.preparing).toBeTruthy();
    expect(statusColors.delivered).toBeTruthy();
  });

  it("should have payment method labels", () => {
    expect(paymentLabels.cash).toBe("Espèces");
    expect(paymentLabels.orange_money).toBe("Orange Money");
    expect(paymentLabels.mtn_money).toBe("MTN Money");
    expect(paymentLabels.card).toBe("Carte");
  });

  it("should have vehicle labels", () => {
    expect(vehicleLabels.moto).toBe("Moto");
    expect(vehicleLabels.velo).toBe("Vélo");
    expect(vehicleLabels.voiture).toBe("Voiture");
  });

  it("should have driver status labels", () => {
    expect(driverStatusLabels.available).toBe("Disponible");
    expect(driverStatusLabels.busy).toBe("En livraison");
    expect(driverStatusLabels.offline).toBe("Hors ligne");
  });

  it("should have staff role labels", () => {
    expect(staffRoleLabels.cuisinier).toBe("Cuisinier");
    expect(staffRoleLabels.serveur).toBe("Serveur");
    expect(staffRoleLabels.barman).toBe("Barman");
    expect(staffRoleLabels.gerant).toBe("Gérant");
  });

  it("should expose all 15 staff roles with labels", () => {
    const expectedStaffRoles = [
      "cuisinier", "commis", "patissier",
      "serveur", "barman", "sommelier", "receptionniste",
      "gerant", "caissier",
      "plongeur", "securite", "voiturier", "maintenance",
      "dj", "animateur",
    ];
    for (const role of expectedStaffRoles) {
      expect(staffRoleLabels[role]).toBeTruthy();
      expect(typeof staffRoleLabels[role]).toBe("string");
    }
    // Compare as SETS — order does not matter
    expect(Object.keys(staffRoleLabels).sort()).toEqual([...expectedStaffRoles].sort());
  });

  it("should expose all 8 admin login roles with labels", () => {
    const expectedAdminRoles = [
      "admin", "manager", "staff", "cashier",
      "kitchen", "delivery_manager", "host", "accountant",
    ];
    for (const role of expectedAdminRoles) {
      expect(adminRoleLabels[role]).toBeTruthy();
      expect(typeof adminRoleLabels[role]).toBe("string");
    }
    // Compare as SETS — order does not matter for the labels map
    expect(Object.keys(adminRoleLabels).sort()).toEqual([...expectedAdminRoles].sort());
    // adminRoleOrder is the ordered canonical list — compare directly (no sort)
    expect(adminRoleOrder).toEqual(expectedAdminRoles);
  });

  it("should have invoice status labels", () => {
    expect(invoiceStatusLabels.pending).toBe("En attente");
    expect(invoiceStatusLabels.paid).toBe("Payée");
    expect(invoiceStatusLabels.cancelled).toBe("Annulée");
    expect(invoiceStatusLabels.overdue).toBe("En retard");
  });

  it("should have quote status labels", () => {
    expect(quoteStatusLabels.draft).toBe("Brouillon");
    expect(quoteStatusLabels.sent).toBe("Envoyé");
    expect(quoteStatusLabels.accepted).toBe("Accepté");
    expect(quoteStatusLabels.refused).toBe("Refusé");
  });

  it("should have expense category labels", () => {
    expect(expenseCategoryLabels.ingredients).toBe("Ingrédients");
    expect(expenseCategoryLabels.salary).toBe("Salaires");
    expect(expenseCategoryLabels.rent).toBe("Loyer");
  });
});
