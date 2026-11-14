// Accès au serveur (Supabase) pour la synchronisation. Même interface que
// tests/unit/memory-remote.js, qui sert aux tests.

import { PAGE } from './sync.js';

function check({ data, error }) {
  if (error) { const e = new Error(error.message || String(error)); e.code = error.code; e.status = error.status; throw e; }
  return data;
}

export function supabaseRemote(client, userId) {
  const bucket = () => client.storage.from('photos');
  const path = (id) => `${userId}/${id}.jpg`;
  return {
    async pullKv(since) {
      return check(await client.from('kv').select('key,value,deleted,rev,t,updated_at').gt('rev', since).order('rev', { ascending: true }).limit(PAGE));
    },
    async pushKv(items) {
      return check(await client.rpc('kv_push', { items }));
    },
    async pullPhotos(since) {
      return check(await client.from('photos').select('id,d,deleted,rev,updated_at,bytes').gt('rev', since).order('rev', { ascending: true }).limit(PAGE));
    },
    async pushPhoto(meta) {
      const rows = check(await client.from('photos').upsert({ id: meta.id, d: meta.d, deleted: !!meta.deleted, bytes: meta.bytes || 0 }, { onConflict: 'user_id,id' }).select('rev'));
      return rows && rows[0] ? rows[0] : { rev: 0 };
    },
    async upload(id, blob) {
      check(await bucket().upload(path(id), blob, { upsert: true, contentType: blob.type || 'image/jpeg', cacheControl: '31536000' }));
    },
    async download(id) {
      return check(await bucket().download(path(id)));
    },
    async removeObject(id) {
      check(await bucket().remove([path(id)]));
    },
    async purgePhotos() {
      const listed = check(await bucket().list(userId, { limit: 1000 }));
      const names = (listed || []).map((o) => `${userId}/${o.name}`);
      if (names.length) check(await bucket().remove(names));
      check(await client.rpc('photos_purge'));
    },
  };
}
