// Réponses HTTP communes aux fonctions serveur (Deno sur Supabase, Node pour les tests).

export function corsHeaders(origin, allowed) {
  const ok = !allowed || allowed.includes('*') || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? (allowed && !allowed.includes('*') ? origin : '*') : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

export function bearer(req) {
  const h = req.headers.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : '';
}

export function originAllowed(origin, allowed) {
  return !allowed || allowed.includes('*') || !origin || allowed.includes(origin);
}
