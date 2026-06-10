import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock sonner before importing
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
  },
}));

import { toast } from "sonner";
import { notify } from "@/lib/notifications";

describe("notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call toast.success for success notifications", () => {
    notify.success("Opération réussie");
    expect(toast.success).toHaveBeenCalledWith("Opération réussie");
  });

  it("should call toast.error for error notifications", () => {
    notify.error("Erreur");
    expect(toast.error).toHaveBeenCalledWith("Erreur");
  });

  it("should call toast.info for info notifications", () => {
    notify.info("Information");
    expect(toast.info).toHaveBeenCalledWith("Information");
  });

  it("should call toast.warning for warning notifications", () => {
    notify.warning("Attention");
    expect(toast.warning).toHaveBeenCalledWith("Attention");
  });

  // ─── Domain-specific notifications ────────────────────────────
  it("should notify new order", () => {
    notify.newOrder("Amadou");
    expect(toast.info).toHaveBeenCalledWith("Nouvelle commande de Amadou");
  });

  it("should notify new reservation", () => {
    notify.newReservation("Fatoumata");
    expect(toast.info).toHaveBeenCalledWith("Nouvelle réservation de Fatoumata");
  });

  it("should notify order status changed", () => {
    notify.orderStatusChanged("En préparation");
    expect(toast.success).toHaveBeenCalledWith("Commande mise à jour : En préparation");
  });

  it("should notify menu item saved (add)", () => {
    notify.menuItemSaved("Thieboudienne", false);
    expect(toast.success).toHaveBeenCalledWith("Thieboudienne ajouté au menu");
  });

  it("should notify menu item saved (edit)", () => {
    notify.menuItemSaved("Thieboudienne", true);
    expect(toast.success).toHaveBeenCalledWith("Thieboudienne modifié");
  });

  it("should notify menu item deleted", () => {
    notify.menuItemDeleted("Thieboudienne");
    expect(toast.warning).toHaveBeenCalledWith("Thieboudienne supprimé du menu");
  });

  it("should notify driver saved (add)", () => {
    notify.driverSaved("Amadou", false);
    expect(toast.success).toHaveBeenCalledWith("Livreur Amadou ajouté");
  });

  it("should notify driver saved (edit)", () => {
    notify.driverSaved("Amadou", true);
    expect(toast.success).toHaveBeenCalledWith("Livreur Amadou modifié");
  });

  it("should notify driver deleted", () => {
    notify.driverDeleted("Amadou");
    expect(toast.warning).toHaveBeenCalledWith("Livreur Amadou supprimé");
  });

  it("should notify staff saved", () => {
    notify.staffSaved("Mariama", false);
    expect(toast.success).toHaveBeenCalledWith("Mariama ajouté au personnel");
  });

  it("should notify admin saved (edit)", () => {
    notify.adminSaved("Ibrahim", true);
    expect(toast.success).toHaveBeenCalledWith("Utilisateur Ibrahim modifié");
  });

  it("should notify admin deleted", () => {
    notify.adminDeleted("Ibrahim");
    expect(toast.warning).toHaveBeenCalledWith("Utilisateur Ibrahim supprimé");
  });

  it("should notify invoice saved", () => {
    notify.invoiceSaved("FAC-2026-001");
    expect(toast.success).toHaveBeenCalledWith("Facture FAC-2026-001 enregistrée");
  });

  it("should notify invoice deleted", () => {
    notify.invoiceDeleted("FAC-2026-001");
    expect(toast.warning).toHaveBeenCalledWith("Facture FAC-2026-001 supprimée");
  });

  it("should notify quote saved", () => {
    notify.quoteSaved("DEV-2026-001");
    expect(toast.success).toHaveBeenCalledWith("Devis DEV-2026-001 enregistré");
  });

  it("should notify quote deleted", () => {
    notify.quoteDeleted("DEV-2026-001");
    expect(toast.warning).toHaveBeenCalledWith("Devis DEV-2026-001 supprimé");
  });

  it("should notify expense saved", () => {
    notify.expenseSaved("Ingrédients");
    expect(toast.success).toHaveBeenCalledWith('Dépense "Ingrédients" enregistrée');
  });

  it("should notify expense deleted", () => {
    notify.expenseDeleted("Ingrédients");
    expect(toast.warning).toHaveBeenCalledWith('Dépense "Ingrédients" supprimée');
  });

  it("should notify customer saved (add)", () => {
    notify.customerSaved("Fatoumata", false);
    expect(toast.success).toHaveBeenCalledWith("Client Fatoumata ajouté");
  });

  it("should notify customer deleted", () => {
    notify.customerDeleted("Fatoumata");
    expect(toast.warning).toHaveBeenCalledWith("Client Fatoumata supprimé");
  });

  it("should notify profile updated", () => {
    notify.profileUpdated();
    expect(toast.success).toHaveBeenCalledWith("Profil mis à jour avec succès");
  });

  it("should notify password changed", () => {
    notify.passwordChanged();
    expect(toast.success).toHaveBeenCalledWith("Mot de passe modifié");
  });

  it("should notify login success", () => {
    notify.loginSuccess("Admin");
    expect(toast.success).toHaveBeenCalledWith("Bienvenue, Admin !");
  });

  it("should notify reservation confirmed", () => {
    notify.reservationConfirmed("Fatoumata");
    expect(toast.success).toHaveBeenCalledWith("Réservation confirmée pour Fatoumata");
  });

  it("should notify reservation cancelled", () => {
    notify.reservationCancelled("Fatoumata");
    expect(toast.warning).toHaveBeenCalledWith("Réservation annulée pour Fatoumata");
  });

  it("should notify delivery assigned", () => {
    notify.deliveryAssigned("Amadou");
    expect(toast.success).toHaveBeenCalledWith("Livraison assignée à Amadou");
  });
});
