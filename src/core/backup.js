// Sauvegarde dans un fichier : même format que l'ancienne app (format 1), donc un fichier
// exporté par l'ancienne version se restaure ici, et inversement.
//   { app: 'muzan-suivi', format: 1, exportedAt, count, data: { clé: valeur texte } }
// Les photos sont dans data.photos (JSON [{ d, img: dataURL }]) comme avant.
// La clé IA personnelle n'est jamais incluse.

import { sget, sset, sdel, skeys, flushStorage } from './storage.js';
import { photosToLegacyJSON, replaceAllPhotos } from './photos.js';

export const BK_SKIP = new Set(['ai:key', '__t__']);

export function backupKeys() {
  return skeys().filter((k) => !BK_SKIP.has(k) && k !== 'photos').sort();
}

export async function buildBackup() {
  const data = {};
  for (const k of backupKeys()) { const v = sget(k); if (v != null) data[k] = v; }
  const photos = await photosToLegacyJSON();
  if (photos !== '[]') data.photos = photos;
  const keys = Object.keys(data).sort();
  const sorted = {}; for (const k of keys) sorted[k] = data[k];
  return { app: 'muzan-suivi', format: 1, exportedAt: new Date().toISOString(), count: keys.length, data: sorted };
}

export function parseBackup(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { const er = new Error('unreadable'); er.code = 'unreadable'; throw er; }
  if (!o || o.app !== 'muzan-suivi' || typeof o.data !== 'object' || !o.data) { const er = new Error('foreign'); er.code = 'foreign'; throw er; }
  const keys = Object.keys(o.data).filter((k) => !BK_SKIP.has(k) && typeof o.data[k] === 'string');
  return { o, keys };
}

// Remplace les données actuelles par celles de la sauvegarde. Attend l'écriture sur disque.
export async function restoreBackup({ o, keys }) {
  for (const k of backupKeys()) sdel(k);
  let photos = 0;
  for (const k of keys) {
    if (k === 'photos') continue;
    sset(k, o.data[k]);
  }
  if (typeof o.data.photos === 'string') {
    let list = []; try { list = JSON.parse(o.data.photos); } catch (e) { list = []; }
    photos = await replaceAllPhotos(Array.isArray(list) ? list : []);
  } else {
    photos = await replaceAllPhotos([]);
  }
  await flushStorage();
  return { keys: keys.length, photos };
}

export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return blob.size;
}
