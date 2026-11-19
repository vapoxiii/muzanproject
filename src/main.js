// Démarrage de l'app.
// 1. stockage local (IndexedDB) + reprise automatique des données de l'ancienne version ;
// 2. photos, compte, première synchro (si un compte est connecté) ;
// 3. le code de l'app (src/legacy), qui lit tout de façon synchrone comme avant ;
// 4. interface du compte, service worker.

import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/inter/latin-900.css';
import './styles/app.css';
import './styles/cloud.css';
import './styles/training.css';
import './styles/social.css';

import { applyWaitingUpdate, reloadIfStale, registerSW } from './core/pwa.js';
import { initStorage, storageInfo } from './core/storage.js';
import { initPhotos, importLegacyPhotos } from './core/photos.js';
import { initAuth } from './core/auth.js';
import { startCloud, syncRunning } from './core/cloud.js';
import { clearRemoteChanged, sync } from './core/sync.js';
import { auth } from './core/auth.js';
import { MS } from './core/bridge.js';
import { mountCloudUI, showUpdateBanner, showFatal } from './ui/account.js';
import { splashOut } from './ui/brand.js';
import { APP_VERSION } from './core/config.js';

const root = document.documentElement;
// Aperçu de test publié dans Claude (npm run apercu) : pas de service worker, données d'exemple
const APERCU = import.meta.env.VITE_APERCU === '1';

async function boot() {
  // une nouvelle version déjà téléchargée : on l'applique avant d'ouvrir l'app
  // (si la bascule tarde, l'app démarre quand même et repropose la mise à jour)
  if (!APERCU) {
    if (await applyWaitingUpdate()) await new Promise((r) => setTimeout(r, 1500));
    else if (await reloadIfStale()) await new Promise((r) => setTimeout(r, 1500));
  }

  await initStorage({ onLegacyPhotos: importLegacyPhotos });
  await initPhotos();
  const apercu = APERCU ? await import('./apercu/index.js') : null;
  if (apercu) apercu.seedIfEmpty();
  await initAuth();
  await startCloud({ initialTimeout: 1200 });
  const pulledBeforeStart = !syncRunning();

  try {
    await import('virtual:legacy-app');
  } catch (e) {
    console.error(e);
    showFatal(e);
    return;
  } finally {
    root.classList.remove('boot');
    splashOut();
  }
  const ver = document.getElementById('pfVer');
  if (ver) ver.textContent = 'Version ' + APP_VERSION;
  // les données reçues avant le démarrage sont déjà affichées : pas de bandeau « actualiser »
  if (pulledBeforeStart) clearRemoteChanged();

  mountCloudUI({ storageInfo });
  MS.debug = { sync, auth, storageInfo };     // état interne, consultable depuis la console
  if (apercu) apercu.mountApercu();
  else registerSW(showUpdateBanner);
}

boot().catch((e) => { console.error(e); root.classList.remove('boot'); splashOut(); showFatal(e); });
