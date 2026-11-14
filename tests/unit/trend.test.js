import { describe, it, expect } from 'vitest';
import * as TB from '../../src/body/trend.js';
import { demoData } from '../../src/apercu/demo.js';

// pesées tous les `every` jours sur `n` jours jusqu'à `today`, pente kg/semaine, bruit alterné ±noise
function weighins(today, { n = 28, every = 2, start = 80, slope = -0.3, noise = 0 } = {}) {
  const out = [];
  for (let i = n; i >= 0; i -= every) {
    const d = TB.shiftDay(today, -i), w = start + slope * ((n - i) / 7) + (i % 4 === 0 ? noise : -noise);
    out.push({ d, w: Math.round(w * 100) / 100, t: null });
  }
  return out;
}
const intakeOf = (today, kcal, target, days = 21) => {
  const o = {};
  for (let i = 0; i <= days; i++) o[TB.shiftDay(today, -i)] = { k: kcal, target };
  return o;
};
const T = '2026-10-27';

describe('tendance du poids', () => {
  it('lisse les variations du jour et suit la pente', () => {
    const s = TB.trendSeries([{ d: '2026-10-01', w: 80 }, { d: '2026-10-02', w: 81 }, { d: '2026-10-03', w: 79 }, { d: '2026-10-10', w: 80 }]);
    expect(s.map((p) => p.t)).toEqual([80, 80.1, 79.99, 80]);
    // une pesée après une longue absence compte davantage
    const gap = TB.trendSeries([{ d: '2026-10-01', w: 80 }, { d: '2026-10-21', w: 78 }]);
    expect(gap[1].t).toBeCloseTo(80 + (1 - 0.9 ** 20) * -2, 2);
    // ordre, dates invalides et poids absents ignorés
    expect(TB.trendSeries([{ d: '2026-10-05', w: 70 }, { d: 'x', w: 1 }, { d: '2026-10-01', w: null }, { d: '2026-10-03', w: 72 }]).map((p) => p.d)).toEqual(['2026-10-03', '2026-10-05']);
  });

  it('vitesse sur 3 semaines : pente des pesées, ou rien si trop peu de pesées', () => {
    expect(TB.weeklyRate(weighins(T, { slope: -0.3 }), T)).toBeCloseTo(-0.3, 2);
    expect(TB.weeklyRate(weighins(T, { slope: 0.25, noise: 0.4 }), T)).toBeCloseTo(0.25, 1);
    expect(TB.weeklyRate([{ d: TB.shiftDay(T, -2), w: 80 }, { d: TB.shiftDay(T, -1), w: 80 }, { d: T, w: 79.8 }], T)).toBeNull();
    // 4 pesées mais sur moins de 10 jours
    expect(TB.weeklyRate(weighins(T, { n: 8, every: 2 }), T)).toBeNull();
    expect(TB.fmtRate(-0.123)).toBe('−0,12 kg');
    expect(TB.fmtRate(0.2)).toBe('+0,20 kg');
    expect(TB.fmtRate(0.001)).toBe('0,00 kg');
  });
});

describe('calories adaptatives', () => {
  it('sans assez de pesées : rien à proposer', () => {
    const r = TB.calorieCheck({ bodylog: [{ d: T, w: 80 }], today: T, goal: 'perte', calbase: 2300 });
    expect(r.status).toBe('pesees');
  });

  it('bilan : poids stable en mangeant 2 500 kcal → dépense 2 500 ; perte visée → base plus basse, limitée à 200 kcal', () => {
    const r = TB.calorieCheck({ bodylog: weighins(T, { slope: 0 }), intake: intakeOf(T, 2500, 2500), today: T, goal: 'perte', calbase: 2300, mainSessions: 4, swimDays: 0 });
    expect(r).toMatchObject({ status: 'ok', method: 'bilan', tdee: 2500, days: 21 });
    expect(r.desired).toBeCloseTo(-0.4, 2);                  // 0,5 % de 80 kg par semaine
    // voulu : 2 500 − 0,4 × 1 100 − 4 × 250 / 7 ≈ 1 917 → −383, limité à −200
    expect(r.delta).toBe(-200);
    expect(r.to).toBe(2100);
  });

  it('bilan : perte déjà plus rapide que visé → base plus haute', () => {
    const r = TB.calorieCheck({ bodylog: weighins(T, { slope: -0.8 }), intake: intakeOf(T, 2000, 2100), today: T, goal: 'perte', calbase: 1900, mainSessions: 3, swimDays: 0 });
    expect(r.method).toBe('bilan');
    expect(r.tdee).toBeCloseTo(2000 + 0.8 * 1100, -1);
    expect(r.delta).toBeGreaterThan(0);
    expect(r.delta).toBeLessThanOrEqual(200);
  });

  it('peu de repas notés : correction de la moitié de l’écart de vitesse', () => {
    const r = TB.calorieCheck({ bodylog: weighins(T, { slope: 0.2 }), intake: {}, today: T, goal: 'forme', calbase: 2400 });
    expect(r.method).toBe('vitesse');
    // 0,2 kg/sem au-dessus de la stabilité : −0,2 × 1 100 × 0,5 = −110 → −100
    expect(r.delta).toBe(-100);
    // écart de moins de 0,1 kg/sem : on garde
    expect(TB.calorieCheck({ bodylog: weighins(T, { slope: 0.05 }), today: T, goal: 'forme', calbase: 2400 }).delta).toBe(0);
  });

  it('jours de repas incomplets ignorés (moins de la moitié de l’objectif)', () => {
    const intake = intakeOf(T, 2600, 2400);
    for (let i = 1; i <= 10; i++) intake[TB.shiftDay(T, -i)] = { k: 600, target: 2400 };
    const r = TB.calorieCheck({ bodylog: weighins(T, { slope: 0 }), intake, today: T, goal: 'forme', calbase: 2400 });
    expect(r.days).toBe(11);
    expect(r.method).toBe('vitesse');
  });

  it('une décision par semaine', () => {
    expect(TB.checkDue(null, T)).toBe(true);
    expect(TB.checkDue({ d: TB.shiftDay(T, -6) }, T)).toBe(false);
    expect(TB.checkDue({ d: TB.shiftDay(T, -7) }, T)).toBe(true);
  });

  it('exemple de l’aperçu : assez de données pour un bilan', () => {
    const d = demoData(new Date('2026-10-27T12:00:00'));
    const body = JSON.parse(d.bodylog);
    expect(body.length).toBeGreaterThan(30);
    expect(TB.weeklyRate(body, '2026-10-27')).toBeLessThan(0);
    expect(Object.keys(JSON.parse(d.foodlog)).length).toBeGreaterThanOrEqual(15);
  });
});
