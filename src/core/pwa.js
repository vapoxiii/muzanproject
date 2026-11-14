// App installable et hors ligne : enregistrement du service worker (sw.js est généré à la
// construction, avec la liste des fichiers à garder en cache).
//
// Mises à jour : la nouvelle version se télécharge en arrière-plan.
//  - déjà téléchargée au lancement → appliquée tout de suite (rechargement immédiat) ;
//  - en cours de téléchargement au lancement → appliquée dès qu'elle est prête, si l'on n'a
//    pas encore touché l'app ; sinon un bandeau propose de recharger.

let hadController = false;
let interacted = false;
let offerUpdate = null;

export function swSupported() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD && location.protocol !== 'file:';
}

if (typeof window !== 'undefined') {
  const mark = () => { interacted = true; };
  window.addEventListener('pointerdown', mark, { once: true, capture: true });
  window.addEventListener('keydown', mark, { once: true, capture: true });
}

let listening = false;
function listenControllerChange() {
  if (listening) return; listening = true;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    changed = true;
    if (reloaded || !hadController) return;
    reloaded = true;
    location.reload();
  });
}

// Demande au nouveau service worker de prendre la main. Le message est renvoyé tant que la
// bascule n'a pas eu lieu (il arrive qu'un premier message se perde pendant un chargement).
let changed = false;
function skipWaiting(worker) {
  listenControllerChange();
  let tries = 0;
  const send = async () => {
    if (changed || tries++ > 4) return;
    let w = worker;
    try { const reg = await navigator.serviceWorker.getRegistration(); if (reg && reg.waiting) w = reg.waiting; else if (tries > 1) return; } catch (e) { /* rien */ }
    try { w.postMessage({ type: 'SKIP_WAITING' }); } catch (e) { /* rien */ }
    setTimeout(send, 1000);
  };
  send();
}

// Nouvelle version prête : appliquée d'office en tout début de session, proposée sinon.
const watched = new WeakSet();
function whenInstalled(worker) {
  if (watched.has(worker)) return;
  watched.add(worker);
  const on = () => {
    if (worker.state !== 'installed') return;
    worker.removeEventListener('statechange', on);
    if (!navigator.serviceWorker.controller) return;           // première installation : rien à faire
    if (!interacted && performance.now() < 10000) skipWaiting(worker);
    else if (offerUpdate) offerUpdate(() => skipWaiting(worker));
  };
  worker.addEventListener('statechange', on);
  on();
}

// À appeler au tout début. Renvoie true si un rechargement vers la nouvelle version est lancé.
export async function applyWaitingUpdate() {
  if (!swSupported()) return false;
  hadController = !!navigator.serviceWorker.controller;
  if (!hadController) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    if (reg.waiting) { skipWaiting(reg.waiting); return true; }
    if (reg.installing) whenInstalled(reg.installing);
  } catch (e) { /* rien */ }
  return false;
}

// La page affichée vient-elle d'une version plus ancienne que le service worker actif ?
// (il a pu s'activer pendant le chargement) → on recharge une fois sur la nouvelle version.
function pageVersion() { const m = document.querySelector('meta[name="ms-version"]'); return m ? m.content : ''; }
function askVersion(worker, ms = 800) {
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const t = setTimeout(() => resolve(null), ms);
    ch.port1.onmessage = (e) => { clearTimeout(t); resolve(e.data); };
    try { worker.postMessage({ type: 'VERSION' }, [ch.port2]); } catch (e) { clearTimeout(t); resolve(null); }
  });
}
export async function reloadIfStale() {
  if (!swSupported() || !navigator.serviceWorker.controller) return false;
  const mine = pageVersion();
  if (!mine || mine.startsWith('__')) return false;
  const active = await askVersion(navigator.serviceWorker.controller);
  if (!active || active === mine) return false;
  try { if (sessionStorage.getItem('ms-reload-for') === active) return false; sessionStorage.setItem('ms-reload-for', active); } catch (e) { return false; }
  location.reload();
  return true;
}

// onUpdateReady(apply) : affiche le bandeau « nouvelle version » ; apply() l'installe.
export function registerSW(onUpdateReady) {
  if (!swSupported()) return;
  offerUpdate = onUpdateReady;
  hadController = hadController || !!navigator.serviceWorker.controller;
  listenControllerChange();
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) onUpdateReady(() => skipWaiting(reg.waiting));
    if (reg.installing) whenInstalled(reg.installing);
    reg.addEventListener('updatefound', () => { if (reg.installing) whenInstalled(reg.installing); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch((e) => console.warn('[pwa] service worker non enregistré', e));
}
