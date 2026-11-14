// Tendance du poids et calories adaptatives, dans le navigateur.
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW, dayStr } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, showSub, collectErrors, settle } from './helpers.js';

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

// Fixture + 4 semaines de pesées (tous les 2 jours, −0,1 kg/sem, arrondies à 100 g : pente mesurée −0,11) et de repas (~2 450 kcal/jour)
function withHistory() {
  const data = buildData();
  const body = [];
  for (let i = 28; i >= 0; i -= 2) body.push({ d: dayStr(-i), w: Math.round((77 - 0.1 * ((28 - i) / 7)) * 10) / 10, t: i % 14 === 0 ? 84 : null });
  data.bodylog = JSON.stringify(body);
  const food = {};
  for (let i = 0; i <= 20; i++) food[dayStr(-i)] = [{ fid: 'f8', q: 2 }, { fid: 'f12', q: 1 }, { fid: 'f4', q: 2 }, { fid: 'f6', q: 2.5 }, { fid: 'f13', q: 1 }, { fid: 'f22', q: 1 }, { fid: 'f15', q: 1 }, { fid: 'f14', q: 1 }, { fid: 'f20', q: 1.5 }, { fid: 'f23', q: 2 }, { fid: 'f11', q: 2 }];
  data.foodlog = JSON.stringify(food);
  return data;
}

async function open(browser, seed) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await offlineThirdParties(context, srv.url);
  await seedLocalStorage(context, seed);
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await settle(page, 1200);
  return { context, page, errors };
}

test('tendance lissée sous la courbe du poids', async ({ browser }) => {
  const { context, page, errors } = await open(browser, withHistory());
  await showView(page, 'body');
  const t = page.locator('#mTrend');
  await expect(t).toBeVisible();
  await expect(t).toContainText('Tendance');
  await expect(t).toContainText('−0,11 kg par semaine, sur 3 semaines');
  // la courbe suit la tendance, les pesées sont des points
  expect(await page.locator('#chart svg circle').count()).toBe(15);
  await page.click('#seg [data-m="t"]');
  await expect(t).toBeHidden();
  expect(errors).toEqual([]);
  await context.close();
});

test('ajustement de la semaine : bilan, appliquer, puis plus rien avant 7 jours', async ({ browser }) => {
  const { context, page, errors } = await open(browser, withHistory());
  await showView(page, 'nutrition');
  // à l'entrée de la Nutrition : un point et « Nouvelle base » sur la tuile Objectif ; dans Mes repas, un rappel discret
  await expect(page.locator('#calDot')).toBeVisible();
  await expect(page.locator('#nhGoal')).toHaveText('Nouvelle base');
  await showSub(page, 'nutrition', 'repas');
  await expect(page.locator('#calNote')).toBeVisible();
  await expect(page.locator('#calNote')).toContainText('Nouvelle base proposée');
  await page.click('#calNote');
  await expect(page.locator('#np-objectif')).toBeVisible();
  await expect(page.locator('#np-repas')).toBeHidden();
  await expect(page.locator('#daypills')).toBeHidden();
  const card = page.locator('#calAdj');
  await expect(card).toContainText('Ajustement de la semaine');
  await expect(card).toContainText('Ta tendance : −0,11 kg par semaine. Pour une recomposition, on vise −0,19 kg.');
  await expect(card).toContainText('jours de repas notés');
  const before = await page.textContent('#basebtn');
  expect(before.replace(/\D/g, '')).toBe('2350');
  const to = (await card.locator('.ca-n b').textContent()).replace(/\D/g, '');
  expect(Number(to)).toBeLessThan(2350);
  await card.locator('[data-ca="apply"]').click();
  await expect(page.locator('#basebtn')).toHaveText(Number(to).toLocaleString('fr-FR') + ' kcal');
  await expect(card).toContainText('Base ajustée à');
  await expect(card).toContainText('Prochain point');
  await expect(page.locator('#calDot')).toBeHidden();
  await expect(page.locator('#nhGoal')).toHaveText(/^\d[\d\s]* kcal$/);      // l'objectif du jour, plus « Nouvelle base »
  await expect(page.locator('#calNote')).toBeHidden();
  await page.reload();
  await settle(page, 1200);
  await showView(page, 'nutrition');
  await showSub(page, 'nutrition', 'objectif');
  await expect(page.locator('#calAdj')).toContainText('Prochain point');
  expect(await page.textContent('#basebtn')).not.toBe(before);
  expect(errors).toEqual([]);
  await context.close();
});

test('ajustement de la semaine : garder sa base', async ({ browser }) => {
  const { context, page } = await open(browser, withHistory());
  await showView(page, 'nutrition');
  await showSub(page, 'nutrition', 'objectif');
  await page.locator('#calAdj [data-ca="keep"]').click();
  await expect(page.locator('#basebtn')).toHaveText('2 350 kcal');
  await expect(page.locator('#calAdj')).toContainText('Base gardée à 2 350 kcal');
  await context.close();
});

test('sans assez de pesées : la carte explique quoi faire ; base modifiable au curseur', async ({ browser }) => {
  const { context, page, errors } = await open(browser, buildData());
  await showView(page, 'nutrition');
  await expect(page.locator('#calNote')).toBeHidden();
  await showSub(page, 'nutrition', 'objectif');
  await expect(page.locator('#calAdj')).toContainText('Pèse-toi au moins 4 fois sur 3 semaines');
  await page.click('#basebtn');
  const dlg = page.locator('.tr-num');
  await expect(dlg.locator('.tsl-v')).toHaveText('2 350 kcal');
  await dlg.getByRole('slider').press('ArrowRight');
  await dlg.locator('[data-d="1"]').click();
  await expect(dlg.locator('.tsl-v')).toHaveText('2 450 kcal');
  await dlg.locator('[data-a="1"]').click();
  await expect(page.locator('#basebtn')).toHaveText('2 450 kcal');
  expect(errors).toEqual([]);
  await context.close();
});
