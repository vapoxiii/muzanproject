// Migration Supabase sur un vrai PostgreSQL : droits, isolation entre comptes, envoi avec
// contrôle de version, quota d'analyses IA. Nécessite MS_PG (sinon ignoré).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PG_URL, freshDatabase, as, migrationSQL } from '../stack/db.js';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

describe.skipIf(!PG_URL)('base de données (migration)', () => {
  let db;
  beforeAll(async () => {
    ({ db } = await freshDatabase('ms_sql_test'));
    await db.query(`insert into auth.users (id, email) values ($1, 'un@exemple.fr'), ($2, 'deux@exemple.fr')`, [U1, U2]);
  });
  afterAll(async () => { await db?.end(); });

  const push = (sub, items) => as(db, 'authenticated', sub, (c) => c.query('select public.kv_push($1::jsonb) as r', [JSON.stringify(items)]).then((x) => x.rows[0].r));
  const rows = (sub, sql, args = []) => as(db, 'authenticated', sub, (c) => c.query(sql, args).then((x) => x.rows));

  it('un profil « free » est créé avec chaque compte', async () => {
    const r = await db.query('select id, plan from public.profiles order by id');
    expect(r.rows).toEqual([{ id: U1, plan: 'free' }, { id: U2, plan: 'free' }]);
  });

  it('envoi : création, contrôle de version, suppression', async () => {
    const [a] = await push(U1, [{ key: 'bodylog', value: '[]', base_rev: 0, t: 1000 }]);
    expect(a).toMatchObject({ key: 'bodylog', status: 'ok' });
    // même clé « neuve » envoyée par un autre appareil : conflit, avec la version du serveur
    const [b] = await push(U1, [{ key: 'bodylog', value: '[1]', base_rev: 0, t: 1100 }]);
    expect(b.status).toBe('conflict');
    expect(b.row).toMatchObject({ value: '[]', deleted: false, rev: a.rev, t: 1000 });
    // mise à jour depuis la bonne révision
    const [c] = await push(U1, [{ key: 'bodylog', value: '[2]', base_rev: a.rev, t: 1200 }]);
    expect(c.status).toBe('ok');
    expect(c.rev).toBeGreaterThan(a.rev);
    // révision périmée
    const [d] = await push(U1, [{ key: 'bodylog', value: '[3]', base_rev: a.rev }]);
    expect(d).toMatchObject({ status: 'conflict', row: { value: '[2]', rev: c.rev } });
    // l'appareil croit la ligne existante alors qu'elle n'existe pas
    const [e] = await push(U1, [{ key: 'inconnue', value: 'x', base_rev: 99 }]);
    expect(e).toMatchObject({ status: 'conflict', row: null });
    // suppression
    const [f] = await push(U1, [{ key: 'bodylog', deleted: true, base_rev: c.rev, value: 'ignoré' }]);
    expect(f.status).toBe('ok');
    const r = await rows(U1, `select value, deleted from public.kv where key = 'bodylog'`);
    expect(r).toEqual([{ value: null, deleted: true }]);
  });

  it('chacun ne voit et ne modifie que ses données', async () => {
    await push(U1, [{ key: 'profile', value: '{"firstName":"Un"}', base_rev: 0 }]);
    expect(await rows(U2, 'select key from public.kv')).toEqual([]);
    const upd = await rows(U2, `update public.kv set value = 'pirate' where user_id = $1 returning key`, [U1]);
    expect(upd).toEqual([]);
    await expect(rows(U2, `insert into public.kv (user_id, key, value) values ($1, 'x', 'y')`, [U1])).rejects.toThrow(/row-level security/);
    await expect(rows(U1, `delete from public.kv where key = 'profile'`)).rejects.toThrow(/permission denied/);
    await expect(as(db, 'anon', null, (c) => c.query('select * from public.kv'))).rejects.toThrow(/permission denied/);
    expect((await rows(U1, 'select key from public.kv order by key')).map((x) => x.key)).toContain('profile');
  });

  it('la révision et la date sont fixées par le serveur', async () => {
    await rows(U1, `insert into public.kv (key, value, rev) values ('triche', 'x', 999999999)`);
    const [r] = await rows(U1, `select rev from public.kv where key = 'triche'`);
    expect(Number(r.rev)).toBeLessThan(999999999);
  });

  it('quota IA : 3 par jour en gratuit, remboursement, offres Pro et Pro+', async () => {
    await expect(as(db, 'authenticated', U1, (c) => c.query('select public.ai_consume($1)', [U1]))).rejects.toThrow(/permission denied/);
    await expect(as(db, 'authenticated', U1, (c) => c.query('select public.ai_refund($1, current_date)', [U1]))).rejects.toThrow(/permission denied/);
    const consume = (u) => as(db, 'service_role', null, (c) => c.query('select public.ai_consume($1) as r', [u]).then((x) => x.rows[0].r));
    const used = [];
    for (let i = 0; i < 4; i++) used.push(await consume(U1));
    expect(used.map((x) => [x.ok, x.used, x.limit])).toEqual([[true, 1, 3], [true, 2, 3], [true, 3, 3], [false, 3, 3]]);
    await as(db, 'service_role', null, (c) => c.query('select public.ai_refund($1, $2::date)', [U1, used[0].day]));
    expect((await consume(U1)).ok).toBe(true);
    // le profil ne peut pas être modifié par l'utilisateur
    await expect(rows(U1, `update public.profiles set plan = 'pro_plus' where id = $1`, [U1])).rejects.toThrow(/permission denied/);
    await db.query(`update public.profiles set plan = 'pro' where id = $1`, [U2]);
    let last; for (let i = 0; i < 21; i++) last = await consume(U2);
    expect([last.ok, last.used, last.limit]).toEqual([false, 20, 20]);
    await db.query(`update public.profiles set plan = 'pro_plus' where id = $1`, [U2]);
    const pp = await consume(U2);
    expect([pp.ok, pp.used, pp.limit]).toEqual([true, 21, null]);
    const st = await as(db, 'authenticated', U1, (c) => c.query('select public.account_status() as r').then((x) => x.rows[0].r));
    expect(st).toMatchObject({ plan: 'free', ai_used: 3, ai_limit: 3 });
  });

  it('consentement enregistré par l’utilisateur', async () => {
    await as(db, 'authenticated', U1, (c) => c.query(`select public.record_consent('2026-10-26')`));
    const r = await db.query('select consent_version, consent_at is not null as ok from public.profiles where id = $1', [U1]);
    expect(r.rows[0]).toEqual({ consent_version: '2026-10-26', ok: true });
  });

  it('photos : lignes et fichiers isolés par compte, purge', async () => {
    await rows(U1, `insert into public.photos (id, d, bytes) values ('p0123456789abcdef', '2026-10-02', 1234) on conflict (user_id, id) do update set d = excluded.d returning rev`);
    expect(await rows(U2, 'select id from public.photos')).toEqual([]);
    await expect(rows(U1, `insert into public.photos (id, d) values ('../../etc', '2026-10-02')`)).rejects.toThrow(/check constraint/);
    await rows(U1, `insert into storage.objects (bucket_id, name, data) values ('photos', $1, 'x')`, [`${U1}/p0123456789abcdef.jpg`]);
    await expect(rows(U1, `insert into storage.objects (bucket_id, name, data) values ('photos', $1, 'x')`, [`${U2}/intrus.jpg`])).rejects.toThrow(/row-level security/);
    expect(await rows(U2, 'select name from storage.objects')).toEqual([]);
    expect((await rows(U1, 'select name from storage.objects')).length).toBe(1);
    await as(db, 'authenticated', U1, (c) => c.query('select public.photos_purge()'));
    expect(await rows(U1, 'select id from public.photos')).toEqual([]);
  });

  it('supprimer le compte efface toutes ses lignes', async () => {
    await db.query('delete from auth.users where id = $1', [U1]);
    for (const t of ['kv', 'photos', 'ai_usage']) {
      const r = await db.query(`select count(*)::int as n from public.${t} where user_id = $1`, [U1]);
      expect(r.rows[0].n).toBe(0);
    }
    const p = await db.query('select count(*)::int as n from public.profiles where id = $1', [U1]);
    expect(p.rows[0].n).toBe(0);
  });

  it('la migration peut être rejouée sans rien casser', async () => {
    await db.query(migrationSQL());
    const r = await db.query('select count(*)::int as n from public.profiles');
    expect(r.rows[0].n).toBe(1);
  });

  it('refuse les envois trop gros', async () => {
    const many = Array.from({ length: 201 }, (_, i) => ({ key: 'k' + i, value: 'v', base_rev: 0 }));
    await expect(push(U2, many)).rejects.toThrow(/200/);
  });
});
