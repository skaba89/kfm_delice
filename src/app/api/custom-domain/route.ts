import { NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { commercialFeatureGate } from '@/lib/commercial-feature-gate';
import { invalidateConfigCache } from '@/lib/constants';
import { db, dbReady } from '@/lib/db';
import {
  CustomDomainError,
  assertCustomDomainProvisioningConfigured,
  customDomainProvisioningConfigured,
  customDomainRequestSchema,
  normalizeCustomDomain,
} from '@/lib/custom-domain-policy';
import { removeCustomDomainRoute } from '@/lib/custom-domain-routing';
import { addRenderCustomDomain, deleteRenderCustomDomain } from '@/lib/render-custom-domains';
import { invalidateTenantCache } from '@/lib/tenant';

function writeForbidden(role: string) {
  return role !== 'admin';
}

export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const [restaurant, mapping] = await Promise.all([
      db.restaurant.findUnique({
        where: { id: admin.restaurantId },
        select: { id: true, slug: true, accountId: true },
      }),
      db.customDomainMapping.findUnique({ where: { restaurantId: admin.restaurantId } }),
    ]);
    if (!restaurant) return NextResponse.json({ error: 'Restaurant introuvable' }, { status: 404 });

    return NextResponse.json({
      configured: customDomainProvisioningConfigured(),
      dnsTarget: process.env.RENDER_EXTERNAL_HOSTNAME || '',
      mapping,
    });
  } catch (error) {
    console.error('[custom-domain GET]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    if (writeForbidden(admin.role)) {
      return NextResponse.json(
        { error: 'Seul un administrateur du restaurant peut configurer le domaine.', code: 'CUSTOM_DOMAIN_ROLE_FORBIDDEN' },
        { status: 403 },
      );
    }

    const gate = await commercialFeatureGate(admin.restaurantId, 'custom_domain');
    if (gate) return gate;
    assertCustomDomainProvisioningConfigured();

    const parsed = customDomainRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Domaine invalide', code: 'CUSTOM_DOMAIN_VALIDATION_ERROR' },
        { status: 400 },
      );
    }
    const domain = normalizeCustomDomain(parsed.data.domain);

    const restaurant = await db.restaurant.findUnique({
      where: { id: admin.restaurantId },
      select: { id: true, slug: true, accountId: true },
    });
    if (!restaurant) return NextResponse.json({ error: 'Restaurant introuvable' }, { status: 404 });

    const [existing, domainOwner] = await Promise.all([
      db.customDomainMapping.findUnique({ where: { restaurantId: restaurant.id } }),
      db.customDomainMapping.findUnique({ where: { domain } }),
    ]);
    if (domainOwner && domainOwner.restaurantId !== restaurant.id) {
      return NextResponse.json(
        { error: 'Ce domaine est déjà rattaché à un autre restaurant.', code: 'CUSTOM_DOMAIN_ALREADY_CLAIMED' },
        { status: 409 },
      );
    }
    if (existing && existing.domain !== domain) {
      return NextResponse.json(
        { error: 'Supprimez le domaine actuel avant d’en demander un autre.', code: 'CUSTOM_DOMAIN_REPLACE_REQUIRES_REMOVE' },
        { status: 409 },
      );
    }
    if (existing?.status === 'active' && existing.domain === domain) {
      return NextResponse.json({ mapping: existing, dnsTarget: process.env.RENDER_EXTERNAL_HOSTNAME || '' });
    }

    await db.customDomainMapping.upsert({
      where: { restaurantId: restaurant.id },
      update: {
        domain,
        accountId: restaurant.accountId,
        status: 'provisioning',
        errorMessage: '',
        lastCheckedAt: new Date(),
      },
      create: {
        restaurantId: restaurant.id,
        accountId: restaurant.accountId,
        domain,
        status: 'provisioning',
      },
    });

    try {
      const provider = await addRenderCustomDomain(domain);
      const mapping = await db.customDomainMapping.update({
        where: { restaurantId: restaurant.id },
        data: {
          status: provider.verificationStatus === 'verified' ? 'unverified' : 'unverified',
          providerDomainId: provider.id,
          verificationStatus: provider.verificationStatus,
          lastCheckedAt: new Date(),
          errorMessage: '',
        },
      });

      await logAudit({
        actorId: admin.id,
        actorType: 'admin',
        action: 'custom_domain_requested',
        entityType: 'CustomDomainMapping',
        entityId: mapping.id,
        accountId: restaurant.accountId,
        restaurantId: restaurant.id,
        after: { domain, status: mapping.status, verificationStatus: mapping.verificationStatus },
        request,
      });

      return NextResponse.json(
        { mapping, dnsTarget: process.env.RENDER_EXTERNAL_HOSTNAME || '' },
        { status: 201 },
      );
    } catch (error) {
      await db.customDomainMapping.update({
        where: { restaurantId: restaurant.id },
        data: {
          status: 'error',
          errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Provider error',
          lastCheckedAt: new Date(),
        },
      }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof CustomDomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    console.error('[custom-domain POST]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    if (writeForbidden(admin.role)) {
      return NextResponse.json(
        { error: 'Seul un administrateur du restaurant peut supprimer le domaine.', code: 'CUSTOM_DOMAIN_ROLE_FORBIDDEN' },
        { status: 403 },
      );
    }

    const mapping = await db.customDomainMapping.findUnique({ where: { restaurantId: admin.restaurantId } });
    if (!mapping) return new NextResponse(null, { status: 204 });

    const restaurant = await db.restaurant.findUnique({
      where: { id: admin.restaurantId },
      select: { id: true, slug: true, accountId: true },
    });
    if (!restaurant) return NextResponse.json({ error: 'Restaurant introuvable' }, { status: 404 });

    if (mapping.status === 'active') {
      try {
        await removeCustomDomainRoute(mapping.domain);
      } catch (error) {
        return NextResponse.json(
          {
            error: 'Impossible de désactiver le routage du domaine. Suppression interrompue par sécurité.',
            code: 'CUSTOM_DOMAIN_EDGE_REMOVE_FAILED',
          },
          { status: 503 },
        );
      }
    }

    await db.customDomainMapping.update({
      where: { id: mapping.id },
      data: { status: 'removing', errorMessage: '' },
    });

    try {
      await deleteRenderCustomDomain(mapping.providerDomainId || mapping.domain);
    } catch (error) {
      await db.customDomainMapping.update({
        where: { id: mapping.id },
        data: { status: 'error', errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Provider error' },
      }).catch(() => undefined);
      throw error;
    }

    await db.$transaction(async (tx) => {
      await tx.restaurantConfig.upsert({
        where: { restaurantId: restaurant.id },
        update: { customDomain: '' },
        create: { restaurantId: restaurant.id, customDomain: '' },
      });
      await tx.customDomainMapping.delete({ where: { id: mapping.id } });
    });

    invalidateTenantCache(restaurant.slug);
    invalidateConfigCache();
    await logAudit({
      actorId: admin.id,
      actorType: 'admin',
      action: 'custom_domain_removed',
      entityType: 'CustomDomainMapping',
      entityId: mapping.id,
      accountId: restaurant.accountId,
      restaurantId: restaurant.id,
      before: { domain: mapping.domain, status: mapping.status },
      after: { removed: true },
      request,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof CustomDomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    console.error('[custom-domain DELETE]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
