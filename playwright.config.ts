/**
 * Mission 10: Playwright config for KFM Delice E2E tests.
 *
 * These tests are BLOCKING — the CI pipeline fails if any test fails.
 * Run with: npx playwright test
 *
 * Test scenarios (from Mission 10 mandatory list):
 *   - Prix client falsifié (rejected)
 *   - Produit inexistant (rejected)
 *   - Réduction client falsifiée (rejected)
 *   - Frais de livraison falsifiés (rejected)
 *   - Statut paid envoyé à la création (rejected)
 *   - customerId d'un autre restaurant (rejected)
 *   - Webhook Stripe sans signature (rejected)
 *   - Restaurant suspendu (rejected)
 *   - Favori d'un autre restaurant (rejected)
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI ? {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  } : undefined,
});
