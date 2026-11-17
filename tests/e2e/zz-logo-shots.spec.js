// Captures du logo GRIND dans l'app (pas un test : ignoré sans CAPTURES=1).
//   CAPTURES=1 npx playwright test tests/e2e/zz-logo-shots.spec.js  ->  .tmp/logo/*.png (390 × 844, ×2)
// La connexion n'existe qu'avec un compte configuré : construire d'abord dist-cloud
//   VITE_SUPABASE_URL=https://exemple.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite build --outDir dist-cloud
import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, settle } from './helpers.js';

test.skip(!process.env.CAPTURES, 'captures seulement sur demande (CAPTURES=1)');
let srv; test.beforeAll(async () => { srv = await startServer(); }); test.afterAll(async () => { srv && srv.server.close(); });
const OUT = '.tmp/logo/';
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };

test('logo : lancement, accueil, profil, bienvenue, attente, connexion', async ({ browser }) => {
  test.setTimeout(180_000);
  mkdirSync(OUT, { recursive: true });

  // 1. écran de lancement (on retarde le code de l'app pour le figer)
  const c1 = await browser.newContext(PHONE); await offlineThirdParties(c1, srv.url);
  await c1.route(/\/assets\/app-[^/]*\.js$/, async (r) => { await new Promise((ok) => setTimeout(ok, 4000)); await r.continue(); });
  const p1 = await c1.newPage();
  await p1.goto(srv.url + '/index.html', { waitUntil: 'commit' });
  await expect(p1.locator('#splash .splash-w')).toBeVisible(); await p1.waitForTimeout(900);
  await p1.screenshot({ path: OUT + '1-lancement.png' });
  await c1.close();

  // 2. accueil et profil, avec des données
  const c2 = await browser.newContext(PHONE); await offlineThirdParties(c2, srv.url); await seedLocalStorage(c2, buildData());
  const p2 = await c2.newPage(); await p2.clock.setFixedTime(FIXED_NOW);
  await p2.goto(srv.url + '/index.html'); await settle(p2, 1800);
  await expect(p2.locator('#splash')).toHaveCount(0);
  await p2.screenshot({ path: OUT + '2-accueil.png' });
  await showView(p2, 'profile'); await settle(p2, 500);
  await p2.locator('.pf-brand').scrollIntoViewIfNeeded(); await settle(p2, 400);
  await p2.screenshot({ path: OUT + '3-profil.png' });
  // attente d'une analyse : le cœur remplace la roue
  await showView(p2, 'nutrition'); await settle(p2, 400);
  await p2.evaluate(() => {
    const d = document.createElement('div'); d.id = 'spinDemo';
    d.style.cssText = 'position:fixed;left:16px;right:16px;top:300px;z-index:50;background:#fff;border-radius:24px;box-shadow:0 18px 40px rgba(70,46,150,.18)';
    d.innerHTML = '<div class="spin"><i></i> Analyse du repas…</div>'; document.body.appendChild(d);
  });
  await settle(p2, 300); await p2.screenshot({ path: OUT + '4-attente.png' });
  await c2.close();

  // 3. premier lancement : écran de bienvenue, Ren se présente
  const c3 = await browser.newContext(PHONE); await offlineThirdParties(c3, srv.url);
  const p3 = await c3.newPage(); await p3.clock.setFixedTime(FIXED_NOW);
  await p3.goto(srv.url + '/index.html'); await settle(p3, 2200);
  await expect(p3.locator('#oqBrand')).toBeVisible();
  await p3.screenshot({ path: OUT + '5-bienvenue.png' });
  await p3.locator('#oqGo').click(); await settle(p3, 700);
  await expect(p3.locator('#oqBrand')).toBeHidden();
  await c3.close();

  // 4. connexion (build avec compte)
  if (existsSync('dist-cloud')) {
    const s2 = await startServer('dist-cloud');
    const c4 = await browser.newContext(PHONE); await offlineThirdParties(c4, s2.url);
    await c4.route(/supabase\.co/, (r) => r.abort());
    const p4 = await c4.newPage(); await p4.clock.setFixedTime(FIXED_NOW);
    await p4.goto(s2.url + '/index.html'); await settle(p4, 2200);
    await p4.locator('#oqAlt').click(); await settle(p4, 600);
    await expect(p4.locator('.acc-brand')).toBeVisible();
    await p4.screenshot({ path: OUT + '6-connexion.png' });
    await c4.close(); s2.server.close();
  }
});
