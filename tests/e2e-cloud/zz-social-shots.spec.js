// Captures du social (pas un test : ignoré sans CAPTURES=1), sur le serveur local, à trois téléphones.
//   CAPTURES=1 npx playwright test -c playwright.cloud.config.js tests/e2e-cloud/zz-social-shots.spec.js  ->  .tmp/social/*.png
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { buildData, FIXED_NOW, weekKey, dayStr } from '../fixtures/data-v1.js';
import { seedLocalStorage, showView, settle, openSession } from '../e2e/helpers.js';

test.skip(!process.env.CAPTURES, 'captures seulement sur demande (CAPTURES=1)');
const OUT = '.tmp/social/';
const APP = () => process.env.MS_CLOUD_APP;
const STACK = () => process.env.MS_STACK;
const api = async (path) => (await fetch(STACK() + path)).json();

const RECETTE = {
  id: 'rc-bowl', n: 'Bowl poulet riz brocolis', parts: 2, at: FIXED_NOW - 86400e3 * 3,
  prep: 'Cuire le riz. Saisir le poulet en dés, ajouter les brocolis 4 min. Huile et citron à la fin.',
  items: [
    { n: 'Riz basmati cuit', u: '100 g', k: 130, p: 2.7, g: 28, l: 0.3, q: 3 },
    { n: 'Blanc de poulet', u: '100 g', k: 110, p: 23, g: 0, l: 1.5, q: 3 },
    { n: 'Brocolis', u: '100 g', k: 34, p: 2.8, g: 7, l: 0.4, q: 2 },
    { n: 'Huile d’olive', u: '1 c. à soupe', k: 90, p: 0, g: 0, l: 10, q: 1 },
  ],
};
// Séries notées pour Haut A (lundi) cette semaine, un peu moins lourdes la semaine d'avant : des records
const HAUT_A = [['dc-halteres', [[30, 10], [30, 9], [30, 8]]], ['de-halteres', [[18, 12], [18, 11], [18, 10]]], ['el-halteres', [[10, 16], [10, 15], [10, 14]]],
  ['tv-poulie', [[45, 12], [45, 11], [45, 10]]], ['curl-ez', [[30, 10], [30, 10], [30, 9], [30, 8]]], ['curl-marteau', [[14, 12], [14, 12], [14, 11]]],
  ['pushdown-corde', [[25, 14], [25, 13], [25, 12]]], ['curl-inverse', [[20, 14], [20, 13], [20, 12]]], ['wrist-curl', [[12, 20], [12, 18], [12, 18]]]];
function withLogs(d) {
  const log = (off, less) => Object.fromEntries(HAUT_A.map(([x, sets], i) => ['hautA-' + (i + 1), { x, d: dayStr(off), s: sets.map(([w, r]) => ({ w: i < 2 ? w - less : w, r })) }]));
  const w0 = JSON.parse(d[weekKey(0)]), w1 = JSON.parse(d[weekKey(-1)]);
  w0.log = log(-2, 0); w1.log = log(-9, 2);
  return { ...d, [weekKey(0)]: JSON.stringify(w0), [weekKey(-1)]: JSON.stringify(w1) };
}
async function phone(browser, firstName, extra = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await context.route('https://**', (r) => r.abort());
  let d = buildData();
  d.profile = JSON.stringify({ ...JSON.parse(d.profile), firstName });
  delete d['ai:key'];
  if (extra.logs) { d = withLogs(d); delete extra.logs; }
  await seedLocalStorage(context, { ...d, ...extra });
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto(APP() + '/index.html');
  await settle(page, 1500);
  return page;
}
const shot = async (page, name) => { await page.waitForTimeout(700); await page.screenshot({ path: OUT + name + '.png' }); };
async function signIn(page, email) {
  await showView(page, 'social');
  await page.locator('#soGate [data-so="signin"]').click();
  await page.fill('#accEmail', email); await page.check('#accOk'); await page.click('#accSend');
  await expect(page.locator('#accCode')).toBeVisible();
  const { code } = await api('/__test/outbox?email=' + encodeURIComponent(email));
  await page.fill('#accCode', code);
  await expect(page.locator('#accmodal')).toBeHidden({ timeout: 20000 });
  await expect(page.locator('#soGate')).toContainText('Ton profil social');
}
async function create(page, { bio = '', pub = false, color = null } = {}) {
  await page.locator('#soGate [data-so="create"]').click();
  const ed = page.locator('.so-ed');
  if (bio) await ed.locator('#soEdB').fill(bio);
  if (color != null) await ed.locator(`[data-c="${color}"]`).click();
  if (pub) await ed.locator('#soEdP').check();
  await ed.locator('#soEdOk').check();
  await ed.locator('[data-e="save"]').click();
  await expect(ed).toHaveCount(0);
}
const refresh = async (page) => { await showView(page, 'home'); await showView(page, 'social'); await settle(page, 700); };
const tab = (page, k) => page.locator(k === 'amis' ? '#so-t-amis' : '#so-t-msg').click();
async function follow(page, q, handle) {
  await refresh(page); await tab(page, 'amis');
  await page.fill('#soQ', q);
  await page.locator('#soFound .so-prow', { hasText: '@' + handle }).locator('[data-fol]').click();
  await page.waitForTimeout(500); await page.fill('#soQ', '');
}
async function accept(page, handle, back = true) {
  await refresh(page); await tab(page, 'amis');
  await page.locator('#soPeople .so-prow', { hasText: '@' + handle }).locator('[data-acc]').click();
  await page.waitForTimeout(600);
  if (back) { await page.locator('#soPeople .so-prow', { hasText: '@' + handle }).locator('[data-fol]').click(); await page.waitForTimeout(600); }
}
async function story(page, label, then) {
  await refresh(page);
  const has = await page.locator('#soStories .so-st.me.has').count();
  if (has) { await page.locator('#soStories [data-st="me"]').click(); await page.locator('.so-viewer [data-act="add"]').click(); }
  else await page.locator('#soStories [data-st="me"]').click();
  await page.locator('.so-comp .so-comp-o', { hasText: label }).click();
  if (then) await then(page.locator('.so-comp'));
  await page.locator('.so-comp [data-c="go"]').click();
  await expect(page.locator('.so-comp')).toHaveCount(0);
}
async function chatWith(page, name) {
  await refresh(page); await tab(page, 'msg');
  const row = page.locator('#soInbox [data-chat]', { hasText: name }).first();
  await row.click();
  await expect(page.locator('.so-chat')).toBeVisible();
  await page.waitForTimeout(800);
}
async function say(page, text) {
  await page.locator('.so-chat .so-c-bar textarea').fill(text);
  await page.locator('.so-chat .so-c-send').click();
  await page.waitForTimeout(600);
}
async function sendCard(page, label, then) {
  await page.locator('.so-chat [data-act="card"]').click();
  await page.locator('.so-comp .so-comp-o', { hasText: label }).first().click();
  if (then) await then(page.locator('.so-comp'));
  await page.locator('.so-comp [data-c="go"]').click();
  await page.waitForTimeout(900);
}

test('social', async ({ browser }) => {
  test.setTimeout(300_000);
  mkdirSync(OUT, { recursive: true });
  const S = await phone(browser, 'Sam', { logs: true });
  await showView(S, 'social'); await shot(S, '01-sans-compte');
  await signIn(S, 'sam.shots@exemple.fr'); await shot(S, '02-creer');
  await S.locator('#soGate [data-so="create"]').click();
  await S.locator('.so-ed #soEdB').fill('Prise de masse · 4 séances par semaine');
  await shot(S, '03-editeur');
  await S.locator('.so-ed').evaluate((n) => { const b = n.querySelector('.pe-body') || n; b.scrollTop = b.scrollHeight; });
  await shot(S, '03b-editeur-regles');
  await S.locator('.so-ed #soEdOk').check(); await S.locator('.so-ed [data-e="save"]').click();
  await expect(S.locator('.so-ed')).toHaveCount(0);
  await shot(S, '04-vide');
  await tab(S, 'amis'); await shot(S, '04b-amis-vide'); await tab(S, 'msg');

  const L = await phone(browser, 'Léa', { recettes: JSON.stringify([RECETTE]) });
  await signIn(L, 'lea.shots@exemple.fr'); await create(L, { bio: 'Powerlifting et bons petits plats', pub: true, color: 5 });
  const M = await phone(browser, 'Malik', { logs: true });
  await signIn(M, 'malik.shots@exemple.fr'); await create(M, { color: 2 });
  const I = await phone(browser, 'Inès');
  await signIn(I, 'ines.shots@exemple.fr'); await create(I, { color: 6 });

  await follow(L, 'sam', 'sam'); await follow(M, 'sam', 'sam'); await follow(I, 'sam', 'sam');
  await refresh(S); await tab(S, 'amis'); await shot(S, '05-demandes');
  await S.fill('#soQ', 'le'); await settle(S, 900); await shot(S, '05b-recherche'); await S.fill('#soQ', '');
  await accept(S, 'lea'); await accept(S, 'malik'); await accept(S, 'ines', false);
  await accept(M, 'sam', false);

  // stories des amis
  await story(L, 'Un mot', async (c) => { await c.locator('.so-comp-t').fill('Objectif de l’été : 100 kg au développé couché. On y va 💪'); await c.locator('[data-bg="3"]').click(); await c.locator('[data-c="text"]').click(); });
  await story(L, 'Mon rang');
  await story(M, 'Ma dernière séance');
  await refresh(S); await tab(S, 'msg'); await shot(S, '06-accueil-social');
  await tab(S, 'amis'); await shot(S, '06b-amis'); await tab(S, 'msg');

  // Sam partage sa séance en story
  await S.locator('#soStories [data-st="me"]').click(); await shot(S, '07-partager');
  await S.locator('.so-comp .so-comp-o', { hasText: 'Ma dernière séance' }).click(); await shot(S, '08-apercu-seance');
  await S.locator('.so-comp [data-c="back"]').click();
  await S.locator('.so-comp .so-comp-o', { hasText: 'Un mot' }).click();
  await S.locator('.so-comp .so-comp-t').fill('3 semaines sans en rater une. Qui me suit ?');
  await S.locator('.so-comp [data-bg="1"]').click(); await shot(S, '08b-texte');
  await S.locator('.so-comp [data-c="back"]').click();
  await S.locator('.so-comp .so-comp-o', { hasText: 'Ma dernière séance' }).click();
  await S.locator('.so-comp [data-c="go"]').click(); await expect(S.locator('.so-comp')).toHaveCount(0);

  // les stories de Malik puis de Léa
  await refresh(S);
  await S.locator('#soStories .so-st', { hasText: 'Malik' }).click();
  await S.locator('.so-viewer').evaluate(() => {});
  await shot(S, '09-story-seance');
  await S.locator('.so-viewer [data-react="💪"]').click(); await settle(S, 400);
  await S.locator('.so-viewer [data-act="next"]').click(); await shot(S, '10-story-texte');
  await S.locator('.so-viewer [data-act="next"]').click(); await shot(S, '10b-story-rang');
  await S.locator('.so-viewer [data-act="close"]').click();
  await S.locator('#soStories [data-st="me"]').click(); await shot(S, '10c-ma-story');
  await S.locator('.so-viewer [data-act="close"]').click();

  // messages : Léa envoie sa recette, Sam son programme
  await chatWith(L, 'Sam');
  await sendCard(L, 'Une recette', async (c) => { await c.locator('[data-r]').first().click(); });
  await say(L, 'Ma recette du dimanche : 45 g de protéines la part 😋');
  await chatWith(S, 'Léa');
  await say(S, 'Merci ! Tiens, mon programme sur 4 jours');
  await sendCard(S, 'Mon programme');
  await shot(S, '11-conversation');
  await S.locator('.so-chat .so-b.them.card [data-imp="recette"]').click(); await settle(S, 300);
  await shot(S, '12-recette-ajoutee');
  await S.locator('.so-chat [data-act="card"]').click(); await shot(S, '12b-choisir-carte');
  await S.locator('.so-comp [data-c="close"]').click();
  await S.locator('.so-chat [data-act="who"]').click(); await shot(S, '13-profil-ami');
  await S.locator('.so-prof [data-p="more"]').click(); await shot(S, '14-menu-ami');
  await S.locator('.so-menu [data-k="report"]').click(); await S.locator('.so-rep input[value="spam"]').check(); await shot(S, '15-signaler');
  await S.locator('.so-rep [data-r="close"]').click();
  await S.locator('.so-chat [data-act="close"]').click();

  // Malik écrit pendant que Sam est sur l'accueil : pastilles
  await chatWith(M, 'Sam'); await say(M, 'Grosse séance hier, bravo pour la série !');
  await refresh(S); await tab(S, 'msg'); await shot(S, '16-messages');
  await S.locator('#soMe').click(); await shot(S, '17-mon-profil'); await S.locator('.so-prof [data-m="close"]').click();
  await showView(S, 'home'); await S.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await settle(S, 1200);
  await shot(S, '18-accueil-pastille');

  // « Séance validée » : Partager
  const card = await openSession(S, 'basA');
  await card.locator('.ex-row[data-eid="basA-5"] .chk').click();
  await card.locator('.ex-row[data-eid="basA-6"] .chk').click();
  await expect(S.locator('#moShare')).toBeVisible();
  await S.waitForTimeout(1200); await shot(S, '19-seance-validee');
  await S.locator('#moShare').click(); await shot(S, '20-partager-seance');
});
