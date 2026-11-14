// Environnement des tests unitaires (Node) : IndexedDB simulé, localStorage et FileReader
// minimalistes. Chaque « appareil » simulé a sa propre base et son propre localStorage.
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';

class MemoryStorage {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(String(k), String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

class FileReaderShim {
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`;
      this.onload && this.onload();
    }, (e) => { this.error = e; this.onerror && this.onerror(); });
  }
  readAsText(blob) {
    blob.text().then((t) => { this.result = t; this.onload && this.onload(); });
  }
}
globalThis.FileReader = globalThis.FileReader || FileReaderShim;

// Bascule vers un autre appareil (nouvelle base, nouveau localStorage)
export function newDevice() {
  const dev = { idb: new IDBFactory(), ls: new MemoryStorage() };
  useDevice(dev);
  return dev;
}
export function useDevice(dev) {
  globalThis.indexedDB = dev.idb;
  globalThis.localStorage = dev.ls;
}
newDevice();
