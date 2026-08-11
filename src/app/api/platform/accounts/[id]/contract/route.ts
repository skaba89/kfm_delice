import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, dbReady, bigIntToNumber } from '@/lib/db';
import { authenticatePlatformAdmin } from '@/lib/auth';
import { invalidateTenantCache } from '@/lib/tenant';
import { logAudit } from '@/lib/audit';

function validIsoDate(value: string): boolean {
  if (value === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const [year, month, day] = value.split('-').map(Number);
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

const isoDate = z.string().refine(validIsoDate, 'Date invalide — format attendu YYYY-MM-DD ou chaîne vide');

const contractPatchSchema = z.object({
  ownerName: z.string().max(120).optional(),
  ownerEmail: z.union([z.string().email(), z.literal('')]).optional(),
  ownerPhone: z.string().max(40).optional(),
  contractStartDate: isoDate.optional(),
  contractEndDate: isoDate.optional(),
  trialEndsAt: isoDate.optional(),
}).strict().refine((data) => {
  if (!data.contractStartDate || !data.contractEndDate) return true;
  return data.contractStartDate <= data.contractEndDate;
}, {
  message: 'La date de fin de contrat doit être postérieure ou égale à la date de début',
  path: ['contractEndDate'],
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbReady;
    const platformAdmin = await authenticatePlatformAdmin(request);
    if (!platformAdmin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    const validation = contractPatchSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        {
          error: validation.error.issues[0]?.message || 'Données contractuelles invalides',
          code: 'CONTRACT_VALIDATION_ERROR',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const existing = await db.account.findUnique({
      where: { id },
      select: {
        id: true,
        ownerName: true,
        ownerEmail: true,
        ownerPhone: true,
        contractStartDate: true,
        contractEndDate: true,
        trialEndsAt: true,
        status: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Compte non trouvé' }, { status: 404 });
    }

    const updated = await db.account.update({
      where: { id },
      data: validation.data,
    });

    invalidateTenantCache();

    await logAudit({
      actorId: platformAdmin.id,
      actorType: 'platform_admin',
      action: 'account_contract_update',
      entityType: 'Account',
      entityId: id,
      accountId: id,
      before: existing,
      after: validation.data,
      request,
    });

    return NextResponse.json(bigIntToNumber(updated));
  } catch (error) {
    console.error('[platform/account/contract PATCH]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
