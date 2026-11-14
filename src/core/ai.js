// Appels à l'IA.
//  1. clé personnelle enregistrée sur ce téléphone → appel direct à Anthropic (comme avant) ;
//  2. sinon, compte connecté → fonction serveur « ai » (clé du serveur, quota par jour) ;
//  3. sinon → erreur 'nokey' (l'app propose de se connecter ou d'ajouter une clé).
// Les erreurs gardent les codes de l'ancienne app (network, auth, credit, rate, busy, http)
// et en ajoutent deux : 'quota' (analyses du jour épuisées) et 'session' (reconnexion).
// image (facultative) : photo du repas { media_type, data en base64 }, envoyée avec la demande.

import { CLOUD_ENABLED, SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { auth, accessToken, setAccountQuota } from './auth.js';

export const AI_MODEL = 'claude-haiku-4-5-20251001';

function fail(code, msg, extra) { const e = new Error(msg || code); e.code = code; return Object.assign(e, extra || {}); }

export function accountAiReady() { return CLOUD_ENABLED && !!auth.user; }

// Contenu du message : le texte seul, ou la photo puis le texte
export function messageContent(prompt, image) {
  if (!image) return prompt;
  return [{ type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } }, { type: 'text', text: prompt }];
}

async function direct(prompt, maxTokens, key, image) {
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: messageContent(prompt, image) }] }),
    });
  } catch (e) { throw fail('network'); }
  let d = null; try { d = await r.json(); } catch (e) { /* réponse vide */ }
  if (!r.ok) {
    const msg = (d && d.error && d.error.message) || '';
    const code = (r.status === 401 || r.status === 403) ? 'auth' : (/credit|balance/i.test(msg) ? 'credit' : (r.status === 429 ? 'rate' : (r.status >= 500 ? 'busy' : 'http')));
    throw fail(code, msg || ('HTTP ' + r.status), { status: r.status });
  }
  return { text: ((d && d.content) || []).filter((x) => x.type === 'text').map((x) => x.text).join('\n'), stop: d && d.stop_reason };
}

async function viaAccount(prompt, maxTokens, image) {
  const token = await accessToken().catch(() => null);
  if (!token) throw fail('session');
  let r;
  try {
    r = await fetch(SUPABASE_URL + '/functions/v1/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(image ? { prompt, max_tokens: maxTokens, image: { media_type: image.media_type, data: image.data } } : { prompt, max_tokens: maxTokens }),
    });
  } catch (e) { throw fail('network'); }
  let d = null; try { d = await r.json(); } catch (e) { /* rien */ }
  if (d && d.quota) setAccountQuota(d.quota);
  if (!r.ok) {
    const err = d && d.error;
    if (r.status === 401) throw fail('session', 'session', { status: 401 });
    if (r.status === 429 && err === 'quota') throw fail('quota', 'quota', { status: 429, quota: d.quota });
    if (r.status === 429) throw fail('rate', 'rate', { status: 429 });
    if (err === 'credit') throw fail('busy', 'credit', { status: r.status });
    if (r.status >= 500) throw fail('busy', 'busy', { status: r.status });
    throw fail('http', (d && d.message) || ('HTTP ' + r.status), { status: r.status });
  }
  return { text: String((d && d.text) || ''), stop: d && d.stop };
}

export async function aiCall(prompt, maxTokens, key, image = null) {
  if (key) return direct(prompt, maxTokens, key, image);
  if (accountAiReady()) return viaAccount(prompt, maxTokens, image);
  throw fail('nokey');
}
