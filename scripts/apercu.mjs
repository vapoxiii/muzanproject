// Construit l'aperçu de test publié dans Claude : l'app en mode local, avec des données
// d'exemple, sans service worker. Sortie : .tmp/apercu/page.html (contenu de la page, sans
// <html>/<head>/<body> : la publication ajoute son propre cadre) et .tmp/apercu/files.json
// (fichiers à publier à côté, chemin publié → fichier).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, '.tmp/apercu');
execSync('npx vite build --mode apercu --outDir .tmp/apercu --emptyOutDir', {
  cwd: root, stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, VITE_APERCU: '1', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
});
const html = readFileSync(join(out, 'index.html'), 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1]);
const js = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
const style = (html.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>')).trim();
const page = [
  '<title>Mon suivi v2</title>',
  style,
  '<script>(function(){var r=document.documentElement;r.lang="fr";r.classList.add("boot");setTimeout(function(){r.classList.remove("boot")},6000)})()</script>',
  ...css.map((h) => `<link rel="stylesheet" href="${h}">`),
  ...js.map((s) => `<script type="module" src="${s}"></script>`),
  body,
].join('\n') + '\n';
writeFileSync(join(out, 'page.html'), page);

const skip = new Set(['index.html', 'page.html', 'mon-suivi-app.html', 'sw.js', 'version.json', 'files.json', 'manifest.webmanifest', 'confidentialite.html', 'vendor/quagga.LICENSE.txt']);
const files = {};
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    const rel = relative(out, p).split(sep).join('/');
    if (!skip.has(rel) && !rel.endsWith('.map') && !rel.split('/').pop().startsWith('.')) files[rel] = relative(root, p).split(sep).join('/');
  }
};
walk(out);
writeFileSync(join(out, 'files.json'), JSON.stringify(files, null, 1));
const size = Object.values(files).reduce((n, f) => n + statSync(join(root, f)).size, 0) + page.length;
console.log(`aperçu : page ${Math.round(page.length / 1024)} Ko, ${Object.keys(files).length} fichiers, ${(size / 1048576).toFixed(1)} Mo au total`);
