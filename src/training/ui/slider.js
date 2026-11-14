// Curseur à règle (une ou deux poignées), dans le style de la règle de l'onboarding.
// Doigt ou souris : glisser n'importe où sur la règle (la poignée la plus proche suit).
// Clavier : flèches (un cran), Page haut / bas (5 crans), Début / Fin.

import { esc } from './dom.js';

export function slider({ label, min, max, step = 1, value, fmt = String, every = null, minor = null, labelFmt = String,
  onInput = null, onChange = null, names = null, cls = '' }) {
  const dual = Array.isArray(value);
  let vals = dual ? value.slice() : [value];
  const span = max - min;
  const pct = (v) => ((v - min) / span) * 100;

  const root = document.createElement('div');
  root.className = 'tsl' + (dual ? ' dual' : '') + (cls ? ' ' + cls : '');
  let ticks = '';
  if (minor) for (let t = min; t <= max + 1e-9; t += minor) ticks += `<line x1="${(pct(t) * 10).toFixed(1)}" x2="${(pct(t) * 10).toFixed(1)}" y1="${every && Math.abs(((t - min) / every) - Math.round((t - min) / every)) < 1e-6 ? 2 : 8}" y2="16"/>`;
  let labels = '';
  if (every) for (let t = min; t <= max + 1e-9; t += every) labels += `<span style="left:${pct(t).toFixed(3)}%">${esc(labelFmt(t))}</span>`;
  const knobNames = names || (dual ? [label + ' minimum', label + ' maximum'] : [label]);
  root.innerHTML = `<div class="tsl-h"><span class="tsl-k">${esc(label)}</span><output class="tsl-v"></output></div>
    <div class="tsl-r"><svg class="tsl-tk" viewBox="0 0 1000 18" preserveAspectRatio="none" aria-hidden="true">${ticks}</svg>
    <i class="tsl-line"></i><i class="tsl-fill"></i>
    ${vals.map((_, i) => `<span class="tsl-kn" role="slider" tabindex="0" data-i="${i}" aria-label="${esc(knobNames[i])}" aria-valuemin="${min}" aria-valuemax="${max}"></span>`).join('')}</div>
    ${labels ? `<div class="tsl-lb" aria-hidden="true">${labels}</div>` : ''}`;
  const out = root.querySelector('.tsl-v'), track = root.querySelector('.tsl-r'), fill = root.querySelector('.tsl-fill');
  const knobs = [...root.querySelectorAll('.tsl-kn')];

  const snap = (v) => Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step));
  const get = () => (dual ? vals.slice() : vals[0]);
  function paint() {
    knobs.forEach((k, i) => {
      k.style.left = pct(vals[i]) + '%';
      k.setAttribute('aria-valuenow', String(vals[i]));
      k.setAttribute('aria-valuetext', fmt(vals[i]));
    });
    const a = dual ? pct(vals[0]) : 0, b = pct(vals[dual ? 1 : 0]);
    fill.style.left = a + '%';
    fill.style.width = Math.max(0, b - a) + '%';
    out.textContent = dual ? (vals[0] === vals[1] ? fmt(vals[0]) : fmt(vals[0]) + ' – ' + fmt(vals[1])) : fmt(vals[0]);
  }
  function setVal(i, v) {
    v = snap(v);
    if (dual) v = i === 0 ? Math.min(v, vals[1]) : Math.max(v, vals[0]);
    if (v === vals[i]) return false;
    vals[i] = v;
    paint();
    if (onInput) onInput(get());
    return true;
  }
  const valueAt = (x) => { const r = track.getBoundingClientRect(); return min + Math.min(1, Math.max(0, (x - r.left) / r.width)) * span; };

  let active = null, moved = false;
  track.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const v = valueAt(e.clientX);
    let i = 0;
    if (dual) {
      const d0 = Math.abs(v - vals[0]), d1 = Math.abs(v - vals[1]);
      i = d0 < d1 ? 0 : d1 < d0 ? 1 : v < vals[0] ? 0 : 1;
    }
    active = i;
    moved = setVal(i, v);
    try { track.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
    root.classList.add('drag');
    knobs[i].classList.add('on');
  });
  track.addEventListener('pointermove', (e) => { if (active != null && setVal(active, valueAt(e.clientX))) moved = true; });
  const end = () => {
    if (active == null) return;
    knobs[active].classList.remove('on');
    active = null;
    root.classList.remove('drag');
    if (moved && onChange) onChange(get());
    moved = false;
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('lostpointercapture', end);
  knobs.forEach((k, i) => k.addEventListener('keydown', (e) => {
    const big = step * 5;
    const d = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: big, PageDown: -big }[e.key];
    let ok = false;
    if (d != null) ok = setVal(i, vals[i] + d);
    else if (e.key === 'Home') ok = setVal(i, min);
    else if (e.key === 'End') ok = setVal(i, max);
    else return;
    e.preventDefault();
    if (ok && onChange) onChange(get());
  }));

  root.set = (v) => { vals = dual ? v.slice() : [v]; paint(); };
  root.get = get;
  paint();
  return root;
}
