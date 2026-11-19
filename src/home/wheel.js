// Roue de l'accueil : six parts autour du personnage, comme une roue d'armes de jeu vidéo.
// Toucher le personnage l'ouvre, toucher une part y mène. On peut aussi appuyer sur le personnage,
// glisser jusqu'à une part et lâcher. Au clavier : Entrée ou Espace l'ouvre, les flèches passent
// d'une part à l'autre, Échap la referme. Le reste de l'accueil est voilé pendant ce temps.
// Importé par le code d'origine sous le nom HOME (voir vite.config.js).

const SVGNS = 'http://www.w3.org/2000/svg';
const ICONS = {
  progress: '<path d="M4 19.5h16M6 15.5l4-4.2 3 3 5.5-6.3M14.5 8h4v4"/>',
  training: '<path d="M7 7.5v9M17 7.5v9M4.5 10v4M19.5 10v4M7 12h10"/>',
  sports: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.4l3.1 2.3-1.2 3.6h-3.8l-1.2-3.6zM12 3.5v4.9M15.1 10.7l4.5-1.6M13.9 14.3l2.7 3.9M10.1 14.3l-2.7 3.9M8.9 10.7 4.4 9.1"/>',
  body: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9.5a4.5 4.5 0 0 1 6 0M12 9.8l1.3-1.6"/>',
  profile: '<circle cx="12" cy="8.2" r="3.6"/><path d="M5 20c1.1-3.6 3.9-5.6 7-5.6s5.9 2 7 5.6"/>',
  social: '<circle cx="9" cy="8.6" r="3.2"/><path d="M3.4 19.2c.9-3.3 3-5 5.6-5s4.7 1.7 5.6 5"/><circle cx="16.7" cy="9.6" r="2.5"/><path d="M15.6 14.5c2.5-.4 4.4 1.1 5.2 4.1"/>',
  nutrition: '<path d="M7 3.5v7.5M5 3.5V8a2 2 0 0 0 4 0V3.5M7 11v9.5M16.5 3.5c-1.8 0-3 2.2-3 5.2 0 2.6 1.2 3.8 3 3.8v8"/>',
};
export const partIcon = (k, size = 24) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ''}</svg>`;

// Les parts, dans le sens des aiguilles d'une montre depuis le haut. a : angle du milieu de la
// part, en degrés (0 à droite, 90 en haut). Nutrition à gauche, Training à droite, Progression en haut.
// Le Profil est dans la barre du bas : sa part est devenue le Social (stories, messages, amis).
export const WHEEL_PARTS = [
  { k: 'progress', n: 'Progression', a: 90 },
  { k: 'training', n: 'Training', a: 30 },
  { k: 'sports', n: 'Sports', a: -30 },
  { k: 'body', n: 'Corps', a: -90 },
  { k: 'social', n: 'Social', a: -150 },
  { k: 'nutrition', n: 'Nutrition', a: 150 },
];
const GAP = 1.5;      // demi-écart entre deux parts, en degrés

export function polar(r, a) { const t = a * Math.PI / 180; return [r * Math.cos(t), -r * Math.sin(t)]; }

// Part d'anneau entre les rayons r0 et r1, de l'angle a0 à a1 (degrés, a0 < a1)
export function sectorPath(r0, r1, a0, a1) {
  const f = (p) => p.map((v) => +v.toFixed(2)).join(',');
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${f(polar(r1, a0))} A${r1},${r1} 0 ${large} 0 ${f(polar(r1, a1))} L${f(polar(r0, a1))} A${r0},${r0} 0 ${large} 1 ${f(polar(r0, a0))} Z`;
}

// Part sous le doigt. dx vers la droite, dy vers le haut, depuis le centre de la roue. Rien sur le
// personnage du centre, ni trop loin de l'anneau (slop : marge autour du bord extérieur).
export function partAt(dx, dy, r0, r1, parts = WHEEL_PARTS, slop = 30) {
  const d = Math.hypot(dx, dy);
  if (d < r0 || d > r1 + slop) return null;
  const a = Math.atan2(dy, dx) * 180 / Math.PI;
  let best = null, gap = Infinity;
  for (const p of parts) {
    const g = Math.abs((((a - p.a) % 360) + 540) % 360 - 180);
    if (g < gap) { gap = g; best = p; }
  }
  return best;
}

// Taille et centre de la roue dans l'accueil (w × h) : aussi grande que possible sans déborder,
// centrée sur le buste du personnage, avec la place du titre au-dessus.
export function wheelLayout(w, h) {
  const d = Math.round(Math.max(240, Math.min(w - 24, 380, h * 0.56)));
  const r1 = d / 2, r0 = Math.round(d * 0.2);
  const cy = Math.round(Math.min(h - r1 - 20, Math.max(r1 + 72, h * 0.47)));
  return { d, r0, r1, cx: Math.round(w / 2), cy };
}

const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

// host : l'accueil (la roue s'y place) ; trigger : le bouton du personnage.
// centerSrc() : image du personnage au centre ; onPick(k) : une part choisie ; onToggle(ouverte).
export function mountWheel({ host, trigger, parts = WHEEL_PARTS, centerSrc = () => '', onPick = () => {}, onToggle = () => {} }) {
  const veil = el('div', 'wh-veil');
  const title = el('p', 'wh-title'); title.setAttribute('aria-hidden', 'true'); title.textContent = 'Où on va ?';
  const wheel = el('div', 'wh'); wheel.id = 'wheel'; wheel.setAttribute('role', 'menu'); wheel.setAttribute('aria-label', 'Où veux-tu aller ?');
  wheel.inert = true;
  const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('class', 'wh-pie');
  wheel.appendChild(svg);
  let open = false, hot = null, openedAt = 0, geo = null;

  const items = parts.map((p) => {
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'wh-sl'); g.setAttribute('role', 'menuitem'); g.setAttribute('tabindex', '-1'); g.setAttribute('aria-label', p.n);
    g.dataset.go = p.k;
    const path = document.createElementNS(SVGNS, 'path'); g.appendChild(path); svg.appendChild(g);
    const lab = el('span', 'wh-l'); lab.setAttribute('aria-hidden', 'true'); lab.dataset.go = p.k; lab.innerHTML = partIcon(p.k, 26) + '<span>' + p.n + '</span>';
    wheel.appendChild(lab);
    const it = { ...p, g, path, lab };
    g.addEventListener('click', () => choose(it));
    g.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setHot(it); });
    g.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && hot === it) setHot(null); });
    g.addEventListener('focus', () => setHot(it));
    return it;
  });
  const mid = el('button', 'wh-mid'); mid.type = 'button'; mid.setAttribute('aria-label', 'Fermer la roue');
  const midImg = el('img'); midImg.alt = ''; mid.appendChild(midImg); wheel.appendChild(mid);
  host.append(veil, title, wheel);

  function layout() {
    geo = wheelLayout(host.clientWidth, host.clientHeight);
    const { d, r0, r1, cy } = geo;
    wheel.style.setProperty('--d', d + 'px'); wheel.style.setProperty('--r0', r0 + 'px'); wheel.style.top = cy + 'px';
    title.style.top = (cy - r1 - 50) + 'px';
    svg.setAttribute('viewBox', `${-r1} ${-r1} ${d} ${d}`);
    const half = 180 / items.length - GAP, rm = (r0 + r1) / 2 + 6;
    for (const it of items) {
      it.path.setAttribute('d', sectorPath(r0, r1, it.a - half, it.a + half));
      const [x, y] = polar(rm, it.a);
      it.lab.style.left = (r1 + x) + 'px'; it.lab.style.top = (r1 + y) + 'px';
    }
  }
  function setHot(it) {
    if (hot === it) return;
    if (hot) { hot.g.classList.remove('hot'); hot.lab.classList.remove('hot'); }
    hot = it;
    if (hot) { hot.g.classList.add('hot'); hot.lab.classList.add('hot'); }
    title.textContent = hot ? hot.n : 'Où on va ?';
  }
  function openWheel(focusFirst = false) {
    if (open) return;
    layout();
    const src = centerSrc(); if (src && midImg.getAttribute('src') !== src) midImg.src = src;
    open = true; openedAt = performance.now(); wheel.inert = false; setHot(null);
    trigger.setAttribute('aria-expanded', 'true');
    host.classList.add('wh-on');
    if (focusFirst) items[0].g.focus({ preventScroll: true });
    onToggle(true);
  }
  function closeWheel(focusTrigger = false) {
    if (!open) return;
    open = false; setHot(null); wheel.inert = true;
    trigger.setAttribute('aria-expanded', 'false');
    host.classList.remove('wh-on');
    if (focusTrigger) trigger.focus({ preventScroll: true });
    onToggle(false);
  }
  function choose(it) { closeWheel(false); onPick(it.k); }
  function pickAt(x, y) {
    if (!geo) return null;
    const r = wheel.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const p = partAt(x - cx, cy - y, geo.r0, geo.r1, parts);
    return p ? items.find((it) => it.k === p.k) : null;
  }

  // Le personnage : un toucher ouvre (au « click », dernier événement du toucher, pour qu'aucun clic
  // fantôme ne referme aussitôt) ; appuyer puis glisser ouvre aussi, et lâcher sur une part y va.
  let start = null, slide = false, eatClick = false, kbd = false;
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'wheel');
  trigger.addEventListener('pointerdown', (e) => {
    kbd = false;
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    try { trigger.setPointerCapture(e.pointerId); } catch { /* rien */ }
    trigger.classList.add('down'); start = { x: e.clientX, y: e.clientY }; slide = false;
  });
  trigger.addEventListener('pointermove', (e) => {
    if (!start) return;
    if (!slide && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 14) { slide = true; openWheel(); }
    if (slide) setHot(pickAt(e.clientX, e.clientY));
  });
  trigger.addEventListener('pointerup', () => {
    if (!start) return;
    trigger.classList.remove('down'); start = null;
    if (!slide) return;
    slide = false; eatClick = true; setTimeout(() => { eatClick = false; }, 400);
    if (hot) choose(hot);
  });
  trigger.addEventListener('pointercancel', () => { trigger.classList.remove('down'); start = null; slide = false; });
  trigger.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') kbd = true; });
  trigger.addEventListener('click', () => {
    if (eatClick) { eatClick = false; return; }
    if (open) closeWheel(); else openWheel(kbd);
    kbd = false;
  });
  veil.addEventListener('click', () => { if (performance.now() - openedAt > 300) closeWheel(); });
  mid.addEventListener('click', () => closeWheel(true));
  wheel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeWheel(true); return; }
    const i = items.findIndex((it) => it.g === document.activeElement);
    if (i < 0) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(items[i]); return; }
    const n = items.length;
    const j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1, Tab: e.shiftKey ? i - 1 : i + 1 }[e.key];
    if (j == null) return;
    e.preventDefault();
    items[(j + n) % n].g.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') closeWheel(true); });
  window.addEventListener('resize', () => { if (open) layout(); });

  return { open: openWheel, close: closeWheel, isOpen: () => open, layout };
}
