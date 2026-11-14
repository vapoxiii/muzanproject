// Glucides et lipides : aliments de base complétés à la reprise, totaux du jour et repères dans la
// carte de la Nutrition, aliment sans ces valeurs signalé puis complété depuis « Gérer mes aliments ».
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, showSub, collectErrors, settle, readIDB } from './helpers.js';

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

test('glucides et lipides : repères du jour, aliment à compléter, aliments de base repris', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await offlineThirdParties(context, srv.url);
  await seedLocalStorage(context, buildData());
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await settle(page, 1200);
  await showView(page, 'nutrition');
  await showSub(page, 'nutrition', 'repas');

  // aujourd'hui : flocons d'avoine, whey (aliments de base) et un bowl créé sans glucides ni lipides.
  // Objectif 2 600 kcal (base 2 350 + muscu) : lipides 30 % = 87 g, glucides = le reste = 299 g.
  await expect(page.locator('#calProtV')).toHaveText('74 / 155 g');
  await expect(page.locator('#calGlucV')).toHaveText('26 / 299 g');
  await expect(page.locator('#calLipV')).toHaveText('4 / 87 g');
  await expect(page.locator('#calMacN')).toBeVisible();
  await expect(page.locator('#calMacN')).toContainText('1 aliment sans glucides ni lipides');
  const rows = page.locator('#meallog .ml');
  await expect(rows.filter({ hasText: 'Flocons' }).locator('.mmc')).toHaveText('P 5 · G 23 · L 3');
  await expect(rows.filter({ hasText: 'Bowl poulet riz' }).locator('.mmc')).toHaveText('P 45 · G – · L –');

  // le compléter depuis la liste des aliments
  await page.click('#openpick');
  await page.click('#managetgl');
  await page.locator('#managelist .mgr', { hasText: 'Bowl poulet riz' }).locator('.mgb').first().click();
  await expect(page.locator('#nf_n')).toHaveValue('Bowl poulet riz');
  await expect(page.locator('#nf_g')).toHaveValue('');
  await page.fill('#nf_g', '70');
  await page.fill('#nf_l', '18,5');
  await page.click('#nf_save');
  await page.keyboard.press('Escape');
  await expect(page.locator('#picker')).toBeHidden();
  await expect(rows.filter({ hasText: 'Bowl poulet riz' }).locator('.mmc')).toHaveText('P 45 · G 70 · L 19');
  await expect(page.locator('#calGlucV')).toHaveText('96 / 299 g');
  await expect(page.locator('#calLipV')).toHaveText('23 / 87 g');
  await expect(page.locator('#calMacN')).toBeHidden();

  // les repères sont expliqués dans Objectif
  await showSub(page, 'nutrition', 'objectif');
  await expect(page.locator('#calRep')).toHaveText('Repères du jour : 155 g de protéines, 87 g de lipides (30 % des calories) et 299 g de glucides (le reste).');

  // les aliments de base enregistrés avant (sans glucides ni lipides) ont reçu leurs valeurs
  const idb = await readIDB(page);
  const lib = JSON.parse(idb.kv.find((r) => r.k === 'foodlib').v);
  expect(lib.find((f) => f.id === 'f8')).toMatchObject({ g: 23, l: 2.8 });
  expect(lib.find((f) => f.id === 'c1760000000001')).toMatchObject({ g: 70, l: 18.5 });
  expect(lib.find((f) => f.id === 'c1760000000002').g).toBeUndefined();   // créé par l'utilisateur : rien d'inventé
  expect(errors).toEqual([]);
  await context.close();
});
