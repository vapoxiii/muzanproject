// Données d'exemple de l'aperçu de test (« Alex »), datées par rapport à aujourd'hui.
// Huit semaines de séances, de pesées et de repas, et les séries notées des trois dernières
// semaines : de quoi essayer le programme, la saisie des séries et les calories adaptatives.
import { defaultProgram, planOf, snapshotOf } from '../training/program.js';
import { sportOf, sportKcal } from '../training/sports.js';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return { year: t.getUTCFullYear(), week: 1 + Math.round(((t - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7) };
}
// hasard reproductible (mêmes données à chaque réinitialisation)
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Charges de départ (kg) ; null = poids du corps. Pour la durée et la distance : r de départ.
const START = {
  'dc-halteres': [22, 2], 'de-halteres': [16, 2], 'el-halteres': [8, 1], 'tv-poulie': [55, 2.5], 'curl-ez': [25, 2.5],
  'curl-marteau': [12, 2], 'pushdown-corde': [22.5, 2.5], 'curl-inverse': [20, 2.5], 'wrist-curl': [25, 2.5],
  squat: [80, 2.5], rdl: [70, 2.5], 'fentes-avant': [14, 2], 'leg-curl-assis': [40, 2.5], 'mollets-debout': [60, 5],
  farmer: [24, 2], planche: [null, 0], 'di-halteres': [20, 2], 'th-poulie': [50, 2.5], 'tractions-neg': [null, 0],
  'curl-incline': [10, 2], 'ext-poulie-tete': [20, 2.5], 'curl-marteau-corde': [20, 2.5], 'reverse-wrist': [15, 2.5],
  'dead-hang': [null, 0], presse: [140, 5], sldl: [60, 2.5], 'leg-ext': [45, 2.5], 'mollets-assis': [40, 2.5],
  'wrist-curl-halt': [12, 2], crunch: [null, 0], 'curl-halteres': [12, 2], 'pompes-diamant': [null, 0],
};

export function demoData(now = new Date()) {
  const r = rng(20261027);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (off) => { const d = new Date(today); d.setDate(d.getDate() + off); return d; };
  const ti = (today.getDay() + 6) % 7;                       // lundi = 0
  // le programme d'origine, plus du football le dimanche
  const P = defaultProgram();
  P.sports.push({ id: 'football', days: [6] });
  const plan = planOf(P), snap = snapshotOf(P);
  const data = {};
  data.program = JSON.stringify(P);

  data.profile = JSON.stringify({ firstName: 'Alex', birthYear: 1996, sex: 'male', height: 178, weight: 78.6, job: 'assis', sportDays: 4,
    goal: 'recompo', experience: 'intermediaire', sessions: 4, zones: ['bras'], parentOk: false, protein: 155, calBase: 2350, updatedAt: day(-56).toISOString() });
  data['onb:done'] = '1';
  data.calbase = '2350';
  data['ui:hero'] = 'illus';
  data.coach = JSON.stringify({ id: 'ren', tone: 'bienveillant' });

  // ---- semaines : coches, natation et football, protéines, créatine, séries ----
  for (let w = -7; w <= 0; w++) {
    const monday = day(-ti + w * 7), iw = isoWeek(monday);
    const key = `fitweek:${iw.year}-W${pad(iw.week)}`;
    const training = {}, log = {}, nutrition = {};
    const lastDay = w < 0 ? 6 : ti - 1;                    // semaine en cours : jusqu'à hier
    for (const s of P.sessions) training[s.id] = s.ex.map(() => false);
    const swim = [false, false], sport = { football: [false] };
    plan.forEach((p, d) => {
      if (d > lastDay) return;
      if (p.t === 's') { if (p.sp === 'natation') swim[p.i] = r() < 0.7; else sport[p.sp][p.i] = r() < 0.75; return; }
      if (p.t !== 'm') return;
      const s = P.sessions.find((x) => x.id === p.id), skip = w < -1 && r() < 0.1;
      s.ex.forEach((e, i) => {
        if (skip || r() < 0.06) return;
        training[s.id][i] = true;
        if (w < -2) return;                                  // séries notées sur les 3 dernières semaines
        const [w0, inc] = START[e.x] || [null, 0], step = w + 2;   // 0, 1, 2 : un cran par semaine sur certains exercices
        const load = w0 == null ? null : Math.round((w0 + (i % 2 === 0 ? step * inc : 0)) * 100) / 100;
        const n = (e.sets || 3) * (e.each ? 2 : 1), sets = [];
        for (let k = 0; k < n; k++) {
          let rep;
          if (e.mode === 't') rep = (e.lo ?? 30) + 5 * (2 - k) + 5 * step;
          else if (e.mode === 'd') rep = 40;
          else if (e.lo == null || e.max) rep = 15 - k * 2 + step;
          else rep = i === 0 && w === -1 ? e.hi : Math.max(e.lo, e.hi - k - (step === 2 ? 0 : 1));
          sets.push({ w: load, r: rep });
        }
        log[e.id] = { x: e.x, d: ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + d)), s: sets };
      });
    });
    for (let d = 1; d <= 7; d++) {
      const past = d - 1 <= (w < 0 ? 6 : ti);
      nutrition[d] = past ? { protein: 4 + Math.floor(r() * 4), crea: r() < 0.85, eau: r() < 0.7, legumes: r() < 0.6, sportM: false, sportN: false }
        : { protein: 0, crea: false, eau: false, legumes: false, sportM: false, sportN: false };
    }
    const st = { training, swim, nutrition, sport, prog: snap };
    if (Object.keys(log).length) st.log = log;
    data[key] = JSON.stringify(st);
  }

  // ---- pesées : 4 à 5 par semaine sur 8 semaines, tendance −0,15 kg/sem, tour de taille toutes les 2 semaines ----
  const body = [];
  for (let off = -56; off <= 0; off++) {
    if (off < 0 && r() < 0.35) continue;
    const trend = 77.4 - (off / 7) * 0.15;
    const w = Math.round((trend + (r() - 0.5) * 0.6) * 10) / 10;
    const e = { d: ymd(day(off)), w, t: null };
    if (off % 14 === 0) e.t = Math.round((85.5 + (off / 56) * -1.5) * 10) / 10;
    body.push(e);
  }
  data.bodylog = JSON.stringify(body);

  // ---- repas : 3 semaines, ~2 500 kcal par jour (à peu près l'objectif), quelques jours sans rien noter ----
  const MEALS = [
    [['f8', 2], ['f16', 1], ['f9', 1], ['f12', 1]],
    [['f4', 2], ['f6', 2.5], ['f13', 1], ['f22', 1]],
    [['f15', 1], ['f14', 1]],
    [['f20', 1.5], ['f23', 2], ['f11', 2]],
  ];
  const food = {}, act = {};
  for (let off = -21; off <= 0; off++) {
    const d = ymd(day(off)), wd = (day(off).getDay() + 6) % 7, p = plan[wd];
    if (p.t === 'm') act[d] = { m: true };
    else if (p.t === 's') act[d] = p.sp === 'natation' ? { n: true } : { sp: { [p.sp]: sportKcal(sportOf({ id: p.sp }), 77.5) } };
    if (off < 0 && r() < 0.15) continue;
    const meals = off === 0 ? MEALS.slice(0, 2) : MEALS;
    food[d] = meals.flat().map(([fid, q]) => ({ fid, q: Math.round(q * (0.9 + r() * 0.2) * 4) / 4 }));
  }
  data.foodlog = JSON.stringify(food);
  data.dayact = JSON.stringify(act);
  return data;
}
