// L'accueil (Ren, sa phrase, les infos du jour), la roue des parties (toucher, glisser, clavier),
// la maison ; parties rangées en catégories ; fenêtre « Ajouter un aliment » ; historique des pesées.
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, showSub, collectErrors, settle } from './helpers.js';

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

async function open(browser, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
  await offlineThirdParties(context, srv.url);
  await seedLocalStorage(context, buildData());
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await settle(page, 1200);
  return { context, page, errors };
}
const panels = (page, v) => page.locator(`#v-${v} [data-panel]`);
const visibleView = (page) => page.evaluate(() => [...document.querySelectorAll('.view')].filter((v) => !v.hidden).map((v) => v.dataset.view));

test('accueil : Ren, sa phrase et les infos du jour ; la roue au toucher, en glissant, au clavier ; la maison', async ({ browser }) => {
  const { context, page, errors } = await open(browser, { hasTouch: true, isMobile: true });
  // l'accueil : rang, niveau, XP, la phrase de Ren, la séance et les calories du jour
  await expect(page.locator('#hzRank')).toHaveText('C');
  await expect(page.locator('#hzLvl')).toHaveText('9');
  await expect(page.locator('#hzNext')).toHaveText(/XP avant le niveau 10/);
  await expect(page.locator('#hdSayW')).toHaveText('Ren');
  await expect(page.locator('#hdSayT')).toHaveText('Prêt pour Haut B\u00a0?');
  await expect(page.locator('#goalOv')).toHaveText('Aujourd’hui');
  await expect(page.locator('#goalT')).toHaveText('NatationTechnique');
  await expect(page.locator('#goalM')).toHaveText('Faite');
  await expect(page.locator('#tdKcalK')).toHaveText('Il te reste');
  await expect(page.locator('#tdKcalN')).toHaveText(/^1\s710 kcal$/);
  await expect(page.locator('#tdKcalP')).toHaveText('Protéines 74 / 155 g');
  await expect(page.locator('#homeBtn')).toHaveAttribute('aria-current', 'page');
  // une seule page, sans défilement
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);

  // toucher Ren : la roue s'ouvre, six parts autour de lui
  const ren = page.locator('#hdRen');
  const rb = await ren.boundingBox();
  await page.touchscreen.tap(rb.x + rb.width / 2, rb.y + rb.height * 0.3);
  await expect(ren).toHaveAttribute('aria-expanded', 'true');
  expect(await page.locator('.wh-sl').evaluateAll((g) => g.map((x) => x.getAttribute('aria-label')))).toEqual(['Progression', 'Training', 'Sports', 'Corps', 'Profil', 'Nutrition']);
  await expect(page.locator('.wh-title')).toHaveText('Où on va ?');
  // toucher à côté de l'anneau : elle se referme
  await page.waitForTimeout(450);
  const wb = await page.locator('#wheel').boundingBox();
  await page.touchscreen.tap(wb.x + 6, wb.y + 6);
  await expect(ren).toHaveAttribute('aria-expanded', 'false');

  // appuyer sur Ren, glisser jusqu'à Nutrition, lâcher : on y est
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width / 2 + 24, rb.y + rb.height * 0.3, { steps: 3 });
  await expect(ren).toHaveAttribute('aria-expanded', 'true');
  await page.waitForTimeout(450);
  const nb = await page.locator('.wh-sl[data-go="nutrition"]').boundingBox();
  await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2, { steps: 6 });
  await expect(page.locator('.wh-sl[data-go="nutrition"]')).toHaveClass(/hot/);
  await expect(page.locator('.wh-title')).toHaveText('Nutrition');
  await page.mouse.up();
  await expect(page.locator('#v-nutrition')).toBeVisible();
  expect(await visibleView(page)).toEqual(['nutrition']);
  await expect(page.locator('#menuBtn')).toHaveAttribute('aria-current', 'page');

  // la maison : retour à l'accueil, roue fermée
  await page.locator('#homeBtn').tap();
  await expect(page.locator('#v-home')).toBeVisible();
  await expect(page.locator('#homeBtn')).toHaveAttribute('aria-current', 'page');
  await expect(ren).toHaveAttribute('aria-expanded', 'false');

  // toucher une part : Corps
  await page.touchscreen.tap(rb.x + rb.width / 2, rb.y + rb.height * 0.3);
  await page.waitForTimeout(450);
  await page.locator('.wh-sl[data-go="body"]').tap();
  expect(await visibleView(page)).toEqual(['body']);
  await expect(page.locator('#bdSub')).toHaveText('76,5 kg, tour de taille 84 cm, mesuré le 21 octobre');

  // clavier : Entrée sur Ren, flèches, Échap ; puis Entrée sur une part
  await page.locator('#homeBtn').click();
  await ren.focus();
  await page.keyboard.press('Enter');
  await expect(ren).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.wh-sl[data-go="progress"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.wh-sl[data-go="training"]')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.wh-sl[data-go="nutrition"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(ren).toHaveAttribute('aria-expanded', 'false');
  await expect(ren).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.wh-sl[data-go="progress"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  expect(await visibleView(page)).toEqual(['training']);
  await expect(page.locator('#v-training .ph-t')).toBeFocused();

  // raccourcis : le rang mène au rang, la séance du jour (natation) à Sports, les calories aux repas du jour
  await showView(page, 'home');
  await page.click('#hzRankBtn');
  await expect(page.locator('#pp-rang')).toBeVisible();
  await showView(page, 'home');
  await page.click('#goalB');
  expect(await visibleView(page)).toEqual(['sports']);
  await showView(page, 'home');
  await page.click('#tdKcal');
  await expect(page.locator('#np-repas')).toBeVisible();
  await expect(page.locator('#mealday')).toHaveText('Repas d’aujourd’hui');
  expect(errors).toEqual([]);
  await context.close();
});

test('Nutrition : l’entrée (Ren, sa phrase, les tuiles), une rubrique à la fois, le retour', async ({ browser }) => {
  const { context, page, errors } = await open(browser, { hasTouch: true, isMobile: true });
  await showView(page, 'nutrition');
  const hub = page.locator('#nutHub');
  await expect(hub).toBeVisible();
  await expect(page.locator('#v-nutrition > .ps')).toBeHidden();
  await expect(page.locator('#nhSub')).toHaveText(/^890 kcal sur 2\s600, protéines 74 \/ 155 g$/);
  await expect(page.locator('#nhSay')).toHaveText(/^Il te reste 1\s710\skcal, dont 81\sg de protéines à trouver\.$/);
  await expect(hub.locator('.ph-tile b')).toHaveText(['Photo du plat', 'Scanner', 'Ajouter un aliment', 'Mes repas']);
  await expect(page.locator('#nhMeals')).toHaveText('3 aujourd’hui');
  await expect(page.locator('#nhProt')).toHaveText('74 / 155 g');
  await expect(page.locator('#nhGoal')).toHaveText(/^2\s600 kcal$/);
  await expect(page.locator('#nhKcal')).toHaveText('890');
  await expect(hub.locator('.nh-gb')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);

  // une tuile : sa rubrique seule, son nom en titre ; le retour ramène à l'entrée
  await hub.locator('.nh-gb[data-sub="proteines"]').tap();
  await expect(page.locator('#np-proteines')).toBeVisible();
  await expect(hub).toBeHidden();
  await expect(page.locator('#nutT')).toHaveText('Protéines et habitudes');
  await expect(page.locator('#np-repas')).toBeHidden();
  await page.locator('#v-nutrition [data-back]').tap();
  await expect(hub).toBeVisible();
  await expect(page.locator('#v-nutrition > .ps')).toBeHidden();

  // revenir dans la partie par la roue : l'entrée, pas la dernière rubrique
  await hub.locator('.nh-gb[data-sub="objectif"]').tap();
  await expect(page.locator('#np-objectif')).toBeVisible();
  await expect(page.locator('#nutT')).toHaveText('Objectif');
  await showView(page, 'home');
  await showView(page, 'nutrition');
  await expect(hub).toBeVisible();

  // Ajouter un aliment : la fenêtre du bas, pour aujourd'hui
  await hub.locator('.ph-tile[data-act="add"]').tap();
  await expect(page.locator('#picker')).toBeVisible();
  await page.locator('#pickclose').tap();
  await expect(page.locator('#picker')).toBeHidden();

  // la tuile des calories de l'accueil mène directement à Mes repas
  await showView(page, 'home');
  await page.click('#tdKcal');
  await expect(page.locator('#np-repas')).toBeVisible();
  await expect(page.locator('#nutT')).toHaveText('Mes repas');
  expect(errors).toEqual([]);
  await context.close();
});

test('catégories d’une partie : une à la fois, au toucher et au clavier', async ({ browser }) => {
  const { context, page, errors } = await open(browser);
  await showView(page, 'progress');
  const tabs = page.locator('.sub[data-sub="progress"] [role="tab"]');
  await expect(tabs).toHaveText(['Rang', 'Semaines']);
  await expect(page.locator('#pp-rang')).toBeVisible();
  expect(await panels(page, 'progress').evaluateAll((ps) => ps.filter((p) => !p.hidden).map((p) => p.id))).toEqual(['pp-rang']);
  await showSub(page, 'progress', 'semaines');
  await expect(page.locator('#pp-semaines')).toBeVisible();
  await expect(page.locator('#pp-rang')).toBeHidden();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(0)).toHaveAttribute('tabindex', '-1');

  // Corps : mesures et photos ; clavier : flèche droite, Début, flèche gauche
  await showView(page, 'body');
  const bt = page.locator('.sub[data-sub="body"] [role="tab"]');
  await expect(bt).toHaveText(['Mesures', 'Photos']);
  await expect(page.locator('#pp-corps')).toBeVisible();
  await bt.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#pp-photos')).toBeVisible();
  await expect(bt.nth(1)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.locator('#pp-corps')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#pp-photos')).toBeVisible();

  // la catégorie choisie reste quand on repasse par l'accueil
  await showView(page, 'home');
  await showView(page, 'body');
  await expect(page.locator('#pp-photos')).toBeVisible();
  await expect(page.locator('#photometa')).toHaveText('2 photos');
  await showView(page, 'progress');
  await expect(page.locator('#pp-semaines')).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});

test('Nutrition : le choix du jour sert aux repas et aux protéines, pas à l’objectif', async ({ browser }) => {
  const { context, page, errors } = await open(browser);
  await showView(page, 'nutrition');
  await showSub(page, 'nutrition', 'repas');
  await expect(page.locator('#daypills')).toBeVisible();
  await page.locator('#daypills .pill').nth(1).click();          // mardi 20 octobre
  await expect(page.locator('#mealday')).toHaveText('Repas du mardi 20 octobre');
  await expect(page.locator('#meallog')).toContainText('Skyr myrtilles');
  await showSub(page, 'nutrition', 'proteines');
  await expect(page.locator('#daypills')).toBeVisible();
  await expect(page.locator('#daypills .pill.sel')).toHaveCount(1);
  await expect(page.locator('#pcount')).toHaveText('5/7');
  await showSub(page, 'nutrition', 'objectif');
  await expect(page.locator('#daypills')).toBeHidden();
  await expect(page.locator('#basebtn')).toHaveText('2 350 kcal');
  expect(errors).toEqual([]);
  await context.close();
});

test('ajouter un aliment depuis la fenêtre du bas, gérer ses aliments, fermer', async ({ browser }) => {
  const { context, page, errors } = await open(browser);
  await showView(page, 'nutrition');
  await showSub(page, 'nutrition', 'repas');
  const rows = page.locator('#meallog .ml');
  const before = await rows.count();
  await page.click('#openpick');
  await expect(page.locator('#picker')).toBeVisible();
  await expect(page.locator('#foodsearch')).toBeFocused();
  await page.fill('#foodsearch', 'skyr nat');
  const first = page.locator('#foodresults .fr').first();
  await expect(first).toContainText('Skyr nature');
  await first.click();
  await expect(first).toHaveClass(/added/);
  await expect(page.locator('#pickTot')).toContainText('Déjà noté');
  await page.keyboard.press('Escape');
  await expect(page.locator('#picker')).toBeHidden();
  await expect(rows).toHaveCount(before + 1);
  await expect(page.locator('#meallog')).toContainText('Skyr nature');

  // gestion des aliments, dans la même fenêtre ; fermeture au bouton puis sur le fond
  await page.click('#openpick');
  await page.click('#managetgl');
  await expect(page.locator('#managelist .mgr').first()).toBeVisible();
  await page.click('#pickclose');
  await expect(page.locator('#picker')).toBeHidden();
  await page.click('#openpick');
  await expect(page.locator('#managelist')).toBeHidden();
  await page.mouse.click(195, 30);
  await expect(page.locator('#picker')).toBeHidden();
  expect(errors).toEqual([]);
  await context.close();
});

test('historique des pesées : lignes compactes, nombres à la française', async ({ browser }) => {
  const { context, page, errors } = await open(browser);
  await showView(page, 'body');
  const rows = page.locator('#hist .h');
  await expect(rows).toHaveCount(6);
  await expect(rows.first()).toContainText('76,5 kg');
  await expect(rows.first()).toContainText('84 cm');
  for (const h of await rows.evaluateAll((rs) => rs.map((r) => r.getBoundingClientRect().height))) expect(h).toBeLessThan(80);
  await expect(page.locator('#st_w')).toHaveText('76,5 kg');
  expect(errors).toEqual([]);
  await context.close();
});
