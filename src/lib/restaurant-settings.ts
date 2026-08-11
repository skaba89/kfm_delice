import { z } from 'zod';

const MAX_MONEY = 1_000_000_000;
const MAX_JSON_CHARS = 100_000;
const MAX_IMAGE_VALUE_CHARS = 2_000_000;

const text = (max: number) => z.string().max(max);
const optionalEmail = z.union([z.string().email('Email invalide'), z.literal('')]);

function jsonTextSchema(label: string) {
  return z.string().max(MAX_JSON_CHARS, `${label} trop volumineux`).refine((value) => {
    if (!value) return true;
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }, `${label} doit être un JSON valide`);
}

const jsonObjectOrArray = (label: string) => z.union([
  jsonTextSchema(label),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

export const restaurantSettingsRestaurantSchema = z.object({
  name: z.string().trim().min(2, 'Nom requis (min 2 caractères)').max(120).optional(),
  tagline: text(240).optional(),
  description: text(5000).optional(),
  phone: text(60).optional(),
  whatsapp: text(60).optional(),
  email: optionalEmail.optional(),
  address: text(1000).optional(),
  hours: text(500).optional(),
  tables: z.number().int().min(0).max(10000).optional(),
  deliveryFee: z.number().int().min(0).max(MAX_MONEY).optional(),
  minDelivery: z.number().int().min(0).max(MAX_MONEY).optional(),
  deliveryZones: z.union([
    text(5000),
    z.array(z.string().trim().min(1).max(120)).max(100),
  ]).optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, 'Devise invalide (code ISO à 3 lettres attendu)').optional(),
  locale: z.string().trim().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, 'Locale invalide').optional(),
}).strict();

export const restaurantSettingsConfigSchema = z.object({
  logo: text(MAX_IMAGE_VALUE_CHARS).optional(),
  heroImage: text(MAX_IMAGE_VALUE_CHARS).optional(),
  primaryColor: text(100).optional(),
  accentColor: text(100).optional(),
  fontFamily: text(200).optional(),
  menuCategories: jsonObjectOrArray('menuCategories').optional(),
  features: jsonObjectOrArray('features').optional(),
  openingHours: jsonObjectOrArray('openingHours').optional(),
  socialLinks: jsonObjectOrArray('socialLinks').optional(),
  customDomain: text(255).optional(),
  metaTitle: text(200).optional(),
  metaDescription: text(1000).optional(),
}).strict();

export const restaurantSettingsPatchSchema = z.object({
  restaurant: restaurantSettingsRestaurantSchema.optional(),
  config: restaurantSettingsConfigSchema.optional(),
}).strict().refine(
  (value) => Boolean(value.restaurant || value.config),
  { message: 'restaurant ou config requis' }
);

export type RestaurantSettingsPatch = z.infer<typeof restaurantSettingsPatchSchema>;

function providerMoney(value: number): number | bigint {
  const url = process.env.DATABASE_URL || '';
  return url.startsWith('postgresql://') || url.startsWith('postgres://')
    ? BigInt(value)
    : value;
}

export function normalizeRestaurantSettingsData(
  input: NonNullable<RestaurantSettingsPatch['restaurant']>
): Record<string, unknown> {
  const data: Record<string, unknown> = { ...input };

  if (Array.isArray(input.deliveryZones)) {
    data.deliveryZones = input.deliveryZones.join(':');
  }
  if (input.deliveryFee !== undefined) {
    data.deliveryFee = providerMoney(input.deliveryFee);
  }
  if (input.minDelivery !== undefined) {
    data.minDelivery = providerMoney(input.minDelivery);
  }

  return data;
}

function normalizeJsonSetting(value: unknown): unknown {
  if (typeof value === 'string') {
    if (!value) return value;
    return JSON.stringify(JSON.parse(value));
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return value;
}

const JSON_CONFIG_FIELDS = new Set(['menuCategories', 'features', 'openingHours', 'socialLinks']);

export function normalizeRestaurantConfigData(
  input: NonNullable<RestaurantSettingsPatch['config']>
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    data[key] = JSON_CONFIG_FIELDS.has(key) ? normalizeJsonSetting(value) : value;
  }
  return data;
}
