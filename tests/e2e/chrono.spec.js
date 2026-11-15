// Chrono : chronomètre libre (départ, tour, pause, remise à zéro), minuteur réglable (barre de repos),
// durée de la séance (au toucher ou à la première série validée).
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, trainingHub, openSession, collectErrors } from './helpers.js';

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

async function open(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await offlineThirdParties(context, srv.url);
  await seedLocalStorage(context, buildData());
  const page = await context.newPage();
  await page.clock.install({ time: FIXED_NOW });
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await page.waitForLoadState('load');
  await page.clock.runFor(1500);
  await page.waitForFunction(() => !!document.querySelector('.nav-item, #homebar, [data-view]'));
  await page.clock.runFor(500);
  return { context, page, errors };
}

test('chrono libre et minuteur depuis l’entrée de Training', async ({ browser }) => {
  const { context, page, errors } = await open(browser);
  await trainingHub(page);
  await expect(page.locator('#chronoOpen')).toBeInViewport();
  await page.screenshot({ path: 'test-results/chrono-hub.png' });
  await page.locator('#chronoOpen').click();
  const sheet = page.locator('.sheet.chr');
  await expect(sheet).toBeVisible();
  await sheet.locator('[data-c="go"]').click();
  await page.clock.runFor(65_000);
  await sheet.locator('[data-c="lap"]').click();
  await page.clock.runFor(5_000);
  await expect(sheet.locator('#chrSw')).toHaveText(/^1:10/);
  await expect(sheet.locator('#chrLaps li')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/chrono-sw.png' });
  await sheet.locator('[data-c="go"]').click();
  await expect(sheet.locator('[data-c="go"]')).toHaveText('Reprendre');
  await sheet.locator('[data-c="lap"]').click();
  await expect(sheet.locator('#chrSw')).toHaveText(/^0:00/);
  // minuteur
  await sheet.locator('[data-tab="tm"]').click();
  await sheet.locator('[data-pre="60"]').click();
  await sheet.locator('[data-c="p15"]').click();
  await expect(sheet.locator('#chrTm')).toHaveText('1:15');
  await page.screenshot({ path: 'test-results/chrono-tm.png' });
  await sheet.locator('[data-c="tgo"]').click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('#restBar')).toBeVisible();
  await expect(page.locator('#restBar .trest-v')).toHaveText('1:15');
  await page.clock.runFor(30_000);
  await expect(page.locator('#restBar .trest-v')).toHaveText('0:45');
  expect(errors).toEqual([]);
  await context.close();
});

test('durée de la séance : au toucher, en pause, reprise', async ({ browser }) => {
  const { context, page, errors } = await open(browser);
  await openSession(page, 'hautB');
  const clk = page.locator('#sesClock');
  await expect(clk).toBeVisible();
  await page.screenshot({ path: 'test-results/chrono-seance.png' });
  const txt = await page.locator('#sesClockV').textContent();
  if (txt === 'Démarrer') {
    await clk.click();
  }
  await page.clock.runFor(125_000);
  await expect(page.locator('#sesClockV')).toHaveText(/^\d+:\d\d$/);
  await clk.click();                       // pause
  const t1 = await page.locator('#sesClockV').textContent();
  await page.clock.runFor(60_000);
  await expect(page.locator('#sesClockV')).toHaveText(t1);
  await expect(clk).toHaveClass(/pause/);
  await clk.click();                       // reprise
  await page.clock.runFor(10_000);
  await expect(page.locator('#sesClockV')).not.toHaveText(t1);
  await page.screenshot({ path: 'test-results/chrono-seance2.png' });
  expect(errors).toEqual([]);
  await context.close();
});
