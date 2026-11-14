// Synchronisation entre appareils.
//
// Principe : chaque clé (semaine, mesures, aliments…) est une ligne côté serveur avec un
// numéro de révision. Le téléphone garde la dernière version reçue (base). À l'envoi, le
// serveur n'accepte la nouvelle valeur que si sa révision n'a pas bougé ; sinon il renvoie
// sa version et on fusionne les deux (merge.js) avant de renvoyer. Rien n'est écrasé à
// l'aveugle, et tout marche hors ligne : les changements partent à la reconnexion.
//
// Les photos suivent le même chemin (table « photos » + fichiers), seulement si la
// sauvegarde des photos est activée (réglage « cloud:photos », partagé entre appareils).

import { records, recordOf, putRecord, isSyncable, getSys, setSys, flushStorage, resetSyncState, sget, sset } from './storage.js';
import { merge3 } from './merge.js';
import { photoRecords, photoBlob, markPhotoSynced, addPhoto, removePhoto, markAllPhotosUnsynced } from './photos.js';
import { buildBackup } from './backup.js';

export const PAGE = 500;
const BATCH = 100;

export const sync = { state: 'off', lastAt: null, error: null, pending: 0, remoteChanged: [] };
const listeners = new Set();
export function onSyncChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { sync.pending = pendingCount(); for (const fn of listeners) { try { fn(sync); } catch (e) { console.error(e); } } }
function setState(s) { sync.state = s; emit(); }

let remote = null, userId = null, running = null, again = false;
const K = (name) => `sync:${userId}:${name}`;

export function pendingCount() {
  let n = 0;
  for (const r of records()) if (r.dirty && isSyncable(r.k)) n++;
  if (photosEnabled()) for (const p of photoRecords()) if (p.dirty) n++;
  return n;
}
export function photosEnabled() { return sget('cloud:photos') === '1'; }

export function isNetworkError(e) {
  const m = String((e && (e.message || e.code)) || e || '');
  return (typeof navigator !== 'undefined' && navigator.onLine === false) || /fetch|network|load failed|offline|ECONNREFUSED|timeout/i.test(m);
}

// ---------- branchement ----------
// remoteAdapter : voir remote.js (Supabase) ou tests/unit/memory-remote.js
export async function startSync(remoteAdapter, uid) {
  remote = remoteAdapter; userId = uid;
  sync.lastAt = getSys(K('lastAt'), null);
  if (getSys('sync:user', null) !== uid) {
    // premier passage de ce compte sur ce téléphone (ou autre compte qu'avant)
    resetSyncState();
    await markAllPhotosUnsynced();
    await flushStorage();
    await setSys('sync:user', uid);
    await setSys(K('cursor'), 0);
    await setSys(K('pcursor'), 0);
    await setSys(K('first'), true);
  }
  setState('idle');
}

export function stopSync() { remote = null; userId = null; setState('off'); }
export function syncActive() { return !!remote; }

// ---------- un passage complet ----------
export function syncNow() {
  if (!remote) return Promise.resolve(sync);
  if (running) { again = true; return running; }
  running = (async () => {
    setState('syncing');
    try {
      do {
        again = false;
        if (getSys(K('first'), false)) await firstSync();
        else await pullKv(false);
        await pushKv();
        if (photosEnabled()) await syncPhotos();
      } while (again && remote);
      sync.lastAt = Date.now(); sync.error = null;
      if (userId) await setSys(K('lastAt'), sync.lastAt);
      setState(remote ? 'idle' : 'off');
    } catch (e) {
      if (!remote) { setState('off'); return sync; }       // déconnexion pendant le passage
      sync.error = e;
      setState(isNetworkError(e) ? 'offline' : 'error');
      if (!isNetworkError(e)) console.error('[synchro]', e);
    } finally { running = null; }
    return sync;
  })();
  return running;
}

// Données « réelles » sur ce téléphone ? (sinon, à la première connexion, on reprend
// simplement celles du compte au lieu de fusionner avec les valeurs par défaut)
function hasRealData() {
  for (const r of records()) {
    if (r.del || !isSyncable(r.k)) continue;
    if (r.k.startsWith('fitweek:') || ['profile', 'onb:done', 'avatar:config', 'program'].includes(r.k)) return true;
    if (r.k === 'bodylog') { try { if (JSON.parse(r.v).length) return true; } catch (e) { /* ignoré */ } }
    if (r.k === 'foodlog') { try { if (Object.keys(JSON.parse(r.v)).length) return true; } catch (e) { /* ignoré */ } }
  }
  return photoRecords().some((p) => !p.del);
}

async function fetchAllKv() {
  const rows = [];
  let cursor = 0;
  for (;;) {
    const page = await remote.pullKv(cursor);
    rows.push(...page);
    if (page.length) cursor = page[page.length - 1].rev;
    if (page.length < PAGE) break;
  }
  return rows;
}

async function firstSync() {
  const rows = await fetchAllKv();
  const live = rows.filter((r) => !r.deleted && isSyncable(r.key));
  const changed = [];
  if (live.length && !hasRealData()) {
    // téléphone neuf : on prend les données du compte telles quelles
    for (const r of records()) if (isSyncable(r.k)) { putRecord(r.k, { del: true, v: null, dirty: false, base: null, rev: 0 }); changed.push(r.k); }
    for (const row of rows) if (applyRow(row, 'remote')) changed.push(row.key);
  } else {
    if (live.length) {
      // les deux côtés ont des données : copie de sécurité locale, puis fusion
      try { await setSys('snapshot', { at: new Date().toISOString(), backup: await buildBackup() }); } catch (e) { console.warn('[synchro] copie de sécurité impossible', e); }
    }
    for (const row of rows) if (applyRow(row, 'remote')) changed.push(row.key);
  }
  const cursor = rows.reduce((m, r) => Math.max(m, r.rev), 0);
  await flushStorage();
  await setSys(K('cursor'), cursor);
  await setSys(K('first'), false);
  if (changed.length) remoteChanged(changed, true);
}

async function pullKv(full) {
  let cursor = full ? 0 : getSys(K('cursor'), 0);
  const changed = [];
  for (;;) {
    const rows = await remote.pullKv(cursor);
    for (const row of rows) { if (applyRow(row)) changed.push(row.key); cursor = Math.max(cursor, row.rev); }
    if (rows.length < PAGE) break;
  }
  await flushStorage();
  await setSys(K('cursor'), cursor);
  if (changed.length) remoteChanged(changed, false);
}

// Moment de la modification côté appareil qui l'a faite (t, en ms), à défaut celui de l'envoi.
function editedAt(row) { return Number(row.t) || Date.parse(row.updated_at || 0) || 0; }

// Applique une ligne du serveur. Renvoie true si la valeur visible a changé.
// preferOnConflict : qui gagne si les deux côtés ont modifié la même valeur simple.
function applyRow(row, preferOnConflict) {
  const k = row.key;
  if (!isSyncable(k)) return false;
  const rec = recordOf(k);
  const rv = row.deleted ? null : row.value;
  if (rec && !rec.dirty && rec.rev >= row.rev) return false;
  if (!rec || !rec.dirty) return putRecord(k, { v: rv, del: !!row.deleted, base: rv, rev: row.rev, dirty: false, t: rec ? rec.t : 0 });
  const localV = rec.del ? null : rec.v;
  let prefer = preferOnConflict;
  if (!prefer) prefer = rec.rev > 0 && (rec.t || 0) > editedAt(row) ? 'local' : 'remote';
  const merged = merge3(rec.rev > 0 ? rec.base : null, localV, rv, prefer);
  return putRecord(k, { v: merged, del: merged == null, base: rv, rev: row.rev, dirty: merged !== rv });
}

async function pushKv() {
  for (let round = 0; round < 4; round++) {
    const dirty = records().filter((r) => r.dirty && isSyncable(r.k));
    if (!dirty.length) return;
    let conflicts = 0;
    for (let i = 0; i < dirty.length; i += BATCH) {
      const items = dirty.slice(i, i + BATCH).map((r) => ({ key: r.k, value: r.del ? null : r.v, deleted: !!r.del, base_rev: r.rev || 0, t: r.t || Date.now() }));
      const res = await remote.pushKv(items);
      for (const it of res || []) {
        const sent = items.find((x) => x.key === it.key);
        if (!sent) continue;
        const rec = recordOf(it.key);
        const cur = rec ? (rec.del ? null : rec.v) : null;
        if (it.status === 'ok') {
          const same = !!rec && cur === sent.value && !!rec.del === sent.deleted;
          if (same) putRecord(it.key, { base: sent.value, rev: it.rev, dirty: false, del: sent.deleted, v: sent.value });
          else if (rec) putRecord(it.key, { base: sent.value, rev: it.rev, dirty: true });   // modifiée pendant l'envoi
        } else if (it.status === 'conflict') {
          conflicts++;
          const row = it.row || { value: null, deleted: true, rev: 0, updated_at: null, t: 0 };
          if (rec) {
            const localV = cur;
            const rv = row.deleted ? null : row.value;
            const prefer = rec.rev > 0 && (rec.t || 0) > editedAt(row) ? 'local' : 'remote';
            const merged = merge3(rec.rev > 0 ? rec.base : null, localV, rv, rec.rev > 0 ? prefer : 'remote');
            const needPush = merged !== rv || (!row.rev && merged != null);
            const changed = putRecord(it.key, { v: merged, del: merged == null, base: rv, rev: row.rev || 0, dirty: needPush });
            if (changed) remoteChanged([it.key], false);
          }
        }
      }
    }
    await flushStorage();
    if (!conflicts) return;
  }
}

// ---------- photos ----------
async function syncPhotos() {
  let cursor = getSys(K('pcursor'), 0);
  const local = new Map(photoRecords().map((p) => [p.id, p]));
  let changed = false;
  for (;;) {
    const rows = await remote.pullPhotos(cursor);
    for (const row of rows) {
      cursor = Math.max(cursor, row.rev);
      const p = local.get(row.id);
      if (row.deleted) {
        if (p && !p.dirty) { await removePhoto(row.id, { source: 'remote' }); changed = true; }
      } else if (!p) {
        try {
          const blob = await remote.download(row.id);
          if (blob) { await addPhoto(blob, row.d, { source: 'remote', synced: { rev: row.rev } }); changed = true; }
        } catch (e) { if (isNetworkError(e)) throw e; console.warn('[synchro] photo illisible', row.id, e); }
      }
    }
    if (rows.length < PAGE) break;
  }
  await setSys(K('pcursor'), cursor);
  for (const p of photoRecords()) {
    if (!p.dirty) continue;
    if (p.del) {
      await remote.removeObject(p.id).catch((e) => { if (isNetworkError(e)) throw e; });
      const row = await remote.pushPhoto({ id: p.id, d: p.d, deleted: true, bytes: 0 });
      await markPhotoSynced(p.id, row.rev);
    } else {
      const blob = photoBlob(p.id);
      if (!blob) continue;
      await remote.upload(p.id, blob);
      const row = await remote.pushPhoto({ id: p.id, d: p.d, deleted: false, bytes: blob.size });
      await markPhotoSynced(p.id, row.rev);
    }
  }
  if (changed) remoteChanged(['photos'], false);
}

// Active / coupe la sauvegarde des photos pour le compte (réglage partagé).
export async function setPhotoBackup(on) {
  if (on) await markAllPhotosUnsynced();
  sset('cloud:photos', on ? '1' : '0');
  await flushStorage();
  return syncNow();
}

// ---------- prévenir l'interface ----------
function remoteChanged(keys, first) {
  for (const k of keys) if (!sync.remoteChanged.includes(k)) sync.remoteChanged.push(k);
  sync.firstPull = sync.firstPull || first;
  emit();
}
export function clearRemoteChanged() { sync.remoteChanged = []; sync.firstPull = false; emit(); }

export function snapshotInfo() { const s = getSys('snapshot', null); return s ? { at: s.at } : null; }
export function snapshotBackup() { const s = getSys('snapshot', null); return s ? s.backup : null; }
export async function dropSnapshot() { await setSys('snapshot', undefined); }
