import { Leaf, Flame, Fish, CakeSlice, CupSoda } from "lucide-react";

export const RESTO_HOURS = {
  open: 11, // 11h00
  close: 23, // 23h00
  timezone: 'Africa/Conakry',
};

export function isRestaurantOpen(): boolean {
  const now = new Date();
  // Convert to Conakry time (GMT)
  const conakryHour = now.getUTCHours();
  return conakryHour >= RESTO_HOURS.open && conakryHour < RESTO_HOURS.close;
}

export const RESTO = {
  name: "KFM Delice", tagline: "L'Art du Goût Guinéen",
  description: "Restaurant gastronomique au cœur de Conakry, KFM Delice vous propose une cuisine guinéenne revisitée avec une touche contemporaine. Produits frais, saveurs authentiques et service impeccable.",
  phone: "+224 622 34 56 78", whatsapp: "+224 622 34 56 78",
  email: "reservation@kfm-delice.com",
  address: "Almamya, Corniche Nord, Conakry, Guinée",
  hours: "Lun-Dim : 11h00 - 23h00", heroImage: "/images/kfm-hero.png",
  rating: 4.9, reviewCount: 327,
};

export const MENU_CATS = [
  { id: "entrees", name: "Entrées", icon: Leaf },
  { id: "plats", name: "Plats Principaux", icon: Flame },
  { id: "mer", name: "Fruits de Mer", icon: Fish },
  { id: "desserts", name: "Desserts", icon: CakeSlice },
  { id: "boissons", name: "Boissons", icon: CupSoda },
];

export function formatPrice(p: number) { return p.toLocaleString("fr-FR") + " GNF"; }

export const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700", confirmed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700", completed: "bg-blue-100 text-blue-700",
  preparing: "bg-orange-100 text-orange-700", ready: "bg-cyan-100 text-cyan-700",
  picking_up: "bg-indigo-100 text-indigo-700", delivering: "bg-purple-100 text-purple-700", delivered: "bg-green-100 text-green-700",
};
export const statusLabels: Record<string, string> = {
  pending: "En attente", confirmed: "Confirmée", cancelled: "Annulée", completed: "Terminée",
  preparing: "En préparation", ready: "Prêt", picking_up: "En route vers le restaurant", delivering: "En livraison", delivered: "Livré",
};
export const paymentLabels: Record<string, string> = {
  cash: "Espèces", orange_money: "Orange Money", mtn_money: "MTN Money", card: "Carte",
};
export const paymentStatusLabels: Record<string, string> = {
  pending: "En attente", processing: "En cours", paid: "Payé", failed: "Échoué", refunded: "Remboursé",
};
export const paymentStatusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700", processing: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700", failed: "bg-red-100 text-red-700", refunded: "bg-purple-100 text-purple-700",
};
export const zoneLabels: Record<string, string> = {
  interieur: "Intérieur", terrasse: "Terrasse", vip: "VIP",
};
export const orderTypeLabels: Record<string, string> = { dine_in: "Sur place", takeaway: "À emporter", delivery: "Livraison" };
export const vehicleLabels: Record<string, string> = { moto: "Moto", velo: "Vélo", voiture: "Voiture" };
export const driverStatusColors: Record<string, string> = {
  available: "bg-green-100 text-green-700", busy: "bg-orange-100 text-orange-700", offline: "bg-gray-100 text-gray-700",
};
export const driverStatusLabels: Record<string, string> = { available: "Disponible", busy: "En livraison", offline: "Hors ligne" };
export const staffRoleLabels: Record<string, string> = { cuisinier: "Cuisinier", serveur: "Serveur", barman: "Barman", gerant: "Gérant", plongeur: "Plongeur", securite: "Sécurité", caissier: "Caissier" };
export const staffStatusColors: Record<string, string> = { active: "bg-green-100 text-green-700", inactive: "bg-red-100 text-red-700", on_leave: "bg-amber-100 text-amber-700" };
export const staffStatusLabels: Record<string, string> = { active: "Actif", inactive: "Inactif", on_leave: "En congé" };
export const adminRoleLabels: Record<string, string> = { admin: "Administrateur", manager: "Manager", staff: "Personnel" };
export const invoiceStatusColors: Record<string, string> = { pending: "bg-amber-100 text-amber-700", paid: "bg-green-100 text-green-700", cancelled: "bg-red-100 text-red-700", overdue: "bg-red-200 text-red-800" };
export const invoiceStatusLabels: Record<string, string> = { pending: "En attente", paid: "Payée", cancelled: "Annulée", overdue: "En retard" };
export const quoteStatusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-700", sent: "bg-blue-100 text-blue-700", accepted: "bg-green-100 text-green-700", refused: "bg-red-100 text-red-700", expired: "bg-amber-100 text-amber-700" };
export const quoteStatusLabels: Record<string, string> = { draft: "Brouillon", sent: "Envoyé", accepted: "Accepté", refused: "Refusé", expired: "Expiré" };
export const expenseCategoryLabels: Record<string, string> = { ingredients: "Ingrédients", utilities: "Services publics", rent: "Loyer", salary: "Salaires", equipment: "Équipement", transport: "Transport", other: "Autre" };
export const expenseCategoryColors: Record<string, string> = { ingredients: "bg-orange-100 text-orange-700", utilities: "bg-blue-100 text-blue-700", rent: "bg-purple-100 text-purple-700", salary: "bg-green-100 text-green-700", equipment: "bg-cyan-100 text-cyan-700", transport: "bg-amber-100 text-amber-700", other: "bg-gray-100 text-gray-700" };
