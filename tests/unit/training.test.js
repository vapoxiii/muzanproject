import { describe, it, expect } from 'vitest';
import * as TR from '../../src/training/index.js';
import { merge3 } from '../../src/core/merge.js';
import { buildData } from '../fixtures/data-v1.js';

// Le programme écrit en dur dans l'ancienne app (src/legacy/01-programme.js avant le constructeur)
const LEGACY = {
  hautA: [['Développé couché haltères', '3 × 6-10'], ['Développé épaules haltères', '3 × 8-12'], ['Élévations latérales', '3 × 12-20'], ['Tirage vertical poulie', '3 × 8-12'], ['Curl EZ / haltères', '4 × 8-12', 1], ['Curl marteau', '3 × 10-15', 1], ['Pushdown corde (triceps)', '3 × 10-15', 1], ['Curl inversé', '3 × 12-15', 1], ['Wrist curl (flexion)', '3 × 15-20', 1]],
  basA: [['Squat ou presse', '3 × 6-10'], ['Soulevé de terre roumain', '3 × 8-12'], ['Fentes ou presse', '3 × 10-12'], ['Leg curl', '3 × 10-15'], ['Mollets debout', '3 × 12-15'], ['Farmer carry (marche lestée)', '3 × 30-40 m', 1], ['Gainage / abdos', '3 séries']],
  hautB: [['Développé incliné haltères', '3 × 8-12'], ['Rowing poulie', '3 × 8-12'], ['Élévations latérales', '3 × 12-20'], ['Tractions négatives', '3 × 3-6'], ['Curl incliné haltères', '4 × 8-12', 1], ['Extension triceps poulie (au-dessus tête)', '3 × 12-15', 1], ['Curl marteau à la corde', '3 × 10-15', 1], ['Reverse wrist curl (extension)', '3 × 15-20', 1], ['Dead hang (suspension à la barre)', '3 × max', 1]],
  basB: [['Presse ou hack squat', '3 × 8-12'], ['SLDL ou hip thrust', '3 × 8-12'], ['Leg extension', '3 × 12-15'], ['Mollets assis', '3 × 12-15'], ['Wrist curl + reverse (superset)', '2 × chaque', 1], ['Abdos', '3 séries']],
  brasX: [['Curls (haltère / sac lesté)', '3 × 12-15', 1], ['Pompes serrées (triceps)', '3 × max', 1], ['Curl marteau', '3 × 12-15', 1], ['Wrist curl + reverse', '2 × chaque', 1], ['Dead hang', '3 × max', 1]],
};
const XP = { ex: 5, ses: 50, bras: 25, swim: 30, prot: 15, habit: 5, meal: 2, mealCap: 5, measure: 10, photo: 25, week: 100 };

// Calculs de l'ancienne app, recopiés tels quels, pour vérifier que rien ne bouge
const LEN = { hautA: 9, basA: 7, hautB: 9, basB: 6, brasX: 5 };
const MAIN = ['hautA', 'basA', 'hautB', 'basB'];
const thr = (id) => Math.ceil(LEN[id] * 0.8);
function legacyMigrate(s) {
  const b = { training: {}, swim: [!!(s.swim && s.swim[0]), !!(s.swim && s.swim[1])], nutrition: {} };
  for (const id in LEN) b.training[id] = Array.from({ length: LEN[id] }, (_, i) => !!(s.training && s.training[id] && s.training[id][i]));
  for (let d = 1; d <= 7; d++) { const o = (s.nutrition || {})[d] || {}; b.nutrition[d] = { protein: Math.max(0, Math.min(7, o.protein | 0)), crea: !!o.crea, eau: !!o.eau, legumes: !!o.legumes }; }
  return b;
}
function legacyScore(d) {
  let sessions = 0; MAIN.forEach((id) => { if (d.training[id].filter(Boolean).length >= thr(id)) sessions++; });
  let p = 0, c = 0; for (let x = 1; x <= 7; x++) { if (d.nutrition[x].protein >= 6) p++; if (d.nutrition[x].crea) c++; }
  return Math.round((sessions / 4 * 0.45 + p / 7 * 0.40 + c / 7 * 0.15) * 100);
}
function legacyXP(st) {
  let xp = 0;
  MAIN.forEach((id) => { const n = st.training[id].filter(Boolean).length; xp += n * XP.ex; if (n >= thr(id)) xp += XP.ses; });
  const nb = st.training.brasX.filter(Boolean).length; xp += nb * XP.ex; if (nb >= thr('brasX')) xp += XP.bras;
  st.swim.forEach((v) => { if (v) xp += XP.swim; });
  for (let d = 1; d <= 7; d++) { const n = st.nutrition[d]; if (n.protein >= 6) xp += XP.prot; ['crea', 'eau', 'legumes'].forEach((h) => { if (n[h]) xp += XP.habit; }); }
  if (legacyScore(st) >= 60) xp += XP.week;
  return xp;
}
const weeksOf = (data) => Object.keys(data).filter((k) => k.startsWith('fitweek:')).map((k) => JSON.parse(data[k]));

describe('bibliothèque d’exercices', () => {
  it('341 exercices, identifiants et noms uniques, muscles et matériel connus', () => {
    expect(TR.EXERCISES.length).toBeGreaterThanOrEqual(300);
    const ids = new Set(TR.EXERCISES.map((x) => x.id)), names = new Set(TR.EXERCISES.map((x) => x.n));
    expect(ids.size).toBe(TR.EXERCISES.length);
    expect(names.size).toBe(TR.EXERCISES.length);
    for (const x of TR.EXERCISES) {
      expect(TR.MUSCLES[x.m], x.id).toBeTruthy();
      expect(TR.EQUIP[x.e], x.id).toBeTruthy();
      for (const s of x.sec) expect(TR.MUSCLES[s], x.id + ' ' + s).toBeTruthy();
    }
    for (const m of Object.keys(TR.MUSCLES)) expect(TR.EXERCISES.some((x) => x.m === m), m).toBe(true);
  });

  it('recherche sans accents, en français ou en anglais, avec filtres', () => {
    expect(TR.searchExos('developpe couche')[0].n).toBe('Développé couché barre');
    expect(TR.searchExos('bench').map((x) => x.id)).toContain('dc-halteres');
    expect(TR.searchExos('ELEVATIONS LAT').every((x) => x.n.startsWith('Élévations latérales'))).toBe(true);
    expect(TR.searchExos('deadlift').map((x) => x.id)).toEqual(expect.arrayContaining(['sdt', 'rdl']));
    const pecsHalt = TR.searchExos('', { m: 'pecs', e: 'halteres' });
    expect(pecsHalt.length).toBeGreaterThan(5);
    expect(pecsHalt.every((x) => x.e === 'halteres' && (x.m === 'pecs' || x.sec.includes('pecs')))).toBe(true);
    // muscle principal avant les exercices qui le sollicitent seulement
    const firstSec = pecsHalt.findIndex((x) => x.m !== 'pecs');
    expect(pecsHalt.slice(firstSec).every((x) => x.m !== 'pecs')).toBe(true);
    expect(TR.searchExos('zzzz')).toEqual([]);
  });

  it('réglages par défaut cohérents', () => {
    for (const x of TR.EXERCISES) {
      const d = TR.defaultsFor(x);
      expect(d.sets).toBeGreaterThanOrEqual(1);
      expect(d.lo).toBeLessThanOrEqual(d.hi);
      expect(d.mode).toBe(x.mode);
    }
    expect(TR.defaultsFor(TR.exoById('squat'))).toMatchObject({ sets: 3, lo: 5, hi: 8, rest: 180 });
    expect(TR.defaultsFor(TR.exoById('planche'))).toMatchObject({ mode: 't', lo: 30, hi: 60 });
    expect(TR.defaultsFor(TR.exoById('rameur'))).toMatchObject({ mode: 't', sets: 1, rest: 0 });
  });
});

describe('programme d’origine converti à l’identique', () => {
  const P = TR.defaultProgram();
  it('mêmes séances, mêmes noms, mêmes séries, même étiquette « Bras »', () => {
    expect(P.sessions.map((s) => s.id)).toEqual(['hautA', 'basA', 'hautB', 'basB', 'brasX']);
    for (const s of P.sessions) {
      expect(s.ex.map((e) => [TR.exName(e, P), TR.describe(e), e.a ? 1 : undefined].filter((v) => v !== undefined)), s.id).toEqual(LEGACY[s.id]);
      for (const e of s.ex) if (e.a) expect(TR.zoneLabel(e, P)).toBe('Bras');
    }
    expect(P.sessions.find((s) => s.id === 'brasX').opt).toBe(true);
  });
  it('même planning et mêmes textes', () => {
    expect(TR.planOf(P)).toEqual([{ t: 'm', id: 'hautA' }, { t: 'm', id: 'basA' }, { t: 's', sp: 'natation', i: 0 }, { t: 'm', id: 'hautB' }, { t: 'm', id: 'basB' }, { t: 's', sp: 'natation', i: 1 }, { t: 'r' }]);
    expect(TR.scheduleText(P)).toBe('Lundi Haut A, mardi Bas A, jeudi Haut B, vendredi Bas B. Natation le mercredi et le samedi, repos le dimanche.');
    expect(TR.summaryText(P)).toBe('Haut A, Bas A, Haut B, Bas B, Bras Express en option');
    expect(TR.countText(P)).toBe('4 séances par semaine');
  });
  it('relu depuis le stockage sans rien perdre', () => {
    expect(TR.parseProgram(JSON.stringify(P))).toEqual(P);
    expect(TR.parseProgram(null)).toEqual(P);
    expect(TR.parseProgram('pas du json')).toEqual(P);
  });
});

describe('vérification d’un programme', () => {
  it('corrige les valeurs hors limites, les doublons et les exercices inconnus', () => {
    const p = TR.normalizeProgram({ sessions: [
      { id: 'a', name: '  Push  ', days: [0, 0, 9, 2], ex: [{ id: 'e1', x: 'dc-barre', sets: 99, mode: 'r', lo: 12, hi: 6, rest: 5000 }, { id: 'e1', x: 'squat', sets: 3, lo: 5, hi: 5 }, { x: 'nimporte-quoi' }] },
      { id: 'a', name: '', days: [2, 3], ex: [] },
    ], swim: [3, 5, 5] });                 // ancien format : la natation devient un sport
    expect(p.sessions[0]).toMatchObject({ id: 'a', name: 'Push', days: [0, 2] });
    expect(p.sessions[0].ex[0]).toMatchObject({ sets: 10, lo: 6, hi: 12, rest: 600 });
    expect(p.sessions[0].ex[1].id).not.toBe('e1');
    expect(p.sessions[0].ex).toHaveLength(2);
    expect(p.sessions[1].id).not.toBe('a');
    expect(p.sessions[1]).toMatchObject({ name: 'Séance', days: [3] });
    expect(p.sports).toEqual([{ id: 'natation', days: [5] }]);
  });
  it('un jour = une seule activité', () => {
    const p = TR.defaultProgram();
    TR.setDay(p, 'basA', 0, true);         // lundi passe de Haut A à Bas A
    expect(p.sessions.find((s) => s.id === 'hautA').days).toEqual([]);
    expect(p.sessions.find((s) => s.id === 'basA').days).toEqual([0, 1]);
    TR.setDay(p, 'sp:natation', 1, true);  // mardi : natation
    expect(p.sessions.find((s) => s.id === 'basA').days).toEqual([0]);
    expect(TR.sportEntry(p, 'natation').days).toEqual([1, 2, 5]);
    TR.setDay(p, 'swim', 5, false);        // l'ancien nom marche encore
    expect(TR.sportEntry(p, 'natation').days).toEqual([1, 2]);
    TR.setDay(p, 'sp:boxe', 2, true);      // mercredi : la boxe prend la place de la natation
    expect(TR.sportEntry(p, 'natation').days).toEqual([1]);
    expect(TR.sportEntry(p, 'boxe').days).toEqual([2]);
    TR.setDay(p, 'hautA', 2, true);        // puis une séance
    expect(TR.sportEntry(p, 'boxe').days).toEqual([]);
  });
  it('modèles complets, avec des exercices de la bibliothèque', () => {
    for (const t of TR.TEMPLATES) {
      const p = TR.templateProgram(t.key, { current: TR.defaultProgram() });
      expect(TR.mainSessions(p).length, t.key).toBe(t.n);
      for (const s of p.sessions) for (const e of s.ex) expect(TR.exoOf(e, p), t.key + ' ' + e.x).toBeTruthy();
      const days = p.sessions.flatMap((s) => s.days).concat(p.sports.flatMap((e) => e.days));
      expect(new Set(days).size, t.key).toBe(days.length);
    }
    expect(TR.recommendedTemplate(3).key).toBe('fb3');
    expect(TR.recommendedTemplate(4).key).toBe('hb4');
    expect(TR.recommendedTemplate(6).key).toBe('ppl6');
  });
  it('deux téléphones modifient le programme en même temps : tout est gardé', () => {
    const base = TR.defaultProgram();
    const a = structuredClone(base), b = structuredClone(base);
    a.sessions[0].ex.push(TR.makeExercise(TR.exoById('hip-thrust')));      // A ajoute un exercice à Haut A
    b.sessions[1].ex[0].sets = 5;                                            // B change les séries du squat
    b.sessions.push({ id: 's-new', name: 'Cardio', sub: '', opt: true, days: [], ex: [] });
    const merged = TR.parseProgram(merge3(JSON.stringify(base), JSON.stringify(a), JSON.stringify(b)));
    expect(merged.sessions[0].ex.map((e) => e.x)).toContain('hip-thrust');
    expect(merged.sessions[1].ex[0].sets).toBe(5);
    expect(merged.sessions.map((s) => s.name)).toContain('Cardio');
  });
});

describe('semaines : historique indépendant du programme', () => {
  const data = buildData();
  const weeks = weeksOf(data);

  it('anciennes semaines : XP et score identiques à l’ancienne app', () => {
    for (const w of weeks) {
      const st = TR.migrateWeek(w);
      expect(TR.weekScore(st)).toBe(legacyScore(legacyMigrate(w)));
      expect(TR.weekXP(st, XP)).toBe(legacyXP(legacyMigrate(w)));
    }
  });

  it('une semaine « comme avant » s’enregistre exactement comme avant', () => {
    const w = weeks[0];
    const st = TR.migrateWeek(w, TR.snapshotOf(TR.defaultProgram()));
    expect(Object.keys(TR.toStored(st))).toEqual(['training', 'swim', 'nutrition']);
  });

  it('changer de programme ne change ni l’XP ni le score des semaines passées', () => {
    const tpl = TR.snapshotOf(TR.templateProgram('ppl6'));
    for (const w of weeks.slice(1)) {
      const before = TR.weekXP(TR.migrateWeek(w), XP);
      // la semaine passée est relue avec son propre programme, quel que soit le programme actuel
      expect(TR.weekXP(TR.migrateWeek(JSON.parse(JSON.stringify(w))), XP)).toBe(before);
    }
    // semaine en cours : les séances commencées restent comptées (« retirées du programme »)
    const cur = weeks[0];
    const st = TR.migrateWeek(cur, tpl);
    expect(st.prog.s.filter((s) => s.gone).map((s) => s.id)).toEqual(['hautA', 'basA']);
    expect(TR.mainCount(st)).toBe(6);
    expect(TR.weekXP(st, XP)).toBe(TR.weekXP(TR.migrateWeek(cur), XP));
    // et ce qui est enregistré se relit pareil
    const again = TR.migrateWeek(JSON.parse(JSON.stringify(TR.toStored(st))), tpl);
    expect(again.training).toEqual(st.training);
    expect(TR.weekXP(again, XP)).toBe(TR.weekXP(st, XP));
  });

  it('modifier une séance en cours de semaine garde les coches exercice par exercice', () => {
    const P = TR.defaultProgram();
    const w = { training: { hautA: [true, false, true, false, false, false, false, false, true] }, swim: [true, false] };
    const hautA = P.sessions[0];
    hautA.ex.splice(1, 1);                                     // retire l'exercice 2
    hautA.ex.reverse();                                        // et inverse l'ordre
    hautA.ex.push(TR.makeExercise(TR.exoById('face-pull')));   // ajoute un exercice
    const st = TR.migrateWeek(w, TR.snapshotOf(P));
    const done = Object.fromEntries(st.prog.s[0].ex.map((e, i) => [e.id, st.training.hautA[i]]));
    expect(done['hautA-1']).toBe(true);
    expect(done['hautA-3']).toBe(true);
    expect(done['hautA-9']).toBe(true);
    expect(done['hautA-4']).toBe(false);
    expect(Object.values(done).filter(Boolean)).toHaveLength(3);
    expect(st.sport.natation).toEqual([true, false]);
  });

  it('natation : une séance faite n’est pas perdue si on en prévoit moins', () => {
    const P = TR.defaultProgram();
    P.sports[0].days = [2];
    const st = TR.migrateWeek({ swim: [true, true] }, TR.snapshotOf(P));
    expect(st.sport.natation).toEqual([true, true]);
    expect(TR.migrateWeek({ swim: [true, false] }, TR.snapshotOf(P)).sport.natation).toEqual([true]);
  });

  it('séances vides et programme sans séance : rien ne casse', () => {
    const p = TR.normalizeProgram({ sessions: [{ id: 'x', name: 'Vide', days: [0], ex: [] }], sports: [] });
    const st = TR.migrateWeek(null, TR.snapshotOf(p));
    expect(TR.isValidated(st, st.prog.s[0])).toBe(false);
    expect(TR.weekScore(st)).toBe(0);
    const none = TR.migrateWeek(null, TR.snapshotOf(TR.normalizeProgram({ sessions: [], sports: [] })));
    expect(TR.mainCount(none)).toBe(0);
    expect(TR.weekScore(none)).toBe(0);
  });
});

describe('séries : dernière fois, conseil, records', () => {
  const ex = { id: 'e1', x: 'dc-halteres', sets: 3, mode: 'r', lo: 8, hi: 12, rest: 120 };
  const x = TR.exoById('dc-halteres');
  const wk = (k, log) => ({ k, st: { log } });

  it('dernière fois : la séance la plus récente, hors la séance du jour', () => {
    const weeks = [
      wk('fitweek:2026-W41', { a: { x: 'dc-halteres', d: '2026-10-06', s: [{ w: 20, r: 12 }] } }),
      wk('fitweek:2026-W42', { b: { x: 'dc-halteres', d: '2026-10-13', s: [{ w: 22, r: 10 }] }, c: { x: 'squat', d: '2026-10-14', s: [{ w: 80, r: 5 }] } }),
      wk('fitweek:2026-W43', { e1: { x: 'dc-halteres', d: '2026-10-20', s: [{ w: 24, r: 8 }] } }),
    ];
    expect(TR.lastEntry('dc-halteres', weeks, { exceptKey: 'fitweek:2026-W43', exceptId: 'e1' }).d).toBe('2026-10-13');
    expect(TR.lastEntry('dc-halteres', weeks).d).toBe('2026-10-20');
    expect(TR.lastEntry('rdl', weeks)).toBeNull();
    // semaine passée affichée : seulement ce qui a été fait avant
    expect(TR.lastEntry('dc-halteres', weeks, { before: '2026-10-13' }).d).toBe('2026-10-06');
  });

  it('conseil : +1 cran quand tout est au haut de la fourchette, sinon pareil', () => {
    expect(TR.suggest(ex, null, x)).toMatchObject({ kind: 'first', sets: [{ w: null, r: 8 }, { w: null, r: 8 }, { w: null, r: 8 }] });
    const up = TR.suggest(ex, { s: [{ w: 22, r: 12 }, { w: 22, r: 12 }, { w: 22, r: 13 }] }, x);
    expect(up).toMatchObject({ kind: 'up', from: 22, to: 24, step: 2 });
    expect(up.sets).toEqual([{ w: 24, r: 8 }, { w: 24, r: 8 }, { w: 24, r: 8 }]);
    const barre = TR.suggest({ ...ex, x: 'dc-barre' }, { s: [{ w: 60, r: 12 }, { w: 60, r: 12 }, { w: 60, r: 12 }] }, TR.exoById('dc-barre'));
    expect(barre.to).toBe(62.5);
    expect(TR.suggest(ex, { s: [{ w: 22, r: 12 }, { w: 22, r: 11 }, { w: 22, r: 10 }] }, x)).toMatchObject({ kind: 'same', sets: [{ w: 22, r: 12 }, { w: 22, r: 11 }, { w: 22, r: 10 }] });
    expect(TR.suggest(ex, { s: [{ w: 22, r: 12 }, { w: 22, r: 12 }] }, x).kind).toBe('same');            // pas toutes les séries
    const pdc = TR.suggest({ ...ex, x: 'tractions' }, { s: [{ w: null, r: 12 }, { w: null, r: 12 }, { w: null, r: 12 }] }, TR.exoById('tractions'));
    expect(pdc.kind).toBe('top');
  });

  it('records : 1RM estimé pour la charge, répétitions au poids du corps', () => {
    const best = { kg: 22 * (1 + 12 / 30) };
    expect(TR.recordIndex('r', [{ w: 24, r: 8 }, { w: 24, r: 10 }], best)).toBe(1);
    expect(TR.recordIndex('r', [{ w: 22, r: 11 }], best)).toBe(-1);
    expect(TR.recordIndex('r', [{ w: 24, r: 10 }], {})).toBe(-1);              // première fois : pas de record
    expect(TR.recordIndex('r', [{ w: null, r: 15 }], { reps: 12 })).toBe(0);
    expect(TR.recordIndex('t', [{ w: null, r: 50 }], { s: 45 })).toBe(0);
    const b = TR.bestValues('dc-halteres', 'r', [wk('k', { a: { x: 'dc-halteres', s: [{ w: 20, r: 10 }, { w: 22, r: 12 }] } })]);
    expect(b.kg).toBeCloseTo(30.8, 5);
  });

  it('textes', () => {
    expect(TR.fmtSets('r', [{ w: 22.5, r: 10 }, { w: 22.5, r: 10 }, { w: 22.5, r: 9 }])).toBe('22,5 kg × 10 · 10 · 9');
    expect(TR.fmtSets('r', [{ w: 24, r: 8 }, { w: 22, r: 10 }])).toBe('24 × 8 · 22 × 10');
    expect(TR.fmtSets('r', [{ w: null, r: 12 }, { w: null, r: 10 }])).toBe('12 · 10 reps');
    expect(TR.fmtSets('t', [{ w: null, r: 45 }, { w: null, r: 75 }])).toBe('45 s · 1 min 15');
    expect(TR.fmtSets('d', [{ w: 30, r: 40 }, { w: 30, r: 40 }])).toBe('30 kg · 40 m · 40 m');
    expect(TR.describe({ sets: 1, mode: 't', lo: 600, hi: 1200 })).toBe('1 × 10-20 min');
    expect(TR.describe({ sets: 3, mode: 't', lo: 45, hi: 90 })).toBe('3 × 45 s à 1 min 30');
    expect(TR.fmtRest(150)).toBe('2 min 30');
    expect(TR.fmtRest(0)).toBe('sans repos');
    expect(TR.parseNum('22,5')).toBe(22.5);
    expect(TR.parseNum('')).toBeNull();
  });
});
