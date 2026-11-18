// Petits outils d'interface partagés par l'éditeur de programme et la saisie des séries.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const REDUCED = typeof window !== 'undefined' && !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export const ICON = {
  dumbbell: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg>',
  zoom: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
  close: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  back: '<svg width="9" height="14" viewBox="0 0 9 14" aria-hidden="true"><path d="M7.5 1.5 2 7l5.5 5.5" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
  chev: '<svg width="8" height="13" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5 6.5 6.5l-5 5" stroke="currentColor" stroke-width="1.7" fill="none"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.5v11M1.5 7h11" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  grip: '<svg width="12" height="18" viewBox="0 0 12 18" aria-hidden="true"><g fill="currentColor"><circle cx="3.5" cy="4" r="1.5"/><circle cx="8.5" cy="4" r="1.5"/><circle cx="3.5" cy="9" r="1.5"/><circle cx="8.5" cy="9" r="1.5"/><circle cx="3.5" cy="14" r="1.5"/><circle cx="8.5" cy="14" r="1.5"/></g></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
  up: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v8M2.5 6.5 6 10l3.5-3.5" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  swap: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/></svg>',
  gear: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
};

// ---- Fenêtres empilées (plein écran ou feuille du bas) ----
const stack = [];
function lock(on) { document.documentElement.classList.toggle('tr-lock', on); }

// Ouvre `node` par-dessus l'app. Renvoie close(). Échap et clic sur le fond (feuilles) ferment ;
// avec guard, ils appellent guard() à la place (qui peut demander avant de fermer).
export function openLayer(node, { sheet = true, onClose = null, label = '', guard = null } = {}) {
  const back = document.createElement('div');
  back.className = sheet ? 'modal tr-modal' : 'tr-full';
  back.setAttribute('role', 'dialog');
  back.setAttribute('aria-modal', 'true');
  if (label) back.setAttribute('aria-label', label);
  back.appendChild(node);
  const prevFocus = document.activeElement;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    back.classList.add('out');
    setTimeout(() => back.remove(), REDUCED ? 0 : 180);
    if (!stack.length) lock(false);
    if (prevFocus && prevFocus.focus && document.contains(prevFocus)) { try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* rien */ } }
    if (onClose) onClose();
  };
  const entry = { back, close, guard };
  if (sheet) back.addEventListener('pointerdown', (e) => { if (e.target === back) back._down = true; });
  if (sheet) back.addEventListener('click', (e) => { if (e.target === back && back._down) (guard || close)(); back._down = false; });
  stack.push(entry);
  lock(true);
  document.body.appendChild(back);
  requestAnimationFrame(() => {
    back.classList.add('in');
    const f = node.querySelector('[data-autofocus]') || node.querySelector('button, input, [tabindex="0"]');
    if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* rien */ } }
  });
  return close;
}
export function topLayer() { return stack[stack.length - 1] || null; }

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !stack.length) return;
    e.stopPropagation();
    const t = stack[stack.length - 1];
    (t.guard || t.close)();
  }, true);
}

// Question oui / non dans l'app (pas de fenêtre du navigateur)
export function ask({ title, text = '', ok = 'Confirmer', cancel = 'Annuler', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const node = el(`<div class="sheet tr-sheet tr-ask">
      <p class="ask-t">${esc(title)}</p>${text ? `<p class="ask-p">${esc(text)}</p>` : ''}
      <div class="ask-b"><button type="button" class="tr-btn ghost" data-a="0">${esc(cancel)}</button><button type="button" class="tr-btn${danger ? ' danger' : ''}" data-a="1" data-autofocus>${esc(ok)}</button></div></div>`);
    const close = openLayer(node, { onClose: () => { if (!answered) resolve(false); }, label: title });
    node.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      answered = true;
      resolve(b.dataset.a === '1');
      close();
    });
  });
}

// Petit message en bas de l'écran
let toastT = null;
export function toast(msg) {
  let t = document.getElementById('trToast');
  if (!t) { t = el('<div id="trToast" class="tr-toast" role="status" aria-live="polite"></div>'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
}
