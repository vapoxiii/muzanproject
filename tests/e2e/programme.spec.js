// Constructeur de programme, saisie des séries et minuteur de repos, dans le navigateur.
import { test, expect } from '@playwright/test';
import { buildData, FIXED_NOW, weekKey, dayStr } from '../fixtures/data-v1.js';
import { startServer, offlineThirdParties, seedLocalStorage, showView, showSub, viewText, collectErrors, settle, openSession } from './helpers.js';

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { srv.server.close(); });

async function open(browser, seed = buildData()) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await offlineThirdParties(context, srv.url);
  if (seed) await seedLocalStorage(context, seed);
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  page.on('dialog', (d) => d.accept());
  const errors = collectErrors(page);
  await page.goto(srv.url + '/index.html');
  await settle(page, 1200);
  return { context, page, errors };
}
const xpLine = (page) => page.textContent('#pfSub');
async function reload(page) {
  await page.reload();
  await settle(page, 1200);
}

test('constructeur : ajouter un exercice de la bibliothèque, le régler au curseur, le retrouver après rechargement', async ({ browser }) => {
  const { context, page, errors } = await open(browser);
  const xp = await xpLine(page);
  await showView(page, 'training');
  await page.click('#progOpen');
  const ed = page.locator('.pe');
  await expect(ed).toBeVisible();
  await expect(ed.locator('.pe-ses-t b')).toHaveText(['Haut A', 'Bas A', 'Haut B', 'Bas B', 'Bras Express']);
  await expect(ed.locator('.pe-s')).toHaveText('4 séances par semaine · natation 2 fois');

  await page.click('[data-open="hautA"]');
  await page.click('[data-act="pick"]');
  const pk = page.locator('.pk');
  // le muscle, puis le matériel, puis la liste
  await expect(pk.locator('.pk-n')).toHaveText('Choisis un muscle');
  await expect(pk.locator('.pk-cat b')).toContainText(['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps']);
  await pk.locator('[data-cat="pecs"]').click();
  await expect(pk.locator('.pk-n')).toHaveText('Choisis le matériel');
  await pk.locator('[data-eqg="pdc"]').click();
  await expect(pk.locator('.pk-it').first()).toContainText('Pompes');
  await expect(pk.locator('.pk-it[data-x="pompes"]')).toBeVisible();
  await pk.locator('[data-act="up"]').click();
  await pk.locator('[data-act="up"]').click();
  await pk.locator('[data-cat="jambes"]').click();
  await pk.locator('[data-eqg="barre"]').click();
  // plusieurs muscles : rangés par muscle
  await expect(pk.locator('.pk-g')).toContainText(['Quadriceps', 'Ischios', 'Fessiers']);
  await expect(pk.locator('.pk-it[data-x="hip-thrust"]')).toBeVisible();
  await page.fill('#pkQ', 'hip thr');
  await expect(pk.locator('.pk-it').first()).toContainText('Hip thrust');
  await pk.locator('.pk-it[data-x="hip-thrust"]').click();
  await expect(pk.locator('.pk-it[data-x="hip-thrust"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(pk.locator('.pk-done')).toHaveText('Terminé (1)');
  await pk.locator('.pk-done').click();
  await expect(pk).toHaveCount(0);

  const row = ed.locator('.pe-ex').last();
  await expect(row).toContainText('Hip thrust');
  await expect(row).toContainText('3 × 5-8 · repos 3 min');
  await row.locator('.pe-ex-m').click();
  const sh = page.locator('.xs');
  await expect(sh.locator('.xs-sum')).toHaveText('3 × 5-8 · repos 3 min');
  // curseurs au clavier : une série de plus, une répétition de plus en haut de fourchette, 15 s de repos en moins
  await sh.getByRole('slider', { name: 'Séries', exact: true }).press('ArrowRight');
  await sh.getByRole('slider', { name: 'Répétitions maximum' }).press('ArrowRight');
  await sh.getByRole('slider', { name: 'Repos entre les séries' }).press('ArrowLeft');
  await expect(sh.locator('.xs-sum')).toHaveText('4 × 5-9 · repos 2 min 45');
  // au doigt : glisser la poignée basse des répétitions vers la gauche
  const track = sh.locator('.tsl').nth(1).locator('.tsl-r');
  const box = await track.boundingBox();
  await page.mouse.move(box.x + box.width * (4 / 29), box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * (2.1 / 29), box.y + 30, { steps: 4 });
  await page.mouse.up();
  await expect(sh.locator('.xs-sum')).toHaveText('4 × 3-9 · repos 2 min 45');
  // réglage rapide
  await sh.locator('[data-pre="masse"]').click();
  await expect(sh.locator('.xs-sum')).toHaveText('3 × 8-12 · repos 2 min');
  await page.keyboard.press('Escape');
  await expect(sh).toHaveCount(0);
  await expect(row).toContainText('3 × 8-12 · repos 2 min');
  await page.click('.pe-ok');
  await expect(ed).toHaveCount(0);

  // l'écran Training suit, l'XP ne bouge pas (Haut A reste validée : 9 exercices sur 10)
  const tc = page.locator('#trCards .tc[data-sid="hautA"]');
  await expect(tc).toHaveAttribute('data-done', '9');
  await expect(tc).toHaveAttribute('data-len', '10');
  await expect(tc.locator('.tc-st')).toHaveText('Faite cette semaine');
  const card = await openSession(page, 'hautA');
  await expect(card.locator('.cnt')).toHaveText('9/10');
  await expect(card.locator('.stamp')).toHaveText('Validée');
  await expect(card.locator('.ex-row').last()).toContainText('Hip thrust');
  await expect(card.locator('.ex-row').last()).toContainText('3 × 8-12');
  expect(await xpLine(page)).toBe(xp);

  await reload(page);
  await showView(page, 'training');
  await expect(page.locator('#trCards .tc[data-sid="hautA"]')).toHaveAttribute('data-len', '10');
  await openSession(page, 'hautA');
  expect(await viewText(page, 'training')).toContain('Hip thrust');
  expect(errors).toEqual([]);
  await context.close();
});

test('constructeur : nouvelle séance, nom, jour, séance en option, suppression', async ({ browser }) => {
  const { context, page, errors } = await open(browser);
  await showView(page, 'training');
  await page.click('#progOpen');
  await page.click('[data-act="add-ses"]');
  // la bibliothèque s'ouvre tout de suite sur la nouvelle séance
  const pk = page.locator('.pk');
  await expect(pk).toBeVisible();
  await page.fill('#pkQ', 'pompes');
  await pk.locator('.pk-it[data-x="pompes"]').click();
  await page.fill('#pkQ', 'tractions pro');
  await pk.locator('.pk-it[data-x="tractions"]').click();
  await pk.locator('.pk-done').click();
  await page.fill('#peName', 'Maison');
  await page.locator('#peName').blur();
  await page.fill('#peSub', 'Poids du corps');
  await page.locator('#peSub').blur();
  await expect(page.locator('.pe-ex')).toHaveCount(2);
  // dimanche (seul jour libre) déjà proposé ; on le garde
  await expect(page.locator('.pe-days [data-day="6"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-act="home"]');
  await expect(page.locator('.pe-ses-t b')).toHaveText(['Haut A', 'Bas A', 'Haut B', 'Bas B', 'Maison', 'Bras Express']);
  await expect(page.locator('.pe-ses[data-sid] .pe-ses-t span').nth(4)).toContainText('Poids du corps · 2 exercices');
  await expect(page.locator('.pe-s')).toHaveText('5 séances par semaine · natation 2 fois');
  // jeudi passe de Haut B à Maison
  await page.locator('.pe-ses').nth(4).locator('[data-day="3"]').click();
  await expect(page.locator('.pe-ses').nth(2).locator('[data-day="3"]')).toHaveAttribute('aria-pressed', 'false');
  await page.click('.pe-ok');
  await showView(page, 'profile');
  await expect(page.locator('#pfProgS')).toHaveText('5 séances par semaine');
  // jours de la nouvelle séance : jeudi et dimanche
  await page.click('#pfProgB');
  const maison = page.locator('.pe-ses').filter({ has: page.locator('.pe-ses-t b', { hasText: /^Maison$/ }) });
  await expect(maison.locator('.pe-d[aria-pressed="true"]')).toHaveText(['J', 'D']);
  await page.click('.pe-ok');

  // en option : elle rejoint Bras Express et ne compte plus dans les séances de la semaine
  await page.click('#pfProgB');
  await page.locator('.pe-ses').nth(4).locator('.pe-ses-m').click();
  await page.click('[data-act="opt"]');
  await page.click('[data-act="home"]');
  await expect(page.locator('.pe-ses-t b')).toHaveText(['Haut A', 'Bas A', 'Haut B', 'Bas B', 'Bras Express', 'Maison']);
  await expect(page.locator('.pe-s')).toHaveText('4 séances par semaine · natation 2 fois');
  await page.click('.pe-ok');
  await showView(page, 'training');
  const bonus = page.locator('#trCards .tc[data-opt="1"]');
  await expect(bonus.locator('.tc-n')).toHaveText(['Bras Express', 'Maison']);
  await expect(bonus.locator('.tc-st')).toHaveText(['En bonus', 'En bonus']);
  await expect(page.locator('#trmeta')).toHaveText('1 séance sur 4 cette semaine');

  // suppression, avec confirmation dans l'app
  await page.click('#progOpen');
  await page.locator('.pe-ses').filter({ has: page.locator('.pe-ses-t b', { hasText: /^Maison$/ }) }).locator('.pe-ses-m').click();
  await page.click('[data-act="del-ses"]');
  await page.click('.tr-ask [data-a="1"]');
  await expect(page.locator('.pe-ses-t b')).toHaveText(['Haut A', 'Bas A', 'Haut B', 'Bas B', 'Bras Express']);
  await page.click('.pe-ok');
  await reload(page);
  await showView(page, 'training');
  await expect(page.locator('#trCards .tc[data-opt="1"] .tc-n')).toHaveText(['Bras Express']);
  // Bras Express d'origine : « Maison — optionnel », dit à la façon de Ren
  await expect(page.locator('#trCards .tc[data-sid="brasX"] .tc-sub')).toHaveText('À la maison');
  expect(errors).toEqual([]);
  await context.close();
});

// Les questions de Ren, une par écran : on vérifie ce qui est proposé, puis on répond.
async function coachQuestions(page) {
  const cb = page.locator('.cb'), go = cb.locator('.oq-go'), q = cb.locator('.oq-q'), sub = cb.locator('.oq-sub');
  await expect(cb).toBeVisible();
  await expect(cb.locator('.oq-who')).toHaveText('Coach Ren');
  await expect(q).toHaveText('On construit ton programme ?');
  await go.click();
  return { cb, go, q, sub };
}

test('construit avec Ren : ses questions, ses séances, un exercice changé ; l’historique et l’XP ne bougent pas', async ({ browser }) => {
  const { context, page, errors } = await open(browser);
  const xp = await xpLine(page);
  // les semaines passées, dans Progression : leur score ne doit pas bouger
  const pastWeeks = async () => { await showView(page, 'progress'); await showSub(page, 'progress', 'semaines'); return page.locator('#weekhist .wk').evaluateAll((rows) => rows.slice(1).map((r) => r.textContent)); };
  const past = await pastWeeks();
  expect(past.length).toBeGreaterThan(1);
  await showView(page, 'training');
  await page.click('#progOpen');
  await expect(page.locator('.pe-coach b')).toHaveText('Construire avec Ren');
  await page.click('.pe-coach');
  const { cb, go, q, sub } = await coachQuestions(page);

  // séances par semaine : celles du profil
  await expect(q).toHaveText('Combien de séances par semaine ?');
  await expect(cb.locator('.oq-nums [aria-pressed="true"]')).toHaveText('4');
  await go.click();
  // type de programme : haut / bas conseillé pour 4 séances, push / pull / legs pas possible
  await expect(q).toHaveText('Quel type de programme ?');
  await expect(sub).toHaveText('Pour 4 séances, je te conseille le haut / bas : chaque muscle deux fois par semaine.');
  await expect(cb.locator('.oq-opt[data-o="hb"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(cb.locator('.oq-opt[data-o="hb"] .cb-reco')).toHaveText('Conseillé');
  await expect(cb.locator('.oq-opt[data-o="ppl"]')).toBeDisabled();
  await cb.locator('.oq-opt[data-o="fb"]').click();
  await expect(sub).toHaveText('Chaque muscle quatre fois par semaine : ça marche, avec des séances plus courtes.');
  await cb.locator('.oq-opt[data-o="hb"]').click();
  await expect(sub).toHaveText('Haut, bas : simple et efficace.');
  await go.click();
  // jours : ceux du programme actuel ; un jour de trop et le bouton attend
  await expect(q).toHaveText('Quels jours ?');
  await expect(cb.locator('.cb-days [aria-pressed="true"]')).toHaveText(['Lun', 'Mar', 'Jeu', 'Ven']);
  await cb.locator('.cb-days [data-d="2"]').click();
  await expect(go).toBeDisabled();
  await expect(sub).toHaveText('Un jour de trop : tu as dit 4 séances.');
  await cb.locator('.cb-days [data-d="2"]').click();
  await expect(go).toBeEnabled();
  await expect(sub).toHaveText('Parfait. La natation reste le mercredi et le samedi.');
  await go.click();
  // durée, lieu, niveau (profil), façon de travailler
  await expect(q).toHaveText('Combien de temps par séance ?');
  await cb.locator('.oq-opt[data-o="60"]').click();
  await expect(sub).toHaveText('Une heure, le bon compromis.');
  await go.click();
  await expect(q).toHaveText('Tu t’entraînes où ?');
  await cb.locator('.oq-opt[data-o="salle"]').click();
  await go.click();
  await expect(q).toHaveText('Ton niveau en musculation ?');
  await expect(cb.locator('.oq-opt[data-o="intermediaire"]')).toHaveAttribute('aria-pressed', 'true');
  await go.click();
  await expect(q).toHaveText('Tu préfères travailler comment ?');
  await cb.locator('.oq-opt[data-o="equilibre"]').click();
  await go.click();
  // zone prioritaire : les bras du profil ; revenir en arrière garde les réponses
  await expect(q).toHaveText('Une zone à travailler en priorité ?');
  await expect(cb.locator('.oq-chips [aria-pressed="true"]')).toHaveText(['Bras']);
  await expect(go).toHaveText('Continuer');
  await cb.locator('.oq-back').click();
  await expect(cb.locator('.oq-opt[data-o="equilibre"]')).toHaveAttribute('aria-pressed', 'true');
  await go.click();
  await go.click();

  // la semaine, puis le chemin : Ren propose les séances
  await expect(q).toHaveText('Voilà ta semaine.');
  await expect(sub).toHaveText('4 séances d’une heure, en salle, priorité : bras.');
  await expect(cb.locator('.cb-week li b')).toHaveText(['Haut 1', 'Bas 1', 'Natation', 'Haut 2', 'Bas 2', 'Natation']);
  await expect(cb.locator('.cb-week li span')).toHaveText(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']);
  await expect(cb.locator('.cb-rest')).toHaveText('Repos le dimanche.');
  await expect(cb.locator('.oq-opt[data-o="propose"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(go).toHaveText('Voir mes séances');
  await go.click();

  // ses séances : un onglet par séance, un exercice se change d'un toucher
  const rv = page.locator('.cb-rv');
  await expect(rv).toBeVisible();
  await expect(rv.locator('[role="tab"]')).toHaveText(['Lun Haut 1', 'Mar Bas 1', 'Jeu Haut 2', 'Ven Bas 2']);
  await expect(rv.locator('.pe-s')).toHaveText('4 séances par semaine, natation 2 fois');
  await expect(rv.locator('.cb-ses-s')).toContainText('≈');
  await expect(rv.locator('.cb-ex .pri').first()).toHaveText('Bras');
  // chaque exercice dit ce qu'il travaille ; la séance couvre les portions
  await expect(rv.locator('.cb-ex-k')).toContainText(['Milieu des pectoraux', 'Épaisseur du dos', 'Avant de l’épaule', 'Largeur du dos', 'Biceps, les deux portions', 'Portion latérale du triceps']);
  const first = rv.locator('.cb-ex').first();
  const before = (await first.locator('b').textContent()).trim();
  await first.click();
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  // les exercices qui travaillent pareil : l'actuel coché, puis les autres de la même cible
  await expect(rv.locator('.cb-tip')).toHaveText('Ren Bras qui poussent devant toi : tout le pectoral travaille, surtout sa partie centrale.');
  await expect(rv.locator('.cb-alts-k')).toHaveText(['Ils travaillent pareil : choisis le tien']);
  await expect(rv.locator('.cb-alt.on b')).toHaveText(before);
  expect(await rv.locator('.cb-alt[data-alt]').count()).toBeGreaterThanOrEqual(3);
  const alt = rv.locator('.cb-alt[data-alt]').first();
  const altName = (await alt.locator('b').textContent()).trim();
  expect(altName).not.toBe(before);
  await alt.click();
  await expect(page.locator('#trToast')).toHaveText(`Remplacé par « ${altName} »`);
  await expect(rv.locator('.cb-ex').first().locator('b')).toHaveText(altName);
  await expect(rv.locator('.cb-ex-k').first()).toHaveText('Milieu des pectoraux');
  await expect(rv.locator('.cb-alts')).toHaveCount(0);
  // Haut 2 : la longue portion du biceps, et ses équivalents bras derrière le corps
  await rv.locator('[role="tab"]').nth(2).click();
  const longRow = rv.locator('.cb-exw').filter({ has: page.locator('.cb-ex-k', { hasText: 'Longue portion du biceps' }) });
  await longRow.locator('.cb-ex').click();
  const LONG = ['Curl incliné haltères', 'Curl incliné à la poulie', 'Curl Bayesian (poulie derrière soi)', 'Drag curl', 'Drag curl haltères', 'Curl barre prise serrée'];
  await expect(longRow.locator('.cb-alt')).toHaveCount(6);
  expect((await longRow.locator('.cb-alt b').allTextContents()).sort()).toEqual(LONG.slice().sort());
  await longRow.locator('.cb-ex').click();
  await expect(rv.locator('.cb-alts')).toHaveCount(0);
  // une autre séance : retirer un exercice
  await rv.locator('[role="tab"]').nth(1).click();
  await expect(rv.locator('[role="tab"]').nth(1)).toHaveAttribute('aria-selected', 'true');
  const n = await rv.locator('.cb-ex').count();
  const removed = (await rv.locator('.cb-ex').last().locator('b').textContent()).trim();
  await rv.locator('.cb-ex').last().click();
  await rv.locator('.cb-alts [data-act="del"]').click();
  await expect(rv.locator('.cb-ex')).toHaveCount(n - 1);
  // et en ajouter un de la bibliothèque
  await rv.locator('[data-act="add"]').click();
  const pk = page.locator('.pk');
  await page.fill('#pkQ', 'pompes');
  await pk.locator('.pk-it[data-x="pompes"]').click();
  await pk.locator('.pk-done').click();
  await expect(pk).toHaveCount(0);
  await expect(rv.locator('.cb-ex').last().locator('b')).toHaveText('Pompes');
  await expect(rv.locator('.cb-ex')).toHaveCount(n);

  // valider : confirmation, puis le constructeur montre le nouveau programme
  await rv.locator('.cb-ok').click();
  await expect(page.locator('.tr-ask .ask-t')).toHaveText('Remplacer ton programme actuel par celui-ci ?');
  await page.click('.tr-ask [data-a="1"]');
  await expect(rv).toHaveCount(0);
  await expect(cb).toHaveCount(0);
  await expect(page.locator('#trToast')).toHaveText('Programme prêt : 4 séances');
  const ed = page.locator('.pe');
  await expect(ed.locator('.pe-ses-t b')).toHaveText(['Haut 1', 'Bas 1', 'Haut 2', 'Bas 2']);
  await expect(ed.locator('.pe-s')).toHaveText('4 séances par semaine · natation 2 fois');
  await ed.locator('.pe-ses-m').first().click();
  await expect(ed.locator('.pe-ex-m b').first()).toHaveText(altName);
  await page.click('.pe-ok');
  await expect(ed).toHaveCount(0);

  // semaine en cours : les séances déjà commencées restent ; Bas A, pas finie, est « retirée »
  const names = await page.locator('#trCards .tc .tc-n').allTextContents();
  expect(names).toEqual(['Haut 1', 'Bas 1', 'Haut 2', 'Bas 2', 'Haut A', 'Bas A']);
  await expect(page.locator('#trCards .tc[data-sid="hautA"] .tc-st')).toHaveText('Faite cette semaine');
  await expect(page.locator('#trCards .tc[data-sid="basA"] .tc-st')).toHaveText('Retirée');
  await expect(page.locator('#trmeta')).toHaveText('1 séance sur 4 cette semaine');
  expect(await xpLine(page)).toBe(xp);

  // semaines passées : leur programme à elles, leur score ne bouge pas
  expect(await pastWeeks()).toEqual(past);

  await showView(page, 'profile');
  await expect(page.locator('#pfProgS')).toHaveText('4 séances par semaine');
  await page.click('#pfProgB');
  await expect(page.locator('.pe-ses[data-sid]').nth(0).locator('.pe-d[aria-pressed="true"]')).toHaveText(['L']);
  await expect(page.locator('.pe-ses[data-sid]').nth(3).locator('.pe-d[aria-pressed="true"]')).toHaveText(['V']);
  await page.click('.pe-ok');
  await reload(page);
  expect(await xpLine(page)).toBe(xp);
  await showView(page, 'training');
  expect(await page.locator('#trCards .tc .tc-n').allTextContents()).toEqual(['Haut 1', 'Bas 1', 'Haut 2', 'Bas 2', 'Haut A', 'Bas A']);
  // les changements faits avec Ren sont bien dans les séances
  const sid = (name) => page.locator('#trCards .tc').filter({ has: page.locator('.tc-n', { hasText: new RegExp('^' + name + '$') }) }).getAttribute('data-sid');
  const exNames = (c) => c.locator('.ex-row .en').evaluateAll((els) => els.map((e) => e.firstChild.textContent.trim()));
  const haut1 = await openSession(page, await sid('Haut 1'));
  await expect(haut1.locator('.ex-row').first()).toBeVisible();
  expect((await exNames(haut1))[0]).toBe(altName);
  const bas1 = await openSession(page, await sid('Bas 1'));
  await expect(bas1.locator('.ex-row')).toHaveCount(n);
  const bas = await exNames(bas1);
  expect(bas.length).toBe(n);
  expect(bas[n - 1]).toBe('Pompes');
  expect(bas).not.toContain(removed);

  // en le rouvrant, Ren reprend les dernières réponses
  await page.locator('#v-training [data-back]').click();
  await page.click('#progOpen');
  await page.click('.pe-coach');
  await coachQuestions(page);
  await expect(page.locator('.cb .oq-nums [aria-pressed="true"]')).toHaveText('4');
  await page.locator('.cb .cb-x').click();
  await expect(page.locator('.cb')).toHaveCount(0);
  await expect(page.locator('.pe .pe-ses-t b')).toHaveText(['Haut 1', 'Bas 1', 'Haut 2', 'Bas 2']);
  expect(errors).toEqual([]);
  await context.close();
});

test('construit avec Ren : séances vides, on choisit tout soi-même dans la bibliothèque', async ({ browser }) => {
  const { context, page, errors } = await open(browser);
  const xp = await xpLine(page);
  await showView(page, 'training');
  await page.click('#progOpen');
  // « je préfère tout faire moi-même » : on revient au constructeur, rien ne change
  await page.click('.pe-coach');
  await expect(page.locator('.cb .oq-alt')).toHaveText('Je préfère tout faire moi-même');
  await page.locator('.cb .oq-alt').click();
  await expect(page.locator('.cb')).toHaveCount(0);
  await expect(page.locator('.pe .pe-ses-t b')).toHaveText(['Haut A', 'Bas A', 'Haut B', 'Bas B', 'Bras Express']);

  await page.click('.pe-coach');
  const { cb, go, q } = await coachQuestions(page);
  await cb.locator('.oq-nums [data-o="3"]').click();
  await expect(cb.locator('.oq-sub')).toHaveText('3 séances, c’est solide pour progresser.');
  await go.click();
  // 3 séances : full body conseillé, choisi tout seul
  await expect(cb.locator('.oq-opt[data-o="fb"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(cb.locator('.oq-opt[data-o="fb"] .cb-reco')).toHaveText('Conseillé');
  await cb.locator('.oq-opt[data-o="ppl"]').click();
  await expect(cb.locator('.oq-sub')).toHaveText('Chaque muscle une fois par semaine : le full body t’en donnerait trois.');
  await go.click();
  await expect(q).toHaveText('Quels jours ?');
  await expect(cb.locator('.cb-days [aria-pressed="true"]')).toHaveCount(3);
  // durée, lieu, niveau, façon de travailler, zone : les réponses par défaut
  for (let i = 0; i < 6 && (await q.getAttribute('data-full')) !== 'Voilà ta semaine.'; i++) {
    await go.click();
    await page.waitForTimeout(80);
  }
  await expect(q).toHaveText('Voilà ta semaine.');
  await expect(cb.locator('.cb-week li b')).toContainText(['Push', 'Pull', 'Legs']);
  await cb.locator('.oq-opt[data-o="custom"]').click();
  await expect(go).toHaveText('Choisir mes exercices');
  await go.click();
  await expect(page.locator('.tr-ask .ask-t')).toHaveText('Remplacer ton programme par 3 séances vides ?');
  await page.click('.tr-ask [data-a="1"]');
  await expect(cb).toHaveCount(0);

  // la première séance s'ouvre avec la bibliothèque
  const pk = page.locator('.pk');
  await expect(pk).toBeVisible();
  await page.fill('#pkQ', 'pompes');
  await pk.locator('.pk-it[data-x="pompes"]').click();
  await pk.locator('.pk-done').click();
  await expect(pk).toHaveCount(0);
  await expect(page.locator('#peName')).toHaveValue('Push');
  await expect(page.locator('.pe-ex')).toHaveCount(1);
  await page.click('[data-act="home"]');
  await expect(page.locator('.pe-ses-t b')).toHaveText(['Push', 'Pull', 'Legs']);
  await expect(page.locator('.pe-ses[data-sid] .pe-ses-t span').nth(1)).toContainText('0 exercice');
  await page.click('.pe-ok');
  const names = await page.locator('#trCards .tc .tc-n').allTextContents();
  expect(names.slice(0, 3)).toEqual(['Push', 'Pull', 'Legs']);
  expect(await xpLine(page)).toBe(xp);
  expect(errors).toEqual([]);
  await context.close();
});

test('séance : séries pré-remplies avec la dernière fois, charge conseillée, minuteur, coche et record', async ({ browser }) => {
  const data = buildData();
  // semaine dernière, jeudi (Haut B) : 22 kg × 12 aux trois séries du développé incliné
  const last = JSON.parse(data[weekKey(-1)]);
  last.log = { 'hautB-1': { x: 'di-halteres', d: dayStr(-6), s: [{ w: 22, r: 12 }, { w: 22, r: 12 }, { w: 22, r: 12 }] } };
  data[weekKey(-1)] = JSON.stringify(last);
  const { context, page, errors } = await open(browser, data);
  // la dernière fois, sur la carte de la séance
  await showView(page, 'training');
  await expect(page.locator('#trCards .tc[data-sid="hautB"] .tc-meta')).toContainText('Dernière fois il y a 6 jours');
  const card = await openSession(page, 'hautB');
  const exRow = card.locator('.ex-row[data-eid="hautB-1"]');
  await expect(exRow.locator('.ex-chip')).toHaveText('22 kg');
  await exRow.locator('.exi').click();
  const lg = card.locator('.lg[data-eid="hautB-1"]');
  await expect(lg.locator('.lg-last')).toHaveText('Dernière fois, jeu 15 oct : 22 kg × 12 · 12 · 12');
  await expect(lg.locator('.lg-tip')).toContainText('+2 kg aujourd’hui');
  const sets = lg.locator('.lg-sets .ls');
  await expect(sets).toHaveCount(3);
  await expect(sets.nth(0).locator('[data-f="w"]')).toHaveValue('24');
  await expect(sets.nth(0).locator('[data-f="r"]')).toHaveValue('8');
  await expect(sets.nth(1).locator('[data-ok]')).toBeDisabled();

  await sets.nth(0).locator('[data-ok]').click();
  // Ren tend son poignet (écran de repos) ; le refermer laisse la barre de repos
  await expect(page.locator('.rr')).toBeVisible();
  await page.locator('.rr-back').click();
  await expect(page.locator('.rr')).toHaveCount(0);
  const rest = page.locator('#restBar');
  await expect(rest).toHaveClass(/on/);
  await expect(rest.locator('.trest-v')).toHaveText('2:00');
  await rest.locator('[data-rest="15"]').click();
  await expect(rest.locator('.trest-v')).toHaveText('2:15');
  await page.clock.setFixedTime(new Date(FIXED_NOW.getTime() + 140000));
  await expect(rest).toHaveClass(/fin/);
  await expect(rest.locator('.trest-k')).toHaveText('C’est reparti');
  await expect(rest).toBeHidden({ timeout: 5000 });
  await page.clock.setFixedTime(FIXED_NOW);

  await expect(lg.locator('.lg-sets .ls').nth(0)).toHaveClass(/done/);
  await lg.locator('.lg-sets .ls').nth(1).locator('[data-st="1"]').click();
  await expect(lg.locator('.lg-sets .ls').nth(1).locator('[data-f="r"]')).toHaveValue('9');
  await lg.locator('.lg-sets .ls').nth(1).locator('[data-ok]').click();
  // 24 × 9 bat 22 × 12 (1RM estimé 31,2 kg contre 30,8)
  await expect(page.locator('#trToast')).toHaveText('Record : 24 kg × 9');
  await page.locator('.rr-back').click();
  await lg.locator('.lg-sets .ls').nth(2).locator('[data-f="r"]').fill('10');
  await lg.locator('.lg-sets .ls').nth(2).locator('[data-ok]').click();

  // dernière série prévue : l'exercice est coché (même XP qu'avant) et l'exercice suivant s'ouvre
  await expect(exRow.locator('.chk')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#xpToast')).toHaveText('+5 XP');
  await expect(card.locator('.lg')).toHaveAttribute('data-eid', 'hautB-2');
  await expect(exRow.locator('.ex-chip')).toHaveText('3/3');

  await reload(page);
  await openSession(page, 'hautB');
  await page.locator('.ex-row[data-eid="hautB-1"] .exi').click();
  const vals = await page.locator('.lg[data-eid="hautB-1"] .lg-sets .ls').evaluateAll((rows) => rows.map((r) => [r.querySelector('[data-f="w"]').value, r.querySelector('[data-f="r"]').value, r.classList.contains('done'), r.classList.contains('rec')]));
  expect(vals).toEqual([['24', '8', true, false], ['24', '9', true, false], ['24', '10', true, true]]);
  // annuler la dernière série : l'exercice n'est plus coché
  await page.locator('.lg[data-eid="hautB-1"] .lg-sets .ls').nth(2).locator('[data-ok]').click();
  await expect(page.locator('.ex-row[data-eid="hautB-1"] .chk')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.ex-row[data-eid="hautB-1"] .ex-chip')).toHaveText('2/3');
  expect(errors).toEqual([]);
  await context.close();
});

test('séance : une série sans répétitions n’est pas validée, la cocher sans détail marche toujours', async ({ browser }) => {
  const { context, page, errors } = await open(browser);
  const card = await openSession(page, 'basB');
  await card.locator('.ex-row[data-eid="basB-6"] .exi').click();         // « Abdos » : 3 séries libres
  const first = card.locator('.lg .lg-sets .ls').first();
  await expect(first.locator('[data-f="r"]')).toHaveValue('');
  await first.locator('[data-ok]').click();
  await expect(first).toHaveClass(/err/);
  await expect(card.locator('.lg .lg-sets .ls.done')).toHaveCount(0);
  await card.locator('.ex-row[data-eid="basB-5"] .chk').click();          // coche directe, comme avant
  await expect(card.locator('.ex-row[data-eid="basB-5"] .chk')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#xpToast')).toHaveText('+5 XP');
  expect(errors).toEqual([]);
  await context.close();
});

test('onboarding : construire son programme avec Ren juste après les questions', async ({ browser }) => {
  const { context, page, errors } = await open(browser, null);
  await expect(page.locator('#onb')).toBeVisible();
  for (let n = 0; n < 30; n++) {
    const kind = await page.evaluate(() => {
      const c = document.getElementById('oqCtl');
      if (document.getElementById('oqText')) return 'text';
      if (c.querySelector('[data-prog]')) return 'prog';
      if (c.querySelector('.oq-opts [data-o], .oq-nums [data-o]')) return 'choice';
      if (c.querySelector('.oq-fin')) return 'final';
      return 'autre';
    });
    if (kind === 'text') await page.fill('#oqText', 'Alex');
    if (kind === 'choice') await page.locator('#oqCtl [data-o]:not([disabled])').first().click();
    if (kind === 'prog') {
      await expect(page.locator('#oqCtl [data-prog]')).toHaveCount(3);
      await expect(page.locator('#oqCtl [data-prog="coach"] b')).toHaveText('Le construire avec Ren');
      await page.click('#oqCtl [data-prog="coach"]');
    }
    await page.click('#oqGo');
    await page.waitForTimeout(450);
    if (kind === 'final') break;
  }
  await expect(page.locator('#onb')).toBeHidden();

  // Ren enchaîne : niveau et zones viennent d'être donnés, il ne les redemande pas
  const { cb, go, q } = await coachQuestions(page);
  await expect(cb.locator('.oq-prog i')).toHaveCount(6);
  await expect(cb.locator('.oq-nums [aria-pressed="true"]')).toHaveText('2');
  const asked = [];
  for (let i = 0; i < 8 && (await q.getAttribute('data-full')) !== 'Voilà ta semaine.'; i++) {
    asked.push(await q.getAttribute('data-full'));
    await go.click();
    await page.waitForTimeout(80);
  }
  expect(asked.map((t) => t.replace(/ /g, ' '))).toEqual(['Combien de séances par semaine ?', 'Quel type de programme ?', 'Quels jours ?', 'Combien de temps par séance ?', 'Tu t’entraînes où ?', 'Tu préfères travailler comment ?']);
  await expect(cb.locator('.cb-week li b')).toContainText(['Full body A', 'Full body B']);
  await go.click();
  await page.locator('.cb-rv .cb-ok').click();
  await page.click('.tr-ask [data-a="1"]');
  await expect(cb).toHaveCount(0);
  await expect(page.locator('.cb-rv')).toHaveCount(0);
  await expect(page.locator('#trHub')).toBeVisible();
  await expect(page.locator('#trCards .tc .tc-n')).toHaveText(['Full body A', 'Full body B']);
  await expect(page.locator('#trmeta')).toHaveText('0 séance sur 2 cette semaine');
  expect(errors).toEqual([]);
  await context.close();
});
