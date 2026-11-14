// Compte : connexion par code reçu par e-mail (pas de mot de passe).
// Un code plutôt qu'un lien : sur iPhone, l'app installée sur l'écran d'accueil ne reçoit
// pas les liens ouverts depuis Mail (ils s'ouvrent dans Safari, à côté de l'app).
//
// La bibliothèque Supabase n'est chargée que si un compte est utilisé.

import { CLOUD_ENABLED, SUPABASE_URL, SUPABASE_ANON_KEY, AUTH_STORAGE_KEY, CONSENT_VERSION } from './config.js';

let clientP = null;
const listeners = new Set();       // changement d'utilisateur (connexion, déconnexion)
const infoListeners = new Set();   // changement des infos du compte (offre, quota)
export const auth = { user: null, ready: !CLOUD_ENABLED, account: null };

export function onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function onAccountInfo(fn) { infoListeners.add(fn); return () => infoListeners.delete(fn); }
function emit() { for (const fn of listeners) { try { fn(auth); } catch (e) { console.error(e); } } }
function emitInfo() { for (const fn of infoListeners) { try { fn(auth); } catch (e) { console.error(e); } } }

function storedSession() {
  try { const s = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null'); return s && s.user ? s : null; } catch (e) { return null; }
}
export function hasStoredSession() { return CLOUD_ENABLED && !!storedSession(); }

function setUser(u) {
  const next = u ? { id: u.id, email: u.email || '' } : null;
  const changed = (auth.user && auth.user.id) !== (next && next.id);
  auth.user = next;
  if (!next) auth.account = null;
  if (changed) emit();
}

export function getClient() {
  if (!CLOUD_ENABLED) return Promise.resolve(null);
  if (!clientP) {
    clientP = import('@supabase/supabase-js').then(({ createClient }) => {
      const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { storageKey: AUTH_STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
      c.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') setUser(null);
        else if (session && session.user) setUser(session.user);
      });
      return c;
    });
  }
  return clientP;
}

// Au démarrage : reprend la session enregistrée, même hors ligne (affichage du compte).
export async function initAuth() {
  if (!CLOUD_ENABLED) return auth;
  const s = storedSession();
  if (s) {
    setUser(s.user);
    try { await getClient(); } catch (e) { console.warn('[compte] bibliothèque indisponible', e); }
  }
  auth.ready = true;
  return auth;
}

// Jeton d'accès valable (rafraîchi si besoin). null si pas connecté.
export async function accessToken() {
  if (!auth.user) return null;
  const c = await getClient();
  const { data } = await c.auth.getSession();
  return data && data.session ? data.session.access_token : null;
}

function authError(error) {
  const msg = String((error && error.message) || error || '');
  const status = error && error.status;
  const e = new Error(msg);
  if (/rate|too many|security purposes/i.test(msg) || status === 429) e.code = 'rate';
  else if (/expired|invalid|otp/i.test(msg) && status !== 0) e.code = 'badcode';
  else if (/fetch|network|load failed/i.test(msg) || status === 0) e.code = 'network';
  else if (/signups? not allowed|disabled/i.test(msg)) e.code = 'closed';
  else e.code = 'other';
  return e;
}

export async function sendCode(email) {
  const c = await getClient();
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw authError(error);
}

export async function verifyCode(email, token) {
  const c = await getClient();
  const { data, error } = await c.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw authError(error);
  if (data && data.user) setUser(data.user);
  try { await c.rpc('record_consent', { p_version: CONSENT_VERSION }); } catch (e) { console.warn('[compte] consentement non enregistré', e); }
  return auth.user;
}

export async function signOut() {
  const c = await getClient();
  try { await c.auth.signOut({ scope: 'local' }); } catch (e) { /* hors ligne : la session locale est quand même effacée */ }
  try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (e) { /* rien */ }
  setUser(null);
}

// Offre, quota d'analyses IA du jour, consentement.
export async function refreshAccount() {
  if (!auth.user) return null;
  const c = await getClient();
  const { data, error } = await c.rpc('account_status');
  if (error) throw error;
  auth.account = data || null;
  emitInfo();
  return auth.account;
}

export function setAccountQuota(q) {
  if (!q) return;
  auth.account = { ...(auth.account || {}), plan: q.plan ?? auth.account?.plan, ai_used: q.used, ai_limit: q.limit };
  emitInfo();
}

// Supprime le compte et les données du serveur (fonction « account »). Les données
// de ce téléphone restent.
export async function deleteAccount() {
  const token = await accessToken();
  if (!token) throw Object.assign(new Error('not signed in'), { code: 'session' });
  let r;
  try {
    r = await fetch(SUPABASE_URL + '/functions/v1/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: 'delete' }),
    });
  } catch (e) { throw Object.assign(new Error('network'), { code: 'network' }); }
  if (!r.ok) { let d = null; try { d = await r.json(); } catch (e) { /* rien */ } throw Object.assign(new Error((d && d.message) || 'HTTP ' + r.status), { code: 'http', status: r.status }); }
  await signOut();
}
