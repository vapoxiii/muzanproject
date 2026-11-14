import { defineConfig } from '@playwright/test';

// Tests de bout en bout avec compte et synchronisation, sur un serveur local
// (npm run test:e2e:cloud — nécessite MS_PG et MS_POSTGREST, voir README).
export default defineConfig({
  testDir: 'tests/e2e-cloud',
  globalSetup: './tests/e2e-cloud/global-setup.js',
  timeout: 120_000,
  expect: { timeout: 15_000 },
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
