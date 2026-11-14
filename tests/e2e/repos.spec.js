// Écran de repos : une série validée, Ren tend son poignet. Sa montre affiche l'heure du téléphone
// et le vrai décompte (anneau compris) ; pause, reprise, recommencer, passer ; la suite de la séance
// en cours ; fermer puis rouvrir depuis la barre ; aucune dérive après un passage en arrière-plan.
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, collectErrors, settle, openSession } from './helpers.js';

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

const C = 2 * Math.PI * 44;                      // circonférence de l'anneau (rayon 44 dans un repère de 100)
const arcLeft = (page) => page.locator('.rw-arc').evaluate((c) => 1 - parseFloat(c.style.strokeDashoffset) / (2 * Math.PI * 44));

test('écran de repos : heure réelle, décompte, pause, recommencer, passer, suite de la séance', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await offlineThirdParties(context, srv.url);
  await seedLocalStorage(context, buildData());
  const page = await context.newPage();
  await page.clock.install({ time: FIXED_NOW });                     // 10:00, mercredi
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await settle(page, 1200);
  const card = await openSession(page, 'hautB');
  await card.locator('.ex-row[data-eid="hautB-1"] .exi').click();
  const sets = card.locator('.lg[data-eid="hautB-1"] .lg-sets .ls');
  await sets.nth(0).locator('[data-f="r"]').fill('8');
  // le temps ne bouge plus que quand le test le dit (10:00:30) ; les longs sauts passent par
  // fastForward : les minuteurs ne tournent qu'une fois à l'arrivée, comme une app qui revient au
  // premier plan après un moment ailleurs
  await page.clock.pauseAt(new Date(FIXED_NOW.getTime() + 30_000));
  await sets.nth(0).locator('[data-ok]').click();
  await page.clock.runFor(100);

  // Ren tend son poignet : l'écran s'ouvre de lui-même au début du repos
  const rr = page.locator('.rr');
  await expect(rr).toBeVisible();
  await expect(page.locator('.rw-clock')).toHaveText('10:00');       // l'heure du téléphone
  await expect(page.locator('.rw-k')).toHaveText('Repos');
  await expect(page.locator('.rw-v')).toHaveText('02:00');
  expect(await arcLeft(page)).toBeGreaterThan(0.99);

  // le décompte avance seconde par seconde, l'anneau suit le temps restant
  await page.clock.runFor(1000);
  await expect(page.locator('.rw-v')).toHaveText('01:59');
  await page.clock.fastForward(29_000);
  await expect(page.locator('.rw-v')).toHaveText('01:30');
  expect(await arcLeft(page)).toBeCloseTo(0.75, 2);

  // 45 s dans une autre app (aucun « tic » pendant ce temps) : au retour, le compte est juste
  await page.clock.fastForward(45_000);
  await expect(page.locator('.rw-v')).toHaveText('00:45');
  await page.clock.fastForward(15_000);
  await expect(page.locator('.rw-v')).toHaveText('00:30');
  await expect(page.locator('.rw-clock')).toHaveText('10:02');       // l'heure suit le téléphone

  // pause : tout se fige, même si le temps passe ; la barre le dit aussi
  const main = page.locator('.rr-c.main');
  await main.click();
  await expect(main).toHaveAttribute('aria-pressed', 'true');
  await expect(main).toHaveAttribute('aria-label', 'Reprendre le repos');
  await expect(page.locator('.rw-k')).toHaveText('En pause');
  await page.clock.fastForward(20_000);
  await expect(page.locator('.rw-v')).toHaveText('00:30');
  await expect(page.locator('#restBar .trest-k')).toHaveText('En pause');
  // reprise, depuis le bouton de la montre
  await page.locator('.rw-pp').click();
  await expect(page.locator('.rw-k')).toHaveText('Repos');
  await page.clock.fastForward(5000);
  await expect(page.locator('.rw-v')).toHaveText('00:25');

  // recommencer : le repos entier, en marche
  await page.locator('.rr [data-a="restart"]').click();
  await expect(page.locator('.rw-v')).toHaveText('02:00');
  expect(await arcLeft(page)).toBeGreaterThan(0.99);

  // la séance en cours : un trait par exercice, la série suivante du même exercice
  const rows = await card.locator('.ex-row').count();
  await expect(page.locator('.rr-prog i')).toHaveCount(rows);
  await expect(page.locator('.rr-where')).toHaveText('Haut B · exercice 1 sur ' + rows);
  const next = page.locator('.rr-next');
  await expect(next.locator('small')).toHaveText('Prochaine série');
  await expect(next.locator('b')).toHaveText('Développé incliné haltères');
  await expect(next.locator('em')).toHaveText('Série 2 sur 3 · 8–12 reps');
  await expect(next.locator('img')).toHaveAttribute('src', /exos\//);

  // fermer : le repos continue dans la barre ; un toucher sur la barre rouvre l'écran
  await page.locator('.rr-back').click();
  await page.clock.runFor(300);
  await expect(rr).toHaveCount(0);
  await expect(page.locator('#restBar')).toHaveClass(/on/);
  await expect(page.locator('#restBar .trest-v')).toHaveText('2:00');
  await page.locator('#restBar .trest-t').click();
  await page.clock.runFor(100);
  await expect(rr).toBeVisible();
  // passer : l'écran et la barre s'en vont
  await page.locator('.rr [data-a="skip"]').click();
  await page.clock.runFor(300);
  await expect(rr).toHaveCount(0);
  await expect(page.locator('#restBar')).toBeHidden();

  // série 2 puis 3 : la dernière annonce l'exercice suivant ; la carte y mène, ses séries ouvertes
  await sets.nth(1).locator('[data-f="r"]').fill('8');
  await sets.nth(1).locator('[data-ok]').click();
  await page.clock.runFor(100);
  await expect(next.locator('em')).toHaveText('Série 3 sur 3 · 8–12 reps');
  await page.locator('.rr [data-a="skip"]').click();
  await page.clock.runFor(300);
  await sets.nth(2).locator('[data-f="r"]').fill('8');
  await sets.nth(2).locator('[data-ok]').click();
  await page.clock.runFor(100);
  const name2 = await card.locator('.ex-row[data-eid="hautB-2"] .en').evaluate((e) => e.childNodes[0].textContent.trim());
  await expect(next.locator('small')).toHaveText('Prochain exercice');
  await expect(next.locator('b')).toHaveText(name2);
  await expect(page.locator('.rr-prog i').first()).toHaveAttribute('style', /--f:1\.000/);
  await next.click();
  await page.clock.runFor(300);
  await expect(rr).toHaveCount(0);
  await expect(card.locator('.lg')).toHaveAttribute('data-eid', 'hautB-2');
  await expect(page.locator('#restBar')).toHaveClass(/on/);

  // fin du repos, écran ouvert : la montre l'annonce, puis tout se referme
  await page.locator('#restBar .trest-t').click();
  await page.clock.runFor(100);
  await expect(rr).toBeVisible();
  await page.clock.fastForward(121_000);
  await expect(page.locator('.rw-k')).toHaveText('C’est reparti');
  await expect(rr).toHaveClass(/fin/);
  await page.clock.runFor(3000);
  await expect(rr).toHaveCount(0);
  await expect(page.locator('#restBar')).toBeHidden();
  expect(errors).toEqual([]);
  await context.close();
});
