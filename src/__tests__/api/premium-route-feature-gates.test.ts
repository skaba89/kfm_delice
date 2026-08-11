import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const routes = [
  ['src/app/api/invoices/route.ts', 'invoices'],
  ['src/app/api/quotes/route.ts', 'quotes'],
  ['src/app/api/expenses/route.ts', 'expenses'],
  ['src/app/api/staff/route.ts', 'staff'],
  ['src/app/api/drivers/route.ts', 'drivers'],
] as const;

describe('premium route commercial gates', () => {
  for (const [filename, feature] of routes) {
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
});
