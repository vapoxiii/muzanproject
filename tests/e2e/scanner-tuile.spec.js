// Nutrition : la tuile « Scanner » est sur l'entrée et ouvre le scanner de code-barres.
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, collectErrors, settle } from './helpers.js';

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

for (const vp of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
  test(`nutrition : tuile Scanner visible et active (${vp.width}×${vp.height})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
    await offlineThirdParties(context, srv.url);
    await seedLocalStorage(context, buildData());
    const page = await context.newPage();
    await page.clock.setFixedTime(FIXED_NOW);
    const errors = collectErrors(page);
    await page.goto(srv.url + '/index.html');
    await settle(page, 1200);
    await showView(page, 'nutrition');
    await settle(page, 700);
    const tile = page.locator('#nutHub .ph-tile[data-act="scan"]');
    await expect(tile).toBeInViewport();
    await page.screenshot({ path: `test-results/nutrition-scan-${vp.width}.png` });
    await tile.click();
    await expect(page.locator('#scanner')).toBeVisible();
    expect(errors.filter((e) => !/camera|getUserMedia|NotAllowed|NotFound|Quagga|video/i.test(e))).toEqual([]);
    await context.close();
  });
}
