import { describe, it, expect } from 'vitest';
import { newDevice, useDevice } from './setup.js';
import * as S from '../../src/core/storage.js';
import * as Ph from '../../src/core/photos.js';
import { startSync, syncNow, sync, clearRemoteChanged, setPhotoBackup, snapshotInfo, pendingCount } from '../../src/core/sync.js';
import { memoryServer } from './memory-remote.js';

const J = JSON.stringify, P = JSON.parse;
const SEED = J([{ id: 'f1', n: 'Skyr nature', k: 95 }, { id: 'f2', n: 'Fromage blanc', k: 47 }]);
const IMG = (s) => new Blob([Buffer.from('\xff\xd8\xff\xe0' + s, 'latin1')], { type: 'image/jpeg' });

// Démarre « l'app » sur l'appareil courant : stockage, photos, valeurs par défaut écrites
// par l'ancien code au démarrage (bibliothèque d'aliments de départ).
async function open(dev) {
  useDevice(dev);
  S.__resetForTests();
  await S.initStorage({ onLegacyPhotos: Ph.importLegacyPhotos });
  await Ph.initPhotos();
  if (!S.sget('foodlib')) S.sset('foodlib', SEED);
  clearRemoteChanged();
}
async function connect(server, uid = 'u1') { await startSync(server.remote(uid), uid); }
async function run(dev, server, fn) {
  await open(dev);
  await connect(server);
  if (fn) await fn();
  await syncNow();
  await S.flushStorage();
  return sync;
}

describe('synchronisation entre appareils', () => {
  it('premier appareil : tout part sur le serveur, sauf la clé IA et le brouillon', async () => {
    const server = memoryServer();
    const A = newDevice();
    localStorage.setItem('bodylog', J([{ d: '2026-10-01', w: 78 }]));
    localStorage.setItem('profile', J({ firstName: 'Alex' }));
    localStorage.setItem('ai:key', 'sk-ant-secret');
    localStorage.setItem('onb:draft', '{"i":1}');
    const st = await run(A, server);
    expect(st.state).toBe('idle');
    expect([...server.kv.keys()].sort()).toEqual(['bodylog', 'foodlib', 'profile']);
    expect(pendingCount()).toBe(0);
  });

  it('nouvel appareil : reprend les données du compte telles quelles', async () => {
    const server = memoryServer();
    const A = newDevice();
    await run(A, server, () => {
      S.sset('foodlib', J([{ id: 'f1', n: 'Skyr nature', k: 90 }, { id: 'c9', n: 'Bowl', k: 600 }]));   // f2 supprimé, f1 modifié
      S.sset('onb:done', '1');
      S.sset('fitweek:2026-W43', J({ swim: [true, false] }));
    });
    const B = newDevice();
    await run(B, server);
    expect(P(S.sget('foodlib'))).toEqual([{ id: 'f1', n: 'Skyr nature', k: 90 }, { id: 'c9', n: 'Bowl', k: 600 }]);   // pas de retour des aliments de départ
    expect(S.sget('onb:done')).toBe('1');
    expect(S.sget('fitweek:2026-W43')).toBe(J({ swim: [true, false] }));
    expect(sync.firstPull).toBe(true);
    expect(snapshotInfo()).toBe(null);                       // rien à protéger sur un téléphone neuf
  });

  it('modifications hors ligne des deux côtés : rien n’est perdu', async () => {
    const server = memoryServer();
    const A = newDevice(), B = newDevice();
    await run(A, server, () => { S.sset('onb:done', '1'); S.sset('foodlog', J({ '2026-10-20': [{ fid: 'f1', q: 1 }] })); });
    await run(B, server);
    // A ajoute un repas aujourd'hui, B aussi (autre aliment), chacun sans réseau
    await open(A); await connect(server); server.offline = true;
    S.sset('foodlog', J({ '2026-10-20': [{ fid: 'f1', q: 1 }], '2026-10-21': [{ fid: 'f4', q: 2 }] }));
    S.sset('bodylog', J([{ d: '2026-10-21', w: 77 }]));
    await syncNow();
    expect(sync.state).toBe('offline');
    expect(sync.pending).toBe(2);
    await S.flushStorage();
    await open(B); await connect(server);
    S.sset('foodlog', J({ '2026-10-20': [{ fid: 'f1', q: 1 }], '2026-10-21': [{ fid: 'f9', q: 1 }] }));
    S.sset('calbase', '2600');
    await S.flushStorage();
    // le réseau revient : B puis A synchronisent
    server.offline = false;
    await syncNow(); await S.flushStorage();
    await run(A, server);
    const fa = P(S.sget('foodlog'));
    expect(fa['2026-10-21']).toEqual([{ fid: 'f4', q: 2 }, { fid: 'f9', q: 1 }]);
    expect(S.sget('calbase')).toBe('2600');
    expect(P(S.sget('bodylog'))).toEqual([{ d: '2026-10-21', w: 77 }]);
    await run(B, server);
    expect(P(S.sget('foodlog'))).toEqual(fa);
    expect(P(S.sget('bodylog'))).toEqual([{ d: '2026-10-21', w: 77 }]);
    // tout le monde est d'accord avec le serveur
    expect(P(server.kv.get('foodlog').value)).toEqual(fa);
  });

  it('même valeur modifiée des deux côtés : la plus récente gagne', async () => {
    const server = memoryServer();
    const A = newDevice(), B = newDevice();
    await run(A, server, () => { S.sset('onb:done', '1'); S.sset('calbase', '2400'); });
    await run(B, server);
    await open(A); await connect(server); S.sset('calbase', '2500'); await S.flushStorage();
    await new Promise((r) => setTimeout(r, 15));
    await open(B); await connect(server); S.sset('calbase', '2650'); await S.flushStorage();
    await run(A, server);                                  // A envoie 2500 en premier
    await run(B, server);                                  // B, modifié plus tard, l'emporte
    expect(S.sget('calbase')).toBe('2650');
    await run(A, server);
    expect(S.sget('calbase')).toBe('2650');
  });

  it('une suppression se propage aux autres appareils', async () => {
    const server = memoryServer();
    const A = newDevice(), B = newDevice();
    await run(A, server, () => { S.sset('onb:done', '1'); S.sset('coach:event', J({ text: 'Go' })); });
    await run(B, server);
    expect(S.sget('coach:event')).not.toBe(null);
    await run(A, server, () => { S.sdel('coach:event'); });
    expect(server.kv.get('coach:event').deleted).toBe(true);
    await run(B, server);
    expect(S.sget('coach:event')).toBe(null);
    expect(S.skeys()).not.toContain('coach:event');
  });

  it('téléphone avec ses propres données + compte existant : fusion, et copie de sécurité', async () => {
    const server = memoryServer();
    const A = newDevice(), B = newDevice();
    await run(A, server, () => { S.sset('onb:done', '1'); S.sset('bodylog', J([{ d: '2026-10-01', w: 78 }])); });
    useDevice(B); localStorage.setItem('bodylog', J([{ d: '2026-09-15', w: 79 }])); localStorage.setItem('fitweek:2026-W38', J({ swim: [true, true] }));
    await run(B, server);
    expect(P(S.sget('bodylog')).map((x) => x.d)).toEqual(['2026-09-15', '2026-10-01']);
    expect(S.sget('fitweek:2026-W38')).not.toBe(null);
    expect(snapshotInfo()).not.toBe(null);
    await run(A, server);
    expect(P(S.sget('bodylog')).map((x) => x.d)).toEqual(['2026-09-15', '2026-10-01']);
  });

  it('une écriture de l’app pendant l’envoi n’est pas perdue', async () => {
    const server = memoryServer();
    const A = newDevice();
    await open(A); await connect(server);
    S.sset('onb:done', '1');
    const remote = server.remote('u1');
    const push = remote.pushKv;
    // l'app modifie la valeur pendant que l'envoi est en cours
    await startSync({ ...remote, pushKv: async (items) => { S.sset('calbase', '2700'); return push(items); } }, 'u1');
    S.sset('calbase', '2500');
    await syncNow();
    expect(S.recordOf('calbase').dirty).toBe(true);
    await startSync(remote, 'u1');
    await syncNow();
    expect(server.kv.get('calbase').value).toBe('2700');
  });

  it('photos : sauvegarde activée sur un appareil, retrouvées et supprimées sur l’autre', async () => {
    const server = memoryServer();
    const A = newDevice(), B = newDevice();
    let id;
    await run(A, server, async () => {
      S.sset('onb:done', '1');
      id = (await Ph.addPhoto(IMG('photo-1'), '2026-10-02')).id;
      await Ph.addPhoto(IMG('photo-2'), '2026-10-09');
    });
    expect(server.objects.size).toBe(0);                    // pas activée : rien ne part
    await open(A); await connect(server); await setPhotoBackup(true); await S.flushStorage();
    expect(server.objects.size).toBe(2);
    await run(B, server);
    expect(Ph.photosAll().map((p) => p.d)).toEqual(['2026-10-02', '2026-10-09']);
    await run(B, server, async () => { await Ph.removePhoto(id); });
    expect(server.photos.get(id).deleted).toBe(true);
    expect(server.objects.size).toBe(1);
    await run(A, server);
    expect(Ph.photosAll().map((p) => p.d)).toEqual(['2026-10-09']);
  });

  it('un autre compte sur le même téléphone repart de zéro côté synchro', async () => {
    const s1 = memoryServer(), s2 = memoryServer();
    const A = newDevice();
    await run(A, s1, () => { S.sset('onb:done', '1'); });
    await open(A); await startSync(s2.remote('u2'), 'u2'); await syncNow();
    expect([...s2.kv.keys()]).toContain('onb:done');        // les données du téléphone partent vers le nouveau compte
  });
});
