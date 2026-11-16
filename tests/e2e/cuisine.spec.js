// Nutrition : la cuisine. L'ambiance suit le soleil (jour, coucher de soleil, nuit, une image chacun), la balance affiche les calories du jour et propose les façons de noter un
// repas, les bocaux ouvrent « Mes aliments », les tuiles restent là (scanner compris).
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, collectErrors, settle } from './helpers.js';

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

async function open(browser, when) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await offlineThirdParties(context, srv.url);
  await seedLocalStorage(context, buildData());
  const page = await context.newPage();
  await page.clock.install({ time: when || FIXED_NOW });
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await page.waitForLoadState('load'); await page.clock.runFor(1500);
  await page.waitForFunction(() => !!document.querySelector('.wh-sl')); await page.clock.runFor(500);
  await showView(page, 'nutrition'); await page.clock.runFor(800);
  return { context, page, errors };
}

test('la cuisine : image du jour, balance qui affiche les calories, ses quatre façons de noter un repas', async ({ browser }) => {
  const { context, page, errors } = await open(browser);
  const hub = page.locator('#nutHub');
  await expect(hub).toHaveAttribute('data-moment', 'jour');               // mercredi 10 h
  await expect(hub).toHaveAttribute('data-ambiance', 'jour');
  await expect.poll(() => page.locator('#kzImg').evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
  await expect(page.locator('#kzVal b')).toHaveText(/^890$/);             // 890 kcal notées aujourd'hui
  await expect(page.locator('#kzScale')).toBeInViewport();
  await expect(page.locator('#kzJars')).toBeInViewport();
  // les tuiles sont toujours là, le scanner compris
  await expect(hub.locator('.ph-tile b')).toHaveText(['Photo du plat', 'Scanner', 'Ajouter un aliment', 'Mes repas']);
  await expect(hub.locator('.ph-tile[data-act="scan"]')).toBeInViewport();

  // la balance : ce qu'on a mangé
  await page.locator('#kzScale').click();
  const sh = page.locator('.kz-sheet');
  await expect(sh).toBeVisible();
  await expect(sh.locator('.kz-sum')).toHaveText(/890 kcal notées aujourd’hui · il te reste 1\s710 kcal/);
  await expect(sh.locator('.kz-acts b')).toHaveText(['Photo du plat', 'Scanner', 'Chercher', 'Décrire']);
  await expect(sh.locator('.kz-meals')).toContainText('3 notés');
  await sh.locator('[data-k="scan"]').click();
  await expect(page.locator('#scanner')).toBeVisible();
  await page.locator('#scanclose').click();
  // la balance, puis les repas du jour
  await page.locator('#kzScale').click();
  await page.locator('.kz-sheet [data-k="meals"]').click();
  await expect(page.locator('#np-repas')).toBeVisible();
  await page.locator('#v-nutrition .ps [data-back]').click();
  // les bocaux : mes aliments
  await page.locator('#kzJars').click();
  await expect(page.locator('#picker')).toBeVisible();
  expect(errors.filter((e) => !/camera|getUserMedia|NotAllowed|NotFound|Quagga|video/i.test(e))).toEqual([]);
  await context.close();
});

test('la cuisine suit le soleil : coucher de soleil puis nuit, chacun avec son image', async ({ browser }) => {
  // 21 octobre : coucher du soleil vers 18 h 45 à Paris
  const { context, page } = await open(browser, new Date(FIXED_NOW.getFullYear(), FIXED_NOW.getMonth(), FIXED_NOW.getDate(), 18, 0));
  const hub = page.locator('#nutHub');
  await expect(hub).toHaveAttribute('data-moment', 'soir');
  await expect(hub).toHaveAttribute('data-ambiance', 'soir');
  await expect(page.locator('#kzImg')).toHaveAttribute('src', /cuisine-soir/);
  await page.clock.fastForward(2 * 3600_000);                             // 20 h : la nuit tombe d'elle-même
  await page.clock.runFor(1500);
  await expect(hub).toHaveAttribute('data-moment', 'nuit');
  await expect(hub).toHaveAttribute('data-ambiance', 'nuit');
  await expect(page.locator('#kzImg')).toHaveAttribute('src', /cuisine-nuit/);
  await expect.poll(() => page.locator('#kzImg').evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
  await context.close();
});
