// Logo GRIND : le cœur (symbole, image fournie) et le texte GRIND (tracés SVG, police Saira).
// Déclinaisons et règles d'usage : dossier brand/ à la racine du projet.
//   - logo principal : cœur à gauche, texte à droite (brandMark)
//   - logo compact : cœur seul (brandMark({ text: false }))
// Importé par le code d'origine sous le nom BRAND (voir vite.config.js).
import HEART from '../assets/brand/grind-coeur.webp';
import WORD from '../assets/brand/grind-texte.svg';

export const BRAND_HEART = HEART;
export const BRAND_WORD = WORD;

// size : 's' (accueil, pied de page), 'm' (onboarding), 'l' (connexion)
export function brandMark({ size = 'm', text = true, cls = '' } = {}) {
  return `<span class="brand brand-${size}${cls ? ' ' + cls : ''}" role="img" aria-label="GRIND">`
    + `<img class="brand-h" src="${HEART}" alt="" decoding="async">`
    + (text ? `<img class="brand-w" src="${WORD}" alt="" decoding="async">` : '')
    + '</span>';
}

// Écran de lancement : reste au moins le temps d'un battement, puis s'efface vers l'accueil.
const SPLASH_MIN = 700;
export function splashOut() {
  const s = document.getElementById('splash');
  if (!s || s.dataset.out) return;
  s.dataset.out = '1';
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = reduced ? 0 : Math.max(0, SPLASH_MIN - performance.now());
  setTimeout(() => {
    s.classList.add('out');
    setTimeout(() => s.remove(), reduced ? 0 : 480);
  }, wait);
}
