/* Service worker de MON-SUIVI — généré à la construction (vite.config.js).
   - Tous les fichiers de l'app sont gardés en cache à l'installation : l'app s'ouvre
     sans réseau, instantanément.
   - Ouverture de l'app (navigation) : page en cache, puis réseau si absente.
   - Autres fichiers du site : cache d'abord.
   - Illustrations des exercices (exos/) : gardées au premier affichage dans un cache à part,
     qui survit aux mises à jour (leurs noms changent quand l'image change).
   - Rien n'est intercepté hors du site (serveur du compte, IA, Open Food Facts). */

const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = 'ms-' + VERSION;
const SHELL = './index.html';
const EXOS = 'exos-1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((u) => new Request(u, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('ms-') && k !== CACHE).map((k) => caches.delete(k))))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'VERSION' && event.ports && event.ports[0]) event.ports[0].postMessage(VERSION);
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    const scope = self.registration.scope;
    const page = url.origin + url.pathname;
    const isApp = page === scope || page === scope + 'index.html' || page === scope + 'mon-suivi-app.html';
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        if (isApp) return (await cache.match(SHELL)) || fetch(req);
        try { return await fetch(req); } catch (e) { return (await cache.match(req, { ignoreSearch: true })) || Response.error(); }
      })
    );
    return;
  }
  if (url.pathname.includes('/exos/')) {
    event.respondWith(
      caches.open(EXOS).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic' && url.pathname.includes('/assets/')) cache.put(req, res.clone());
      return res;
    })
  );
});
