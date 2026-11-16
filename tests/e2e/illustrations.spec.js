// Illustrations des exercices : dans la séance (à côté de la dernière fois, en grand d'un toucher),
// dans la bibliothèque (vignette, ou pictogramme sans illustration) et dans les réglages d'un exercice.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, collectErrors, settle, openSession } from './helpers.js';

const INDEX = JSON.parse(readFileSync(new URL('../../src/training/illus-index.json', import.meta.url), 'utf8'));
let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

const loaded = (img) => img.evaluate((i) => i.complete && i.naturalWidth === 480);

test('illustrations : séance, grande image, bibliothèque et réglages', async ({ browser }) => {
  expect(Object.keys(INDEX).length).toBeGreaterThanOrEqual(29);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await offlineThirdParties(context, srv.url);
  await seedLocalStorage(context, buildData());
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await settle(page, 1200);

  // la carte de Haut B, dans l'entrée de Training : en couverture, le premier exercice illustré
  await showView(page, 'training');
  const cov = page.locator('#trCards .tc[data-sid="hautB"] .tc-cov img');
  await expect(cov).toHaveAttribute('src', new RegExp('exos/' + INDEX['di-halteres'].replace('.', '\\.') + '$'));
  // séance : Haut B commence par le développé incliné haltères, illustré
  await openSession(page, 'hautB');
  const row = page.locator('#sessions .card.open .ex-row').first();
  await row.locator('.exi').click();
  const ill = page.locator('.lg-top .lg-ill img');
  await expect(ill).toHaveAttribute('src', new RegExp('exos/' + INDEX['di-halteres'].replace('.', '\\.') + '$'));
  await expect.poll(() => loaded(ill)).toBe(true);
  await expect(page.locator('.lg-top .lg-last')).toBeVisible();
  // en grand, avec la cible et le matériel
  await page.click('.lg-ill');
  await expect(page.locator('.ilx .st')).toHaveText('Développé incliné haltères');
  await expect(page.locator('.ilx-m')).toHaveText('Haut des pectoraux · Haltères');
  await expect.poll(() => loaded(page.locator('.ilx-img img'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ilx')).toHaveCount(0);
  // un exercice sans illustration : le rappel de la dernière fois, seul
  await row.locator('.exi').click();
  await page.locator('#sessions .card.open .ex-row').nth(1).locator('.exi').click();
  await expect(page.locator('.lg .lg-last')).toBeVisible();
  await expect(page.locator('.lg-top')).toHaveCount(0);

  // bibliothèque : vignette pour les exercices illustrés, pictogramme pour les autres
  await page.locator('#v-training [data-back]').click();
  await page.click('#progOpen');
  await page.click('[data-open="hautA"]');
  await page.click('[data-act="pick"]');
  const pk = page.locator('.pk');
  await pk.locator('[data-cat="pecs"]').click();
  await pk.locator('[data-eqg="barre"]').click();
  await expect.poll(() => loaded(pk.locator('.pk-it[data-x="dc-barre"] .ex-th img'))).toBe(true);
  await pk.locator('[data-act="up"]').click();
  await pk.locator('[data-act="up"]').click();
  await pk.locator('[data-cat="jambes"]').click();
  await pk.locator('[data-eqg="barre"]').click();
  await expect(pk.locator('.pk-it[data-x="squat"] .ex-th.none svg')).toHaveCount(1);
  await pk.locator('.pk-done').click();
  // réglages d'un exercice illustré : le geste en grand, au-dessus des curseurs
  await page.locator('.pe-ex-m').first().click();
  await expect(page.locator('.xs-ill img')).toHaveAttribute('src', new RegExp('exos/' + INDEX['dc-halteres'].replace('.', '\\.') + '$'));
  expect(errors).toEqual([]);
  await context.close();
});
