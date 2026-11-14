import { describe, it, expect, beforeEach } from 'vitest';
import { newDevice } from './setup.js';
import * as S from '../../src/core/storage.js';
import * as Ph from '../../src/core/photos.js';
import { buildBackup, parseBackup, restoreBackup } from '../../src/core/backup.js';

const JPEG = 'data:image/jpeg;base64,' + Buffer.from('\xff\xd8\xff\xe0 fausse image jpeg 1', 'latin1').toString('base64');
const JPEG2 = 'data:image/jpeg;base64,' + Buffer.from('\xff\xd8\xff\xe0 fausse image jpeg 2', 'latin1').toString('base64');

async function boot() {
  S.__resetForTests();
  await S.initStorage({ onLegacyPhotos: Ph.importLegacyPhotos });
  await Ph.initPhotos();
}

describe('stockage local', () => {
  beforeEach(() => { newDevice(); });

  it('reprend les données de l’ancienne app au premier démarrage', async () => {
    localStorage.setItem('bodylog', '[{"d":"2026-10-01","w":78}]');
    localStorage.setItem('fitweek:2026-W43', '{"swim":[true,false]}');
    localStorage.setItem('ai:key', 'sk-ant-xyz');
    localStorage.setItem('photos', JSON.stringify([{ d: '2026-10-02', img: JPEG }, { d: '2026-10-03', img: JPEG2 }, { d: '2026-10-03', img: JPEG2 }]));
    localStorage.setItem('sb-abc-auth-token', 'jeton');
    localStorage.setItem('ms-auth', 'session');
    localStorage.setItem('__t__', '1');
    await boot();
    expect(S.getBackend()).toBe('idb');
    expect(S.sget('bodylog')).toBe('[{"d":"2026-10-01","w":78}]');
    expect(S.sget('fitweek:2026-W43')).toBe('{"swim":[true,false]}');
    expect(S.sget('ai:key')).toBe('sk-ant-xyz');
    expect(S.sget('photos')).toBe(null);
    expect(S.sget('sb-abc-auth-token')).toBe(null);
    expect(S.sget('ms-auth')).toBe(null);
    expect(S.recordOf('bodylog').dirty).toBe(true);
    expect(S.recordOf('ai:key').dirty).toBe(false);
    const photos = Ph.photosAll();
    expect(photos).toHaveLength(2);                       // doublon écarté
    expect(photos.map((p) => p.d)).toEqual(['2026-10-02', '2026-10-03']);
    expect(S.getSys('migratedFromLS')).toMatchObject({ keys: 3, photos: 2 });
    // localStorage n'est pas effacé
    expect(localStorage.getItem('bodylog')).not.toBe(null);
  });

  it('ne reprend qu’une fois, puis lit IndexedDB', async () => {
    localStorage.setItem('calbase', '2400');
    await boot();
    S.sset('calbase', '2500');
    await S.flushStorage();
    localStorage.setItem('calbase', '9999');                // l'ancienne app aurait écrit après coup
    await boot();
    expect(S.sget('calbase')).toBe('2500');
  });

  it('écrit, supprime, liste, et retrouve tout au démarrage suivant', async () => {
    await boot();
    S.sset('foodlog', '{}');
    S.sset('dayact', '{"x":1}');
    S.sset('onb:draft', '{"i":2}');
    S.sdel('onb:draft');
    expect(S.skeys().sort()).toEqual(['dayact', 'foodlog']);
    await S.flushStorage();
    await boot();
    expect(S.skeys().sort()).toEqual(['dayact', 'foodlog']);
    expect(S.sget('dayact')).toBe('{"x":1}');
    expect(S.sget('onb:draft')).toBe(null);
  });

  it('une écriture faite à partir d’une lecture périmée est fusionnée, pas écrasée', async () => {
    await boot();
    S.sset('bodylog', JSON.stringify([{ d: '2026-10-01', w: 78 }]));
    const lu = JSON.parse(S.sget('bodylog'));             // l'app garde ce tableau en mémoire
    // la synchro apporte une mesure faite sur un autre appareil
    S.putRecord('bodylog', { v: JSON.stringify([{ d: '2026-10-01', w: 78 }, { d: '2026-10-08', w: 77.5 }]), base: null, rev: 3, dirty: false });
    // l'app ajoute sa mesure à son tableau périmé et l'enregistre
    lu.push({ d: '2026-10-15', w: 77 });
    S.sset('bodylog', JSON.stringify(lu));
    // (recordOf lit le stockage sans compter comme une lecture de l'app)
    expect(JSON.parse(S.recordOf('bodylog').v).map((x) => x.d)).toEqual(['2026-10-01', '2026-10-08', '2026-10-15']);
    // et l'écriture suivante, toujours depuis le tableau en mémoire, ne perd rien non plus
    lu.push({ d: '2026-10-22', w: 76.8 });
    S.sset('bodylog', JSON.stringify(lu));
    expect(JSON.parse(S.recordOf('bodylog').v).map((x) => x.d)).toEqual(['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22']);
  });

  it('sans IndexedDB : retombe sur localStorage, comme avant', async () => {
    const saved = globalThis.indexedDB;
    globalThis.indexedDB = undefined;
    try {
      localStorage.setItem('calbase', '2300');
      await boot();
      expect(S.getBackend()).toBe('ls');
      expect(S.sget('calbase')).toBe('2300');
      S.sset('calbase', '2450');
      await S.flushStorage();
      expect(localStorage.getItem('calbase')).toBe('2450');
      await Ph.addPhoto(Ph.dataUrlToBlob(JPEG), '2026-10-05');
      await S.flushStorage();
      expect(JSON.parse(localStorage.getItem('photos'))[0].img).toBe(JPEG);
    } finally { globalThis.indexedDB = saved; }
  });

  it('sauvegarde : même format que l’ancienne app, clé IA exclue, photos incluses', async () => {
    localStorage.setItem('ai:key', 'sk-ant-secret');
    localStorage.setItem('bodylog', '[]');
    localStorage.setItem('photos', JSON.stringify([{ d: '2026-10-02', img: JPEG }]));
    await boot();
    const out = await buildBackup();
    expect(out).toMatchObject({ app: 'muzan-suivi', format: 1, count: 2 });
    expect(out.data['ai:key']).toBeUndefined();
    expect(JSON.parse(out.data.photos)[0]).toMatchObject({ d: '2026-10-02', img: JPEG });
    // restauration sur un autre appareil
    newDevice();
    await boot();
    S.sset('calbase', '2000');
    const r = await restoreBackup(parseBackup(JSON.stringify(out)));
    expect(r.photos).toBe(1);
    expect(S.sget('calbase')).toBe(null);                  // les données d'avant sont remplacées
    expect(S.sget('bodylog')).toBe('[]');
    expect(Ph.photosAll()).toHaveLength(1);
    expect(() => parseBackup('{"app":"autre","data":{}}')).toThrow();
  });
});
