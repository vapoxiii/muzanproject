// Construire son programme avec le coach. Ren pose ses questions, une par écran, sur la même
// scène qu'au premier lancement (type de programme, nombre de séances, jours, durée, lieu,
// niveau, façon de travailler, zone prioritaire). Ensuite, deux chemins :
//  - il propose ses séances, et l'on choisit chaque exercice parmi ceux qui travaillent pareil
//    (même cible : longue portion du biceps, haut des pectoraux…) ;
//  - ou l'on part de séances vides pour tout choisir soi-même dans la bibliothèque.
//
// ctx (fourni par l'app) :
//   program()        → programme actuel
//   apply(p)         → enregistre le nouveau programme (et l'applique à la semaine en cours) ; renvoie le programme vérifié
//   profile()        → profil (séances, niveau, zones…) ou null
//   coach()          → { id, name } du coach choisi
//   pose(nom)        → image de Ren pour une pose (repos, pret, concentre, forme, zone)
//   portrait()       → petite image du coach
//   answers(), store(a) → dernières réponses (facultatif)
//   openEditor(opts) → constructeur : { sid, pick } pour remplir une séance tout de suite
//   onDone(p)        → facultatif : programme proposé appliqué

import * as TR from '../index.js';
import { esc, el, ICON, openLayer, ask, toast, REDUCED } from './dom.js';
import { thumb } from './illus.js';
import { openPicker, sessionMinutes } from './editor.js';

const DAY3 = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MIN_O = { 45: ['45 min', '4 à 5 exercices'], 60: ['1 h', '5 à 6 exercices'], 75: ['1 h 15', '6 à 7 exercices'], 90: ['1 h 30', '7 à 8 exercices'] };
const LEVEL_O = [['debutant', 'Débutant', 'Moins d’un an'], ['intermediaire', 'Intermédiaire', '1 à 3 ans'], ['avance', 'Avancé', 'Plus de 3 ans']];
const STYLE_O = [['force', 'Lourd', 'Peu de répétitions, plus de charge'], ['equilibre', 'Équilibré', 'Le classique : 8 à 12 répétitions'], ['volume', 'Léger', 'Plus de répétitions, moins de repos']];
const ZONE_O = [['bras', 'Bras'], ['epaules', 'Épaules'], ['dos', 'Dos'], ['pecs', 'Pectoraux'], ['jambes', 'Jambes'], ['abdos', 'Abdos']];
const SPLIT_REACT = { fb: 'Tout le corps à chaque fois : parfait pour progresser vite.', hb: 'Haut, bas : simple et efficace.', ppl: 'Push, pull, legs : chaque muscle a sa journée.' };
// « pour les biceps », « pour le dos »…
const FOR_M = { dos: 'le dos', cou: 'le cou', complet: 'tout le corps', cardio: 'le cardio' };
const forMuscle = (m) => FOR_M[m] || 'les ' + (TR.MUSCLES[m] || '').toLowerCase();
const MIN_REACT = { 45: 'Court et intense, ça me va.', 60: 'Une heure, le bon compromis.', 75: 'De quoi bien travailler.', 90: 'Grosse séance : on ajoute du volume.' };
const PLACE_REACT = { salle: 'On a tout ce qu’il faut.', maison: 'Avec des haltères, on fait beaucoup.', pdc: 'Le poids du corps suffit pour progresser.' };
const LEVEL_REACT = { debutant: 'Parfait, on part sur de bonnes bases.', intermediaire: 'On va affiner tout ça.', avance: 'Je vais devoir être à la hauteur.' };
const STYLE_REACT = { force: 'Lourd : moins de répétitions, plus de repos.', equilibre: 'Le meilleur des deux.', volume: 'Plus de répétitions, ça va brûler.' };

// Repères du visage dans chaque pose (fractions de l'image) : proportion, largeur de tête, centre du visage
const POSE = { repos: { r: 0.546, hw: 0.40, fx: 0.55, fy: 0.085 }, pret: { r: 0.523, hw: 0.40, fx: 0.51, fy: 0.10 }, concentre: { r: 0.408, hw: 0.38, fx: 0.49, fy: 0.065 }, forme: { r: 0.334, hw: 0.48, fx: 0.60, fy: 0.065 }, zone: { r: 0.497, hw: 0.32, fx: 0.56, fy: 0.12 } };
const BACK_IC = '<svg width="11" height="18" viewBox="0 0 11 18" aria-hidden="true"><path d="M9 2 2 9l7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARROW_IC = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const QUESTIONS = ['days', 'split', 'when', 'minutes', 'place', 'level', 'style', 'zones'];

const joinEt = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1]);
// espace insécable avant ? : ! ; (pas de ponctuation seule en début de ligne)
const fr = (t) => String(t).replace(/ ([?:!;])/g, '\u00a0$1');
const HOURS = { 45: '45 minutes', 60: 'd’une heure', 75: 'd’1 h 15', 90: 'd’1 h 30' };

export function openCoachBuilder(ctx, { from = 'editor' } = {}) {
  const cur = ctx.program();
  const prof = (ctx.profile && ctx.profile()) || null;
  const coach = (ctx.coach && ctx.coach()) || { id: 'ren', name: 'Ren' };
  const isRen = !coach.id || coach.id === 'ren';
  const saved = from === 'onboarding' ? null : (ctx.answers && ctx.answers()) || null;
  let A = TR.checkAnswers({ ...TR.defaultAnswers({ profile: prof, current: cur }), ...(saved || {}) });
  let path = 'propose', splitTouched = !!saved;
  // juste après le premier lancement : niveau et zones viennent d'être donnés
  const skip = new Set(from === 'onboarding' ? ['level', 'zones'] : []);
  const steps = ['intro', ...QUESTIONS.filter((q) => !skip.has(q)), 'plan'];
  let qi = 0, typeT = null, flip = false, poseCur = null;

  const portrait = ctx.portrait ? ctx.portrait() : '';
  const root = el(`<div class="onb oq cb">
    <div class="oq-stage"><div class="oq-rig"><div class="hd-bg"></div><div class="oq-glow"></div><div class="oq-lines"></div>
      <div class="oq-cw"${isRen ? '' : ' hidden'}><img class="oq-c" alt="" aria-hidden="true"><img class="oq-c" alt="" aria-hidden="true"></div></div><div class="oq-shade"></div></div>
    <button type="button" class="oq-back" data-act="back" aria-label="Question précédente" hidden>${BACK_IC}</button>
    <button type="button" class="cb-x" data-act="close" aria-label="Fermer">${ICON.close}</button>
    <div class="oq-prog" aria-hidden="true">${'<i><b></b></i>'.repeat(steps.length - 2)}</div>
    <div class="oq-bub" role="status" aria-live="polite"><span class="oq-who">${portrait ? `<img src="${esc(portrait)}" alt="">` : ''}Coach ${esc(coach.name)}</span><p class="oq-q"></p><p class="oq-sub"></p></div>
    <div class="oq-sheet"><div class="oq-ctl"></div><button type="button" class="oq-go" data-act="go" data-autofocus><span></span>${ARROW_IC}</button><button type="button" class="oq-alt" data-act="alt" hidden></button></div>
  </div>`);
  const $ = (s) => root.querySelector(s);
  const imgs = [...root.querySelectorAll('.oq-c')], bub = $('.oq-bub'), qEl = $('.oq-q'), subEl = $('.oq-sub'), ctl = $('.oq-ctl'), go = $('.oq-go'), alt = $('.oq-alt');
  const close = openLayer(root, { sheet: false, label: 'Construire mon programme avec ' + coach.name, onClose: () => { clearInterval(typeT); window.removeEventListener('resize', layout); } });
  window.addEventListener('resize', layout);

  // ---- Scène : Ren à gauche de la bulle, au-dessus de la carte de réponses ----
  function layout() {
    if (!isRen || !root.isConnected) return;
    const oR = root.getBoundingClientRect(), vw = oR.width;
    const b = bub.getBoundingClientRect(), sh = $('.oq-sheet').getBoundingClientRect();
    const bubTop = b.top - oR.top, bubBot = b.bottom - oR.top, sheetTop = sh.top - oR.top;
    for (const img of imgs) {
      const m = POSE[img.dataset.pose];
      if (!m) continue;
      const headW = Math.max(84, Math.min(150, vw * 0.37, (sheetTop - 14 - bubBot) / 0.62));
      const W = headW / m.hw, H = W / m.r;
      let faceY = bubBot + headW * 0.12;
      if (faceY + headW * 0.55 > sheetTop - 10) faceY = sheetTop - 10 - headW * 0.55;
      faceY = Math.max(faceY, bubTop + headW * 0.4);
      const faceX = Math.max(headW * 0.55, Math.min(vw * 0.31, 132));
      img.style.height = H.toFixed(0) + 'px'; img.style.left = (faceX - m.fx * W).toFixed(0) + 'px'; img.style.top = (faceY - m.fy * H).toFixed(0) + 'px';
    }
  }
  function anim(img, cls) {
    if (!img || REDUCED) return;
    img.classList.remove('enter', 'intro', 'live', 'nod', 'jump'); void img.offsetWidth; img.classList.add(cls);
    img.addEventListener('animationend', () => { img.classList.remove(cls); if (img.classList.contains('on')) img.classList.add('live'); }, { once: true });
  }
  function setPose(pose, fx) {
    $('.oq-lines').classList.toggle('on', !!fx && !REDUCED);
    $('.oq-glow').classList.toggle('on', !!fx);
    if (!isRen) return;
    if (pose === poseCur) { anim(imgs.find((i) => i.classList.contains('on')), 'nod'); return; }
    flip = !flip;
    const nxt = imgs[flip ? 1 : 0], prv = imgs[flip ? 0 : 1];
    nxt.src = ctx.pose ? ctx.pose(pose) : ''; nxt.dataset.pose = pose;
    prv.classList.remove('on', 'live');
    layout();
    nxt.classList.add('on');
    anim(nxt, poseCur ? 'enter' : 'intro');
    poseCur = pose;
  }
  function type(text) {
    clearInterval(typeT);
    qEl.dataset.full = text;
    if (REDUCED) { qEl.textContent = text; qEl.classList.remove('typing'); return; }
    let i = 0; qEl.textContent = ''; qEl.classList.add('typing');
    typeT = setInterval(() => { i = Math.min(text.length, i + 2); qEl.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(typeT); qEl.classList.remove('typing'); } }, 24);
  }
  function say(text) {
    subEl.style.opacity = 0;
    setTimeout(() => { subEl.textContent = fr(text); subEl.classList.add('react'); subEl.style.opacity = 1; setTimeout(layout, 30); }, 160);
    if (!REDUCED) { anim(imgs.find((i) => i.classList.contains('on')), 'nod'); bub.classList.remove('wob'); void bub.offsetWidth; bub.classList.add('wob'); }
  }

  // ---- Les questions ----
  // les sports du programme actuel (natation, course…) et leurs jours restés libres
  const curSports = () => TR.sportsList(cur).filter((e) => !e.gone && e.days.length).map((e) => ({ sp: TR.sportOf(e), days: e.days }));
  const sportsLeft = () => curSports().map((x) => ({ sp: x.sp, days: x.days.filter((d) => !A.dayList.includes(d)) })).filter((x) => x.days.length);
  const sportOn = (P, d) => { const e = TR.sportsList(P).find((x) => x.days.includes(d)); return e ? TR.sportOf(e) : null; };
  const capF = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  function title(id) {
    return {
      intro: 'On construit ton programme ?', days: 'Combien de séances par semaine ?', split: 'Quel type de programme ?', when: 'Quels jours ?',
      minutes: 'Combien de temps par séance ?', place: 'Tu t’entraînes où ?', level: 'Ton niveau en musculation ?', style: 'Tu préfères travailler comment ?',
      zones: 'Une zone à travailler en priorité ?', plan: 'Voilà ta semaine.',
    }[id];
  }
  function subFor(id) {
    if (id === 'intro') return 'Quelques questions, puis je te propose des séances. Tu choisis tes exercices, tu gardes la main sur tout.';
    if (id === 'days') { const sp = curSports(); return (sp.length ? capF(joinEt(sp.map((x) => TR.sportLower(x.sp)))) + ' à part. ' : '') + 'La régularité bat l’intensité.'; }
    if (id === 'split') {
      const rec = TR.recommendedSplit(A.days);
      const what = rec === 'ppl' && A.days === 5 ? 'push / pull / legs, puis un haut / bas' : TR.SPLITS[rec].label.toLowerCase();
      return 'Pour ' + A.days + ' séances, je te conseille le ' + what + ' : ' + TR.splitFreq(rec, A.days) + '.';
    }
    if (id === 'when') return whenText();
    if (id === 'minutes') return 'Échauffement compris.';
    if (id === 'place') return 'Je choisis les exercices avec le matériel que tu as.';
    if (id === 'level') return 'Pour doser les séries et la charge.';
    if (id === 'style') return 'Tu pourras régler chaque exercice ensuite.';
    if (id === 'zones') return 'Un exercice de plus les jours où elle travaille. Tu peux passer.';
    if (id === 'plan') {
      const where = { salle: 'en salle', maison: 'à la maison', pdc: 'sans matériel' }[A.place];
      const z = A.zones.map((k) => (ZONE_O.find((o) => o[0] === k) || [k, k])[1].toLowerCase());
      return A.days + ' séances ' + (A.minutes === 45 ? 'de 45 minutes' : HOURS[A.minutes]) + ', ' + where + (z.length ? ', priorité : ' + joinEt(z) : '') + '.';
    }
    return '';
  }
  function whenText() {
    const k = A.dayList.length, n = A.days;
    if (k < n) return 'Choisis ' + n + ' jours' + (k ? ' : encore ' + (n - k) + '.' : '.');
    if (k > n) return (k - n === 1 ? 'Un jour de trop' : (k - n) + ' jours de trop') + ' : tu as dit ' + n + ' séances.';
    const left = sportsLeft();
    return left.length ? 'Parfait. ' + capF(left.map((x, i) => TR.sportThe(x.sp) + (i ? ' ' : ' reste ') + joinEt(x.days.map((d) => 'le ' + TR.DAY_NAMES[d]))).join(', ')) + '.' : 'Parfait.';
  }
  const opts = (list, curV, cls = '') => `<div class="oq-opts${cls ? ' ' + cls : ''}">${list.map(([v, l, d, dis, reco]) =>
    `<button type="button" class="oq-opt" data-o="${esc(v)}" aria-pressed="${String(v) === String(curV)}"${dis ? ' disabled' : ''}><div><b>${esc(l)}${reco ? '<em class="cb-reco">Conseillé</em>' : ''}</b>${d ? `<span>${esc(d)}</span>` : ''}</div></button>`).join('')}</div>`;
  function ctlHtml(id) {
    switch (id) {
      case 'days': return `<div class="oq-nums">${[2, 3, 4, 5, 6].map((v) => `<button type="button" data-o="${v}" aria-pressed="${A.days === v}">${v}</button>`).join('')}</div>`;
      case 'split': return opts(['fb', 'hb', 'ppl'].map((k) => {
        const okk = TR.splitAllowed(k, A.days);
        const sub = k === 'ppl' && A.days === 5 ? 'Poussée, tirage, jambes, puis haut et bas' : TR.SPLITS[k].sub;
        return [k, TR.SPLITS[k].label, okk ? sub : TR.splitWhy(k, A.days), !okk, k === TR.recommendedSplit(A.days)];
      }), A.split);
      case 'when': return `<div class="cb-days" role="group" aria-label="Jours d’entraînement">${DAY3.map((l, d) => {
        const on = A.dayList.includes(d), sw = on ? null : sportOn(cur, d);
        return `<button type="button" data-d="${d}" aria-pressed="${on}" aria-label="${TR.DAY_NAMES[d]}${sw ? ', ' + esc(TR.sportLower(sw)) : ''}">${l}${sw ? '<i aria-hidden="true"></i>' : ''}</button>`;
      }).join('')}</div>${curSports().length ? `<p class="oq-note cb-sw"><i aria-hidden="true"></i>Point : jour de ${curSports().length === 1 ? esc(TR.sportLower(curSports()[0].sp)) : 'sport'}</p>` : ''}`;
      case 'minutes': return opts(TR.MINUTES.map((m) => [m, MIN_O[m][0], MIN_O[m][1]]), A.minutes, 'g2');
      case 'place': return opts(Object.entries(TR.PLACES).map(([k, p]) => [k, p.label, p.sub]), A.place);
      case 'level': return opts(LEVEL_O, A.level);
      case 'style': return opts(STYLE_O, A.style);
      case 'zones': return `<div class="oq-chips">${ZONE_O.map(([k, l]) => `<button type="button" data-z="${k}" aria-pressed="${A.zones.includes(k)}">${l}</button>`).join('')}</div>`;
      case 'plan': {
        const P = TR.buildProgram(A, { current: cur, empty: true });
        const week = DAY3.map((l, d) => {
          const s = P.sessions.find((x) => x.days.includes(d)), sw = sportOn(P, d);
          return s ? `<li><span>${l}</span><b>${esc(s.name)}</b></li>` : sw ? `<li class="sw"><span>${l}</span><b>${esc(sw.n)}</b></li>` : '';
        }).join('');
        const rest = DAY3.map((l, d) => (P.sessions.some((x) => x.days.includes(d)) || sportOn(P, d) ? null : 'le ' + TR.DAY_NAMES[d])).filter(Boolean);
        return `<ul class="cb-week" aria-label="Ta semaine">${week}</ul>${rest.length ? `<p class="cb-rest">Repos ${esc(joinEt(rest))}.</p>` : ''}` + opts([
          ['propose', coach.name + ' propose les séances', 'Pour chaque muscle, des exercices qui se remplacent : tu choisis'],
          ['custom', 'Je choisis mes exercices', 'Séances vides, tu les remplis dans la bibliothèque'],
        ], path);
      }
    }
    return '';
  }
  function goLabel(id) {
    if (id === 'intro') return 'C’est parti';
    if (id === 'zones') return A.zones.length ? 'Continuer' : 'Passer';
    if (id === 'plan') return path === 'propose' ? 'Voir mes séances' : 'Choisir mes exercices';
    return 'Continuer';
  }
  function progress() {
    root.querySelectorAll('.oq-prog b').forEach((b, i) => { b.style.width = (i <= qi - 1 ? 100 : 0) + '%'; });
  }
  function render(full) {
    const id = steps[qi];
    $('.oq-back').hidden = qi === 0;
    root.querySelector('.oq-prog').hidden = id === 'intro';
    progress();
    ctl.innerHTML = ctlHtml(id);
    if (full) { ctl.classList.remove('in'); void ctl.offsetWidth; ctl.classList.add('in'); ctl.scrollTop = 0; }
    go.querySelector('span').textContent = goLabel(id);
    go.disabled = id === 'when' && A.dayList.length !== A.days;
    alt.hidden = id !== 'intro';
    alt.textContent = 'Je préfère tout faire moi-même';
    if (full) {
      bub.classList.remove('in'); void bub.offsetWidth; bub.classList.add('in');
      subEl.classList.remove('react'); subEl.style.opacity = 1; subEl.textContent = fr(subFor(id));
      const t = fr(title(id));
      clearInterval(typeT); qEl.textContent = t; layout(); type(t);
      const pose = { intro: 'forme', days: 'pret', split: 'concentre', when: 'repos', minutes: 'concentre', place: 'pret', level: 'repos', style: 'concentre', zones: 'forme', plan: 'zone' }[id];
      setPose(pose, id === 'intro' || id === 'plan');
      if (id === 'plan') setTimeout(() => anim(imgs.find((i) => i.classList.contains('on')), 'jump'), 650);
    } else layout();
  }
  const pop = (b) => { b.classList.remove('oq-pop'); void b.offsetWidth; b.classList.add('oq-pop'); };
  const press = (sel, b) => ctl.querySelectorAll(sel).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));

  root.addEventListener('click', (e) => {
    // toucher la bulle : la question s'affiche en entier
    if (e.target.closest('.oq-bub')) { clearInterval(typeT); qEl.textContent = qEl.dataset.full || qEl.textContent; qEl.classList.remove('typing'); return; }
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const act = b.dataset.act, id = steps[qi];
    if (act === 'close') { close(); return; }
    if (act === 'back') { if (qi > 0) { qi--; render(true); } return; }
    if (act === 'alt') { close(); if (from !== 'editor' && ctx.openEditor) ctx.openEditor({}); return; }
    if (act === 'go') { next(); return; }
    if (b.dataset.d != null) {
      const d = +b.dataset.d;
      A.dayList = A.dayList.includes(d) ? A.dayList.filter((x) => x !== d) : A.dayList.concat(d).sort((x, y) => x - y);
      render(false); subEl.textContent = fr(whenText()); setTimeout(layout, 0);
      return;
    }
    if (b.dataset.z) {
      const z = b.dataset.z;
      A.zones = A.zones.includes(z) ? A.zones.filter((x) => x !== z) : A.zones.concat(z);
      b.setAttribute('aria-pressed', String(A.zones.includes(z))); pop(b);
      go.querySelector('span').textContent = goLabel(id);
      if (A.zones.includes(z)) say(z === 'bras' ? 'Les bras, ma spécialité.' : 'Noté, on insiste dessus.');
      return;
    }
    const v = b.dataset.o;
    if (v == null) return;
    pop(b); press('[data-o]', b);
    if (id === 'days') {
      A.days = +v;
      if (A.dayList.length !== A.days) A.dayList = TR.defaultDays(A.days, cur);
      if (!splitTouched || !TR.splitAllowed(A.split, A.days)) A.split = TR.recommendedSplit(A.days);
      say(A.days <= 3 ? A.days + ' séances, c’est solide pour progresser.' : A.days === 4 ? '4 séances : le rythme idéal.' : A.days + ' séances ? Il faudra bien récupérer.');
    } else if (id === 'split') { A.split = v; splitTouched = true; say(TR.splitAdvice(v, A.days) || SPLIT_REACT[v]); }
    else if (id === 'minutes') { A.minutes = +v; say(MIN_REACT[v]); }
    else if (id === 'place') { A.place = v; say(PLACE_REACT[v]); }
    else if (id === 'level') { A.level = v; say(LEVEL_REACT[v]); }
    else if (id === 'style') { A.style = v; say(STYLE_REACT[v]); }
    else if (id === 'plan') { path = v; go.querySelector('span').textContent = goLabel(id); say(v === 'propose' ? 'Je m’occupe de tout, tu valides.' : 'Tu choisis, je te laisse la main.'); }
  });

  function next() {
    const id = steps[qi];
    if (id === 'plan') { if (ctx.store) ctx.store(A); if (path === 'propose') openReview(); else custom(); return; }
    qi = Math.min(steps.length - 1, qi + 1);
    render(true);
  }

  // ---- Tout choisir soi-même : séances vides, puis la bibliothèque ----
  async function custom() {
    const n = A.days;
    const ok = await ask({ title: 'Remplacer ton programme par ' + n + ' séances vides ?', text: 'Tu choisis ensuite les exercices de chaque séance dans la bibliothèque. Tes séances déjà cochées restent dans ton historique.', ok: 'Remplacer' });
    if (!ok) return;
    const p = ctx.apply(TR.buildProgram(A, { current: cur, empty: true }));
    close();
    const first = TR.mainSessions(p)[0];
    if (ctx.openEditor) ctx.openEditor({ sid: first ? first.id : null, pick: !!first });
  }

  // ---- Les séances proposées : un exercice se change d'un toucher ----
  function openReview() {
    let D = TR.buildProgram(A, { current: cur });
    let tab = D.sessions[0].id, openEx = null, flash = null;
    const node = el(`<div class="pe cb-rv"><div class="pe-top"><button type="button" class="pe-back" data-act="back">${ICON.back}<span>Questions</span></button><span class="pe-tt">Programme proposé</span><button type="button" class="pe-ok" data-act="ok">Valider</button></div><div class="pe-body"></div></div>`);
    const closeRv = openLayer(node, { sheet: false, label: 'Programme proposé par ' + coach.name });
    const body = node.querySelector('.pe-body');
    const draft = { program: () => D, save: (p) => { D = TR.normalizeProgram(p); return D; }, zones: () => A.zones };
    const ses = () => TR.sessionById(D, tab) || D.sessions[0];

    // une ligne par exercice : sa cible, son nom, ses réglages ; ouverte, les exercices qui travaillent pareil
    function row(e, s) {
      const x = TR.exoOf(e, D), open = openEx === e.id;
      const k = x ? TR.cibleName(x) : '';
      return `<div class="cb-exw${open ? ' open' : ''}${flash === e.id ? ' flash' : ''}" data-eid="${esc(e.id)}">
        <button type="button" class="cb-ex" data-ex="${esc(e.id)}" aria-expanded="${open}">${thumb(x ? x.id : '')}
          <span class="cb-ex-t">${k ? `<small class="cb-ex-k">${esc(k)}</small>` : ''}<b>${esc(TR.exName(e, D))}</b><span>${esc(TR.describe(e))} · repos ${esc(TR.fmtRest(e.rest))}</span></span>
          ${e.a ? `<span class="pri">${esc(TR.zoneLabel(e, D))}</span>` : ''}<span class="cb-ex-c" aria-hidden="true">${ICON.swap}</span>
        </button>
        ${open && x ? choices(e, s, x) : ''}</div>`;
    }
    function choices(e, s, x) {
      const al = TR.alternatives(e, s, A, { limit: 6 });
      const opt = (y) => `<button type="button" class="cb-alt" data-alt="${esc(y.id)}">${thumb(y.id, 'sm')}<b>${esc(y.n)}</b><small>${esc(TR.EQUIP[y.e])}</small></button>`;
      const mine = `<div class="cb-alt on" aria-current="true">${thumb(x.id, 'sm')}<b>${esc(TR.exName(e, D))}</b><small>${esc(TR.EQUIP[x.e] || '')}</small>${ICON.check}</div>`;
      const head = al.same.length ? 'Ils travaillent pareil : choisis le tien' : al.other.length ? 'Pas d’équivalent avec ton matériel' : 'Pas d’autre choix avec ton matériel';
      return `<div class="cb-alts">
        ${al.cible ? `<p class="cb-tip"><b>${esc(coach.name)}</b> ${esc(fr(al.cible.tip))}</p>` : ''}
        <p class="cb-alts-k">${esc(fr(head))}</p>
        <div class="cb-alt-l">${mine}${al.same.map(opt).join('')}</div>
        ${al.other.length ? `<p class="cb-alts-k">Autres exercices pour ${esc(forMuscle(x.m))}</p><div class="cb-alt-l">${al.other.map(opt).join('')}</div>` : ''}
        <div class="cb-acts"><button type="button" class="tr-btn ghost sm" data-act="lib">${ICON.search}<span>Toute la bibliothèque</span></button><button type="button" class="tr-btn ghost sm" data-act="del">Retirer</button></div>
      </div>`;
    }
    function render() {
      const s = ses();
      body.innerHTML = `<div class="cb-say">${portrait ? `<img src="${esc(portrait)}" alt="">` : ''}<p><b>${esc(coach.name)}</b>Voilà ce que je te propose. Chaque exercice a ses équivalents, même muscle, même portion : touche-le pour choisir le tien.</p></div>
        <h1 class="pe-t">Ton programme</h1>
        <p class="pe-s">${esc(TR.countText(D))}${TR.sportsText(D) ? ', ' + esc(TR.sportsText(D)) : ''}</p>
        <div class="sub cb-tabs" role="tablist" aria-label="Séances">${D.sessions.map((x) => `<button type="button" role="tab" data-tab="${esc(x.id)}" aria-selected="${x.id === s.id}" tabindex="${x.id === s.id ? 0 : -1}">${x.days.length ? `<small>${x.days.map((d) => DAY3[d]).join(' · ')}</small> ` : ''}<span>${esc(x.name)}</span></button>`).join('')}</div>
        <div class="cb-ses" role="tabpanel" aria-label="${esc(s.name)}">
          <p class="cb-ses-s">${esc(s.sub)} · ${s.ex.length} exercice${s.ex.length > 1 ? 's' : ''} · ≈ ${sessionMinutes(s)} min</p>
          <div class="cb-exs">${s.ex.map((e) => row(e, s)).join('') || '<p class="pe-empty">Plus d’exercice dans cette séance.</p>'}</div>
          <button type="button" class="pe-add" data-act="add">${ICON.plus}<span>Ajouter un exercice</span></button>
        </div>
        <button type="button" class="tr-btn wide cb-ok" data-act="ok">Valider ce programme</button>
        <p class="pe-note">Ensuite, tout se règle dans Mon programme : séries, répétitions, repos, jours.</p>`;
      flash = null;
    }
    async function validate() {
      const ok = await ask({ title: 'Remplacer ton programme actuel par celui-ci ?', text: 'Tes séances déjà cochées restent dans ton historique. Tu pourras tout ajuster ensuite.', ok: 'Remplacer' });
      if (!ok) return;
      const p = ctx.apply(D);
      closeRv(); close();
      toast('Programme prêt : ' + TR.countText(p).replace(' par semaine', ''));
      if (ctx.onDone) ctx.onDone(p);
    }
    node.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const act = b.dataset.act, s = ses();
      if (act === 'back') { closeRv(); return; }
      if (act === 'ok') { validate(); return; }
      if (b.dataset.tab) { tab = b.dataset.tab; openEx = null; render(); return; }
      if (b.dataset.ex) { openEx = openEx === b.dataset.ex ? null : b.dataset.ex; render(); return; }
      if (act === 'add') { openPicker(draft, s.id, { onChange: render }); return; }
      const ex = openEx && s.ex.find((x) => x.id === openEx);
      if (!ex) return;
      if (b.dataset.alt) {
        const y = TR.exoById(b.dataset.alt);
        if (y) { TR.swapExercise(ex, y, A); D = TR.normalizeProgram(D); flash = ex.id; openEx = null; render(); toast('Remplacé par « ' + y.n + ' »'); }
        return;
      }
      if (act === 'lib') { const id = ex.id; openPicker(draft, s.id, { replace: id, onChange: () => { flash = id; openEx = null; render(); } }); return; }
      if (act === 'del') { s.ex = s.ex.filter((x) => x.id !== ex.id); D = TR.normalizeProgram(D); openEx = null; render(); }
    });
    node.addEventListener('keydown', (e) => {
      const t = e.target.closest('[role="tab"]');
      if (!t || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const i = D.sessions.findIndex((x) => x.id === t.dataset.tab), j = (i + (e.key === 'ArrowRight' ? 1 : -1) + D.sessions.length) % D.sessions.length;
      tab = D.sessions[j].id; openEx = null; render();
      const nt = body.querySelector(`[data-tab="${CSS.escape(tab)}"]`); if (nt) nt.focus();
    });
    render();
  }

  render(true);
  return close;
}
