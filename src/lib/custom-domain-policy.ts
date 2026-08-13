import { z } from 'zod';
import { normalizeRequestHostname } from './custom-domain-routing';

export const customDomainRequestSchema = z.object({
  domain: z.string().trim().min(4).max(253),
}).strict();

export class CustomDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message);
    this.name = 'CustomDomainError';
  }
}

export function normalizeCustomDomain(input: string): string {
  const raw = input.trim().toLowerCase();
  if (!raw || raw.includes('://') || raw.includes('/') || raw.includes('\\') || raw.includes('*')) {
    throw new CustomDomainError('CUSTOM_DOMAIN_INVALID', 'Nom de domaine invalide.');
  }
  if (!/^[\x21-\x7e]+$/.test(raw)) {
    throw new CustomDomainError('CUSTOM_DOMAIN_INVALID', 'Le domaine doit être fourni en ASCII/punycode.');
  }

  const domain = normalizeRequestHostname(raw);
  if (!domain || domain.length > 253 || domain === 'localhost') {
    throw new CustomDomainError('CUSTOM_DOMAIN_INVALID', 'Nom de domaine invalide.');
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain) || domain.includes(':')) {
    throw new CustomDomainError('CUSTOM_DOMAIN_INVALID', 'Une adresse IP ne peut pas être utilisée comme domaine personnalisé.');
  }

  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((label) =>
    !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  )) {
    throw new CustomDomainError('CUSTOM_DOMAIN_INVALID', 'Nom de domaine invalide.');
  }

  const reserved: string[] = [];
  const renderHost = normalizeRequestHostname(process.env.RENDER_EXTERNAL_HOSTNAME);
  if (renderHost) reserved.push(renderHost);
  if (process.env.PUBLIC_APP_URL) {
    try {
      const publicHost = normalizeRequestHostname(new URL(process.env.PUBLIC_APP_URL).hostname);
      if (publicHost) reserved.push(publicHost);
    } catch {
      // PUBLIC_APP_URL is validated by the production safety guard.
    }
  }
  if (reserved.some((host) => domain === host || domain.endsWith(`.${host}`))) {
    throw new CustomDomainError('CUSTOM_DOMAIN_RESERVED', 'Ce domaine est réservé à la plateforme KFM Delice.');
  }

  return domain;
}

export function customDomainProvisioningConfigured(): boolean {
  return process.env.CUSTOM_DOMAIN_PROVISIONING_ENABLED === 'true'
    && Boolean(process.env.RENDER_API_KEY)
    && Boolean(process.env.RENDER_SERVICE_ID)
    && Boolean(process.env.RENDER_EXTERNAL_HOSTNAME)
    && Boolean(process.env.UPSTASH_REDIS_REST_URL)
    && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function assertCustomDomainProvisioningConfigured(): void {
  if (!customDomainProvisioningConfigured()) {
    throw new CustomDomainError(
      'CUSTOM_DOMAIN_PROVISIONING_NOT_CONFIGURED',
      'Le provisioning de domaine personnalisé n’est pas complètement configuré.',
      503,
    );
  }
}
