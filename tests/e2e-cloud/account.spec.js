// Compte et synchronisation, de bout en bout, sur deux « téléphones » (deux navigateurs)
// et un serveur local : connexion par code, reprise des données sur un nouvel appareil,
// modifications propagées, IA avec quota, photos, hors ligne, déconnexion, suppression.
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW, dayStr, weekKey } from '../fixtures/data-v1.js';
import { seedLocalStorage, showView, showSub, viewText, collectErrors, settle, VIEWS, openSession } from '../e2e/helpers.js';

const APP = () => process.env.MS_CLOUD_APP;
const STACK = () => process.env.MS_STACK;
const EMAIL = 'alex.test@exemple.fr';
const api = async (path, init) => (await fetch(STACK() + path, init)).json();

async function phone(browser, { seed } = {}) {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.route('https://**', (r) => r.abort());          // rien d'extérieur pendant les tests
  if (seed) await seedLocalStorage(context, seed);
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  page.on('dialog', (d) => d.accept());
  const errors = collectErrors(page);
  await page.goto(APP() + '/index.html');
  await settle(page, 1500);
  return { context, page, errors };
}

async function enterCode(page, email) {
  await expect(page.locator('#accEmail')).toBeVisible();
  await page.fill('#accEmail', email);
  await page.check('#accOk');
  await page.click('#accSend');
  await expect(page.locator('#accCode')).toBeVisible();
  const { code } = await api('/__test/outbox?email=' + encodeURIComponent(email));
  expect(code).toMatch(/^\d{6}$/);
  await page.fill('#accCode', code);                              // envoi automatique à 6 chiffres
}

async function texts(page) {
  const out = {};
  for (const v of VIEWS) { await showView(page, v); out[v] = await viewText(page, v); }
  return out;
}

test.describe.serial('compte et synchronisation', () => {
  let A, B, textsA;

  test('premier téléphone : connexion depuis le Profil, ses données partent sur le compte', async ({ browser }) => {
    A = await phone(browser, { seed: buildData() });
    const p = A.page;
    await showView(p, 'profile');
    await expect(p.locator('#pfAccount')).toBeVisible();
    await expect(p.locator('#accS')).toHaveText('Non connectée');
    await p.click('#accB');
    // le consentement est obligatoire
    await p.fill('#accEmail', EMAIL);
    await p.click('#accSend');
    await expect(p.locator('#accMsg')).toContainText('Coche la case');
    await enterCode(p, EMAIL);
    await expect(p.locator('#accDoneT')).toContainText('sauvegardées');
    await expect(p.locator('#accmodal')).toBeHidden();
    await expect(p.locator('#accS')).toHaveText(EMAIL);
    await expect(p.locator('#accSyncS')).toContainText('À jour');
    await expect(p.locator('#accAiS')).toHaveText('0 sur 3 aujourd’hui');
    await expect(p.locator('#pfFoot')).toContainText('synchronisées avec ton compte');
    const kv = await api('/__test/kv?email=' + EMAIL);
    const keys = kv.map((r) => r.key);
    for (const k of ['bodylog', 'foodlib', 'foodlog', 'profile', 'onb:done', 'calbase', 'dayact']) expect(keys).toContain(k);
    expect(keys.filter((k) => k.startsWith('fitweek:'))).toHaveLength(4);
    expect(keys).not.toContain('ai:key');
    expect(keys).not.toContain('photos');
    textsA = await texts(p);
    expect(A.errors).toEqual([]);
  });

  test('nouveau téléphone : « J’ai déjà un compte » dès l’accueil, tout est récupéré', async ({ browser }) => {
    B = await phone(browser);
    const p = B.page;
    await expect(p.locator('#onb')).toBeVisible();
    await expect(p.locator('#oqAlt')).toHaveText('J’ai déjà un compte ou une sauvegarde');
    await p.click('#oqAlt');
    await expect(p.locator('#accFile')).toBeVisible();
    await p.evaluate(() => { window.__avant = 1; });
    await enterCode(p, EMAIL);
    await p.waitForFunction(() => !window.__avant && document.readyState === 'complete', null, { timeout: 20000 });
    await settle(p, 1500);
    await expect(p.locator('#onb')).toBeHidden();
    const t = await texts(p);
    expect.soft(t.training, 'training').toBe(textsA.training);
    expect.soft(t.nutrition, 'nutrition').toBe(textsA.nutrition);
    // les photos ne suivent pas tant que leur sauvegarde n'est pas activée (et l'XP des photos non plus)
    const noXP = (x) => x.split('\n').filter((l) => !/XP/.test(l)).join('\n');
    expect.soft(noXP(t.home), 'home').toBe(noXP(textsA.home));
    // Progression, catégorie Corps (affichée d'office) : mesures identiques
    const corps = (x) => x.slice(x.indexOf('Poids'));
    expect(corps(t.progress)).toBe(corps(textsA.progress));
    await expect(A.page.locator('#photometa')).toHaveText('2 photos');
    await expect(p.locator('#photometa')).toHaveText('aucune photo');
    // Profil : l'IA passe par le compte (clé perso sur A, jamais synchronisée)
    expect(t.profile).toContain('Incluse avec ton compte');
    expect(textsA.profile).toContain('Clé personnelle');
    expect(B.errors).toEqual([]);
  });

  test('une pesée faite sur A arrive sur B', async () => {
    await showView(A.page, 'body');
    await A.page.fill('#in_w', '75,4');
    await A.page.click('#addm');
    await expect.poll(async () => {
      const row = (await api('/__test/kv?email=' + EMAIL)).find((r) => r.key === 'bodylog');
      return JSON.parse(row.value).find((e) => e.d === dayStr(0)).w;
    }, { timeout: 15000 }).toBe(75.4);
    await showView(B.page, 'profile');
    await B.page.click('#accSyncB');
    await expect(B.page.locator('#syncBanner')).toBeVisible();
    await B.page.evaluate(() => { window.__avant = 1; });
    await B.page.click('#syncBanner button');
    await B.page.waitForFunction(() => !window.__avant && document.readyState === 'complete');
    await settle(B.page, 1500);
    await showView(B.page, 'body');
    expect(await viewText(B.page, 'body')).toContain('75,4 kg');
  });

  test('le programme modifié et les séries notées sur A arrivent sur B', async () => {
    const p = A.page;
    await showView(p, 'training');
    await p.click('#progOpen');
    await p.click('[data-open="hautA"]');
    await p.click('[data-act="pick"]');
    await p.fill('#pkQ', 'face pull');
    await p.locator('.pk-it[data-x="face-pull"]').click();
    await p.locator('.pk-done').click();
    await p.click('.pe-ok');
    await openSession(p, 'hautB');
    await p.locator('.ex-row[data-eid="hautB-1"] .exi').click();
    const first = p.locator('.lg[data-eid="hautB-1"] .lg-sets .ls').first();
    await first.locator('[data-f="w"]').fill('20');
    await first.locator('[data-f="r"]').fill('11');
    await first.locator('[data-ok]').click();
    await p.locator('.rr [data-a="skip"]').click();          // l'écran de repos : passé
    await expect.poll(async () => {
      const rows = await api('/__test/kv?email=' + EMAIL);
      const prog = rows.find((r) => r.key === 'program'), wk = rows.find((r) => r.key === weekKey(0));
      return !!prog && JSON.parse(prog.value).sessions[0].ex.some((e) => e.x === 'face-pull')
        && !!wk && JSON.parse(wk.value).log?.['hautB-1']?.s?.[0]?.w === 20;
    }, { timeout: 15000 }).toBe(true);
    await showView(B.page, 'profile');
    await B.page.click('#accSyncB');
    await expect(B.page.locator('#syncBanner')).toBeVisible();
    await B.page.evaluate(() => { window.__avant = 1; });
    await B.page.click('#syncBanner button');
    await B.page.waitForFunction(() => !window.__avant && document.readyState === 'complete');
    await settle(B.page, 1500);
    const hautA = await openSession(B.page, 'hautA');
    await expect(hautA.locator('.ex-row').last()).toContainText('Face pull');
    await openSession(B.page, 'hautB');
    await expect(B.page.locator('.ex-row[data-eid="hautB-1"] .ex-chip')).toHaveText('1/3');
  });

  test('analyse IA avec le compte : 3 par jour, puis message clair', async () => {
    const p = B.page;
    await showView(p, 'nutrition');
    await showSub(p, 'nutrition', 'repas');
    for (let i = 1; i <= 3; i++) {
      await p.click('#aibtn');
      await p.fill('#aitext', 'pâtes bolo avec du parmesan ' + i);
      await p.click('#aigo');
      await expect(p.locator('#aititle')).toHaveText('Pâtes bolognaise');
      await expect(p.locator('.qblock')).toHaveCount(2);
      // glucides et lipides de l'estimation : la base et la portion du milieu de chaque question
      await expect(p.locator('#aiestim .ep')).toHaveText('33 g de protéines · 96 g de glucides · 33 g de lipides');
      await p.click('#aistep2 .aibtn');
      await expect(p.locator('#aimodal')).toBeHidden();
    }
    await expect(p.locator('#meallog')).toContainText('Pâtes bolognaise');
    // horloge figée : les trois repas ont le même identifiant, donc une ligne en quantité 3
    await expect(p.locator('#meallog .ml', { hasText: 'Pâtes bolognaise' }).locator('.mmc')).toHaveText('P 99 · G 288 · L 99');
    await p.click('#aibtn');
    await p.fill('#aitext', 'encore des pâtes');
    await p.click('#aigo');
    await expect(p.locator('#aistep2')).toContainText('Tu as utilisé tes 3 analyses IA du jour');
    await p.click('#aiclose');
    await showView(p, 'profile');
    await expect(p.locator('#accAiS')).toHaveText('3 sur 3 aujourd’hui');
  });

  test('photos : sauvegarde activée sur A, retrouvées sur B', async () => {
    await showView(A.page, 'profile');
    await A.page.click('#accPh button[data-ph="1"]');
    await expect.poll(async () => (await api('/__test/photos?email=' + EMAIL)).files, { timeout: 15000 }).toBe(2);
    await expect(A.page.locator('#accPh button[data-ph="1"]')).toHaveAttribute('aria-pressed', 'true');
    await showView(A.page, 'body');
    expect(await A.page.locator('#photoPrivacy').textContent()).toContain('sauvegardées dans ton compte');
    await showView(B.page, 'profile');
    await B.page.click('#accSyncB');
    await expect(B.page.locator('#syncBanner')).toBeVisible();
    await B.page.evaluate(() => { window.__avant = 1; });
    await B.page.click('#syncBanner button');
    await B.page.waitForFunction(() => !window.__avant && document.readyState === 'complete');
    await settle(B.page, 1500);
    await showView(B.page, 'body');
    await expect(B.page.locator('#photometa')).toHaveText('2 photos');
    const sizes = await B.page.evaluate(() => [...document.querySelectorAll('#photogrid img')].map((i) => i.naturalWidth));
    expect(sizes.every((w) => w > 100)).toBe(true);
  });

  test('hors ligne : les changements attendent le réseau puis partent', async () => {
    const p = A.page;
    await A.context.setOffline(true);
    await showView(p, 'body');
    await p.fill('#in_t', '83,5');
    await p.click('#addm');
    await showView(p, 'profile');
    await expect(p.locator('#accSyncS')).toContainText('Hors ligne', { timeout: 15000 });
    await expect(p.locator('#accSyncS')).toContainText('1 en attente');
    await A.context.setOffline(false);
    await p.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(p.locator('#accSyncS')).toContainText('À jour', { timeout: 15000 });
    const row = (await api('/__test/kv?email=' + EMAIL)).find((r) => r.key === 'bodylog');
    expect(JSON.parse(row.value).find((e) => e.d === dayStr(0)).t).toBe(83.5);
    // pendant la coupure, le navigateur signale les requêtes échouées : attendu
    expect(A.errors.every((e) => /ERR_INTERNET_DISCONNECTED/.test(e))).toBe(true);
    A.errors.length = 0;
  });

  test('déconnexion sur B : les données restent sur le téléphone', async () => {
    const p = B.page;
    await showView(p, 'profile');
    await p.click('#accB');
    await p.click('#accOut');
    await expect(p.locator('#accS')).toHaveText('Non connectée');
    await expect(p.locator('#pfFoot')).toContainText('en local sur ton téléphone');
    await showView(p, 'body');
    expect(await viewText(p, 'body')).toContain('75,4 kg');
  });

  test('suppression du compte depuis A : tout est effacé en ligne, rien sur le téléphone', async () => {
    const p = A.page;
    await showView(p, 'profile');
    await p.click('#accB');
    await p.click('#accDel');
    await expect(p.locator('#accS')).toHaveText('Non connectée', { timeout: 15000 });
    expect((await api('/__test/user?email=' + EMAIL)).exists).toBe(false);
    expect(await api('/__test/kv?email=' + EMAIL)).toEqual([]);
    expect((await api('/__test/photos?email=' + EMAIL)).files).toBe(0);
    await showView(p, 'body');
    expect(await viewText(p, 'body')).toContain('75,4 kg');
    expect(A.errors).toEqual([]);
    await A.context.close(); await B.context.close();
  });
});
