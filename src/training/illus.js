// Illustrations des exercices : Ren fait le mouvement, le muscle travaillé brille en violet.
// Une image par exercice dans public/exos, nommée avec son empreinte (scripts/illustrations.py).
// Elles ne sont pas téléchargées à l'installation de l'app : le service worker les garde au premier
// affichage (cache « exos »), puis elles restent disponibles hors ligne.
import INDEX from './illus-index.json';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || './';

// Adresse de l'illustration d'un exercice de la bibliothèque, ou null s'il n'en a pas encore
export function illusSrc(id) { const f = id && INDEX[id]; return f ? BASE + 'exos/' + f : null; }
export function illusIds() { return Object.keys(INDEX); }
