// Scanner : caméra simulée de Chromium qui montre un code-barres EAN-13, réponse d'Open Food Facts
// simulée. On vérifie la lecture du code, les valeurs pour 100 g (dont glucides et lipides), le
// calcul pour la quantité choisie et l'aliment ajouté à la journée.
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, showSub, collectErrors, settle, readIDB } from './helpers.js';

const CODE = '3017620422003';

// Vidéo Y4M (format lu par la caméra simulée) : le code-barres en noir sur fond clair
function barcodeVideo(code) {
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
  const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
  const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  const d = [...code].map(Number);
  const bits = '101' + d.slice(1, 7).map((x, i) => (PAR[d[0]][i] === 'L' ? L : G)[x]).join('') + '01010' + d.slice(7).map((x) => R[x]).join('') + '101';
  const W = 480, H = 360, mod = 3, bh = 200, x0 = (W - bits.length * mod) >> 1, y0 = (H - bh) >> 1;
  const y = Buffer.alloc(W * H, 235);
  for (let i = 0; i < bits.length; i++) if (bits[i] === '1') for (let r = y0; r < y0 + bh; r++) y.fill(16, r * W + x0 + i * mod, r * W + x0 + (i + 1) * mod);
  const uv = Buffer.alloc((W / 2) * (H / 2), 128);
  const file = join(tmpdir(), `ms-ean-${code}.y4m`);
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), Buffer.from('FRAME\n'), y, uv, uv]));
  return file;
}

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + barcodeVideo(CODE)] } });

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

test('scanner : code lu, valeurs pour 100 g avec glucides et lipides, ajout pour la quantité choisie', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
  await offlineThirdParties(context, srv.url);
  // après offlineThirdParties : cette réponse remplace le blocage d'Open Food Facts
  let asked = '';
  await context.route('https://world.openfoodfacts.org/**', (r) => {
    asked = r.request().url();
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 1, product: {
      code: CODE, product_name: 'Pâte à tartiner', brands: 'Marque, Autre', serving_quantity: '15',
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
    } }) });
  });
  await seedLocalStorage(context, buildData());
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await settle(page, 1200);
  await showView(page, 'nutrition');
  await showSub(page, 'nutrition', 'repas');
  const rows = page.locator('#meallog .ml');
  const before = await rows.count();

  await page.click('#scanOpen');
  await expect(page.locator('.sr-name')).toHaveText('Pâte à tartiner', { timeout: 20000 });
  expect(asked).toContain('/product/' + CODE + '.json');
  await expect(page.locator('.sr-brand')).toHaveText('Marque');
  await expect(page.locator('.sr-per')).toHaveText('539 kcal pour 100 g');
  await expect(page.locator('.sr-mac')).toHaveText('Protéines 6,3 gGlucides 57,5 gLipides 30,9 g');
  // une portion de 15 g est proposée par défaut
  await expect(page.locator('#scanqty')).toHaveValue('15');
  await page.fill('#scanqty', '40');
  await expect(page.locator('#srK')).toHaveText('216');
  await expect(page.locator('#srG')).toHaveText('23');
  await expect(page.locator('#srL')).toHaveText('12,4');
  await page.click('#scanAdd');
  await expect(page.locator('#scanner')).toBeHidden();
  await expect(rows).toHaveCount(before + 1);
  const row = rows.filter({ hasText: 'Pâte à tartiner' });
  await expect(row.locator('.mn')).toHaveText('Pâte à tartiner · 40 g');
  await expect(row.locator('.mmc')).toHaveText('P 3 · G 23 · L 12');

  const lib = JSON.parse((await readIDB(page)).kv.find((r) => r.k === 'foodlib').v);
  expect(lib.find((f) => f.bc === CODE && f.u === '40 g')).toMatchObject({ k: 216, p: 2.5, g: 23, l: 12.4 });
  expect(errors).toEqual([]);
  await context.close();
});

test('scanner dans une recette : le produit rejoint la recette avec sa quantité, au-dessus de la recette', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
  await offlineThirdParties(context, srv.url);
  await context.route('https://world.openfoodfacts.org/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 1, product: {
    code: CODE, product_name: 'Pâte à tartiner', brands: 'Marque', serving_quantity: '15',
    nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
  } }) }));
  await seedLocalStorage(context, buildData());
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await settle(page, 1200);
  await showView(page, 'nutrition');
  await page.locator('#kzBook').click();
  await page.locator('.rc-book [data-act="new"]').first().click();
  const ed = page.locator('.rc-ed');
  await ed.locator('.rc-name input').fill('Crêpes');
  await ed.locator('[data-act="add"]').click();
  await page.locator('.rc-pk [data-act="scan"]').click();
  await expect(page.locator('#scanner')).toHaveClass(/rc-top/);
  await expect(page.locator('.sr-name')).toHaveText('Pâte à tartiner', { timeout: 20000 });
  await expect(page.locator('#scanAdd')).toHaveText('Ajouter à la recette');
  await page.fill('#scanqty', '40');
  await page.click('#scanAdd');                      // (cliquable : le scanner est bien au-dessus de la recette)
  await expect(page.locator('#scanner')).toBeHidden();
  const row = ed.locator('.rc-ing');
  await expect(row).toHaveCount(1);
  await expect(row.locator('.rc-ing-t b')).toHaveText('Pâte à tartiner');
  await expect(row.locator('input')).toHaveValue('40');
  await expect(row.locator('.rc-ing-t span')).toHaveText('216 kcal · P 3 · G 23 · L 12');
  await ed.locator('[data-act="save"]').click();
  await expect(ed).toHaveCount(0);
  const kv = (await readIDB(page)).kv;
  const lib = JSON.parse(kv.find((r) => r.k === 'foodlib').v);
  expect(lib.find((f) => f.bc === CODE && f.u === '100 g')).toMatchObject({ n: 'Pâte à tartiner', k: 539, p: 6.3, g: 57.5, l: 30.9 });
  expect(JSON.parse(kv.find((r) => r.k === 'recettes').v)[0].items[0]).toMatchObject({ n: 'Pâte à tartiner', u: '100 g', q: 0.4 });
  // ensuite, le scanner de la journée redevient celui d'avant
  await page.locator('.rc-book [data-act="close"]').first().click();
  await page.locator('#nutHub .ph-tile[data-act="scan"]').click();
  await expect(page.locator('#scanner')).not.toHaveClass(/rc-top/);
  await expect(page.locator('#scanAdd')).toHaveText('Ajouter à ma journée', { timeout: 20000 });
  expect(errors).toEqual([]);
  await context.close();
});
