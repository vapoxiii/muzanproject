// Photos de progression : fichiers JPEG dans IndexedDB (avant : texte base64 dans localStorage,
// limité à 5 Mo). Chaque photo a un identifiant tiré de son contenu : la même photo reprise
// deux fois (migration, import, autre appareil) ne fait pas de doublon.
//
// Enregistrement : { id, d, t, blob | buf+type, size, del, dirty, rev }
//   dirty : à envoyer (ajout ou suppression) si la sauvegarde des photos est activée.

import { getDB, getBackend, sget, sset } from './storage.js';
import { tx, reqP } from './idb.js';

const items = new Map();   // id -> { rec, url }
const listeners = new Set();
let ready = false;

export function onPhotosChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(source) { for (const fn of listeners) { try { fn({ source }); } catch (e) { console.error(e); } } }

function blobOf(rec) {
  if (rec.blob) return rec.blob;
  if (rec.buf) return new Blob([rec.buf], { type: rec.type || 'image/jpeg' });
  return null;
}
function urlFor(rec) {
  const b = blobOf(rec);
  try { return b ? URL.createObjectURL(b) : ''; } catch (e) { return ''; }
}

export function dataUrlToBlob(dataUrl) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl || '');
  if (!m) return null;
  const type = m[1] || 'application/octet-stream';
  if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type });
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function photoIdFor(blob) {
  try {
    const buf = await blob.arrayBuffer();
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
    return 'p' + [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}

const today = () => { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

// ---------- sans IndexedDB : ancien format (base64 dans la clé « photos ») ----------
function kvList() { try { const a = JSON.parse(sget('photos') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function kvSave(list) { sset('photos', JSON.stringify(list)); }

// ---------- démarrage ----------
export async function initPhotos() {
  for (const it of items.values()) if (it.url && it.url.startsWith('blob:')) URL.revokeObjectURL(it.url);
  items.clear();
  if (getBackend() === 'idb') {
    const recs = await reqP(getDB().transaction('photos', 'readonly').objectStore('photos').getAll());
    for (const rec of recs) items.set(rec.id, { rec, url: rec.del ? '' : urlFor(rec) });
  } else {
    kvList().forEach((p, i) => {
      const id = p.id || 'k' + i;
      items.set(id, { rec: { id, d: p.d, t: 0, del: false }, url: p.img });
    });
  }
  ready = true;
}

// Liste affichée par l'app : [{ id, d, img }] triée par date.
export function photosAll() {
  return [...items.values()].filter((x) => !x.rec.del).map((x) => ({ id: x.rec.id, d: x.rec.d, img: x.url }))
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
}

async function putRecs(recs) {
  const db = getDB();
  try {
    await tx(db, 'photos', 'readwrite', (s) => { for (const r of recs) s.put(r); });
  } catch (e) {
    // certains navigateurs refusent les fichiers dans IndexedDB : on passe par un ArrayBuffer
    const conv = [];
    for (const r of recs) {
      if (r.blob) { const { blob, ...rest } = r; conv.push({ ...rest, buf: await blob.arrayBuffer(), type: blob.type || 'image/jpeg' }); }
      else conv.push(r);
    }
    await tx(db, 'photos', 'readwrite', (s) => { for (const r of conv) s.put(r); });
  }
}

async function deleteRecs(ids) {
  await tx(getDB(), 'photos', 'readwrite', (s) => { for (const id of ids) s.delete(id); });
}

// Ajoute une photo (Blob JPEG). Renvoie { id, d, img } ou l'existante si déjà présente.
export async function addPhoto(blob, d = today(), { source = 'local', synced = null } = {}) {
  if (getBackend() !== 'idb') {
    const img = await blobToDataUrl(blob);
    const id = await photoIdFor(blob);
    const list = kvList(); if (!list.some((p) => p.id === id)) { list.push({ id, d, img }); kvSave(list); }
    items.set(id, { rec: { id, d, t: Date.now(), del: false }, url: img });
    emit(source);
    return { id, d, img };
  }
  const id = await photoIdFor(blob);
  const prev = items.get(id);
  if (prev && !prev.rec.del) return { id, d: prev.rec.d, img: prev.url };
  const rec = { id, d, t: Date.now(), blob, type: blob.type || 'image/jpeg', size: blob.size, del: false,
    dirty: synced ? false : true, rev: synced ? synced.rev : (prev ? prev.rec.rev || 0 : 0) };
  await putRecs([rec]);
  const url = urlFor(rec);
  items.set(id, { rec, url });
  emit(source);
  return { id, d, img: url };
}

export async function removePhoto(id, { source = 'local' } = {}) {
  const it = items.get(id);
  if (!it || it.rec.del) return;
  if (getBackend() !== 'idb') {
    kvSave(kvList().filter((p) => (p.id || '') !== id));
    items.delete(id);
    emit(source);
    return;
  }
  if (it.url && it.url.startsWith('blob:')) URL.revokeObjectURL(it.url);
  if (source === 'local' && (it.rec.rev || 0) > 0) {
    // déjà sur le serveur : on garde une trace pour propager la suppression
    const rec = { id, d: it.rec.d, t: Date.now(), del: true, dirty: true, rev: it.rec.rev };
    await putRecs([rec]);
    items.set(id, { rec, url: '' });
  } else {
    await deleteRecs([id]);
    items.delete(id);
  }
  emit(source);
}

// Remplace toutes les photos (restauration d'une sauvegarde). list : [{ d, img(dataURL), id? }]
export async function replaceAllPhotos(list) {
  const keep = new Set();
  let n = 0;
  for (const p of list) {
    const blob = p.img && dataUrlToBlob(p.img);
    if (!blob) continue;
    const ph = await addPhoto(blob, p.d || today(), { source: 'import' });
    keep.add(ph.id); n++;
  }
  for (const [id, it] of [...items]) if (!it.rec.del && !keep.has(id)) await removePhoto(id, { source: 'local' });
  emit('import');
  return n;
}

// Reprise de l'ancien format (valeur « photos » de localStorage). Appelé avant que l'app démarre.
export async function importLegacyPhotos(json) {
  let list; try { list = JSON.parse(json); } catch (e) { return 0; }
  if (!Array.isArray(list)) return 0;
  const recs = [];
  const ids = new Set();
  for (const p of list) {
    const blob = p && p.img && dataUrlToBlob(p.img);
    if (!blob) continue;
    const id = await photoIdFor(blob);
    if (ids.has(id)) continue;
    ids.add(id);
    recs.push({ id, d: String(p.d || today()), t: Date.now(), blob, type: blob.type || 'image/jpeg', size: blob.size, del: false, dirty: true, rev: 0 });
  }
  if (recs.length) await putRecs(recs);
  return recs.length;
}

// Format de sauvegarde (identique à l'ancienne app) : JSON [{ d, img: dataURL, id }]
export async function photosToLegacyJSON() {
  const out = [];
  for (const { rec, url } of items.values()) {
    if (rec.del) continue;
    if (getBackend() !== 'idb') { out.push({ d: rec.d, img: url, id: rec.id }); continue; }
    const b = blobOf(rec);
    if (b) out.push({ d: rec.d, img: await blobToDataUrl(b), id: rec.id });
  }
  out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return JSON.stringify(out);
}

// ---------- pour la synchronisation ----------
export function photoRecords() { return [...items.values()].map((x) => x.rec); }
export function photoBlob(id) { const it = items.get(id); return it ? blobOf(it.rec) : null; }
export async function markPhotoSynced(id, rev) {
  const it = items.get(id); if (!it) return;
  if (it.rec.del) { await deleteRecs([id]); items.delete(id); return; }
  const rec = { ...it.rec, dirty: false, rev };
  await putRecs([rec]);
  items.set(id, { rec, url: it.url });
}
export async function markAllPhotosUnsynced() {
  const recs = [];
  for (const [id, it] of [...items]) {
    if (it.rec.del) { await deleteRecs([id]); items.delete(id); continue; }
    const rec = { ...it.rec, dirty: true, rev: 0 }; items.set(id, { rec, url: it.url }); recs.push(rec);
  }
  if (recs.length && getBackend() === 'idb') await putRecs(recs);
}
export function photosReady() { return ready; }
