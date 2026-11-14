// Fusion à trois versions (base commune, version locale, version distante).
//
// Sert à deux endroits :
//  - la synchronisation : une donnée modifiée sur ce téléphone ET sur un autre appareil ;
//  - le stockage : l'app écrit une valeur calculée à partir d'une lecture devenue périmée
//    (la synchronisation a apporté des changements entre-temps).
//
// Les valeurs sont des chaînes (souvent du JSON). Règles :
//  - si un seul côté a changé depuis la base, on garde ce côté ;
//  - objets : fusion propriété par propriété ;
//  - listes d'objets identifiés (id, d ou fid) : fusion élément par élément, ajouts et
//    suppressions des deux côtés conservés ;
//  - listes de même longueur sans identifiant (ex. coches d'une séance) : position par position ;
//  - vrai conflit sur une valeur simple : `prefer` décide ('local' par défaut).

const ID_FIELDS = ['id', 'd', 'fid'];
const MISSING = undefined;

function parse(s) {
  if (s == null) return { ok: true, v: MISSING };
  try { return { ok: true, v: JSON.parse(s) }; } catch (e) { return { ok: false }; }
}

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !deepEqual(a[k], b[k])) return false;
  return true;
}

function idFieldOf(...arrays) {
  const items = arrays.filter(Array.isArray).flat();
  if (!items.length) return null;
  for (const f of ID_FIELDS) {
    if (!items.every((x) => isObj(x) && (typeof x[f] === 'string' || typeof x[f] === 'number'))) continue;
    if (arrays.every((a) => !Array.isArray(a) || new Set(a.map((x) => x[f])).size === a.length)) return f;
  }
  return null;
}

function mergeArraysById(b, l, r, f, prefer) {
  const bm = new Map((b || []).map((x) => [x[f], x]));
  const lm = new Map(l.map((x) => [x[f], x]));
  const rm = new Map(r.map((x) => [x[f], x]));
  const order = [...l.map((x) => x[f]), ...r.map((x) => x[f]).filter((id) => !lm.has(id))];
  const out = [];
  for (const id of order) {
    const bv = bm.has(id) ? bm.get(id) : MISSING, lv = lm.has(id) ? lm.get(id) : MISSING, rv = rm.has(id) ? rm.get(id) : MISSING;
    const v = merge3v(bv, lv, rv, prefer);
    if (v !== MISSING) out.push(v);
  }
  // listes triées par date (ex. mesures) : on garde le tri
  const sorted = (a) => a.length > 1 && a.every((x, i) => i === 0 || String(a[i - 1][f]) <= String(x[f]));
  if (f === 'd' && (sorted(l) || sorted(r))) out.sort((x, y) => (String(x.d) < String(y.d) ? -1 : String(x.d) > String(y.d) ? 1 : 0));
  return out;
}

// Fusion sur des valeurs JS (MISSING = absente / supprimée)
export function merge3v(b, l, r, prefer = 'local') {
  if (deepEqual(l, r)) return l;
  if (deepEqual(l, b)) return r;          // seul le distant a changé
  if (deepEqual(r, b)) return l;          // seul le local a changé
  // les deux ont changé
  if (l === MISSING || r === MISSING) {
    // supprimé d'un côté, modifié de l'autre : on garde la version modifiée (pas de perte)
    return l === MISSING ? r : l;
  }
  if (isObj(l) && isObj(r)) {
    const base = isObj(b) ? b : {};
    const out = {};
    const keys = [...Object.keys(l), ...Object.keys(r).filter((k) => !(k in l))];
    for (const k of keys) {
      const v = merge3v(k in base ? base[k] : MISSING, k in l ? l[k] : MISSING, k in r ? r[k] : MISSING, prefer);
      if (v !== MISSING) out[k] = v;
    }
    return out;
  }
  if (Array.isArray(l) && Array.isArray(r)) {
    const base = Array.isArray(b) ? b : null;
    const f = idFieldOf(base, l, r);
    if (f) return mergeArraysById(base, l, r, f, prefer);
    const prim = (a) => a.every((x) => x === null || typeof x !== 'object');
    if (l.length === r.length && prim(l) && prim(r) && (!base || (base.length === l.length && prim(base)))) {
      return l.map((lv, i) => merge3v(base ? base[i] : MISSING, lv, r[i], prefer));
    }
    if (l.length === r.length && (!base || base.length === l.length)) {
      return l.map((lv, i) => merge3v(base ? base[i] : MISSING, lv, r[i], prefer));
    }
  }
  return prefer === 'remote' ? r : l;
}

// Fusion sur les chaînes stockées. null = clé absente / supprimée.
export function merge3(base, local, remote, prefer = 'local') {
  if (local === remote) return local;
  if (local === base) return remote;
  if (remote === base) return local;
  const B = parse(base), L = parse(local), R = parse(remote);
  if (!L.ok || !R.ok) return prefer === 'remote' ? remote : local;   // pas du JSON : pas de fusion fine
  const v = merge3v(B.ok ? B.v : MISSING, L.v, R.v, prefer);
  if (v === MISSING) return null;
  if (deepEqual(v, L.v)) return local;      // garde la forme exacte (espaces, ordre des clés)
  if (deepEqual(v, R.v)) return remote;
  return JSON.stringify(v);
}
