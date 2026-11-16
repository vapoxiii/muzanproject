import { describe, it, expect } from 'vitest';
import { sunTimes, momentAt, kitchenFor, nextChange } from '../../src/nutrition/kitchen.js';

const PARIS = { lat: 48.857, lon: 2.352 };
const hm = (d) => d.getUTCHours() * 60 + d.getUTCMinutes();     // minutes UTC
const near = (d, h, m, tol = 6) => expect(Math.abs(hm(d) - (h * 60 + m))).toBeLessThanOrEqual(tol);

describe('heures du soleil', () => {
  it('Paris : solstice d’été et d’hiver (heures connues, à quelques minutes près)', () => {
    const ete = sunTimes(new Date(2026, 5, 21, 12), PARIS);          // 21 juin
    near(ete.rise, 3, 47); near(ete.set, 19, 58);                   // 5 h 47 et 21 h 58 à Paris
    const hiver = sunTimes(new Date(2026, 11, 21, 12), PARIS);      // 21 décembre
    near(hiver.rise, 7, 42); near(hiver.set, 15, 56);               // 8 h 42 et 16 h 56 à Paris
  });

  it('cercle polaire : nuit ou jour sans fin', () => {
    expect(sunTimes(new Date(2026, 11, 21, 12), { lat: 78, lon: 15 }).polar).toBe('nuit');
    expect(sunTimes(new Date(2026, 5, 21, 12), { lat: 78, lon: 15 }).polar).toBe('jour');
  });
});

describe('ambiance de la cuisine', () => {
  // 16 novembre à Paris : coucher vers 16 h 08 UTC (17 h 08 à Paris), lever vers 6 h 55 UTC
  const at = (h, m) => new Date(Date.UTC(2026, 10, 16, h, m));
  it('jour, coucher de soleil, nuit selon le soleil', () => {
    expect(momentAt(at(5, 30), PARIS)).toBe('nuit');      // 6 h 30 à Paris : avant le lever
    expect(momentAt(at(9, 0), PARIS)).toBe('jour');
    expect(momentAt(at(14, 30), PARIS)).toBe('jour');     // 15 h 30 : encore le jour
    expect(momentAt(at(15, 30), PARIS)).toBe('soir');     // 16 h 30 : le soleil descend
    expect(momentAt(at(16, 30), PARIS)).toBe('soir');     // 17 h 30 : juste après le coucher
    expect(momentAt(at(17, 0), PARIS)).toBe('nuit');      // 18 h 00
    expect(momentAt(at(22, 0), PARIS)).toBe('nuit');
  });

  it('en juin, le coucher de soleil arrive bien plus tard', () => {
    const juin = (h, m) => new Date(Date.UTC(2026, 5, 21, h, m));
    expect(momentAt(juin(18, 0), PARIS)).toBe('jour');    // 20 h à Paris
    expect(momentAt(juin(19, 30), PARIS)).toBe('soir');   // 21 h 30
    expect(momentAt(juin(21, 0), PARIS)).toBe('nuit');    // 23 h
  });

  it('une image manquante est remplacée par celle du jour', () => {
    const imgs = { jour: 'jour.webp', soir: null, nuit: 'nuit.webp' };
    expect(kitchenFor(at(15, 30), PARIS, imgs)).toEqual({ moment: 'soir', ambiance: 'jour', src: 'jour.webp' });
    expect(kitchenFor(at(22, 0), PARIS, imgs)).toEqual({ moment: 'nuit', ambiance: 'nuit', src: 'nuit.webp' });
  });

  it('prochain changement : le début du coucher de soleil, puis la nuit', () => {
    const a = nextChange(at(12, 0), PARIS), b = nextChange(at(15, 30), PARIS);
    expect(momentAt(new Date(a.getTime() + 1000), PARIS)).toBe('soir');
    expect(momentAt(new Date(b.getTime() + 1000), PARIS)).toBe('nuit');
  });
});
