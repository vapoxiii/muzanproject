import { describe, it, expect } from 'vitest';
import { createRestTimer, fmtCountdown, fmtClock } from '../../src/training/rest.js';

// horloge simulée : le temps n'avance que quand le test le dit
function clock(t0 = 1_000_000) { let t = t0; const now = () => t; now.go = (ms) => { t += ms; }; return now; }

describe('minuteur de repos', () => {
  it('décompte à partir d’une heure de fin : rien ne dérive, même après un long trou', () => {
    const now = clock(), r = createRestTimer(now).start(90_000);
    expect(r.left()).toBe(90_000);
    now.go(1_000); expect(fmtCountdown(r.left())).toBe('01:29');
    // l'app en arrière-plan 40 s (aucun « tic » pendant ce temps) : le compte est juste au retour
    now.go(40_000); expect(fmtCountdown(r.left())).toBe('00:49');
    expect(r.progress()).toBeCloseTo(49 / 90, 5);
    now.go(60_000); expect(r.left()).toBe(0); expect(r.done).toBe(true); expect(r.overdue()).toBe(11_000);
  });

  it('pause et reprise : le temps restant ne bouge pas pendant la pause', () => {
    const now = clock(), r = createRestTimer(now).start(60_000);
    now.go(15_000); r.pause();
    expect(r.paused).toBe(true);
    now.go(120_000); expect(r.left()).toBe(45_000); expect(r.done).toBe(false); expect(r.overdue()).toBe(0);
    r.toggle(); expect(r.paused).toBe(false);
    now.go(5_000); expect(r.left()).toBe(40_000);
  });

  it('recommencer, ±15 s, arrêter', () => {
    const now = clock(), r = createRestTimer(now).start(90_000);
    now.go(50_000); r.pause(); r.restart();
    expect(r.paused).toBe(false); expect(r.left()).toBe(90_000); expect(r.progress()).toBe(1);
    r.add(15_000); expect(r.left()).toBe(105_000); expect(r.total).toBe(105_000);
    r.add(-200_000); expect(r.left()).toBe(1_000);           // jamais sous une seconde
    r.pause(); r.add(30_000); expect(r.left()).toBe(31_000);
    r.stop(); expect(r.running).toBe(false); expect(r.left()).toBe(0); expect(r.progress()).toBe(0);
    r.add(10_000); r.toggle(); expect(r.left()).toBe(0);      // arrêté : plus rien ne bouge
  });

  it('formats : décompte sur deux chiffres, heure du téléphone', () => {
    expect(fmtCountdown(90_000)).toBe('01:30');
    expect(fmtCountdown(89_001)).toBe('01:30');               // une seconde entamée compte
    expect(fmtCountdown(500)).toBe('00:01');
    expect(fmtCountdown(0)).toBe('00:00');
    expect(fmtCountdown(605_000)).toBe('10:05');
    expect(fmtClock(new Date(2026, 10, 3, 9, 5))).toBe('09:05');
    expect(fmtClock(new Date(2026, 10, 3, 19, 24))).toBe('19:24');
  });
});
