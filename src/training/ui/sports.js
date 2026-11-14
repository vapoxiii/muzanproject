// Sports dans l'interface : le catalogue (catégories, recherche, sport créé) et les réglages d'un
// sport du programme (jours, durée d'une séance, intensité, dépense estimée).
import * as TR from '../index.js';
import { esc, el, ICON, openLayer, ask, toast } from './dom.js';
import { slider } from './slider.js';
import { daysRow, freeDay } from './days.js';

const clone = (o) => structuredClone(o);
const icon = (sp) => `<span class="ex-th none sp-th" aria-hidden="true">${TR.sportIcon(sp, 22)}</span>`;

// Catalogue. onPick(entrée) : { id } pour un sport du catalogue, { id: 'u…', n, c, met } pour un
// sport créé ; la feuille se ferme après le choix. mine : sports déjà dans le programme.
export function openSportPicker({ title = 'Ajouter un sport', mine = [], weight = null, onPick = null } = {}) {
  let q = '', cat = '', creating = false;
  const node = el(`<div class="sheet tr-sheet pk spk">
    <div class="sheeth"><span class="st">${esc(title)}</span><button type="button" class="pk-done" data-act="close">Fermer</button></div>
    <label class="pk-q">${ICON.search}<input type="search" id="spkQ" placeholder="Chercher : foot, boxe, yoga…" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="Chercher un sport"></label>
    <div class="pk-chips" role="group" aria-label="Catégorie"><button type="button" data-c="" aria-pressed="true">Tous</button>${TR.SPORT_CAT_IDS.map((k) => `<button type="button" data-c="${k}" aria-pressed="false">${esc(TR.SPORT_CATS[k].n)}</button>`).join('')}</div>
    <p class="pk-n" aria-live="polite"></p>
    <div class="pk-res"></div>
    <div class="pk-new"></div>
  </div>`);
  const close = openLayer(node, { label: title });
  const input = node.querySelector('#spkQ'), res = node.querySelector('.pk-res'), count = node.querySelector('.pk-n'), nw = node.querySelector('.pk-new');

  const item = (s) => {
    const sp = TR.sportOf({ id: s.id }), here = mine.includes(s.id);
    const meta = [TR.SPORT_CATS[s.c].s, '≈ ' + TR.fmtMin(sp.min), '+' + TR.sportKcal(sp, weight) + ' kcal'];
    return `<button type="button" class="pk-it${here ? ' on' : ''}" data-s="${esc(s.id)}">${icon(sp)}
      <span class="pk-t"><b>${esc(s.n)}</b><span>${esc(meta.join(' · '))}${here ? ' · dans ton programme' : ''}</span></span>
      <span class="pk-add" aria-hidden="true">${here ? ICON.check : ICON.plus}</span></button>`;
  };
  const group = (title, list) => (list.length ? `<p class="pk-g">${esc(title)} <span>${list.length}</span></p>` + list.map(item).join('') : '');

  function draw() {
    const list = TR.searchSports(q, { c: cat });
    count.textContent = list.length ? list.length + ' sport' + (list.length > 1 ? 's' : '') : 'Aucun sport trouvé';
    let html;
    if (q.trim() || cat) html = list.map(item).join('');
    else html = group('Les plus pratiqués', TR.POPULAR.map(TR.sportById)) + TR.SPORT_CAT_IDS.map((k) => group(TR.SPORT_CATS[k].n, list.filter((s) => s.c === k))).join('');
    res.innerHTML = html;
    const qt = input.value.trim();
    nw.innerHTML = creating ? newForm(qt)
      : qt.length >= 2 ? `<button type="button" class="tr-btn ghost wide" data-act="new">${ICON.plus}<span>Créer « ${esc(qt)} »</span></button>`
        : '<p class="spk-tip">Ton sport n’y est pas ? Tape son nom pour le créer.</p>';
  }
  function newForm(name) {
    return `<div class="pk-form"><p class="pe-lab">Nouveau sport</p>
      <input type="text" id="spkName" value="${esc(name)}" maxlength="40" aria-label="Nom du sport" autocomplete="off">
      <p class="pe-lab">Effort habituel</p>
      <div class="xs-modes" role="group" aria-label="Effort habituel">${TR.CUSTOM_MET.map(([l, m], i) => `<button type="button" data-met="${m}" aria-pressed="${i === 1}">${l}</button>`).join('')}</div>
      <p class="pe-lab">Catégorie</p>
      <div class="pk-chips sm wrap" role="group" aria-label="Catégorie du sport">${TR.SPORT_CAT_IDS.map((k) => `<button type="button" data-nc="${k}" aria-pressed="${k === (cat || 'autre')}">${esc(TR.SPORT_CATS[k].n)}</button>`).join('')}</div>
      <button type="button" class="tr-btn wide" data-act="create">Créer et ajouter</button></div>`;
  }
  const pick = (entry) => { close(); if (onPick) onPick(entry); };

  let t = null;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { q = input.value; creating = false; draw(); }, 60); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  node.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'close') { close(); return; }
    if (b.dataset.c != null) { cat = b.dataset.c; node.querySelectorAll('[data-c]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); res.scrollTop = 0; draw(); return; }
    if (b.dataset.met) { node.querySelectorAll('[data-met]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); return; }
    if (b.dataset.nc) { node.querySelectorAll('[data-nc]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); return; }
    if (b.dataset.act === 'new') { creating = true; draw(); const f = node.querySelector('#spkName'); if (f) f.focus(); return; }
    if (b.dataset.act === 'create') {
      const name = (node.querySelector('#spkName').value || '').trim();
      if (!name) return;
      const met = +((node.querySelector('[data-met][aria-pressed="true"]') || {}).dataset?.met || 5.5);
      const c = (node.querySelector('[data-nc][aria-pressed="true"]') || {}).dataset?.nc || 'autre';
      pick({ id: TR.newId('u'), n: name.slice(0, 40), c, met });
      return;
    }
    if (b.dataset.s) pick({ id: b.dataset.s });
  });
  draw();
  return close;
}

// Réglages d'un sport du programme. ctx : comme l'éditeur (program, save, weight).
export function openSportSheet(ctx, id, { onChange = null } = {}) {
  let P = clone(ctx.program());
  if (!TR.sportEntry(P, id)) return null;
  const node = el('<div class="sheet tr-sheet xs sps"></div>');
  const close = openLayer(node, { label: 'Réglages du sport' });
  const entry = () => TR.sportEntry(P, id);
  const weight = () => (ctx.weight ? ctx.weight() : null);
  const save = () => { P = clone(ctx.save(P)); if (onChange) onChange(); };
  const kcalText = (sp) => '≈ ' + TR.sportKcal(sp, weight()) + ' kcal de plus le jour où tu en fais';

  function head() {
    const sp = TR.sportOf(entry());
    node.querySelector('.sps-k').textContent = kcalText(sp);
    node.querySelectorAll('[data-int]').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.int === sp.int)));
  }
  function render() {
    const e = entry();
    if (!e) { close(); return; }
    const sp = TR.sportOf(e), n = e.days.length;
    node.innerHTML = `<div class="sheeth"><span class="st">${esc(sp.n)}</span><button type="button" data-act="close" aria-label="Fermer">${ICON.close}</button></div>
      <p class="xs-meta sps-c">${TR.sportIcon(sp, 15)}<span>${esc(TR.SPORT_CATS[sp.c].n)}</span></p>
      ${sp.custom ? `<label class="xs-name"><span>Nom</span><input type="text" id="spsName" value="${esc(sp.n)}" maxlength="40" autocomplete="off"></label>` : ''}
      <p class="pe-lab">Jours</p>${daysRow(P, 'sp:' + id, e.days)}
      <p class="pe-note">${n ? (n > 1 ? n + ' fois' : 'Une fois') + ' par semaine.' : 'Aucun jour pour l’instant : touche un jour pour le placer dans ta semaine.'}</p>
      <div class="xs-sl"></div>
      <p class="pe-lab">Intensité</p>
      <div class="xs-modes" role="group" aria-label="Intensité">${TR.INTENSITY.map((x) => `<button type="button" data-int="${x.k}" aria-pressed="${sp.int === x.k}">${x.n}</button>`).join('')}</div>
      <p class="sps-k" aria-live="polite"></p>
      <p class="pe-note">Ajoutées à ton objectif quand tu le coches dans Activité du jour, en Nutrition. Selon la durée, l’intensité et ton poids.</p>
      <button type="button" class="pe-del" data-act="del">Retirer du programme</button>`;
    node.querySelector('.xs-sl').appendChild(slider({ label: 'Durée d’une séance', min: 5, max: 300, step: 5, value: Math.min(300, sp.min), fmt: TR.fmtMin,
      onInput: (v) => { const x = entry(); if (!x) return; if (v === (TR.sportById(id) || { min: 60 }).min) delete x.min; else x.min = v; head(); },
      onChange: save }));
    const nm = node.querySelector('#spsName');
    if (nm) {
      nm.addEventListener('change', () => { const v = nm.value.trim(); const x = entry(); if (v && x) { x.n = v; save(); node.querySelector('.st').textContent = v; } else nm.value = TR.sportOf(x).n; });
      nm.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); nm.blur(); } });
    }
    head();
  }
  node.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'close') { close(); return; }
    if (b.dataset.day != null) { TR.setDay(P, b.dataset.owner, +b.dataset.day, b.getAttribute('aria-pressed') !== 'true'); save(); render(); return; }
    if (b.dataset.int != null) { const x = entry(); if (!x) return; const k = +b.dataset.int; if (k === 1) delete x.int; else x.int = k; save(); head(); return; }
    if (b.dataset.act === 'del') {
      const sp = TR.sportOf(entry());
      const ok = await ask({ title: 'Retirer ' + TR.sportThe(sp) + ' ?', text: 'Les semaines passées le gardent dans leur historique.', ok: 'Retirer', danger: true });
      if (!ok) return;
      P.sports = TR.sportsList(P).filter((x) => x.id !== id);
      save();
      toast(sp.n + ' n’est plus dans ton programme');      // (sans accord : « natation », « foot », « claquettes »)
      close();
    }
  });
  render();
  return close;
}

// Ajouter un sport au programme : le catalogue, puis le sport posé sur un jour libre (de préférence
// en fin de semaine), puis ses réglages. Déjà dans le programme : ses réglages directement.
export function addSportFlow(ctx, { onChange = null } = {}) {
  const P0 = ctx.program();
  return openSportPicker({ mine: TR.sportsList(P0).map((e) => e.id), weight: ctx.weight ? ctx.weight() : null, onPick: (entry) => {
    let P = clone(ctx.program());
    if (!TR.sportEntry(P, entry.id)) {
      const d = freeDay(P);
      P.sports = TR.sportsList(P).concat({ ...entry, days: d == null ? [] : [d] });
      P = ctx.save(P);
      const sp = TR.sportOf(TR.sportEntry(P, entry.id) || entry);
      toast(sp.n + ' rejoint ton programme' + (d == null ? '' : ', le ' + TR.DAY_NAMES[d]));
      if (onChange) onChange();
    }
    openSportSheet(ctx, entry.id, { onChange });
  } });
}
