// Le social côté serveur (Supabase) : profils, abonnements, stories, messages, blocages, signalements.
// Les règles (qui voit quoi, qui peut écrire à qui) sont dans la base : supabase/migrations/*_social.sql.
// Exposé au code d'origine par le pont : MS.social (src/core/bridge.js).
//
// Erreurs : e.kind = 'offline' (pas de compte configuré ou pas connecté), 'setup' (la migration du social
// n'est pas appliquée sur le serveur), 'taken' (pseudo déjà pris), 'reserved', 'limit' (trop d'actions),
// 'denied' (pas le droit : blocage, pas d'abonnement mutuel…), 'network', 'other'.

import { CLOUD_ENABLED } from '../core/config.js';
import { auth, getClient } from '../core/auth.js';

export function socialError(error) {
  if (error && error.kind) return error;
  const msg = String((error && (error.message || error.msg)) || error || '');
  const code = String((error && error.code) || '');
  const e = new Error(msg);
  e.code = code;
  if (['PGRST202', 'PGRST205', '42P01', '42883', 'PGRST204'].includes(code) || /could not find the (function|table)|schema cache/i.test(msg)) e.kind = 'setup';
  else if (code === '23505') e.kind = 'taken';
  else if (/réservé/.test(msg)) e.kind = 'reserved';
  else if (code === '54000' || /trop de/i.test(msg)) e.kind = 'limit';
  else if (code === '42501' || /row-level security|permission denied|blocage|suspendu/i.test(msg)) e.kind = 'denied';
  else if (/fetch|network|load failed|networkerror/i.test(msg) || (error && error.status === 0)) e.kind = 'network';
  else e.kind = 'other';
  return e;
}
function check({ data, error }) {
  if (error) throw socialError(error);
  return data;
}
async function db() {
  if (!CLOUD_ENABLED || !auth.user) throw Object.assign(new Error('pas de compte'), { kind: 'offline' });
  const c = await getClient();
  if (!c) throw Object.assign(new Error('pas de compte'), { kind: 'offline' });
  return c;
}
async function call(fn) {
  try { return await fn(await db()); } catch (e) { throw socialError(e); }
}
const rpc = (name, args) => call(async (c) => check(await c.rpc(name, args || {})));
const me = () => (auth.user ? auth.user.id : null);

export const social = {
  available: () => CLOUD_ENABLED,
  signedIn: () => CLOUD_ENABLED && !!auth.user,
  userId: me,

  // ---- mon profil ----
  myProfile: () => call(async (c) => check(await c.from('social_profiles').select('user_id,handle,name,color,bio,is_public,stats,banned,created_at').eq('user_id', me()).maybeSingle())),
  createProfile: ({ handle, name, color, bio = '', isPublic = false, stats = {} }) => call(async (c) =>
    check(await c.from('social_profiles').insert({ handle, name, color, bio, is_public: isPublic, stats }).select('user_id,handle,name,color,bio,is_public,stats,banned,created_at').single())),
  updateProfile: (fields) => call(async (c) => {
    const row = {};
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) row[k === 'isPublic' ? 'is_public' : k] = v;
    return check(await c.from('social_profiles').update(row).eq('user_id', me()).select('user_id,handle,name,color,bio,is_public,stats,banned,created_at').single());
  }),
  deleteProfile: () => call(async (c) => check(await c.from('social_profiles').delete().eq('user_id', me()))),

  // ---- les autres ----
  search: (q) => rpc('social_search', { p_q: q }),
  profile: (handle) => rpc('social_profile', { p_handle: handle }),
  people: () => rpc('social_people'),
  follow: (id) => call(async (c) => {
    const { data, error } = await c.from('follows').insert({ followee: id }).select('status').single();
    if (error && String(error.code) === '23505') return check(await c.from('follows').select('status').eq('follower', me()).eq('followee', id).single());
    return check({ data, error });
  }),
  unfollow: (id) => call(async (c) => check(await c.from('follows').delete().eq('follower', me()).eq('followee', id))),
  accept: (id) => call(async (c) => check(await c.from('follows').update({ status: 'accepted' }).eq('follower', id).eq('followee', me()).select('status'))),
  removeFollower: (id) => call(async (c) => check(await c.from('follows').delete().eq('follower', id).eq('followee', me()))),
  block: (id) => call(async (c) => {
    const { error } = await c.from('blocks').insert({ blocked: id });
    if (error && String(error.code) !== '23505') throw socialError(error);
    return true;
  }),
  unblock: (id) => call(async (c) => check(await c.from('blocks').delete().eq('blocker', me()).eq('blocked', id))),
  blocked: () => rpc('social_blocked'),
  report: ({ user, kind, target = null, reason, note = '', snapshot = null }) => call(async (c) =>
    check(await c.from('reports').insert({ target_user: user, kind, target_id: target, reason, note, snapshot }))),

  // ---- stories ----
  stories: () => rpc('social_stories'),
  postStory: (kind, data) => call(async (c) => check(await c.from('stories').insert({ kind, data }).select('id,created_at,expires_at').single())),
  deleteStory: (id) => call(async (c) => check(await c.from('stories').delete().eq('id', id).eq('user_id', me()))),

  // ---- messages ----
  inbox: () => rpc('social_inbox'),
  thread: (other, limit = 80) => rpc('social_thread', { p_other: other, p_limit: limit }),
  send: (to, { kind = 'texte', body = '', data = null, story = null } = {}) => call(async (c) =>
    check(await c.from('messages').insert({ recipient: to, kind, body, data, story_id: story }).select('id,created_at').single())),
  markRead: (other) => rpc('social_mark_read', { p_other: other }),
  deleteMessage: (id) => rpc('social_delete_message', { p_id: id }),
  badges: (seen) => rpc('social_badges', seen ? { p_seen: seen } : {}),
};
