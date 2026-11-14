// Fonction serveur « account » (Supabase Edge Functions, Deno) : suppression du compte.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { createAccountHandler } from './handler.js';
import { makeDeps, allowedOriginsFrom } from '../_shared/supabase-deps.js';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const deps = makeDeps(admin);

Deno.serve(createAccountHandler({
  getUser: deps.getUser,
  removeUserFiles: deps.removeUserFiles,
  deleteUser: deps.deleteUser,
  allowedOrigins: allowedOriginsFrom(Deno.env.get('ALLOWED_ORIGINS')),
  log: (...a: unknown[]) => console.log('[account]', ...a),
}));
