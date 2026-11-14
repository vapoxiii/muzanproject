// Corrections après la restructuration, et vérifications de comportements de l'ancienne app.
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, collectErrors, settle, openSession } from './helpers.js';

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

async function open(browser, path, seed) {
  const context = await browser.newContext();
  await offlineThirdParties(context, srv.url);
  if (seed) await seedLocalStorage(context, seed);
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  page.on('dialog', (d) => d.accept());
  const errors = collectErrors(page);
  await page.goto(srv.url + path);
  await settle(page, 1200);
  return { context, page, errors };
}

// Parcourt l'onboarding et relève, à chaque question, la progression totale de la barre
// (somme des segments) et le pas des règles.
async function walkOnboarding(page) {
  const steps = [];
  for (let n = 0; n < 30; n++) {
    // question en cours, reconnue à ses commandes (le code de l'app n'est pas global)
    const info = await page.evaluate(() => {
      const ctl = document.getElementById('oqCtl'), range = document.getElementById('oqRange');
      let type = 'autre', id = null;
      if (document.getElementById('oqText')) type = 'text';
      else if (ctl.querySelector('.oq-opts [data-o]')) type = 'choice';
      else if (ctl.querySelector('.oq-nums [data-o]')) type = 'num';
      else if (range) { type = 'ruler'; id = { 1950: 'birthYear', 140: 'height', 40: 'weight' }[range.getAttribute('min')] || 'ruler'; }
      else if (ctl.querySelector('.oq-fin')) type = 'final';
      const bars = [...document.querySelectorAll('#oqProg b')].map((b) => parseFloat(b.style.width) || 0);
      return { id: id || type, type, total: bars.reduce((x, y) => x + y, 0), bars, rangeStep: range ? range.getAttribute('step') : null };
    });
    steps.push(info);
    if (info.type === 'final') break;
    if (info.type === 'text') await page.fill('#oqText', 'Alex');
    if (info.type === 'choice' || info.type === 'num') await page.locator('#oqCtl [data-o]:not([disabled])').first().click();
    if (info.id === 'weight') {
      const before = await page.inputValue('#oqRange');
      await page.focus('#oqRange');
      await page.keyboard.press('ArrowRight');
      info.weightBefore = before; info.weightAfter = await page.inputValue('#oqRange');
      info.weightShown = await page.textContent('#oqV');
    }
    await page.click('#oqGo');
    await page.waitForTimeout(450);
  }
  return steps;
}

test('onboarding : la barre de progression avance sans jamais reculer', async ({ browser }) => {
  const { context, page, errors } = await open(browser, '/index.html');
  await expect(page.locator('#onb')).toBeVisible();
  const steps = await walkOnboarding(page);
  expect(steps.at(-1).type).toBe('final');
  for (let i = 1; i < steps.length; i++) {
    expect.soft(steps[i].total, `${steps[i - 1].id} → ${steps[i].id}`).toBeGreaterThanOrEqual(steps[i - 1].total);
  }
  // année, taille et poids font partie de l'étape « profil » (premier segment)
  for (const id of ['birthYear', 'height', 'weight']) {
    const s = steps.find((x) => x.id === id);
    expect(s.bars[0]).toBeGreaterThan(0);
    expect(s.bars[0]).toBeLessThan(100);
    expect(s.bars[1]).toBe(0);
  }
  // les règles gardent leur pas : 1 an, 1 cm, 0,5 kg
  expect(steps.find((x) => x.id === 'birthYear').rangeStep).toBe('1');
  expect(steps.find((x) => x.id === 'height').rangeStep).toBe('1');
  const w = steps.find((x) => x.id === 'weight');
  expect(w.rangeStep).toBe('0.5');
  expect(Number(w.weightAfter) - Number(w.weightBefore)).toBe(0.5);
  expect(w.weightShown).toBe('75,5');
  expect(errors).toEqual([]);
  await context.close();
});

test('avant la correction, la barre reculait (ancienne app)', async ({ browser }) => {
  const { context, page } = await open(browser, '/old/mon-suivi-app.html');
  await expect(page.locator('#onb')).toBeVisible();
  const steps = await walkOnboarding(page);
  const back = steps.some((s, i) => i > 0 && s.total < steps[i - 1].total);
  expect(back).toBe(true);
  await context.close();
});

test('le message « +XP » s’affiche quand on coche un exercice, comme avant', async ({ browser }) => {
  for (const path of ['/old/mon-suivi-app.html', '/index.html']) {
    const { context, page } = await open(browser, path, buildData());
    await showView(page, 'training');
    if (path === '/index.html') await openSession(page, 'hautB');    // nouvelle app : la carte, « C'est parti »
    else await page.locator('#sessions .card .chd').nth(2).click();  // ancienne app : Haut B dans la liste
    await page.locator('#sessions .card.open .row .chk').first().click();
    const toast = page.locator('#xpToast');
    await expect(toast, path).toHaveClass(/on/);
    await expect(toast, path).toHaveText('+5 XP');
    await context.close();
  }
});
