import { describe, it, expect } from 'vitest';
import { WHEEL_PARTS, polar, sectorPath, partAt, wheelLayout } from '../../src/home/wheel.js';

describe('roue de l’accueil', () => {
  it('six parts, Progression en haut, Training à droite, Nutrition à gauche', () => {
    expect(WHEEL_PARTS.map((p) => p.k)).toEqual(['progress', 'training', 'sports', 'body', 'social', 'nutrition']);
    const at = (k) => WHEEL_PARTS.find((p) => p.k === k).a;
    expect(at('progress')).toBe(90);
    expect(Math.cos(at('training') * Math.PI / 180)).toBeGreaterThan(0);
    expect(Math.cos(at('nutrition') * Math.PI / 180)).toBeLessThan(0);
    // une part tous les 60°
    const a = WHEEL_PARTS.map((p) => (p.a + 360) % 360).sort((x, y) => x - y);
    a.forEach((v, i) => { if (i) expect(v - a[i - 1]).toBe(60); });
  });

  it('la part sous le doigt : par l’angle, rien sur le personnage ni loin de l’anneau', () => {
    const k = (dx, dy) => (partAt(dx, dy, 70, 180) || {}).k || null;
    expect(k(0, 120)).toBe('progress');          // au-dessus du centre
    expect(k(0, -120)).toBe('body');             // en dessous
    expect(k(110, 60)).toBe('training');         // en haut à droite
    expect(k(110, -60)).toBe('sports');          // en bas à droite
    expect(k(-110, -60)).toBe('social');        // en bas à gauche
    expect(k(-110, 60)).toBe('nutrition');       // en haut à gauche
    expect(['nutrition', 'social']).toContain(k(-150, 0));   // pile entre deux parts : l'une des deux, pas de trou
    expect(k(-150, 2)).toBe('nutrition');        // un peu au-dessus : la plus proche
    expect(k(20, 20)).toBe(null);                // sur le personnage du centre
    expect(k(0, 205)).toBe('progress');          // juste au-delà du bord : encore accepté
    expect(k(0, 260)).toBe(null);                // trop loin
  });

  it('géométrie : points et parts d’anneau', () => {
    const [x, y] = polar(10, 90);
    expect(x).toBeCloseTo(0); expect(y).toBeCloseTo(-10);    // en haut de l'écran : y négatif
    const d = sectorPath(70, 180, 61.5, 118.5);
    expect(d).toMatch(/^M[\d.,-]+ A180,180 0 0 0 [\d.,-]+ L[\d.,-]+ A70,70 0 0 1 [\d.,-]+ Z$/);
  });

  it('taille et place : tient dans l’écran, centrée sur le buste, le titre au-dessus', () => {
    for (const [w, h] of [[320, 568], [360, 640], [390, 844], [430, 932], [520, 1100]]) {
      const L = wheelLayout(w, h);
      expect(L.d).toBeLessThanOrEqual(Math.max(240, Math.min(w - 24, 380)));
      expect(L.cx).toBe(Math.round(w / 2));
      expect(L.cy - L.r1).toBeGreaterThanOrEqual(70);          // place du titre « Où on va ? »
      expect(L.cy + L.r1).toBeLessThanOrEqual(h - 20);
      expect(L.r0).toBeGreaterThan(40);                        // le personnage reste visible au centre
    }
  });
});
