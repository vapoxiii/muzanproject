// Captures de la cuisine (contrôle visuel, ignoré sans CAPTURES=1) : .tmp/planche/cuisine-*.png
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, settle } from './helpers.js';
test.skip(!process.env.CAPTURES, 'captures seulement sur demande (CAPTURES=1)');
let srv; test.beforeAll(async () => { srv = await startServer(); }); test.afterAll(async () => { srv && srv.server.close(); });
const at = (h, m = 0) => new Date(FIXED_NOW.getFullYear(), FIXED_NOW.getMonth(), FIXED_NOW.getDate(), h, m);
for (const [nom, quand, w, h] of [['jour', at(10), 390, 844], ['soir', at(18), 390, 844], ['nuit', at(21), 390, 844], ['jour-petit', at(10), 375, 667], ['nuit-iphone', at(21), 393, 797]]) {
  test(`cuisine ${nom} ${w}×${h}`, async ({ browser }) => {
    mkdirSync('.tmp/planche', { recursive: true });
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await offlineThirdParties(context, srv.url); await seedLocalStorage(context, buildData());
    const page = await context.newPage(); await page.clock.setFixedTime(quand);
    await page.goto(srv.url + '/index.html'); await settle(page, 1500);
    if (nom === 'nuit-iphone') await page.evaluate(() => document.documentElement.classList.add('pwa-short'));
    await showView(page, 'nutrition'); await settle(page, 900);
    await expect.poll(() => page.locator('#kzImg').evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
    await settle(page, 300);
    await page.screenshot({ path: `.tmp/planche/cuisine-${nom}.png` });
    if (nom === 'jour') {
      await page.locator('#kzScale').click(); await expect(page.locator('.kz-sheet')).toBeVisible(); await settle(page, 500);
      await page.screenshot({ path: '.tmp/planche/cuisine-balance.png' });
    }
    await context.close();
  });
}
