// Petit serveur statique pour les tests : sert dist/ (ou un autre dossier) et, en option,
// l'ancienne app sous /old/ (même origine, donc même localStorage).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.svg': 'image/svg+xml', '.map': 'application/json', '.txt': 'text/plain; charset=utf-8', '.jpg': 'image/jpeg' };

export function serve({ root, port = 0, old = null, host = '127.0.0.1' }) {
  const base = resolve(root);
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file;
      if (old && p === '/old/mon-suivi-app.html') file = old;
      else {
        if (p.endsWith('/')) p += 'index.html';
        file = normalize(join(base, p));
        if (!file.startsWith(base)) { res.writeHead(403); res.end(); return; }
      }
      const st = await stat(file).catch(() => null);
      if (!st || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(await readFile(file));
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  return new Promise((r) => server.listen(port, host, () => r({ server, url: `http://${host}:${server.address().port}` })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] || 'dist';
  const port = +(process.argv[3] || 4173);
  const { url } = await serve({ root, port, old: process.env.OLD_APP || null });
  console.log('servi sur', url);
}
