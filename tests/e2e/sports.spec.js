// Sports en plus de la musculation : leur partie (semaine, coches, réglages), ajout depuis le catalogue
// (catégories, recherche), XP, semaine de la Progression, calories du jour (sport prévu et sport ajouté).
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW, weekKey } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, showSub, collectErrors, settle, readIDB } from './helpers.js';

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

const totalXP = async (page) => Number((await page.textContent('#rkXp')).replace(/\D/g, ''));

test('sports : catalogue, réglages, coches, accueil et calories', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await offlineThirdParties(context, srv.url);
  await seedLocalStorage(context, buildData());
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await settle(page, 1200);
  const xp0 = await totalXP(page);

  // la partie Sports : la natation, ses jours, la semaine
  await showView(page, 'sports');
  await expect(page.locator('#sportrows .sport .n')).toHaveText(['Natation']);
  await expect(page.locator('#sportrows .sport .s')).toHaveText(['Technique · mer., sam.']);
  await expect(page.locator('#spSub')).toHaveText('1 séance sur 2 cette semaine');
  await expect(page.locator('#spEmpty')).toBeHidden();
  // Training n'a plus que la musculation (et Bras Express en option)
  await showView(page, 'training');
  await expect(page.locator('#v-training .sport')).toHaveCount(0);

  // le programme : la natation est un sport parmi d'autres
  await page.click('#progOpen');
  const ed = page.locator('.pe');
  await expect(ed.locator('.pe-sp-t b')).toHaveText(['Natation']);
  await expect(ed.locator('.pe-sp-t span')).toHaveText(['Technique · 2 fois · ≈ 30 min']);

  // catalogue : catégories, recherche
  await ed.locator('[data-act="add-sport"]').click();
  const pk = page.locator('.spk');
  await expect(pk).toBeVisible();
  await expect(pk.locator('.pk-it[data-s="natation"]').first()).toHaveClass(/on/);
  await pk.locator('[data-c="combat"]').click();
  await expect(pk.locator('.pk-n')).toHaveText('18 sports');
  await expect(pk.locator('.pk-it').first().locator('b')).toHaveText('Boxe anglaise');
  await pk.locator('[data-c=""]').click();
  await pk.locator('#spkQ').fill('foot');
  await expect(pk.locator('.pk-it').first().locator('b')).toHaveText('Football');
  await pk.locator('.pk-it').first().click();

  // réglages : posé sur le dimanche (seul jour libre), plus intense
  const sh = page.locator('.sps');
  await expect(sh.locator('.st')).toHaveText('Football');
  await expect(sh.locator('[data-day="6"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(sh.locator('.sps-k')).toHaveText('≈ 700 kcal de plus le jour où tu en fais');
  await sh.locator('[data-int="2"]').click();
  await expect(sh.locator('.sps-k')).toHaveText('≈ 950 kcal de plus le jour où tu en fais');
  await sh.locator('[data-act="close"]').click();
  await expect(ed.locator('.pe-s')).toHaveText('4 séances par semaine · natation 2 fois, football 1 fois');
  await expect(ed.locator('.pe-sp-t b')).toHaveText(['Natation', 'Football']);
  await ed.locator('[data-act="close"]').first().click();

  // Sports : une ligne par sport, une coche par séance prévue ; +30 XP ; toucher le sport, ses réglages
  await showView(page, 'sports');
  const foot = page.locator('#sportrows .sport[data-sp="football"]');
  await expect(foot.locator('.s')).toHaveText('≈ 1 h 30 · dim.');
  await foot.locator('.chk').click();
  await expect(foot.locator('.chk')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#spSub')).toHaveText('2 séances sur 3 cette semaine');
  await foot.locator('.sp-open').click();
  await expect(page.locator('.sps .st')).toHaveText('Football');
  await expect(page.locator('.sps [data-int="2"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.sps [data-act="close"]').click();
  await showView(page, 'progress');
  expect(await totalXP(page)).toBe(xp0 + 30);

  // gardé après rechargement : natation dans « swim » comme avant, football dans « sport »
  await page.reload();
  await settle(page, 1200);
  const idb = await readIDB(page);
  const wk = JSON.parse(idb.kv.find((r) => r.k === weekKey(0)).v);
  expect(wk.swim).toEqual([true, false]);
  expect(wk.sport).toEqual({ football: [true] });
  const prog = JSON.parse(idb.kv.find((r) => r.k === 'program').v);
  expect(prog.sports).toEqual([{ id: 'natation', days: [2, 5] }, { id: 'football', days: [6], int: 2 }]);

  // la semaine de la Progression : le dimanche montre le football, coché ; la natation de mercredi aussi
  await showView(page, 'progress');
  await showSub(page, 'progress', 'semaines');
  await expect(page.locator('#wkDays .dy').nth(6)).toHaveAttribute('aria-label', /^Dimanche : Football, c’est fait/);
  await expect(page.locator('#wkDays .dy').nth(2)).toHaveAttribute('aria-label', /^Mercredi : Natation, c’est fait/);
  // « Ajouter » de la partie Sports : le même catalogue
  await showView(page, 'sports');
  await page.click('#spAdd');
  await expect(page.locator('.spk')).toBeVisible();
  await expect(page.locator('.spk .pk-it[data-s="football"]').first()).toHaveClass(/on/);
  await page.locator('.spk [data-act="close"]').click();
  await expect(page.locator('.spk')).toBeHidden();

  // calories du jour : le sport prévu, puis un sport hors programme avec sa durée
  await showView(page, 'nutrition');
  await showSub(page, 'nutrition', 'repas');
  await expect(page.locator('#caltarget')).toHaveText('objectif 2 600 kcal');
  const chips = page.locator('#actchips');
  await expect(chips.locator('button')).toHaveText(['Muscu +250', 'Natation +200', 'Football +950', 'Bras +100', 'Autre sport']);
  await chips.locator('[data-a="sp:football"]').click();
  await expect(page.locator('#caltarget')).toHaveText('objectif 3 550 kcal');
  await chips.locator('[data-a="more"]').click();
  await page.locator('.spk #spkQ').fill('yoga');
  await page.locator('.spk .pk-it').first().click();
  await expect(page.locator('.tr-ask .ask-t')).toHaveText('Yoga');
  await page.click('.tr-ask [data-a="1"]');
  await expect(chips.locator('[data-a="sp:yoga"]')).toHaveText('Yoga +100');
  await expect(page.locator('#caltarget')).toHaveText('objectif 3 650 kcal');
  await chips.locator('[data-a="sp:football"]').click();
  await expect(page.locator('#caltarget')).toHaveText('objectif 2 700 kcal');
  expect(errors).toEqual([]);
  await context.close();
});
