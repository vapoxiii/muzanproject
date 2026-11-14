// Orchestration du compte et de la synchronisation : quand synchroniser, et avec quoi.
//  - au démarrage, si un compte est connecté : une synchro, attendue au plus ~1 s pour que
//    l'app s'ouvre sur des données à jour (sinon elle s'ouvre tout de suite, hors ligne) ;
//  - après chaque modification (regroupées, 2,5 s) ;
//  - au retour du réseau, au retour dans l'app, toutes les 2 minutes si elle reste ouverte ;
//  - en quittant l'app (envoi des derniers changements).

import { CLOUD_ENABLED } from './config.js';
import { auth, onAuthChange, getClient, refreshAccount } from './auth.js';
import { startSync, stopSync, syncNow, sync, syncActive } from './sync.js';
import { supabaseRemote } from './remote.js';
import { onStoreChange, isSyncable } from './storage.js';
import { onPhotosChange } from './photos.js';

let debounceT = null;
let connectedUser = null;
let started = false;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function schedule(ms = 2500) {
  if (!syncActive()) return;
  clearTimeout(debounceT);
  debounceT = setTimeout(() => { syncNow(); }, ms);
}

let connecting = null;
function connect(user) {
  if (connectedUser === user.id && syncActive()) return Promise.resolve();
  if (!connecting) {
    connecting = (async () => {
      const c = await getClient();
      await startSync(supabaseRemote(c, user.id), user.id);
      connectedUser = user.id;
    })().finally(() => { connecting = null; });
  }
  return connecting;
}

// Après une connexion : branche la synchro et attend le premier passage complet.
export async function connectAndSync() {
  if (!auth.user) return null;
  await connect(auth.user);
  return syncNow();
}

let lastUser = null;
async function onAuth(a) {
  const id = a.user ? a.user.id : null;
  if (id === lastUser) return;
  lastUser = id;
  if (a.user) {
    try { await connect(a.user); } catch (e) { console.error('[compte]', e); return; }
    syncNow();
    refreshAccount().catch(() => {});
  } else {
    connectedUser = null;
    stopSync();
  }
}

export async function startCloud({ initialTimeout = 1200 } = {}) {
  if (!CLOUD_ENABLED || started) return;
  started = true;
  onAuthChange(onAuth);
  onStoreChange(({ keys, source }) => { if (source === 'local' && keys.some(isSyncable)) schedule(); });
  onPhotosChange(({ source }) => { if (source === 'local' || source === 'import') schedule(); });
  window.addEventListener('online', () => schedule(300));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { clearTimeout(debounceT); syncNow(); }
    else if (!sync.lastAt || Date.now() - sync.lastAt > 30000) schedule(400);
  });
  setInterval(() => { if (document.visibilityState === 'visible') schedule(0); }, 120000);
  if (auth.user) {
    lastUser = auth.user.id;
    try {
      await connect(auth.user);
      await Promise.race([syncNow(), wait(initialTimeout)]);
    } catch (e) { console.warn('[synchro] démarrage hors ligne', e); }
    refreshAccount().catch(() => {});
  }
}

export function syncRunning() { return sync.state === 'syncing'; }
