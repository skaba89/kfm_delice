import { Leaf, Flame, Fish, CakeSlice, CupSoda } from "lucide-react";
import { db } from './db';
import {
  getPlanFeatures,
  normalizeCommercialPlanValue,
} from './commercial-plan-catalog';

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
  // Use Africa/Conakry timezone (UTC+0, no DST)
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  return currentHour >= config.open && currentHour < config.close;
}

/**
 * Structured weekly hours — each day has open/close or is closed.
 * Stored as JSON in RestaurantConfig.openingHours.
 */
export interface WeeklyHours {
  monday:    { open: number; close: number; closed: boolean };
  tuesday:   { open: number; close: number; closed: boolean };
  wednesday: { open: number; close: number; closed: boolean };
  thursday:  { open: number; close: number; closed: boolean };
  friday:    { open: number; close: number; closed: boolean };
  saturday:  { open: number; close: number; closed: boolean };
  sunday:    { open: number; close: number; closed: boolean };
}

export const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  monday:    { open: 11, close: 23, closed: false },
  tuesday:   { open: 11, close: 23, closed: false },
  wednesday: { open: 11, close: 23, closed: false },
  thursday:  { open: 11, close: 23, closed: false },
  friday:    { open: 11, close: 23, closed: false },
  saturday:  { open: 11, close: 23, closed: false },
  sunday:    { open: 11, close: 23, closed: false },
};

export const DAY_NAMES = [
  { key: 'sunday', label: 'Dimanche' },
  { key: 'monday', label: 'Lundi' },
  { key: 'tuesday', label: 'Mardi' },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday', label: 'Jeudi' },
  { key: 'friday', label: 'Vendredi' },
  { key: 'saturday', label: 'Samedi' },
];

/**
 * Check if restaurant is open based on structured weekly hours.
 * Uses Africa/Conakry timezone (UTC+0).
 */
export function isRestaurantOpenWeekly(weeklyHours: WeeklyHours): boolean {
  const now = new Date();
  const currentDay = now.getUTCDay(); // 0=Sunday
  const currentHour = now.getUTCHours();
  const dayKey = DAY_NAMES[currentDay].key as keyof WeeklyHours;
  const dayConfig = weeklyHours[dayKey];
  if (dayConfig.closed) return false;
  return currentHour >= dayConfig.open && currentHour < dayConfig.close;
}

/**
 * Get today's hours as a readable string.
 */
export function getTodayHoursLabel(weeklyHours: WeeklyHours): string {
  const now = new Date();
  const currentDay = now.getUTCDay();
  const dayKey = DAY_NAMES[currentDay].key as keyof WeeklyHours;
  const dayConfig = weeklyHours[dayKey];
  if (dayConfig.closed) return "Fermé aujourd'hui";
  return `${dayConfig.open}h - ${dayConfig.close}h`;
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

export function formatPrice(p: number | undefined | null, currency: string = "GNF"): string {
  // Guard against undefined/null/NaN — can happen when BigInt conversion
  // fails or when a field doesn't exist in the DB yet
  const num = Number(p ?? 0);
  if (isNaN(num)) return `0 ${currency}`;
  if (currency === "GNF") return num.toLocaleString("fr-FR") + " GNF";
  if (currency === "XOF") return num.toLocaleString("fr-FR") + " FCFA";
  if (currency === "EUR") return num.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  if (currency === "USD") return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return num.toLocaleString("fr-FR") + " " + currency;
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
  advanced_analytics?: boolean;
  exports?: boolean;
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
 * Load full restaurant config from database, with caching.
 * Config-level feature toggles can disable a capability, but never re-enable a
 * capability absent from the effective Account/Restaurant commercial plan.
 */
export async function getRestaurantConfig(slug: string): Promise<RestaurantConfigResolved | null> {
  const cached = configCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    include: {
      config: true,
      account: { select: { plan: true } },
    },
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

  const effectivePlan = normalizeCommercialPlanValue(restaurant.account?.plan)
    ?? normalizeCommercialPlanValue(restaurant.plan)
    ?? 'free';
  const allowedFeatures = new Set(getPlanFeatures(effectivePlan));
  const enabled = (feature: keyof Features): boolean =>
    parsedFeatures[feature] !== false && allowedFeatures.has(feature as any);

  const resolvedFeatures: Features = {
    delivery: enabled('delivery'),
    reservations: enabled('reservations'),
    reviews: enabled('reviews'),
    loyalty: enabled('loyalty'),
    pos: enabled('pos'),
    invoices: enabled('invoices'),
    quotes: enabled('quotes'),
    expenses: enabled('expenses'),
    staff: enabled('staff'),
    drivers: enabled('drivers'),
    advanced_analytics: enabled('advanced_analytics'),
    exports: enabled('exports'),
    // Enterprise-only capabilities are still opt-in at config level because
    // their operational provisioning is not automatic yet.
    custom_domain: Boolean(parsedFeatures.custom_domain) && allowedFeatures.has('custom_domain'),
    api_access: Boolean(parsedFeatures.api_access) && allowedFeatures.has('api_access'),
    white_label: Boolean(parsedFeatures.white_label) && allowedFeatures.has('white_label'),
  };

  const parsedSocial: { facebook: string; instagram: string; twitter: string } = config?.socialLinks
    ? safeJsonParse(config.socialLinks, { facebook: '', instagram: '', twitter: '' })
    : { facebook: '', instagram: '', twitter: '' };

  const resolved: RestaurantConfigResolved = {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    tagline: restaurant.tagline || '',
    description: restaurant.description || '',
    phone: restaurant.phone || '',
    whatsapp: restaurant.whatsapp || '',
    email: restaurant.email || '',
    address: restaurant.address || '',
    hours: restaurant.hours || '',
    heroImage: config?.heroImage || '/images/kfm-hero.png',
    logo: config?.logo || '',
    primaryColor: config?.primaryColor || '#ea580c',
    accentColor: config?.accentColor || '#f97316',
    fontFamily: config?.fontFamily || 'Inter',
    rating: restaurant.rating ?? 4.5,
    tables: restaurant.tables ?? 20,
    deliveryFee: Number(restaurant.deliveryFee ?? 5000),
    minDelivery: Number(restaurant.minDelivery ?? 15000),
    deliveryZones: restaurant.deliveryZones ? restaurant.deliveryZones.split(':') : [],
    menuCategories: parsedCategories,
    openingHours: parsedHours,
    features: resolvedFeatures,
    currency: restaurant.currency || 'GNF',
    locale: restaurant.locale || 'fr',
    plan: effectivePlan,
    socialLinks: parsedSocial,
    customDomain: allowedFeatures.has('custom_domain') ? (config?.customDomain || '') : '',
    metaTitle: config?.metaTitle || restaurant.name,
    metaDescription: config?.metaDescription || restaurant.description || '',
  };

  configCache.set(slug, { data: resolved, expiresAt: Date.now() + CONFIG_CACHE_TTL });
  return resolved;
}

/**
 * Get restaurant config by ID (when you already have the ID from JWT)
 */
export async function getRestaurantConfigById(restaurantId: string): Promise<RestaurantConfigResolved | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { slug: true },
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
// Handles both SQLite (String JSON) and PostgreSQL (Json type, already parsed)
// ────────────────────────────────────────────────────────────────

function safeJsonParse<T>(json: unknown, fallback: T): T {
  if (json === null || json === undefined) return fallback;
  if (typeof json === 'string') {
    try {
      return JSON.parse(json) as T;
    } catch {
      return fallback;
    }
  }
  return json as T;
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
  cash: "Espèces", orange_money: "Orange Money", mtn_money: "MTN Money", wave: "Wave", card: "Carte",
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
export const orderTypeLabels: Record<string, string> = { dine_in: "Sur place", takeaway: "À emporter", delivery: "Moto-taxi" };
export const vehicleLabels: Record<string, string> = { moto: "Moto", velo: "Vélo", voiture: "Voiture" };
export const driverStatusColors: Record<string, string> = {
  available: "bg-green-100 text-green-700", busy: "bg-orange-100 text-orange-700", offline: "bg-gray-100 text-gray-700",
};
export const driverStatusLabels: Record<string, string> = { available: "Disponible", busy: "En livraison", offline: "Hors ligne" };
// ────────────────────────────────────────────────────────────────
// Staff roles (no login — kitchen / service records)
// 15 roles covering every position in a Guinean restaurant.
// ────────────────────────────────────────────────────────────────
export const staffRoleLabels: Record<string, string> = {
  // Kitchen
  cuisinier: "Cuisinier",
  commis: "Commis de cuisine",
  patissier: "Pâtissier",
  // Service
  serveur: "Serveur",
  barman: "Barman",
  sommelier: "Sommelier",
  receptionniste: "Réceptionniste",
  // Management
  gerant: "Gérant",
  caissier: "Caissier",
  // Support
  plongeur: "Plongeur",
  securite: "Sécurité",
  voiturier: "Voiturier",
  maintenance: "Maintenance",
  // Animation
  dj: "DJ",
  animateur: "Animateur",
};
export const staffRoleColors: Record<string, string> = {
  // Kitchen — orange shades
  cuisinier: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  commis: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  patissier: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  // Service — blue shades
  serveur: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  barman: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  sommelier: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  receptionniste: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  // Management — green shades
  gerant: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  caissier: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  // Support — gray shades
  plongeur: "bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300",
  securite: "bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-300",
  voiturier: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700/30 dark:text-zinc-300",
  maintenance: "bg-stone-100 text-stone-700 dark:bg-stone-700/30 dark:text-stone-300",
  // Animation — pink/rose shades
  dj: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  animateur: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};
export const staffStatusColors: Record<string, string> = { active: "bg-green-100 text-green-700", inactive: "bg-red-100 text-red-700", on_leave: "bg-amber-100 text-amber-700" };
export const staffStatusLabels: Record<string, string> = { active: "Actif", inactive: "Inactif", on_leave: "En congé" };

// ────────────────────────────────────────────────────────────────
// Admin roles (login accounts with dashboard access)
// 8 roles — from full restaurant owner to single-purpose accounts.
// ────────────────────────────────────────────────────────────────
export const adminRoleLabels: Record<string, string> = {
  admin: "Super Admin",
  manager: "Gérant",
  staff: "Personnel",
  cashier: "Caissier",
  kitchen: "Chef Cuisine",
  delivery_manager: "Resp. Livraison",
  driver: "Livreur",
  host: "Hôte d'Accueil",
  accountant: "Comptable",
};
export const adminRoleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  manager: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  staff: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  cashier: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  kitchen: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  delivery_manager: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  driver: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  host: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  accountant: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
};
export const adminRoleOrder: string[] = [
  "admin", "manager", "staff", "cashier",
  "kitchen", "delivery_manager", "driver", "host", "accountant",
];
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
