// Le social, de bout en bout, sur deux téléphones (deux navigateurs, deux comptes) et le serveur local :
// profil (@pseudo, compte privé), demande d'abonnement acceptée, abonnement mutuel, story (rang) vue et
// réaction reçue en message, programme partagé puis ajouté chez l'autre, message texte, blocage.
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { seedLocalStorage, showView, collectErrors, settle, readIDB, openSession } from '../e2e/helpers.js';

const APP = () => process.env.MS_CLOUD_APP;
const STACK = () => process.env.MS_STACK;
const api = async (path, init) => (await fetch(STACK() + path, init)).json();

function seed(firstName) {
  const d = buildData();
  d.profile = JSON.stringify({ ...JSON.parse(d.profile), firstName });
  delete d['ai:key'];
  return d;
}
async function phone(browser, firstName) {
  const context = await browser.newContext();
  await context.route('https://**', (r) => r.abort());
  await seedLocalStorage(context, seed(firstName));
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  const errors = collectErrors(page);
  await page.goto(APP() + '/index.html');
  await settle(page, 1500);
  return { context, page, errors };
}
async function signIn(page, email) {
  await showView(page, 'social');
  await expect(page.locator('#soGate')).toContainText('Retrouve tes amis sur Grind');
  await page.locator('#soGate [data-so="signin"]').click();
  await page.fill('#accEmail', email);
  await page.check('#accOk');
  await page.click('#accSend');
  await expect(page.locator('#accCode')).toBeVisible();
  const { code } = await api('/__test/outbox?email=' + encodeURIComponent(email));
  await page.fill('#accCode', code);
  await expect(page.locator('#accmodal')).toBeHidden({ timeout: 20000 });
}
async function createProfile(page, handle) {
  await expect(page.locator('#soGate')).toContainText('Ton profil social');
  await page.locator('#soGate [data-so="create"]').click();
  const ed = page.locator('.so-ed');
  await expect(ed.locator('#soEdH')).toHaveValue(handle);           // proposé d'après le prénom
  await ed.locator('[data-e="save"]').click();
  await expect(page.locator('#trToast')).toHaveText('Coche la case des règles pour continuer');
  await ed.locator('#soEdOk').check();
  await ed.locator('[data-e="save"]').click();
  await expect(ed).toHaveCount(0);
  await expect(page.locator('#soSub')).toHaveText('@' + handle + ' · compte privé');
}
const refresh = async (page) => { await showView(page, 'home'); await showView(page, 'social'); await settle(page, 600); };
const tab = (page, k) => page.locator(k === 'amis' ? '#so-t-amis' : '#so-t-msg').click();

test.describe.serial('social', () => {
  let A, B;

  test('deux profils, une demande acceptée, puis on se suit l’un l’autre', async ({ browser }) => {
    A = await phone(browser, 'Alex');
    B = await phone(browser, 'Béa');
    await signIn(A.page, 'alex.social@exemple.fr');
    await createProfile(A.page, 'alex');
    await signIn(B.page, 'bea.social@exemple.fr');
    await createProfile(B.page, 'bea');

    // Béa cherche Alex et demande à le suivre (compte privé)
    await tab(B.page, 'amis');
    await B.page.fill('#soQ', '@ale');
    const found = B.page.locator('#soFound .so-prow', { hasText: '@alex' });
    await expect(found).toBeVisible();
    await found.locator('[data-fol]').click();
    await expect(B.page.locator('#trToast')).toHaveText('Demande envoyée');
    await expect(B.page.locator('#soPeople')).toContainText('Demandes envoyées');

    // Alex : une pastille sur le menu, la demande dans Amis ; il accepte puis suit Béa en retour
    await refresh(A.page);
    await expect(A.page.locator('#soNReq')).toHaveText('1');
    await expect(A.page.locator('#menuBtn .nv-dot')).toBeVisible();
    await tab(A.page, 'amis');
    const req = A.page.locator('#soPeople .so-prow', { hasText: '@bea' });
    await req.locator('[data-acc]').click();
    await expect(A.page.locator('#trToast')).toHaveText('Demande acceptée');
    await A.page.locator('#soPeople .so-prow', { hasText: '@bea' }).locator('[data-fol]').click();
    await expect(A.page.locator('#trToast')).toHaveText('Demande envoyée');

    // Béa accepte : amis
    await refresh(B.page);
    await tab(B.page, 'amis');
    await B.page.locator('#soPeople .so-prow', { hasText: '@alex' }).locator('[data-acc]').click();
    await expect(B.page.locator('#soPeople')).toContainText('Amis');
    await expect(B.page.locator('#soPeople .so-prow', { hasText: '@alex' }).locator('[data-chat]')).toBeVisible();
    expect(A.errors).toEqual([]);
    expect(B.errors).toEqual([]);
  });

  test('story : Alex partage son rang, Béa la voit et réagit, la réaction arrive en message', async () => {
    const a = A.page, b = B.page;
    await refresh(a);
    await a.locator('#soStories [data-st="me"]').click();
    const comp = a.locator('.so-comp');
    await comp.locator('.so-comp-o', { hasText: 'Mon rang' }).click();
    await expect(comp.locator('.sc-rang .sc-rank b')).toHaveText('C');
    await comp.locator('[data-c="go"]').click();
    await expect(a.locator('#trToast')).toHaveText('Story publiée pour 24 h');

    await refresh(b);
    const bubble = b.locator('#soStories .so-st.new', { hasText: 'Alex' });
    await expect(bubble).toBeVisible();
    await bubble.click();
    const v = b.locator('.so-viewer');
    await expect(v.locator('.sc-rang')).toContainText('Confirmé');
    await v.locator('[data-react="🔥"]').click();
    await expect(b.locator('#trToast')).toHaveText('Réaction envoyée 🔥');
    await v.locator('[data-act="close"]').click();
    await expect(b.locator('#soStories .so-st', { hasText: 'Alex' })).not.toHaveClass(/new/);

    await refresh(a);
    await expect(a.locator('#soNMsg')).toHaveText('1');
    await tab(a, 'msg');
    const conv = a.locator('#soInbox .so-row', { hasText: 'Béa' });
    await expect(conv).toContainText('a réagi 🔥');
    await conv.click();
    const chat = a.locator('.so-chat');
    await expect(chat.locator('.so-b.them.react')).toContainText('🔥');
    await expect(chat.locator('.so-b-reply')).toContainText('Réponse à ta story · Rang C atteint');
  });

  test('message : Alex envoie son programme, Béa l’ajoute chez elle et répond', async () => {
    const a = A.page, b = B.page;
    const chat = a.locator('.so-chat');
    await chat.locator('[data-act="card"]').click();
    const comp = a.locator('.so-comp');
    await comp.locator('.so-comp-o', { hasText: 'Mon programme' }).click();
    await expect(comp.locator('.sc-programme')).toContainText('Haut A');
    await comp.locator('[data-c="go"]').click();
    await expect(chat.locator('.so-b.me.card .sc-programme')).toBeVisible();

    await refresh(b);
    await tab(b, 'msg');
    await b.locator('#soInbox .so-row', { hasText: 'Alex' }).click();
    const bc = b.locator('.so-chat');
    const card = bc.locator('.so-b.them.card');
    await expect(card.locator('.sc-programme')).toContainText('5 séances');
    await card.locator('[data-imp="programme"]').click();
    await b.locator('.tr-ask [data-a="1"]').click();
    await expect(b.locator('#trToast')).toHaveText('5 séances ajoutées à ton programme');
    const prog = JSON.parse((await readIDB(b)).kv.find((r) => r.k === 'program').v);
    expect(prog.sessions.map((s) => s.name).slice(-5)).toEqual(['Haut A (@alex)', 'Bas A (@alex)', 'Haut B (@alex)', 'Bas B (@alex)', 'Bras Express (@alex)']);
    expect(prog.sessions.slice(-5).every((s) => s.days.length === 0)).toBe(true);

    await bc.locator('.so-c-bar textarea').fill('Merci, je teste Haut B ce soir !');
    await bc.locator('.so-c-send').click();
    await expect(bc.locator('.so-b.me .so-b-t')).toHaveText('Merci, je teste Haut B ce soir !');
    // Alex reçoit le message sans rien toucher (la conversation se met à jour toute seule)
    await expect(chat.locator('.so-b.them .so-b-t')).toHaveText('Merci, je teste Haut B ce soir !', { timeout: 15000 });
    await expect(chat.locator('.so-c-seen')).toHaveCount(0);
    await expect(bc.locator('.so-c-seen')).toHaveText('Vu', { timeout: 15000 });
  });

  test('« Séance validée » : Partager, puis la séance arrive chez un ami', async () => {
    const a = A.page, b = B.page;
    await b.locator('.so-chat [data-act="close"]').click();
    const card = await openSession(b, 'basA');                       // 4 exercices cochés sur 7 : il en faut 6
    await card.locator('.ex-row[data-eid="basA-5"] .chk').click();
    await card.locator('.ex-row[data-eid="basA-6"] .chk').click();
    await expect(b.locator('#moment')).toBeVisible();
    await expect(b.locator('#moment')).toHaveClass(/can-share/);
    await b.locator('#moShare').click();
    await expect(b.locator('#moment')).toBeHidden();
    const menu = b.locator('.so-menu');
    await expect(menu.locator('.st')).toHaveText('Partager « Séance · Bas A »');
    await menu.locator('[data-k^="to:"]', { hasText: 'Alex' }).click();
    await expect(b.locator('#trToast')).toHaveText('Envoyé à Alex');
    // chez Alex, dans la conversation ouverte : la séance cochée, exercice par exercice
    const got = a.locator('.so-chat .so-b.them.card .sc-seance');
    await expect(got).toContainText('Bas A', { timeout: 15000 });
    await expect(got).toContainText('6 exercices');
    await expect(got.locator('.sc-ok').first()).toHaveText('fait');
    await expect(a.locator('.so-chat .so-b.them.card [data-imp="seance"]')).toBeVisible();
    // Béa retourne à sa conversation avec Alex
    await refresh(b); await tab(b, 'msg');
    await b.locator('#soInbox .so-row', { hasText: 'Alex' }).click();
    await expect(b.locator('.so-chat')).toBeVisible();
  });

  test('bloquer : la conversation ne peut plus continuer, plus de story', async () => {
    const a = A.page, b = B.page;
    await b.locator('.so-chat [data-act="more"]').click();
    await b.locator('.so-menu [data-k="block"]').click();
    await b.locator('.tr-ask [data-a="1"]').click();
    await expect(b.locator('#trToast')).toHaveText('Alex est bloqué');
    await expect(b.locator('.so-chat')).toHaveCount(0);
    await expect(b.locator('#soStories .so-st', { hasText: 'Alex' })).toHaveCount(0);
    await expect(b.locator('#soInbox')).not.toContainText('Alex');
    // chez Alex : plus possible d'écrire
    await a.locator('.so-chat [data-act="close"]').click();
    await refresh(a);
    await expect(a.locator('#soInbox .so-row', { hasText: 'Béa' })).toHaveCount(0);
    await tab(a, 'amis');
    await a.fill('#soQ', 'bea');
    await expect(a.locator('#soFound')).toContainText('Personne ne correspond');
    expect(A.errors).toEqual([]);
    expect(B.errors).toEqual([]);
  });
});
