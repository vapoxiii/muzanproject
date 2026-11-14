// Training au jour le jour : l'entrée, c'est aujourd'hui. Ren propose une séance d'après le programme
// et ce qui est déjà fait ; les cartes des séances glissent pour en choisir une autre ; « C'est parti »
// ouvre la séance. Données de l'ancienne app (semaine en cours : Haut A cochée sans séries, Bas A
// commencée, natation de mercredi faite), horloge figée un jour donné.
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW, weekKey, dayStr } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, collectErrors, settle } from './helpers.js';

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

const DAY = 86400000;
async function open(browser, { day = 0, data = buildData() } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await offlineThirdParties(context, srv.url);
  await seedLocalStorage(context, data);
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(FIXED_NOW.getTime() + day * DAY));
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await settle(page, 1200);
  return { context, page, errors };
}
// la semaine en cours, retouchée : coches (exercices faits par séance) et séries notées
function withWeek(fn) {
  const data = buildData(), st = JSON.parse(data[weekKey(0)]);
  fn(st);
  data[weekKey(0)] = JSON.stringify(st);
  return data;
}
const tick = (st, id, n) => { st.training[id] = st.training[id].map((_, i) => i < n); };
const logged = (st, eid, x, d) => { st.log = st.log || {}; st.log[eid] = { x, d, s: [{ w: 20, r: 10 }] }; };
const nb = (s) => s.replace(/[  ]/g, ' ');
const say = async (page) => nb(await page.locator('#thSay').textContent());
const chips = (page) => page.locator('#trCards .tc .tc-st').allTextContents();
const centered = (page) => page.locator('#trCards .tc.cur').getAttribute('data-sid');

test('un jour sans muscu : le sport prévu, puis « je m’entraîne quand même » et les cartes', async ({ browser }) => {
  const { context, page, errors } = await open(browser);                   // mercredi : natation, déjà faite
  await showView(page, 'training');
  const hub = page.locator('#trHub');
  await expect(hub).toBeVisible();
  await expect(hub).toHaveAttribute('data-pose', 'forme');
  await expect(page.locator('#thDate')).toHaveText('Mercredi 21 octobre');
  await expect(page.locator('#trmeta')).toHaveText('1 séance sur 4 cette semaine');
  await expect(page.locator('#thPips i')).toHaveCount(4);
  await expect(page.locator('#thPips i.on')).toHaveCount(1);
  expect(await say(page)).toBe('Aujourd’hui, natation : c’est fait. Pas de muscu prévue.');
  const rest = page.locator('#thRest');
  await expect(rest).toBeVisible();
  await expect(rest.locator('.tc-n')).toHaveText('Natation');
  await expect(rest.locator('.tc-sub')).toHaveText('C’est fait');
  expect(nb(await rest.locator('.tc-meta').textContent())).toBe('Prochaine séance : Haut B, demain');
  await expect(page.locator('#trCards')).toBeHidden();
  const go = page.locator('#trGo');
  await expect(go).toHaveText('Je m’entraîne quand même');
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);

  // les cartes : chaque séance du programme et où elle en est ; Ren propose la prochaine
  await go.click();
  await expect(page.locator('#trCards')).toBeVisible();
  await expect(page.locator('#trCards .tc .tc-n')).toHaveText(['Haut A', 'Bas A', 'Haut B', 'Bas B', 'Bras Express']);
  expect(await chips(page)).toEqual(['Faite cette semaine', 'À rattraper', 'Prévue jeudi', 'Prévue vendredi', 'En bonus']);
  expect(await centered(page)).toBe('hautB');
  expect(await say(page)).toBe('Alors Haut B : tirage et bras. Elle reste à faire cette semaine.');
  await expect(go).toHaveText('C’est parti');
  await expect(page.locator('#thBack')).toHaveText('Revenir au repos');
  await expect(page.locator('#trCards .tc[data-sid="basA"] .tc-meta')).toContainText('4 sur 7 exercices faits');

  // au clavier : une carte à gauche, Bas A, commencée
  await page.locator('#trCards .tc.cur').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#trCards .tc[data-sid="basA"]')).toHaveClass(/\bcur\b/);
  await expect(page.locator('#trCards .tc[data-sid="basA"]')).toBeFocused();
  await expect.poll(() => say(page)).toBe('Bas A est en cours : 4 exercices sur 7.');
  await expect(go).toHaveText('Reprendre la séance');
  await expect(go).toHaveAttribute('aria-label', 'Reprendre la séance : Bas A');
  await expect(page.locator('#thBack')).toHaveText('Proposition de Ren');
  // retour à la proposition, puis au repos
  await page.locator('#thBack').click();
  await expect(page.locator('#trCards .tc[data-sid="hautB"]')).toHaveClass(/\bcur\b/);
  await expect(page.locator('#thBack')).toHaveText('Revenir au repos');
  await page.locator('#thBack').click();
  await expect(rest).toBeVisible();
  await expect(go).toHaveText('Je m’entraîne quand même');

  // toucher une carte de côté la centre ; la toucher au centre ouvre la séance
  await go.click();
  const basA = page.locator('#trCards .tc[data-sid="basA"]');
  await basA.dispatchEvent('click');
  await expect(basA).toHaveClass(/\bcur\b/);
  await basA.dispatchEvent('click');
  const ps = page.locator('#v-training > .ps');
  await expect(ps).toBeVisible();
  await expect(hub).toBeHidden();
  await expect(page.locator('#trSesT')).toHaveText('Bas A');
  await expect(page.locator('#trSesT')).toBeFocused();
  await expect(page.locator('#trSesS')).toHaveText('À rattraper');
  await expect(page.locator('#sessions .card')).toHaveCount(1);
  await expect(page.locator('#sessions .card[data-sid="basA"] .cnt')).toHaveText('4/7');
  await expect(page.locator('#sessions .card .chd .n')).toHaveText('Jambes');
  await expect(page.locator('#sessions .ex-row')).toHaveCount(7);
  // cocher un exercice : la carte suit
  await page.locator('#sessions .ex-row').nth(4).locator('.chk').click();
  await expect(page.locator('#sessions .card .cnt')).toHaveText('5/7');
  // le retour : l'entrée, Bas A toujours au centre
  await page.locator('#v-training [data-back]').click();
  await expect(hub).toBeVisible();
  await expect(page.locator('#v-training .ph-t')).toBeFocused();
  await expect(basA).toHaveClass(/\bcur\b/);
  await expect(basA).toHaveAttribute('data-done', '5');
  // revenir dans Training depuis l'accueil : la proposition de Ren, de nouveau
  await showView(page, 'home');
  await showView(page, 'training');
  await expect(rest).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});

test('le jour d’une séance : Ren la propose ; faite aujourd’hui, il annonce la suivante', async ({ browser }) => {
  // jeudi : Haut B prévue
  let { context, page, errors } = await open(browser, { day: 1 });
  await showView(page, 'training');
  await expect(page.locator('#trHub')).toHaveAttribute('data-pose', 'concentre');
  expect(await say(page)).toBe('Aujourd’hui, c’est Haut B : tirage et bras. On y va ?');
  expect(await centered(page)).toBe('hautB');
  await expect(page.locator('#trCards .tc[data-sid="hautB"] .tc-st')).toHaveText('Aujourd’hui');
  await expect(page.locator('#thBack')).toBeHidden();
  await expect(page.locator('#thHint')).toHaveText('Glisse pour changer de séance');
  await page.click('#trGo');
  await expect(page.locator('#trSesT')).toHaveText('Haut B');
  await expect(page.locator('#trSesS')).toHaveText('Séance du jour');
  expect(errors).toEqual([]);
  await context.close();

  // la tuile de l'accueil ouvre la séance du jour directement
  ({ context, page, errors } = await open(browser, { day: 1 }));
  await page.click('#goalB');
  await expect(page.locator('#v-training > .ps')).toBeVisible();
  await expect(page.locator('#trSesT')).toHaveText('Haut B');
  await context.close();

  // Haut B faite aujourd'hui (séries notées jeudi), Haut A lundi : Ren annonce Bas B pour demain
  const data = withWeek((st) => {
    tick(st, 'hautB', 9);
    logged(st, 'hautB-1', 'di-halteres', dayStr(1));
    logged(st, 'hautA-1', 'dc-halteres', dayStr(-2));
  });
  ({ context, page, errors } = await open(browser, { day: 1, data }));
  await showView(page, 'training');
  await expect(page.locator('#trHub')).toHaveAttribute('data-pose', 'zone');
  expect(await say(page)).toBe('Haut B, c’est fait. Prochaine : Bas B, demain.');
  expect(await centered(page)).toBe('hautB');
  expect(await chips(page)).toEqual(['Faite lundi', 'À rattraper', 'Faite aujourd’hui', 'Prévue vendredi', 'En bonus']);
  await expect(page.locator('#trGo')).toHaveText('Voir la séance');
  await expect(page.locator('#trGo')).toHaveClass(/\bsec\b/);
  await expect(page.locator('#trmeta')).toHaveText('2 séances sur 4 cette semaine');
  // une autre séance : on peut l'avancer
  await page.locator('#trCards .tc[data-sid="basB"]').dispatchEvent('click');
  await expect.poll(() => say(page)).toBe('Bas B est prévue demain. Tu l’avances ?');
  await expect(page.locator('#thBack')).toHaveText('Séance du jour');
  expect(errors).toEqual([]);
  await context.close();
});

test('séance du jour déjà faite, semaine bouclée, coach Aya', async ({ browser }) => {
  // jeudi, Haut B faite mercredi : Ren propose la suivante
  let data = withWeek((st) => { tick(st, 'hautB', 9); logged(st, 'hautB-1', 'di-halteres', dayStr(0)); });
  let { context, page, errors } = await open(browser, { day: 1, data });
  await showView(page, 'training');
  expect(await say(page)).toBe('Haut B est déjà faite. Je te propose Bas B : jambes.');
  expect(await centered(page)).toBe('basB');
  await expect(page.locator('#trCards .tc[data-sid="hautB"] .tc-st')).toHaveText('Faite mercredi');
  expect(errors).toEqual([]);
  await context.close();

  // samedi, les quatre séances faites, natation prévue : la carte du sport ; en bonus, Bras Express
  data = withWeek((st) => { tick(st, 'basA', 7); tick(st, 'hautB', 9); tick(st, 'basB', 6); });
  ({ context, page, errors } = await open(browser, { day: 3, data }));
  await showView(page, 'training');
  await expect(page.locator('#thRest .tc-st')).toHaveText('Semaine bouclée');
  expect(await say(page)).toBe('4 sur 4 cette semaine ! Aujourd’hui, natation.');
  await page.click('#trGo');
  expect(await centered(page)).toBe('brasX');
  expect(await say(page)).toBe('4 sur 4 cette semaine ! Bras Express en bonus, si tu veux.');
  await expect(page.locator('#trHub')).toHaveAttribute('data-pose', 'zone');
  expect(errors).toEqual([]);
  await context.close();

  // coach Aya, exigeante : pas d'illustration de Ren, son nom dans la bulle, son ton
  data = buildData();
  data.coach = JSON.stringify({ id: 'aya', tone: 'exigeant' });
  ({ context, page, errors } = await open(browser, { day: 1, data }));
  await showView(page, 'training');
  await expect(page.locator('#trHub')).toHaveClass(/\bno-fig\b/);
  await expect(page.locator('#thWho')).toHaveText('Aya');
  expect(await say(page)).toBe('Aujourd’hui, Haut B : tirage et bras. Pas d’excuse.');
  await page.locator('#trCards .tc[data-sid="basB"]').dispatchEvent('click');
  await expect(page.locator('#thBack')).toHaveText('Proposition d’Aya');
  expect(errors).toEqual([]);
  await context.close();
});
