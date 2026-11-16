// Outils communs aux tests de bout en bout.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { serve } from '../../scripts/serve.mjs';

export const ROOT = new URL('../../', import.meta.url).pathname;
export const OLD_APP = join(ROOT, 'tests/fixtures/mon-suivi-app-v1.html');
export const VIEWS = ['home', 'training', 'nutrition', 'progress', 'body', 'sports', 'profile'];

export async function startServer(dist = join(ROOT, process.env.DIST || 'dist')) {
  return serve({ root: dist, old: OLD_APP });
}

// L'ancienne app charge ses polices chez Google et Quagga sur un CDN : en test, on sert
// les mêmes fichiers en local pour que les deux versions s'affichent à l'identique.
export function localFontsCss(baseUrl, dist = join(ROOT, process.env.DIST || 'dist')) {
  const files = readdirSync(join(dist, 'assets'));
  const pick = (re) => files.find((f) => re.test(f));
  let css = '';
  for (const w of [700, 800]) css += `@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:${w};font-display:swap;src:url(${baseUrl}/assets/${pick(new RegExp(`^plus-jakarta-sans-latin-${w}-normal-.*\\.woff2$`))}) format('woff2')}\n`;
  for (const w of [500, 600, 700, 800, 900]) {
    css += `@font-face{font-family:'Inter';font-style:normal;font-weight:${w};font-display:swap;src:url(${baseUrl}/assets/${pick(new RegExp(`^inter-latin-${w}-normal-.*\\.woff2$`))}) format('woff2')}\n`;
  }
  return css;
}

export async function offlineThirdParties(context, baseUrl) {
  const css = localFontsCss(baseUrl);
  await context.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: css }));
  await context.route('https://fonts.gstatic.com/**', (r) => r.abort());
  await context.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ contentType: 'text/javascript', body: readFileSync(join(ROOT, 'public/vendor/quagga.min.js')) }));
  await context.route('https://world.openfoodfacts.org/**', (r) => r.abort());
  await context.route('https://api.anthropic.com/**', (r) => r.abort());
}

// Données écrites dans localStorage avant le premier chargement de l'onglet (une seule fois).
export async function seedLocalStorage(context, data) {
  await context.addInitScript((d) => {
    try {
      if (sessionStorage.getItem('__seeded')) return;
      for (const k in d) localStorage.setItem(k, d[k]);
      sessionStorage.setItem('__seeded', '1');
    } catch (e) { /* rien */ }
  }, data);
}

export async function settle(page, ms = 1200) { await page.waitForTimeout(ms); }

// Aller dans une partie. Nouvelle app : la part de la roue de l'accueil, la maison pour revenir.
// Ancienne app (comparaisons) : sa barre d'onglets ; une partie qu'elle n'a pas (Corps, Sports) est ignorée.
export async function showView(page, v) {
  await page.evaluate((v) => {
    if (document.querySelector('.tabbar')) { const t = document.querySelector(`.tab[data-view="${v}"]`); if (t) t.click(); return; }
    if (v === 'home') { document.getElementById('homeBtn').click(); return; }
    document.querySelector(`.wh-sl[data-go="${v}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, v);
  await page.waitForTimeout(900);
}

// Catégorie d'une partie. Nutrition : une rubrique de son entrée en tuiles (repas, proteines, objectif) ;
// Progression (rang, semaines) et Corps (corps, photos) : leurs onglets.
export async function showSub(page, v, sub) {
  const tab = page.locator(`.sub[data-sub="${v}"] [data-p="${sub}"]`);
  if (await tab.count()) await tab.click();
  else await page.evaluate(({ v, sub }) => document.querySelector(`#v-${v} .ph-tile[data-sub="${sub}"]`).click(), { v, sub });
  await page.waitForTimeout(250);
}

// Training, au jour le jour : son entrée (Ren, sa proposition, les cartes des séances)
export async function trainingHub(page) {
  const back = page.locator('#v-training > .ps [data-back]');
  if (await back.isVisible()) await back.click();
  else if (!(await page.locator('#trHub').isVisible())) await showView(page, 'training');
  await expect(page.locator('#trHub')).toBeVisible();
}
// Ouvrir une séance comme on le ferait : sa carte au centre, puis « C'est parti » (un jour sans muscu,
// d'abord « Je m'entraîne quand même »). Rend la carte de la séance ouverte.
export async function openSession(page, sid) {
  await trainingHub(page);
  const go = page.locator('#trGo');
  if (await page.locator('#thRest').isVisible()) await go.click();
  const card = page.locator(`#trCards .tc[data-sid="${sid}"]`);
  if (!/\bcur\b/.test((await card.getAttribute('class')) || '')) {
    await card.dispatchEvent('click');                       // une carte de côté se centre
    await expect(card).toHaveClass(/\bcur\b/);
  }
  await go.click();
  const open = page.locator(`#sessions .card[data-sid="${sid}"]`);
  await expect(open).toBeVisible();
  return open;
}

// Texte visible d'une partie (sa catégorie affichée seulement)
export async function viewText(page, v) {
  return page.evaluate((v) => document.getElementById('v-' + v).innerText, v);
}

// Les données affichées, valeur par valeur, avec les mêmes identifiants dans l'ancienne app
// et dans la nouvelle. La mise en page et la formulation ont changé (catégories, textes
// allégés, virgules décimales) : on compare les nombres, et les noms quand ils sont restés.
// (les anneaux de l'ancien accueil ne sont plus là : leurs objectifs se lisent dans caltarget, nutProtGoal, v_m et v_c)
// (la semaine affichée n'est plus dans Training, qui vit au jour le jour : weeklabel se lit dans Progression, wkSub)
export const DATA_IDS = ['hzLvl', 'hzRank', 'hzRankT', 'hzNext', 'goalT', 'trmeta', 'weeklabel',
  'dtot', 'caltarget', 'caleaten', 'calleft', 'pcount', 'nutProtGoal', 'pct', 'v_m', 'v_p', 'v_c', 'sknum', 'skt', 'st_w', 'sd_w', 'st_t', 'sd_t',
  'mezmeta', 'photometa', 'rkL', 'rkLvl', 'rkXp', 'rkTo', 'rkRem', 'pgSub', 'pfSub', 'pfCal', 'pfProt'];
const SAME_TEXT = ['hzRank', 'hzRankT', 'goalT', 'rkL', 'rkLvl', 'rkTo', 'pgSub', 'pfSub', 'skt', 'mezmeta', 'photometa'];
export async function dataSnapshot(page) {
  return page.evaluate(({ ids, same }) => {
    const norm = (s) => String(s || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
    const nums = (s) => (norm(s).replace(/(\d) (?=\d{3}(?!\d))/g, '$1').replace(/(\d),(\d)/g, '$1.$2').match(/\d+(?:\.\d+)?/g) || []).map(Number);
    const txt = (e) => (e ? e.textContent : '');
    const out = {};
    const alias = { weeklabel: 'wkSub' };
    for (const id of ids) { const e = document.getElementById(id) || document.getElementById(alias[id]); out[id] = same.includes(id) ? norm(txt(e)) : nums(txt(e)); }
    // séances de la semaine : la liste de l'ancienne app, les cartes de l'entrée de Training dans la nouvelle
    const tc = [...document.querySelectorAll('#trCards .tc')];
    if (tc.length) {
      const sum = (c) => norm(txt(c.querySelector('.tc-n'))) + ' ' + c.dataset.done + '/' + c.dataset.len;
      out.sessions = tc.filter((c) => c.dataset.opt === '0').map(sum);
      out.optional = tc.filter((c) => c.dataset.opt === '1').map(sum);
    } else {
      out.sessions = [...document.querySelectorAll('#sessions .card .chd')].map((h) => norm(txt(h.querySelector('.tt .n'))) + ' ' + nums(txt(h.querySelector('.cnt'))).join('/'));
      out.optional = [...document.querySelectorAll('#brasexpress .card .chd')].map((h) => norm(txt(h.querySelector('.tt .n'))) + ' ' + nums(txt(h.querySelector('.cnt'))).join('/'));
    }
    out.meals = [...document.querySelectorAll('#meallog .ml')].map((r) => norm(txt(r.querySelector('.mn'))) + ' ' + nums(txt(r.querySelector('.qty span'))).concat(nums(txt(r.querySelector('.mk')))).join(' '));
    out.weeks = [...document.querySelectorAll('#weekhist .wk')].map((r) => nums(r.textContent).join(' '));
    out.hist = [...document.querySelectorAll('#hist .h')].map((r) => nums(r.textContent).join(' '));
    out.photos = document.querySelectorAll('#photogrid .pi').length;
    out.habits = [...document.querySelectorAll('#habits .chk')].map((c) => c.getAttribute('aria-pressed'));
    out.proteins = [...document.querySelectorAll('#pdots .pdot')].map((c) => c.getAttribute('data-on'));
    return out;
  }, { ids: DATA_IDS, same: SAME_TEXT });
}

export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

// Contenu des bases IndexedDB de l'app (kv, photos sans le binaire, sys)
export async function readIDB(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('mon-suivi');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result, t = db.transaction(['kv', 'photos', 'sys'], 'readonly');
      const out = {};
      let n = 3;
      for (const s of ['kv', 'photos', 'sys']) {
        const g = t.objectStore(s).getAll();
        g.onsuccess = () => {
          out[s] = g.result.map((r) => (s === 'photos' ? { ...r, blob: r.blob ? { type: r.blob.type, size: r.blob.size } : null } : r));
          if (--n === 0) { db.close(); resolve(out); }
        };
      }
    };
  }));
}
