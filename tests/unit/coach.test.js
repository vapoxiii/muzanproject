import { describe, it, expect } from 'vitest';
import * as TR from '../../src/training/index.js';

const base = (o = {}) => ({ days: 4, split: 'hb', dayList: [0, 1, 3, 4], minutes: 60, place: 'salle', level: 'intermediaire', style: 'equilibre', zones: [], ...o });
const names = (p) => p.sessions.map((s) => s.name);
const exos = (s) => s.ex.map((e) => TR.exoById(e.x));

describe('programme construit avec le coach', () => {
  it('tous les exercices proposés existent dans la bibliothèque', () => {
    const missing = TR.SLOT_IDS.filter((id) => !TR.exoById(id));
    expect(missing).toEqual([]);
  });

  it('chaque exercice de la bibliothèque a sa cible (portion, fonction)', () => {
    const listed = Object.values(TR.CIBLE_LIST).flatMap((ids) => ids.split(' '));
    expect(listed.length).toBe(new Set(listed).size);                     // une seule cible par exercice
    expect(listed.filter((id) => !TR.exoById(id))).toEqual([]);
    expect(TR.EXERCISES.filter((x) => !x.c).map((x) => x.id)).toEqual([]);
    for (const [k, c] of Object.entries(TR.CIBLES)) {
      expect(TR.MUSCLES[c.m], k).toBeTruthy();
      expect(c.n.length && c.tip.length, k).toBeTruthy();
      expect(TR.EXERCISES.some((x) => x.c === k), k).toBe(true);
    }
    // la cible est dans le muscle de l'exercice, sauf le soulevé de terre (toute la chaîne arrière) et le curl inversé
    const cross = TR.EXERCISES.filter((x) => TR.CIBLES[x.c].m !== x.m).map((x) => x.id);
    expect(cross.sort()).toEqual(['curl-inverse', 'sdt-kb', 'sdt-sumo', 'sdt-trapbar']);
    expect(['curl-incline', 'curl-bayesian', 'curl-drag'].map((id) => TR.exoById(id).c)).toEqual(['bi-long', 'bi-long', 'bi-long']);
    expect(['curl-pupitre', 'curl-concentre', 'curl-araignee'].map((id) => TR.exoById(id).c)).toEqual(['bi-court', 'bi-court', 'bi-court']);
    expect(['curl-marteau', 'curl-inverse'].map((id) => TR.exoById(id).c)).toEqual(['brachial', 'brachial']);
    expect(['ext-poulie-tete', 'barre-front', 'pushdown-corde', 'dips-triceps'].map((id) => TR.exoById(id).c)).toEqual(['tri-long', 'tri-long', 'tri-lat', 'tri-poly']);
    expect(TR.cibleName(TR.exoById('curl-incline'))).toBe('Longue portion du biceps');
    // on retrouve un exercice par sa cible
    expect(TR.searchExos('longue portion biceps').map((x) => x.c).every((c) => c === 'bi-long')).toBe(true);
  });

  it('types de programme selon le nombre de séances', () => {
    expect([2, 3, 4, 5, 6].map(TR.recommendedSplit)).toEqual(['fb', 'fb', 'hb', 'ppl', 'ppl']);
    expect(TR.splitFreq('fb', 3)).toBe('chaque muscle trois fois par semaine');
    expect(TR.splitFreq('ppl', 6)).toBe('chaque muscle deux fois par semaine');
    expect(TR.splitFreq('hb', 3)).toBe('le haut deux fois, les jambes une fois par semaine');
    expect(TR.splitAdvice('fb', 3)).toBe(null);                          // le conseillé : rien à redire
    expect(TR.splitAdvice('ppl', 3)).toBe('Chaque muscle une fois par semaine : le full body t’en donnerait trois.');
    expect(TR.splitAllowed('fb', 5)).toBe(false);
    expect(TR.splitAllowed('ppl', 4)).toBe(false);
    expect(TR.splitWhy('ppl', 4)).toContain('haut / bas');
    expect(TR.splitWhy('fb', 6)).toContain('full body');
    // un type impossible est remplacé par le type conseillé
    expect(names(TR.buildProgram(base({ days: 4, split: 'ppl' })))).toEqual(['Haut 1', 'Bas 1', 'Haut 2', 'Bas 2']);
  });

  it('séances, noms et jours pour chaque type', () => {
    expect(names(TR.buildProgram(base({ days: 2, split: 'fb', dayList: [0, 3] })))).toEqual(['Full body A', 'Full body B']);
    expect(names(TR.buildProgram(base({ days: 3, split: 'fb', dayList: [0, 2, 4] })))).toEqual(['Full body A', 'Full body B', 'Full body C']);
    expect(names(TR.buildProgram(base({ days: 2, split: 'hb', dayList: [0, 3] })))).toEqual(['Haut', 'Bas']);
    expect(names(TR.buildProgram(base({ days: 3, split: 'ppl', dayList: [0, 2, 4] })))).toEqual(['Push', 'Pull', 'Legs']);
    expect(names(TR.buildProgram(base({ days: 5, split: 'ppl', dayList: [0, 1, 2, 4, 5] })))).toEqual(['Push', 'Pull', 'Legs', 'Haut', 'Bas']);
    expect(names(TR.buildProgram(base({ days: 6, split: 'ppl', dayList: [0, 1, 2, 3, 4, 5] })))).toEqual(['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B']);
    const p = TR.buildProgram(base());
    expect(p.sessions.map((s) => s.days)).toEqual([[0], [1], [3], [4]]);
    expect(TR.scheduleText(p)).toBe('Lundi Haut 1, mardi Bas 1, jeudi Haut 2, vendredi Bas 2. Repos le mercredi, le samedi et le dimanche.');
  });

  it('des séances cohérentes : bons muscles, pas de doublon, durée respectée', () => {
    for (const [split, days, dayList] of [['fb', 3, [0, 2, 4]], ['hb', 4, [0, 1, 3, 4]], ['ppl', 6, [0, 1, 2, 3, 4, 5]]]) {
      for (const minutes of TR.MINUTES) {
        const p = TR.buildProgram(base({ split, days, dayList, minutes }));
        for (const s of p.sessions) {
          expect(new Set(s.ex.map((e) => e.x)).size, s.name).toBe(s.ex.length);
          expect(s.ex.length, s.name + ' ' + minutes).toBeGreaterThanOrEqual(3);
          expect(TR.estimateMinutes(s.ex), s.name + ' ' + minutes).toBeLessThanOrEqual(minutes);
        }
      }
    }
    const p = TR.buildProgram(base({ split: 'ppl', days: 3, dayList: [0, 2, 4] }));
    const muscles = (i) => new Set(exos(p.sessions[i]).map((x) => x.m));
    expect([...muscles(0)].every((m) => ['pecs', 'epaules', 'triceps'].includes(m))).toBe(true);
    expect([...muscles(2)].every((m) => ['quadris', 'ischios', 'fessiers', 'mollets', 'abdos'].includes(m))).toBe(true);
    expect(exos(p.sessions[0])[0].id).toBe('dc-barre');         // le mouvement de base en premier
    // plus de temps, plus d'exercices
    const n = (minutes) => TR.buildProgram(base({ minutes })).sessions[0].ex.length;
    expect(n(45)).toBeLessThan(n(90));
  });

  it('de la variété entre deux séances du même genre', () => {
    const p = TR.buildProgram(base());
    const a = p.sessions[0].ex.map((e) => e.x), b = p.sessions[2].ex.map((e) => e.x);
    expect(a.filter((x) => b.includes(x)).length).toBeLessThanOrEqual(1);
  });

  it('le lieu décide du matériel', () => {
    const home = TR.buildProgram(base({ place: 'maison' }));
    for (const x of home.sessions.flatMap(exos)) expect(['halteres', 'pdc', 'elastique', 'kb', 'disque'].includes(x.e) || x.id === 'curl-sac', x.id).toBe(true);
    const none = TR.buildProgram(base({ place: 'pdc' }));
    for (const x of none.sessions.flatMap(exos)) expect(x.e === 'pdc' || x.id === 'curl-sac', x.id).toBe(true);
    expect(none.sessions.every((s) => s.ex.length >= 3)).toBe(true);
  });

  it('niveau et façon de travailler : séries, répétitions, repos', () => {
    const first = (o) => TR.buildProgram(base(o)).sessions[0].ex[0];
    expect(first({})).toMatchObject({ x: 'dc-barre', sets: 3, lo: 6, hi: 10, rest: 150 });
    expect(first({ style: 'force' })).toMatchObject({ sets: 4, lo: 4, hi: 6, rest: 180 });
    expect(first({ style: 'volume' })).toMatchObject({ sets: 3, lo: 10, hi: 12, rest: 120 });
    expect(first({ style: 'force', level: 'debutant' })).toMatchObject({ sets: 3, lo: 6, hi: 8 });
    expect(first({ level: 'avance' })).toMatchObject({ sets: 4 });
    // débutant : tirage à la poulie plutôt que tractions
    const pull = TR.buildProgram(base({ split: 'ppl', days: 3, dayList: [0, 2, 4], level: 'debutant' })).sessions[1].ex[0];
    expect(pull.x).toBe('tv-poulie');
    // pompes : plus de répétitions qu'à la barre
    expect(TR.buildProgram(base({ place: 'pdc' })).sessions[0].ex[0]).toMatchObject({ x: 'pompes-lestees', lo: 8, hi: 15 });
  });

  it('zones prioritaires : un exercice de plus les jours concernés, avec l’étiquette', () => {
    const without = TR.buildProgram(base({ split: 'ppl', days: 3, dayList: [0, 2, 4] }));
    const withArms = TR.buildProgram(base({ split: 'ppl', days: 3, dayList: [0, 2, 4], zones: ['bras'] }));
    expect(withArms.sessions[0].ex.length).toBe(without.sessions[0].ex.length + 1);   // push : triceps en plus
    expect(withArms.sessions[1].ex.length).toBe(without.sessions[1].ex.length + 1);   // pull : biceps en plus
    expect(withArms.sessions[2].ex.length).toBe(without.sessions[2].ex.length);       // legs : rien
    const tagged = withArms.sessions[1].ex.filter((e) => e.a === 'bras').map((e) => TR.exoById(e.x).m);
    expect(tagged.length).toBeGreaterThanOrEqual(2);
    expect(tagged.every((m) => ['biceps', 'triceps', 'avbras'].includes(m))).toBe(true);
  });

  it('natation et exercices créés gardés ; séances vides pour tout choisir soi-même', () => {
    const current = TR.defaultProgram();
    current.custom = [{ id: 'c-x', n: 'Mon exo', m: 'pecs', e: 'autre', t: 'i', mode: 'r' }];
    const p = TR.buildProgram(base({ dayList: [0, 1, 3, 4] }), { current });
    expect(p.sports).toEqual([{ id: 'natation', days: [2, 5] }]);
    expect(p.custom.map((c) => c.id)).toEqual(['c-x']);
    // un jour de natation pris par une séance : la natation le libère
    expect(TR.buildProgram(base({ dayList: [0, 2, 3, 4] }), { current }).sports).toEqual([{ id: 'natation', days: [5] }]);
    const empty = TR.buildProgram(base(), { current, empty: true });
    expect(names(empty)).toEqual(['Haut 1', 'Bas 1', 'Haut 2', 'Bas 2']);
    expect(empty.sessions.every((s) => s.ex.length === 0)).toBe(true);
    expect(TR.normalizeProgram(structuredClone(p))).toEqual(p);
  });

  it('réponses par défaut : profil, programme actuel, jours libres pour la natation', () => {
    const current = TR.defaultProgram();
    expect(TR.defaultAnswers({ current })).toMatchObject({ days: 4, split: 'hb', dayList: [0, 1, 3, 4], minutes: 60, place: 'salle' });
    expect(TR.defaultAnswers({ profile: { sessions: 3, experience: 'debutant', zones: ['bras', 'xx'] }, current }))
      .toMatchObject({ days: 3, split: 'fb', level: 'debutant', zones: ['bras'], dayList: [0, 1, 3] });
    expect(TR.defaultDays(5, current)).toEqual([0, 1, 3, 4, 6]);
    expect(TR.checkAnswers({ days: 9, split: 'xx', dayList: [1, 1], minutes: 50, place: 'lune' }))
      .toMatchObject({ days: 6, split: 'ppl', dayList: [0, 1, 2, 3, 4, 5], minutes: 60, place: 'salle' });
  });

  it('séances faites de portions : biceps, triceps, pectoraux, dos', () => {
    const c = (s) => s.ex.map((e) => TR.exoById(e.x).c);
    const hb = TR.buildProgram(base());
    expect(c(hb.sessions[0])).toEqual(expect.arrayContaining(['pecs-milieu', 'dos-epaisseur', 'dos-largeur', 'bi', 'tri-lat']));
    expect(c(hb.sessions[2])).toEqual(expect.arrayContaining(['pecs-haut', 'dos-largeur', 'dos-epaisseur', 'bi-long', 'tri-long']));
    expect(c(hb.sessions[1])).toEqual(expect.arrayContaining(['quad-squat', 'isch-hanche', 'quad-uni', 'isch-genou']));
    // 6 séances, priorité aux bras : les trois portions du biceps le jour du tirage, deux du triceps le jour de la poussée
    const ppl = TR.buildProgram(base({ split: 'ppl', days: 6, dayList: [0, 1, 2, 3, 4, 5], zones: ['bras'] }));
    expect(c(ppl.sessions[1])).toEqual(expect.arrayContaining(['bi-long', 'brachial', 'bi-court']));
    expect(c(ppl.sessions[0])).toEqual(expect.arrayContaining(['tri-long', 'tri-lat']));
    // sans matériel et débutant : pas de pistol squat, pas de dips aux barres
    const pdc = TR.buildProgram(base({ split: 'fb', days: 3, dayList: [0, 2, 4], place: 'pdc', level: 'debutant' }));
    const ids = pdc.sessions.flatMap((s) => s.ex.map((e) => e.x));
    expect(ids).not.toContain('pistol');
    expect(ids).not.toContain('dips-triceps');
    expect(ids).toContain('fentes-pdc');
  });

  it('remplaçants : la même cible, matériel disponible, pas déjà dans la séance', () => {
    const a = base({ place: 'maison' });
    const p = TR.buildProgram(a);
    const s = p.sessions[0], e = s.ex[0], x = TR.exoById(e.x);
    const alts = TR.alternatives(e, s, a);
    expect(alts.cible).toMatchObject({ id: 'pecs-milieu', n: 'Milieu des pectoraux' });
    expect(alts.same.length).toBeGreaterThan(2);
    expect(alts.other).toEqual([]);                                      // assez de choix dans la cible
    for (const y of alts.same) {
      expect(y.c).toBe(x.c);
      expect(['halteres', 'pdc', 'elastique', 'kb', 'disque'].includes(y.e) || y.id === 'curl-sac').toBe(true);
      expect(s.ex.some((z) => z.x === y.id)).toBe(false);
    }
    expect(alts.same[0].t).toBe(x.t);                                    // le même genre de mouvement d'abord
    // la longue portion du biceps : rien que des exercices bras derrière le corps
    const curl = { id: 'z', x: 'curl-incline', sets: 3, mode: 'r', lo: 10, hi: 15, rest: 75 };
    const long = TR.alternatives(curl, { ex: [curl] }, base());
    expect(long.same.map((y) => y.id).sort()).toEqual(['curl-bayesian', 'curl-drag', 'curl-drag-halt', 'curl-incline-poulie', 'curl-serre']);
    // peu de choix dans la cible : le reste du muscle, à part
    const sol = { id: 'w', x: 'mollets-assis', sets: 4, mode: 'r', lo: 10, hi: 15, rest: 60 };
    const ms = TR.alternatives(sol, { ex: [sol] }, base());
    expect(ms.same.map((y) => y.id)).toEqual(['mollets-assis-halt']);
    expect(ms.other.length).toBeGreaterThan(0);
    expect(ms.other.every((y) => y.m === 'mollets' && y.c !== 'mol-sol')).toBe(true);
    // même genre de mouvement : réglages gardés ; isolation à la place d'un polyarticulaire : réglages d'isolation
    const keep = { ...e };
    TR.swapExercise(e, alts.same.find((y) => y.t === x.t), a);
    expect([e.sets, e.lo, e.hi, e.rest]).toEqual([keep.sets, keep.lo, keep.hi, keep.rest]);
    const iso = TR.alternatives(e, s, a, { limit: 40 }).same.find((y) => y.t === 'i');
    TR.swapExercise(e, iso, a);
    expect(e).toMatchObject({ x: iso.id, lo: 10, hi: 15, rest: 75 });
  });
});
