// ===== Onboarding plein écran : Ren pose une question par écran =====
const RENIMG = pose => { const im = document.querySelector('.hd-p-' + pose); return im ? im.src : ''; };
const OQY = new Date().getFullYear();
const OQ = [
  { id: 'intro', step: 0, pose: 'forme', fx: true, type: 'intro', q: 'Salut, moi c’est Ren.', sub: 'Je serai ton coach. Avant de s’entraîner, j’ai besoin de te connaître. Deux minutes, promis.' },
  { id: 'firstName', step: 0, pose: 'repos', type: 'text', q: 'Comment tu t’appelles ?', sub: 'Juste pour savoir comment t’appeler.' },
  { id: 'sex', step: 0, pose: 'repos', type: 'choice', q: 'Pour les calculs, tu es…', sub: 'Les besoins ne sont pas les mêmes.', opts: [['male', 'Un homme'], ['female', 'Une femme']] },
  { id: 'birthYear', step: 0, pose: 'repos', type: 'ruler', q: 'Tu es né en quelle année ?', sub: 'Tes besoins évoluent avec l’âge.', min: 1950, max: OQY - 10, inc: 1, def: 1998, every: 10, unit: '', fmt: v => String(v), extra: v => (OQY - v) + ' ans' },
  { id: 'height', step: 0, pose: 'repos', type: 'ruler', q: 'Quelle est ta taille ?', sub: 'Cela me permet d’adapter ton programme et d’estimer tes besoins.', min: 140, max: 210, inc: 1, def: 175, every: 10, unit: 'm', fmt: v => (v / 100).toFixed(2).replace('.', ','), lab: v => (v / 100).toFixed(2).replace('.', ',') },
  { id: 'weight', step: 0, pose: 'repos', type: 'ruler', q: 'Et ton poids ?', sub: 'Pas de jugement ici, c’est juste un point de départ.', min: 40, max: 160, inc: 0.5, def: 75, every: 20, minor: 2, unit: 'kg', fmt: v => v.toFixed(1).replace('.', ',') },
  { id: 'job', step: 0, pose: 'concentre', type: 'choice', q: 'Au travail, tu es plutôt…', sub: 'Ta dépense de tous les jours compte beaucoup.', opts: [['assis', 'Assis', 'Bureau, ordinateur'], ['debout', 'Debout', 'Commerce, enseignement, soins'], ['physique', 'Physique', 'Chantier, manutention']] },
  { id: 'sportDays', step: 0, pose: 'pret', type: 'num', q: 'Combien de jours de sport par semaine ?', sub: 'Tous sports confondus, natation comprise.', opts: [0, 1, 2, 3, 4, 5, 6, 7] },
  { id: 'goal', step: 1, pose: 'concentre', type: 'choice', q: 'Qu’est-ce qu’on vise ensemble ?', sub: 'On pourra le changer plus tard.', opts: [['perte', 'Perte de gras', 'Déficit modéré'], ['recompo', 'Recomposition', 'Moins de gras, autant de muscle'], ['prise', 'Prise de muscle', 'Léger surplus'], ['forme', 'Forme', 'Maintien']] },
  { id: 'experience', step: 1, pose: 'concentre', type: 'choice', q: 'Ton niveau en musculation ?', sub: 'Pour doser la difficulté.', opts: [['debutant', 'Débutant', 'Moins d’un an'], ['intermediaire', 'Intermédiaire', '1 à 3 ans'], ['avance', 'Avancé', 'Plus de 3 ans']] },
  { id: 'sessions', step: 1, pose: 'forme', type: 'num', q: 'Combien de séances de muscu par semaine ?', sub: 'Sois réaliste : la régularité bat l’intensité.', opts: [2, 3, 4, 5, 6] },
  { id: 'zones', step: 1, pose: 'forme', type: 'multi', optional: true, q: 'Des zones à travailler en priorité ?', sub: 'Plusieurs choix possibles. Tu peux aussi passer.', opts: [['bras', 'Bras'], ['epaules', 'Épaules'], ['dos', 'Dos'], ['pecs', 'Pectoraux'], ['jambes', 'Jambes'], ['abdos', 'Abdos']] },
  { id: 'targets', step: 1, pose: 'zone', fx: true, type: 'targets', q: 'Voilà tes cibles.', sub: 'Je les ajusterai avec tes pesées.' },
  { id: 'morpho', step: 2, pose: 'repos', type: 'morpho', q: 'Choisis ton personnage.', sub: 'Il évoluera avec tes séances.' },
  { id: 'perso', step: 3, avatar: true, type: 'perso', q: 'Montre-moi ton style.', sub: 'Les objets verrouillés, on les gagnera ensemble.' },
  { id: 'coach', step: 4, pose: 'concentre', type: 'coach', q: 'Qui veut te coacher ?', sub: 'Ton coach t’accompagne avant et après chaque séance.' },
  { id: 'tone', step: 4, pose: 'pret', type: 'choice', q: 'On te parle comment ?', sub: 'Ton coach adaptera son ton.', opts: [['bienveillant', 'Bienveillant', 'Encourageant, à ton rythme'], ['exigeant', 'Exigeant', 'Direct, sans excuse']] },
  { id: 'programme', step: 5, pose: 'forme', type: 'programme', q: 'Côté programme…', sub: '' },
  { id: 'final', step: 6, pose: 'zone', fx: true, type: 'final', q: 'Bienvenue dans l’équipe !', sub: 'Première mission : valider ta prochaine séance.' },
];
const OQ_REACT = {
  sex: { male: 'Noté.', female: 'Noté.' },
  job: { assis: 'Assis toute la journée : on compensera à l’entraînement.', debout: 'Debout, c’est déjà une bonne dépense.', physique: 'Physique ! Il faudra bien manger.' },
  goal: { perte: 'Perte de gras : déficit modéré, on garde la force.', recompo: 'Recomposition : moins de gras, autant de muscle. Mon préféré.', prise: 'Prise de muscle : on mange un peu plus et on pousse lourd.', forme: 'La forme d’abord. La régularité fera le reste.' },
  experience: { debutant: 'Parfait, on part sur de bonnes bases.', intermediaire: 'On va affiner tout ça.', avance: 'Je vais devoir être à la hauteur.' },
  tone: { bienveillant: '« Haut A aujourd’hui, on y va ? »', exigeant: '« Haut A. Pas d’excuse. »' },
};
const oqArrow = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
let oqTypeT = null, oqPoseCur = null, oqFlip = false, oqTab = 'peau';

function oqBuild() {
  const O = document.getElementById('onb');
  if (O.dataset.oq) return;
  O.dataset.oq = '1'; O.className = 'onb oq';
  O.innerHTML = '<div class="oq-stage"><div class="hd-bg"></div><div class="oq-glow" id="oqGlow"></div><div class="oq-lines" id="oqLines"></div>'
    + '<img class="oq-c" id="oqC0" alt="" aria-hidden="true"><img class="oq-c" id="oqC1" alt="" aria-hidden="true"><canvas class="oq-av" id="oqAv" aria-hidden="true"></canvas><div class="oq-shade"></div></div>'
    + '<button type="button" class="oq-back" id="oqBack" aria-label="Question précédente"><svg width="11" height="18" viewBox="0 0 11 18" aria-hidden="true"><path d="M9 2 2 9l7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
    + '<div class="oq-prog" id="oqProg" aria-hidden="true">' + '<i><b></b></i>'.repeat(7) + '</div>'
    + '<div class="oq-bub" id="oqBub" role="status" aria-live="polite"><span class="oq-who" id="oqWho">Coach Ren</span><p class="oq-q" id="oqQ"></p><p class="oq-sub" id="oqSub"></p></div>'
    + '<div class="oq-sheet" id="oqSheet"><div class="oq-ctl" id="oqCtl"></div><button type="button" class="oq-go" id="oqGo"><span id="oqGoT">Continuer</span>' + oqArrow + '</button><button type="button" class="oq-alt" id="oqAlt" hidden></button></div>';
  document.getElementById('oqGo').onclick = oqNext;
  document.getElementById('oqBack').onclick = oqPrev;
  document.getElementById('oqAlt').onclick = oqAlt;
  document.getElementById('oqBub').onclick = () => oqFinishType();
  document.getElementById('oqCtl').addEventListener('click', oqClick);
  document.getElementById('oqCtl').addEventListener('input', oqInput);
}
const oqCur = () => OQ[ONB.qi];
function oqVal(id) {
  if (id === 'tone') return ONB.coach.tone;
  return ONB.p[id];
}
function oqAnswered(q) {
  if (['intro', 'targets', 'morpho', 'perso', 'coach', 'programme', 'final', 'text', 'multi'].includes(q.type) || q.optional) return true;
  if (q.type === 'ruler') return true;
  return (ONB.answered || []).includes(q.id) || (PROFILE && PROFILE[q.id] != null && q.id !== 'tone') || (q.id === 'tone' && COACH);
}
function oqSetPose(pose, fx) {
  const lines = document.getElementById('oqLines'), glow = document.getElementById('oqGlow');
  lines.classList.toggle('on', !!fx && !REDUCED); glow.classList.toggle('on', !!fx);
  const av = document.getElementById('oqAv');
  if (!pose) { ['oqC0', 'oqC1'].forEach(id => document.getElementById(id).classList.remove('on')); oqPoseCur = null; return; }
  av.classList.remove('on');
  if (pose === oqPoseCur) return;
  oqFlip = !oqFlip;
  const nxt = document.getElementById(oqFlip ? 'oqC1' : 'oqC0'), prv = document.getElementById(oqFlip ? 'oqC0' : 'oqC1');
  nxt.src = RENIMG(pose); nxt.setAttribute('data-pose', pose);
  prv.classList.remove('on'); void nxt.offsetWidth; nxt.classList.add('on');
  oqPoseCur = pose;
}
function oqType(text) {
  const el = document.getElementById('oqQ'); clearInterval(oqTypeT);
  if (REDUCED) { el.textContent = text; el.classList.remove('typing'); return; }
  let i = 0; el.textContent = ''; el.classList.add('typing');
  oqTypeT = setInterval(() => { i = Math.min(text.length, i + 2); el.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(oqTypeT); el.classList.remove('typing'); } }, 24);
  el.dataset.full = text;
}
function oqFinishType() { const el = document.getElementById('oqQ'); if (el.dataset.full) { clearInterval(oqTypeT); el.textContent = el.dataset.full; el.classList.remove('typing'); } }
function oqSay(text, react) {
  const s = document.getElementById('oqSub'); s.style.opacity = 0;
  setTimeout(() => { s.textContent = text; s.classList.toggle('react', !!react); s.style.opacity = 1; }, 160);
}
function oqProgress() {
  const q = oqCur(), bars = document.querySelectorAll('#oqProg b');
  bars.forEach((b, i) => {
    if (i < q.step) b.style.width = '100%';
    else if (i > q.step) b.style.width = '0%';
    else { const inStep = OQ.filter(x => x.step === q.step && x.type !== 'intro'), k = inStep.indexOf(q); b.style.width = (k < 0 ? 10 : Math.round((k + 1) / inStep.length * 100)) + '%'; }
  });
}
function oqTitle(q) {
  if (q.id === 'final') return 'Bienvenue dans l’équipe' + (ONB.p.firstName ? ', ' + ONB.p.firstName : '') + ' !';
  if (q.id === 'goal' && ONB.p.firstName) return 'Qu’est-ce qu’on vise ensemble, ' + ONB.p.firstName + ' ?';
  return q.q;
}
function oqSubFor(q) {
  if (q.id === 'programme') { const n = ONB.p.sessions; return 'Pour ' + n + ' séances, je te conseille un ' + (n <= 3 ? 'full body' : n === 4 ? 'haut / bas' : 'push / pull / legs') + '. On peut le construire ensemble.'; }
  if (q.id === 'final' && ONB.coach.id === 'aya') return 'Aya prend le relais dans l’app. Première mission : valider ta prochaine séance.';
  if (q.id === 'final' && ONB.coach.tone === 'exigeant') return 'Première mission : ta prochaine séance. Pas d’excuse.';
  return q.sub;
}
function oqRuler(q) {
  const v = ONB.p[q.id] !== '' && ONB.p[q.id] != null ? Number(ONB.p[q.id]) : q.def;
  ONB.p[q.id] = v;
  const span = q.max - q.min, pct = (v - q.min) / span, minor = q.minor || 1;
  let ticks = '';
  for (let t = q.min; t <= q.max + 1e-9; t += minor) {
    const x = ((t - q.min) / span * 100).toFixed(3), major = Math.abs((t - q.min) % q.every) < 1e-9, mid = !major && Math.abs((t - q.min) % (q.every / 2)) < 1e-9;
    ticks += '<line x1="' + x + '%" x2="' + x + '%" y1="' + (major ? 0 : mid ? 8 : 14) + '" y2="' + (major ? 44 : mid ? 36 : 30) + '" stroke="rgba(245,245,247,' + (major ? '.7' : '.32') + ')" stroke-width="' + (major ? 2 : 1.4) + '"/>';
  }
  let labels = '';
  for (let t = q.min; t <= q.max + 1e-9; t += q.every) labels += '<span class="oq-rl" style="left:' + ((t - q.min) / span * 100).toFixed(3) + '%">' + (q.lab ? q.lab(t) : t) + '</span>';
  return '<div class="oq-val"><b id="oqV">' + q.fmt(v) + '</b>' + (q.unit ? '<span>' + q.unit + '</span>' : '') + (q.extra ? '<em id="oqX">' + q.extra(v) + '</em>' : '') + '</div>'
    + '<div class="oq-ruler" id="oqRuler" style="--p:' + pct.toFixed(4) + '"><svg aria-hidden="true">' + ticks + '</svg>' + labels + '<div class="oq-knob"></div>'
    + '<input type="range" id="oqRange" min="' + q.min + '" max="' + q.max + '" step="' + (q.inc || 1) + '" value="' + v + '" aria-label="' + esc(q.q) + '" aria-valuetext="' + q.fmt(v) + ' ' + q.unit + '"></div>';
}
function oqItems(slot) {
  const c = ONB.av;
  return '<div class="oq-items">' + AV_CAT.items.filter(i => i.slot === slot && AV.fitsBody(i, c)).map(it => {
    const own = AV.isOwned(it, AVINV), on = c[slot] && c[slot].item === it.id;
    return own ? '<button type="button" data-av="' + it.id + '" aria-pressed="' + on + '">' + esc(it.name) + '</button>'
               : '<button type="button" class="locked" data-locked="' + it.id + '" aria-disabled="true">🔒 ' + esc(it.name) + '</button>';
  }).join('') + '</div>';
}
const oqSw = (pal, f, cur) => '<div class="oq-sw">' + Object.entries(AV_CAT.palettes[pal]).map(([id, hex]) => '<button type="button" data-sw="' + f + '" data-val="' + id + '" style="background:' + hex + '" aria-pressed="' + (cur === id) + '" aria-label="' + id + '"></button>').join('') + '</div>';
function oqCtlHtml(q) {
  const p = ONB.p, c = ONB.av;
  switch (q.type) {
    case 'intro': return '';
    case 'text': return '<div class="oq-reply"><input id="oqText" type="text" autocomplete="given-name" autocapitalize="words" enterkeyhint="next" maxlength="24" placeholder="Ton prénom" value="' + esc(p.firstName || '') + '" aria-label="Ton prénom"></div>';
    case 'choice': {
      const age = p.birthYear ? OQY - p.birthYear : null, cur = oqVal(q.id);
      return '<div class="oq-opts">' + q.opts.map(([v, l, d]) => { const dis = q.id === 'goal' && v === 'perte' && age != null && age < 18;
        return '<button type="button" class="oq-opt" data-o="' + v + '" aria-pressed="' + (cur === v && oqAnswered(q)) + '"' + (dis ? ' disabled' : '') + '><div><b>' + l + '</b>' + (d || dis ? '<span>' + (dis ? 'Non proposé avant 18 ans' : d) + '</span>' : '') + '</div></button>'; }).join('') + '</div>';
    }
    case 'num': return '<div class="oq-nums">' + q.opts.map(v => '<button type="button" data-o="' + v + '" aria-pressed="' + (Number(p[q.id]) === v && oqAnswered(q)) + '">' + v + '</button>').join('') + '</div>';
    case 'multi': return '<div class="oq-chips">' + q.opts.map(([v, l]) => '<button type="button" data-m="' + v + '" aria-pressed="' + (p.zones || []).includes(v) + '">' + l + '</button>').join('') + '</div>';
    case 'ruler': return oqRuler(q);
    case 'targets': { const t = computeTargets(p); return '<div class="oq-targets"><div><b id="oqTk" data-v="0">0</b><span>kcal les jours de repos</span></div><div><b id="oqTp" data-v="0">0</b><span>g de protéines par jour</span></div></div><p class="oq-note">Les jours de muscu : ' + t.train.toLocaleString('fr-FR') + ' kcal. Calcul de Mifflin-St Jeor ajusté à ton activité et à ton objectif.</p>'; }
    case 'morpho': return '<div class="oq-seg">' + [['male', 'Homme'], ['female', 'Femme']].map(([v, l]) => '<button type="button" data-base="' + v + '" aria-pressed="' + (c.base === v) + '">' + l + '</button>').join('') + '</div>'
      + '<div class="oq-builds">' + [['slim', 'Fin'], ['athletic', 'Athlétique'], ['strong', 'Costaud']].map(([v, l]) => '<button type="button" data-build="' + v + '" aria-pressed="' + (c.body.build === v) + '"><canvas data-thumb="' + v + '"></canvas>' + l + '</button>').join('') + '</div>';
    case 'perso': {
      const tabs = [['peau', 'Peau'], ['cheveux', 'Cheveux']].concat(c.base === 'male' ? [['barbe', 'Barbe']] : []).concat([['haut', 'Haut'], ['bas', 'Bas'], ['chaussures', 'Chaussures'], ['yeux', 'Yeux']]);
      if (!tabs.some(t => t[0] === oqTab)) oqTab = 'peau';
      const body = { peau: oqSw('skin', 'skin', c.skin.tone), cheveux: oqItems('hair') + '<div style="height:12px"></div>' + oqSw('hair', 'hair', c.hair.color), barbe: oqItems('beard'), haut: oqItems('top'), bas: oqItems('bottom'), chaussures: oqItems('shoes'), yeux: oqSw('eyes', 'eyes', c.face.eyeColor) }[oqTab];
      return '<div class="oq-tabs" role="tablist">' + tabs.map(([k, l]) => '<button type="button" role="tab" data-tab="' + k + '" aria-selected="' + (oqTab === k) + '">' + l + '</button>').join('') + '</div>' + body;
    }
    case 'coach': return '<div class="oq-coachs">' + Object.entries(COACHES).map(([id, k]) => '<button type="button" data-coach="' + id + '" aria-pressed="' + (ONB.coach.id === id) + '">' + (coachPortrait(id) ? '<img src="' + coachPortrait(id) + '" alt="">' : '<div style="height:150px"></div>') + '<b>' + k.name + '</b><span>' + (id === 'ren' ? 'C’est moi !' : 'Portrait provisoire') + '</span></button>').join('') + '</div>';
    case 'programme': {
      const pc = ONB.prog || 'keep', cn = (COACHES[ONB.coach && ONB.coach.id] || COACHES.ren).name;
      const opt = (k, b, t) => '<button type="button" class="oq-opt" data-prog="' + k + '" aria-pressed="' + (pc === k) + '"><div><b>' + b + '</b><span>' + t + '</span></div></button>';
      return '<div class="oq-opts">' + opt('keep', 'Garder mon programme actuel', esc(TR.summaryText(PROGRAM)))
        + opt('coach', 'Le construire avec ' + esc(cn), 'Quelques questions, et ' + (cn === 'Aya' ? 'elle' : 'il') + ' te propose des séances adaptées')
        + opt('create', 'Le construire seul', 'Tes exercices, tes séries, ton temps de repos') + '</div>';
    }
    case 'final': { const xp = totalXP(); return '<div class="oq-fin"><canvas id="oqFin"></canvas><div><b>Niveau ' + lvlOf(xp) + ' · Rang ' + RANKS[rankIdx(xp)][0] + '</b><p>' + computeTargets(p).base.toLocaleString('fr-FR') + ' kcal au repos, ' + computeTargets(p).protein + ' g de protéines</p></div></div><label class="oq-check"><input type="checkbox" id="oqHero"' + (ONB.heroAvatar ? ' checked' : '') + '> Afficher mon avatar dans l’accueil</label>'; }
  }
  return '';
}
function oqRender(full) {
  const q = oqCur(), O = document.getElementById('onb');
  O.hidden = false;
  // Scène : Ren (pose selon la question) ou l'avatar pendant la personnalisation
  O.classList.toggle('perso', !!q.avatar);
  if (q.avatar) { oqSetPose(null, false); oqAvatarStage(); } else oqSetPose(q.pose, q.fx);
  document.getElementById('oqBack').hidden = ONB.qi === 0;
  oqProgress();
  const who = document.getElementById('oqWho');
  who.innerHTML = (q.avatar ? '<img src="' + RENIMG('concentre') + '" alt="">' : '') + 'Coach Ren';
  if (full) {
    const bub = document.getElementById('oqBub'); bub.classList.remove('in'); void bub.offsetWidth; bub.classList.add('in');
    oqType(oqTitle(q));
    const s = document.getElementById('oqSub'); s.classList.remove('react'); s.style.opacity = 1; s.textContent = oqSubFor(q);
  }
  const ctl = document.getElementById('oqCtl');
  ctl.innerHTML = oqCtlHtml(q);
  if (full) { ctl.classList.remove('in'); void ctl.offsetWidth; ctl.classList.add('in'); ctl.scrollTop = 0; }
  const go = document.getElementById('oqGo'), alt = document.getElementById('oqAlt');
  document.getElementById('oqGoT').textContent = q.type === 'intro' ? 'Faisons connaissance' : q.type === 'final' ? 'C’est parti' : (q.type === 'multi' && !(ONB.p.zones || []).length) ? 'Passer' : 'Continuer';
  go.disabled = !oqAnswered(q);
  alt.hidden = q.type !== 'intro'; alt.textContent = MS.cloud.enabled ? 'J’ai déjà un compte ou une sauvegarde' : 'J’ai déjà une sauvegarde';
  if (q.type === 'ruler') oqRulerBind(q);
  if (q.type === 'morpho') onbThumbs();
  if (q.type === 'targets') { const t = computeTargets(ONB.p); setTimeout(() => { animNum(document.getElementById('oqTk'), t.base); animNum(document.getElementById('oqTp'), t.protein); }, REDUCED ? 0 : 350); }
  if (q.type === 'final') { const cv = document.getElementById('oqFin'); AV.renderAvatar(avConfigNow(AV.normalizeConfig(ONB.av, AV_CAT, AVINV).config), AV_CAT, AV_ASSETS, { expression: 'joy', scale: 0.2, canvas: cv }); }
  if (q.type === 'text' && full) setTimeout(() => { const t = document.getElementById('oqText'); if (t && !('ontouchstart' in window)) t.focus(); }, 400);
}
async function oqAvatarStage() {
  const av = document.getElementById('oqAv');
  ONB.av = AV.normalizeConfig(ONB.av, AV_CAT, AVINV).config;
  await AV.renderAvatar(avConfigNow(ONB.av), AV_CAT, AV_ASSETS, { expression: 'neutral', scale: 0.36, canvas: av });
  av.classList.add('on');
}
function oqRulerBind(q) {
  const R = document.getElementById('oqRuler'), I = document.getElementById('oqRange');
  let drag = false;
  const set = v => {
    const inc = q.inc || 1;   // pas de la règle (« step » désigne l'étape de l'onboarding)
    v = Math.min(q.max, Math.max(q.min, Math.round(v / inc) * inc)); v = Math.round(v * 10) / 10;
    if (v === ONB.p[q.id]) return;
    ONB.p[q.id] = v; I.value = v; R.style.setProperty('--p', ((v - q.min) / (q.max - q.min)).toFixed(4));
    document.getElementById('oqV').textContent = q.fmt(v); const x = document.getElementById('oqX'); if (x) x.textContent = q.extra(v);
    I.setAttribute('aria-valuetext', q.fmt(v) + ' ' + q.unit);
  };
  const fromX = cx => { const r = R.getBoundingClientRect(); set(q.min + Math.max(0, Math.min(1, (cx - r.left) / r.width)) * (q.max - q.min)); };
  I.addEventListener('pointerdown', e => { drag = true; R.classList.add('drag'); try { I.setPointerCapture(e.pointerId); } catch (_) {} fromX(e.clientX); e.preventDefault(); });
  I.addEventListener('pointermove', e => { if (drag) fromX(e.clientX); });
  const end = () => { drag = false; R.classList.remove('drag'); };
  I.addEventListener('pointerup', end); I.addEventListener('pointercancel', end);
  I.addEventListener('input', () => set(Number(I.value)));
}
function oqClick(e) {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const q = oqCur(), p = ONB.p, c = ONB.av;
  const pop = () => { b.classList.remove('oq-pop'); void b.offsetWidth; b.classList.add('oq-pop'); };
  if (b.dataset.o != null && (q.type === 'choice' || q.type === 'num')) {
    const v = q.type === 'num' ? Number(b.dataset.o) : b.dataset.o;
    if (q.id === 'tone') ONB.coach.tone = v; else p[q.id] = v;
    ONB.answered = (ONB.answered || []).filter(x => x !== q.id).concat(q.id);
    document.querySelectorAll('#oqCtl [data-o]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    pop(); document.getElementById('oqGo').disabled = false;
    const r = OQ_REACT[q.id] && OQ_REACT[q.id][b.dataset.o];
    if (r) oqSay(r, true);
    else if (q.id === 'sportDays') oqSay(v === 0 ? 'On va changer ça ensemble.' : v >= 5 ? v + ' jours, sérieux !' : v + ' jours, c’est une bonne base.', true);
    else if (q.id === 'sessions') oqSay(v <= 3 ? v + ' séances, c’est solide pour progresser.' : v === 4 ? '4 séances : le rythme idéal.' : v + ' séances ? Il faudra bien récupérer.', true);
    return;
  }
  if (b.dataset.m) { const m = b.dataset.m; p.zones = (p.zones || []).includes(m) ? p.zones.filter(x => x !== m) : (p.zones || []).concat(m); b.setAttribute('aria-pressed', String(p.zones.includes(m))); pop(); document.getElementById('oqGoT').textContent = p.zones.length ? 'Continuer' : 'Passer'; if (p.zones.includes('bras')) oqSay('Les bras, ma spécialité.', true); return; }
  if (b.dataset.base) { c.base = b.dataset.base; ONB.baseChosen = true; oqRender(false); return; }
  if (b.dataset.build) { c.body.build = b.dataset.build; ONB.buildChosen = true; oqRender(false); oqSay({ slim: 'Fin et vif. On va construire.', athletic: 'Athlétique, belle base de départ.', strong: 'Costaud. On va sculpter tout ça.' }[c.body.build], true); return; }
  if (b.dataset.tab) { oqTab = b.dataset.tab; oqRender(false); return; }
  if (b.dataset.locked) { const it = AV.itemById(AV_CAT, b.dataset.locked); pop(); oqSay('Celui-là se mérite : ' + AV.unlockLabel(it.unlock).toLowerCase() + '.', true); return; }
  if (b.dataset.av) { const it = AV.itemById(AV_CAT, b.dataset.av); c[it.slot] = Object.assign({}, c[it.slot], { item: it.id, colorway: (it.colorways || [])[0] || null }); oqRender(false); return; }
  if (b.dataset.sw) { const f = b.dataset.sw, v = b.dataset.val; if (f === 'skin') c.skin.tone = v; else if (f === 'hair') c.hair.color = v; else if (f === 'eyes') c.face.eyeColor = v; oqRender(false); return; }
  if (b.dataset.prog) { ONB.prog = b.dataset.prog; document.querySelectorAll('#oqCtl [data-prog]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); pop(); oqSay({ keep: 'On garde ce qui marche.', coach: 'Parfait, on le construit ensemble juste après.', create: 'Parfait, tu le construiras juste après.' }[ONB.prog], true); return; }
  if (b.dataset.coach) { ONB.coach.id = b.dataset.coach; document.querySelectorAll('#oqCtl [data-coach]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); pop(); oqSay(b.dataset.coach === 'ren' ? 'Content que tu me choisisses. On va bien bosser.' : 'Bon choix. Aya prendra le relais dans l’app.', true); }
}
function oqInput(e) {
  if (e.target.id === 'oqText') { ONB.p.firstName = e.target.value.trim(); clearTimeout(obNameTimerOq); const v = ONB.p.firstName; if (v.length >= 2) obNameTimerOq = setTimeout(() => oqSay('Enchanté, ' + v + ' !', true), 650); }
  if (e.target.id === 'oqHero') ONB.heroAvatar = e.target.checked;
}
let obNameTimerOq = null;
function oqNext() {
  const q = oqCur();
  if (q.type === 'final') return onbFinish();
  if (q.id === 'weight') {   // contrôle d'ensemble du profil avant les objectifs
    const errs = profileValid(ONB.p);
    if (errs.length && !(errs.length === 1 && errs[0].indexOf('parent') >= 0)) { oqSay('Il me manque : ' + errs.join(', ') + '.', true); return; }
    if (OQY - ONB.p.birthYear < 15 && !ONB.p.parentOk) { TRUI.ask({ title: 'Tu as moins de 15 ans : un parent doit être d’accord pour que tu utilises l’app. C’est le cas ?', ok: 'Oui', cancel: 'Non' }).then(ok => { if (ok) { ONB.p.parentOk = true; oqNext(); } }); return; }
  }
  ONB.qi = Math.min(OQ.length - 1, ONB.qi + 1);
  if (OQ[ONB.qi].id === 'morpho' && !ONB.buildChosen && ONB.p.height && ONB.p.weight) { const bmi = ONB.p.weight / Math.pow(ONB.p.height / 100, 2); ONB.av.body.build = bmi < 21 ? 'slim' : bmi <= 27 ? 'athletic' : 'strong'; }
  if (OQ[ONB.qi].id === 'morpho' && !ONB.baseChosen) ONB.av.base = ONB.p.sex || 'male';
  if (OQ[ONB.qi].id === 'goal' && ONB.p.birthYear && OQY - ONB.p.birthYear < 18 && ONB.p.goal === 'perte') ONB.p.goal = 'forme';
  jset('onb:draft', ONB); oqRender(true);
}
function oqPrev() { if (ONB.qi > 0) { ONB.qi--; oqRender(true); } }
function oqAlt() { if (MS.cloud.enabled) { MS.openAccount({ from: 'onboarding' }); return; } const f = document.getElementById('bkFile'); f.value = ''; f.click(); }

// Remplace l'ouverture, le rendu et la fin de l'onboarding précédent (les données restent les mêmes)
onbOpen = function (startAt) {
  oqBuild();
  ONB = jget('onb:draft', null) || onbDefaults();
  if (ONB.qi == null) ONB.qi = 0;
  if (startAt != null) { const idx = OQ.findIndex(x => x.step === startAt && x.type !== 'intro'); ONB.qi = idx >= 0 ? idx : 0; }
  makeAyaPortrait();
  oqPoseCur = null;
  oqRender(true);
};
onbRender = function () { oqRender(true); };
onbNext = oqNext;
const _onbFinishOq = onbFinish;
onbFinish = function () {
  const O = document.getElementById('onb'); if (O.classList.contains('out')) return;
  const pc = ONB.prog || 'keep', pp = Object.assign({}, ONB.p);
  const done = () => { _onbFinishOq(); onbProgramChoice(pc, pp); };
  if (REDUCED) { done(); return; }
  O.classList.add('out');
  setTimeout(() => { O.classList.remove('out'); done(); showView('home'); replayHome(); }, 360);
};
// Si l'onboarding s'est ouvert au chargement avec l'ancienne interface, on bascule sur la nouvelle
if (ONB && !document.getElementById('onb').hidden) { const keep = ONB; oqBuild(); ONB = keep; if (ONB.qi == null) ONB.qi = 0; oqRender(true); }

// ===== Onboarding : coach en 3D (plans en profondeur, balancement, inclinaison au doigt), placement adaptatif =====
// Repères du visage dans chaque pose (fractions de l'image) : proportion, largeur de tête, centre du visage
const OQ_POSE = { repos: { r: 0.546, hw: 0.40, fx: 0.55, fy: 0.085 }, pret: { r: 0.523, hw: 0.40, fx: 0.51, fy: 0.10 }, concentre: { r: 0.408, hw: 0.38, fx: 0.49, fy: 0.065 }, forme: { r: 0.334, hw: 0.48, fx: 0.60, fy: 0.065 }, zone: { r: 0.497, hw: 0.32, fx: 0.56, fy: 0.12 } };
let oqTilt = { rx: 0, ry: 0, tx: 0, ty: 0, drag: null, raf: 0, t0: 0, gyro: null, hintShown: false };

oqBuild = function () {
  const O = document.getElementById('onb');
  if (O.dataset.oq === '3d') return;
  O.dataset.oq = '3d'; O.className = 'onb oq';
  O.innerHTML = '<div class="oq-stage" id="oqStage"><div class="oq-rig" id="oqRig"><div class="hd-bg"></div><div class="oq-glow" id="oqGlow"></div><div class="oq-lines" id="oqLines"></div>'
    + '<div class="oq-cw"><img class="oq-c" id="oqC0" alt="" aria-hidden="true"><img class="oq-c" id="oqC1" alt="" aria-hidden="true"></div><canvas class="oq-av" id="oqAv" aria-hidden="true"></canvas></div><div class="oq-shade"></div></div>'
    + '<div class="oq-hint" id="oqHint" aria-hidden="true">Fais glisser pour tourner autour de Ren</div>'
    + '<div class="oq-brand" id="oqBrand" hidden>' + BRAND.brandMark({ size: 'm' }) + '</div>'
    + '<button type="button" class="oq-back" id="oqBack" aria-label="Question précédente"><svg width="11" height="18" viewBox="0 0 11 18" aria-hidden="true"><path d="M9 2 2 9l7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
    + '<div class="oq-prog" id="oqProg" aria-hidden="true">' + '<i><b></b></i>'.repeat(7) + '</div>'
    + '<div class="oq-bub" id="oqBub" role="status" aria-live="polite"><span class="oq-who" id="oqWho">Coach Ren</span><p class="oq-q" id="oqQ"></p><p class="oq-sub" id="oqSub"></p></div>'
    + '<div class="oq-sheet" id="oqSheet"><div class="oq-ctl" id="oqCtl"></div><button type="button" class="oq-go" id="oqGo"><span id="oqGoT">Continuer</span>' + oqArrow + '</button><button type="button" class="oq-alt" id="oqAlt" hidden></button></div>';
  document.getElementById('oqGo').onclick = () => oqNext();
  document.getElementById('oqBack').onclick = () => oqPrev();
  document.getElementById('oqAlt').onclick = () => oqAlt();
  document.getElementById('oqBub').onclick = () => oqFinishType();
  document.getElementById('oqCtl').addEventListener('click', e => oqClick(e));
  document.getElementById('oqCtl').addEventListener('input', e => oqInput(e));
  oqTiltBind();
};

// ---- Placement : le visage se cale à gauche de la bulle, toujours au-dessus de la carte de réponses ----
function oqLayout() {
  const O = document.getElementById('onb'); if (!O || O.hidden || !O.dataset.oq) return;
  const oR = O.getBoundingClientRect(), vw = oR.width;
  const bub = document.getElementById('oqBub').getBoundingClientRect(), sh = document.getElementById('oqSheet').getBoundingClientRect();
  const bubTop = bub.top - oR.top, bubBot = bub.bottom - oR.top, sheetTop = sh.top - oR.top;
  O.style.setProperty('--sheetH', Math.round(oR.bottom - sh.top) + 'px');
  const room = sheetTop - bubTop;
  ['oqC0', 'oqC1'].forEach(id => {
    const img = document.getElementById(id), m = OQ_POSE[img.dataset.pose]; if (!m) return;
    // Les yeux passent sous la bulle (seuls les cheveux l'effleurent) et le menton reste au-dessus de la carte
    const headW = Math.max(84, Math.min(150, vw * 0.37, (sheetTop - 14 - bubBot) / 0.62));
    const W = headW / m.hw, H = W / m.r;
    let faceY = bubBot + headW * 0.12;
    if (faceY + headW * 0.55 > sheetTop - 10) faceY = sheetTop - 10 - headW * 0.55;
    faceY = Math.max(faceY, bubTop + headW * 0.4);
    const faceX = Math.max(headW * 0.55, Math.min(vw * 0.31, 132));
    img.style.height = H.toFixed(0) + 'px'; img.style.left = (faceX - m.fx * W).toFixed(0) + 'px'; img.style.top = (faceY - m.fy * H).toFixed(0) + 'px';
  });
  const av = document.getElementById('oqAv');
  if (av) {
    const h = Math.max(220, Math.min(440, sheetTop - bubTop + 30));
    av.style.height = h.toFixed(0) + 'px'; av.style.top = (bubTop - 10).toFixed(0) + 'px'; av.style.left = (vw * 0.27 - h * 0.333).toFixed(0) + 'px';
  }
}
window.addEventListener('resize', () => oqLayout());

// ---- Animations du coach ----
function oqActive() { return document.querySelector('.oq-c.on'); }
function oqAnim(img, cls) {
  if (!img || REDUCED) return;
  img.classList.remove('enter', 'intro', 'live', 'nod', 'jump'); void img.offsetWidth; img.classList.add(cls);
  const done = () => { img.classList.remove(cls); if (img.classList.contains('on')) img.classList.add('live'); };
  img.addEventListener('animationend', done, { once: true });
}
oqSetPose = function (pose, fx) {
  const lines = document.getElementById('oqLines'), glow = document.getElementById('oqGlow'), av = document.getElementById('oqAv');
  lines.classList.toggle('on', !!fx && !REDUCED); glow.classList.toggle('on', !!fx);
  if (!pose) { ['oqC0', 'oqC1'].forEach(id => document.getElementById(id).classList.remove('on', 'live')); oqPoseCur = null; return; }
  av.classList.remove('on');
  if (pose === oqPoseCur) { oqAnim(oqActive(), 'nod'); return; }
  oqFlip = !oqFlip;
  const nxt = document.getElementById(oqFlip ? 'oqC1' : 'oqC0'), prv = document.getElementById(oqFlip ? 'oqC0' : 'oqC1');
  nxt.src = RENIMG(pose); nxt.setAttribute('data-pose', pose);
  prv.classList.remove('on', 'live');
  oqLayout();
  nxt.classList.add('on');
  oqAnim(nxt, OQ[ONB.qi] && OQ[ONB.qi].type === 'intro' ? 'intro' : 'enter');
  oqPoseCur = pose;
};

// ---- Rendu : on mesure la bulle avec le texte complet avant de placer Ren, puis le texte s'écrit ----
const _oqRenderBase = oqRender;
oqRender = function (full) {
  _oqRenderBase(full);
  const q = OQ[ONB.qi], opts = document.querySelector('#oqCtl .oq-opts');
  const brand = document.getElementById('oqBrand'); if (brand) brand.hidden = q.type !== 'intro';   // logo : écran de bienvenue seulement
  if (opts && q.type === 'choice') { const n = opts.children.length; opts.classList.toggle('g2', n === 2 || n === 4); }
  if (full) {
    const el = document.getElementById('oqQ'), text = el.dataset.full || el.textContent;
    clearInterval(oqTypeT); el.textContent = text; oqLayout(); oqType(text);
    if (q.type === 'targets' || q.type === 'final') setTimeout(() => oqAnim(oqActive(), 'jump'), 650);
    oqTilt.amp = q.type === 'intro' || q.fx ? 7 : 3;
    const hint = document.getElementById('oqHint');
    if (q.type === 'intro' && !oqTilt.hintShown && !REDUCED) { oqTilt.hintShown = true; setTimeout(() => hint.classList.add('on'), 1600); setTimeout(() => hint.classList.remove('on'), 5200); }
    else hint.classList.remove('on');
  } else oqLayout();
  oqTiltStart();
};
const _oqSayBase = oqSay;
oqSay = function (text, react) {
  _oqSayBase(text, react);
  if (react && !REDUCED) { oqAnim(oqActive(), 'nod'); const b = document.getElementById('oqBub'); b.classList.remove('wob'); void b.offsetWidth; b.classList.add('wob'); }
  setTimeout(oqLayout, 200);
};

// ---- Inclinaison 3D : balancement doux, glisser au doigt, gyroscope si disponible sans autorisation ----
function oqTiltApply() {
  const rig = document.getElementById('oqRig'), O = document.getElementById('onb'); if (!rig) return;
  rig.style.setProperty('--rx', oqTilt.rx.toFixed(2) + 'deg'); rig.style.setProperty('--ry', oqTilt.ry.toFixed(2) + 'deg');
  O.style.setProperty('--lx', (-oqTilt.ry * 0.7).toFixed(1) + 'px'); O.style.setProperty('--ly', (oqTilt.rx * 0.5).toFixed(1) + 'px');
  O.style.setProperty('--bx', (oqTilt.ry * 0.45).toFixed(1) + 'px'); O.style.setProperty('--by', (-oqTilt.rx * 0.35).toFixed(1) + 'px');
}
function oqTiltLoop(t) {
  const O = document.getElementById('onb');
  if (!O || O.hidden || REDUCED) { oqTilt.raf = 0; return; }
  if (!oqTilt.t0) oqTilt.t0 = t;
  const s = (t - oqTilt.t0) / 1000, A = oqTilt.amp || 3;
  let tx, ty;
  if (oqTilt.drag) { tx = oqTilt.drag.ry; ty = oqTilt.drag.rx; }
  else if (oqTilt.gyro) { tx = oqTilt.gyro.ry; ty = oqTilt.gyro.rx; }
  else { tx = Math.sin(s * 0.55) * A; ty = Math.sin(s * 0.38 + 1) * A * 0.35; }
  oqTilt.ry += (tx - oqTilt.ry) * 0.08; oqTilt.rx += (ty - oqTilt.rx) * 0.08;
  oqTiltApply();
  oqTilt.raf = requestAnimationFrame(oqTiltLoop);
}
function oqTiltStart() { if (!oqTilt.raf && !REDUCED) oqTilt.raf = requestAnimationFrame(oqTiltLoop); }
function oqTiltBind() {
  const O = document.getElementById('onb');
  const onStage = e => !e.target.closest('.oq-sheet, .oq-bub, .oq-back, .oq-prog');
  O.addEventListener('pointerdown', e => { if (!onStage(e)) return; oqTilt.drag = { x: e.clientX, y: e.clientY, rx: oqTilt.rx, ry: oqTilt.ry, rx0: oqTilt.rx, ry0: oqTilt.ry }; document.getElementById('oqHint').classList.remove('on'); });
  O.addEventListener('pointermove', e => {
    const d = oqTilt.drag; if (!d) return;
    const r = O.getBoundingClientRect();
    d.ry = Math.max(-20, Math.min(20, d.ry0 + (e.clientX - d.x) / r.width * 46));
    d.rx = Math.max(-11, Math.min(11, d.rx0 - (e.clientY - d.y) / r.height * 26));
  });
  const end = () => { oqTilt.drag = null; };
  O.addEventListener('pointerup', end); O.addEventListener('pointercancel', end); O.addEventListener('pointerleave', end);
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', e => {
      if (e.gamma == null) return;
      if (!oqTilt.gyroBase) oqTilt.gyroBase = { b: e.beta, g: e.gamma };
      oqTilt.gyro = { ry: Math.max(-16, Math.min(16, (e.gamma - oqTilt.gyroBase.g) * 0.5)), rx: Math.max(-9, Math.min(9, -(e.beta - oqTilt.gyroBase.b) * 0.3)) };
    });
  }
}

// Si l'onboarding est déjà ouvert avec la version précédente, on reconstruit la scène en 3D
if (ONB && !document.getElementById('onb').hidden) { const keep = ONB; oqBuild(); ONB = keep; oqPoseCur = null; oqRender(true); }
