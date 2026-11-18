import { describe, it, expect } from 'vitest';
import * as R from '../../src/nutrition/recettes.js';

const RIZ = { n: 'Riz cuit', u: '100 g', k: 130, p: 2.7, g: 28, l: 0.3 };
const OEUF = { n: 'Œuf', u: '1 œuf', k: 78, p: 6, g: 0.4, l: 5.3 };
const HUILE = { n: "Huile d'olive", u: '1 c. à soupe', k: 119, p: 0, g: 0, l: 13.5 };

describe('portions mesurables', () => {
  it('lit les grammes et les millilitres dans la portion', () => {
    expect(R.unitAmount('100 g')).toEqual({ per: 100, unit: 'g' });
    expect(R.unitAmount('pot 150g')).toEqual({ per: 150, unit: 'g' });
    expect(R.unitAmount('dose 30g')).toEqual({ per: 30, unit: 'g' });
    expect(R.unitAmount('boîte 100g')).toEqual({ per: 100, unit: 'g' });
    expect(R.unitAmount('200 ml')).toEqual({ per: 200, unit: 'ml' });
    expect(R.unitAmount('25 cl')).toEqual({ per: 250, unit: 'ml' });
    expect(R.unitAmount('1 kg')).toEqual({ per: 1000, unit: 'g' });
    expect(R.unitAmount('150 gr')).toEqual({ per: 150, unit: 'g' });
    expect(R.unitAmount('2,5 g')).toEqual({ per: 2.5, unit: 'g' });
  });
  it('sinon on compte en portions', () => {
    for (const u of ['1 œuf', '1 c. à soupe', '1/2', '1 tranche', '1 moyenne', '1 portion', '1 part', '2 lamelles', '', null]) expect(R.unitAmount(u)).toBeNull();
  });
  it('quantité lue et tapée', () => {
    expect(R.shownQty({ ...RIZ, q: 2.5 })).toBe(250);
    expect(R.qtyFromShown(RIZ, 250)).toBe(2.5);
    expect(R.qtyFromShown(RIZ, '75,5')).toBeCloseTo(0.755);
    expect(R.shownQty({ ...OEUF, q: 3 })).toBe(3);
    expect(R.qtyFromShown(OEUF, 3)).toBe(3);
    expect(R.qtyFromShown(OEUF, -2)).toBe(0);
  });
});

describe('valeurs de la recette', () => {
  const bolo = { id: 'rc1', n: 'Bolo', parts: 4, items: [R.itemFrom(RIZ, 4), R.itemFrom(OEUF, 2), R.itemFrom(HUILE, 1)] };
  it('toute la recette et une part', () => {
    const t = R.totals(bolo.items);
    expect(t.k).toBe(Math.round(130 * 4 + 78 * 2 + 119));          // 795
    expect(t.p).toBe(Math.round((2.7 * 4 + 6 * 2) * 10) / 10);       // 22.8
    expect(t.g).toBe(Math.round((28 * 4 + 0.4 * 2) * 10) / 10);
    expect(t.l).toBe(Math.round((0.3 * 4 + 5.3 * 2 + 13.5) * 10) / 10);
    expect(t.sans).toEqual([]);
    const pp = R.perPart(bolo);
    expect(pp.k).toBe(Math.round(795 / 4));
    expect(pp.p).toBe(Math.round(22.8 / 4 * 10) / 10);
  });
  it('glucides ou lipides inconnus : signalés, pas inventés', () => {
    const items = [R.itemFrom(RIZ, 1), { n: 'Sauce maison', u: '1 portion', k: 90, p: 1, g: null, l: null, q: 1 }];
    const t = R.totals(items);
    expect(t.k).toBe(220);
    expect(t.g).toBe(28);
    expect(t.sans).toEqual(['Sauce maison']);
    const rien = R.totals([{ n: 'X', u: '1 portion', k: 100, p: 5, g: null, l: null, q: 2 }]);
    expect(rien.g).toBeNull(); expect(rien.l).toBeNull();
  });
  it('quantité nulle : ignorée ; parts bornées', () => {
    expect(R.totals([R.itemFrom(RIZ, 0)]).k).toBe(0);
    expect(R.clampParts(0)).toBe(1);
    expect(R.clampParts(99)).toBe(R.MAX_PARTS);
    expect(R.clampParts('3')).toBe(3);
  });
  it('aliment « 1 part »', () => {
    expect(R.partFood(bolo)).toEqual({ n: 'Bolo', k: 199, p: 5.7, g: 28.2, l: 6.3, u: '1 part', rec: 'rc1' });
  });
});

describe('aliment de la recette à l’enregistrement', () => {
  const rec = { id: 'rc1', n: 'Bolo', parts: 2, items: [R.itemFrom(RIZ, 2)], fid: 'rA' };
  const food = { id: 'rA', ...R.partFood(rec) };
  it('jamais notée : mise à jour sur place', () => {
    const plan = R.planFood({ ...rec, parts: 1 }, [food], {});
    expect(plan.update).toBe('rA');
    expect(plan.values.k).toBe(260);
  });
  it('déjà notée et valeurs changées : nouvel aliment, l’ancien garde l’historique', () => {
    const log = { '2026-11-18': [{ fid: 'rA', q: 1 }] };
    const plan = R.planFood({ ...rec, parts: 1 }, [food], log);
    expect(plan.create.k).toBe(260);
    expect(plan.retire).toBe('rA');
  });
  it('déjà notée, seul le nom change : mise à jour sur place', () => {
    const log = { '2026-11-18': [{ fid: 'rA', q: 1 }] };
    const plan = R.planFood({ ...rec, n: 'Bolo de mamie' }, [food], log);
    expect(plan.update).toBe('rA');
    expect(plan.values.n).toBe('Bolo de mamie');
  });
  it('aliment introuvable : recréé', () => {
    expect(R.planFood(rec, [], {})).toEqual({ create: R.partFood(rec), retire: null });
  });
});

describe('livre', () => {
  const list = [
    { id: 'a', n: 'Porridge protéiné', items: [R.itemFrom({ n: "Flocons d'avoine", u: '40 g', k: 150, p: 5 }, 2)], at: 1 },
    { id: 'b', n: 'bolo maison', items: [R.itemFrom(RIZ, 2)], at: 2 },
    { id: 'c', n: 'Écrasé de pommes de terre', items: [], at: 3 },
  ];
  it('ordre alphabétique, accents et majuscules compris', () => {
    expect(R.sortRecipes(list).map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
  it('recherche dans le nom et les ingrédients, sans accents', () => {
    expect(R.searchRecipes(list, 'ecrase').map((r) => r.id)).toEqual(['c']);
    expect(R.searchRecipes(list, 'AVOINE').map((r) => r.id)).toEqual(['a']);
    expect(R.searchRecipes(list, '  ')).toHaveLength(3);
  });
  it('les plus notées d’abord, toutes versions comprises, un jour compté une fois', () => {
    const foodlib = [{ id: 'r1', rec: 'a' }, { id: 'r2', rec: 'b', old: 1 }, { id: 'r3', rec: 'b' }, { id: 'f1' }];
    const log = { '2026-11-16': [{ fid: 'r2', q: 1 }, { fid: 'r3', q: 1 }], '2026-11-17': [{ fid: 'r3', q: 2 }], '2026-11-18': [{ fid: 'r1', q: 1 }, { fid: 'f1', q: 1 }] };
    const use = R.usage(log, foodlib);
    expect(use).toEqual({ b: { n: 2, last: '2026-11-17' }, a: { n: 1, last: '2026-11-18' } });
    expect(R.favorites(list, use).map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(R.favorites(list, {}, 2).map((r) => r.id)).toEqual(['c', 'b']);
  });
  it('recette relue : remise en forme', () => {
    expect(R.cleanRecipe(null)).toBeNull();
    expect(R.cleanRecipe({ n: 'sans id' })).toBeNull();
    const r = R.cleanRecipe({ id: 'x', n: '  ', parts: '0', items: [{ n: 'Riz', u: '100 g', k: '130', p: 2.7, q: '1,5' }, null] });
    expect(r.n).toBe('Recette');
    expect(r.parts).toBe(1);
    expect(r.items).toEqual([{ n: 'Riz', u: '100 g', k: 130, p: 2.7, g: null, l: null, q: 1.5 }]);
    expect(r.prep).toBe('');
  });
});
