import { Leaf, Flame, Fish, CakeSlice, CupSoda } from "lucide-react";
import { db } from './db';

// ────────────────────────────────────────────────────────────────
// Default fallback values (used when no restaurant is resolved)
// ────────────────────────────────────────────────────────────────

export const RESTO_HOURS = {
  open: 11, // 11h00
  close: 23, // 23h00
  timezone: 'Africa/Conakry',
};

export function isRestaurantOpen(hours?: { open: number; close: number; timezone: string }): boolean {
  const config = hours || RESTO_HOURS;
  const now = new Date();
  // For simplicity, use UTC hours. For production, use proper timezone conversion.
  const currentHour = now.getUTCHours();
  return currentHour >= config.open && currentHour < config.close;
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

export function formatPrice(p: number, currency: string = "GNF"): string {
  if (currency === "GNF") return p.toLocaleString("fr-FR") + " GNF";
  if (currency === "XOF") return p.toLocaleString("fr-FR") + " FCFA";
  if (currency === "EUR") return p.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  if (currency === "USD") return p.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return p.toLocaleString("fr-FR") + " " + currency;
}

// ────────────────────────────────────────────────────────────────
// Dynamic Restaurant Config — loaded from DB per tenant
// ────────────────────────────────────────────────────────────────

export interface MenuCategory {
  id: string;
  name: string;
  icon?: unknown; // Lucide icon component (client-side only)
}

export interface OpeningHours {
  open: number;
  close: number;
  timezone: string;
}

export interface Features {
  delivery: boolean;
  reservations: boolean;
  reviews: boolean;
  loyalty: boolean;
  pos: boolean;
  invoices: boolean;
  quotes: boolean;
  expenses: boolean;
  staff: boolean;
  drivers: boolean;
  custom_domain?: boolean;
  api_access?: boolean;
  white_label?: boolean;
}

export interface RestaurantConfigResolved {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  hours: string;
  heroImage: string;
  logo: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  rating: number;
  tables: number;
  deliveryFee: number;
  minDelivery: number;
  deliveryZones: string[];
  menuCategories: MenuCategory[];
  openingHours: OpeningHours;
  features: Features;
  currency: string;
  locale: string;
  plan: string;
  socialLinks: { facebook: string; instagram: string; twitter: string };
  customDomain: string;
  metaTitle: string;
  metaDescription: string;
}

// Cache for restaurant configs
const configCache = new Map<string, { data: RestaurantConfigResolved; expiresAt: number }>();
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load full restaurant config from database, with caching
 */
export async function getRestaurantConfig(slug: string): Promise<RestaurantConfigResolved | null> {
  // Check cache
  const cached = configCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    include: { config: true },
  });

  if (!restaurant) return null;

  const config = restaurant.config;
  const parsedCategories: MenuCategory[] = config?.menuCategories
    ? safeJsonParse(config.menuCategories, [])
    : [];

  const parsedHours: OpeningHours = config?.openingHours
    ? safeJsonParse(config.openingHours, RESTO_HOURS)
    : RESTO_HOURS;

  const parsedFeatures: Features = config?.features
    ? safeJsonParse(config.features, { delivery: true, reservations: true, reviews: true, loyalty: true, pos: true, invoices: true, quotes: true, expenses: true, staff: true, drivers: true })
    : { delivery: true, reservations: true, reviews: true, loyalty: true, pos: true, invoices: true, quotes: true, expenses: true, staff: true, drivers: true };

  const parsedSocial: { facebook: string; instagram: string; twitter: string } = config?.socialLinks
    ? safeJsonParse(config.socialLinks, { facebook: '', instagram: '', twitter: '' })
    : { facebook: '', instagram: '', twitter: '' };

  const resolved: RestaurantConfigResolved = {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    tagline: restaurant.tagline,
    description: restaurant.description,
    phone: restaurant.phone,
    whatsapp: restaurant.whatsapp,
    email: restaurant.email,
    address: restaurant.address,
    hours: restaurant.hours,
    heroImage: config?.heroImage || '/images/kfm-hero.png',
    logo: config?.logo || '',
    primaryColor: config?.primaryColor || '#ea580c',
    accentColor: config?.accentColor || '#f97316',
    fontFamily: config?.fontFamily || 'Inter',
    rating: restaurant.rating,
    tables: restaurant.tables,
    deliveryFee: restaurant.deliveryFee,
    minDelivery: restaurant.minDelivery,
    deliveryZones: restaurant.deliveryZones ? restaurant.deliveryZones.split(':') : [],
    menuCategories: parsedCategories,
    openingHours: parsedHours,
    features: parsedFeatures,
    currency: restaurant.currency || 'GNF',
    locale: restaurant.locale || 'fr',
    plan: restaurant.plan || 'free',
    socialLinks: parsedSocial,
    customDomain: config?.customDomain || '',
    metaTitle: config?.metaTitle || restaurant.name,
    metaDescription: config?.metaDescription || restaurant.description,
  };

  // Cache
  configCache.set(slug, { data: resolved, expiresAt: Date.now() + CONFIG_CACHE_TTL });
  return resolved;
}

/**
 * Get restaurant config by ID (when you already have the ID from JWT)
 */
export async function getRestaurantConfigById(restaurantId: string): Promise<RestaurantConfigResolved | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    include: { config: true },
  });
  if (!restaurant) return null;
  return getRestaurantConfig(restaurant.slug);
}

/**
 * Invalidate config cache for a specific restaurant
 */
export function invalidateConfigCache(slug?: string): void {
  if (slug) {
    configCache.delete(slug);
  } else {
    configCache.clear();
  }
}

// ────────────────────────────────────────────────────────────────
// Default menu categories with icons (used client-side)
// ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, unknown> = {
  entrees: Leaf,
  plats: Flame,
  mer: Fish,
  desserts: CakeSlice,
  boissons: CupSoda,
};

/**
 * Enrich menu categories with Lucide icons (client-side only)
 */
export function enrichCategoriesWithIcons(categories: MenuCategory[]): MenuCategory[] {
  return categories.map(cat => ({
    ...cat,
    icon: ICON_MAP[cat.id] || Flame,
  }));
}

// ────────────────────────────────────────────────────────────────
// Safe JSON parser
// ────────────────────────────────────────────────────────────────

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// ────────────────────────────────────────────────────────────────
// Status labels and colors (unchanged, global UI constants)
// ────────────────────────────────────────────────────────────────

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

// Plan labels for SaaS
export const planLabels: Record<string, string> = {
  free: "Gratuit",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Entreprise",
};
export const planColors: Record<string, string> = {
  free: "bg-gray-100 text-gray-700",
  starter: "bg-blue-100 text-blue-700",
  pro: "bg-purple-100 text-purple-700",
  enterprise: "bg-amber-100 text-amber-700",
};
export const restaurantStatusLabels: Record<string, string> = {
  active: "Actif",
  trial: "Essai",
  suspended: "Suspendu",
  cancelled: "Annulé",
};
export const restaurantStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trial: "bg-blue-100 text-blue-700",
  suspended: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-700",
};
