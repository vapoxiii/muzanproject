// Serveur simulé en mémoire, avec les mêmes règles que supabase/migrations (kv_push,
// révisions croissantes, photos). Sert aux tests de synchronisation entre « appareils ».
import { PAGE } from '../../src/core/sync.js';

export function memoryServer() {
  const server = { seq: 0, kv: new Map(), photos: new Map(), objects: new Map(), offline: false, calls: 0 };
  const now = () => new Date(Date.now()).toISOString();
  const guard = () => { server.calls++; if (server.offline) { const e = new Error('Failed to fetch'); throw e; } };
  server.remote = (userId) => ({
    async pullKv(since) {
      guard();
      return [...server.kv.values()].filter((r) => r.rev > since).sort((a, b) => a.rev - b.rev).slice(0, PAGE).map((r) => ({ ...r }));
    },
    async pushKv(items) {
      guard();
      return items.map((it) => {
        const cur = server.kv.get(it.key);
        const base = it.base_rev || 0;
        if (!cur) {
          if (base !== 0) return { key: it.key, status: 'conflict', row: null };
          const row = { key: it.key, value: it.deleted ? null : it.value, deleted: !!it.deleted, rev: ++server.seq, t: it.t || 0, updated_at: now() };
          server.kv.set(it.key, row);
          return { key: it.key, status: 'ok', rev: row.rev };
        }
        if (cur.rev !== base) return { key: it.key, status: 'conflict', row: { value: cur.value, deleted: cur.deleted, rev: cur.rev, t: cur.t, updated_at: cur.updated_at } };
        Object.assign(cur, { value: it.deleted ? null : it.value, deleted: !!it.deleted, rev: ++server.seq, t: it.t || 0, updated_at: now() });
        return { key: it.key, status: 'ok', rev: cur.rev };
      });
    },
    async pullPhotos(since) {
      guard();
      return [...server.photos.values()].filter((r) => r.rev > since).sort((a, b) => a.rev - b.rev).slice(0, PAGE).map((r) => ({ ...r }));
    },
    async pushPhoto(meta) {
      guard();
      const row = { id: meta.id, d: meta.d, deleted: !!meta.deleted, bytes: meta.bytes || 0, rev: ++server.seq, updated_at: now() };
      server.photos.set(meta.id, row);
      return { rev: row.rev };
    },
    async upload(id, blob) { guard(); server.objects.set(`${userId}/${id}.jpg`, blob); },
    async download(id) { guard(); const b = server.objects.get(`${userId}/${id}.jpg`); if (!b) throw new Error('Object not found'); return b; },
    async removeObject(id) { guard(); server.objects.delete(`${userId}/${id}.jpg`); },
    async purgePhotos() { guard(); for (const k of [...server.objects.keys()]) if (k.startsWith(userId + '/')) server.objects.delete(k); server.photos.clear(); },
  });
  return server;
}
