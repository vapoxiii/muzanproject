// Jeu de données réaliste au format de l'ancienne app (clés localStorage → texte),
// daté par rapport à FIXED_NOW (horloge figée pendant les tests).
import { readFileSync } from 'node:fs';

export const FIXED_NOW = new Date('2026-10-21T10:00:00+02:00');   // mercredi, semaine 43

const PHOTOS = JSON.parse(readFileSync(new URL('./photos.json', import.meta.url), 'utf8'));

function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3); const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); const week = 1 + Math.round(((t - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7); return { year: t.getUTCFullYear(), week }; }
function weekKey(off) { const base = new Date(FIXED_NOW); const day = (base.getDay() + 6) % 7; base.setDate(base.getDate() - day + off * 7); base.setHours(0, 0, 0, 0); const iw = isoWeek(base); return `fitweek:${iw.year}-W${String(iw.week).padStart(2, '0')}`; }
function dayStr(off) { const d = new Date(FIXED_NOW); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

const LEN = { hautA: 9, basA: 7, hautB: 9, basB: 6, brasX: 5 };
function week({ done = {}, swim = [false, false], prot = [], crea = [] }) {
  const training = {};
  for (const id in LEN) training[id] = Array.from({ length: LEN[id] }, (_, i) => i < (done[id] || 0));
  const nutrition = {};
  for (let d = 1; d <= 7; d++) nutrition[d] = { protein: prot[d - 1] || 0, crea: !!crea[d - 1], eau: d <= 2, legumes: d % 2 === 1, sportM: false, sportN: false };
  return { training, swim, nutrition };
}

export function buildData() {
  const foodlib = JSON.parse(readFileSync(new URL('./foodlib-seed.json', import.meta.url), 'utf8'));
  foodlib.push({ id: 'c1760000000001', n: 'Bowl poulet riz', k: 620, p: 45, u: '1 portion', fav: 1 });
  foodlib.push({ id: 'c1760000000002', n: 'Skyr myrtilles · 150 g', k: 120, p: 15, u: '150 g', fav: 1, bc: '3017620422003' });
  const data = {
    'profile': JSON.stringify({ firstName: 'Alex', birthYear: 1996, sex: 'male', height: 178, weight: 76.5, job: 'assis', sportDays: 4, goal: 'recompo', experience: 'intermediaire', sessions: 4, zones: ['bras'], parentOk: false, protein: 155, calBase: 2350, updatedAt: '2026-09-01T08:00:00.000Z' }),
    'onb:done': '1',
    'calbase': '2350',
    'ui:hero': 'illus',
    'coach': JSON.stringify({ id: 'ren', tone: 'bienveillant' }),
    'coach:event': JSON.stringify({ date: dayStr(0), text: 'Prêt pour Haut B ?' }),
    [weekKey(0)]: JSON.stringify(week({ done: { hautA: 9, basA: 4 }, swim: [true, false], prot: [6, 5, 7], crea: [1, 1, 0] })),
    [weekKey(-1)]: JSON.stringify(week({ done: { hautA: 9, basA: 7, hautB: 8, basB: 6 }, swim: [true, true], prot: [6, 6, 7, 6, 5, 6, 4], crea: [1, 1, 1, 1, 1, 0, 1] })),
    [weekKey(-2)]: JSON.stringify(week({ done: { hautA: 8, basA: 6, hautB: 9, basB: 5 }, swim: [true, false], prot: [6, 7, 6, 6, 6, 3, 2], crea: [1, 1, 1, 0, 1, 1, 1] })),
    [weekKey(-3)]: JSON.stringify(week({ done: { hautA: 5, basA: 2 }, prot: [4, 3], crea: [1] })),
    'bodylog': JSON.stringify([
      { d: dayStr(-49), w: 78.4, t: 86 }, { d: dayStr(-35), w: 77.9, t: null }, { d: dayStr(-28), w: 77.6, t: 85 },
      { d: dayStr(-14), w: 77.1, t: 84.5 }, { d: dayStr(-7), w: 76.8, t: null }, { d: dayStr(0), w: 76.5, t: 84 },
    ]),
    'foodlib': JSON.stringify(foodlib),
    'foodlog': JSON.stringify({
      [dayStr(0)]: [{ fid: 'f8', q: 1 }, { fid: 'f12', q: 1 }, { fid: 'c1760000000001', q: 1 }],
      [dayStr(-1)]: [{ fid: 'f4', q: 2 }, { fid: 'f6', q: 2 }, { fid: 'c1760000000002', q: 1 }],
      [dayStr(-2)]: [{ fid: 'f1', q: 1 }, { fid: 'f20', q: 1 }],
    }),
    'dayact': JSON.stringify({ [dayStr(0)]: { m: true }, [dayStr(-1)]: { n: true } }),
    'photos': JSON.stringify([{ d: dayStr(-35), img: PHOTOS[0] }, { d: dayStr(-5), img: PHOTOS[1] }]),
    'ai:key': 'sk-ant-test-cle-qui-ne-doit-jamais-sortir',
  };
  return data;
}

export { weekKey, dayStr };
