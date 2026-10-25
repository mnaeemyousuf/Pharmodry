import { defineConfig } from '@playwright/test';

/**
 * Captures genuine screenshots of the running application for the role-based user manuals.
 * Run from the repository root (fresh, seeded, isolated environment):
 *   npm run manuals:capture
 * Output: docs/USER_MANUALS/SCREENSHOTS/<role>/*.png and SCREENSHOTS/manifest.json
 */
export default defineConfig({
  testDir: '.',
  testMatch: /capture\.spec\.ts/,
  timeout: 3_600_000,
  globalSetup: './capture.setup.ts',
  expect: { timeout: 15_000 },
  workers: 3,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3101',
    channel: process.env.PW_CHANNEL ?? 'msedge',
    viewport: { width: 1366, height: 860 },
    deviceScaleFactor: 1.5,
    colorScheme: 'light',
    actionTimeout: 20_000,
  },
});
