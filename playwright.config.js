import { defineConfig } from '@playwright/test';

// Tests de bout en bout sur l'app construite (npm run build avant).
// Navigateur : Chromium de Playwright (variable PLAYWRIGHT_BROWSERS_PATH si besoin).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    serviceWorkers: 'block',
  },
});
