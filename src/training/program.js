// Programme d'entraînement : séances, exercices et réglages (séries, répétitions, repos),
// planning de la semaine. Fonctions pures, sans accès au stockage ni au DOM.
//
// Programme :
//   { v: 1, sessions: [Séance], sports: [Sport], custom: [exercices créés] }
//   (avant les sports : swim = [jours de natation], relu comme le sport « natation »)
// Séance :
//   { id, name, sub, opt (en option : ne compte pas dans les séances de la semaine), days: [0..6], ex: [Exercice] }
// Exercice (dans une séance) :
//   { id, x (exercice de la bibliothèque), n (nom affiché, si différent), sets, mode ('r' répétitions,
//     't' secondes, 'd' mètres), lo, hi (fourchette ; null = libre), max (jusqu'à l'échec),
//     each (en superset : « 2 × chaque »), rest (secondes), a (zone prioritaire) }
// Sport (en plus des séances, voir sports.js) :
//   { id, days: [0..6], min (durée, si elle diffère du catalogue), int (0 tranquille, 2 intense) }
//   sport créé : { id: 'u…', n (nom), c (catégorie), met (dépense), days, min, int }

import { EXERCISES, MUSCLES, ZONES, ZONE_LABEL, exoById, customExo, defaultsFor } from './exercises.js';
import { sportById, sportOf, sportLower, SPORT_CATS } from './sports.js';

export const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const DAY_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const LIMITS = {
  sets: [1, 10],
  r: [1, 50], t: [5, 3600], d: [5, 1000],
  rest: [0, 600],
};

// ---- Programme d'origine (celui de l'app avant le constructeur), à l'identique ----
const L = (x, n, sets, lo, hi, rest, more) => ({ x, n, sets, mode: 'r', lo, hi, rest, ...more });
const ORIGINE = [
  { id: 'hautA', name: 'Haut A', sub: 'Poussée + Bras', days: [0], ex: [
    L('dc-halteres', null, 3, 6, 10, 120), L('de-halteres', null, 3, 8, 12, 120),
    L('el-halteres', 'Élévations latérales', 3, 12, 20, 60), L('tv-poulie', null, 3, 8, 12, 120),
    L('curl-ez', 'Curl EZ / haltères', 4, 8, 12, 75, { a: 'bras' }), L('curl-marteau', null, 3, 10, 15, 75, { a: 'bras' }),
    L('pushdown-corde', 'Pushdown corde (triceps)', 3, 10, 15, 75, { a: 'bras' }), L('curl-inverse', null, 3, 12, 15, 60, { a: 'bras' }),
    L('wrist-curl', 'Wrist curl (flexion)', 3, 15, 20, 60, { a: 'bras' })] },
  { id: 'basA', name: 'Bas A', sub: 'Jambes', days: [1], ex: [
    L('squat', 'Squat ou presse', 3, 6, 10, 180), L('rdl', null, 3, 8, 12, 150),
    L('fentes-avant', 'Fentes ou presse', 3, 10, 12, 90), L('leg-curl-assis', 'Leg curl', 3, 10, 15, 75),
    L('mollets-debout', 'Mollets debout', 3, 12, 15, 60),
    { x: 'farmer', n: 'Farmer carry (marche lestée)', sets: 3, mode: 'd', lo: 30, hi: 40, rest: 90, a: 'bras' },
    { x: 'planche', n: 'Gainage / abdos', sets: 3, mode: 't', lo: null, hi: null, rest: 60 }] },
  { id: 'hautB', name: 'Haut B', sub: 'Tirage + Bras', days: [3], ex: [
    L('di-halteres', null, 3, 8, 12, 120), L('th-poulie', 'Rowing poulie', 3, 8, 12, 120),
    L('el-halteres', 'Élévations latérales', 3, 12, 20, 60), L('tractions-neg', null, 3, 3, 6, 120),
    L('curl-incline', null, 4, 8, 12, 75, { a: 'bras' }), L('ext-poulie-tete', 'Extension triceps poulie (au-dessus tête)', 3, 12, 15, 75, { a: 'bras' }),
    L('curl-marteau-corde', null, 3, 10, 15, 75, { a: 'bras' }), L('reverse-wrist', 'Reverse wrist curl (extension)', 3, 15, 20, 60, { a: 'bras' }),
    { x: 'dead-hang', sets: 3, mode: 't', lo: 20, hi: 45, max: true, rest: 90, a: 'bras' }] },
  { id: 'basB', name: 'Bas B', sub: 'Jambes', days: [4], ex: [
    L('presse', 'Presse ou hack squat', 3, 8, 12, 120), L('sldl', 'SLDL ou hip thrust', 3, 8, 12, 150),
    L('leg-ext', null, 3, 12, 15, 75), L('mollets-assis', 'Mollets assis', 3, 12, 15, 60),
    L('wrist-curl-halt', 'Wrist curl + reverse (superset)', 2, null, null, 60, { each: true, a: 'bras' }),
    L('crunch', 'Abdos', 3, null, null, 60)] },
  { id: 'brasX', name: 'Bras Express', sub: 'Maison — optionnel', opt: true, days: [], ex: [
    L('curl-halteres', 'Curls (haltère / sac lesté)', 3, 12, 15, 60, { a: 'bras' }),
    L('pompes-diamant', 'Pompes serrées (triceps)', 3, 8, 15, 60, { max: true, a: 'bras' }),
    L('curl-marteau', null, 3, 12, 15, 60, { a: 'bras' }),
    L('wrist-curl-halt', 'Wrist curl + reverse', 2, null, null, 45, { each: true, a: 'bras' }),
    { x: 'dead-hang', n: 'Dead hang', sets: 3, mode: 't', lo: 20, hi: 45, max: true, rest: 60, a: 'bras' }] },
];

function withIds(sessions) {
  return sessions.map((s) => ({
    id: s.id, name: s.name, sub: s.sub || '', opt: !!s.opt, days: (s.days || []).slice(),
    ex: s.ex.map((e, i) => clean({ id: s.id + '-' + (i + 1), ...e })),
  }));
}
function clean(e) {
  const o = {};
  for (const k in e) if (e[k] !== null && e[k] !== undefined && e[k] !== false) o[k] = e[k];
  if (!('lo' in o)) o.lo = null;
  if (!('hi' in o)) o.hi = null;
  return o;
}

export const DEFAULT_PROGRAM = Object.freeze({ v: 1, sessions: withIds(ORIGINE), sports: [{ id: 'natation', days: [2, 5] }], custom: [] });
export function defaultProgram() { return structuredClone(DEFAULT_PROGRAM); }

// ---- Identifiants ----
let idSeq = 0;
export function newId(prefix) {
  idSeq = (idSeq + 1) % 1296;
  return prefix + Date.now().toString(36) + idSeq.toString(36).padStart(2, '0') + Math.floor(Math.random() * 1296).toString(36).padStart(2, '0');
}

// ---- Exercices ----
export function exoOf(e, program) {
  if (!e) return null;
  const lib = exoById(e.x);
  if (lib) return lib;
  const c = program && (program.custom || []).find((c) => c.id === e.x);
  return c ? customExo(c) : null;
}
export function exName(e, program) {
  if (e.n) return e.n;
  const x = exoOf(e, program);
  return x ? x.n : 'Exercice';
}

// Nouvel exercice dans une séance, avec les réglages par défaut de la bibliothèque
export function makeExercise(x, { zones = [] } = {}) {
  const d = defaultsFor(x);
  const e = { id: newId('e'), x: x.id, sets: d.sets, mode: d.mode, lo: d.lo, hi: d.hi, rest: d.rest };
  if (d.max) e.max = true;
  const z = zones.find((k) => (ZONES[k] || []).includes(x.m));
  if (z) e.a = z;
  return e;
}

export function zoneOf(m) { for (const z in ZONES) if (ZONES[z].includes(m)) return z; return null; }
// Libellé de l'étiquette « zone prioritaire » d'un exercice (« Bras », « Jambes »…)
export function zoneLabel(e, program) {
  if (typeof e.a === 'string' && ZONE_LABEL[e.a]) return ZONE_LABEL[e.a];
  const x = exoOf(e, program), z = x && zoneOf(x.m);
  return z ? ZONE_LABEL[z] : (x && MUSCLES[x.m]) || 'Priorité';
}

// ---- Textes ----
export function fmtSec(s) {
  if (s < 60) return s + ' s';
  const m = Math.floor(s / 60), r = s % 60;
  return r ? m + ' min ' + String(r).padStart(2, '0') : m + ' min';
}
export function fmtRest(s) { return s ? fmtSec(s) : 'sans repos'; }
function fmtRange(mode, lo, hi) {
  if (hi == null || hi === lo) hi = lo;
  if (mode === 't') {
    if (lo < 60 && hi < 60) return lo === hi ? lo + ' s' : lo + '-' + hi + ' s';
    if (lo % 60 === 0 && hi % 60 === 0) return lo === hi ? lo / 60 + ' min' : lo / 60 + '-' + hi / 60 + ' min';
    return lo === hi ? fmtSec(lo) : fmtSec(lo) + ' à ' + fmtSec(hi);
  }
  const r = lo === hi ? String(lo) : lo + '-' + hi;
  return mode === 'd' ? r + ' m' : r;
}
// « 3 × 8-12 », « 3 × 30-60 s », « 3 × 30-40 m », « 3 × max », « 2 × chaque », « 3 séries »
export function describe(e) {
  const n = e.sets;
  if (e.each) return n + ' × chaque';
  if (e.max) return n + ' × max';
  if (e.lo == null) return n + ' séries';
  return n + ' × ' + fmtRange(e.mode, e.lo, e.hi);
}
export function targetText(e) {
  if (e.max) return 'max';
  if (e.lo == null) return '';
  return fmtRange(e.mode, e.lo, e.hi);
}

export function mainSessions(p) { return p.sessions.filter((s) => !s.opt); }
export function optSessions(p) { return p.sessions.filter((s) => s.opt); }

export function countText(p) {
  const n = mainSessions(p).length;
  return n + ' séance' + (n > 1 ? 's' : '') + ' par semaine';
}
function joinEt(a) { return a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1]; }
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// « Lundi Haut A, mardi Bas A, jeudi Haut B, vendredi Bas B. Natation le mercredi et le samedi, repos le dimanche. »
export function scheduleText(p) {
  const plan = planOf(p), parts = [];
  plan.forEach((d, i) => { if (d.t === 'm') parts.push(DAY_NAMES[i] + ' ' + sessionById(p, d.id).name); });
  const rest = plan.map((d, i) => (d.t === 'r' ? 'le ' + DAY_NAMES[i] : null)).filter(Boolean);
  const out = [];
  if (parts.length) out.push(cap(parts.join(', ')) + '.');
  const tail = [];
  for (const e of sportsList(p)) {
    const days = plan.map((d, i) => (d.t === 's' && d.sp === e.id ? 'le ' + DAY_NAMES[i] : null)).filter(Boolean);
    if (days.length) tail.push(sportLower(sportOf(e)) + ' ' + joinEt(days));
  }
  if (rest.length) tail.push(rest.length === 7 ? 'aucune séance placée dans la semaine' : 'repos ' + joinEt(rest));
  if (tail.length) out.push(cap(tail.join(', ')) + '.');
  return out.join(' ');
}
// « Haut A, Bas A, Haut B, Bas B, Bras Express en option »
export function summaryText(p) {
  const m = mainSessions(p).map((s) => s.name), o = optSessions(p).map((s) => s.name);
  return [...m, ...(o.length ? [o.join(', ') + ' en option'] : [])].join(', ');
}

export function sessionById(p, id) { return p.sessions.find((s) => s.id === id) || null; }

// Sports d'un programme ou de l'instantané d'une semaine ; ancien format : swim = jours de natation
export function sportsList(p) {
  if (p && Array.isArray(p.sports)) return p.sports;
  return p && Array.isArray(p.swim) && p.swim.length ? [{ id: 'natation', days: p.swim.slice() }] : [];
}
export function sportEntry(p, id) { return sportsList(p).find((e) => e.id === id) || null; }
// « natation 2 fois, football 1 fois » (sports placés dans la semaine)
export function sportsText(p) {
  return sportsList(p).filter((e) => !e.gone && e.days.length).map((e) => sportLower(sportOf(e)) + ' ' + e.days.length + ' fois').join(', ');
}

// Planning : pour chaque jour (lundi = 0), { t: 'm', id } séance, { t: 's', sp, i } sport (i : sa
// i-ème séance de la semaine), { t: 'r' } repos
export function planOf(p) {
  const plan = Array.from({ length: 7 }, () => ({ t: 'r' }));
  for (const s of p.sessions) for (const d of s.days || []) if (plan[d] && plan[d].t === 'r') plan[d] = { t: 'm', id: s.id };
  for (const e of sportsList(p)) {
    if (e.gone) continue;
    (e.days || []).slice().sort((a, b) => a - b).forEach((d, i) => { if (plan[d] && plan[d].t === 'r') plan[d] = { t: 's', sp: e.id, i }; });
  }
  return plan;
}

// ---- Vérification d'un programme (lu dans le stockage ou venu d'un autre appareil) ----
const isInt = (v) => Number.isInteger(v);
const clampInt = (v, [a, b], d) => (isInt(v) ? Math.min(b, Math.max(a, v)) : d);
const str = (v, max, d = '') => (typeof v === 'string' ? v.trim().slice(0, max) : d);

export function normalizeProgram(p) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.sessions)) return defaultProgram();
  const usedS = new Set(), usedE = new Set(), usedDays = new Set();
  const custom = (Array.isArray(p.custom) ? p.custom : [])
    .filter((c) => c && typeof c.id === 'string' && typeof c.n === 'string' && c.n.trim())
    .map((c) => ({ id: c.id, n: str(c.n, 60, 'Exercice'), m: MUSCLES[c.m] ? c.m : 'complet', e: typeof c.e === 'string' ? c.e : 'autre', t: c.t === 'c' ? 'c' : 'i', mode: ['r', 't', 'd'].includes(c.mode) ? c.mode : 'r' }));
  const known = (x) => !!exoById(x) || custom.some((c) => c.id === x);
  const sessions = [];
  for (const s of p.sessions.slice(0, 14)) {
    if (!s || typeof s !== 'object') continue;
    let id = typeof s.id === 'string' && s.id ? s.id.slice(0, 40) : newId('s');
    while (usedS.has(id)) id = newId('s');
    usedS.add(id);
    const days = [];
    for (const d of Array.isArray(s.days) ? s.days : []) if (isInt(d) && d >= 0 && d <= 6 && !usedDays.has(d)) { usedDays.add(d); days.push(d); }
    days.sort((a, b) => a - b);
    const ex = [];
    for (const e of Array.isArray(s.ex) ? s.ex.slice(0, 40) : []) {
      if (!e || typeof e !== 'object' || typeof e.x !== 'string' || !known(e.x)) continue;
      let eid = typeof e.id === 'string' && e.id ? e.id.slice(0, 40) : newId('e');
      while (usedE.has(eid)) eid = newId('e');
      usedE.add(eid);
      const mode = ['r', 't', 'd'].includes(e.mode) ? e.mode : 'r';
      const lim = LIMITS[mode];
      let lo = e.lo == null ? null : clampInt(e.lo, lim, null), hi = e.hi == null ? lo : clampInt(e.hi, lim, lo);
      if (lo == null) hi = null;
      if (lo != null && hi < lo) [lo, hi] = [hi, lo];
      const o = { id: eid, x: e.x };
      const n = str(e.n, 80);
      if (n) o.n = n;
      Object.assign(o, { sets: clampInt(e.sets, LIMITS.sets, 3), mode, lo, hi, rest: clampInt(e.rest, LIMITS.rest, 90) });
      if (e.max) o.max = true;
      if (e.each) o.each = true;
      if (e.a) { const x = exoById(e.x); o.a = typeof e.a === 'string' && ZONE_LABEL[e.a] ? e.a : (x && zoneOf(x.m)) || 'bras'; }
      ex.push(o);
    }
    sessions.push({ id, name: str(s.name, 40, 'Séance') || 'Séance', sub: str(s.sub, 60), opt: !!s.opt, days, ex });
  }
  const sports = [], usedSp = new Set();
  for (const e of sportsList(p).slice(0, 30)) {
    if (!e || usedSp.has(e.id)) continue;
    const o = normSport(e, usedDays);
    if (o) { usedSp.add(o.id); sports.push(o); }
  }
  return { v: 1, sessions, sports, custom };
}
// Un sport du programme : du catalogue, ou créé (identifiant « u… » et un nom)
function normSport(e, usedDays) {
  if (!e || typeof e !== 'object' || typeof e.id !== 'string') return null;
  const base = sportById(e.id);
  const custom = !base && /^u[\w-]{1,40}$/.test(e.id) && typeof e.n === 'string' && e.n.trim();
  if (!base && !custom) return null;
  const days = [];
  for (const d of Array.isArray(e.days) ? e.days : []) if (isInt(d) && d >= 0 && d <= 6 && !usedDays.has(d)) { usedDays.add(d); days.push(d); }
  days.sort((a, b) => a - b);
  const o = { id: e.id, days };
  if (custom) {
    o.n = str(e.n, 40, 'Sport');
    o.c = SPORT_CATS[e.c] ? e.c : 'autre';
    o.met = Number.isFinite(e.met) ? Math.min(15, Math.max(1.5, Math.round(e.met * 10) / 10)) : 5.5;
  }
  const def = base ? base.min : 60;
  if (isInt(e.min) && e.min !== def) o.min = Math.min(600, Math.max(5, e.min));
  if (e.int === 0 || e.int === 2) o.int = e.int;
  return o;
}

export function parseProgram(raw) {
  if (!raw) return defaultProgram();
  try { return normalizeProgram(JSON.parse(raw)); } catch (e) { return defaultProgram(); }
}

// Un jour ne porte qu'une activité : le donner à une séance (ou à un sport) le retire aux autres.
// owner : identifiant de la séance, ou « sp:idDuSport » (« swim » : la natation, comme avant).
export function setDay(p, owner, day, on) {
  const sp = owner === 'swim' ? 'natation' : typeof owner === 'string' && owner.startsWith('sp:') ? owner.slice(3) : null;
  if (!Array.isArray(p.sports)) p.sports = sportsList(p).map((e) => ({ ...e, days: e.days.slice() }));
  delete p.swim;
  for (const s of p.sessions) s.days = s.days.filter((d) => d !== day || (on && !sp && s.id === owner));
  for (const e of p.sports) e.days = e.days.filter((d) => d !== day || (on && e.id === sp));
  if (on) {
    if (sp) {
      let e = p.sports.find((x) => x.id === sp);
      if (!e && sportById(sp)) { e = { id: sp, days: [] }; p.sports.push(e); }
      if (e && !e.days.includes(day)) { e.days.push(day); e.days.sort((a, b) => a - b); }
    } else { const s = sessionById(p, owner); if (s && !s.days.includes(day)) { s.days.push(day); s.days.sort((a, b) => a - b); } }
  }
  return p;
}

// ---- Modèles de programmes ----
const T = (x, sets, lo, hi, rest) => ({ x, sets, lo, hi, rest });
const SES = {
  fbA: ['Full body A', 'Tout le corps', [T('squat', 3, 5, 8, 180), T('dc-barre', 3, 5, 8, 180), T('row-barre', 3, 6, 10, 150), T('de-halteres', 3, 8, 12, 120), T('curl-halteres', 2, 10, 15, 75), T('planche', 3, 30, 60, 60)]],
  fbB: ['Full body B', 'Tout le corps', [T('rdl', 3, 8, 10, 150), T('di-halteres', 3, 8, 12, 120), T('tv-poulie', 3, 8, 12, 120), T('fentes-marchees', 3, 10, 12, 90), T('el-halteres', 3, 12, 20, 60), T('pushdown-corde', 2, 10, 15, 60)]],
  fbC: ['Full body C', 'Tout le corps', [T('presse', 3, 10, 12, 120), T('dips-triceps', 3, 6, 10, 120), T('row-1bras', 3, 8, 12, 90), T('leg-curl-assis', 3, 10, 15, 75), T('face-pull', 3, 12, 15, 60), T('crunch-poulie', 3, 12, 20, 60)]],
  haut1: ['Haut 1', 'Pectoraux, dos, épaules, bras', [T('dc-barre', 3, 5, 8, 180), T('row-barre', 3, 6, 10, 150), T('de-halteres', 3, 8, 12, 120), T('tv-poulie', 3, 8, 12, 120), T('curl-ez', 3, 8, 12, 75), T('barre-front', 3, 8, 12, 75)]],
  bas1: ['Bas 1', 'Jambes et abdos', [T('squat', 3, 5, 8, 180), T('rdl', 3, 8, 10, 150), T('leg-ext', 3, 10, 15, 75), T('leg-curl-assis', 3, 10, 15, 75), T('mollets-debout', 4, 10, 15, 60), T('planche', 3, 30, 60, 60)]],
  haut2: ['Haut 2', 'Pectoraux, dos, épaules, bras', [T('di-halteres', 3, 8, 12, 120), T('tractions', 3, 6, 10, 120), T('el-halteres', 3, 12, 20, 60), T('th-poulie', 3, 10, 12, 90), T('curl-marteau', 3, 10, 15, 75), T('pushdown-corde', 3, 10, 15, 75)]],
  bas2: ['Bas 2', 'Jambes et abdos', [T('presse', 3, 10, 12, 120), T('hip-thrust', 3, 8, 12, 120), T('bulgare', 3, 8, 12, 90), T('leg-curl-allonge', 3, 10, 15, 75), T('mollets-assis', 4, 12, 15, 60), T('rjs', 3, 10, 15, 60)]],
  pushA: ['Push A', 'Pectoraux, épaules, triceps', [T('dc-barre', 3, 5, 8, 180), T('di-halteres', 3, 8, 12, 120), T('de-halteres', 3, 8, 12, 120), T('el-halteres', 3, 12, 20, 60), T('pushdown-corde', 3, 10, 15, 75), T('ext-poulie-tete', 3, 10, 15, 75)]],
  pullA: ['Pull A', 'Dos, arrière d’épaule, biceps', [T('tractions', 3, 6, 10, 150), T('row-barre', 3, 6, 10, 150), T('th-poulie', 3, 10, 12, 90), T('face-pull', 3, 12, 15, 60), T('curl-ez', 3, 8, 12, 75), T('curl-marteau', 3, 10, 15, 75)]],
  legsA: ['Legs A', 'Jambes', [T('squat', 3, 5, 8, 180), T('rdl', 3, 8, 10, 150), T('presse', 3, 10, 12, 120), T('leg-curl-assis', 3, 10, 15, 75), T('mollets-debout', 4, 10, 15, 60), T('planche', 3, 30, 60, 60)]],
  pushB: ['Push B', 'Pectoraux, épaules, triceps', [T('dm-barre', 3, 5, 8, 180), T('dc-halteres', 3, 8, 12, 120), T('ec-poulie', 3, 12, 15, 60), T('el-poulie', 3, 12, 20, 60), T('dips-triceps', 3, 6, 10, 120), T('barre-front', 3, 8, 12, 75)]],
  pullB: ['Pull B', 'Dos, arrière d’épaule, biceps', [T('tv-poulie', 3, 8, 12, 120), T('row-1bras', 3, 8, 12, 90), T('row-machine', 3, 10, 12, 90), T('reverse-pec', 3, 12, 20, 60), T('curl-incline', 3, 8, 12, 75), T('curl-pupitre', 3, 10, 15, 75)]],
  legsB: ['Legs B', 'Jambes', [T('hack-squat', 3, 8, 12, 150), T('hip-thrust', 3, 8, 12, 120), T('bulgare', 3, 8, 12, 90), T('leg-ext', 3, 12, 15, 75), T('leg-curl-allonge', 3, 10, 15, 75), T('mollets-assis', 4, 12, 15, 60)]],
};

export const TEMPLATES = [
  { key: 'origine', name: 'Programme de départ', sub: 'Haut A, Bas A, Haut B, Bas B, Bras Express en option', n: 4 },
  { key: 'fb2', name: 'Full body', sub: '2 séances par semaine', n: 2, s: [['fbA', 0], ['fbB', 3]] },
  { key: 'fb3', name: 'Full body', sub: '3 séances par semaine', n: 3, s: [['fbA', 0], ['fbB', 2], ['fbC', 4]] },
  { key: 'hb4', name: 'Haut / Bas', sub: '4 séances par semaine', n: 4, s: [['haut1', 0], ['bas1', 1], ['haut2', 3], ['bas2', 4]] },
  { key: 'pplhb5', name: 'Push / Pull / Legs + Haut / Bas', sub: '5 séances par semaine', n: 5, s: [['pushA', 0], ['pullA', 1], ['legsA', 2], ['haut2', 4], ['bas2', 5]] },
  { key: 'ppl6', name: 'Push / Pull / Legs', sub: '6 séances par semaine', n: 6, s: [['pushA', 0], ['pullA', 1], ['legsA', 2], ['pushB', 3], ['pullB', 4], ['legsB', 5]] },
];

// Modèle conseillé selon le nombre de séances par semaine (même règle que l'onboarding)
export function recommendedTemplate(n) {
  const k = n <= 2 ? 'fb2' : n === 3 ? 'fb3' : n === 4 ? 'hb4' : n === 5 ? 'pplhb5' : 'ppl6';
  return TEMPLATES.find((t) => t.key === k);
}

// Construit le programme d'un modèle. Les sports du programme actuel sont gardés, sur leurs jours restés libres.
export function templateProgram(key, { current = null, zones = [] } = {}) {
  const t = TEMPLATES.find((x) => x.key === key);
  let p;
  if (!t || key === 'origine') p = defaultProgram();
  else {
    p = { v: 1, sessions: [], sports: [], custom: [] };
    for (const [k, day] of t.s) {
      const [name, sub, list] = SES[k];
      const id = key + '-' + k;
      p.sessions.push({ id, name, sub, opt: false, days: [day], ex: list.map((e, i) => {
        const x = exoById(e.x), base = makeExercise(x, { zones });
        return { ...base, id: id + '-' + (i + 1), sets: e.sets, lo: e.lo, hi: e.hi, rest: e.rest };
      }) });
    }
  }
  if (current) {
    const used = new Set(p.sessions.flatMap((s) => s.days));
    p.sports = sportsList(current).map((e) => ({ ...e, days: e.days.filter((d) => !used.has(d)) }));
    p.custom = (current.custom || []).slice();
  }
  return normalizeProgram(p);
}

// ---- Instantané du programme pour une semaine (l'historique ne dépend pas des changements futurs) ----
export function snapshotOf(p) {
  return {
    s: p.sessions.map((s) => ({
      id: s.id, name: s.name, sub: s.sub, opt: !!s.opt, days: s.days.slice(),
      ex: s.ex.map((e) => ({ ...e, n: exName(e, p) })),
    })),
    sports: sportsList(p).map((e) => ({ ...e, days: e.days.slice() })),
  };
}

export const EXERCISE_COUNT = EXERCISES.length;
