// Écran de repos : Ren tend son poignet vers toi, sa montre affiche l'heure du téléphone et le vrai
// décompte du repos. S'ouvre quand une série est validée (02-seance.js, restStart) ; la barre de
// repos reste en dessous quand on le ferme.
//
// Huit éléments indépendants, chacun avec sa classe et ses réglages de place (training.css, « Écran
// de repos ») : BackgroundGym .rr-bg · RenRestPose .rr-ren · WatchFrame .rw · WatchDisplay .rw-screen ·
// WatchTimer .rw-timer · RestControls .rr-ctl · WorkoutProgress .rr-prog · NextExerciseCard .rr-next.
// Le cadran n'est pas dessiné dans l'illustration : il est posé sur le poignet, en code.
//
// ctx :
//   timer      → le minuteur partagé (createRestTimer, src/training/rest.js)
//   ren, bg    → facultatif : autres images de Ren et de la salle
//   data()     → { progress: [0..1 par exercice], where: « Haut B · exercice 2 sur 9 »,
//                  next: { kind: 'set'|'exercise'|'end', name, detail, img } }
//   onToggle(), onRestart(), onSkip(), onNext(), onClose()

import { fmtCountdown, fmtClock } from '../rest.js';
import { esc, el, openLayer, REDUCED } from './dom.js';
// Ren qui montre sa montre : illustration provisoire (cadran vidé), à remplacer par la version
// définitive ; réglage du cadran sur le poignet : variables --rw-* de .rr-ren (training.css)
import REN_IMG from '../../assets/img/ren-montre.webp';
import BG_IMG from '../../assets/img/hd-bg.webp';

const IC = {
  back: '<svg width="11" height="18" viewBox="0 0 11 18" aria-hidden="true"><path d="M9 2 2 9l7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 0 1-14.2 5M4 12a8 8 0 0 1 14.2-5"/><path d="M18.5 3v4.2h-4.2M5.5 21v-4.2h4.2"/></svg>',
  skip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5.6v12.8a.8.8 0 0 0 1.2.7l9.4-6.4a.8.8 0 0 0 0-1.4L7.2 4.9A.8.8 0 0 0 6 5.6z" fill="currentColor"/><rect x="17" y="5" width="2.6" height="14" rx="1" fill="currentColor"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4.6" y="6.4" width="3.4" height="11.2" rx="1.1"/><rect x="16" y="6.4" width="3.4" height="11.2" rx="1.1"/><rect x="1.8" y="9" width="2.5" height="6" rx=".9"/><rect x="19.7" y="9" width="2.5" height="6" rx=".9"/><rect x="7.6" y="10.9" width="8.8" height="2.2" rx="1"/></svg>',
  chev: '<svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true"><path d="M2 2l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const RING_R = 44, RING_C = 2 * Math.PI * RING_R;
const KIND = { set: 'Prochaine série', exercise: 'Prochain exercice', end: 'Après ce repos' };

export function openRestScreen(ctx) {
  const t = ctx.timer;
  const node = el(`<div class="rr">
    <div class="rr-bg" aria-hidden="true"><img class="rr-bg-img" src="${esc(ctx.bg || BG_IMG)}" alt=""><i class="rr-light l1"></i><i class="rr-light l2"></i><i class="rr-light l3"></i><i class="rr-win"></i><i class="rr-grain"></i></div>
    <header class="rr-top">
      <button type="button" class="rr-back" data-a="close" aria-label="Revenir à la séance">${IC.back}</button>
      <div class="rr-progw"><div class="rr-prog" role="img"></div><p class="rr-where"></p></div>
    </header>
    <div class="rr-stage">
      <div class="rr-ren">
        <img class="rr-ren-img" src="${esc(ctx.ren || REN_IMG)}" alt="Ren tend son poignet et te montre sa montre" decoding="async">
        <div class="rw">
          <i class="rw-strap top" aria-hidden="true"></i><i class="rw-strap bot" aria-hidden="true"></i>
          <i class="rw-crown" aria-hidden="true"></i><i class="rw-side" aria-hidden="true"></i>
          <div class="rw-case">
            <div class="rw-screen">
              <span class="rw-ic" aria-hidden="true">${IC.dumbbell}</span>
              <time class="rw-clock" aria-label="Heure"></time>
              <div class="rw-timer">
                <svg class="rw-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="rw-track" cx="50" cy="50" r="${RING_R}"/><circle class="rw-arc" cx="50" cy="50" r="${RING_R}" stroke-dasharray="${RING_C.toFixed(2)}"/></svg>
                <p class="rw-k">Repos</p>
                <p class="rw-v" role="timer" aria-label="Temps de repos restant">00:00</p>
                <button type="button" class="rw-pp" data-a="toggle" aria-label="Mettre le repos en pause"></button>
              </div>
            </div>
            <i class="rw-glass" aria-hidden="true"></i>
          </div>
        </div>
      </div>
    </div>
    <div class="rr-ctl">
      <button type="button" class="rr-c" data-a="restart" aria-label="Recommencer le repos">${IC.restart}</button>
      <button type="button" class="rr-c main" data-a="toggle" aria-label="Mettre le repos en pause" data-autofocus></button>
      <button type="button" class="rr-c" data-a="skip" aria-label="Passer le repos">${IC.skip}</button>
    </div>
    <button type="button" class="rr-next" data-a="next"></button>
  </div>`);
  const $ = (s) => node.querySelector(s);
  const arc = $('.rw-arc'), val = $('.rw-v'), clock = $('.rw-clock'), prog = $('.rr-prog'), card = $('.rr-next');
  const toggles = [...node.querySelectorAll('[data-a="toggle"]')];
  let raf = 0, alive = true, finished = false, lastV = '', lastC = '', lastPaused = null;

  // WorkoutProgress et NextExerciseCard : la séance en cours, relue à chaque mise à jour
  function renderData() {
    const d = ctx.data() || {};
    const p = d.progress || [];
    const done = p.filter((x) => x >= 1).length;
    prog.innerHTML = p.map((x) => `<i style="--f:${Math.max(0, Math.min(1, x)).toFixed(3)}"></i>`).join('');
    prog.setAttribute('aria-label', p.length ? done + ' exercice' + (done > 1 ? 's' : '') + ' fait' + (done > 1 ? 's' : '') + ' sur ' + p.length : 'Séance');
    prog.hidden = !p.length;
    $('.rr-where').textContent = d.where || '';
    const n = d.next;
    card.hidden = !n;
    if (!n) return;
    card.className = 'rr-next' + (n.kind === 'end' ? ' end' : '');
    card.innerHTML = `<span class="rr-next-im">${n.img ? `<img src="${esc(n.img)}" alt="" decoding="async">` : IC.dumbbell}</span>
      <span class="rr-next-tx"><small>${esc(KIND[n.kind] || KIND.exercise)}</small><b>${esc(n.name)}</b>${n.detail ? `<em>${esc(n.detail)}</em>` : ''}</span>
      ${n.kind === 'end' ? '' : `<span class="rr-next-go" aria-hidden="true">${IC.chev}</span>`}`;
    card.setAttribute('aria-label', (KIND[n.kind] || KIND.exercise) + ' : ' + n.name + (n.detail ? ', ' + n.detail : '') + (n.kind === 'end' ? '' : '. Voir le détail'));
  }

  // WatchTimer, WatchDisplay, RestControls : calculés depuis le minuteur à chaque image
  function update() {
    const left = t.left(), paused = t.paused;
    const v = finished ? '00:00' : fmtCountdown(left);
    if (v !== lastV) { val.textContent = v; lastV = v; }
    const c = fmtClock(new Date());
    if (c !== lastC) { clock.textContent = c; clock.dateTime = c; lastC = c; }
    arc.style.strokeDashoffset = (RING_C * (1 - (finished ? 0 : t.progress()))).toFixed(2);
    if (paused !== lastPaused) {
      lastPaused = paused;
      node.classList.toggle('paused', paused);
      $('.rw-k').textContent = paused ? 'En pause' : 'Repos';
      for (const b of toggles) {
        b.innerHTML = paused ? IC.play : IC.pause;
        b.setAttribute('aria-label', paused ? 'Reprendre le repos' : 'Mettre le repos en pause');
        b.setAttribute('aria-pressed', String(paused));
      }
    }
  }
  function loop() { if (!alive) return; update(); raf = requestAnimationFrame(loop); }

  node.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b || finished) { if (b && b.dataset.a === 'close') close(); return; }
    const a = b.dataset.a;
    if (a === 'toggle') ctx.onToggle();
    else if (a === 'restart') ctx.onRestart();
    else if (a === 'skip') ctx.onSkip();
    else if (a === 'next') { if (!card.classList.contains('end')) ctx.onNext(); }
    else if (a === 'close') close();
    update();
  });

  // l'heure et le décompte se remettent à jour dès le retour dans l'app
  const onVis = () => { if (!document.hidden && alive) update(); };
  renderData(); update();
  const closeLayer = openLayer(node, { sheet: false, label: 'Repos', onClose: () => {
    alive = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis);
    if (ctx.onClose) ctx.onClose();
  } });
  node.closest('.tr-full').classList.add('rr-layer');
  if (!REDUCED) node.classList.add('enter');
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(loop);

  function close() { if (alive) closeLayer(); }
  return {
    el: node,
    update() { renderData(); update(); },
    // repos fini : la montre l'annonce, les commandes se figent ; la fermeture vient ensuite
    finish() { finished = true; node.classList.add('fin'); $('.rw-k').textContent = 'C’est reparti'; update(); },
    close,
    get open() { return alive; },
  };
}
