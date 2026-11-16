// Constructeur de programme : séances, jours, exercices de la bibliothèque, réglages au curseur.
//
// ctx (fourni par l'app) :
//   program()  → programme actuel
//   save(p)    → enregistre (et applique à la semaine en cours) ; renvoie le programme vérifié
//   zones()    → zones prioritaires du profil (étiquette « Bras », « Jambes »…)
//   coach(h)   → facultatif : construire le programme avec le coach (voir coach.js), h = { onDone, openEditor }
//   coachCard() → { name, img } pour le bouton du coach
//   weight()   → facultatif : poids actuel, pour la dépense estimée des sports
//   onClose()  → facultatif

import * as TR from '../index.js';
import { esc, el, ICON, openLayer, ask, toast } from './dom.js';
import { slider } from './slider.js';
import { thumb, openIllus } from './illus.js';
import { daysRow } from './days.js';
import { openSportSheet, addSportFlow } from './sports.js';

const clone = (o) => structuredClone(o);

// Durée estimée d'une séance : séries × (effort + repos), plus l'échauffement
export function sessionMinutes(ses) {
  let sec = 0;
  for (const e of ses.ex) {
    const sets = (e.sets || 3) * (e.each ? 2 : 1);
    const work = e.mode === 't' ? (e.max ? 45 : ((e.lo ?? 30) + (e.hi ?? e.lo ?? 30)) / 2) : e.mode === 'd' ? 60 : 45;
    sec += sets * (work + (e.rest ?? 90));
  }
  return ses.ex.length ? Math.max(10, Math.round((sec / 60 + 5) / 5) * 5) : 0;
}

export function openEditor(ctx, { sid = null, pick = false } = {}) {
  let P = clone(ctx.program());
  let cur = sid;
  const node = el(`<div class="pe"><div class="pe-top"></div><div class="pe-body"></div></div>`);
  const top = node.querySelector('.pe-top'), body = node.querySelector('.pe-body');
  const close = openLayer(node, { sheet: false, label: 'Mon programme', onClose: () => ctx.onClose && ctx.onClose() });

  function commit(rerender = true) {
    P = clone(ctx.save(P));
    if (rerender) render();
  }

  function render() {
    if (cur && !TR.sessionById(P, cur)) cur = null;
    if (cur) renderSession(TR.sessionById(P, cur)); else renderHome();
  }

  function sesCard(s) {
    const n = s.ex.length, m = sessionMinutes(s);
    const meta = [s.sub, n + ' exercice' + (n > 1 ? 's' : ''), m ? '≈ ' + m + ' min' : ''].filter(Boolean).join(' · ');
    return `<div class="pe-ses" data-sid="${esc(s.id)}">
      <button type="button" class="pe-ses-m" data-open="${esc(s.id)}"><span class="pe-ses-t"><b>${esc(s.name)}</b><span>${esc(meta)}</span></span>${ICON.chev}</button>
      ${daysRow(P, s.id, s.days)}</div>`;
  }

  // un sport : son nom (réglages d'un toucher) et ses jours
  function spCard(e) {
    const sp = TR.sportOf(e), n = e.days.length;
    const meta = [sp.sub, n ? n + ' fois' : 'aucun jour', '≈ ' + TR.fmtMin(sp.min)].join(' · ');
    return `<div class="pe-sp" data-sp="${esc(e.id)}">
      <button type="button" class="pe-ses-m" data-sport="${esc(e.id)}"><span class="sp-ic" aria-hidden="true">${TR.sportIcon(sp, 18)}</span><span class="pe-sp-t"><b>${esc(sp.n)}</b><span>${esc(meta)}</span></span>${ICON.chev}</button>
      ${daysRow(P, 'sp:' + e.id, e.days)}</div>`;
  }

  function renderHome() {
    const main = TR.mainSessions(P), opt = TR.optSessions(P), sports = TR.sportsList(P), spTxt = TR.sportsText(P);
    top.innerHTML = `<button type="button" class="pe-ico" data-act="close" aria-label="Fermer">${ICON.close}</button><span class="pe-tt">Programme</span><button type="button" class="pe-ok" data-act="close">Terminé</button>`;
    const cc = ctx.coach && ctx.coachCard ? ctx.coachCard() : null;
    body.innerHTML = `<h1 class="pe-t">Mon programme</h1>
      <p class="pe-s">${esc(TR.countText(P))}${spTxt ? ' · ' + esc(spTxt) : ''}</p>
      ${cc ? `<button type="button" class="pe-coach" data-act="coach">${cc.img ? `<img src="${esc(cc.img)}" alt="">` : ''}<span><b>Construire avec ${esc(cc.name)}</b><span>Quelques questions, puis ${cc.name === 'Aya' ? 'elle' : 'il'} te propose des séances</span></span>${ICON.chev}</button>` : ''}
      <div class="pe-sec">${main.map(sesCard).join('') || '<p class="pe-empty">Aucune séance pour l’instant.</p>'}</div>
      <button type="button" class="pe-add" data-act="add-ses">${ICON.plus}<span>Nouvelle séance</span></button>
      ${opt.length ? `<h2 class="pe-h">En option</h2><div class="pe-sec">${opt.map(sesCard).join('')}</div>` : ''}
      <h2 class="pe-h">Sports <small>en plus des séances</small></h2>
      ${sports.length ? `<div class="pe-sec">${sports.map(spCard).join('')}</div>` : ''}
      <button type="button" class="pe-add" data-act="add-sport">${ICON.plus}<span>Ajouter un sport</span></button>
      <p class="pe-note">${sports.length ? 'Touche un jour pour placer un sport, ou son nom pour sa durée et son intensité.' : 'Natation, course, foot, boxe, yoga… ' + TR.SPORT_COUNT + ' sports, rangés par catégories.'}</p>
      <p class="pe-note">Ton historique ne change pas : chaque semaine garde le programme avec lequel tu l’as faite.</p>`;
  }

  function renderSession(s) {
    const mainN = TR.mainSessions(P).filter((x) => x.id !== s.id).length + (s.opt ? 0 : 1);
    top.innerHTML = `<button type="button" class="pe-back" data-act="home">${ICON.back}<span>Programme</span></button><span class="pe-tt"></span><button type="button" class="pe-ok" data-act="close">Terminé</button>`;
    const m = sessionMinutes(s);
    body.innerHTML = `<input class="pe-name" id="peName" value="${esc(s.name)}" maxlength="40" aria-label="Nom de la séance" autocomplete="off" spellcheck="false">
      <input class="pe-sub" id="peSub" value="${esc(s.sub)}" maxlength="60" placeholder="Sous-titre, par ex. Poussée + Bras" aria-label="Sous-titre de la séance" autocomplete="off">
      <p class="pe-lab">Jours</p>${daysRow(P, s.id, s.days)}
      <button type="button" class="pe-tog" data-act="opt" aria-pressed="${s.opt}"><span><b>Séance en option</b><span>Ne compte pas dans ${s.opt ? 'les séances' : 'tes ' + mainN + ' séance' + (mainN > 1 ? 's' : '')} de la semaine</span></span><i aria-hidden="true"></i></button>
      <h2 class="pe-h">Exercices <small>${s.ex.length}</small>${m ? `<span class="pe-h-r">≈ ${m} min</span>` : ''}</h2>
      <div class="pe-exs">${s.ex.map((e) => `<div class="pe-ex" data-eid="${esc(e.id)}">
        <span class="pe-grip" data-grip="${esc(e.id)}" aria-hidden="true">${ICON.grip}</span>
        <button type="button" class="pe-ex-m" data-ex="${esc(e.id)}"><b>${esc(TR.exName(e, P))}</b><span>${esc(TR.describe(e))} · repos ${esc(TR.fmtRest(e.rest))}</span></button>
        <span class="pe-ex-c" aria-hidden="true">${ICON.chev}</span></div>`).join('') || '<p class="pe-empty">Pas encore d’exercice.</p>'}</div>
      <button type="button" class="pe-add" data-act="pick">${ICON.plus}<span>Ajouter des exercices</span></button>
      <button type="button" class="pe-del" data-act="del-ses">Supprimer la séance</button>`;
    const name = body.querySelector('#peName'), sub = body.querySelector('#peSub');
    const S = () => TR.sessionById(P, s.id);        // P change d'objet à chaque enregistrement
    name.addEventListener('input', () => { const x = S(); if (x) x.name = name.value; });
    sub.addEventListener('input', () => { const x = S(); if (x) x.sub = sub.value; });
    const saveText = () => { const x = S(); if (!x) return; if (!x.name.trim()) { x.name = 'Séance'; name.value = x.name; } commit(false); };
    name.addEventListener('change', saveText);
    sub.addEventListener('change', saveText);
    [name, sub].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } }));
  }

  // ---- Glisser pour réordonner (poignée à gauche) ----
  body.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('[data-grip]');
    if (!g || !cur) return;
    e.preventDefault();
    const row = g.closest('.pe-ex'), list = row.parentElement;
    row.classList.add('drag');
    try { g.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
    const move = (ev) => {
      const rows = [...list.querySelectorAll('.pe-ex')];
      for (const r of rows) {
        if (r === row) continue;
        const b = r.getBoundingClientRect();
        if (ev.clientY < b.top + b.height / 2 && row.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_PRECEDING) { list.insertBefore(row, r); break; }
        if (ev.clientY > b.top + b.height / 2 && row.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING) { list.insertBefore(row, r.nextSibling); }
      }
    };
    const up = () => {
      g.removeEventListener('pointermove', move);
      g.removeEventListener('pointerup', up);
      g.removeEventListener('pointercancel', up);
      row.classList.remove('drag');
      const s = TR.sessionById(P, cur);
      const order = [...list.querySelectorAll('.pe-ex')].map((r) => r.dataset.eid);
      const next = order.map((id) => s.ex.find((x) => x.id === id)).filter(Boolean);
      if (next.map((x) => x.id).join() !== s.ex.map((x) => x.id).join()) { s.ex = next; commit(); }
    };
    g.addEventListener('pointermove', move);
    g.addEventListener('pointerup', up);
    g.addEventListener('pointercancel', up);
  });

  node.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'close') { commitPendingText(); close(); return; }
    if (act === 'home') { commitPendingText(); cur = null; render(); body.scrollTop = 0; return; }
    if (b.dataset.open) { cur = b.dataset.open; render(); body.scrollTop = 0; return; }
    if (b.dataset.day != null) {
      const owner = b.dataset.owner, day = +b.dataset.day, on = b.getAttribute('aria-pressed') !== 'true';
      TR.setDay(P, owner, day, on);
      commit();
      return;
    }
    if (b.dataset.sport) { commitPendingText(); openSportSheet(ctxFor(), b.dataset.sport, { onChange: refresh }); return; }
    if (act === 'add-sport') { commitPendingText(); addSportFlow(ctxFor(), { onChange: refresh }); return; }
    if (act === 'add-ses') {
      const used = new Set([...P.sessions.flatMap((s) => s.days), ...TR.sportsList(P).flatMap((e) => e.days)]);
      const free = [0, 1, 2, 3, 4, 5, 6].find((d) => !used.has(d));
      const id = TR.newId('s');
      P.sessions.push({ id, name: 'Séance ' + (TR.mainSessions(P).length + 1), sub: '', opt: false, days: free == null ? [] : [free], ex: [] });
      cur = id;
      commit();
      openPicker(ctxFor(), id, { onChange: refresh });
      return;
    }
    if (act === 'coach') {
      commitPendingText();
      ctx.coach({
        onDone: () => { cur = null; refresh(); body.scrollTop = 0; },
        // « je choisis mes exercices » : séances vides, on ouvre la première avec la bibliothèque
        openEditor: ({ sid: id = null, pick: pk = false } = {}) => {
          P = clone(ctx.program()); cur = id && TR.sessionById(P, id) ? id : null; render(); body.scrollTop = 0;
          if (pk && cur) openPicker(ctxFor(), cur, { onChange: refresh });
        },
      });
      return;
    }
    const s = cur && TR.sessionById(P, cur);
    if (!s) return;
    if (act === 'opt') { s.opt = !s.opt; commit(); return; }
    if (act === 'pick') { openPicker(ctxFor(), s.id, { onChange: refresh }); return; }
    if (act === 'del-ses') {
      const ok = await ask({ title: 'Supprimer « ' + s.name + ' » ?', text: 'Les semaines passées gardent cette séance dans leur historique.', ok: 'Supprimer', danger: true });
      if (!ok) return;
      P.sessions = P.sessions.filter((x) => x.id !== s.id);
      cur = null;
      commit();
      return;
    }
    if (b.dataset.ex) { openExerciseSheet(ctxFor(), s.id, b.dataset.ex, { onChange: refresh }); }
  });

  function commitPendingText() {
    const a = document.activeElement;
    if (a && (a.id === 'peName' || a.id === 'peSub')) a.blur();
  }
  // les fenêtres ouvertes par-dessus travaillent sur le programme enregistré
  function ctxFor() { return { ...ctx, program: () => P, save: (p) => { P = clone(ctx.save(p)); return P; } }; }
  function refresh() { P = clone(ctx.program()); render(); }

  render();
  if (pick && cur) openPicker(ctxFor(), cur, { onChange: refresh });
  return close;
}

// ---- Réglages d'un exercice : curseurs ----
const PRESETS = [
  { k: 'force', l: 'Force', sets: 5, lo: 3, hi: 5, rest: 180 },
  { k: 'masse', l: 'Masse', sets: 3, lo: 8, hi: 12, rest: 120 },
  { k: 'endu', l: 'Endurance', sets: 3, lo: 15, hi: 20, rest: 60 },
];
const MODE_DEF = { r: [8, 12], t: [30, 60], d: [30, 40] };

export function openExerciseSheet(ctx, sid, eid, { onChange = null } = {}) {
  let P = clone(ctx.program());
  const get = () => { const s = TR.sessionById(P, sid); return { s, e: s && s.ex.find((x) => x.id === eid) }; };
  if (!get().e) return null;
  const node = el('<div class="sheet tr-sheet xs"></div>');
  const close = openLayer(node, { label: 'Réglages de l’exercice' });
  // les curseurs gardent une référence à l'exercice : on continue de travailler sur le même objet
  const save = () => {
    ctx.save(P);
    if (onChange) onChange();
  };

  function head() {
    const { e } = get();
    node.querySelector('.xs-sum').textContent = TR.describe(e) + ' · repos ' + TR.fmtRest(e.rest);
  }

  function render() {
    const { s, e } = get();
    if (!e) { close(); return; }
    const x = TR.exoOf(e, P);
    const libName = x ? x.n : 'Exercice';
    const meta = x ? [TR.cibleName(x), TR.EQUIP[x.e]].concat(x.sec.length ? ['aussi ' + x.sec.map((m) => TR.MUSCLES[m].toLowerCase()).join(', ')] : []).join(' · ') : '';
    const idx = s.ex.indexOf(e);
    node.innerHTML = `<div class="sheeth"><span class="st">${esc(TR.exName(e, P))}</span><button type="button" data-act="close" aria-label="Fermer">${ICON.close}</button></div>
      <p class="xs-meta">${esc(meta)}</p>
      ${x && TR.illusSrc(x.id) ? `<button type="button" class="xs-ill" data-act="ill" aria-label="${esc('Voir le geste en grand : ' + libName)}"><img src="${esc(TR.illusSrc(x.id))}" alt="" decoding="async"><span>${ICON.zoom}</span></button>` : ''}
      <p class="xs-sum" aria-live="polite"></p>
      <div class="xs-modes" role="group" aria-label="Mesure">${[['r', 'Répétitions'], ['t', 'Durée'], ['d', 'Distance']].map(([k, l]) => `<button type="button" data-mode="${k}" aria-pressed="${e.mode === k}">${l}</button>`).join('')}</div>
      ${e.mode === 'r' ? `<div class="xs-pre" role="group" aria-label="Réglages rapides">${PRESETS.map((p) => `<button type="button" data-pre="${p.k}" aria-pressed="${e.sets === p.sets && e.lo === p.lo && e.hi === p.hi && e.rest === p.rest && !e.max}"><b>${p.l}</b><span>${p.sets} × ${p.lo}-${p.hi} · ${TR.fmtRest(p.rest)}</span></button>`).join('')}</div>` : ''}
      <div class="xs-sl"></div>
      <div class="xs-row">
        <button type="button" class="tr-btn ghost sm" data-act="up" ${idx <= 0 ? 'disabled' : ''}>${ICON.up}<span>Monter</span></button>
        <button type="button" class="tr-btn ghost sm" data-act="down" ${idx >= s.ex.length - 1 ? 'disabled' : ''}>${ICON.down}<span>Descendre</span></button>
        <button type="button" class="tr-btn ghost sm" data-act="swap">${ICON.swap}<span>Remplacer</span></button>
      </div>
      <label class="xs-name"><span>Nom affiché</span><input type="text" id="xsName" value="${esc(e.n || '')}" placeholder="${esc(libName)}" maxlength="80" autocomplete="off"></label>
      <button type="button" class="pe-del" data-act="del">Retirer de la séance</button>`;
    const box = node.querySelector('.xs-sl');
    box.appendChild(slider({ label: 'Séries', min: 1, max: 10, value: e.sets, minor: 1, every: 1, fmt: (v) => String(v),
      onInput: (v) => { e.sets = v; head(); }, onChange: save }));
    if (e.mode === 'r' && !e.each) box.appendChild(repsSlider(e, 'r', 1, 30, 1, [1, 5, 10, 15, 20, 25, 30], (v) => v + ''));
    if (e.mode === 't') {
      const cardio = x && x.m === 'cardio';
      if (cardio) box.appendChild(repsSlider(e, 't', 60, 5400, 60, [60, 900, 1800, 2700, 3600, 4500, 5400], (v) => v / 60 + ' min', (v) => TR.fmtSec(v)));
      else box.appendChild(repsSlider(e, 't', 5, 300, 5, [5, 60, 120, 180, 240, 300], (v) => (v < 60 ? v + ' s' : v / 60 + ' min'), (v) => TR.fmtSec(v)));
    }
    if (e.mode === 'd') box.appendChild(repsSlider(e, 'd', 5, 200, 5, [5, 50, 100, 150, 200], (v) => v + ' m'));
    if (!e.each) {
      const mx = document.createElement('button');
      mx.type = 'button'; mx.className = 'xs-max'; mx.dataset.act = 'max';
      mx.setAttribute('aria-pressed', String(!!e.max));
      mx.innerHTML = `<span><b>Jusqu’à l’échec</b><span>${e.mode === 't' ? 'Tenir le plus longtemps possible' : 'Le maximum de répétitions'}</span></span><i aria-hidden="true"></i>`;
      box.appendChild(mx);
    }
    box.appendChild(slider({ label: 'Repos entre les séries', min: 0, max: 300, step: 15, value: Math.min(300, e.rest), minor: 15, every: 60,
      labelFmt: (v) => (v ? v / 60 + ' min' : '0'), fmt: (v) => TR.fmtRest(v), names: ['Repos entre les séries'],
      onInput: (v) => { e.rest = v; head(); }, onChange: save }));
    const nm = node.querySelector('#xsName');
    nm.addEventListener('change', () => { const v = nm.value.trim(); if (v && v !== libName) e.n = v; else delete e.n; save(); node.querySelector('.st').textContent = TR.exName(e, P); });
    nm.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); nm.blur(); } });
    head();
  }

  // Répétitions / durée / distance : fourchette à deux poignées
  function repsSlider(e, mode, min, max, step, marks, labelFmt, fmt = labelFmt) {
    const free = e.lo == null;
    const lo = free ? MODE_DEF[mode][0] : e.lo, hi = free ? MODE_DEF[mode][1] : e.hi ?? e.lo;
    const label = mode === 'r' ? 'Répétitions' : mode === 't' ? 'Durée par série' : 'Distance par série';
    const sl = slider({ label, min, max, step, value: [Math.min(max, Math.max(min, lo)), Math.min(max, Math.max(min, hi))], minor: mode === 'r' ? 1 : null, every: null,
      fmt, cls: e.max ? 'dim' : '',
      onInput: ([a, b]) => {
        e.lo = a; e.hi = b;
        if (e.max) { delete e.max; sl.classList.remove('dim'); const t = node.querySelector('[data-act="max"]'); if (t) t.setAttribute('aria-pressed', 'false'); }
        head();
      }, onChange: save });
    const lb = document.createElement('div');
    lb.className = 'tsl-lb'; lb.setAttribute('aria-hidden', 'true');
    lb.innerHTML = marks.map((v) => `<span style="left:${(((v - min) / (max - min)) * 100).toFixed(3)}%">${esc(labelFmt(v))}</span>`).join('');
    sl.appendChild(lb);
    if (free) sl.querySelector('.tsl-v').textContent = 'libre';
    return sl;
  }

  node.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button');
    if (!b || b.disabled) return;
    const { s, e } = get();
    if (b.dataset.act === 'close') { close(); return; }
    if (b.dataset.act === 'ill') { const x = TR.exoOf(e, P); if (x) openIllus(x.id, { name: TR.exName(e, P) }); return; }
    if (b.dataset.mode && b.dataset.mode !== e.mode) {
      e.mode = b.dataset.mode;
      [e.lo, e.hi] = MODE_DEF[e.mode];
      delete e.max; delete e.each;
      save(); render(); return;
    }
    if (b.dataset.pre) {
      const p = PRESETS.find((x) => x.k === b.dataset.pre);
      Object.assign(e, { sets: p.sets, lo: p.lo, hi: p.hi, rest: p.rest });
      delete e.max; delete e.each;
      save(); render(); return;
    }
    const act = b.dataset.act;
    if (act === 'max') { if (e.max) delete e.max; else { e.max = true; if (e.lo == null) [e.lo, e.hi] = MODE_DEF[e.mode]; } save(); render(); return; }
    if (act === 'up' || act === 'down') {
      const i = s.ex.indexOf(e), j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= s.ex.length) return;
      [s.ex[i], s.ex[j]] = [s.ex[j], s.ex[i]];
      save(); render(); return;
    }
    if (act === 'swap') {
      openPicker({ ...ctx, program: () => P, save: (p) => { P = clone(ctx.save(p)); if (onChange) onChange(); return P; } }, sid, { replace: eid, onChange: () => { render(); } });
      return;
    }
    if (act === 'del') {
      const ok = await ask({ title: 'Retirer « ' + TR.exName(e, P) + ' » de « ' + s.name + ' » ?', ok: 'Retirer', danger: true });
      if (!ok) return;
      s.ex = s.ex.filter((x) => x.id !== e.id);
      save(); close();
    }
  });

  render();
  return close;
}

// ---- Choisir des exercices dans la bibliothèque ----
// Choix d'un exercice : le muscle, puis le matériel, puis la liste (ou une recherche, à plat).
const PK_CATS = [
  ['pecs', 'Pectoraux', ['pecs']], ['dos', 'Dos', ['dos', 'lombaires', 'trapezes']], ['epaules', 'Épaules', ['epaules']],
  ['biceps', 'Biceps', ['biceps']], ['triceps', 'Triceps', ['triceps']], ['avbras', 'Avant-bras', ['avbras']],
  ['jambes', 'Jambes et fessiers', ['quadris', 'ischios', 'fessiers', 'adducteurs', 'mollets']], ['abdos', 'Abdos', ['abdos']],
  ['autres', 'Corps entier et cardio', ['complet', 'cardio', 'cou']],
];
const PK_EQ = [
  ['pdc', 'Poids du corps', ['pdc', 'anneaux']], ['halteres', 'Haltères', ['halteres', 'kb']], ['machine', 'Machine', ['machine', 'smith']],
  ['poulie', 'Poulie', ['poulie']], ['barre', 'Barre', ['barre', 'ez', 'trapbar', 'landmine']], ['autre', 'Autre matériel', ['elastique', 'disque', 'ballon', 'autre']],
];
export function openPicker(ctx, sid, { replace = null, onChange = null } = {}) {
  let P = clone(ctx.program());
  let q = '', cat = '', eqg = '', creating = false;
  const added = new Map();      // exercice de la bibliothèque → exercice ajouté pendant ce choix
  const node = el(`<div class="sheet tr-sheet pk">
    <div class="sheeth"><span class="st">${replace ? 'Remplacer par…' : 'Ajouter des exercices'}</span><button type="button" class="pk-done" data-act="close">${replace ? 'Annuler' : 'Terminé'}</button></div>
    <label class="pk-q">${ICON.search}<input type="search" id="pkQ" placeholder="Chercher : squat, curl, poulie…" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="Chercher un exercice"></label>
    <div class="pk-nav"></div>
    <p class="pk-n" aria-live="polite"></p>
    <div class="pk-res"></div>
    <div class="pk-new"></div>
  </div>`);
  const close = openLayer(node, { label: replace ? 'Remplacer l’exercice' : 'Ajouter des exercices' });
  const input = node.querySelector('#pkQ'), res = node.querySelector('.pk-res'), count = node.querySelector('.pk-n'), nw = node.querySelector('.pk-new');
  const zones = () => (ctx.zones ? ctx.zones() : []) || [];
  const ses = () => TR.sessionById(P, sid);
  const extra = () => (P.custom || []).map(TR.customExo);
  const save = () => { P = clone(ctx.save(P)); if (onChange) onChange(); };

  function draw() {
    const all = TR.searchExos('', { extra: extra() });
    const list = q.trim() ? TR.searchExos(q, { extra: extra() }) : all;
    const s = ses();
    const inSes = new Set(s ? s.ex.map((x) => x.x) : []);
    const nav = node.querySelector('.pk-nav');
    // sous le nom : ce que l'exercice travaille (lvl 0 : la cible en entier ; 1 : le nom court de la cible ;
    // 2 : rien, le groupe le dit déjà), puis le matériel
    const item = (x, lvl = 0) => {
      const on = added.has(x.id), here = !on && inSes.has(x.id);
      const k = lvl === 0 ? TR.cibleName(x) : lvl === 1 && x.c ? TR.CIBLES[x.c].s : '';
      return `<button type="button" class="pk-it${on ? ' on' : ''}" data-x="${esc(x.id)}" aria-pressed="${on}">${thumb(x.id)}
        <span class="pk-t"><b>${esc(x.n)}</b><span>${esc([k, TR.EQUIP[x.e]].filter(Boolean).join(' · '))}${here ? ' · déjà dans la séance' : ''}${x.custom ? ' · créé par toi' : ''}</span></span>
        <span class="pk-add" aria-hidden="true">${replace ? ICON.swap : on ? ICON.check : ICON.plus}</span></button>`;
    };
    const group = (title, xs, lvl) => `<p class="pk-g">${esc(title)} <span>${xs.length}</span></p>` + xs.map((x) => item(x, lvl)).join('');
    const tiles = (key, defs, xs, of) => `<div class="pk-cats">${defs.map(([k, l, ms]) => {
      const n = xs.filter((x) => ms.includes(of(x))).length;
      return n ? `<button type="button" class="pk-cat" data-${key}="${k}"><b>${esc(l)}</b><span>${n} exercice${n > 1 ? 's' : ''}</span>${ICON.chev}</button>` : '';
    }).join('')}</div>`;
    let html = '';
    if (q.trim()) {
      // recherche : toute la bibliothèque, à plat
      nav.innerHTML = '';
      count.textContent = list.length ? list.length + ' exercice' + (list.length > 1 ? 's' : '') : 'Aucun exercice trouvé';
      html = list.map((x) => item(x)).join('');
    } else if (!cat) {
      // 1) le muscle
      nav.innerHTML = '';
      count.textContent = 'Choisis un muscle';
      const cur = replace && s ? TR.exoOf(s.ex.find((y) => y.id === replace) || {}, P) : null;
      if (cur && cur.c) {
        const same = all.filter((x) => x.c === cur.c && x.id !== cur.id && x.mode === cur.mode && !inSes.has(x.id));
        if (same.length) html += group('Travaillent pareil : ' + TR.CIBLES[cur.c].n.toLowerCase(), same, 2);
      }
      html += tiles('cat', PK_CATS, all, (x) => x.m);
    } else {
      const C = PK_CATS.find((c) => c[0] === cat), inCat = all.filter((x) => C[2].includes(x.m));
      if (!eqg) {
        // 2) le matériel
        nav.innerHTML = `<button type="button" class="pk-up" data-act="up">${ICON.back}<span>Muscles</span></button><b class="pk-here">${esc(C[1])}</b>`;
        count.textContent = 'Choisis le matériel';
        html = tiles('eqg', PK_EQ, inCat, (x) => x.e);
      } else {
        // 3) les exercices : rangés par muscle (jambes, dos…) ou par cible (haut des pectoraux…)
        const E = PK_EQ.find((e) => e[0] === eqg), xs = inCat.filter((x) => E[2].includes(x.e));
        nav.innerHTML = `<button type="button" class="pk-up" data-act="up">${ICON.back}<span>${esc(C[1])}</span></button><b class="pk-here">${esc(E[1])}</b>`;
        count.textContent = xs.length + ' exercice' + (xs.length > 1 ? 's' : '');
        if (C[2].length > 1) {
          for (const m of C[2]) { const g = xs.filter((x) => x.m === m); if (g.length) html += group(TR.MUSCLES[m], g, 1); }
        } else {
          const byC = new Map();
          for (const x of xs) { const c = x.c || ''; if (!byC.has(c)) byC.set(c, []); byC.get(c).push(x); }
          const keys = Object.keys(TR.CIBLES).filter((c) => byC.has(c)).concat(byC.has('') ? [''] : []);
          html = keys.length > 1 ? keys.map((c) => group(c ? TR.CIBLES[c].n : 'Créés par toi', byC.get(c), 2)).join('') : xs.map((x) => item(x, 2)).join('');
        }
      }
    }
    res.innerHTML = html;
    const qt = input.value.trim();
    nw.innerHTML = creating ? newForm(qt) : (qt.length >= 2 && !replace ? `<button type="button" class="tr-btn ghost wide" data-act="new">${ICON.plus}<span>Créer « ${esc(qt)} »</span></button>` : '');
    const done = node.querySelector('.pk-done');
    if (!replace) done.textContent = added.size ? 'Terminé (' + added.size + ')' : 'Terminé';
  }

  function newForm(name) {
    return `<div class="pk-form"><p class="pe-lab">Nouvel exercice</p>
      <input type="text" id="pkName" value="${esc(name)}" maxlength="60" aria-label="Nom de l’exercice" autocomplete="off">
      <p class="pe-lab">Muscle principal</p>
      <div class="pk-chips wrap" role="group" aria-label="Muscle principal">${Object.entries(TR.MUSCLES).map(([k, l]) => `<button type="button" data-nm="${k}" aria-pressed="${k === ((PK_CATS.find((c) => c[0] === cat) || [0, 0, ['pecs']])[2][0])}">${l}</button>`).join('')}</div>
      <p class="pe-lab">Se mesure en</p>
      <div class="xs-modes" role="group" aria-label="Mesure">${[['r', 'Répétitions'], ['t', 'Durée'], ['d', 'Distance']].map(([k, l], i) => `<button type="button" data-nmode="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>
      <button type="button" class="tr-btn wide" data-act="create">Créer et ajouter</button></div>`;
  }

  let t = null;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { q = input.value; creating = false; draw(); }, 60); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });

  node.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'close') { close(); return; }
    if (b.dataset.cat) { cat = b.dataset.cat; eqg = ''; draw(); res.scrollTop = 0; return; }
    if (b.dataset.eqg) { eqg = b.dataset.eqg; draw(); res.scrollTop = 0; return; }
    if (b.dataset.act === 'up') { if (eqg) eqg = ''; else cat = ''; draw(); res.scrollTop = 0; return; }
    if (b.dataset.nm) { node.querySelectorAll('[data-nm]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); return; }
    if (b.dataset.nmode) { node.querySelectorAll('[data-nmode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); return; }
    if (b.dataset.act === 'new') { creating = true; draw(); const f = node.querySelector('#pkName'); if (f) f.focus(); return; }
    if (b.dataset.act === 'create') {
      const name = (node.querySelector('#pkName').value || '').trim();
      if (!name) return;
      const mm = (node.querySelector('[data-nm][aria-pressed="true"]') || {}).dataset?.nm || 'complet';
      const mode = (node.querySelector('[data-nmode][aria-pressed="true"]') || {}).dataset?.nmode || 'r';
      const c = { id: TR.newId('c-'), n: name, m: mm, e: 'autre', t: 'i', mode };
      P.custom = (P.custom || []).concat(c);
      const ex = TR.makeExercise(TR.customExo(c), { zones: zones() });
      ses().ex.push(ex);
      added.set(c.id, ex.id);
      creating = false;
      save();
      input.value = ''; q = '';
      draw();
      toast('« ' + name + ' » ajouté');
      return;
    }
    const xid = b.dataset.x;
    if (!xid) return;
    const x = TR.exoById(xid) || extra().find((c) => c.id === xid);
    const s = ses();
    if (!x || !s) return;
    if (replace) {
      const ex = s.ex.find((y) => y.id === replace);
      if (ex) {
        const sameMode = x.mode === ex.mode;
        ex.x = x.id; delete ex.n;
        if (!sameMode) { const d = TR.defaultsFor(x); Object.assign(ex, { mode: d.mode, lo: d.lo, hi: d.hi, sets: d.sets, rest: d.rest }); delete ex.max; delete ex.each; }
        save();
        toast('Remplacé par « ' + x.n + ' »');
      }
      close();
      return;
    }
    if (added.has(xid)) {
      const id = added.get(xid);
      s.ex = s.ex.filter((y) => y.id !== id);
      added.delete(xid);
    } else {
      const ex = TR.makeExercise(x, { zones: zones() });
      s.ex.push(ex);
      added.set(xid, ex.id);
    }
    save();
    draw();
  });

  draw();
  return close;
}
