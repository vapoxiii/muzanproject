import { describe, it, expect } from 'vitest';
import * as S from '../../src/social/cards.js';
import { defaultProgram, normalizeProgram, snapshotOf } from '../../src/training/program.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

describe('cartes : nettoyage de ce qui arrive d’un autre compte', () => {
  it('refuse le reste', () => {
    for (const [k, d] of [['photo', { t: 'x' }], ['texte', null], ['texte', []], ['texte', { t: '   ' }], ['rang', { rk: 'Z' }], ['serie', { w: 0 }], ['record', { n: 'Squat', s: {} }], ['seance', { n: 'Vide', ex: [] }], ['recette', { n: 'R', items: [] }], ['programme', { sessions: [{ name: 'X', ex: [{ x: 'inconnu-xyz' }] }] }]]) {
      expect(S.cleanCard(k, d)).toBeNull();
    }
  });
  it('texte : borné, sans caractères de contrôle, fond valide', () => {
    expect(S.cleanCard('texte', { t: '  Jour 30‮ ', bg: 99 })).toEqual({ t: 'Jour 30', bg: S.TEXT_BGS - 1 });
    expect(S.cleanCard('texte', { t: 'x'.repeat(400) }).t).toHaveLength(S.MAX_TEXT);
  });
  it('rang, série, record', () => {
    expect(S.rankCard('B', 12)).toEqual({ rk: 'B', lvl: 12 });
    expect(S.streakCard(5)).toEqual({ w: 5 });
    expect(S.recordCard({ n: 'Squat', mode: 'r', s: { w: 100, r: 5 }, d: '2026-11-18' })).toEqual({ n: 'Squat', mode: 'r', s: { w: 100, r: 5 }, d: '2026-11-18' });
    expect(S.cleanCard('record', { n: 'Squat', mode: 'zz', s: { w: -4, r: 'beaucoup' } })).toBeNull();
  });
  it('recette : valeurs bornées, ingrédients sans quantité retirés', () => {
    const r = S.recipeCard({ n: 'Bolo', parts: 4, items: [{ n: 'Riz', u: '100 g', k: 130, p: 2.7, g: 28, l: 0.3, q: 4 }, { n: 'Rien', u: '1 portion', k: 1e9, p: 0, q: 0 }], prep: 'Cuire.' });
    expect(r).toEqual({ n: 'Bolo', parts: 4, items: [{ n: 'Riz', u: '100 g', k: 130, p: 2.7, g: 28, l: 0.3, q: 4 }], prep: 'Cuire.' });
    expect(S.importRecipe(r)).toEqual({ n: 'Bolo', parts: 4, items: r.items, prep: 'Cuire.' });
  });
});

describe('cartes : construites depuis l’app', () => {
  const P = defaultProgram();
  const snap = snapshotOf(P);
  const hautA = snap.s.find((s) => s.id === 'hautA');
  it('séance faite : séries notées, records, la séance pour l’importer', () => {
    const log = {
      'hautA-1': { x: 'dc-halteres', d: '2026-11-18', s: [{ w: 30, r: 10 }, { w: 30, r: 9 }] },
      'hautA-2': { x: 'de-halteres', d: '2026-11-18', s: [{ w: 26, r: 12 }] },
    };
    const c = S.sessionCard({ ses: hautA, log, recs: ['hautA-1'], program: P });
    expect(c.n).toBe('Haut A');
    expect(c.d).toBe('2026-11-18');
    expect(c.ex.map((e) => [e.n, e.s.length, e.rec])).toEqual([['Développé couché haltères', 2, true], ['Développé épaules haltères', 1, false]]);
    expect(S.sessionTotals(c)).toEqual({ sets: 3, vol: 30 * 10 + 30 * 9 + 26 * 12, recs: 1 });
    expect(c.ses.ex).toHaveLength(hautA.ex.length);
    expect(c.ses.ex[0]).not.toHaveProperty('id');
    expect(S.cardTitle('seance', c)).toBe('Séance · Haut A');
  });
  it('séance cochée sans séries notées : les exercices faits, sans séries', () => {
    const done = hautA.ex.map((e, i) => i < 3);
    const log = { 'hautA-2': { x: 'de-halteres', d: '2026-11-18', s: [{ w: 26, r: 12 }] } };
    const c = S.sessionCard({ ses: hautA, log, done, program: P });
    expect(c.ex.map((e) => [e.n, e.s.length, !!e.ok])).toEqual([['Développé couché haltères', 0, true], ['Développé épaules haltères', 1, false], ['Élévations latérales', 0, true]]);
    expect(S.sessionTotals(c).sets).toBe(1);
    const html = S.cardHtml('seance', c, { esc: (x) => String(x) });
    expect(html).toContain('<b class="sc-ok">fait</b>');
    expect(html).toContain('3 exercices · 1 série');
    // rien de coché ni noté : pas de carte
    expect(S.sessionCard({ ses: hautA, log: {}, done: [], program: P })).toBeNull();
    // « ok » ne vient que d'un vrai booléen
    expect(S.cleanCard('seance', { n: 'X', ex: [{ n: 'Squat', ok: 'oui', s: [] }] })).toBeNull();
  });
  it('programme et exercice', () => {
    const p = S.programCard(P, 'Mon split');
    expect(p.sessions.map((s) => s.name)).toEqual(['Haut A', 'Bas A', 'Haut B', 'Bas B', 'Bras Express']);
    expect(p.sessions[0]).not.toHaveProperty('days');
    const e = S.exerciseCard(P.sessions[0].ex[0], P);
    expect(e.e).toMatchObject({ x: 'dc-halteres', sets: 3, mode: 'r', lo: 6, hi: 10, rest: 120 });
    expect(S.exerciseText(e.e)).toBe('3 × 6–10 · repos 2 min');
    expect(S.cardTitle('exercice', e)).toBe('Exercice · Développé couché haltères');
  });
});

describe('cartes : affichage', () => {
  it('tout ce qui vient de la carte est échappé', () => {
    const html = S.cardHtml('texte', S.textCard('<img src=x onerror=alert(1)>'), { esc });
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img');
    const rec = S.cardHtml('recette', S.recipeCard({ n: '<b>Bolo</b>', parts: 2, items: [{ n: '"><script>', u: '100 g', k: 100, p: 10, q: 1 }] }), { esc, size: 'big' });
    expect(rec).not.toMatch(/<script|<b>Bolo/);
    expect(rec).toContain('50 kcal la part');
  });
  it('sans fonction d’échappement : rien', () => {
    expect(S.cardHtml('texte', { t: 'x', bg: 0 })).toBe('');
  });
});

describe('cartes : importer chez soi', () => {
  it('séances ajoutées sans jour, nouveaux identifiants, nom distingué si déjà pris', () => {
    const P = defaultProgram();
    const card = S.programCard(P);
    const { program, added } = S.importSessions(P, card.sessions.slice(0, 2), card.custom, { suffix: '(de @bea)' });
    expect(added).toBe(2);
    const p = normalizeProgram(program);
    expect(p.sessions).toHaveLength(7);
    expect(p.sessions.slice(5).map((s) => [s.name, s.days])).toEqual([['Haut A (de @bea)', []], ['Bas A (de @bea)', []]]);
    const ids = p.sessions.flatMap((s) => s.ex.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('14 séances au plus', () => {
    const P = defaultProgram();
    const card = S.programCard(P);
    const big = S.importSessions(P, [...card.sessions, ...card.sessions, ...card.sessions], card.custom);
    expect(big.added).toBe(9);
    expect(big.program.sessions).toHaveLength(14);
  });
  it('exercice créé par l’ami : repris par son nom, sinon ajouté', () => {
    const mine = normalizeProgram({ ...defaultProgram(), custom: [{ id: 'c-moi', n: 'Pompes lestées', m: 'pecs', e: 'autre', t: 'c', mode: 'r' }] });
    const theirs = { id: 'c-ami', n: 'pompes lestées', m: 'pecs', e: 'autre', t: 'c', mode: 'r' };
    const other = { id: 'c-ami2', n: 'Tirage élastique', m: 'dos', e: 'autre', t: 'c', mode: 'r' };
    const e1 = S.cleanCard('exercice', { e: { x: 'c-ami', sets: 3, mode: 'r', lo: 8, hi: 12, rest: 60 }, custom: [theirs] });
    const r1 = S.importExercise(mine, 'hautA', e1.e, e1.custom);
    expect(r1.program.sessions[0].ex.at(-1).x).toBe('c-moi');
    expect(r1.program.custom).toHaveLength(1);
    const e2 = S.cleanCard('exercice', { e: { x: 'c-ami2', sets: 3, mode: 'r', lo: 10, hi: 15, rest: 60 }, custom: [other] });
    const r2 = S.importExercise(mine, 'basA', e2.e, e2.custom);
    const added = r2.program.sessions.find((s) => s.id === 'basA').ex.at(-1);
    expect(added.x).not.toBe('c-ami2');
    expect(r2.program.custom.find((c) => c.id === added.x).n).toBe('Tirage élastique');
    expect(normalizeProgram(r2.program).sessions.find((s) => s.id === 'basA').ex.at(-1).x).toBe(added.x);
  });
});

describe('pseudos et temps', () => {
  it('proposition et vérification', () => {
    expect(S.suggestHandle('Béa Martin')).toBe('bea.martin');
    expect(S.suggestHandle('Al')).toBe('');
    expect(S.handleProblem('bea.martin')).toBe('');
    expect(S.handleProblem('Bea')).toMatch(/minuscules/);
    expect(S.handleProblem('.bea')).toMatch(/point/);
    expect(S.handleProblem('be')).toMatch(/3 caractères/);
    expect(S.initial('', 'zoe')).toBe('Z');
  });
  it('temps écoulé', () => {
    const now = Date.parse('2026-11-18T20:00:00Z');
    expect(S.ago('2026-11-18T19:59:30Z', now)).toBe('à l’instant');
    expect(S.ago('2026-11-18T19:15:00Z', now)).toBe('45 min');
    expect(S.ago('2026-11-18T10:00:00Z', now)).toBe('10 h');
    expect(S.ago('2026-11-17T10:00:00Z', now)).toBe('hier');
  });
});
