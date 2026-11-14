// Fonction serveur « ai » (Supabase Edge Functions, Deno).
// Secrets à définir : ANTHROPIC_API_KEY (obligatoire), ALLOWED_ORIGINS (adresse de l'app,
// ex. https://moncompte.github.io), AI_MODEL (facultatif).
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { createAiHandler, anthropicCaller } from './handler.js';
import { makeDeps, allowedOriginsFrom } from '../_shared/supabase-deps.js';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const deps = makeDeps(admin);

const handler = createAiHandler({
  getUser: deps.getUser,
  consume: deps.consume,
  refund: deps.refund,
  callModel: anthropicCaller(Deno.env.get('ANTHROPIC_API_KEY') ?? '', Deno.env.get('ANTHROPIC_BASE_URL') ?? undefined),
  allowedOrigins: allowedOriginsFrom(Deno.env.get('ALLOWED_ORIGINS')),
  model: Deno.env.get('AI_MODEL') || undefined,
  log: (...a: unknown[]) => console.log('[ai]', ...a),
});

Deno.serve(handler);
