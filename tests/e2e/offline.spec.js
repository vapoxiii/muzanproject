// App installable : après une première visite, elle s'ouvre sans réseau, et une nouvelle
// version publiée s'installe au démarrage suivant.
import { test, expect } from '@playwright/test';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { ROOT, seedLocalStorage, showView, showSub, viewText, settle } from './helpers.js';
import { serve } from '../../scripts/serve.mjs';

test.use({ serviceWorkers: 'allow' });

async function waitForSW(page) {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    if (!keys.length) return false;
    const c = await caches.open(keys[0]);
    return (await c.keys()).length > 20;
  });
}

test('sans réseau, l’app s’ouvre avec toutes ses données', async ({ browser }) => {
  const dir = mkdtempSync(join(tmpdir(), 'ms-dist-'));
  cpSync(join(ROOT, 'dist'), dir, { recursive: true });
  const srv = await serve({ root: dir });
  const context = await browser.newContext();
  await seedLocalStorage(context, buildData());
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto(srv.url + '/');
  await settle(page);
  await waitForSW(page);
  await showView(page, 'body');
  const online = await viewText(page, 'body');

  await context.setOffline(true);
  srv.server.close();                     // serveur coupé : tout doit venir du cache
  await page.reload();
  await settle(page, 1500);
  await showView(page, 'body');
  expect(await viewText(page, 'body')).toBe(online);
  // l'ancienne adresse de l'app fonctionne aussi hors ligne
  await page.goto(srv.url + '/mon-suivi-app.html');
  await settle(page, 1500);
  await showView(page, 'nutrition');
  await showSub(page, 'nutrition', 'repas');
  expect(await viewText(page, 'nutrition')).toContain('Bowl poulet riz');
  // images et polices servies depuis le cache
  const broken = await page.evaluate(() => [...document.images].filter((i) => i.getAttribute('src') && i.complete && i.naturalWidth === 0).map((i) => i.src));
  expect(broken).toEqual([]);
  expect(await page.evaluate(() => document.fonts.check('800 16px Inter'))).toBe(true);
  await context.close();
});

test('une nouvelle version publiée s’applique au démarrage suivant', async ({ browser }) => {
  const dir = mkdtempSync(join(tmpdir(), 'ms-dist-'));
  cpSync(join(ROOT, 'dist'), dir, { recursive: true });
  const srv = await serve({ root: dir });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(srv.url + '/');
  await waitForSW(page);
  await page.reload();                       // la page est maintenant contrôlée par le service worker
  await settle(page);
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await page.mouse.click(200, 300);           // l'app est en cours d'utilisation : pas de rechargement d'office
  // « publication » d'une nouvelle version : le service worker change
  const sw = readFileSync(join(dir, 'sw.js'), 'utf8');
  const v1 = /const VERSION = "([^"]+)"/.exec(sw)[1];
  writeFileSync(join(dir, 'sw.js'), sw.replace(`const VERSION = "${v1}"`, `const VERSION = "${v1}-v2"`));
  writeFileSync(join(dir, 'index.html'), readFileSync(join(dir, 'index.html'), 'utf8')
    .replace('<title>Mon suivi</title>', '<title>Mon suivi v2</title>').replace(`content="${v1}"`, `content="${v1}-v2"`));
  await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  await page.waitForFunction(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r.waiting; });
  // l'app ouverte propose la mise à jour
  await expect(page.locator('#updBanner')).toBeVisible();
  // démarrage suivant : appliquée d'office. (Chromium sous automatisation retarde parfois la
  // bascule tant que l'ancien service worker n'est pas arrêté ; l'app doit alors démarrer
  // normalement sur l'ancienne version et reproposer la mise à jour.)
  await page.reload();
  await page.waitForFunction(() => document.title === 'Mon suivi v2' || !!document.querySelector('#updBanner:not([hidden])'), null, { timeout: 15000 });
  if ((await page.title()) !== 'Mon suivi v2') {
    expect(await page.evaluate(() => !document.documentElement.classList.contains('boot'))).toBe(true);
    // le système finit par arrêter l'ancien service worker (app fermée, inactivité) : la nouvelle version s'applique
    const cdp = await context.newCDPSession(page);
    const versions = new Map();
    cdp.on('ServiceWorker.workerVersionUpdated', (e) => { for (const v of e.versions) versions.set(v.versionId, v); });
    await cdp.send('ServiceWorker.enable');
    await expect.poll(() => [...versions.values()].some((v) => v.status === 'activated')).toBe(true);
    for (const v of [...versions.values()].filter((x) => x.status === 'activated')) await cdp.send('ServiceWorker.stopWorker', { versionId: v.versionId });
    // la bascule déclenche le rechargement de l'app (sinon on relance nous-mêmes)
    const ok = await page.waitForFunction(() => document.title === 'Mon suivi v2', null, { timeout: 6000 }).then(() => true, () => false);
    if (!ok) { await page.reload().catch(() => {}); await page.waitForFunction(() => document.title === 'Mon suivi v2', null, { timeout: 15000 }); }
  }
  srv.server.close();
  await context.close();
});
