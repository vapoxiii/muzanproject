// « Supabase local » pour les tests de bout en bout :
//   /rest/v1      → vrai PostgREST sur un vrai PostgreSQL (migration du projet + RLS)
//   /auth/v1      → connexion par code simulée (jetons signés comme Supabase)
//   /storage/v1   → fichiers stockés dans storage.objects, avec les vraies règles d'accès (RLS)
//   /functions/v1 → les vraies fonctions « ai » et « account », branchées comme en production
//   /__anthropic  → IA simulée ;  /__test → boîte de réception des codes, réglages de test
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createAiHandler, anthropicCaller } from '../../supabase/functions/ai/handler.js';
import { PLATE } from '../fixtures/ai-plate.js';
import { createAccountHandler } from '../../supabase/functions/account/handler.js';
import { makeDeps } from '../../supabase/functions/_shared/supabase-deps.js';
import { freshDatabase } from './db.js';

const SECRET = 'secret-de-test-pour-signer-les-jetons-local-uniquement';
const b64u = (b) => Buffer.from(b).toString('base64url');
export function signJWT(payload, secret = SECRET) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(head + '.' + body).digest('base64url');
  return `${head}.${body}.${sig}`;
}
export function verifyJWT(token, secret = SECRET) {
  const [h, b, s] = String(token || '').split('.');
  if (!h || !b || !s) return null;
  if (createHmac('sha256', secret).update(h + '.' + b).digest('base64url') !== s) return null;
  const p = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (p.exp && p.exp * 1000 < Date.now()) return null;
  return p;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer, range, accept-profile, content-profile, x-upsert, cache-control, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
  'Access-Control-Expose-Headers': 'content-range, content-location, preference-applied',
};

function readBody(req) {
  return new Promise((resolve, reject) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => resolve(Buffer.concat(c))); req.on('error', reject); });
}
function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(status, { ...CORS, ...(isBuf ? {} : { 'Content-Type': 'application/json' }), ...headers });
  res.end(isBuf ? body : body === undefined ? '' : JSON.stringify(body));
}

async function waitFor(url, ms = 15000) {
  const t0 = Date.now();
  for (;;) {
    try { const r = await fetch(url); if (r.ok) return; } catch (e) { /* pas encore */ }
    if (Date.now() - t0 > ms) throw new Error('PostgREST ne démarre pas : ' + url);
    await new Promise((r) => setTimeout(r, 150));
  }
}

const MEAL = { nom: 'Pâtes bolognaise', base_kcal: 420, base_prot: 18, base_gluc: 12, base_lip: 24, questions: [
  { id: 'q1', q: 'Quelle portion de pâtes ?', options: [{ l: '80 g', k: 280, p: 10, gluc: 56, lip: 1.5 }, { l: '120 g', k: 420, p: 15, gluc: 84, lip: 2 }, { l: '160 g', k: 560, p: 20, gluc: 112, lip: 3 }], slider: { unit: 'g', min: 40, max: 250, step: 10, k_per_unit: 3.5, p_per_unit: 0.12, gluc_per_unit: 0.7, lip_per_unit: 0.02, default: 120 } },
  { id: 'q2', q: 'Matière grasse ?', options: [{ l: 'Aucune', k: 0, p: 0, gluc: 0, lip: 0 }, { l: 'Filet d’huile', k: 60, p: 0, gluc: 0, lip: 7 }, { l: 'Beurre', k: 100, p: 0, gluc: 0, lip: 11 }] },
] };

export async function startStack({ pgUrl = process.env.MS_PG, postgrest = process.env.MS_POSTGREST, dbName = 'ms_e2e', port = 0 } = {}) {
  if (!pgUrl || !postgrest) throw new Error('MS_PG et MS_POSTGREST sont nécessaires');
  const { db, url: dbUrl } = await freshDatabase(dbName);
  const pgrstPort = 30000 + Math.floor(Math.random() * 20000);
  const authUri = dbUrl.replace(/\/\/[^@]*@/, '//authenticator:authenticator@');
  const proc = spawn(postgrest, [], {
    env: { ...process.env, PGRST_DB_URI: authUri, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: SECRET,
      PGRST_SERVER_PORT: String(pgrstPort), PGRST_SERVER_HOST: '127.0.0.1', PGRST_LOG_LEVEL: 'error' },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  await waitFor(`http://127.0.0.1:${pgrstPort}/`);

  const state = { outbox: new Map(), refresh: new Map(), anthropic: { mode: 'ok', calls: 0, last: null } };
  const anonKey = signJWT({ role: 'anon', iss: 'supabase-local', iat: 1700000000, exp: 4000000000 });
  const serviceKey = signJWT({ role: 'service_role', iss: 'supabase-local', iat: 1700000000, exp: 4000000000 });

  async function userById(id) { const r = await db.query('select id, email, created_at from auth.users where id = $1', [id]); return r.rows[0] || null; }
  function userJSON(u) {
    return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.created_at, phone: '',
      app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: u.created_at, updated_at: u.created_at };
  }
  function session(u) {
    const now = Math.floor(Date.now() / 1000), exp = now + 3600;
    const access = signJWT({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, iat: now, exp, session_id: randomUUID() });
    const refresh = randomBytes(16).toString('hex');
    state.refresh.set(refresh, u.id);
    return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: refresh, user: userJSON(u) };
  }
  const claimsOf = (req) => verifyJWT(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));

  // ----- stockage : requêtes SQL avec le rôle et l'identité de l'appelant (RLS) -----
  async function asCaller(claims, fn) {
    const c = await new pg.Client({ connectionString: dbUrl }); await c.connect();
    try {
      await c.query('begin');
      const role = claims && claims.role === 'service_role' ? 'service_role' : claims && claims.role === 'authenticated' ? 'authenticated' : 'anon';
      await c.query(`select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)`, [role, JSON.stringify(claims || {})]);
      const out = await fn(c);
      await c.query('commit');
      return out;
    } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { await c.end(); }
  }

  // ----- fonctions serveur : vraies fonctions, client administrateur vers cette passerelle -----
  let base = '';
  let deps = null;
  const fakeFetch = async (url, init) => {
    state.anthropic.calls++;
    state.anthropic.last = JSON.parse(init.body);
    const mode = state.anthropic.mode;
    if (mode === 'down') throw new Error('ECONNREFUSED');
    if (mode === 'overloaded') return new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }), { status: 529 });
    const content = state.anthropic.last.messages[0].content;
    const photo = Array.isArray(content) && content.some((c) => c && c.type === 'image');
    const prompt = typeof content === 'string' ? content : ((Array.isArray(content) && content.find((c) => c && c.type === 'text')) || {}).text || '';
    const text = /OK\.?$/.test(prompt) ? 'OK' : JSON.stringify(photo ? PLATE : MEAL);
    return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }), { status: 200 });
  };
  let aiHandler, accountHandler;

  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://x');
      const p = u.pathname;
      if (req.method === 'OPTIONS') { send(res, 200, 'ok'); return; }

      // ---------- PostgREST ----------
      if (p.startsWith('/rest/v1/')) {
        const body = await readBody(req);
        const headers = {};
        for (const h of ['authorization', 'content-type', 'accept', 'prefer', 'range', 'accept-profile', 'content-profile']) if (req.headers[h]) headers[h] = req.headers[h];
        if (!headers.authorization && req.headers.apikey) headers.authorization = 'Bearer ' + req.headers.apikey;
        const r = await fetch(`http://127.0.0.1:${pgrstPort}${p.slice('/rest/v1'.length)}${u.search}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
        const out = Buffer.from(await r.arrayBuffer());
        const hh = {}; for (const h of ['content-type', 'content-range', 'preference-applied', 'content-location']) { const v = r.headers.get(h); if (v) hh[h] = v; }
        send(res, r.status, out, hh);
        return;
      }

      // ---------- Auth ----------
      if (p === '/auth/v1/otp' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)).toString() || '{}');
        const email = String(b.email || '').toLowerCase();
        if (!email.includes('@')) { send(res, 400, { code: 400, error_code: 'validation_failed', msg: 'Unable to validate email address: invalid format' }); return; }
        await db.query('insert into auth.users (email) values ($1) on conflict (email) do nothing', [email]);
        const code = String(Math.floor(100000 + Math.random() * 900000));
        state.outbox.set(email, code);
        send(res, 200, {});
        return;
      }
      if (p === '/auth/v1/verify' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)).toString() || '{}');
        const email = String(b.email || '').toLowerCase();
        if (!b.token || state.outbox.get(email) !== b.token) { send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }); return; }
        state.outbox.delete(email);
        const r = await db.query('select id, email, created_at from auth.users where email = $1', [email]);
        send(res, 200, session(r.rows[0]));
        return;
      }
      if (p === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token') {
        const b = JSON.parse((await readBody(req)).toString() || '{}');
        const id = state.refresh.get(b.refresh_token);
        const usr = id && await userById(id);
        if (!usr) { send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }); return; }
        state.refresh.delete(b.refresh_token);
        send(res, 200, session(usr));
        return;
      }
      if (p === '/auth/v1/user' && req.method === 'GET') {
        const c = claimsOf(req);
        const usr = c && c.sub && await userById(c.sub);
        if (!usr) { send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' }); return; }
        send(res, 200, userJSON(usr));
        return;
      }
      if (p === '/auth/v1/logout') { send(res, 204, undefined); return; }
      if (p.startsWith('/auth/v1/admin/users/') && req.method === 'DELETE') {
        const c = claimsOf(req);
        if (!c || c.role !== 'service_role') { send(res, 403, { msg: 'forbidden' }); return; }
        await db.query('delete from auth.users where id = $1', [p.split('/').pop()]);
        send(res, 200, {});
        return;
      }

      // ---------- Storage ----------
      if (p.startsWith('/storage/v1/object/list/') && req.method === 'POST') {
        const bucket = p.split('/').pop();
        const b = JSON.parse((await readBody(req)).toString() || '{}');
        const prefix = String(b.prefix || '').replace(/\/?$/, '/');
        const rows = await asCaller(claimsOf(req), (c) => c.query(`select name, id, created_at, updated_at, octet_length(data) as size from storage.objects where bucket_id = $1 and name like $2 order by name limit $3`, [bucket, prefix + '%', b.limit || 100]));
        send(res, 200, rows.rows.map((r) => ({ name: r.name.slice(prefix.length), id: r.id, created_at: r.created_at, updated_at: r.updated_at, metadata: { size: Number(r.size) } })));
        return;
      }
      if (p.startsWith('/storage/v1/object/') && (req.method === 'POST' || req.method === 'PUT')) {
        const [bucket, ...rest] = p.slice('/storage/v1/object/'.length).split('/');
        const name = rest.join('/');
        const raw = await readBody(req);
        let bytes = raw;
        if (String(req.headers['content-type'] || '').startsWith('multipart/form-data')) {
          const fd = await new Request('http://x', { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: raw }).formData();
          const file = [...fd.values()].find((v) => typeof v !== 'string');
          bytes = Buffer.from(await file.arrayBuffer());
        }
        const upsert = req.headers['x-upsert'] === 'true' || req.method === 'PUT';
        try {
          await asCaller(claimsOf(req), (c) => c.query(
            upsert
              ? `insert into storage.objects (bucket_id, name, data, owner) values ($1, $2, $3, nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid)
                 on conflict (bucket_id, name) do update set data = excluded.data, updated_at = now()`
              : `insert into storage.objects (bucket_id, name, data, owner) values ($1, $2, $3, nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid)`,
            [bucket, name, bytes]));
        } catch (e) {
          send(res, /row-level security/.test(e.message) ? 403 : 400, { statusCode: '403', error: 'Unauthorized', message: e.message });
          return;
        }
        send(res, 200, { Key: `${bucket}/${name}`, Id: randomUUID() });
        return;
      }
      if (p.startsWith('/storage/v1/object/') && req.method === 'GET') {
        let tail = p.slice('/storage/v1/object/'.length);
        if (tail.startsWith('authenticated/')) tail = tail.slice('authenticated/'.length);
        const [bucket, ...rest] = tail.split('/');
        const r = await asCaller(claimsOf(req), (c) => c.query('select data from storage.objects where bucket_id = $1 and name = $2', [bucket, rest.join('/')]));
        if (!r.rows.length) { send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' }); return; }
        send(res, 200, r.rows[0].data, { 'Content-Type': 'image/jpeg' });
        return;
      }
      if (p.startsWith('/storage/v1/object/') && req.method === 'DELETE') {
        const bucket = p.split('/').pop();
        const b = JSON.parse((await readBody(req)).toString() || '{}');
        const r = await asCaller(claimsOf(req), (c) => c.query('delete from storage.objects where bucket_id = $1 and name = any($2) returning name', [bucket, b.prefixes || []]));
        send(res, 200, r.rows.map((x) => ({ name: x.name })));
        return;
      }

      // ---------- Fonctions ----------
      if (p === '/functions/v1/ai' || p === '/functions/v1/account') {
        const body = await readBody(req);
        const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
        const fr = new Request(base + p, { method: req.method, headers, body: req.method === 'POST' ? body : undefined });
        const r = await (p.endsWith('/ai') ? aiHandler : accountHandler)(fr);
        const hh = {}; r.headers.forEach((v, k) => { hh[k] = v; });
        res.writeHead(r.status, hh);
        res.end(Buffer.from(await r.arrayBuffer()));
        return;
      }

      // ---------- outils de test ----------
      if (p === '/__test/outbox') { send(res, 200, { code: state.outbox.get(String(u.searchParams.get('email')).toLowerCase()) || null }); return; }
      if (p === '/__test/plan' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)).toString() || '{}');
        await db.query(`update public.profiles set plan = $2 where id = (select id from auth.users where email = $1)`, [b.email, b.plan]);
        send(res, 200, {});
        return;
      }
      if (p === '/__test/kv') {
        const r = await db.query(`select key, value, deleted, rev from public.kv where user_id = (select id from auth.users where email = $1) order by key`, [String(u.searchParams.get('email')).toLowerCase()]);
        send(res, 200, r.rows);
        return;
      }
      if (p === '/__test/photos') {
        const email = String(u.searchParams.get('email')).toLowerCase();
        const r = await db.query(`select id, d, deleted from public.photos where user_id = (select id from auth.users where email = $1) order by id`, [email]);
        const f = await db.query(`select count(*)::int as n from storage.objects where name like (select id::text from auth.users where email = $1) || '/%'`, [email]);
        send(res, 200, { rows: r.rows, files: f.rows[0].n });
        return;
      }
      if (p === '/__test/user') {
        const r = await db.query(`select id from auth.users where email = $1`, [String(u.searchParams.get('email')).toLowerCase()]);
        send(res, 200, { exists: r.rows.length > 0 });
        return;
      }
      if (p === '/__test/anthropic' && req.method === 'POST') { Object.assign(state.anthropic, JSON.parse((await readBody(req)).toString() || '{}')); send(res, 200, state.anthropic); return; }
      if (p === '/__test/anthropic') { send(res, 200, state.anthropic); return; }
      send(res, 404, { msg: 'route inconnue : ' + req.method + ' ' + p });
    } catch (e) {
      console.error('[passerelle]', e);
      send(res, 500, { msg: String(e && e.message) });
    }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;

  const admin = createClient(base, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  deps = makeDeps(admin);
  aiHandler = createAiHandler({ getUser: deps.getUser, consume: deps.consume, refund: deps.refund, callModel: anthropicCaller('cle-serveur', 'http://anthropic.invalid', fakeFetch), allowedOrigins: ['*'] });
  accountHandler = createAccountHandler({ getUser: deps.getUser, removeUserFiles: deps.removeUserFiles, deleteUser: deps.deleteUser, allowedOrigins: ['*'] });

  return {
    url: base, anonKey, serviceKey, db, state,
    async stop() { server.close(); proc.kill(); await db.end().catch(() => {}); },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await startStack({ port: Number(process.env.PORT || 54321) });
  console.log(JSON.stringify({ url: s.url, anonKey: s.anonKey }));
}
