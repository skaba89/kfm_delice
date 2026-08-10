import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  authenticateAdmin: vi.fn(),
  hasRole: (role: string, roles: readonly string[]) => roles.includes(role),
}));

import { authenticateAdmin } from '@/lib/auth';
import { GET as seedGet, POST as seedPost } from '@/app/api/seed/route';
import { POST as fixSchemaPost } from '@/app/api/fix-schema/route';

describe('retired maintenance HTTP surface', () => {
  beforeEach(() => vi.clearAllMocks());

  it('never exposes HTTP seed/reset operations', async () => {
    const getResponse = await seedGet();
    const postResponse = await seedPost();
    expect(getResponse.status).toBe(410);
    expect(postResponse.status).toBe(410);
    await expect(getResponse.json()).resolves.toMatchObject({ code: 'HTTP_SEED_RETIRED' });
  });

  it('never performs runtime schema mutations even for an admin', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue({ role: 'admin' } as any);
    const response = await fixSchemaPost(new Request('https://example.com/api/fix-schema', {
      method: 'POST',
      headers: { Authorization: 'Bearer test' },
    }));
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ code: 'RUNTIME_SCHEMA_MUTATION_DISABLED' });
  });

  it('keeps fix-schema protected for unauthenticated requests', async () => {
    vi.mocked(authenticateAdmin).mockResolvedValue(null);
    const response = await fixSchemaPost(new Request('https://example.com/api/fix-schema', { method: 'POST' }));
    expect(response.status).toBe(401);
  });
});
