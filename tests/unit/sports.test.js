import { describe, it, expect } from 'vitest';
import * as TR from '../../src/training/index.js';
import { merge3 } from '../../src/core/merge.js';

const XP = { ex: 5, ses: 50, bras: 25, swim: 30, prot: 15, habit: 5, meal: 2, mealCap: 5, measure: 10, photo: 25, week: 100 };

describe('catalogue des sports', () => {
  it('au moins 150 sports, rangés dans des catégories connues, identifiants et noms uniques', () => {
    expect(TR.SPORTS.length).toBeGreaterThanOrEqual(150);
    expect(new Set(TR.SPORTS.map((s) => s.id)).size).toBe(TR.SPORTS.length);
    expect(new Set(TR.SPORTS.map((s) => s.n)).size).toBe(TR.SPORTS.length);
    for (const s of TR.SPORTS) {
      expect(s.id, s.id).toMatch(/^[a-z0-9-]+$/);
      expect(TR.SPORT_CATS[s.c], s.id).toBeTruthy();
      expect(s.met, s.id).toBeGreaterThanOrEqual(2);
      expect(s.met, s.id).toBeLessThanOrEqual(11);
      expect(s.min, s.id).toBeGreaterThanOrEqual(15);
      expect(s.min, s.id).toBeLessThanOrEqual(300);
      expect(['le', 'la', 'l’', 'les'], s.id).toContain(s.a);
    }
    for (const c of TR.SPORT_CAT_IDS) expect(TR.SPORTS.filter((s) => s.c === c).length, c).toBeGreaterThanOrEqual(5);
    for (const id of TR.POPULAR) expect(TR.sportById(id), id).toBeTruthy();
  });

  it('recherche sans accents, par nom, surnom ou catégorie', () => {
    expect(TR.searchSports('foot')[0].n).toBe('Football');
    expect(TR.searchSports('muay')[0].id).toBe('boxe-thai');
    expect(TR.searchSports('jjb')[0].id).toBe('jjb');
    expect(TR.searchSports('EQUITATION')[0].n).toBe('Équitation');
    expect(TR.searchSports('ping pong')[0].n).toBe('Tennis de table');
    expect(TR.searchSports('zumba')[0].n).toBe('Danse fitness');
    expect(TR.searchSports('combat').length).toBe(TR.SPORTS.filter((s) => s.c === 'combat').length);
    expect(TR.searchSports('', { c: 'raquette' }).every((s) => s.c === 'raquette')).toBe(true);
    expect(TR.searchSports('xyzw')).toEqual([]);
  });

  it('dépense en plus d’un jour de repos, selon la durée, l’intensité et le poids', () => {
    const nat = TR.sportOf({ id: 'natation', days: [2] });
    expect(TR.sportKcal(nat, 76.5)).toBe(200);                       // comme le bonus d'origine
    expect(TR.sportKcal(TR.sportOf({ id: 'football' }), 76.5)).toBe(700);
    const foot = TR.sportOf({ id: 'football', min: 45, int: 2 });
    expect(foot.min).toBe(45);
    expect(TR.sportKcal(foot, 76.5)).toBeGreaterThan(TR.sportKcal(TR.sportOf({ id: 'football', min: 45 }), 76.5));
    expect(TR.sportKcal(TR.sportOf({ id: 'yoga' }), null)).toBe(100);  // poids inconnu : 75 kg
    expect(TR.sportKcal(TR.sportOf({ id: 'bras-de-fer' }), 60)).toBe(50);
  });

  it('noms dans une phrase', () => {
    expect(TR.sportThe(TR.sportOf({ id: 'natation' }))).toBe('la natation');
    expect(TR.sportThe(TR.sportOf({ id: 'escalade-salle' }))).toBe('l’escalade en salle');
    expect(TR.sportThe(TR.sportOf({ id: 'claquettes' }))).toBe('les claquettes');
    expect(TR.sportLower(TR.sportOf({ id: 'vtt' }))).toBe('VTT');
    expect(TR.sportLower(TR.sportOf({ id: 'jjb' }))).toBe('jiu-jitsu brésilien');
    expect(TR.sportThe(TR.sportOf({ id: 'u1', n: 'Sumo' }))).toBe('« Sumo »');
    expect(TR.fmtMin(45)).toBe('45 min');
    expect(TR.fmtMin(90)).toBe('1 h 30');
  });
});

describe('sports dans le programme', () => {
  it('ancien programme : la natation devient un sport, rien d’autre ne change', () => {
    const old = { sessions: TR.defaultProgram().sessions, swim: [2, 5], custom: [] };
    expect(TR.normalizeProgram(old)).toEqual(TR.defaultProgram());
    expect(TR.normalizeProgram({ sessions: [], swim: [] }).sports).toEqual([]);
  });

  it('vérifiés : sport inconnu, doublon, jour déjà pris, réglages par défaut non écrits', () => {
    const p = TR.normalizeProgram({ sessions: [{ id: 'a', name: 'A', days: [0], ex: [] }], sports: [
      { id: 'boxe', days: [0, 1, 1, 9], min: 60, int: 1 },
      { id: 'boxe', days: [2] },
      { id: 'inconnu', days: [3] },
      { id: 'tennis', days: [3], min: 90, int: 2 },
      { id: 'u-sumo', n: '  Sumo  ', c: 'combat', met: 40, days: [4], int: 0 },
      { id: 'u-sans-nom', days: [5] },
    ] });
    expect(p.sports).toEqual([
      { id: 'boxe', days: [1] },
      { id: 'tennis', days: [3], min: 90, int: 2 },
      { id: 'u-sumo', days: [4], n: 'Sumo', c: 'combat', met: 15, int: 0 },
    ]);
    expect(TR.parseProgram(JSON.stringify(p))).toEqual(p);
  });

  it('textes de la semaine', () => {
    const p = TR.defaultProgram();
    TR.setDay(p, 'sp:football', 6, true);
    expect(TR.scheduleText(p)).toBe('Lundi Haut A, mardi Bas A, jeudi Haut B, vendredi Bas B. Natation le mercredi et le samedi, football le dimanche.');
    expect(TR.sportsText(p)).toBe('natation 2 fois, football 1 fois');
    expect(TR.planOf(p)[6]).toEqual({ t: 's', sp: 'football', i: 0 });
  });

  it('coach et modèles : les sports gardent leurs jours libres', () => {
    const current = TR.defaultProgram();
    TR.setDay(current, 'sp:course', 6, true);
    for (const d of TR.defaultDays(3, { sessions: [], sports: [{ id: 'course', days: [0, 2, 4] }] })) expect([0, 2, 4]).not.toContain(d);
    const built = TR.buildProgram({ days: 4, split: 'hb', dayList: [0, 1, 2, 3] }, { current });
    expect(built.sports).toEqual([{ id: 'natation', days: [5] }, { id: 'course', days: [6] }]);
    const tpl = TR.templateProgram('ppl6', { current });
    expect(tpl.sports).toEqual([{ id: 'natation', days: [] }, { id: 'course', days: [6] }]);
  });
});

describe('sports dans la semaine', () => {
  const withFoot = () => { const p = TR.defaultProgram(); TR.setDay(p, 'sp:football', 6, true); return p; };

  it('la natation reste dans « swim », les autres sports dans « sport »', () => {
    const st = TR.migrateWeek({ swim: [true, false] }, TR.snapshotOf(withFoot()));
    expect(st.sport).toEqual({ natation: [true, false], football: [false] });
    st.sport.football[0] = true;
    const stored = TR.toStored(st);
    expect(stored.swim).toEqual([true, false]);
    expect(stored.sport).toEqual({ football: [true] });
    const again = TR.migrateWeek(JSON.parse(JSON.stringify(stored)), TR.snapshotOf(withFoot()));
    expect(again.sport).toEqual(st.sport);
  });

  it('XP : 30 par séance de sport, natation comprise', () => {
    const P = withFoot();
    const st = TR.migrateWeek({ swim: [true, true], sport: { football: [true] } }, TR.snapshotOf(P));
    const none = TR.migrateWeek({}, TR.snapshotOf(P));
    expect(TR.weekXP(st, XP) - TR.weekXP(none, XP)).toBe(90);
  });

  it('un sport fait puis retiré du programme reste compté', () => {
    const st = TR.migrateWeek({ swim: [false, false], sport: { football: [true] } }, TR.snapshotOf(TR.defaultProgram()));
    expect(st.sport.football).toEqual([true]);
    expect(st.prog.sports.find((e) => e.id === 'football')).toMatchObject({ gone: true, days: [] });
    expect(TR.planOf({ sessions: [], sports: st.prog.sports }).every((d) => d.t !== 's' || d.sp !== 'football')).toBe(true);
    // pas fait : il disparaît avec le programme
    const st2 = TR.migrateWeek({ sport: { football: [false] } }, TR.snapshotOf(TR.defaultProgram()));
    expect(st2.sport.football).toBeUndefined();
  });

  it('une coche de sport bizarre dans le stockage ne casse rien', () => {
    const st = TR.migrateWeek({ sport: { '__proto__': [true], 'a b': [true], ok: 'non' } }, TR.snapshotOf(TR.defaultProgram()));
    expect(Object.keys(st.sport)).toEqual(['natation']);
  });

  it('deux téléphones cochent des sports différents : tout est gardé', () => {
    const P = withFoot();
    const base = JSON.stringify(TR.toStored(TR.blankWeek(TR.snapshotOf(P))));
    const a = TR.migrateWeek(JSON.parse(base), TR.snapshotOf(P)); a.sport.natation[0] = true;
    const b = TR.migrateWeek(JSON.parse(base), TR.snapshotOf(P)); b.sport.football[0] = true;
    const merged = TR.migrateWeek(JSON.parse(merge3(base, JSON.stringify(TR.toStored(a)), JSON.stringify(TR.toStored(b)))), TR.snapshotOf(P));
    expect(merged.sport).toEqual({ natation: [true, false], football: [true] });
  });
});
