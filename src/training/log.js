// Séries enregistrées : dernière fois, charge conseillée, records.
// Une série : { w: charge en kg (null = poids du corps), r: répétitions | secondes | mètres }.

import { LOAD_STEP } from './exercises.js';
import { fmtSec } from './program.js';

export function parseNum(v) {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.').trim());
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
export function fmtKg(w) {
  if (w == null) return '';
  return (Math.round(w * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

// Une valeur comparable d'une série à l'autre, par « genre » (on ne compare pas une série
// lestée à une série au poids du corps). Charge + répétitions : 1RM estimé (Epley).
export function recordValue(mode, s) {
  if (!s) return null;
  if (mode === 'r') {
    if (s.w > 0 && s.r > 0) return { k: 'kg', v: s.w * (1 + Math.min(s.r, 30) / 30) };
    return s.r > 0 ? { k: 'reps', v: s.r } : null;
  }
  if (mode === 't') return s.r > 0 ? { k: 's', v: s.r + (s.w > 0 ? s.w / 1000 : 0) } : null;
  if (s.w > 0) return { k: 'kg', v: s.w + (s.r || 0) / 10000 };
  return s.r > 0 ? { k: 'm', v: s.r } : null;
}

// weeks : [{ k: 'fitweek:…', st }] (semaines lues), dans n'importe quel ordre.
// Renvoie la séance la plus récente où l'exercice `x` a au moins une série, hors (exceptKey, exceptId)
// et, si `before` est donné (semaine passée affichée), avant cette date.
export function lastEntry(x, weeks, { exceptKey = null, exceptId = null, before = null } = {}) {
  let best = null, bestK = '';
  for (const { k, st } of weeks) {
    const log = st && st.log;
    if (!log) continue;
    for (const id in log) {
      const e = log[id];
      if (!e || e.x !== x || !e.s || !e.s.length) continue;
      if (k === exceptKey && id === exceptId) continue;
      if (before && e.d && e.d >= before) continue;
      const key = (e.d || '') + '|' + k;
      if (!best || key > bestK) { best = { ...e, id, k }; bestK = key; }
    }
  }
  return best;
}

// Meilleure série passée de l'exercice (hors une séance donnée), par genre
export function bestValues(x, mode, weeks, { exceptKey = null, exceptId = null } = {}) {
  const out = {};
  for (const { k, st } of weeks) {
    const log = st && st.log;
    if (!log) continue;
    for (const id in log) {
      const e = log[id];
      if (!e || e.x !== x || (k === exceptKey && id === exceptId)) continue;
      for (const s of e.s || []) {
        const rv = recordValue(mode, s);
        if (rv && (!(rv.k in out) || rv.v > out[rv.k])) out[rv.k] = rv.v;
      }
    }
  }
  return out;
}

// Série record dans la séance en cours : la meilleure série, si elle bat l'historique (index, ou -1)
export function recordIndex(mode, sets, best) {
  let idx = -1, top = null;
  sets.forEach((s, i) => {
    const rv = recordValue(mode, s);
    if (!rv || !(rv.k in best) || rv.v <= best[rv.k] + 1e-9) return;
    if (!top || rv.v > top.v) { top = rv; idx = i; }
  });
  return idx;
}

// Valeurs proposées pour les séries d'aujourd'hui.
//  - première fois : charge à choisir, répétitions au bas de la fourchette ;
//  - toutes les séries au haut de la fourchette avec la même charge : charge + un cran, retour au bas ;
//  - sinon : comme la dernière fois.
export function suggest(e, last, x) {
  const n = Math.max(1, e.sets || 1);
  if (!last || !last.s || !last.s.length) {
    return { kind: 'first', sets: Array.from({ length: n }, () => ({ w: null, r: e.max ? null : e.lo })) };
  }
  const ls = last.s, pick = (i) => ls[Math.min(i, ls.length - 1)];
  const sets = Array.from({ length: n }, (_, i) => ({ w: pick(i).w, r: pick(i).r }));
  if (e.mode === 'r' && !e.max && e.hi != null) {
    const first = ls.slice(0, n);
    const allTop = ls.length >= n && first.every((s) => (s.r || 0) >= e.hi);
    const sameW = first.every((s) => s.w === first[0].w);
    const step = x ? (LOAD_STEP[x.e] ?? 2.5) : 2.5;
    if (allTop && sameW && first[0].w > 0 && step > 0) {
      const w = Math.round((first[0].w + step) * 100) / 100;
      return { kind: 'up', from: first[0].w, to: w, step, sets: sets.map(() => ({ w, r: e.lo })) };
    }
    if (allTop) return { kind: 'top', sets };
  }
  return { kind: 'same', sets };
}

// « 22,5 kg × 10 · 10 · 9 », « 24 × 8 · 22 × 10 », « 12 · 10 · 9 reps », « 45 s · 40 s », « 40 m · 40 m »
export function fmtSets(mode, sets) {
  if (!sets || !sets.length) return '';
  const ws = sets.map((s) => s.w);
  const sameW = ws.every((w) => w === ws[0]);
  const val = (s) => (mode === 't' ? fmtSec(Math.round(s.r || 0)) : mode === 'd' ? (s.r || 0) + ' m' : String(s.r ?? '?'));
  if (mode === 'r') {
    if (sameW && ws[0] > 0) return fmtKg(ws[0]) + ' kg × ' + sets.map(val).join(' · ');
    if (sameW) return sets.map(val).join(' · ') + ' reps';
    return sets.map((s) => (s.w > 0 ? fmtKg(s.w) + ' × ' : '') + val(s)).join(' · ');
  }
  const load = sameW && ws[0] > 0 ? fmtKg(ws[0]) + ' kg · ' : '';
  return load + sets.map((s) => (!sameW && s.w > 0 ? fmtKg(s.w) + ' kg ' : '') + val(s)).join(' · ');
}

export function fmtDateShort(d) {
  const p = String(d || '').split('-');
  if (p.length !== 3) return '';
  const dt = new Date(+p[0], +p[1] - 1, +p[2]);
  return dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
}
