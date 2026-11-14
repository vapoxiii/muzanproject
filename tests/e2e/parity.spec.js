// Mêmes données, mêmes chiffres : l'ancienne app (fichier unique du 7 oct.) et la nouvelle
// version construite affichent les mêmes valeurs dans les cinq onglets (niveau, XP, séances,
// repas, mesures, historique, photos). La mise en page a changé (catégories, textes allégés) :
// on compare les valeurs affichées, champ par champ, et non plus l'image des écrans.
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, dataSnapshot, collectErrors, settle, VIEWS } from './helpers.js';

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

async function capture(browser, path) {
  const context = await browser.newContext();
  await offlineThirdParties(context, srv.url);
  await seedLocalStorage(context, buildData());
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  const errors = collectErrors(page);
  await page.goto(srv.url + path);
  await settle(page, 1500);
  for (const v of VIEWS) await showView(page, v);
  const data = await dataSnapshot(page);
  await context.close();
  return { data, errors };
}

test('les cinq onglets affichent les mêmes données que l’ancienne app', async ({ browser }) => {
  const before = await capture(browser, '/old/mon-suivi-app.html');
  const after = await capture(browser, '/index.html');
  expect(after.errors).toEqual([]);
  for (const k of Object.keys(before.data)) expect.soft(after.data[k], k).toEqual(before.data[k]);
  // quelques repères concrets, pour ne pas comparer deux écrans vides
  expect(after.data.hist[0]).toContain('76.5');
  expect(after.data.meals.join(' | ')).toContain('Bowl poulet riz');
  expect(after.data.photometa).toBe('2 photos');
  expect(after.data.sessions.length).toBe(4);
  expect(after.data.weeks.length).toBeGreaterThan(1);
});
