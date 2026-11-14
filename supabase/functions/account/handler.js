// Fonction « account » : suppression du compte à la demande de l'utilisateur
// (fichiers photos, puis compte ; les tables suivent par « on delete cascade »).

import { corsHeaders, json, bearer, originAllowed } from '../_shared/http.js';

export function createAccountHandler({ getUser, removeUserFiles, deleteUser, allowedOrigins = ['*'], log = () => {} }) {
  return async function handle(req) {
    const origin = req.headers.get('origin') || '';
    const cors = corsHeaders(origin, allowedOrigins);
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json({ error: 'method' }, 405, cors);
    if (!originAllowed(origin, allowedOrigins)) return json({ error: 'origin' }, 403, cors);
    const token = bearer(req);
    const user = token ? await getUser(token).catch(() => null) : null;
    if (!user || !user.id) return json({ error: 'auth' }, 401, cors);
    let body; try { body = await req.json(); } catch (e) { body = null; }
    if (!body || body.action !== 'delete') return json({ error: 'bad_request', message: 'action inconnue' }, 400, cors);
    try {
      await removeUserFiles(user.id);
      await deleteUser(user.id);
    } catch (e) {
      log('suppression impossible', e && e.message);
      return json({ error: 'busy', message: 'suppression impossible pour le moment' }, 503, cors);
    }
    log('compte supprimé', user.id);
    return json({ ok: true }, 200, cors);
  };
}
