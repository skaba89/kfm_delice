const EDGE_DOMAIN_PREFIX = 'tenant-domain:';

export class CustomDomainRoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomDomainRoutingError';
  }
}

export function normalizeRequestHostname(value: string | null | undefined): string {
  if (!value) return '';
  let hostname = value.trim().toLowerCase();
  if (hostname.startsWith('[')) {
    const end = hostname.indexOf(']');
    return end > 0 ? hostname.slice(1, end) : hostname;
  }
  hostname = hostname.split(':')[0] || '';
  return hostname.replace(/\.+$/, '');
}

function configuredPlatformHostnames(): string[] {
  const hostnames = new Set<string>();
  const renderHostname = normalizeRequestHostname(process.env.RENDER_EXTERNAL_HOSTNAME);
  if (renderHostname) hostnames.add(renderHostname);

  const publicAppUrl = process.env.PUBLIC_APP_URL || '';
  if (publicAppUrl) {
    try {
      const hostname = normalizeRequestHostname(new URL(publicAppUrl).hostname);
      if (hostname) hostnames.add(hostname);
    } catch {
      // Production safety validates PUBLIC_APP_URL. Invalid values simply do not
      // become trusted platform hostnames here.
    }
  }
  return [...hostnames];
}

export function isPlatformOrTenantHostname(hostnameInput: string): boolean {
  const hostname = normalizeRequestHostname(hostnameInput);
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;

  for (const base of configuredPlatformHostnames()) {
    if (hostname === base || hostname.endsWith(`.${base}`)) return true;
  }
  return false;
}

function getUpstashConfig(): { url: string; token: string } {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, '') || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !token) {
    throw new CustomDomainRoutingError('Custom-domain edge routing requires Upstash Redis URL and token.');
  }
  return { url, token };
}

async function runUpstashPipeline(commands: string[][]): Promise<Array<{ result?: unknown; error?: string }>> {
  const { url, token } = getUpstashConfig();
  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!response.ok) {
    throw new CustomDomainRoutingError(`Custom-domain routing backend unavailable (${response.status}).`);
  }
  const body = await response.json() as Array<{ result?: unknown; error?: string }>;
  if (!Array.isArray(body) || body.length !== commands.length || body.some((item) => item?.error)) {
    throw new CustomDomainRoutingError('Custom-domain routing backend returned an invalid response.');
  }
  return body;
}

export async function resolveCustomDomainTenantSlug(hostnameInput: string): Promise<string | null> {
  const hostname = normalizeRequestHostname(hostnameInput);
  if (!hostname) return null;
  const [entry] = await runUpstashPipeline([['GET', `${EDGE_DOMAIN_PREFIX}${hostname}`]]);
  return typeof entry?.result === 'string' && entry.result.trim() ? entry.result.trim() : null;
}

export async function publishCustomDomainRoute(hostnameInput: string, tenantSlug: string): Promise<void> {
  const hostname = normalizeRequestHostname(hostnameInput);
  const slug = tenantSlug.trim();
  if (!hostname || !slug) throw new CustomDomainRoutingError('Hostname and tenant slug are required.');
  await runUpstashPipeline([['SET', `${EDGE_DOMAIN_PREFIX}${hostname}`, slug]]);
}

export async function removeCustomDomainRoute(hostnameInput: string): Promise<void> {
  const hostname = normalizeRequestHostname(hostnameInput);
  if (!hostname) return;
  await runUpstashPipeline([['DEL', `${EDGE_DOMAIN_PREFIX}${hostname}`]]);
}
