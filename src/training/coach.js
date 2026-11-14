// Programme construit avec le coach. À partir des réponses aux questions de Ren (nombre de séances,
// type de programme, jours, durée, lieu, niveau, façon de travailler, zones prioritaires), un
// programme complet. Chaque séance est faite de cibles (longue portion du biceps, haut des
// pectoraux…) ; pour chaque exercice, les remplaçants sont ceux de la même cible. Fonctions pures.
//
// Réponses :
//   { days: 2..6, split: 'fb' | 'hb' | 'ppl', dayList: [jours, lundi = 0], minutes: 45 | 60 | 75 | 90,
//     place: 'salle' | 'maison' | 'pdc', level: 'debutant' | 'intermediaire' | 'avance',
//     style: 'force' | 'equilibre' | 'volume', zones: ['bras', 'jambes'…] }

import { EXERCISES, CIBLES, exoById, defaultsFor, ZONES } from './exercises.js';
import { normalizeProgram, newId, mainSessions, sportsList } from './program.js';

// ---- Types de programme ----
export const SPLITS = {
  fb: { label: 'Full body', sub: 'Tout le corps à chaque séance', days: [2, 3, 4] },
  hb: { label: 'Haut / Bas', sub: 'Une séance haut du corps, une séance jambes', days: [2, 3, 4, 5, 6] },
  ppl: { label: 'Push / Pull / Legs', sub: 'Poussée, tirage, jambes', days: [3, 5, 6] },
};
export function recommendedSplit(n) { return n <= 3 ? 'fb' : n === 4 ? 'hb' : 'ppl'; }
// Combien de fois chaque muscle travaille dans la semaine, pour un type et un nombre de séances
const TIMES = ['', 'une', 'deux', 'trois', 'quatre'];
export function splitFreq(split, n) {
  if (split === 'fb') return 'chaque muscle ' + TIMES[Math.min(4, n)] + ' fois par semaine';
  if (split === 'hb') return n % 2 === 0 ? 'chaque muscle ' + TIMES[n / 2] + ' fois par semaine'
    : 'le haut ' + TIMES[Math.ceil(n / 2)] + ' fois, les jambes ' + TIMES[Math.floor(n / 2)] + ' fois par semaine';
  if (split === 'ppl') return 'chaque muscle ' + (n >= 5 ? 'deux' : 'une') + ' fois par semaine';
  return '';
}
// Ce que dit le coach quand on choisit un autre type que celui qu'il conseille (null s'il est conseillé)
export function splitAdvice(split, n) {
  if (!splitAllowed(split, n) || split === recommendedSplit(n)) return null;
  const f = splitFreq(split, n), F = f.charAt(0).toUpperCase() + f.slice(1);
  if (split === 'ppl' && n === 3) return F + ' : le full body t’en donnerait trois.';
  if (split === 'hb' && n === 2) return F + ' : le full body t’en donnerait deux.';
  if (split === 'hb' && n === 3) return F + ' : bien pour insister sur le haut.';
  if (split === 'fb' && n === 4) return F + ' : ça marche, avec des séances plus courtes.';
  return F + ' : ça marche aussi.';
}
export function splitAllowed(split, n) { return !!SPLITS[split] && SPLITS[split].days.includes(n); }
// Pourquoi un type n'est pas proposé pour ce nombre de séances (texte court), ou ''
export function splitWhy(split, n) {
  if (splitAllowed(split, n)) return '';
  if (split === 'fb') return 'Trop de séances pour du full body';
  if (split === 'ppl') return n < 3 ? 'Il faut au moins 3 séances' : 'Avec 4 séances, le haut / bas marche mieux';
  return '';
}

// ---- Lieu : matériel disponible ----
export const PLACES = {
  salle: { label: 'En salle', sub: 'Machines, poulies, barres, haltères', eq: null },
  maison: { label: 'À la maison', sub: 'Haltères, élastiques, poids du corps', eq: ['halteres', 'pdc', 'elastique', 'kb', 'disque'], ids: ['curl-sac'] },
  pdc: { label: 'Sans matériel', sub: 'Poids du corps, une barre de traction', eq: ['pdc'], ids: ['curl-sac'] },
};
export function allowFor(place) {
  const p = PLACES[place] || PLACES.salle;
  return (x) => !!x && (!p.eq || p.eq.includes(x.e) || (p.ids || []).includes(x.id));
}

export const MINUTES = [45, 60, 75, 90];
const MAX_EX = { 45: 5, 60: 6, 75: 7, 90: 8 };
const MIN_EX = 3;

// ---- Emplacements d'exercices : cible, rôle, choix par ordre de préférence ----
// rôle : main (premier mouvement lourd de la séance), comp (polyarticulaire), iso (isolation)
// beg : préférences pour un débutant ; home : hors de la salle (placées en tête). Sans choix possible
// (matériel), un autre exercice de la même cible, puis du même muscle.
const SLOTS = {
  pecsMain: ['pecs-milieu', 'main', ['dc-barre', 'dc-halteres', 'dc-machine', 'pompes-lestees', 'pompes'], { beg: ['dc-halteres', 'dc-barre', 'dc-machine', 'pompes'] }],
  pecsInc: ['pecs-haut', 'comp', ['di-halteres', 'di-barre', 'di-machine', 'di-smith', 'pompes-declinees']],
  pecsIso: ['pecs-milieu', 'iso', ['ec-poulie', 'pec-deck', 'ec-halteres', 'ec-elastique', 'pompes-larges']],
  pecsHautIso: ['pecs-haut', 'iso', ['ec-poulie-basse', 'ei-halteres', 'pompes-declinees']],
  pecsBas: ['pecs-bas', 'comp', ['dips-pecs', 'dd-halteres', 'dd-barre', 'dd-machine', 'ec-poulie-haute'], { home: ['dd-halteres', 'pompes-inclinees'] }],
  dosVert: ['dos-largeur', 'main', ['tractions', 'tv-poulie', 'tractions-assist', 'tractions-neg'], { beg: ['tv-poulie', 'tractions-assist', 'tractions-neg', 'tv-elastique'] }],
  dosVert2: ['dos-largeur', 'comp', ['tv-poulie', 'tv-neutre', 'tractions-neutre', 'tv-elastique', 'tractions-sup'], { beg: ['tv-poulie', 'tv-neutre', 'tv-elastique', 'tractions-assist'] }],
  dosHoriz: ['dos-epaisseur', 'comp', ['row-barre', 'row-1bras', 'th-poulie', 'row-machine', 'row-halteres', 'row-elastique', 'tractions-austr']],
  dosIso: ['dos-largeur', 'iso', ['tv-bras-tendus', 'pullover-corde', 'scap-pull']],
  epComp: ['ep-ant', 'comp', ['de-halteres', 'dm-barre', 'de-machine', 'arnold', 'de-elastique', 'pompes-piquees']],
  epIso: ['ep-lat', 'iso', ['el-halteres', 'el-poulie', 'el-machine', 'el-elastique']],
  epArr: ['ep-post', 'iso', ['face-pull', 'reverse-pec', 'oiseau', 'face-pull-el', 'pull-apart', 'ytw-sol']],
  bicep: ['bi', 'iso', ['curl-ez', 'curl-halteres', 'curl-barre', 'curl-poulie', 'curl-elastique', 'curl-sac']],
  bicepLong: ['bi-long', 'iso', ['curl-incline', 'curl-bayesian', 'curl-drag', 'curl-drag-halt', 'curl-serre']],
  bicepCourt: ['bi-court', 'iso', ['curl-pupitre', 'curl-concentre', 'curl-araignee', 'curl-pupitre-halt', 'curl-poulie-haute']],
  brachial: ['brachial', 'iso', ['curl-marteau', 'curl-marteau-corde', 'curl-inverse', 'curl-zottman']],
  tricepLat: ['tri-lat', 'iso', ['pushdown-corde', 'pushdown-barre', 'ext-triceps-el', 'kickback', 'pushdown-1bras']],
  tricepLong: ['tri-long', 'iso', ['ext-poulie-tete', 'barre-front', 'ext-halt-2mains', 'ext-halt-tete', 'ext-elastique-tete']],
  tricepC: ['tri-poly', 'comp', ['dips-triceps', 'dc-serre', 'dips-machine', 'pompes-diamant', 'dips-banc'], { home: ['pompes-diamant', 'dips-banc'] }],
  quadMain: ['quad-squat', 'main', ['squat', 'presse', 'hack-squat', 'goblet', 'squat-pdc'], { beg: ['goblet', 'presse', 'squat-pdc'] }],
  quadSec: ['quad-squat', 'comp', ['presse', 'hack-squat', 'pendulum', 'goblet', 'squat-pdc']],
  quadUni: ['quad-uni', 'comp', ['bulgare', 'fentes-marchees', 'fentes-avant', 'split-squat', 'fentes-arriere', 'step-up', 'bulgare-pdc', 'fentes-pdc', 'pistol'], { beg: ['fentes-avant', 'split-squat', 'fentes-pdc'] }],
  quadIso: ['quad-iso', 'iso', ['leg-ext', 'sissy', 'spanish-squat', 'chaise']],
  hinge: ['isch-hanche', 'main', ['rdl', 'rdl-halteres', 'sldl', 'good-morning', 'rdl-1jambe', 'hip-thrust-1'], { beg: ['rdl-halteres', 'rdl-1jambe', 'hip-thrust-1'] }],
  hamIso: ['isch-genou', 'iso', ['leg-curl-assis', 'leg-curl-allonge', 'leg-curl-halt', 'leg-curl-ballon', 'leg-curl-glisse', 'nordic']],
  glute: ['fess-grand', 'comp', ['hip-thrust', 'hip-thrust-machine', 'pont', 'kb-swing', 'hip-thrust-1', 'pont-1']],
  gluteMed: ['fess-moyen', 'iso', ['abduction', 'abduction-poulie', 'marche-laterale', 'clamshell', 'fire-hydrant']],
  calves: ['mol-gastro', 'iso', ['mollets-debout', 'mollets-presse', 'mollets-halt', 'mollets-pdc', 'mollets-smith']],
  calvesSol: ['mol-sol', 'iso', ['mollets-assis', 'mollets-assis-halt']],
  abs: ['abs-haut', 'iso', ['crunch-poulie', 'crunch', 'crunch-machine', 'crunch-decline']],
  absBas: ['abs-bas', 'iso', ['rjs', 'rgs', 'crunch-inverse', 'rj-chaise', 'rj-sol']],
  absGain: ['gainage', 'iso', ['ab-wheel', 'planche', 'dead-bug', 'hollow']],
  absObl: ['obliques', 'iso', ['woodchop', 'pallof', 'crunch-bicyclette', 'planche-laterale']],
  forearm: ['avb-flech', 'iso', ['wrist-curl', 'wrist-curl-halt', 'wrist-dos']],
  traps: ['trap-haut', 'iso', ['shrug-halteres', 'shrug-barre', 'shrug-machine', 'shrug-trapbar']],
};
export const SLOT_IDS = Object.values(SLOTS).flatMap(([, , ids, o]) => ids.concat((o && o.beg) || [], (o && o.home) || []));
// barres parallèles : rarement à la maison
const APPARATUS = new Set(['dips-triceps', 'dips-pecs']);
export const SLOT_CIBLES = Object.fromEntries(Object.entries(SLOTS).map(([k, v]) => [k, v[0]]));
const slotMuscle = (key) => CIBLES[SLOTS[key][0]].m;

// ---- Séances types : emplacements par ordre d'importance (les premiers passent en premier) ----
const UP = ['pecs', 'dos', 'epaules', 'biceps', 'triceps', 'trapezes', 'avbras'];
const LOW = ['quadris', 'ischios', 'fessiers', 'mollets', 'abdos', 'adducteurs'];
const TYPES = {
  fbA: { k: 'fb', sub: 'Tout le corps', slots: ['quadMain', 'pecsMain', 'dosHoriz', 'epComp', 'bicep', 'abs', 'calves', 'tricepLat'] },
  fbB: { k: 'fb', sub: 'Tout le corps', slots: ['hinge', 'pecsInc', 'dosVert', 'quadUni', 'epIso', 'tricepLong', 'absBas', 'bicepLong'] },
  fbC: { k: 'fb', sub: 'Tout le corps', slots: ['quadSec', 'tricepC', 'dosHoriz', 'hamIso', 'epArr', 'absGain', 'pecsIso', 'brachial'] },
  hautA: { k: 'haut', m: UP, sub: 'Pectoraux, dos, épaules, bras', slots: ['pecsMain', 'dosHoriz', 'epComp', 'dosVert2', 'bicep', 'tricepLat', 'epIso', 'pecsIso'] },
  hautB: { k: 'haut', m: UP, sub: 'Pectoraux, dos, épaules, bras', slots: ['pecsInc', 'dosVert', 'epIso', 'dosHoriz', 'bicepLong', 'tricepLong', 'epArr', 'pecsIso'] },
  basA: { k: 'bas', m: LOW, sub: 'Jambes et abdos', slots: ['quadMain', 'hinge', 'quadUni', 'hamIso', 'calves', 'abs', 'glute', 'quadIso'] },
  basB: { k: 'bas', m: LOW, sub: 'Jambes et abdos', slots: ['glute', 'quadSec', 'hinge', 'quadIso', 'hamIso', 'calvesSol', 'absBas', 'quadUni'] },
  push: { k: 'push', m: ['pecs', 'epaules', 'triceps'], sub: 'Pectoraux, épaules, triceps', slots: ['pecsMain', 'epComp', 'pecsInc', 'epIso', 'tricepLong', 'pecsIso', 'tricepLat', 'pecsBas'] },
  pushB: { k: 'push', m: ['pecs', 'epaules', 'triceps'], sub: 'Pectoraux, épaules, triceps', slots: ['epComp', 'pecsInc', 'pecsMain', 'epIso', 'tricepC', 'pecsHautIso', 'tricepLong', 'epArr'] },
  pull: { k: 'pull', m: ['dos', 'epaules', 'biceps', 'trapezes', 'avbras'], sub: 'Dos, arrière d’épaule, biceps', slots: ['dosVert', 'dosHoriz', 'epArr', 'bicepLong', 'dosVert2', 'brachial', 'traps', 'forearm'] },
  pullB: { k: 'pull', m: ['dos', 'epaules', 'biceps', 'trapezes', 'avbras'], sub: 'Dos, arrière d’épaule, biceps', slots: ['dosHoriz', 'dosVert2', 'epArr', 'bicep', 'dosIso', 'bicepCourt', 'traps', 'forearm'] },
  legs: { k: 'legs', m: LOW, sub: 'Jambes', slots: ['quadMain', 'hinge', 'quadUni', 'hamIso', 'calves', 'abs', 'quadIso', 'glute'] },
  legsB: { k: 'legs', m: LOW, sub: 'Jambes', slots: ['hinge', 'quadSec', 'glute', 'quadIso', 'hamIso', 'calvesSol', 'absBas', 'quadUni'] },
};
const PLAN = {
  fb: { 2: ['fbA', 'fbB'], 3: ['fbA', 'fbB', 'fbC'], 4: ['fbA', 'fbB', 'fbC', 'fbA'] },
  hb: { 2: ['hautA', 'basA'], 3: ['hautA', 'basA', 'hautB'], 4: ['hautA', 'basA', 'hautB', 'basB'], 5: ['hautA', 'basA', 'hautB', 'basB', 'hautA'], 6: ['hautA', 'basA', 'hautB', 'basB', 'hautA', 'basB'] },
  ppl: { 3: ['push', 'pull', 'legs'], 5: ['push', 'pull', 'legs', 'hautB', 'basB'], 6: ['push', 'pull', 'legs', 'pushB', 'pullB', 'legsB'] },
};
// Zone prioritaire : un exercice de plus, parmi ces emplacements (selon les muscles du jour) :
// d'abord les portions qui manquent à la séance
const ZONE_EXTRA = {
  bras: ['bicepLong', 'tricepLong', 'brachial', 'tricepLat', 'bicepCourt', 'bicep', 'forearm'],
  epaules: ['epIso', 'epArr'], dos: ['dosIso', 'dosVert2', 'dosHoriz'], pecs: ['pecsHautIso', 'pecsIso', 'pecsBas', 'pecsInc'],
  jambes: ['quadIso', 'hamIso', 'gluteMed', 'glute', 'calves'], abdos: ['absObl', 'absBas', 'abs'],
};

function sessionNames(split, plan) {
  if (split === 'fb') return plan.map((_, i) => 'Full body ' + 'ABCD'[i]);
  const kinds = plan.map((t) => TYPES[t].k);
  if (split === 'ppl' && plan.length === 6) return ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'];
  const LBL = { push: 'Push', pull: 'Pull', legs: 'Legs', haut: 'Haut', bas: 'Bas' };
  const total = {}, seen = {};
  kinds.forEach((k) => { total[k] = (total[k] || 0) + 1; });
  return kinds.map((k) => { seen[k] = (seen[k] || 0) + 1; return LBL[k] + (total[k] > 1 ? ' ' + seen[k] : ''); });
}

// ---- Séries, répétitions, repos ----
const DOSE = {
  force: { main: [4, 4, 6, 180], comp: [3, 6, 8, 150], iso: [3, 8, 12, 90] },
  equilibre: { main: [3, 6, 10, 150], comp: [3, 8, 12, 120], iso: [3, 10, 15, 75] },
  volume: { main: [3, 10, 12, 120], comp: [3, 10, 15, 90], iso: [3, 12, 20, 60] },
};
// Mouvements difficiles : peu de répétitions, quel que soit le style
const HARD = { 'tractions-neg': [3, 6], 'nordic': [4, 8], 'pistol': [5, 10], 'muscle-up': [3, 6], 'hspu': [3, 8], 'pompes-archer': [5, 10], 'dragon-flag': [4, 8], 'tractions-lestees': [4, 8] };
export function doseFor(x, role, level = 'intermediaire', style = 'equilibre') {
  const d = defaultsFor(x);
  if (d.mode !== 'r') return d;                       // gainage, portés, cardio : réglages de la bibliothèque
  if (['abdos', 'mollets', 'avbras'].includes(x.m)) return level === 'debutant' ? { ...d, sets: Math.min(d.sets, 3) } : d;
  let [sets, lo, hi, rest] = (DOSE[style] || DOSE.equilibre)[role] || DOSE.equilibre.comp;
  // au poids du corps (pompes, squats…), on compte plus de répétitions
  if (x.e === 'pdc' && !x.heavy && ['pecs', 'triceps', 'epaules', 'quadris', 'fessiers'].includes(x.m)) { lo = Math.max(lo, 8); hi = Math.max(hi, 15); }
  if (level === 'debutant') { sets = Math.min(sets, 3); if (lo < 6) { lo = 6; hi = Math.max(hi, 8); } }
  if (level === 'avance' && role !== 'iso') sets = Math.min(5, sets + 1);
  if (HARD[x.id]) [lo, hi] = HARD[x.id];
  return { mode: 'r', sets, lo, hi, rest };
}

// Même estimation que le constructeur : séries × (effort + repos), plus l'échauffement
function exSeconds(e) {
  const sets = (e.sets || 3) * (e.each ? 2 : 1);
  const work = e.mode === 't' ? (e.max ? 45 : ((e.lo ?? 30) + (e.hi ?? e.lo ?? 30)) / 2) : e.mode === 'd' ? 60 : 45;
  return sets * (work + (e.rest ?? 90));
}
export function estimateMinutes(ex) {
  if (!ex.length) return 0;
  return Math.max(10, Math.round((ex.reduce((a, e) => a + exSeconds(e), 0) / 60 + 5) / 5) * 5);
}

function zoneOfMuscle(m, zones) { return (zones || []).find((z) => (ZONES[z] || []).includes(m)) || null; }

function makeEx(x, role, ans) {
  const d = doseFor(x, role, ans.level, ans.style);
  const e = { x: x.id, sets: d.sets, mode: d.mode, lo: d.lo, hi: d.hi, rest: d.rest };
  if (d.max) e.max = true;
  const z = zoneOfMuscle(x.m, ans.zones);
  if (z) e.a = z;
  return e;
}

// Rien de possible parmi les choix (matériel) : la même cible, du même type, puis de tout type ;
// sinon le même muscle. Les plus courants d'abord, les mouvements difficiles à la fin pour un débutant.
function fallback(cible, role, ok, level, home) {
  const t = role === 'iso' ? 'i' : 'c', m = CIBLES[cible].m;
  const rank = (x) => (x.pop ? 0 : 1) + (level === 'debutant' && (HARD[x.id] || x.heavy) ? 2 : 0) + (home && APPARATUS.has(x.id) ? 2 : 0);
  const pick = (f) => EXERCISES.filter((x) => x.mode === 'r' && ok(x) && f(x)).sort((a, b) => rank(a) - rank(b)).map((x) => x.id);
  for (const f of [(x) => x.c === cible && x.t === t, (x) => x.c === cible, (x) => x.m === m && x.t === t, (x) => x.m === m]) {
    const ids = pick(f);
    if (ids.length) return ids;
  }
  return [];
}
function pickFor(key, { allowed, used, usedProg, level, home }) {
  const [cible, role, ids, opt] = SLOTS[key];
  const first = (home && opt && opt.home ? opt.home : []).concat(level === 'debutant' && opt && opt.beg ? opt.beg : []);
  const pref = [...new Set(first.concat(ids))];
  const ok = (x) => !!x && allowed(x) && !used.has(x.id);
  let cand = pref.filter((id) => ok(exoById(id)));
  if (!cand.length) cand = fallback(cible, role, ok, level, home);
  if (!cand.length) return null;
  return cand.find((id) => !usedProg.has(id)) || cand[0];     // de la variété d'une séance à l'autre
}

function fillSession(type, ans, allowed, usedProg) {
  const used = new Set(), out = [];
  const maxN = MAX_EX[ans.minutes] || 6, budget = ans.minutes || 60;
  const add = (key) => {
    const id = pickFor(key, { allowed, used, usedProg, level: ans.level, home: ans.place !== 'salle' });
    if (!id) return null;
    const o = { key, e: makeEx(exoById(id), SLOTS[key][1], ans), fresh: !usedProg.has(id) };
    used.add(id); usedProg.add(id); out.push(o);
    return o;
  };
  const undo = () => { const o = out.pop(); used.delete(o.e.x); if (o.fresh) usedProg.delete(o.e.x); };
  for (const key of type.slots) {
    if (out.length >= maxN) break;
    if (!add(key)) continue;
    if (out.length > MIN_EX && estimateMinutes(out.map((o) => o.e)) > budget) { undo(); break; }
  }
  // zones prioritaires : un exercice de plus par zone travaillée ce jour-là (deux au plus)
  let extra = 0;
  for (const z of ans.zones || []) {
    if (extra >= 2) break;
    const keys = (ZONE_EXTRA[z] || []).filter((k) => (!type.m || type.m.includes(slotMuscle(k))) && !out.some((o) => o.key === k));
    for (const k of keys) if (add(k)) { extra++; break; }
  }
  return out.map((o) => o.e);
}

// ---- Jours ----
const DAY_PATTERNS = {
  2: [[0, 3], [1, 4], [0, 4]],
  3: [[0, 2, 4], [0, 1, 3], [0, 3, 4], [1, 3, 5], [1, 3, 6]],
  4: [[0, 1, 3, 4], [0, 2, 3, 5], [0, 1, 3, 5]],
  5: [[0, 1, 2, 4, 5], [0, 1, 3, 4, 6], [0, 1, 2, 3, 4]],
  6: [[0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 6], [0, 1, 3, 4, 5, 6]],
};
// Jours proposés : ceux du programme actuel s'ils sont autant, sinon une semaine bien répartie
// qui laisse les sports (natation, course…) sur leurs jours
export function defaultDays(n, current = null) {
  const mine = current ? [...new Set(mainSessions(current).flatMap((s) => s.days))].sort((a, b) => a - b) : [];
  if (mine.length === n) return mine;
  const busy = new Set(current ? sportsList(current).flatMap((e) => e.days) : []);
  const pats = DAY_PATTERNS[n] || DAY_PATTERNS[4];
  return (pats.find((p) => !p.some((d) => busy.has(d))) || pats[0]).slice();
}

// ---- Réponses par défaut (profil et programme actuel) ----
const clampDays = (n) => Math.min(6, Math.max(2, Math.round(n)));
export function defaultAnswers({ profile = null, current = null } = {}) {
  const n = profile && profile.sessions ? clampDays(profile.sessions) : current && mainSessions(current).length ? clampDays(mainSessions(current).length) : 4;
  return {
    days: n, split: recommendedSplit(n), dayList: defaultDays(n, current), minutes: 60, place: 'salle',
    level: profile && ['debutant', 'intermediaire', 'avance'].includes(profile.experience) ? profile.experience : 'intermediaire',
    style: 'equilibre', zones: profile && Array.isArray(profile.zones) ? profile.zones.filter((z) => ZONES[z]) : [],
  };
}
// Réponses vérifiées (type de programme possible, bon nombre de jours…)
export function checkAnswers(a) {
  const days = clampDays(a && a.days ? a.days : 4);
  const split = splitAllowed(a && a.split, days) ? a.split : recommendedSplit(days);
  let dayList = [...new Set((a && a.dayList) || [])].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((x, y) => x - y);
  if (dayList.length !== days) dayList = defaultDays(days);
  return {
    days, split, dayList,
    minutes: MINUTES.includes(a && a.minutes) ? a.minutes : 60,
    place: PLACES[a && a.place] ? a.place : 'salle',
    level: ['debutant', 'intermediaire', 'avance'].includes(a && a.level) ? a.level : 'intermediaire',
    style: DOSE[a && a.style] ? a.style : 'equilibre',
    zones: ((a && a.zones) || []).filter((z) => ZONES[z]),
  };
}

// ---- Le programme ----
// empty : séances créées sans exercices (l'utilisateur les choisit lui-même)
export function buildProgram(answers, { current = null, empty = false } = {}) {
  const a = checkAnswers(answers);
  const plan = PLAN[a.split][a.days];
  const names = sessionNames(a.split, plan);
  const allowed = allowFor(a.place), usedProg = new Set();
  const sessions = plan.map((t, i) => {
    const id = newId('s');
    const ex = empty ? [] : fillSession(TYPES[t], a, allowed, usedProg).map((e, j) => ({ id: id + '-' + (j + 1), ...e }));
    return { id, name: names[i], sub: TYPES[t].sub, opt: false, days: [a.dayList[i]], ex };
  });
  const taken = new Set(a.dayList);
  return normalizeProgram({
    v: 1, sessions,
    sports: (current ? sportsList(current) : []).map((e) => ({ ...e, days: e.days.filter((d) => !taken.has(d)) })),
    custom: ((current && current.custom) || []).slice(),
  });
}

// ---- Remplaçants d'un exercice ----
// same : la même cible (même portion, même fonction), ils se remplacent ; other : le même muscle,
// autrement, seulement quand la cible offre peu de choix. Matériel disponible, même mesure (répétitions,
// durée…), pas déjà dans la séance. Le même genre de mouvement d'abord, puis les plus courants.
export function alternatives(e, session, answers, { limit = 6 } = {}) {
  const x = exoById(e.x);
  if (!x) return { cible: null, same: [], other: [] };
  const a = answers || {};
  const allowed = allowFor(a.place);
  const inSes = new Set(session.ex.map((y) => y.x));
  const ok = (y) => y.id !== x.id && !inSes.has(y.id) && y.mode === x.mode && allowed(y);
  const rank = (y) => (y.t === x.t ? 0 : 4) + (y.pop ? 0 : 1) + (a.level === 'debutant' && (HARD[y.id] || y.heavy) ? 2 : 0);
  const order = (list) => list.map((y, i) => [y, rank(y), i]).sort((p, q) => p[1] - q[1] || p[2] - q[2]).map((p) => p[0]);
  const same = x.c ? order(EXERCISES.filter((y) => y.c === x.c && ok(y))).slice(0, limit) : [];
  const other = same.length >= 3 ? [] : order(EXERCISES.filter((y) => y.m === x.m && y.c !== x.c && ok(y))).slice(0, 4);
  return { cible: x.c ? { id: x.c, ...CIBLES[x.c] } : null, same, other };
}

// Remplace l'exercice : mêmes réglages si c'est le même genre de mouvement, sinon ceux du nouveau
export function swapExercise(e, y, answers) {
  const a = checkAnswers(answers || {});
  const x = exoById(e.x);
  e.x = y.id;
  delete e.n;
  if (!x || x.mode !== y.mode || x.t !== y.t) {
    const d = doseFor(y, y.t === 'c' ? 'comp' : 'iso', a.level, a.style);
    Object.assign(e, { mode: d.mode, sets: d.sets, lo: d.lo, hi: d.hi, rest: d.rest });
    if (d.max) e.max = true; else delete e.max;
    delete e.each;
  }
  const z = zoneOfMuscle(y.m, a.zones);
  if (z) e.a = z; else delete e.a;
  return e;
}
