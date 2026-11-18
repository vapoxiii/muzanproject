// Captures du livre de recettes (pas un test : ignoré sans CAPTURES=1).
//   CAPTURES=1 npx playwright test tests/e2e/zz-recettes-shots.spec.js  ->  .tmp/recettes/*.png
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView } from './helpers.js';

test.skip(!process.env.CAPTURES, 'captures seulement sur demande (CAPTURES=1)');
let srv; test.beforeAll(async () => { srv = await startServer(); }); test.afterAll(async () => { srv && srv.server.close(); });
const OUT = '.tmp/recettes/';

async function open(browser, size) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await offlineThirdParties(context, srv.url);
  await seedLocalStorage(context, buildData());
  const page = await context.newPage();
  await page.clock.install({ time: FIXED_NOW });
  await page.goto(srv.url + '/index.html');
  await page.waitForLoadState('load'); await page.clock.runFor(1500);
  await page.waitForFunction(() => !!document.querySelector('.wh-sl')); await page.clock.runFor(500);
  await showView(page, 'nutrition'); await page.clock.runFor(1200);
  return { context, page };
}
// (l'horloge de la page est figée ; les transitions CSS, elles, suivent le vrai temps)
const shot = async (page, name) => { await page.clock.runFor(450); await page.waitForTimeout(400); await page.screenshot({ path: OUT + name + '.png' }); };

test('livre de recettes', async ({ browser }) => {
  test.setTimeout(180_000);
  mkdirSync(OUT, { recursive: true });
  const small = await open(browser, { width: 375, height: 667 });
  await shot(small.page, '0-cuisine-375'); await small.context.close();

  const { context, page } = await open(browser, { width: 390, height: 844 });
  await shot(page, '1-cuisine');
  await page.locator('#kzBook').click(); await shot(page, '2-livre-vide');
  await page.locator('.rc-empty [data-act="new"]').click();
  const ed = page.locator('.rc-ed');
  await ed.locator('.rc-name input').fill('Bolo maison');
  for (let i = 0; i < 3; i++) await ed.locator('[data-pd="1"]').click();
  await ed.locator('[data-act="add"]').click();
  const pk = page.locator('.rc-pk');
  for (const [q, n] of [['riz', 'Riz cuit'], ['steak', 'Steak haché 5%'], ['huile', "Huile d'olive"]]) {
    await pk.locator('.pk-q input').fill(q); await page.clock.runFor(200); await pk.locator('.pk-it', { hasText: n }).first().click();
  }
  await pk.locator('.pk-q input').fill(''); await page.clock.runFor(200);
  await pk.locator('.pk-q input').blur();
  await shot(page, '3-ingredients');
  await pk.locator('[data-act="new"]').click(); await shot(page, '4-nouvel-aliment');
  await pk.locator('[data-act="close"]').click();
  const rows = ed.locator('.rc-ing');
  await rows.nth(0).locator('input').fill('400'); await rows.nth(1).locator('input').fill('500'); await rows.nth(2).locator('input').fill('2');
  await rows.nth(2).locator('input').blur();
  await ed.locator('.rc-prep-in').fill('Faire revenir la viande hachée avec un oignon, ajouter la sauce tomate, laisser mijoter 20 min. Servir sur le riz.');
  await ed.locator('.pe-body').evaluate((b) => { b.scrollTop = 0; });
  await shot(page, '5-recette');
  await ed.locator('.pe-body').evaluate((b) => { b.scrollTop = b.scrollHeight; });
  await shot(page, '6-recette-bas');
  await ed.locator('[data-act="save"]').click();
  // deux autres recettes, pour voir le livre rempli
  for (const [name, items] of [['Porridge protéiné', [['avoine', "Flocons d'avoine", '80'], ['whey', 'Whey', '30'], ['banane', 'Banane', '1']]], ['Omelette jambon', [['œuf', 'Œuf', '3'], ['jambon', 'Jambon blanc', '2']]]]) {
    await page.locator('.rc-book [data-act="new"]').first().click();
    await ed.locator('.rc-name input').fill(name);
    await ed.locator('[data-act="add"]').click();
    for (const [q, n] of items) { await pk.locator('.pk-q input').fill(q); await page.clock.runFor(200); await pk.locator('.pk-it', { hasText: n }).first().click(); }
    await pk.locator('[data-act="close"]').click();
    for (let i = 0; i < items.length; i++) await ed.locator('.rc-ing').nth(i).locator('input').fill(items[i][2]);
    await ed.locator('[data-act="save"]').click();
  }
  await page.locator('.rc-book .rc-card', { hasText: 'Bolo maison' }).locator('.rc-log').click();
  await page.clock.runFor(200);
  await shot(page, '7-livre');
  await page.clock.runFor(2500);
  await page.locator('.rc-book .rc-card', { hasText: 'Bolo maison' }).locator('.rc-open').click();
  await shot(page, '8-page-recette');
  await page.locator('.rc-sheet [data-act="close"]').click();
  await page.locator('.rc-book [data-act="close"]').first().click();
  await page.clock.runFor(2500);
  await page.locator('#kzScale').click(); await shot(page, '9-balance');
  await page.keyboard.press('Escape');
  await page.locator('#kzJars').click(); await shot(page, '10-recherche');
  await expect(page.locator('#foodresults .fr').first()).toContainText(/Bolo|Omelette|Porridge/);
  await context.close();
});
