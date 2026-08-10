import { NextResponse } from 'next/server';
import { authenticateAdmin, hasRole } from '@/lib/auth';

/**
 * Runtime schema mutation has been permanently retired.
 * All structural changes must be committed as reviewed Prisma migrations and
 * applied by `prisma migrate deploy` during the guarded startup pipeline.
 */
export async function POST(request: Request) {
  const admin = await authenticateAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  if (!hasRole(admin.role, ['admin'])) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  return NextResponse.json(
    {
      error: 'La modification du schéma via HTTP est désactivée.',
      code: 'RUNTIME_SCHEMA_MUTATION_DISABLED',
      remediation: 'Créer une migration Prisma versionnée puis utiliser prisma migrate deploy.',
    },
    { status: 410 }
  );
}
