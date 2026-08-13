import { CustomDomainError, assertCustomDomainProvisioningConfigured } from './custom-domain-policy';
import { normalizeRequestHostname } from './custom-domain-routing';

export interface RenderCustomDomainSnapshot {
  id: string;
  name: string;
  verificationStatus: 'verified' | 'unverified';
}

function config() {
  assertCustomDomainProvisioningConfigured();
  return {
    apiKey: process.env.RENDER_API_KEY || '',
    serviceId: process.env.RENDER_SERVICE_ID || '',
  };
}

function normalizeSnapshot(body: unknown, fallbackName: string): RenderCustomDomainSnapshot {
  const root = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const nested = root.customDomain && typeof root.customDomain === 'object'
    ? root.customDomain as Record<string, unknown>
    : root;
  const rawStatus = String(nested.verificationStatus ?? root.verificationStatus ?? 'unverified').toLowerCase();
  return {
    id: typeof nested.id === 'string' ? nested.id : '',
    name: normalizeRequestHostname(typeof nested.name === 'string' ? nested.name : fallbackName),
    verificationStatus: rawStatus === 'verified' ? 'verified' : 'unverified',
  };
}

async function providerRequest(path: string, init: RequestInit, allowed: number[]): Promise<unknown> {
  const { apiKey } = config();
  const response = await fetch(`https://api.render.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!allowed.includes(response.status)) {
    throw new CustomDomainError(
      response.status === 404 ? 'CUSTOM_DOMAIN_PROVIDER_NOT_FOUND'
        : response.status === 409 ? 'CUSTOM_DOMAIN_PROVIDER_CONFLICT'
          : 'CUSTOM_DOMAIN_PROVIDER_ERROR',
      `Le fournisseur de domaine a refusé l’opération (${response.status}).`,
      response.status === 404 ? 404 : response.status === 409 ? 409 : 502,
    );
  }
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new CustomDomainError(
      'CUSTOM_DOMAIN_PROVIDER_INVALID_RESPONSE',
      'Le fournisseur de domaine a retourné une réponse invalide.',
      502,
    );
  }
}

function domainPath(domainOrId: string): string {
  const { serviceId } = config();
  return `/services/${encodeURIComponent(serviceId)}/custom-domains/${encodeURIComponent(domainOrId)}`;
}

export async function getRenderCustomDomain(domainOrId: string): Promise<RenderCustomDomainSnapshot> {
  const body = await providerRequest(domainPath(domainOrId), { method: 'GET' }, [200]);
  return normalizeSnapshot(body, domainOrId);
}

export async function addRenderCustomDomain(domain: string): Promise<RenderCustomDomainSnapshot> {
  const { serviceId } = config();
  try {
    const body = await providerRequest(
      `/services/${encodeURIComponent(serviceId)}/custom-domains`,
      { method: 'POST', body: JSON.stringify({ name: domain }) },
      [201],
    );
    return normalizeSnapshot(body, domain);
  } catch (error) {
    if (error instanceof CustomDomainError && error.code === 'CUSTOM_DOMAIN_PROVIDER_CONFLICT') {
      return getRenderCustomDomain(domain);
    }
    throw error;
  }
}

export async function verifyRenderCustomDomain(domainOrId: string): Promise<RenderCustomDomainSnapshot> {
  await providerRequest(`${domainPath(domainOrId)}/verify`, { method: 'POST' }, [200, 202, 204]);
  return getRenderCustomDomain(domainOrId);
}

export async function deleteRenderCustomDomain(domainOrId: string): Promise<void> {
  await providerRequest(domainPath(domainOrId), { method: 'DELETE' }, [204]);
}
