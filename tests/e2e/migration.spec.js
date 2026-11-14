// Reprise des données : de l'ancienne app (localStorage) vers la nouvelle (IndexedDB),
// et compatibilité des fichiers de sauvegarde dans les deux sens.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildData, FIXED_NOW, dayStr } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, viewText, dataSnapshot, collectErrors, settle, readIDB, VIEWS } from './helpers.js';

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

async function newPage(browser, { seed = null } = {}) {
  const context = await browser.newContext({ acceptDownloads: true });
  await offlineThirdParties(context, srv.url);
  if (seed) await seedLocalStorage(context, seed);
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  page.on('dialog', (d) => d.accept());
  return { context, page };
}

// Les valeurs affichées dans les cinq onglets (mêmes chiffres d'une version à l'autre)
async function allData(page) {
  for (const v of VIEWS) await showView(page, v);
  return dataSnapshot(page);
}
function sameData(a, b) { for (const k of Object.keys(b)) expect.soft(a[k], k).toEqual(b[k]); }

test('première ouverture de la nouvelle version : tout est repris, rien n’est perdu', async ({ browser }) => {
  const { context, page } = await newPage(browser, { seed: buildData() });
  // l'ancienne app tourne d'abord et enregistre une nouvelle pesée
  await page.goto(srv.url + '/old/mon-suivi-app.html');
  await settle(page);
  await showView(page, 'progress');
  await page.fill('#in_w', '76,2');
  await page.click('#addm');
  const oldData = await allData(page);
  expect(oldData.hist[0]).toContain('76.2');

  // puis la nouvelle version, à la même adresse
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await settle(page, 1500);
  const newData = await allData(page);
  sameData(newData, oldData);
  expect(errors).toEqual([]);

  const idb = await readIDB(page);
  const kv = Object.fromEntries(idb.kv.map((r) => [r.k, r]));
  expect(JSON.parse(kv.bodylog.v).find((e) => e.d === dayStr(0)).w).toBe(76.2);
  expect(kv['ai:key'].v).toContain('sk-ant-test');        // reste sur le téléphone…
  expect(kv['ai:key'].dirty).toBe(false);                 // …mais ne sera jamais synchronisée
  expect(kv.bodylog.dirty).toBe(true);
  expect(kv.photos).toBeUndefined();                       // les photos ne sont plus du texte
  expect(idb.photos).toHaveLength(2);
  for (const p of idb.photos) { expect(p.blob.type).toBe('image/jpeg'); expect(p.blob.size).toBeGreaterThan(3000); expect(p.id).toMatch(/^p[0-9a-f]{16}$/); }
  const mig = idb.sys.find((r) => r.k === 'migratedFromLS');
  expect(mig.v.photos).toBe(2);
  expect(mig.v.keys).toBeGreaterThan(10);

  // l'ancien stockage n'est pas effacé (retour arrière possible), mais n'est plus lu
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await settle(page, 1500);
  sameData(await allData(page), newData);

  // une modification dans la nouvelle version survit au rechargement (le poids est dans Corps)
  await showView(page, 'body');
  await page.fill('#in_w', '75,9');
  await page.click('#addm');
  await page.waitForTimeout(300);
  await page.reload();
  await settle(page, 1500);
  await showView(page, 'body');
  expect(await viewText(page, 'body')).toContain('75,9 kg');
  await context.close();
});

test('une sauvegarde de l’ancienne app se restaure dans la nouvelle (photos comprises)', async ({ browser }) => {
  // export depuis l'ancienne app
  const seed = buildData(); delete seed['ai:key'];     // la clé IA n'est jamais dans une sauvegarde
  const a = await newPage(browser, { seed });
  await a.page.goto(srv.url + '/old/mon-suivi-app.html');
  await settle(a.page);
  const oldData = await allData(a.page);
  await showView(a.page, 'profile');
  const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#bkExport')]);
  const file = join(tmpdir(), `ms-sauvegarde-${Date.now()}.json`);   // chemin sans accents (envoi de fichier)
  await dl.saveAs(file);
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  expect(exported.data['ai:key']).toBeUndefined();
  await a.context.close();

  // restauration dans une nouvelle version vierge (autre appareil)
  const b = await newPage(browser);
  await b.page.goto(srv.url + '/index.html');
  await settle(b.page);
  await b.page.evaluate(() => { const o = document.getElementById('onb'); if (o) o.hidden = true; });
  await showView(b.page, 'profile');
  await b.page.evaluate(() => { window.__avant = 1; });
  await b.page.setInputFiles('#bkFile', file);
  await b.page.click('.tr-ask [data-a="1"]');           // confirmation dans l'app (plus de fenêtre du navigateur)
  await b.page.waitForFunction(() => !window.__avant && document.readyState === 'complete', null, { timeout: 15000 });
  await settle(b.page, 1500);
  sameData(await allData(b.page), oldData);
  const idb = await readIDB(b.page);
  expect(idb.photos.filter((p) => !p.del)).toHaveLength(2);
  await b.context.close();
});

test('une sauvegarde de la nouvelle version se restaure dans l’ancienne app', async ({ browser }) => {
  const seed = buildData(); delete seed['ai:key'];
  const a = await newPage(browser, { seed });
  await a.page.goto(srv.url + '/index.html');
  await settle(a.page, 1500);
  const data = await allData(a.page);
  await showView(a.page, 'profile');
  const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#bkExport')]);
  const file = join(tmpdir(), `ms-sauvegarde-${Date.now()}.json`);   // chemin sans accents (envoi de fichier)
  await dl.saveAs(file);
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  expect(exported.app).toBe('muzan-suivi');
  expect(exported.format).toBe(1);
  expect(exported.data['ai:key']).toBeUndefined();
  expect(JSON.parse(exported.data.photos)).toHaveLength(2);
  expect(JSON.parse(exported.data.photos)[0].img).toMatch(/^data:image\/jpeg;base64,/);
  await expect(a.page.locator('#bkMsg')).toContainText('Sauvegarde créée');
  await a.context.close();

  const b = await newPage(browser);
  await b.page.goto(srv.url + '/old/mon-suivi-app.html');
  await settle(b.page);
  await b.page.evaluate(() => { const o = document.getElementById('onb'); if (o) o.hidden = true; });
  await showView(b.page, 'profile');
  await b.page.evaluate(() => { window.__avant = 1; });
  await b.page.setInputFiles('#bkFile', file);
  await b.page.waitForFunction(() => !window.__avant && document.readyState === 'complete', null, { timeout: 15000 });
  await settle(b.page, 1500);
  sameData(await allData(b.page), data);
  await b.context.close();
});

test('sans données, l’accueil propose la création du profil comme avant', async ({ browser }) => {
  const { context, page } = await newPage(browser);
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await settle(page);
  await expect(page.locator('#onb')).toBeVisible();
  await expect(page.locator('#oqAlt')).toHaveText('J’ai déjà une sauvegarde');   // pas de compte dans cette version locale
  expect(errors).toEqual([]);
  await context.close();
});
