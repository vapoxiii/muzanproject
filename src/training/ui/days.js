// Les 7 jours d'une séance ou d'un sport. Un jour pris par une autre activité est grisé : le toucher
// le lui retire (un jour ne porte qu'une activité, voir TR.setDay).
import * as TR from '../index.js';
import { esc } from './dom.js';

export function daysRow(P, owner, days) {
  const owners = {};
  for (const s of P.sessions) for (const d of s.days) owners[d] = s.id;
  for (const e of TR.sportsList(P)) for (const d of e.days) owners[d] = 'sp:' + e.id;
  return `<div class="pe-days" role="group" aria-label="Jours">${TR.DAY_SHORT.map((l, d) => {
    const on = days.includes(d), other = !on && owners[d] != null;
    return `<button type="button" class="pe-d${other ? ' busy' : ''}" data-owner="${esc(owner)}" data-day="${d}" aria-pressed="${on}" aria-label="${TR.DAY_NAMES[d]}${other ? ', déjà pris' : ''}">${l}</button>`;
  }).join('')}</div>`;
}

// Jour libre pour une nouvelle activité : de préférence en fin de semaine
export function freeDay(P, order = [6, 5, 4, 3, 2, 1, 0]) {
  const used = new Set([...P.sessions.flatMap((s) => s.days), ...TR.sportsList(P).flatMap((e) => e.days)]);
  const d = order.find((x) => !used.has(x));
  return d == null ? null : d;
}
