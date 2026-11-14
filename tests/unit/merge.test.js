import { describe, it, expect } from 'vitest';
import { merge3 } from '../../src/core/merge.js';

const J = (x) => JSON.stringify(x);
const P = (s) => JSON.parse(s);

describe('fusion à trois versions', () => {
  it('un seul côté modifié : on garde ce côté', () => {
    expect(merge3('a', 'b', 'a')).toBe('b');
    expect(merge3('a', 'a', 'c')).toBe('c');
    expect(merge3(null, 'x', null)).toBe('x');
    expect(merge3(null, null, 'y')).toBe('y');
  });

  it('repas du jour : deux appareils ajoutent des jours différents', () => {
    const base = J({ '2026-10-20': [{ fid: 'f1', q: 1 }] });
    const local = J({ '2026-10-20': [{ fid: 'f1', q: 1 }], '2026-10-21': [{ fid: 'f4', q: 2 }] });
    const remote = J({ '2026-10-20': [{ fid: 'f1', q: 1 }], '2026-10-19': [{ fid: 'f9', q: 1 }] });
    expect(P(merge3(base, local, remote))).toEqual({ '2026-10-20': [{ fid: 'f1', q: 1 }], '2026-10-21': [{ fid: 'f4', q: 2 }], '2026-10-19': [{ fid: 'f9', q: 1 }] });
  });

  it('même jour : aliments différents ajoutés de chaque côté, quantité modifiée d’un côté', () => {
    const base = J({ d: [{ fid: 'f1', q: 1 }, { fid: 'f2', q: 1 }] });
    const local = J({ d: [{ fid: 'f1', q: 3 }, { fid: 'f2', q: 1 }, { fid: 'f5', q: 1 }] });
    const remote = J({ d: [{ fid: 'f1', q: 1 }, { fid: 'f2', q: 1 }, { fid: 'f7', q: 2 }] });
    expect(P(merge3(base, local, remote)).d).toEqual([{ fid: 'f1', q: 3 }, { fid: 'f2', q: 1 }, { fid: 'f5', q: 1 }, { fid: 'f7', q: 2 }]);
  });

  it('suppressions : un aliment retiré d’un côté reste retiré', () => {
    const base = J([{ id: 'a', n: 'A' }, { id: 'b', n: 'B' }]);
    const local = J([{ id: 'a', n: 'A' }]);
    const remote = J([{ id: 'a', n: 'A' }, { id: 'b', n: 'B' }, { id: 'c', n: 'C' }]);
    expect(P(merge3(base, local, remote))).toEqual([{ id: 'a', n: 'A' }, { id: 'c', n: 'C' }]);
  });

  it('modifié d’un côté, supprimé de l’autre : la modification est gardée (pas de perte)', () => {
    const base = J([{ id: 'a', n: 'A' }]);
    expect(P(merge3(base, J([{ id: 'a', n: 'A2' }]), J([])))).toEqual([{ id: 'a', n: 'A2' }]);
  });

  it('mesures triées par date, fusionnées et retriées', () => {
    const base = J([{ d: '2026-10-01', w: 78 }]);
    const local = J([{ d: '2026-10-01', w: 78 }, { d: '2026-10-15', w: 77 }]);
    const remote = J([{ d: '2026-10-01', w: 78 }, { d: '2026-10-08', w: 77.5 }]);
    expect(P(merge3(base, local, remote)).map((x) => x.d)).toEqual(['2026-10-01', '2026-10-08', '2026-10-15']);
  });

  it('coches d’une séance : fusion case par case', () => {
    const base = J({ training: { hautA: [false, false, false] }, swim: [false, false] });
    const local = J({ training: { hautA: [true, false, false] }, swim: [false, false] });
    const remote = J({ training: { hautA: [false, false, true] }, swim: [true, false] });
    expect(P(merge3(base, local, remote))).toEqual({ training: { hautA: [true, false, true] }, swim: [true, false] });
  });

  it('vrai conflit sur une valeur simple : préférence demandée', () => {
    expect(merge3('2400', '2500', '2300', 'local')).toBe('2500');
    expect(merge3('2400', '2500', '2300', 'remote')).toBe('2300');
    expect(P(merge3(J({ a: 1 }), J({ a: 2 }), J({ a: 3 }), 'remote'))).toEqual({ a: 3 });
  });

  it('sans base commune (première synchro) : union des deux côtés', () => {
    const local = J([{ id: 'f1', n: 'Skyr' }, { id: 'c1', n: 'Bowl' }]);
    const remote = J([{ id: 'f1', n: 'Skyr' }, { id: 'c2', n: 'Wrap' }]);
    expect(P(merge3(null, local, remote, 'remote')).map((x) => x.id)).toEqual(['f1', 'c1', 'c2']);
  });

  it('valeurs non JSON : pas de fusion fine', () => {
    expect(merge3('illus', 'avatar', 'illus')).toBe('avatar');
    expect(merge3('x{', 'y{', 'z{', 'remote')).toBe('z{');
  });

  it('suppression des deux côtés : reste supprimé', () => {
    expect(merge3('a', null, null)).toBe(null);
  });

  it('garde la forme exacte quand le résultat est l’une des deux versions', () => {
    const local = '{"a": 1,  "b":2}';
    expect(merge3('{"a":1,"b":1}', local, '{"a":1,"b":1}')).toBe(local);
  });
});
