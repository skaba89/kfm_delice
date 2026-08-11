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

const detailRoutes = [
  ['src/app/api/invoices/[id]/route.ts', 'invoices'],
  ['src/app/api/quotes/[id]/route.ts', 'quotes'],
  ['src/app/api/expenses/[id]/route.ts', 'expenses'],
] as const;

const entitledDriverRoutes = [
  'src/app/api/driver-earnings/route.ts',
  'src/app/api/driver-me/route.ts',
  'src/app/api/driver-orders/route.ts',
  'src/app/api/driver-orders/pending/route.ts',
  'src/app/api/driver-location/route.ts',
  'src/app/api/orders/[id]/accept/route.ts',
  'src/app/api/orders/[id]/reject/route.ts',
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

  for (const [filename, feature] of detailRoutes) {
    it(`${filename} cannot bypass the ${feature} root route`, () => {
      const source = readFileSync(path.join(process.cwd(), filename), 'utf8');
      expect(source).toContain(`commercialFeatureGate(admin.restaurantId, '${feature}')`);
    });
  }

  it('gates public and authenticated loyalty rewards by the resolved tenant', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/api/loyalty/rewards/route.ts'), 'utf8');
    expect(source).toContain("commercialFeatureGate(tenant.restaurantId, 'loyalty')");
    expect(source).toContain("commercialFeatureGate(customer.restaurantId, 'loyalty')");
  });

  it('gates reward and tier detail mutations', () => {
    const rewardSource = readFileSync(path.join(process.cwd(), 'src/app/api/loyalty/rewards/[id]/route.ts'), 'utf8');
    const tierSource = readFileSync(path.join(process.cwd(), 'src/app/api/loyalty/tiers/[id]/route.ts'), 'utf8');
    expect(rewardSource.split("commercialFeatureGate(admin.restaurantId, 'loyalty')").length - 1).toBe(2);
    expect(tierSource).toContain("commercialFeatureGate(admin.restaurantId, 'loyalty')");
  });

  it('gates all loyalty tier reads and writes', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/api/loyalty/tiers/route.ts'), 'utf8');
    expect(source).toContain("commercialFeatureGate(restaurantId, 'loyalty')");
    expect(source.split("commercialFeatureGate(admin.restaurantId, 'loyalty')").length - 1).toBe(2);
  });

  it('gates staff schedule through the shared staff authorization helper', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/api/staff/schedule/route.ts'), 'utf8');
    expect(source).toContain("commercialFeatureGate(admin.restaurantId, 'staff')");
    expect(source.split('authorizeStaffFeature(request)').length - 1).toBe(3);
  });

  it('checks driver credentials before revealing a missing paid driver entitlement', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/api/driver-login/route.ts'), 'utf8');
    const passwordCheck = source.indexOf('verifyPassword(password, driver.password)');
    const planGate = source.indexOf("commercialFeatureGate(driver.restaurantId, 'drivers')");
    expect(passwordCheck).toBeGreaterThan(-1);
    expect(planGate).toBeGreaterThan(passwordCheck);
  });

  for (const filename of entitledDriverRoutes) {
    it(`${filename} revalidates the drivers entitlement for active sessions`, () => {
      const source = readFileSync(path.join(process.cwd(), filename), 'utf8');
      expect(source).toContain('authenticateEntitledDriver');
      expect(source).not.toContain('authenticateDriver(request)');
    });
  }

  it('gates admin-side assignment, nearby search and location access', () => {
    const assign = readFileSync(path.join(process.cwd(), 'src/app/api/orders/[id]/assign/route.ts'), 'utf8');
    const nearby = readFileSync(path.join(process.cwd(), 'src/app/api/drivers/nearby/route.ts'), 'utf8');
    const location = readFileSync(path.join(process.cwd(), 'src/app/api/driver-location/route.ts'), 'utf8');
    expect(assign).toContain("commercialFeatureGate(admin.restaurantId, \"drivers\")");
    expect(nearby).toContain("commercialFeatureGate(admin.restaurantId, \"drivers\")");
    expect(location.split('commercialFeatureGate(admin.restaurantId, "drivers")').length - 1).toBe(2);
  });

  it('gates driver reset/unlock at the shared account-management factory', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/lib/account-management.ts'), 'utf8');
    expect(source).toContain("if (model !== 'driver') return null");
    expect(source).toContain("commercialFeatureGate(restaurantId, 'drivers')");
    expect(source.split('gateModelFeature(admin.restaurantId, model)').length - 1).toBe(2);
  });
});
