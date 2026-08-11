import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const adminRoutes = [
  ['src/app/api/invoices/route.ts', 'invoices'],
  ['src/app/api/quotes/route.ts', 'quotes'],
  ['src/app/api/expenses/route.ts', 'expenses'],
  ['src/app/api/staff/route.ts', 'staff'],
  ['src/app/api/drivers/route.ts', 'drivers'],
] as const;

describe('premium route commercial gates', () => {
  for (const [filename, feature] of adminRoutes) {
    it(`${filename} gates every exported HTTP method with ${feature}`, () => {
      const source = readFileSync(path.join(process.cwd(), filename), 'utf8');
      const methods = source.match(/export async function (GET|POST|PATCH|DELETE)\(/g) || [];
      const gateNeedle = `commercialFeatureGate(admin.restaurantId, '${feature}')`;
      const gates = source.split(gateNeedle).length - 1;

      expect(source).toContain('commercial-feature-gate');
      expect(methods.length).toBeGreaterThan(0);
      expect(gates).toBe(methods.length);
    });
  }

  it('gates public and authenticated loyalty rewards by the resolved tenant', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/api/loyalty/rewards/route.ts'), 'utf8');
    expect(source).toContain("commercialFeatureGate(tenant.restaurantId, 'loyalty')");
    expect(source).toContain("commercialFeatureGate(customer.restaurantId, 'loyalty')");
  });

  it('gates all loyalty tier reads and writes', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/api/loyalty/tiers/route.ts'), 'utf8');
    expect(source).toContain("commercialFeatureGate(restaurantId, 'loyalty')");
    expect(source.split("commercialFeatureGate(admin.restaurantId, 'loyalty')").length - 1).toBe(2);
  });

  it('checks driver credentials before revealing a missing paid driver entitlement', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/api/driver-login/route.ts'), 'utf8');
    const passwordCheck = source.indexOf('verifyPassword(password, driver.password)');
    const planGate = source.indexOf("commercialFeatureGate(driver.restaurantId, 'drivers')");
    expect(passwordCheck).toBeGreaterThan(-1);
    expect(planGate).toBeGreaterThan(passwordCheck);
  });
});
