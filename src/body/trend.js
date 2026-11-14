// Tendance du poids et ajustement des calories. Fonctions pures, sans stockage ni affichage.
//
// Tendance : moyenne lissée des pesées. Chaque pesée rapproche la tendance du poids du jour,
// d'autant plus que la pesée précédente est ancienne (10 % par jour écoulé, méthode du
// « Hacker's Diet »). Le poids d'un jour varie de ±1 kg (eau, sel, repas) ; la tendance, non.
//
// Calories : chaque semaine, on compare la vitesse réelle (pente des pesées des 3 dernières
// semaines) à la vitesse visée par l'objectif, puis on propose une nouvelle base.
//  - avec au moins 14 jours de repas notés sur 21 : bilan énergétique. Dépense réelle =
//    moyenne mangée − variation de poids × 7 700 kcal/kg ; nouvelle base = dépense + écart visé,
//    moins le bonus moyen des jours d'entraînement ;
//  - sinon : correction de la moitié de l'écart de vitesse (prudent, sans compter les repas).
// La base ne bouge jamais de plus de 200 kcal d'un coup.

export const ALPHA = 0.1;
export const KCAL_PER_KG = 7700;
// vitesse visée, en part du poids par semaine
export const GOAL_RATE = { perte: -0.005, recompo: -0.0025, prise: 0.0025, forme: 0 };
export const GOAL_LABEL = { perte: 'perte de gras', recompo: 'recomposition', prise: 'prise de muscle', forme: 'forme' };
export const BONUS = { m: 250, n: 200, b: 100 };
const MIN_BASE = 1200, MAX_BASE = 4500, MAX_STEP = 200;

const DAY = 86400000;
const ok = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export function parseDay(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function dayStr(dt) { return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; }
export function shiftDay(s, n) { const d = parseDay(s); d.setDate(d.getDate() + n); return dayStr(d); }
export function daysBetween(a, b) { return Math.round((parseDay(b) - parseDay(a)) / DAY); }

function weighIns(bodylog) {
  return (Array.isArray(bodylog) ? bodylog : []).filter((e) => e && ok(e.d) && typeof e.w === 'number' && isFinite(e.w) && e.w > 0)
    .slice().sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
}

// [{ d, w, t }] : chaque pesée avec la tendance à cette date
export function trendSeries(bodylog) {
  const out = [];
  let t = null, last = null;
  for (const p of weighIns(bodylog)) {
    if (t == null) t = p.w;
    else t += (1 - Math.pow(1 - ALPHA, Math.max(1, daysBetween(last, p.d)))) * (p.w - t);
    last = p.d;
    out.push({ d: p.d, w: p.w, t: Math.round(t * 100) / 100 });
  }
  return out;
}

// Vitesse en kg par semaine sur les `span` derniers jours (pente des pesées), ou null si trop peu de pesées
export function weeklyRate(bodylog, today, { span = 21, min = 4, minDays = 10 } = {}) {
  const from = shiftDay(today, -span);
  const pts = weighIns(bodylog).filter((p) => p.d > from && p.d <= today);
  if (pts.length < min) return null;
  const xs = pts.map((p) => daysBetween(from, p.d)), ys = pts.map((p) => p.w);
  if (Math.max(...xs) - Math.min(...xs) < minDays) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) * (x - mx); });
  return den ? Math.round((num / den) * 7 * 1000) / 1000 : null;
}

const round50 = (x) => Math.round(x / 50) * 50;

// intake : { 'AAAA-MM-JJ': { k: kcal mangées, target: objectif du jour } }
// sportWeek : dépense des sports prévus dans la semaine (kcal), en plus de la natation comptée par swimDays
export function calorieCheck({ bodylog, intake = {}, today, goal = 'forme', calbase, mainSessions = 4, swimDays = 0, sportWeek = 0, weight = null }) {
  const series = trendSeries(bodylog);
  const trend = series.length ? series[series.length - 1].t : weight;
  const rate = weeklyRate(bodylog, today);
  if (rate == null) return { status: 'pesees', trend, rate: null };
  const g = GOAL_RATE[goal] != null ? goal : 'forme';
  const desired = Math.round(GOAL_RATE[g] * trend * 100) / 100;
  const eaten = [];
  for (let i = 1; i <= 21; i++) {
    const x = intake[shiftDay(today, -i)];
    if (x && x.k > 0 && x.k >= 0.5 * (x.target || 0)) eaten.push(x.k);
  }
  const bonus = (BONUS.m * mainSessions + BONUS.n * swimDays + (sportWeek > 0 ? sportWeek : 0)) / 7;
  let method, tdee = null, wanted;
  if (eaten.length >= 14) {
    method = 'bilan';
    const avg = eaten.reduce((a, b) => a + b, 0) / eaten.length;
    tdee = avg - (rate / 7) * KCAL_PER_KG;
    wanted = tdee + (desired / 7) * KCAL_PER_KG - bonus;
  } else {
    method = 'vitesse';
    const gap = rate - desired;
    wanted = Math.abs(gap) < 0.1 ? calbase : calbase - (gap / 7) * KCAL_PER_KG * 0.5;
  }
  wanted = Math.min(MAX_BASE, Math.max(MIN_BASE, wanted));
  let delta = Math.max(-MAX_STEP, Math.min(MAX_STEP, round50(wanted - calbase)));
  if (Math.abs(delta) < 50) delta = 0;
  return { status: 'ok', method, goal: g, trend, rate, desired, tdee: tdee == null ? null : Math.round(tdee / 10) * 10,
    days: eaten.length, from: calbase, to: calbase + delta, delta };
}

// L'ajustement de la semaine est-il à proposer ? (aucune décision depuis 7 jours)
export function checkDue(last, today) { return !last || !ok(last.d) || daysBetween(last.d, today) >= 7; }

export function fmtRate(r) {
  if (r == null) return '';
  const v = Math.abs(r) < 0.005 ? 0 : r;
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
}
