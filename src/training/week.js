// Semaine d'entraînement enregistrée (clé fitweek:AAAA-Snn).
//
// Forme stockée (compatible avec l'ancienne app, qui ignore les champs qu'elle ne connaît pas) :
//   { training: { idSéance: [coché?] }, swim: [natation faite?], nutrition: {1..7: {...}},
//     sport: { idSport: [fait?] } (les autres sports, absent s'il n'y en a pas),
//     prog: instantané du programme de la semaine (absent = programme d'origine),
//     log: { idExercice: { x, d: 'AAAA-MM-JJ', s: [{ w: kg, r: répétitions | secondes | mètres }] } } }
// En mémoire, toutes les coches de sport sont dans `sport`, natation comprise.
//
// L'instantané rend chaque semaine indépendante des changements de programme : l'XP, le score
// et la série des semaines passées ne bougent pas quand on modifie son programme.

import { deepEqual } from '../core/merge.js';
import { DEFAULT_PROGRAM, snapshotOf, sportsList } from './program.js';

export const DEFAULT_SNAPSHOT = Object.freeze(snapshotOf(DEFAULT_PROGRAM));

function validSnap(p) {
  return !!p && typeof p === 'object' && Array.isArray(p.s) && (Array.isArray(p.sports) || Array.isArray(p.swim))
    && p.s.every((s) => s && typeof s.id === 'string' && Array.isArray(s.ex) && s.ex.every((e) => e && typeof e.id === 'string'));
}
// Instantané d'avant les sports ({ s, swim }) : la natation devient un sport
function fixSnap(p) {
  if (Array.isArray(p.sports) && p.sports.every((e) => e && typeof e.id === 'string' && Array.isArray(e.days))) return p;
  return { s: p.s, sports: sportsList(p).filter((e) => e && typeof e.id === 'string' && Array.isArray(e.days)) };
}
export function snapSports(snap) { return (snap && sportsList(snap)) || []; }

export function blankNutrition() {
  const n = {};
  for (let d = 1; d <= 7; d++) n[d] = { protein: 0, crea: false, eau: false, legumes: false, sportM: false, sportN: false };
  return n;
}

export function blankWeek(snap = DEFAULT_SNAPSHOT) {
  const t = {}, sport = {};
  snap.s.forEach((s) => { t[s.id] = new Array(s.ex.length).fill(false); });
  snapSports(snap).forEach((e) => { sport[e.id] = new Array(e.days.length).fill(false); });
  return { training: t, sport, nutrition: blankNutrition(), prog: snap, log: {} };
}

const num = (v) => { const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v; return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };

// Lit une semaine stockée. `target` (instantané du programme actuel) : pour la semaine en cours,
// les coches sont reportées exercice par exercice sur le programme actuel ; une séance retirée
// du programme mais déjà commencée reste dans la semaine (marquée `gone`).
export function migrateWeek(s, target = null) {
  const src = s && validSnap(s.prog) ? fixSnap(s.prog) : DEFAULT_SNAPSHOT;
  const tr = s && s.training && typeof s.training === 'object' ? s.training : {};
  const srcDone = {};
  for (const ses of src.s) {
    const arr = tr[ses.id];
    srcDone[ses.id] = ses.ex.map((_, i) => !!(Array.isArray(arr) && arr[i]));
  }
  let snap = src, training = srcDone;
  if (target && target !== src && !deepEqual(target, src)) {
    training = {};
    const sessions = target.s.slice();
    for (const ses of target.s) {
      const old = src.s.find((x) => x.id === ses.id);
      training[ses.id] = ses.ex.map((e) => {
        if (!old) return false;
        const i = old.ex.findIndex((o) => o.id === e.id);
        return i >= 0 ? srcDone[ses.id][i] : false;
      });
    }
    for (const ses of src.s) {
      if (target.s.some((x) => x.id === ses.id) || !srcDone[ses.id].some(Boolean)) continue;
      sessions.push(ses.gone ? ses : { ...ses, gone: true });
      training[ses.id] = srcDone[ses.id];
    }
    snap = sessions.length === target.s.length ? target : { s: sessions, sports: target.sports };
  }
  // coches des sports : la natation dans « swim » (format d'origine), les autres dans « sport ».
  // Un sport fait cette semaine puis retiré du programme reste compté (marqué `gone`), et une
  // séance faite n'est pas perdue si on en prévoit moins.
  const flags = {};
  if (s && s.sport && typeof s.sport === 'object' && !Array.isArray(s.sport)) {
    for (const k in s.sport) if (/^[a-z0-9][\w-]{0,47}$/i.test(k) && Array.isArray(s.sport[k])) flags[k] = s.sport[k].map(Boolean);
  }
  if (s && Array.isArray(s.swim)) flags.natation = s.swim.map(Boolean);
  let sports = snapSports(snap);
  const extra = [];
  for (const k in flags) {
    if (!flags[k].some(Boolean) || sports.some((e) => e.id === k)) continue;
    const old = snapSports(src).find((e) => e.id === k);
    extra.push({ ...(old || { id: k }), days: [], gone: true });
  }
  if (extra.length) { sports = sports.concat(extra); snap = { s: snap.s, sports }; }
  const sport = {};
  for (const e of sports) {
    const f = flags[e.id] || [];
    let len = e.days.length;
    f.forEach((v, i) => { if (v && i >= len) len = i + 1; });
    sport[e.id] = Array.from({ length: len }, (_, i) => !!f[i]);
  }
  const nutrition = {};
  for (let d = 1; d <= 7; d++) {
    const o = ((s && s.nutrition) || {})[d] || {};
    nutrition[d] = { protein: Math.max(0, Math.min(7, o.protein | 0)), crea: !!o.crea, eau: !!o.eau, legumes: !!o.legumes };
  }
  const log = {};
  if (s && s.log && typeof s.log === 'object') {
    for (const k in s.log) {
      const e = s.log[k];
      if (!e || !Array.isArray(e.s)) continue;
      log[k] = { x: typeof e.x === 'string' ? e.x : '', d: typeof e.d === 'string' ? e.d : '',
        s: e.s.filter((v) => v && typeof v === 'object').map((v) => ({ w: num(v.w), r: num(v.r) })) };
      if (e.auto) log[k].auto = true;
    }
  }
  return { training, sport, nutrition, prog: snap, log };
}

// Ce qui est enregistré : l'instantané n'est écrit que s'il diffère du programme d'origine,
// le journal des séries que s'il contient quelque chose (une semaine « comme avant » reste identique).
export function toStored(st) {
  const sp = st.sport || {};
  const o = { training: st.training, swim: sp.natation || [], nutrition: st.nutrition };
  const others = {};
  for (const k in sp) if (k !== 'natation') others[k] = sp[k];
  if (Object.keys(others).length) o.sport = others;
  if (st.prog && st.prog !== DEFAULT_SNAPSHOT && !deepEqual(st.prog, DEFAULT_SNAPSHOT)) o.prog = st.prog;
  if (st.log && Object.keys(st.log).length) o.log = st.log;
  return o;
}

// ---- Séances validées, score, XP ----
export const threshold = (len) => Math.ceil(len * 0.8);
export function doneCount(st, id) { const a = st.training[id]; return Array.isArray(a) ? a.filter(Boolean).length : 0; }
export function isValidated(st, ses) { return ses.ex.length > 0 && doneCount(st, ses.id) >= threshold(ses.ex.length); }
export function weekSessions(st) { return st.prog.s; }
export function mainCount(st) { return st.prog.s.filter((s) => !s.opt && !s.gone).length; }
export function sessionsDone(st) { return st.prog.s.filter((s) => !s.opt && isValidated(st, s)).length; }
export function validatedIds(st) { return new Set(st.prog.s.filter((s) => isValidated(st, s)).map((s) => s.id)); }

export function weekScore(st) {
  const mc = mainCount(st), sd = Math.min(sessionsDone(st), mc);
  let protDays = 0, creaDays = 0;
  for (let d = 1; d <= 7; d++) { const n = st.nutrition[d] || {}; if ((n.protein || 0) >= 6) protDays++; if (n.crea) creaDays++; }
  return Math.round(((mc ? sd / mc : 0) * 0.45 + protDays / 7 * 0.40 + creaDays / 7 * 0.15) * 100);
}

export function weekXP(st, XP) {
  let xp = 0;
  for (const s of st.prog.s) {
    xp += doneCount(st, s.id) * XP.ex;
    if (isValidated(st, s)) xp += s.opt ? XP.bras : XP.ses;
  }
  // natation et autres sports : la même XP par séance faite
  const per = XP.sport ?? XP.swim;
  for (const k in st.sport) st.sport[k].forEach((v) => { if (v) xp += per; });
  for (let d = 1; d <= 7; d++) {
    const n = st.nutrition[d];
    if (n.protein >= 6) xp += XP.prot;
    ['crea', 'eau', 'legumes'].forEach((h) => { if (n[h]) xp += XP.habit; });
  }
  if (weekScore(st) >= 60) xp += XP.week;
  return xp;
}
