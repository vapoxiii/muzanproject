// Stockage local de l'app.
//
// L'ancien code lit et écrit de façon synchrone (sget / sset, comme localStorage).
// On garde cette interface : toutes les données sont chargées en mémoire au démarrage,
// les lectures sont immédiates et les écritures partent dans IndexedDB juste après.
//
// IndexedDB plutôt que localStorage : pas de limite de 5 Mo, photos en fichiers,
// et de quoi suivre la synchronisation (valeur connue du serveur, révision, à envoyer).
// Si IndexedDB n'est pas disponible, on retombe sur localStorage, puis sur la mémoire
// (comme l'ancienne app).
//
// Enregistrement d'une clé : { k, v, t, del, base, rev, dirty }
//   v     valeur (chaîne) ou null si supprimée
//   t     date de la dernière modification locale (ms)
//   del   true si supprimée (gardée pour propager la suppression)
//   base  dernière valeur reçue du / envoyée au serveur (null si jamais synchronisée)
//   rev   révision serveur correspondante (0 si jamais synchronisée)
//   dirty true si la valeur locale reste à envoyer

import { openDB, tx, reqP } from './idb.js';
import { merge3 } from './merge.js';

// Clés qui ne viennent pas de l'app (session du compte, outils) : jamais reprises.
const NOT_APP = /^(sb-|ms-auth|__)/;
// Clés partagées entre appareils. Le reste (clé IA perso, brouillon d'onboarding,
// clés inconnues d'autres pages du même site) reste sur ce téléphone.
const SYNC_EXACT = new Set(['bodylog', 'foodlib', 'foodlog', 'dayact', 'calbase', 'profile', 'avatar:config',
  'avatar:inv', 'coach', 'coach:event', 'ui:hero', 'onb:done', 'cloud:photos', 'program', 'calcheck']);
export function isSyncable(k) { return k.startsWith('fitweek:') || SYNC_EXACT.has(k); }
export function isAppKey(k) { return !NOT_APP.test(k); }

const cache = new Map();      // k -> enregistrement
const seen = new Map();       // k -> valeur telle que l'app la connaît (dernière lecture ou écriture)
const pending = new Map();    // k -> enregistrement à écrire
const sysCache = new Map();   // réglages internes (curseur de synchro, reprise effectuée…)
const listeners = new Set();
let db = null;
let backend = 'mem';          // 'idb' | 'ls' | 'mem'
let chain = Promise.resolve();
let inflight = 0;
let flushQueued = false;
let lastError = null;

export const storageInfo = { backend: 'mem', migrated: null, persisted: null, ready: false };

const now = () => Date.now();
function lsOk() {
  try { localStorage.setItem('__t__', '1'); const ok = localStorage.getItem('__t__') === '1'; localStorage.removeItem('__t__'); return ok; } catch (e) { return false; }
}
function readLocalStorage(filter) {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && filter(k)) { const v = localStorage.getItem(k); if (v != null) out[k] = v; }
    }
  } catch (e) { /* inaccessible */ }
  return out;
}

export function getDB() { return db; }
export function getBackend() { return backend; }

// ---------- démarrage ----------
// onLegacyPhotos(json) : reçoit l'ancienne valeur « photos » (images en base64) pendant la reprise,
// renvoie le nombre de photos reprises.
export async function initStorage({ onLegacyPhotos, forceBackend } = {}) {
  cache.clear(); seen.clear(); pending.clear(); sysCache.clear();
  backend = forceBackend || 'idb';
  if (backend === 'idb') {
    try { db = await openDB(); } catch (e) { db = null; lastError = e; backend = lsOk() ? 'ls' : 'mem'; }
  }
  storageInfo.backend = backend;
  if (backend === 'idb') {
    const t = db.transaction(['kv', 'sys'], 'readonly');
    const [recs, sys] = await Promise.all([reqP(t.objectStore('kv').getAll()), reqP(t.objectStore('sys').getAll())]);
    for (const r of recs) cache.set(r.k, r);
    for (const r of sys) sysCache.set(r.k, r.v);
    if (!sysCache.has('migratedFromLS')) await migrateFromLocalStorage(onLegacyPhotos);
    storageInfo.migrated = sysCache.get('migratedFromLS');
  } else if (backend === 'ls') {
    const all = readLocalStorage(isAppKey);
    for (const k in all) cache.set(k, { k, v: all[k], t: 0, del: false, base: null, rev: 0, dirty: false });
    const sys = readLocalStorage((k) => k.startsWith('__ms:'));
    for (const k in sys) { try { sysCache.set(k.slice(5), JSON.parse(sys[k])); } catch (e) { /* ignoré */ } }
  }
  storageInfo.ready = true;
  requestPersistence();
  return storageInfo;
}

// Première ouverture de cette version : on recopie les données de l'ancienne app
// (localStorage, même adresse). L'original n'est pas effacé : revenir à l'ancienne
// version reste possible.
async function migrateFromLocalStorage(onLegacyPhotos) {
  const all = lsOk() ? readLocalStorage(isAppKey) : {};
  const t = now();
  const recs = [];
  let legacyPhotos = null;
  for (const k in all) {
    if (k === 'photos') { legacyPhotos = all[k]; continue; }
    if (cache.has(k)) continue;
    recs.push({ k, v: all[k], t, del: false, base: null, rev: 0, dirty: isSyncable(k) });
  }
  let photos = 0;
  if (legacyPhotos && onLegacyPhotos) {
    try { photos = await onLegacyPhotos(legacyPhotos); } catch (e) { console.error('[stockage] reprise des photos impossible', e); }
  }
  const info = { at: new Date(t).toISOString(), keys: recs.length, photos };
  await tx(db, ['kv', 'sys'], 'readwrite', (s) => {
    for (const r of recs) s.kv.put(r);
    s.sys.put({ k: 'migratedFromLS', v: info });
  });
  for (const r of recs) cache.set(r.k, r);
  sysCache.set('migratedFromLS', info);
}

// Demande au navigateur de ne pas effacer les données (app installée seulement : dans un
// onglet, certains navigateurs affichent une demande d'autorisation au démarrage).
async function requestPersistence() {
  try {
    const installed = typeof navigator !== 'undefined' && (navigator.standalone === true ||
      (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches));
    if (installed && navigator.storage && navigator.storage.persist) {
      const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      storageInfo.persisted = already || await navigator.storage.persist();
    }
  } catch (e) { storageInfo.persisted = null; }
}

// ---------- interface de l'app (synchrone) ----------
export function sget(k) {
  const r = cache.get(k);
  const v = r && !r.del ? r.v : null;
  seen.set(k, v);
  return v;
}

export function sset(k, v) {
  k = String(k);
  v = v == null ? null : String(v);
  const r = cache.get(k);
  const cur = r && !r.del ? r.v : null;
  let out = v;
  // L'app écrit une valeur calculée à partir d'une lecture plus ancienne que la donnée
  // actuelle (la synchronisation est passée entre-temps) : on fusionne au lieu d'écraser.
  if (seen.has(k)) {
    const last = seen.get(k);
    if (last !== cur && v !== cur) out = merge3(last, v, cur, 'local');
  }
  seen.set(k, v);
  if (out === cur) return;
  if (out == null) { remove(k); return; }
  write(k, out);
}

export function sdel(k) {
  k = String(k);
  seen.set(k, null);
  remove(k);
}

export function skeys() {
  const out = [];
  for (const [k, r] of cache) if (!r.del) out.push(k);
  return out;
}

function write(k, v) {
  const prev = cache.get(k);
  const rec = { k, v, t: now(), del: false, base: prev ? prev.base ?? null : null, rev: prev ? prev.rev || 0 : 0, dirty: isSyncable(k) };
  if (rec.dirty && rec.rev > 0 && rec.base === v) rec.dirty = false;   // revenu à la valeur du serveur
  cache.set(k, rec);
  persist(rec);
  emit([k], 'local');
}

function remove(k) {
  const prev = cache.get(k);
  if (!prev || prev.del) return;
  if (isSyncable(k) && prev.rev > 0) {
    const rec = { ...prev, v: null, del: true, t: now(), dirty: true };
    cache.set(k, rec);
    persist(rec);
  } else {
    cache.delete(k);
    persist({ k, __delete: true });
  }
  emit([k], 'local');
}

function persist(rec) {
  pending.set(rec.k, rec);
  if (!flushQueued) { flushQueued = true; queueMicrotask(() => { flushQueued = false; flushStorage(); }); }
}

// Écrit tout ce qui est en attente. Renvoie une promesse résolue quand c'est sur disque.
export function flushStorage() {
  if (pending.size) {
    const batch = [...pending.values()];
    pending.clear();
    inflight++;
    chain = chain.then(() => writeBatch(batch)).catch((e) => {
      lastError = e;
      console.error('[stockage] écriture impossible', e);
      for (const r of batch) if (!pending.has(r.k)) pending.set(r.k, r);   // nouvel essai au prochain passage
    }).finally(() => { inflight--; });
  }
  return chain;
}

async function writeBatch(batch) {
  if (backend === 'idb') {
    await tx(db, 'kv', 'readwrite', (store) => {
      for (const r of batch) { if (r.__delete) store.delete(r.k); else store.put(r); }
    });
  } else if (backend === 'ls') {
    for (const r of batch) {
      try { if (r.__delete || r.del) localStorage.removeItem(r.k); else localStorage.setItem(r.k, r.v); } catch (e) { /* plein */ }
    }
  }
}

// ---------- événements ----------
// fn({ keys, source }) — source : 'local' (l'app), 'remote' (synchro), 'import'
export function onStoreChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(keys, source) { for (const fn of listeners) { try { fn({ keys, source }); } catch (e) { console.error(e); } } }

// ---------- accès pour la synchronisation ----------
export function records() { return [...cache.values()]; }
export function recordOf(k) { return cache.get(k) || null; }

// Applique un état venu du serveur ou calculé par la synchro. `seen` n'est pas modifié :
// si l'app écrit ensuite à partir d'une lecture périmée, son écriture sera fusionnée.
export function putRecord(k, patch, { source = 'remote' } = {}) {
  const prev = cache.get(k);
  const rec = { k, v: null, t: 0, del: false, base: null, rev: 0, dirty: false, ...(prev || {}), ...patch };
  if (rec.del) rec.v = null;
  const before = prev && !prev.del ? prev.v : null, after = rec.del ? null : rec.v;
  if (rec.del && !rec.dirty) { cache.delete(k); persist({ k, __delete: true }); }
  else { cache.set(k, rec); persist(rec); }
  if (before !== after) emit([k], source);
  return before !== after;
}

// Oublie l'état de synchronisation (déconnexion, autre compte) : tout redevient « à envoyer ».
export function resetSyncState() {
  for (const [k, r] of [...cache]) {
    if (!isSyncable(k)) continue;
    if (r.del) { cache.delete(k); persist({ k, __delete: true }); continue; }
    const rec = { ...r, base: null, rev: 0, dirty: true };
    cache.set(k, rec); persist(rec);
  }
}

// ---------- valeurs internes ----------
export function getSys(k, d = null) { return sysCache.has(k) ? sysCache.get(k) : d; }
export async function setSys(k, v) {
  if (v === undefined) sysCache.delete(k); else sysCache.set(k, v);
  if (backend === 'idb') await tx(db, 'sys', 'readwrite', (s) => { if (v === undefined) s.delete(k); else s.put({ k, v }); });
  else if (backend === 'ls') { try { if (v === undefined) localStorage.removeItem('__ms:' + k); else localStorage.setItem('__ms:' + k, JSON.stringify(v)); } catch (e) { /* rien */ } }
}
export function storageError() { return lastError; }
export function hasPendingWrites() { return pending.size > 0 || inflight > 0; }

// Pour les tests : repart de zéro sans recharger la page.
export function __resetForTests() {
  cache.clear(); seen.clear(); pending.clear(); sysCache.clear(); listeners.clear();
  if (db) { try { db.close(); } catch (e) { /* rien */ } }
  db = null; backend = 'mem'; chain = Promise.resolve(); inflight = 0;
}
