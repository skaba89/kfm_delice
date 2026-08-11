import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = (filename: string) => readFileSync(path.join(process.cwd(), filename), 'utf8');

describe('commercial catalog alignment', () => {
  it('gates advanced analytics as a Pro+ feature', () => {
    const text = source('src/app/api/analytics/advanced/route.ts');
    expect(text).toContain("commercialFeatureGate(admin.restaurantId, 'advanced_analytics')");
  });

  it('gates restaurant CSV exports without gating platform account exports', () => {
    const text = source('src/app/api/export/route.ts');
    const restaurantGate = text.indexOf("commercialFeatureGate(restaurantAdmin.restaurantId, 'exports')");
    const accountCase = text.indexOf('case "accounts"');
    expect(restaurantGate).toBeGreaterThan(-1);
    expect(accountCase).toBeGreaterThan(restaurantGate);
    expect(text).toContain('if (!platformAdmin)');
  });

  it('gates the PDF order journal as a Pro+ export', () => {
    const text = source('src/app/api/export/orders-journal/route.ts');
    expect(text).toContain("commercialFeatureGate(admin.restaurantId, 'exports')");
  });

  it('uses catalog quota defaults on the pricing page', () => {
    const text = source('src/app/pricing/page.tsx');
    expect(text).toContain('getPlanQuotaDefaults');
    expect(text).toContain('freeQuotas.maxRestaurants');
    expect(text).toContain('starterQuotas.maxAdmins');
    expect(text).toContain('proQuotas.maxUsers');
    expect(text).toContain('enterpriseQuotas.maxRestaurants');
  });

  it('advertises only the currently enforced Starter and Pro premium modules', () => {
    const text = source('src/app/pricing/page.tsx');
    expect(text).toContain('Factures clients');
    expect(text).not.toContain('Factures & devis');
    expect(text).toContain('Devis & dépenses');
    expect(text).toContain('Gestion équipe & livreurs');
    expect(text).toContain('Analytics avancés');
    expect(text).toContain('Exports CSV/PDF');
    expect(text).not.toContain('Notifications email');
  });

  it('does not market unverified Enterprise-only capabilities as already delivered', () => {
    const text = source('src/app/pricing/page.tsx');
    expect(text).not.toContain('Multi-devises');
    expect(text).not.toContain('API access');
    expect(text).not.toContain('White label');
    expect(text).not.toContain('SLA 99.9%');
    expect(text).toContain('Quotas entreprise étendus');
    expect(text).toContain('Paramétrage contractuel sur mesure');
  });

  it('derives account creation and plan-change quotas from the shared catalog', () => {
    const createText = source('src/app/api/platform/accounts/route.ts');
    const patchText = source('src/app/api/platform/accounts/[id]/quotas/route.ts');
    expect(createText).toContain('getPlanQuotaDefaults(input.plan)');
    expect(patchText).toContain('getPlanQuotaDefaults(input.plan)');
    expect(patchText).toContain('planChanged');
    expect(patchText).toContain('status: finalStatus');
  });
});
