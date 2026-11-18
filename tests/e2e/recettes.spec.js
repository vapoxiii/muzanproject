// Nutrition : le livre de recettes. On écrit une recette une fois (ingrédients de Mes aliments, parts), on en
// note une part en un geste (le livre, la balance), la recherche d'aliments la propose ; la modifier ou la
// supprimer ne change pas les jours déjà notés.
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, collectErrors } from './helpers.js';

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

async function open(browser, size = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport: size, hasTouch: true, isMobile: true });
  await offlineThirdParties(context, srv.url);
  await seedLocalStorage(context, buildData());
  const page = await context.newPage();
  await page.clock.install({ time: FIXED_NOW });
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await page.waitForLoadState('load'); await page.clock.runFor(1500);
  await page.waitForFunction(() => !!document.querySelector('.wh-sl')); await page.clock.runFor(500);
  await showView(page, 'nutrition'); await page.clock.runFor(800);
  return { context, page, errors };
}
const today = () => { const d = FIXED_NOW; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// valeur enregistrée par l'app (IndexedDB, base « mon-suivi »)
const store = (page, k) => page.evaluate((k) => new Promise((resolve, reject) => {
  const r = indexedDB.open('mon-suivi');
  r.onerror = () => reject(r.error);
  r.onsuccess = () => {
    const db = r.result, g = db.transaction('kv').objectStore('kv').get(k);
    g.onerror = () => reject(g.error);
    g.onsuccess = () => { db.close(); const v = g.result; resolve(v && !v.del && v.v != null ? JSON.parse(v.v) : null); };
  };
}), k);

async function pick(page, query, name) {
  const pk = page.locator('.rc-pk');
  await pk.locator('.pk-q input').fill(query); await page.clock.runFor(200);
  await pk.locator('.pk-it', { hasText: name }).first().click();
  await expect(pk.locator('.pk-it.on', { hasText: name })).toHaveCount(1);
}

test('écrire une recette, en noter une part en un geste, la retrouver partout', async ({ browser }) => {
  const { context, page, errors } = await open(browser);
  // les ustensiles de la cuisine : l'étiquette « Mes recettes », à côté de « Mes aliments » sans la toucher
  const book = page.locator('#kzBook .kz-chip'), jars = page.locator('#kzJars .kz-chip');
  await expect(book).toBeInViewport();
  const [a, b] = [await jars.boundingBox(), await book.boundingBox()];
  expect(a.x + a.width).toBeLessThan(b.x);
  await page.locator('#kzBook').click();
  const bk = page.locator('.rc-book');
  await expect(bk.locator('.rc-empty')).toBeVisible();
  await bk.locator('.rc-empty [data-act="new"]').click();

  // la recette : nom, 4 parts, trois ingrédients pris dans Mes aliments
  const ed = page.locator('.rc-ed');
  await expect(ed).toBeVisible();
  await ed.locator('.rc-name input').fill('Bolo maison');
  for (let i = 0; i < 3; i++) await ed.locator('[data-pd="1"]').click();
  await expect(ed.locator('.rc-parts .qty span')).toHaveText('4');
  await ed.locator('[data-act="add"]').click();
  await pick(page, 'riz', 'Riz cuit');
  await pick(page, 'steak', 'Steak haché 5%');
  await pick(page, 'huile', "Huile d'olive");
  await expect(page.locator('.rc-pk .pk-n')).toContainText('3 ajoutés');
  await page.locator('.rc-pk [data-act="close"]').click();
  const rows = ed.locator('.rc-ing');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).locator('input')).toBeFocused();              // la quantité du premier, à taper
  await expect(rows.nth(0).locator('.rc-qi span')).toHaveText('g');
  await expect(rows.nth(2).locator('.rc-qi span')).toHaveText('× 1 c. à soupe');
  await rows.nth(0).locator('input').fill('400');
  await rows.nth(1).locator('input').fill('500');
  await rows.nth(2).locator('input').fill('2');
  // 400 g de riz (520) + 500 g de steak (650) + 2 c. à soupe d'huile (238) = 1 408 kcal, 352 la part
  await expect(ed.locator('.rc-tot-all')).toContainText(/1\s408 kcal/);
  await expect(ed.locator('.rc-tot-v b')).toHaveText('352');
  await ed.locator('.rc-prep-in').fill('Faire revenir la viande, ajouter le riz.');
  await ed.locator('[data-act="save"]').click();
  await expect(ed).toHaveCount(0);

  // le livre : la recette, une part en un geste
  const card = bk.locator('.rc-card', { hasText: 'Bolo maison' });
  await expect(card).toContainText('352 kcal la part');
  await expect(card).toContainText('4 parts');
  await card.locator('.rc-log').click();
  await expect(page.locator('#trToast')).toContainText('Bolo maison : 1 part notée, 352 kcal');
  let log = (await store(page, 'foodlog'))[today()];
  const lib = await store(page, 'foodlib');
  const food = lib.find((f) => f.rec);
  expect(food).toMatchObject({ n: 'Bolo maison', k: 352, u: '1 part' });
  expect(log.find((e) => e.fid === food.id)).toEqual({ fid: food.id, q: 1 });
  const rec = (await store(page, 'recettes'))[0];
  expect(rec).toMatchObject({ n: 'Bolo maison', parts: 4, fid: food.id, prep: 'Faire revenir la viande, ajouter le riz.' });
  expect(rec.items.map((i) => [i.n, i.q])).toEqual([['Riz cuit', 4], ['Steak haché 5%', 5], ["Huile d'olive", 2]]);

  // la page de la recette : ses ingrédients, une part et demie
  await card.locator('.rc-open').click();
  const sh = page.locator('.rc-sheet');
  await expect(sh.locator('.rc-ings li')).toHaveText([/Riz cuit\s*400 g/, /Steak haché 5%\s*500 g/, /Huile d'olive\s*2 × 1 c\. à soupe/]);
  await expect(sh.locator('.rc-prep')).toHaveText('Faire revenir la viande, ajouter le riz.');
  await sh.locator('[data-d="1"]').click();
  await expect(sh.locator('.rc-eat .qty span')).toHaveText('1,5 part');
  await sh.locator('[data-act="eat"]').click();
  log = (await store(page, 'foodlog'))[today()];
  expect(log.find((e) => e.fid === food.id).q).toBe(2.5);
  await bk.locator('[data-act="close"]').first().click();
  await expect(bk).toHaveCount(0);
  await expect(page.locator('#kzVal b')).toHaveText(/1\s770/);             // 890 + 2,5 × 352

  // la balance : la recette en un geste
  await page.locator('#kzScale').click();
  const scale = page.locator('.kz-sheet');
  await expect(scale.locator('.kz-rc-l .qchip')).toHaveText([/Bolo maison\s*352/]);
  await expect(scale.locator('.kz-rcrow')).toContainText('1 recette');
  await scale.locator('.kz-rc-l .qchip').click();
  log = (await store(page, 'foodlog'))[today()];
  expect(log.find((e) => e.fid === food.id).q).toBe(3.5);

  // la recherche d'aliments : les recettes d'abord ; « Gérer mes aliments » ne les montre pas
  await page.locator('#kzJars').click();
  await expect(page.locator('#foodresults .fr').first()).toContainText('Bolo maison');
  await expect(page.locator('#foodresults .fr').first().locator('.fr-rc')).toHaveText('Recette');
  await page.locator('#managetgl').click();
  await expect(page.locator('#managelist .mgr', { hasText: 'Bolo maison' })).toHaveCount(0);
  await page.locator('#pickclose').click();

  // modifier une recette déjà notée : les jours notés gardent leurs calories
  await page.locator('#kzBook').click();
  await bk.locator('.rc-card .rc-open').click();
  await page.locator('.rc-sheet [data-act="edit"]').click();
  await ed.locator('[data-pd="1"]').click();                              // 5 parts : 282 kcal la part
  await expect(ed.locator('.rc-tot-v b')).toHaveText('282');
  await ed.locator('[data-act="save"]').click();
  await expect(bk.locator('.rc-card')).toContainText('282 kcal la part');
  const lib2 = await store(page, 'foodlib');
  const versions = lib2.filter((f) => f.rec === rec.id);
  expect(versions.map((f) => [f.k, !!f.old])).toEqual([[352, true], [282, false]]);
  await bk.locator('.rc-log').click();
  log = (await store(page, 'foodlog'))[today()];
  expect(log.filter((e) => versions.some((v) => v.id === e.fid)).map((e) => e.q)).toEqual([3.5, 1]);

  // la supprimer : elle quitte le livre et la recherche, les repas notés restent
  await bk.locator('.rc-card .rc-open').click();
  await page.locator('.rc-sheet [data-act="edit"]').click();
  await ed.locator('[data-act="del"]').click();
  await page.locator('.tr-ask [data-a="1"]').click();
  await expect(bk.locator('.rc-empty')).toBeVisible();
  expect(await store(page, 'recettes')).toEqual([]);
  const lib3 = await store(page, 'foodlib');
  expect(lib3.filter((f) => f.rec).every((f) => f.old)).toBe(true);
  await bk.locator('[data-act="close"]').first().click();
  await page.locator('#nutHub .ph-tile[data-sub="repas"]').click();
  await expect(page.locator('#meallog .ml .mn', { hasText: 'Bolo maison' })).toHaveCount(2);
  await expect(page.locator('#quickrow .qchip', { hasText: 'Bolo maison' })).toHaveCount(0);
  await page.locator('#openpick').click();
  await expect(page.locator('#foodresults .fr', { hasText: 'Bolo maison' })).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.close();
});

test('quitter une recette en cours : on demande avant de perdre ce qui est écrit', async ({ browser }) => {
  const { context, page, errors } = await open(browser);
  await page.locator('#kzBook').click();
  await page.locator('.rc-book [data-act="new"]').first().click();
  const ed = page.locator('.rc-ed');
  await ed.locator('.rc-name input').fill('Porridge');
  await page.keyboard.press('Escape');
  await expect(page.locator('.tr-ask')).toContainText('Quitter sans enregistrer ?');
  await page.locator('.tr-ask [data-a="0"]').click();                     // Rester
  await expect(ed.locator('.rc-name input')).toHaveValue('Porridge');
  // sans ingrédient : refusé, avec la raison
  await ed.locator('[data-act="save"]').click();
  await expect(page.locator('#trToast')).toHaveText('Ajoute au moins un ingrédient');
  await ed.locator('[data-act="close"]').click();
  await page.locator('.tr-ask [data-a="1"]').click();                     // Quitter
  await expect(ed).toHaveCount(0);
  expect(await store(page, 'recettes')).toBeNull();
  expect(errors).toEqual([]);
  await context.close();
});

test('petit écran : les deux étiquettes de la cuisine restent lisibles et séparées', async ({ browser }) => {
  for (const size of [{ width: 375, height: 667 }, { width: 430, height: 932 }]) {
    const { context, page } = await open(browser, size);
    const [a, b] = [await page.locator('#kzJars .kz-chip').boundingBox(), await page.locator('#kzBook .kz-chip').boundingBox()];
    expect(a.x + a.width).toBeLessThan(b.x);
    expect(b.x + b.width).toBeLessThanOrEqual(size.width);
    await context.close();
  }
});
