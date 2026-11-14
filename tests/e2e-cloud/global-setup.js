// Démarre le serveur local (PostgreSQL + PostgREST + passerelle) et construit l'app
// branchée dessus. Variables : MS_PG, MS_POSTGREST (voir README, section Tests).
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { startStack } from '../stack/gateway.mjs';
import { serve } from '../../scripts/serve.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;

export default async function globalSetup() {
  const stack = await startStack({ port: 54321, dbName: 'ms_e2e_cloud' });
  const out = join(ROOT, '.tmp/dist-cloud');
  execSync(`npx vite build --outDir ${out} --emptyOutDir`, {
    cwd: ROOT, stdio: 'ignore',
    env: { ...process.env, VITE_SUPABASE_URL: stack.url, VITE_SUPABASE_ANON_KEY: stack.anonKey },
  });
  const app = await serve({ root: out, port: 4174 });
  process.env.MS_CLOUD_APP = app.url;
  process.env.MS_STACK = stack.url;
  return async () => { app.server.close(); await stack.stop(); };
}
