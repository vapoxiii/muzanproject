// Bout en bout côté serveur, sans navigateur : supabase-js → passerelle locale → PostgREST
// → PostgreSQL (migration du projet), fonctions « ai » et « account ».
// Nécessite MS_PG et MS_POSTGREST (sinon ignoré).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { startStack } from '../stack/gateway.mjs';
import { supabaseRemote } from '../../src/core/remote.js';

const ON = !!(process.env.MS_PG && process.env.MS_POSTGREST);

async function signIn(stack, email) {
  const c = createClient(stack.url, stack.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
  const { code } = await (await fetch(`${stack.url}/__test/outbox?email=${encodeURIComponent(email)}`)).json();
  const { data, error: e2 } = await c.auth.verifyOtp({ email, token: code, type: 'email' });
  if (e2) throw e2;
  return { c, user: data.user, token: data.session.access_token };
}

describe.skipIf(!ON)('serveur local complet', () => {
  let stack;
  beforeAll(async () => { stack = await startStack({ dbName: 'ms_stack_test' }); }, 30000);
  afterAll(async () => { await stack?.stop(); });

  it('connexion par code, consentement, état du compte', async () => {
    const { c, user } = await signIn(stack, 'alex@exemple.fr');
    expect(user.email).toBe('alex@exemple.fr');
    const bad = await createClient(stack.url, stack.anonKey, { auth: { persistSession: false } }).auth.verifyOtp({ email: 'alex@exemple.fr', token: '000000', type: 'email' });
    expect(bad.error).toBeTruthy();
    expect((await c.rpc('record_consent', { p_version: '2026-10-26' })).error).toBe(null);
    const st = await c.rpc('account_status');
    expect(st.error).toBe(null);
    expect(st.data).toMatchObject({ plan: 'free', ai_used: 0, ai_limit: 3 });
  });

  it('synchronisation : envoi, conflit, lecture, isolation', async () => {
    const a = await signIn(stack, 'alex@exemple.fr');
    const r = supabaseRemote(a.c, a.user.id);
    const [ok] = await r.pushKv([{ key: 'bodylog', value: '[{"d":"2026-10-01","w":78}]', deleted: false, base_rev: 0, t: Date.now() }]);
    expect(ok.status).toBe('ok');
    const [conflict] = await r.pushKv([{ key: 'bodylog', value: '[]', deleted: false, base_rev: 0, t: Date.now() }]);
    expect(conflict.status).toBe('conflict');
    expect(conflict.row.rev).toBe(ok.rev);
    const rows = await r.pullKv(0);
    expect(rows.map((x) => x.key)).toEqual(['bodylog']);
    expect(rows[0]).toMatchObject({ value: '[{"d":"2026-10-01","w":78}]', deleted: false, rev: ok.rev });
    expect(typeof rows[0].t).toBe('number');
    // un autre compte ne voit rien
    const b = await signIn(stack, 'sam@exemple.fr');
    expect(await supabaseRemote(b.c, b.user.id).pullKv(0)).toEqual([]);
  });

  it('photos : envoi, lecture, liste, refus hors de son dossier, purge', async () => {
    const a = await signIn(stack, 'alex@exemple.fr');
    const r = supabaseRemote(a.c, a.user.id);
    const blob = new Blob([Buffer.from('\xff\xd8\xff\xe0 photo de test', 'latin1')], { type: 'image/jpeg' });
    await r.upload('p0123456789abcdef', blob);
    await r.upload('p0123456789abcdef', blob);                 // remplacement (upsert)
    const row = await r.pushPhoto({ id: 'p0123456789abcdef', d: '2026-10-02', deleted: false, bytes: blob.size });
    expect(row.rev).toBeGreaterThan(0);
    const back = await r.download('p0123456789abcdef');
    expect(Buffer.from(await back.arrayBuffer()).toString('latin1')).toContain('photo de test');
    expect((await r.pullPhotos(0)).map((x) => x.id)).toEqual(['p0123456789abcdef']);
    const b = await signIn(stack, 'sam@exemple.fr');
    await expect(supabaseRemote(b.c, b.user.id).download('p0123456789abcdef')).rejects.toThrow();
    const intrus = await b.c.storage.from('photos').upload(`${a.user.id}/pirate.jpg`, blob);
    expect(intrus.error).toBeTruthy();
    await r.purgePhotos();
    expect(await r.pullPhotos(0)).toEqual([]);
    expect((await a.c.storage.from('photos').list(a.user.id)).data).toEqual([]);
  });

  it('IA : 3 analyses par jour, rendues si l’IA tombe, Pro+ illimité', async () => {
    const a = await signIn(stack, 'quota@exemple.fr');
    const call = () => fetch(`${stack.url}/functions/v1/ai`, { method: 'POST', headers: { Authorization: 'Bearer ' + a.token, apikey: stack.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Tu es un nutritionniste. Repas : pâtes bolo', max_tokens: 1800 }) });
    const r1 = await call();
    expect(r1.status).toBe(200);
    const d1 = await r1.json();
    expect(JSON.parse(d1.text).nom).toBe('Pâtes bolognaise');
    expect(d1.quota).toEqual({ plan: 'free', limit: 3, used: 1 });
    expect(stack.state.anthropic.last.model).toBe('claude-haiku-4-5-20251001');
    stack.state.anthropic.mode = 'overloaded';
    const r2 = await call();
    expect(r2.status).toBe(503);
    expect((await r2.json()).quota.used).toBe(1);             // rendue
    stack.state.anthropic.mode = 'ok';
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);
    const r5 = await call();
    expect(r5.status).toBe(429);
    expect(await r5.json()).toEqual({ error: 'quota', quota: { plan: 'free', limit: 3, used: 3 } });
    await fetch(`${stack.url}/__test/plan`, { method: 'POST', body: JSON.stringify({ email: 'quota@exemple.fr', plan: 'pro_plus' }) });
    const r6 = await call();
    expect(r6.status).toBe(200);
    expect((await r6.json()).quota).toEqual({ plan: 'pro_plus', limit: null, used: 4 });
    const noAuth = await fetch(`${stack.url}/functions/v1/ai`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"prompt":"x"}' });
    expect(noAuth.status).toBe(401);
  });

  it('IA : la photo du repas passe par le serveur avec la demande', async () => {
    const a = await signIn(stack, 'photo@exemple.fr');
    const data = Buffer.from('photo de test').toString('base64');
    const r = await fetch(`${stack.url}/functions/v1/ai`, { method: 'POST', headers: { Authorization: 'Bearer ' + a.token, apikey: stack.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Voici la photo d’un repas.', max_tokens: 2000, image: { media_type: 'image/jpeg', data } }) });
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(JSON.parse(d.text).aliments.map((x) => x.n)).toContain('Riz blanc cuit');
    expect(d.quota).toEqual({ plan: 'free', limit: 3, used: 1 });
    expect(stack.state.anthropic.last.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
  });

  it('suppression du compte : fichiers et données effacés', async () => {
    const a = await signIn(stack, 'adieu@exemple.fr');
    const r = supabaseRemote(a.c, a.user.id);
    await r.pushKv([{ key: 'profile', value: '{}', deleted: false, base_rev: 0, t: 1 }]);
    await r.upload('p00000000000000aa', new Blob(['x'], { type: 'image/jpeg' }));
    const res = await fetch(`${stack.url}/functions/v1/account`, { method: 'POST', headers: { Authorization: 'Bearer ' + a.token, 'Content-Type': 'application/json' }, body: '{"action":"delete"}' });
    expect(res.status).toBe(200);
    const left = await stack.db.query(`select (select count(*) from auth.users where id = $1)::int as u, (select count(*) from public.kv where user_id = $1)::int as k, (select count(*) from storage.objects where name like $2)::int as f`, [a.user.id, a.user.id + '/%']);
    expect(left.rows[0]).toEqual({ u: 0, k: 0, f: 0 });
  });
});
