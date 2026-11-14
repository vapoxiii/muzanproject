// Photo du plat : la photo part réduite avec la demande, l'IA (simulée) liste les aliments vus,
// on décoche ce qui n'y est pas, on choisit les quantités, le repas s'ajoute à la journée.
// La photo n'est gardée nulle part. Sans repas sur la photo : un message clair.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, showSub, collectErrors, settle, readIDB } from './helpers.js';
import { PLATE } from '../fixtures/ai-plate.js';

const INDEX = JSON.parse(readFileSync(new URL('../../src/training/illus-index.json', import.meta.url), 'utf8'));
const PHOTO = { name: 'assiette.webp', mimeType: 'image/webp', buffer: readFileSync(new URL('../../public/exos/' + Object.values(INDEX)[0], import.meta.url)) };

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

test('photo du plat : liste des aliments vus, quantités, ajout à la journée', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await offlineThirdParties(context, srv.url);
  // après offlineThirdParties : l'IA simulée remplace le blocage d'Anthropic
  const asked = [];
  let reply = PLATE;
  await context.route('https://api.anthropic.com/v1/messages', (r) => {
    asked.push(JSON.parse(r.request().postData()));
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }], stop_reason: 'end_turn' }) });
  });
  const data = buildData();
  data['ai:key'] = 'sk-ant-test';
  await seedLocalStorage(context, data);
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await settle(page, 1200);
  await showView(page, 'nutrition');
  const rows = page.locator('#meallog .ml');
  const before = await rows.count();

  // la tuile « Photo du plat », à l'entrée de la Nutrition, ouvre le choix de la photo
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#v-nutrition .ph-tile[data-act="photo"]')]);
  await chooser.setFiles(PHOTO);
  await expect(page.locator('.plate-t')).toHaveText('4 aliments repérés · 3 gardés');

  // la demande : la photo réduite en JPEG, puis la consigne
  expect(asked).toHaveLength(1);
  const content = asked[0].messages[0].content;
  expect(content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg' } });
  expect(content[0].source.data.length).toBeGreaterThan(1000);
  expect(content[1].type).toBe('text');
  expect(content[1].text).toContain('photo d\'un repas');
  expect(asked[0].max_tokens).toBe(2000);

  // ce que l'IA voit : à cocher ; l'huile, devinée, n'est pas comptée d'office
  const items = page.locator('#aistep2 .pi');
  await expect(items.locator('.pi-n')).toHaveText(['Riz blanc cuit', 'Blanc de poulet grillé', 'Brocolis vapeur', 'Huile ou beurre de cuissonpeut-être']);
  await expect(items.nth(3)).toHaveClass(/off/);
  await expect(items.nth(0).locator('.pi-k')).toHaveText('195 kcal');
  await expect(page.locator('#aiestim .ev')).toHaveText('461 kcal');
  await expect(page.locator('#aiestim .ep')).toHaveText('50 g de protéines · 46 g de glucides · 6 g de lipides');

  // pas de brocolis ; de l'huile, une cuillère à soupe ; plus de riz
  await items.nth(2).locator('.pi-h').click();
  await expect(items.nth(2)).toHaveClass(/off/);
  await expect(page.locator('#aiestim .ev')).toHaveText('426 kcal');
  await items.nth(3).locator('.pi-h').click();
  await items.nth(3).locator('.qopts button', { hasText: '1 c. à soupe' }).click();
  await items.nth(0).locator('.qopts button', { hasText: '220 g' }).click();
  await expect(items.nth(0).locator('.pi-k')).toHaveText('286 kcal');
  await expect(page.locator('#aiestim .ev')).toHaveText('607 kcal');
  await expect(page.locator('.plate-t')).toHaveText('4 aliments repérés · 3 gardés');

  await page.locator('#aistep2 > .aibtn').click();
  await expect(page.locator('#aimodal')).toBeHidden();
  await expect(rows).toHaveCount(before + 1);
  const row = rows.filter({ hasText: 'Poulet, riz et brocolis' });
  await expect(row.locator('.mk')).toHaveText('607 kcal');
  await expect(row.locator('.mmc')).toHaveText('P 49 · G 62 · L 16');
  // la photo n'est gardée nulle part
  const idb = await readIDB(page);
  expect(JSON.stringify(idb)).not.toContain(content[0].source.data.slice(0, 200));

  // une photo sans repas (depuis Mes repas, bouton Photo) : un message clair, reprendre une photo ou décrire
  reply = { nom: '', aliments: [] };
  await showSub(page, 'nutrition', 'repas');
  const [again] = await Promise.all([page.waitForEvent('filechooser'), page.click('#aiphotoBtn')]);
  await again.setFiles(PHOTO);
  await expect(page.locator('#aistep2')).toContainText('Je ne vois pas de repas sur cette photo');
  await page.locator('#aistep2 .aisec', { hasText: 'Décrire mon repas' }).click();
  await expect(page.locator('#aitext')).toBeVisible();
  await expect(page.locator('#aiphoto2')).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});
