// Migration du social sur un vrai PostgreSQL : pseudos, abonnements et demandes, stories visibles par les
// abonnés seulement, messages entre personnes qui se suivent mutuellement, blocages, bannissement,
// signalements, limites. Nécessite MS_PG (sinon ignoré).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PG_URL, freshDatabase, as } from '../stack/db.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';   // Alex, compte privé
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';   // Bea
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';   // Cam, ne suit personne
const D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';   // compte sans profil social

describe.skipIf(!PG_URL)('social (migration)', () => {
  let db;
  beforeAll(async () => {
    ({ db } = await freshDatabase('ms_social_test'));
    await db.query(`insert into auth.users (id, email) values ($1, 'a@x.fr'), ($2, 'b@x.fr'), ($3, 'c@x.fr'), ($4, 'd@x.fr')`, [A, B, C, D]);
  });
  afterAll(async () => { await db?.end(); });

  const q = (sub, sql, args = []) => as(db, 'authenticated', sub, (c) => c.query(sql, args).then((x) => x.rows));
  const one = async (sub, sql, args) => (await q(sub, sql, args))[0];
  const stories = (sub) => q(sub, 'select handle, kind, mine from public.social_stories()');
  const dm = (sub, to, body) => q(sub, `insert into public.messages (recipient, body) values ($1, $2) returning id`, [to, body]);

  it('profil : pseudo valide, unique, non réservé ; on ne crée que le sien', async () => {
    await q(A, `insert into public.social_profiles (handle, name) values ('alex', 'Alex')`);
    await q(B, `insert into public.social_profiles (handle, name) values ('bea_fit', 'Béa')`);
    await q(C, `insert into public.social_profiles (handle, name, is_public) values ('cam.run', 'Cam', true)`);
    await expect(q(D, `insert into public.social_profiles (handle) values ('alex')`)).rejects.toThrow(/duplicate|unique/);
    await expect(q(D, `insert into public.social_profiles (handle) values ('Ab')`)).rejects.toThrow(/check/);
    await expect(q(D, `insert into public.social_profiles (handle) values ('.point')`)).rejects.toThrow(/check/);
    await expect(q(D, `insert into public.social_profiles (handle) values ('grind')`)).rejects.toThrow(/réservé/);
    await expect(q(D, `insert into public.social_profiles (user_id, handle) values ($1, 'pirate')`, [A])).rejects.toThrow(/permission denied/);
    await expect(q(D, `update public.social_profiles set banned = false where user_id = $1`, [D])).rejects.toThrow(/permission denied/);
    // modifier le profil de quelqu'un d'autre : rien ne bouge
    expect(await q(D, `update public.social_profiles set name = 'pirate' where user_id = $1 returning 1`, [A])).toEqual([]);
    await expect(as(db, 'anon', null, (c) => c.query('select * from public.social_profiles'))).rejects.toThrow(/permission denied/);
  });

  it('suivre un compte privé : demande, invisible jusqu’à l’accord ; compte public : accepté d’office', async () => {
    expect(await q(B, `insert into public.follows (followee) values ($1) returning status`, [A])).toEqual([{ status: 'pending' }]);
    await q(A, `insert into public.stories (kind, data) values ('texte', '{"t":"Jour 1"}')`);
    expect(await stories(B)).toEqual([]);
    expect(await one(A, `select public.social_badges() as b`)).toEqual({ b: { unread: 0, requests: 1, stories: 0 } });
    // seule Alex peut accepter
    expect(await q(B, `update public.follows set status = 'accepted' where follower = $1 and followee = $2 returning 1`, [B, A])).toEqual([]);
    expect(await q(A, `update public.follows set status = 'accepted' where follower = $1 and followee = $2 returning status`, [B, A])).toEqual([{ status: 'accepted' }]);
    expect(await stories(B)).toEqual([{ handle: 'alex', kind: 'texte', mine: false }]);
    expect(await stories(C)).toEqual([]);                                     // Cam ne suit pas Alex
    expect(await q(A, `insert into public.follows (followee) values ($1) returning status`, [C])).toEqual([{ status: 'accepted' }]);
    // on ne peut pas inventer l'auteur d'un abonnement
    await expect(q(C, `insert into public.follows (follower, followee) values ($1, $2)`, [A, B])).rejects.toThrow(/permission denied/);
  });

  it('messages : seulement entre personnes qui se suivent l’une l’autre', async () => {
    await expect(dm(B, A, 'Salut')).rejects.toThrow(/row-level security/);   // Alex ne suit pas Béa
    expect(await q(A, `insert into public.follows (followee) values ($1) returning status`, [B])).toEqual([{ status: 'pending' }]);
    await expect(dm(B, A, 'Salut')).rejects.toThrow(/row-level security/);
    await q(B, `update public.follows set status = 'accepted' where follower = $1 and followee = $2`, [A, B]);
    const [m1] = await dm(B, A, '  Salut Alex  ');
    await dm(B, A, 'Tu fais Haut B ce soir ?');
    await expect(dm(B, A, '   ')).rejects.toThrow(/vide/);
    await expect(q(B, `insert into public.messages (recipient, kind, body) values ($1, 'carte', '')`, [A])).rejects.toThrow(/carte vide/);
    await expect(dm(C, A, 'spam')).rejects.toThrow(/row-level security/);    // Cam suit Alex qui le suit, mais…
    // … Alex suit Cam (public), Cam ne suit pas Alex : pas de message
    const inbox = await q(A, 'select handle, last_body, last_mine, unread, can_dm from public.social_inbox()');
    expect(inbox).toEqual([{ handle: 'bea_fit', last_body: 'Tu fais Haut B ce soir ?', last_mine: false, unread: 2, can_dm: true }]);
    expect((await q(A, 'select body, mine from public.social_thread($1)', [B])).map((m) => m.body)).toEqual(['Salut Alex', 'Tu fais Haut B ce soir ?']);
    expect(await q(C, 'select * from public.social_thread($1)', [B])).toEqual([]);   // pas sa conversation
    expect(await one(A, 'select public.social_mark_read($1) as n', [B])).toEqual({ n: 2 });
    expect((await one(A, 'select public.social_badges() as b')).b.unread).toBe(0);
    // retirer : seulement ses propres messages
    expect(await one(A, 'select public.social_delete_message($1) as ok', [m1.id])).toEqual({ ok: false });
    expect(await one(B, 'select public.social_delete_message($1) as ok', [m1.id])).toEqual({ ok: true });
    const [gone] = await q(A, 'select body, deleted from public.social_thread($1)', [B]);
    expect(gone).toEqual({ body: '', deleted: true });
    await expect(q(A, `update public.messages set body = 'x'`)).rejects.toThrow(/permission denied/);
  });

  it('recherche et fiche : pseudo ou nom, jokers neutralisés, ce qu’on a le droit de voir', async () => {
    expect((await q(C, `select handle, i_follow, follows_me from public.social_search('@BE')`))).toEqual([{ handle: 'bea_fit', i_follow: 'none', follows_me: 'none' }]);
    expect((await q(C, `select handle from public.social_search('%')`))).toEqual([]);
    expect((await q(C, `select handle from public.social_search('_')`))).toEqual([]);
    expect((await q(C, `select handle from public.social_search('béa')`)).map((r) => r.handle)).toEqual(['bea_fit']);
    const fa = (await one(C, `select public.social_profile('alex') as p`)).p;
    expect(fa).toMatchObject({ handle: 'alex', public: false, stats: null, followers: 1, following: 2, i_follow: 'none', follows_me: 'accepted', can_dm: false, stories: 0 });
    const fb = (await one(A, `select public.social_profile('bea_fit') as p`)).p;
    expect(fb).toMatchObject({ i_follow: 'accepted', follows_me: 'accepted', can_dm: true });
    const people = await q(A, 'select handle, i_follow, follows_me from public.social_people() order by handle');
    expect(people).toEqual([{ handle: 'bea_fit', i_follow: 'accepted', follows_me: 'accepted' }, { handle: 'cam.run', i_follow: 'accepted', follows_me: 'none' }]);
  });

  it('passer en public accepte les demandes en attente', async () => {
    await q(C, `insert into public.follows (followee) values ($1)`, [B]);
    expect(await one(C, `select status from public.follows where followee = $1`, [B])).toEqual({ status: 'pending' });
    await q(B, `update public.social_profiles set is_public = true`);
    expect(await one(C, `select status from public.follows where followee = $1`, [B])).toEqual({ status: 'accepted' });
    await q(B, `update public.social_profiles set is_public = false`);
  });

  it('bloquer : plus d’abonnement, plus de messages, plus de fiche ni de recherche', async () => {
    await q(A, `insert into public.blocks (blocked) values ($1)`, [B]);
    expect(await q(A, `select * from public.follows where follower = $1 or followee = $1`, [B])).toEqual([]);
    await expect(q(B, `insert into public.follows (followee) values ($1)`, [A])).rejects.toThrow(/blocage/);
    await expect(dm(B, A, 'ouvre')).rejects.toThrow(/row-level security/);
    expect(await one(B, `select public.social_profile('alex') as p`)).toEqual({ p: null });
    expect(await q(B, `select * from public.social_search('alex')`)).toEqual([]);
    expect(await q(A, 'select * from public.social_inbox()')).toEqual([]);
    expect(await q(A, 'select handle from public.social_blocked()')).toEqual([{ handle: 'bea_fit' }]);
    expect(await q(B, 'select * from public.blocks')).toEqual([]);               // Béa ne voit pas qu'elle est bloquée
    await q(A, `delete from public.blocks where blocked = $1`, [B]);
  });

  it('banni : plus de story, invisible des autres', async () => {
    await q(C, `insert into public.stories (kind, data) values ('rang', '{"rk":"B"}')`);
    expect((await stories(A)).map((s) => s.handle)).toEqual(['alex', 'cam.run']);
    await db.query(`update public.social_profiles set banned = true where user_id = $1`, [C]);
    expect((await stories(A)).map((s) => s.handle)).toEqual(['alex']);
    await expect(q(C, `insert into public.stories (kind, data) values ('texte', '{"t":"x"}')`)).rejects.toThrow(/row-level security/);
    expect(await q(A, `select * from public.social_search('cam')`)).toEqual([]);
    await db.query(`update public.social_profiles set banned = false where user_id = $1`, [C]);
  });

  it('stories : 24 h, 30 par jour au plus, contenu borné, retirées par leur auteur seulement', async () => {
    const [s] = await q(A, `insert into public.stories (kind, data) values ('texte', '{"t":"Séance faite"}') returning id, extract(epoch from expires_at - created_at)::int as d`);
    expect(s.d).toBe(24 * 3600);
    await expect(q(A, `insert into public.stories (kind, data, expires_at) values ('texte', '{}', now() + interval '9 days')`)).rejects.toThrow(/permission denied/);
    await expect(q(A, `insert into public.stories (kind, data) values ('photo', '{}')`)).rejects.toThrow(/check/);
    await expect(q(A, `insert into public.stories (kind, data) values ('texte', $1)`, [JSON.stringify({ t: 'x'.repeat(30000) })])).rejects.toThrow(/check/);
    expect(await q(C, `delete from public.stories where id = $1 returning 1`, [s.id])).toEqual([]);
    for (let i = 0; i < 28; i++) await q(A, `insert into public.stories (kind, data) values ('texte', '{"t":"…"}')`);
    await expect(q(A, `insert into public.stories (kind, data) values ('texte', '{"t":"une de trop"}')`)).rejects.toThrow(/trop de stories/);
    // une story finie depuis plus d'un jour quitte la base à la prochaine story publiée, de qui que ce soit
    const [old] = (await db.query(`insert into public.stories (user_id, kind, data) values ($1, 'texte', '{"t":"vieille"}') returning id`, [B])).rows;
    await db.query(`update public.stories set created_at = now() - interval '3 days', expires_at = now() - interval '2 days' where id = $1`, [old.id]);
    await q(B, `insert into public.stories (kind, data) values ('texte', '{"t":"nouvelle"}')`);
    expect((await db.query('select 1 from public.stories where id = $1', [old.id])).rows).toEqual([]);
  });

  it('signaler : enregistré, lisible par personne d’autre que l’administrateur', async () => {
    await q(C, `insert into public.reports (target_user, kind, reason, note) values ($1, 'profil', 'spam', 'pub')`, [A]);
    await expect(q(C, 'select * from public.reports')).rejects.toThrow(/permission denied/);
    await expect(q(C, `insert into public.reports (target_user, kind, reason) values ($1, 'profil', 'nimporte')`, [A])).rejects.toThrow(/check/);
    expect((await db.query('select reporter, status from public.reports')).rows).toEqual([{ reporter: C, status: 'nouveau' }]);
  });

  it('quitter le social efface abonnements, stories et messages', async () => {
    await q(C, 'delete from public.social_profiles');
    expect((await db.query('select count(*)::int as n from public.follows where follower = $1 or followee = $1', [C])).rows[0].n).toBe(0);
    expect((await db.query('select count(*)::int as n from public.stories where user_id = $1', [C])).rows[0].n).toBe(0);
    expect((await db.query('select count(*)::int as n from auth.users where id = $1', [C])).rows[0].n).toBe(1);   // le compte reste
  });
});
