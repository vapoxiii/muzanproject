// Livre de recettes de la Nutrition : les calculs, sans interface.
// Importé par le code d'origine sous le nom RCP (voir vite.config.js) ; l'interface est dans
// src/legacy/20-recettes.js.
//
// Une recette { id, n, parts, items, prep, fid, at } :
//   n      son nom (« Bolo maison »)
//   parts  le nombre de parts qu'elle donne ; une part = ce qu'on mange en une fois
//   items  les ingrédients { n, u, k, p, g, l, q } : valeurs d'une portion de l'aliment (u : « 100 g »,
//          « 1 œuf »…) et nombre de portions q. Copiés à l'ajout : modifier ou supprimer un aliment de
//          « Mes aliments » ne change pas la recette.
//   prep   la préparation, texte libre (facultatif)
//   fid    son aliment « 1 part » dans Mes aliments : c'est lui qu'on note dans la journée
//   at     date de création (ms)
// Une recette déjà notée dont les valeurs changent garde son ancien aliment (marqué old) : les jours
// passés gardent leurs calories, la recette passe à un nouvel aliment.

export const MAX_PARTS = 24;
export const PART_U = '1 part';

const r1 = (x) => Math.round(x * 10) / 10;
function num(x) {
  if (typeof x === 'number') return isFinite(x) ? x : null;
  if (typeof x === 'string' && x.trim() !== '') { const n = Number(x.replace(',', '.')); return isFinite(n) ? n : null; }
  return null;
}

export function clampParts(n) {
  const v = Math.round(num(n) ?? 1);
  return Math.min(MAX_PARTS, Math.max(1, v));
}

// Quantité mesurable d'une portion : « 100 g » → { per: 100, unit: 'g' }, « pot 150g » → 150 g,
// « 200 ml » → 200 ml, « 1 kg » → 1 000 g. « 1 œuf », « 1 c. à soupe », « 1/2 » → null : on compte
// alors en portions.
const UNIT_RE = /(\d+(?:[.,]\d+)?)\s*(kg|grammes?|gr|g|cl|ml|l)(?![a-zà-ÿœ])/i;
export function unitAmount(u) {
  const m = String(u ?? '').match(UNIT_RE);
  if (!m) return null;
  let per = parseFloat(m[1].replace(',', '.'));
  let unit = m[2].toLowerCase();
  if (unit === 'kg') { per *= 1000; unit = 'g'; }
  else if (unit.startsWith('g')) unit = 'g';
  else if (unit === 'cl') { per *= 10; unit = 'ml'; }
  else if (unit === 'l') { per *= 1000; unit = 'ml'; }
  return per > 0 ? { per, unit } : null;
}

// La quantité d'un ingrédient telle qu'on la lit et la tape : 250 (g), 400 (ml) ou 3 (portions)…
export function shownQty(it) {
  const a = unitAmount(it.u), q = Math.max(0, num(it.q) ?? 0);
  return a ? r1(q * a.per) : Math.round(q * 100) / 100;
}
// … et l'inverse : 250 g tapés pour un aliment « 100 g » → 2,5 portions
export function qtyFromShown(it, v) {
  const a = unitAmount(it.u), x = Math.max(0, num(v) ?? 0);
  return a ? x / a.per : x;
}

// Un ingrédient à partir d'un aliment de « Mes aliments » (ou d'un produit scanné) : une portion
export function itemFrom(f, q = 1) {
  const it = { n: String(f.n ?? 'Ingrédient'), u: String(f.u ?? '1 portion'), k: num(f.k) ?? 0, p: num(f.p) ?? 0, g: num(f.g), l: num(f.l), q };
  if (f.bc) it.bc = String(f.bc);
  return it;
}

// Ce qu'apporte un ingrédient (g ou l à null : inconnus)
export function itemValues(it) {
  const q = Math.max(0, num(it.q) ?? 0), g = num(it.g), l = num(it.l);
  return { k: (num(it.k) ?? 0) * q, p: (num(it.p) ?? 0) * q, g: g == null ? null : g * q, l: l == null ? null : l * q };
}

// Toute la recette. g et l : null si aucun ingrédient ne les donne ; sans = les ingrédients dont les
// glucides ou les lipides manquent (non comptés).
function rawTotals(items) {
  let k = 0, p = 0, g = 0, l = 0, hasG = false, hasL = false;
  const sans = [];
  for (const it of items || []) {
    if (!((num(it.q) ?? 0) > 0)) continue;
    const v = itemValues(it);
    k += v.k; p += v.p;
    if (v.g != null) { g += v.g; hasG = true; }
    if (v.l != null) { l += v.l; hasL = true; }
    if (v.g == null || v.l == null) sans.push(String(it.n ?? ''));
  }
  return { k, p, g: hasG ? g : null, l: hasL ? l : null, sans };
}
export function totals(items) {
  const t = rawTotals(items);
  return { k: Math.round(t.k), p: r1(t.p), g: t.g == null ? null : r1(t.g), l: t.l == null ? null : r1(t.l), sans: t.sans };
}
export function perPart(rec) {
  const t = rawTotals(rec.items), n = clampParts(rec.parts);
  return { k: Math.round(t.k / n), p: r1(t.p / n), g: t.g == null ? null : r1(t.g / n), l: t.l == null ? null : r1(t.l / n), sans: t.sans };
}

// L'aliment « 1 part » de la recette (sans son id)
export function partFood(rec) {
  const pp = perPart(rec);
  return { n: String(rec.n ?? '').trim() || 'Recette', k: pp.k, p: pp.p, g: pp.g, l: pp.l, u: PART_U, rec: rec.id };
}
export function sameValues(a, b) {
  return !!a && !!b && a.k === b.k && a.p === b.p && (a.g ?? null) === (b.g ?? null) && (a.l ?? null) === (b.l ?? null);
}
// L'aliment fid est-il noté dans au moins une journée ?
export function usedIn(foodlog, fid) {
  for (const d in foodlog || {}) {
    const arr = foodlog[d];
    if (Array.isArray(arr) && arr.some((e) => e && e.fid === fid)) return true;
  }
  return false;
}
// Ce que devient l'aliment de la recette à l'enregistrement (rien n'est modifié ici) :
//   { update: id, values }          l'aliment actuel prend les nouvelles valeurs
//   { create: values, retire: id }  nouvel aliment ; l'ancien (déjà noté, valeurs différentes) reste pour l'historique
export function planFood(rec, foodlib, foodlog) {
  const values = partFood(rec);
  const cur = rec.fid ? (foodlib || []).find((f) => f && f.id === rec.fid) : null;
  if (!cur) return { create: values, retire: null };
  if (sameValues(cur, values) || !usedIn(foodlog, cur.id)) return { update: cur.id, values };
  return { create: values, retire: cur.id };
}

// Une recette relue dans le stockage : champs remis en forme, null si inutilisable
export function cleanRecipe(r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id) return null;
  const items = Array.isArray(r.items)
    ? r.items.filter((it) => it && typeof it === 'object').map((it) => itemFrom(it, Math.max(0, num(it.q) ?? 0)))
    : [];
  return { ...r, n: String(r.n ?? '').trim() || 'Recette', parts: clampParts(r.parts), items, prep: typeof r.prep === 'string' ? r.prep : '' };
}

export function newId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Recherche sans accents ni majuscules, dans le nom et les ingrédients
export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function searchRecipes(list, q) {
  const f = fold(q).trim();
  if (!f) return list;
  return list.filter((r) => fold(r.n).includes(f) || (r.items || []).some((it) => fold(it.n).includes(f)));
}
// Ordre du livre : alphabétique
export function sortRecipes(list) {
  return list.slice().sort((a, b) => String(a.n).localeCompare(String(b.n), 'fr', { sensitivity: 'base' }));
}
// Jours où chaque recette a été notée (toutes ses versions) : { idRecette: { n, last } }
export function usage(foodlog, foodlib) {
  const recOf = new Map((foodlib || []).filter((f) => f && f.rec).map((f) => [f.id, f.rec]));
  const out = {};
  for (const d in foodlog || {}) {
    const seen = new Set();
    for (const e of foodlog[d] || []) {
      const r = recOf.get(e && e.fid);
      if (!r || seen.has(r)) continue;
      seen.add(r);
      const u = out[r] || (out[r] = { n: 0, last: '' });
      u.n++; if (d > u.last) u.last = d;
    }
  }
  return out;
}
// Les recettes à proposer en premier (la balance) : les plus notées, puis les plus récentes
export function favorites(list, use, max = 4) {
  return list.slice().sort((a, b) => {
    const ua = use[a.id] || { n: 0, last: '' }, ub = use[b.id] || { n: 0, last: '' };
    return ub.n - ua.n || (ub.last > ua.last ? 1 : ub.last < ua.last ? -1 : 0) || (b.at || 0) - (a.at || 0);
  }).slice(0, max);
}
