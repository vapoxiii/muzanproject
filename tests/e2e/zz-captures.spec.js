// Captures de tous les écrans, pour la planche de contrôle visuel (pas un test : ignoré sans CAPTURES=1).
//   CAPTURES=1 npx playwright test tests/e2e/zz-captures.spec.js  ->  .tmp/planche/NN-nom.png (390 × 844, ×2)
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, showSub, openSession, trainingHub, settle } from './helpers.js';

test.skip(!process.env.CAPTURES, 'captures seulement sur demande (CAPTURES=1)');
let srv; test.beforeAll(async () => { srv = await startServer(); }); test.afterAll(async () => { srv && srv.server.close(); });
const OUT = '.tmp/planche/';

test('planche : tous les écrans', async ({ browser }) => {
  test.setTimeout(240_000);
  mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await offlineThirdParties(context, srv.url); await seedLocalStorage(context, buildData());
  const page = await context.newPage(); await page.clock.setFixedTime(FIXED_NOW);
  await page.goto(srv.url + '/index.html'); await settle(page, 1800);
  const shot = async (n, wait = 700) => { await settle(page, wait); await page.screenshot({ path: OUT + n + '.png' }); };

  await shot('01-accueil');
  await page.locator('#menuBtn').click(); await shot('02-menu', 900);
  await page.locator('#homeBtn').click(); await settle(page, 500);

  await showView(page, 'training'); await shot('03-training');
  const card = await openSession(page, 'hautB'); await shot('04-seance');
  await card.locator('.ex-row[data-eid="hautB-1"] .exi').click();
  const sets = card.locator('.lg[data-eid="hautB-1"] .lg-sets .ls');
  await sets.nth(0).locator('[data-f="r"]').fill('8'); await sets.nth(0).locator('[data-ok]').click();
  await expect(page.locator('.rr')).toBeVisible(); await shot('05-repos', 900);
  await page.locator('.rr [data-a="skip"]').click(); await settle(page, 600);
  await trainingHub(page);
  await page.locator('#chronoOpen').click(); await expect(page.locator('.sheet.chr')).toBeVisible(); await shot('06-chrono');
  await page.keyboard.press('Escape'); await settle(page, 400);
  await page.locator('#progOpen').click(); await expect(page.locator('.pe')).toBeVisible(); await shot('07-programme');
  await page.locator('[data-open="hautA"]').click(); await page.locator('[data-act="pick"]').click();
  await expect(page.locator('.pk')).toBeVisible(); await shot('08-exercices');
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await settle(page, 300); }

  await showView(page, 'nutrition'); await shot('09-nutrition');
  await showSub(page, 'nutrition', 'repas'); await shot('10-repas');
  await showView(page, 'progress'); await shot('11-progression');
  await showView(page, 'body'); await shot('12-corps');
  await showView(page, 'sports'); await shot('13-sports');
  await showView(page, 'profile'); await shot('14-profil');
  // premier lancement, sans données : l'accueil des nouveaux
  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await offlineThirdParties(fresh, srv.url);
  const p2 = await fresh.newPage(); await p2.clock.setFixedTime(FIXED_NOW);
  await p2.goto(srv.url + '/index.html'); await settle(p2, 2000);
  await p2.screenshot({ path: OUT + '15-onboarding.png' });
  await fresh.close();
  await context.close();
});
