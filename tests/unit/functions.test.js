import { describe, it, expect, vi } from 'vitest';
import { createAiHandler } from '../../supabase/functions/ai/handler.js';
import { createAccountHandler } from '../../supabase/functions/account/handler.js';

const USER = { id: 'u-1', email: 'a@b.fr' };
function req(body, { token = 'jeton', method = 'POST', origin = 'https://moi.github.io' } = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: origin };
  if (token) headers.Authorization = 'Bearer ' + token;
  return new Request('http://x/functions/v1/ai', { method, headers, body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined });
}
function setup(over = {}) {
  const calls = { consume: 0, refund: 0, model: [] };
  const deps = {
    getUser: async (t) => (t === 'jeton' ? USER : null),
    consume: async () => { calls.consume++; return { ok: true, plan: 'free', limit: 3, used: calls.consume, day: '2026-10-26' }; },
    refund: async () => { calls.refund++; },
    callModel: async (b) => { calls.model.push(b); return { ok: true, status: 200, data: { content: [{ type: 'text', text: '{"nom":"Pâtes"}' }], stop_reason: 'end_turn' } }; },
    ...over,
  };
  return { handler: createAiHandler(deps), calls };
}

describe('fonction « ai »', () => {
  it('répond aux requêtes de vérification CORS', async () => {
    const { handler } = setup();
    const r = await handler(req(null, { method: 'OPTIONS' }));
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-headers')).toContain('authorization');
  });

  it('refuse sans compte valide', async () => {
    const { handler, calls } = setup();
    expect((await handler(req({ prompt: 'x' }, { token: '' }))).status).toBe(401);
    expect((await handler(req({ prompt: 'x' }, { token: 'faux' }))).status).toBe(401);
    expect(calls.consume).toBe(0);
  });

  it('vérifie la demande avant de compter une analyse', async () => {
    const { handler, calls } = setup();
    expect((await handler(req('pas du json'))).status).toBe(400);
    expect((await handler(req({ prompt: '   ' }))).status).toBe(400);
    expect((await handler(req({ prompt: 'a'.repeat(12001) }))).status).toBe(413);
    expect(calls.consume).toBe(0);
  });

  it('appelle le modèle du serveur, plafonne la longueur, renvoie le quota', async () => {
    const { handler, calls } = setup();
    const r = await handler(req({ prompt: 'pâtes bolo', max_tokens: 99999, model: 'claude-opus-autre' }));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d).toEqual({ text: '{"nom":"Pâtes"}', stop: 'end_turn', quota: { plan: 'free', limit: 3, used: 1 } });
    expect(calls.model[0]).toEqual({ model: 'claude-haiku-4-5-20251001', max_tokens: 2000, messages: [{ role: 'user', content: 'pâtes bolo' }] });
  });

  it('photo du repas : envoyée au modèle avec la demande ; type, format et taille vérifiés', async () => {
    const { handler, calls } = setup();
    const data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    const r = await handler(req({ prompt: 'liste les aliments', max_tokens: 2000, image: { media_type: 'image/png', data } }));
    expect(r.status).toBe(200);
    expect(calls.model[0].messages[0].content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data } },
      { type: 'text', text: 'liste les aliments' },
    ]);
    expect((await handler(req({ prompt: 'x', image: { media_type: 'image/gif', data } }))).status).toBe(400);
    expect((await handler(req({ prompt: 'x', image: { media_type: 'image/jpeg', data: 'pas du base64 !' } }))).status).toBe(400);
    expect((await handler(req({ prompt: 'x', image: 'photo' }))).status).toBe(400);
    expect((await handler(req({ prompt: 'x', image: { media_type: 'image/jpeg', data: 'A'.repeat(2800004) } }))).status).toBe(413);
    expect(calls.model).toHaveLength(1);
    expect(calls.consume).toBe(1);
  });

  it('quota épuisé : 429 sans appeler le modèle', async () => {
    const { handler, calls } = setup({ consume: async () => ({ ok: false, plan: 'free', limit: 3, used: 3, day: 'd' }) });
    const r = await handler(req({ prompt: 'x' }));
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: 'quota', quota: { plan: 'free', limit: 3, used: 3 } });
    expect(calls.model).toHaveLength(0);
  });

  it('IA en panne, surchargée ou sans crédit : analyse rendue', async () => {
    for (const [model, status, error] of [
      [async () => { throw new Error('ECONNRESET'); }, 503, 'busy'],
      [async () => ({ ok: false, status: 529, message: 'Overloaded' }), 503, 'busy'],
      [async () => ({ ok: false, status: 429, message: 'rate limited' }), 429, 'rate'],
      [async () => ({ ok: false, status: 400, message: 'Your credit balance is too low' }), 503, 'credit'],
      [async () => ({ ok: false, status: 400, message: 'invalid request' }), 502, 'upstream'],
    ]) {
      const { handler, calls } = setup({ callModel: model });
      const r = await handler(req({ prompt: 'x' }));
      expect(r.status).toBe(status);
      const d = await r.json();
      expect(d.error).toBe(error);
      expect(d.quota.used).toBe(0);
      expect(calls.refund).toBe(1);
    }
  });

  it('origines autorisées', async () => {
    const h = createAiHandler({ ...setup().handler && {}, getUser: async () => USER, consume: async () => ({ ok: true, used: 1, limit: 3, plan: 'free' }), refund: async () => {}, callModel: async () => ({ ok: true, data: { content: [] } }), allowedOrigins: ['https://moi.github.io'] });
    expect((await h(req({ prompt: 'x' }, { origin: 'https://ailleurs.com' }))).status).toBe(403);
    const ok = await h(req({ prompt: 'x' }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://moi.github.io');
  });
});

describe('fonction « account »', () => {
  it('supprime les fichiers puis le compte', async () => {
    const order = [];
    const h = createAccountHandler({ getUser: async (t) => (t === 'jeton' ? USER : null), removeUserFiles: async (id) => order.push('fichiers:' + id), deleteUser: async (id) => order.push('compte:' + id) });
    expect((await h(req({ action: 'delete' }, { token: 'x' }))).status).toBe(401);
    expect((await h(req({ action: 'autre' }))).status).toBe(400);
    const r = await h(req({ action: 'delete' }));
    expect(r.status).toBe(200);
    expect(order).toEqual(['fichiers:u-1', 'compte:u-1']);
  });

  it('erreur côté serveur : 503, rien d’annoncé comme supprimé', async () => {
    const del = vi.fn();
    const h = createAccountHandler({ getUser: async () => USER, removeUserFiles: async () => { throw new Error('stockage'); }, deleteUser: del });
    const r = await h(req({ action: 'delete' }));
    expect(r.status).toBe(503);
    expect(del).not.toHaveBeenCalled();
  });
});
