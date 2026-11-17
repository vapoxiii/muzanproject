// Aperçu de test publié dans Claude : la page fonctionne dans un cadre proche de celui de la
// publication (contenu inséré dans un squelette HTML, règles de sécurité strictes, polices en
// data:, fenêtres confirm/prompt inopérantes, pas de service worker).
import { test, expect } from '@playwright/test';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { ROOT, collectErrors, openSession } from './helpers.js';

const OUT = join(ROOT, '.tmp/apercu');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'";
const skeleton = (body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
let server, url;

test.beforeAll(async () => {
  execSync('node scripts/apercu.mjs', { cwd: ROOT, stdio: 'ignore' });
  const files = JSON.parse(readFileSync(join(OUT, 'files.json'), 'utf8'));
  server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': CSP }); res.end(skeleton(readFileSync(join(OUT, 'page.html'), 'utf8'))); return; }
    const rel = decodeURIComponent(u.pathname).slice(1);
    if (!files[rel] || !existsSync(join(ROOT, files[rel]))) { res.writeHead(404); res.end(); return; }   // seuls les fichiers publiés
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] || 'application/octet-stream', 'content-security-policy': CSP });
    res.end(readFileSync(join(ROOT, files[rel])));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}/`;
});
test.afterAll(() => server && server.close());

async function open(context) {
  await context.addInitScript(() => { window.confirm = () => false; window.prompt = () => null; window.alert = () => {}; });
  const page = await context.newPage();
  const errors = collectErrors(page), failed = [];
  page.on('requestfailed', (r) => failed.push(r.url()));
  await page.goto(url);
  await page.waitForFunction(() => !document.documentElement.classList.contains('boot'), null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  return { page, errors, failed };
}
// une partie de l'app : la part de la roue de l'accueil
const tab = (page, v) => page.evaluate((v) => document.querySelector(`.wh-sl[data-go="${v}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })), v);

test('l’aperçu s’ouvre avec l’exemple, sans erreur, polices et images comprises', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const { page, errors, failed } = await open(context);
  expect(await page.evaluate(() => document.fonts.check('800 16px Inter') && document.fonts.check('800 16px "Plus Jakarta Sans"'))).toBe(true);
  const broken = await page.evaluate(() => [...document.images].filter((i) => i.getAttribute('src') && i.complete && i.naturalWidth === 0).map((i) => i.src));
  expect(broken).toEqual([]);
  await expect(page.locator('#onb')).toBeHidden();
  await tab(page, 'profile');
  await expect(page.locator('.apx')).toContainText('Aperçu de test');
  await expect(page.locator('#pfSub')).toContainText('Niveau');
  // Training : l'entrée du jour (Ren et sa proposition), puis une séance
  await tab(page, 'training');
  await page.waitForTimeout(400);
  await expect(page.locator('#thSay')).not.toBeEmpty();
  await openSession(page, 'hautA');
  await page.locator('.ex-row[data-eid="hautA-1"] .exi').click();
  await expect(page.locator('.lg[data-eid="hautA-1"] .lg-last')).toContainText('Dernière fois');
  await tab(page, 'body');
  await expect(page.locator('#mTrend')).toContainText('par semaine');
  await tab(page, 'nutrition');
  // l'exemple est daté par rapport à aujourd'hui : proposition, ou « dans le rythme »
  await expect(page.locator('#calAdj')).toContainText(/Ajustement/);
  await page.locator('#v-nutrition .nh-gb[data-sub="objectif"]').click();
  await expect(page.locator('#calAdj')).toBeVisible();
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  await context.close();
});

test('repartir de zéro puis recharger l’exemple', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const { page, errors } = await open(context);
  await tab(page, 'profile');
  await page.click('#apxBlank');
  await page.click('.tr-ask [data-a="1"]');
  await page.waitForFunction(() => document.readyState === 'complete' && !document.documentElement.classList.contains('boot') && !!document.getElementById('onb') && !document.getElementById('onb').hidden, null, { timeout: 15000 });
  await expect(page.locator('#onb')).toBeVisible();
  await page.evaluate(() => { document.getElementById('onb').hidden = true; });
  await tab(page, 'profile');
  await expect(page.locator('.apx')).toContainText('Tu es reparti de zéro');
  await page.click('#apxDemo');
  await page.click('.tr-ask [data-a="1"]');
  await page.waitForFunction(() => document.readyState === 'complete' && !document.documentElement.classList.contains('boot') && /Niveau \d+/.test(document.getElementById('pfSub')?.textContent || '') && document.getElementById('onb').hidden, null, { timeout: 15000 });
  await expect(page.locator('#onb')).toBeHidden();
  expect(errors).toEqual([]);
  await context.close();
});
