// Pont entre le code d'origine (src/legacy, portée unique) et les modules du cœur.
// Le code d'origine n'importe que `MS` (et sget/sset/sdel/skeys) : tout le reste passe ici.

import { CLOUD_ENABLED } from './config.js';
import { aiCall, accountAiReady } from './ai.js';
import { photosAll, addPhoto, removePhoto } from './photos.js';
import { buildBackup, parseBackup, restoreBackup, downloadJSON } from './backup.js';
import { loadQuagga } from './quagga.js';
import { social } from '../social/api.js';

const hooks = { openAccount: null };

export const MS = {
  cloud: { enabled: CLOUD_ENABLED },
  ai: {
    call: (prompt, maxTokens, key, image) => aiCall(prompt, maxTokens, key, image),
    accountReady: () => accountAiReady(),
  },
  photos: {
    all: () => photosAll(),
    add: (blob, d) => addPhoto(blob, d),
    remove: (id) => removePhoto(id),
  },
  backup: {
    // Crée le fichier de sauvegarde et le propose au téléchargement. Renvoie { count, size }.
    async exportFile(filename) {
      const out = await buildBackup();
      const size = downloadJSON(out, filename);
      return { count: out.count, size };
    },
    parse: (text) => parseBackup(text),
    restore: (parsed) => restoreBackup(parsed),
  },
  loadQuagga: () => loadQuagga(),
  // le social (profils, abonnements, stories, messages) : src/social/api.js
  social,
  openAccount(opts) { if (hooks.openAccount) hooks.openAccount(opts || {}); },
};

export function setBridgeHook(name, fn) { hooks[name] = fn; }

if (typeof window !== 'undefined') window.MS = MS;   // pratique pour déboguer depuis la console
