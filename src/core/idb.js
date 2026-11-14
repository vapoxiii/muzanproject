// Petites aides autour d'IndexedDB (promesses).

export const DB_NAME = 'mon-suivi';
export const DB_VERSION = 1;

export function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function openDB(name = DB_NAME) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) { reject(new Error('indexeddb-unavailable')); return; }
    let req;
    try { req = indexedDB.open(name, DB_VERSION); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'k' });
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sys')) db.createObjectStore('sys', { keyPath: 'k' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { try { db.close(); } catch (e) { /* rien */ } };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('indexeddb-open-failed'));
    req.onblocked = () => reject(new Error('indexeddb-blocked'));
  });
}

// Exécute fn(stores) dans une transaction et attend sa validation.
export function tx(db, names, mode, fn) {
  return new Promise((resolve, reject) => {
    let t, out;
    try { t = db.transaction(names, mode); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('transaction-aborted'));
    const stores = Array.isArray(names) ? Object.fromEntries(names.map((n) => [n, t.objectStore(n)])) : t.objectStore(names);
    try { out = fn(stores, t); } catch (e) { try { t.abort(); } catch (e2) { /* déjà terminée */ } reject(e); }
  });
}

export function getAll(store) { return reqP(store.getAll()); }
