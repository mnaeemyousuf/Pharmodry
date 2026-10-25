import { defineConfig } from '@playwright/test';

/**
 * Browser E2E tests. Run through the isolated environment runner so they never touch demo data:
 *   npm run test:ui   (root)  →  node infrastructure/test-env.mjs -- npx playwright test
 * Uses the system Microsoft Edge (channel msedge); set PW_CHANNEL=chromium to use a downloaded Chromium.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 300_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3101',
    channel: process.env.PW_CHANNEL ?? 'msedge',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 20_000,
  },
});
