// Fonction « ai » : l'app envoie la demande, le serveur vérifie le compte, réserve une
// analyse sur le quota du jour, appelle Claude avec la clé du serveur et renvoie la réponse.
// Si l'IA ne répond pas, l'analyse est rendue. Le contenu des demandes n'est jamais journalisé.
// Une demande peut porter une photo (repas pris en photo) : { prompt, image: { media_type, data } },
// data en base64 ; la photo n'est ni gardée ni journalisée.
//
// Indépendant de l'environnement : index.ts le branche sur Deno et Supabase, les tests sur Node.

import { corsHeaders, json, bearer, originAllowed } from '../_shared/http.js';

export const DEFAULTS = { model: 'claude-haiku-4-5-20251001', maxTokens: 2000, maxPromptChars: 12000, maxImageChars: 2800000 };
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Appel à l'API Anthropic (Messages). Renvoie { ok, status, data, message }.
export function anthropicCaller(apiKey, baseUrl = 'https://api.anthropic.com', fetchImpl = fetch) {
  return async (body) => {
    const r = await fetchImpl(baseUrl.replace(/\/+$/, '') + '/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });
    let data = null; try { data = await r.json(); } catch (e) { /* vide */ }
    return { ok: r.ok, status: r.status, data, message: (data && data.error && data.error.message) || '' };
  };
}

export function createAiHandler({ getUser, consume, refund, callModel, allowedOrigins = ['*'], model = DEFAULTS.model,
  maxTokens = DEFAULTS.maxTokens, maxPromptChars = DEFAULTS.maxPromptChars, maxImageChars = DEFAULTS.maxImageChars, log = () => {} }) {
  return async function handle(req) {
    const origin = req.headers.get('origin') || '';
    const cors = corsHeaders(origin, allowedOrigins);
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json({ error: 'method' }, 405, cors);
    if (!originAllowed(origin, allowedOrigins)) return json({ error: 'origin' }, 403, cors);

    const token = bearer(req);
    const user = token ? await getUser(token).catch(() => null) : null;
    if (!user || !user.id) return json({ error: 'auth' }, 401, cors);

    let body;
    try { body = await req.json(); } catch (e) { return json({ error: 'bad_request', message: 'JSON attendu' }, 400, cors); }
    const prompt = body && typeof body.prompt === 'string' ? body.prompt : '';
    if (!prompt.trim()) return json({ error: 'bad_request', message: 'demande vide' }, 400, cors);
    if (prompt.length > maxPromptChars) return json({ error: 'too_long', message: 'demande trop longue' }, 413, cors);
    const tokens = Math.max(1, Math.min(maxTokens, Math.floor(Number(body.max_tokens)) || 1024));
    let message = prompt;
    if (body.image != null) {
      const img = body.image;
      if (!img || typeof img !== 'object' || !IMAGE_TYPES.includes(img.media_type) || typeof img.data !== 'string' || !img.data) {
        return json({ error: 'bad_request', message: 'image invalide' }, 400, cors);
      }
      if (img.data.length > maxImageChars) return json({ error: 'too_long', message: 'image trop lourde' }, 413, cors);
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(img.data)) return json({ error: 'bad_request', message: 'image invalide' }, 400, cors);
      message = [{ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } }, { type: 'text', text: prompt }];
    }

    let q;
    try { q = await consume(user.id); } catch (e) { log('quota indisponible', e && e.message); return json({ error: 'busy' }, 503, cors); }
    const quota = { plan: q.plan || 'free', limit: q.limit ?? null, used: q.used ?? 0 };
    if (!q.ok) return json({ error: 'quota', quota }, 429, cors);

    const giveBack = async () => {
      try { await refund(user.id, q.day); quota.used = Math.max(0, quota.used - 1); } catch (e) { log('remboursement impossible', e && e.message); }
    };
    let r;
    try {
      r = await callModel({ model, max_tokens: tokens, messages: [{ role: 'user', content: message }] });
    } catch (e) {
      await giveBack();
      log('IA injoignable', e && e.message);
      return json({ error: 'busy', quota }, 503, cors);
    }
    if (!r.ok) {
      await giveBack();
      log('IA en erreur', r.status);
      if (/credit|balance/i.test(r.message || '')) return json({ error: 'credit', quota }, 503, cors);
      if (r.status === 429) return json({ error: 'rate', quota }, 429, cors);
      if (r.status >= 500) return json({ error: 'busy', quota }, 503, cors);
      return json({ error: 'upstream', message: 'requête refusée par l’IA', quota }, 502, cors);
    }
    const content = (r.data && r.data.content) || [];
    const text = content.filter((x) => x && x.type === 'text').map((x) => x.text).join('\n');
    log('ok', user.id, quota.used + '/' + (quota.limit ?? '∞'));
    return json({ text, stop: (r.data && r.data.stop_reason) || null, quota }, 200, cors);
  };
}
