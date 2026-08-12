import { z } from 'zod';

const optionalEmailSchema = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().email('Email du restaurant invalide').max(254).optional(),
);

export const publicRegistrationRequestSchema = z.object({
  restaurantName: z.string().trim().min(2, 'Nom du restaurant requis (min 2 caractères)').max(120),
  slug: z.string().trim().min(2, 'Slug requis').max(80)
    .regex(/^[a-z0-9-]+$/, 'Slug: lettres minuscules, chiffres et tirets uniquement')
    .optional(),
  tagline: z.string().trim().max(160).optional(),
  phone: z.string().trim().min(3, 'Téléphone du restaurant requis').max(40),
  whatsapp: z.string().trim().max(40).optional(),
  email: optionalEmailSchema,
  address: z.string().trim().max(300).optional(),
  currency: z.enum(['GNF', 'XOF', 'EUR', 'USD']).default('GNF'),
  locale: z.enum(['fr', 'en']).default('fr'),
  ownerName: z.string().trim().min(2, 'Nom du propriétaire requis').max(120),
  ownerEmail: z.string().trim().email('Email du propriétaire invalide').max(254),
  ownerPassword: z.string().min(6, 'Mot de passe requis').max(128),
  ownerPhone: z.string().trim().max(40).optional(),
}).strict();

export const publicRegistrationIntentPayloadSchema = publicRegistrationRequestSchema
  .omit({ ownerPassword: true })
  .extend({
    ownerEmail: z.string().email().max(254),
    trialPlan: z.enum(['starter', 'pro']),
    trialDays: z.number().int().min(1).max(30),
  })
  .strict();

export const publicRegistrationVerificationSchema = z.object({
  token: z.string().trim().regex(/^[a-f0-9]{64}$/i, 'Token de vérification invalide'),
}).strict();

export type PublicRegistrationIntentPayload = z.infer<typeof publicRegistrationIntentPayloadSchema>;
