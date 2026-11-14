// Illustrations dans l'interface : vignette d'un exercice (ou pictogramme s'il n'a pas encore son
// image) et grande image, ouverte d'un toucher.
import { illusSrc } from '../illus.js';
import { exoById, cibleName, EQUIP } from '../exercises.js';
import { el, esc, openLayer, ICON } from './dom.js';

// Vignette carrée ; sans illustration, un haltère sur le même fond (les lignes restent alignées)
export function thumb(xid, cls = '') {
  const src = illusSrc(xid);
  return `<span class="ex-th${src ? '' : ' none'}${cls ? ' ' + cls : ''}" aria-hidden="true">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : ICON.dumbbell}</span>`;
}

// Grande image : le geste, le muscle travaillé en violet, la cible et le matériel
export function openIllus(xid, { name = '' } = {}) {
  const src = illusSrc(xid);
  if (!src) return null;
  const x = exoById(xid);
  const title = name || (x ? x.n : 'Exercice');
  const meta = x ? [cibleName(x), EQUIP[x.e]].filter(Boolean).join(' · ') : '';
  const node = el(`<div class="sheet tr-sheet ilx">
    <div class="sheeth"><span class="st">${esc(title)}</span><button type="button" data-act="close" aria-label="Fermer">${ICON.close}</button></div>
    <div class="ilx-img"><img src="${esc(src)}" alt="${esc('Ren fait l’exercice : ' + title)}" decoding="async"></div>
    ${meta ? `<p class="ilx-m">${esc(meta)}</p>` : ''}
    <p class="ilx-n"><i aria-hidden="true"></i>Le muscle travaillé brille en violet.</p>
  </div>`);
  const close = openLayer(node, { label: title });
  node.addEventListener('click', (e) => { if (e.target.closest('[data-act="close"]')) close(); });
  return close;
}

// Hors ligne, une illustration jamais affichée n'est pas encore gardée : on cache l'image cassée
// (le fond de la vignette reste, sans icône d'erreur du navigateur).
if (typeof document !== 'undefined') {
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.closest('.ex-th, .lg-ill, .xs-ill, .ilx-img')) t.style.visibility = 'hidden';
  }, true);
}
