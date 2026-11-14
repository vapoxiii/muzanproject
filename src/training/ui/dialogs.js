// Saisie d'un nombre dans l'app (au curseur), à la place de la fenêtre prompt() du navigateur.
import { esc, el, openLayer } from './dom.js';
import { slider } from './slider.js';

export function askNumber({ title, text = '', value, min, max, step = 1, unit = '', ok = 'Enregistrer', fmt = null }) {
  return new Promise((resolve) => {
    let v = Math.min(max, Math.max(min, Math.round(value / step) * step)), answered = false;
    const show = fmt || ((x) => x.toLocaleString('fr-FR') + (unit ? ' ' + unit : ''));
    const node = el(`<div class="sheet tr-sheet tr-ask tr-num">
      <p class="ask-t">${esc(title)}</p>${text ? `<p class="ask-p">${esc(text)}</p>` : ''}
      <div class="num-sl"></div>
      <div class="num-st"><button type="button" class="tr-btn ghost" data-d="-1" aria-label="Moins ${step} ${esc(unit)}">− ${step.toLocaleString('fr-FR')}</button><button type="button" class="tr-btn ghost" data-d="1" aria-label="Plus ${step} ${esc(unit)}">+ ${step.toLocaleString('fr-FR')}</button></div>
      <div class="ask-b"><button type="button" class="tr-btn ghost" data-a="0">Annuler</button><button type="button" class="tr-btn" data-a="1">${esc(ok)}</button></div></div>`);
    const sl = slider({ label: title, min, max, step, value: v, fmt: show, minor: null, every: null, names: [title], onInput: (x) => { v = x; } });
    sl.classList.add('big');
    node.querySelector('.num-sl').appendChild(sl);
    const close = openLayer(node, { onClose: () => { if (!answered) resolve(null); }, label: title });
    node.addEventListener('click', (e) => {
      const d = e.target.closest('[data-d]');
      if (d) { v = Math.min(max, Math.max(min, v + (+d.dataset.d) * step)); sl.set(v); return; }
      const b = e.target.closest('[data-a]');
      if (!b) return;
      answered = true;
      resolve(b.dataset.a === '1' ? v : null);
      close();
    });
    setTimeout(() => { const k = node.querySelector('.tsl-kn'); if (k) try { k.focus({ preventScroll: true }); } catch (e) { /* rien */ } }, 50);
  });
}
