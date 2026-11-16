// ===== Phase 1 : profil, onboarding, avatar dans l'accueil, coach, déblocages =====
const AV_ASSETS = new AV.PlaceholderAssets(AV_CAT, 0.5);
const COACHES = { ren: { name: 'Ren', base: 'male', desc: 'Ton personnage illustré' }, aya: { name: 'Aya', base: 'female', desc: 'Portrait provisoire' } };
const ONB_STEPS = ['profil', 'objectifs', 'morpho', 'perso', 'coach', 'programme', 'accueil'];
const EXPR_OF = { repos: 'tired', pret: 'neutral', concentre: 'focus', forme: 'determined', zone: 'joy' };
function jget(k, d) { try { const v = sget(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function jset(k, v) { sset(k, JSON.stringify(v)); }
let PROFILE = jget('profile', null), AVCFG = jget('avatar:config', null), AVINV = jget('avatar:inv', []), COACH = jget('coach', null);
let ONB = null, ayaPortrait = null, heroAvHash = '';

// ---- Cibles nutritionnelles (Mifflin-St Jeor + activité + objectif) ----
function computeTargets(p) {
  const age = new Date().getFullYear() - p.birthYear;
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * age + (p.sex === 'female' ? -161 : 5);
  const job = { assis: 1.2, debout: 1.3, physique: 1.45 }[p.job] || 1.2;
  const tdee = bmr * (job + 0.04 * Math.min(7, p.sportDays));
  let adj = { perte: -0.15, recompo: -0.10, prise: 0.10, forme: 0 }[p.goal] || 0;
  if (age < 18 && adj < 0) adj = 0;
  const avg = tdee * (1 + adj);
  const base = Math.round((avg - 250 * Math.min(p.sessions || 4, 7) / 7) / 50) * 50;
  const protein = Math.round(p.weight * ({ perte: 2.2, recompo: 2.0, prise: 1.8, forme: 1.6 }[p.goal] || 1.8) / 5) * 5;
  return { age, bmr: Math.round(bmr), tdee: Math.round(tdee), base, train: base + 250, protein };
}
function profileValid(p) {
  const y = new Date().getFullYear(), errs = [];
  if (!(p.birthYear >= 1930 && p.birthYear <= y - 10)) errs.push('année de naissance');
  if (!(p.height >= 120 && p.height <= 230)) errs.push('taille (120 à 230 cm)');
  if (!(p.weight >= 30 && p.weight <= 250)) errs.push('poids (30 à 250 kg)');
  if (!errs.length && y - p.birthYear < 15 && !p.parentOk) errs.push('accord d’un parent');
  return errs;
}
function applyProfile() {
  if (!PROFILE) return;
  PROT_GOAL = PROFILE.protein || 190;
  const a = document.getElementById('pfProt'); if (a) a.textContent = PROT_GOAL + ' g par jour';
  const b = document.getElementById('nutProtGoal'); if (b) b.textContent = '~' + PROT_GOAL + ' g';
}

// ---- Compteurs réels (séances validées, Haut B, jours de protéines), en lecture seule ----
function realCounters() {
  let total = 0, hautB = 0, protein = 0;
  const cur = keyFor(weekOffset).k, ks = storedWeekKeys(); ks.add(cur);
  ks.forEach(k => {
    const st = k === cur ? state : readWeek(k); if (!st) return;
    weekMain(st).forEach(ses => { if (TR.isValidated(st, ses)) { total++; if (ses.id === 'hautB') hautB++; } });
    for (let d = 1; d <= 7; d++) if (st.nutrition[d].protein >= 6) protein++;
  });
  return { sessions_total: total, sessions_hautB: hautB, protein_days: protein };
}
function avConfigNow(cfg) {
  const c = structuredClone(cfg || AVCFG);
  c.body.physiqueStage = AV.physiqueStage(realCounters().sessions_total);
  return AV.normalizeConfig(c, AV_CAT, AVINV).config;
}

// ---- Coach ----
const COACH_LINES = {
  bienveillant: { todo: ['{seance} aujourd’hui, on y va ?', 'Prêt pour {seance} ?', '{seance} t’attend, à ton rythme.'], prog: ['Plus que {reste}, tu y es presque.', 'Belle avancée, finis en douceur.'],
    done: ['Séance validée, bravo !', 'Bien joué, récupère bien.'], swim: ['Natation tranquille aujourd’hui.', 'Un peu d’eau, ça fait du bien.'],
    sport: ['{sport} aujourd’hui, fais-toi plaisir.', 'Jour de {sportmin}, profites-en.'], sportDone: ['{sport} : c’est fait, bravo !'], rest: ['Repos, ton corps se construit.', 'Journée off, savoure-la.'],
    unlock: ['Nouvel objet : {objet} !'], unlockMany: ['{n} objets débloqués, va voir !'], levelup: ['Niveau {niveau}, bravo !'], hello: ['Ravi de t’accompagner{prenom} !'] },
  exigeant: { todo: ['{seance}. Pas d’excuse.', '{seance} t’attend. Go.', 'On ne négocie pas : {seance}.'], prog: ['Encore {reste}. Termine.', 'Pas de demi-séance.'],
    done: ['Validée. Demain, pareil.', 'Propre. On continue.'], swim: ['Natation. Technique propre.', 'Dans l’eau, concentré.'],
    sport: ['{sport}. À fond, mais propre.', '{sport} aujourd’hui. Concentré.'], sportDone: ['{sport} : fait. On continue.'], rest: ['Repos. Récupère vraiment.', 'Off aujourd’hui. Dors bien.'],
    unlock: ['{objet}. Mérité.'], unlockMany: ['{n} objets gagnés. Mérité.'], levelup: ['Niveau {niveau}. Suivant.'], hello: ['On commence{prenom}. Pas de pause.'] },
};
function coachSay(type, vars, tone) {
  const set = COACH_LINES[tone || (COACH && COACH.tone) || 'bienveillant'][type] || [''];
  let h = 0; const seed = todayStr() + type; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const v = Object.assign({ prenom: PROFILE && PROFILE.firstName ? ', ' + PROFILE.firstName : '' }, vars || {});
  return set[h % set.length].replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));
}
function coachEvent(type, vars) { if (COACH) jset('coach:event', { date: todayStr(), text: coachSay(type, vars) }); }
function coachPortrait(id) {
  if (id === 'aya') return ayaPortrait || '';
  const im = document.querySelector('.hd-p-concentre'); return im ? im.src : '';
}
// Visage du coach pour les petites pastilles (bulles, carte du jour) : un portrait recadré
function coachFace(id) {
  if (id === 'aya') return ayaPortrait || '';
  const im = document.getElementById('renFace'); return im && im.src ? im.src : coachPortrait(id);
}
async function makeAyaPortrait() {
  if (ayaPortrait) return ayaPortrait;
  const cfg = structuredClone(AV_CAT.defaultConfig);
  cfg.base = 'female'; cfg.hair = { item: 'hair_long_01', color: 'hair_darkbrown' }; cfg.beard = { item: 'beard_none', color: 'inherit' };
  cfg.top = { item: 'top_hoodie_01', colorway: 'violet' }; cfg.skin = { tone: 'skin_04' }; cfg.accessories = [];
  const all = AV_CAT.items.map(i => i.id);
  const r = await AV.renderAvatar(AV.normalizeConfig(cfg, AV_CAT, all).config, AV_CAT, AV_ASSETS, { expression: 'determined', scale: 0.35 });
  ayaPortrait = r.canvas.toDataURL('image/png');
  return ayaPortrait;
}
function coachLineToday() {
  const ev = jget('coach:event', null);
  if (ev && ev.date === todayStr()) return ev.text;
  const ti = todayIdx(), st = curWeekState(), pd = planOfSnap(st.prog)[ti];
  if (pd.t === 'm') {
    const s = sesInfo(pd.id, st), done = st.training[pd.id].filter(Boolean).length;
    if (TR.isValidated(st, s)) return coachSay('done');
    if (done) { const r = s.ex.length - done; return coachSay('prog', { reste: r + (r > 1 ? ' exercices' : ' exercice') }); }
    return coachSay('todo', { seance: s.name });
  }
  if (pd.t === 's') {
    if (pd.sp === 'natation') return coachSay('swim');
    const sp = TR.sportOf(TR.snapSports(st.prog).find((e) => e.id === pd.sp) || { id: pd.sp });
    return coachSay((st.sport[pd.sp] || [])[pd.i] ? 'sportDone' : 'sport', { sport: sp.n, sportmin: TR.sportLower(sp) });
  }
  return coachSay('rest');
}
// La phrase du jour, dans la bulle de l'accueil. Le visage du coach n'y figure que si ce n'est pas
// lui, en grand, sur l'accueil (Aya, ou l'avatar choisi à la place de Ren).
let lastSay = '';
// la phrase en deux tons : le début en encre, la fin (la séance, le chiffre, l'envie) en violet
function sayTwoTone(line) {
  const w = line.split(' ');
  if (w.length < 3) return '<em>' + esc(line) + '</em>';
  let k = line.indexOf(' : ') > 0 ? line.slice(0, line.indexOf(' : ') + 3).split(' ').length - 1 : Math.ceil(w.length * 0.5);
  k = Math.max(1, Math.min(w.length - 1, k));
  return esc(w.slice(0, k).join(' ')) + ' <em>' + esc(w.slice(k).join(' ')) + '</em>';
}
function coachIntoHome() {
  const w = document.getElementById('hdSayW'), t = document.getElementById('hdSayT'); if (!w || !t) return;
  // (espace insécable avant ? ! : ; comme on l'écrit en français : la ponctuation ne part pas seule à la ligne)
  const id = COACH && COACHES[COACH.id] ? COACH.id : 'ren', line = coachLineToday().replace(/ ([?!:;])/g, '\u00a0$1');
  const face = id !== 'ren' || document.getElementById('hd').classList.contains('av-on') ? coachFace(id) : '';
  w.textContent = COACHES[id].name;
  const hn = document.getElementById('hdWhoN'); if (hn) hn.textContent = COACHES[id].name;
  const hf = document.getElementById('hdFace'); if (hf) { const f = id !== 'ren' ? coachFace(id) : hf.dataset.ren || (hf.dataset.ren = hf.getAttribute('src')); if (f && hf.getAttribute('src') !== f) hf.src = f; }
  void face;
  if (line === lastSay) return;
  t.innerHTML = sayTwoTone(line);
  if (lastSay) { const b = document.getElementById('hdSay'); b.classList.remove('in'); void b.offsetWidth; b.classList.add('in'); }
  lastSay = line;
}

// ---- Avatar dans l'accueil ----
async function renderHeroAvatar() {
  const hd = document.getElementById('hd'); if (!hd) return;
  const on = sget('ui:hero') === 'avatar' && !!AVCFG;
  hd.classList.toggle('av-on', on);
  if (!on) { heroAvHash = ''; return; }
  let cv = document.getElementById('hdAv');
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'hdAv'; cv.className = 'hd-av'; cv.setAttribute('aria-hidden', 'true'); document.querySelector('.hd-fig').appendChild(cv); }
  const expr = EXPR_OF[etatFor().k] || 'neutral', cfg = avConfigNow();
  const h = AV.hashOf([cfg, expr]); if (h === heroAvHash) return; heroAvHash = h;
  await AV.renderAvatar(cfg, AV_CAT, AV_ASSETS, { expression: expr, scale: 0.38, canvas: cv });
}
let lastLvlP1 = null;
function avCheckUnlocks(xp, silent) {
  const L = lvlOf(xp);
  if (lastLvlP1 != null && L > lastLvlP1 && !silent) coachEvent('levelup', { niveau: L });
  lastLvlP1 = L;
  if (!AVCFG) return;
  const fresh = AV.evaluateUnlocks(AV_CAT, { level: L, rank: RANKS[rankIdx(xp)][0], counters: realCounters() }, AVINV);
  if (!fresh.length) return;
  AVINV.push(...fresh); jset('avatar:inv', AVINV);
  if (silent) return;
  const label = fresh.length > 1 ? fresh.length + ' objets' : AV.itemById(AV_CAT, fresh[0]).name;
  if (fresh.length > 1) coachEvent('unlockMany', { n: fresh.length }); else coachEvent('unlock', { objet: label });
  const t = document.getElementById('xpToast'); if (t) { setTimeout(() => { t.textContent = 'Débloqué : ' + label; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2200); }, 1500); }
}

// ---- Onboarding ----
function onbDefaults() {
  const p = Object.assign({ firstName: '', birthYear: '', sex: 'male', height: '', weight: '', job: 'assis', sportDays: 4, goal: 'recompo', experience: 'intermediaire', sessions: 4, zones: [], parentOk: false }, PROFILE || {});
  return { i: 0, p, av: AVCFG ? structuredClone(AVCFG) : structuredClone(AV_CAT.defaultConfig), buildChosen: !!AVCFG,
    coach: COACH ? Object.assign({}, COACH) : { id: 'ren', tone: 'bienveillant' }, heroAvatar: true };
}
function onbOpen(startAt) {
  ONB = jget('onb:draft', null) || onbDefaults();
  if (startAt != null) ONB.i = startAt;
  document.getElementById('onb').hidden = false;
  makeAyaPortrait().then(() => { if (ONB && ONB_STEPS[ONB.i] === 'coach') onbRender(); });
  onbRender();
}
function onbClose() { document.getElementById('onb').hidden = true; ONB = null; }
const obSeg = (f, opts, cur, dis) => '<div class="ob-seg" role="group">' + opts.map(([v, l]) => '<button type="button" data-pick="' + f + '" data-val="' + v + '" aria-pressed="' + (String(cur) === String(v)) + '"' + (dis && dis.includes(v) ? ' disabled' : '') + '>' + l + '</button>').join('') + '</div>';
const obIn = (f, label, v, ph, mode) => '<label class="ob-l" for="ob_' + f + '">' + label + '</label><input class="ob-in" id="ob_' + f + '" data-f="' + f + '" inputmode="' + (mode || 'numeric') + '" value="' + esc(v ?? '') + '" placeholder="' + ph + '" autocomplete="off">';
function obItems(slot) {
  const c = ONB.av;
  return '<div class="ob-items">' + AV_CAT.items.filter(i => i.slot === slot && AV.fitsBody(i, c)).map(it => {
    const own = AV.isOwned(it, AVINV), on = c[slot] && c[slot].item === it.id;
    return '<button type="button" data-av="' + it.id + '" aria-pressed="' + on + '"' + (own ? '' : ' disabled') + '>' + esc(it.name) + (own ? '' : ' · ' + esc(AV.unlockLabel(it.unlock))) + '</button>';
  }).join('') + '</div>';
}
const obSw = (pal, f, cur) => '<div class="ob-sw">' + Object.entries(AV_CAT.palettes[pal]).map(([id, hex]) => '<button type="button" data-sw="' + f + '" data-val="' + id + '" style="background:' + hex + '" aria-pressed="' + (cur === id) + '" aria-label="' + id + '"></button>').join('') + '</div>';

function onbRender() {
  const s = ONB_STEPS[ONB.i], p = ONB.p, B = document.getElementById('onbBody');
  document.getElementById('onbBar').style.width = ((ONB.i + 1) / ONB_STEPS.length * 100) + '%';
  document.getElementById('onbN').textContent = (ONB.i + 1) + '/' + ONB_STEPS.length;
  document.getElementById('onbBack').disabled = ONB.i === 0;
  document.getElementById('onbSkip').hidden = !(s === 'perso' || s === 'programme');
  document.getElementById('onbGo').textContent = s === 'accueil' ? 'C’est parti' : 'Continuer';
  const age = p.birthYear ? new Date().getFullYear() - p.birthYear : null;
  let h = '';
  if (s === 'profil') {
    h = '<p class="ob-k">Étape 1 · Profil</p><h2 class="ob-t">Faisons connaissance</h2><p class="ob-p">Ces informations calculent tes objectifs. Elles restent sur ton téléphone' + (MS.cloud.enabled ? ', et dans ton compte si tu en crées un' : '') + '.</p>'
      + obIn('firstName', 'Prénom (facultatif)', p.firstName, 'Ton prénom', 'text')
      + '<div class="ob-row2"><div>' + obIn('birthYear', 'Année de naissance', p.birthYear, '1998') + '</div><div><span class="ob-l">Sexe pour les calculs</span>' + obSeg('sex', [['male', 'Homme'], ['female', 'Femme']], p.sex) + '</div></div>'
      + '<div class="ob-row2"><div>' + obIn('height', 'Taille (cm)', p.height, '180') + '</div><div>' + obIn('weight', 'Poids (kg)', p.weight, '75', 'decimal') + '</div></div>'
      + '<span class="ob-l">Activité professionnelle</span>' + obSeg('job', [['assis', 'Assis'], ['debout', 'Debout'], ['physique', 'Physique']], p.job)
      + '<span class="ob-l">Jours de sport par semaine</span>' + obSeg('sportDays', [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7']], p.sportDays)
      + (age != null && age < 15 ? '<label class="ob-check"><input type="checkbox" data-f="parentOk"' + (p.parentOk ? ' checked' : '') + '> Un parent a donné son accord</label>' : '')
      + '<p class="ob-err" id="obErr"></p>';
  } else if (s === 'objectifs') {
    const minor = age != null && age < 18;
    if (minor && p.goal === 'perte') p.goal = 'forme';
    const t = computeTargets(p);
    h = '<p class="ob-k">Étape 2 · Objectifs</p><h2 class="ob-t">Ton objectif</h2>'
      + '<div class="ob-cards">' + [['perte', 'Perte de gras', 'Déficit modéré'], ['recompo', 'Recomposition', 'Perdre du gras, garder le muscle'], ['prise', 'Prise de muscle', 'Léger surplus'], ['forme', 'Forme', 'Maintien']].map(([v, l, d]) =>
        '<button type="button" class="ob-card" data-pick="goal" data-val="' + v + '" aria-pressed="' + (p.goal === v) + '"' + (minor && v === 'perte' ? ' disabled' : '') + '><b>' + l + '</b><span>' + (minor && v === 'perte' ? 'Non proposé avant 18 ans' : d) + '</span></button>').join('') + '</div>'
      + '<span class="ob-l">Expérience</span>' + obSeg('experience', [['debutant', 'Débutant'], ['intermediaire', 'Intermédiaire'], ['avance', 'Avancé']], p.experience)
      + '<span class="ob-l">Séances de musculation possibles par semaine</span>' + obSeg('sessions', [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']], p.sessions)
      + '<span class="ob-l">Zones prioritaires (facultatif)</span><div class="ob-seg">' + [['bras', 'Bras'], ['epaules', 'Épaules'], ['dos', 'Dos'], ['pecs', 'Pectoraux'], ['jambes', 'Jambes'], ['abdos', 'Abdos']].map(([v, l]) =>
        '<button type="button" class="ob-chip" data-zone="' + v + '" aria-pressed="' + p.zones.includes(v) + '">' + l + '</button>').join('') + '</div>'
      + '<div class="ob-sum"><b>' + t.base.toLocaleString('fr-FR') + ' kcal</b><p>les jours de repos, ' + t.train.toLocaleString('fr-FR') + ' les jours de muscu</p><b>' + t.protein + ' g</b><p>de protéines par jour</p></div>';
  } else if (s === 'morpho') {
    if (!ONB.buildChosen && p.height && p.weight) { const bmi = p.weight / Math.pow(p.height / 100, 2); ONB.av.body.build = bmi < 21 ? 'slim' : bmi <= 27 ? 'athletic' : 'strong'; }
    if (!ONB.baseChosen) ONB.av.base = p.sex;
    h = '<p class="ob-k">Étape 3 · Morphologie</p><h2 class="ob-t">Ton personnage</h2><p class="ob-p">Choisis l’apparence et le gabarit de départ. Ton personnage évoluera avec tes séances.</p>'
      + '<span class="ob-l">Apparence</span>' + obSeg('avbase', [['male', 'Homme'], ['female', 'Femme']], ONB.av.base)
      + '<span class="ob-l">Gabarit</span><div class="ob-builds">' + [['slim', 'Fin'], ['athletic', 'Athlétique'], ['strong', 'Costaud']].map(([v, l]) =>
        '<button type="button" class="ob-build" data-build="' + v + '" aria-pressed="' + (ONB.av.body.build === v) + '"><canvas data-thumb="' + v + '"></canvas>' + l + '</button>').join('') + '</div>';
  } else if (s === 'perso') {
    const c = ONB.av;
    h = '<p class="ob-k">Étape 4 · Personnalisation</p><h2 class="ob-t">Ton style</h2><div class="ob-prev"><canvas id="obPrev"></canvas></div>'
      + '<span class="ob-l">Peau</span>' + obSw('skin', 'skin', c.skin.tone)
      + '<span class="ob-l">Coiffure</span>' + obItems('hair') + '<span class="ob-l">Couleur des cheveux</span>' + obSw('hair', 'hair', c.hair.color)
      + (c.base === 'male' ? '<span class="ob-l">Barbe</span>' + obItems('beard') : '')
      + '<span class="ob-l">Haut</span>' + obItems('top') + '<span class="ob-l">Bas</span>' + obItems('bottom') + '<span class="ob-l">Chaussures</span>' + obItems('shoes')
      + '<span class="ob-l">Yeux</span>' + obSw('eyes', 'eyes', c.face.eyeColor)
      + '<p class="ob-p" style="margin-top:12px">Les objets verrouillés se gagnent avec les niveaux, les rangs et les séances.</p><button type="button" class="ob-chip" id="obRand">Aléatoire</button>';
  } else if (s === 'coach') {
    const c = ONB.coach;
    h = '<p class="ob-k">Étape 5 · Coach</p><h2 class="ob-t">Ton coach</h2><p class="ob-p">Il t’accompagne avant et après tes séances, et annonce tes récompenses.</p>'
      + '<div class="ob-coach">' + Object.entries(COACHES).map(([id, k]) => '<button type="button" data-coach="' + id + '" aria-pressed="' + (c.id === id) + '">' + (coachPortrait(id) ? '<img src="' + coachPortrait(id) + '" alt="">' : '<div style="height:190px"></div>') + '<b>' + k.name + '</b><span>' + k.desc + '</span></button>').join('') + '</div>'
      + '<span class="ob-l">Ton style de coaching</span>' + obSeg('tone', [['bienveillant', 'Bienveillant'], ['exigeant', 'Exigeant']], c.tone)
      + '<p class="ob-quote">« ' + esc(coachSay('todo', { seance: 'Haut A' }, c.tone)) + ' »</p>';
  } else if (s === 'programme') {
    const n = p.sessions, rec = n <= 3 ? 'Full body, ' + n + ' séances' : n === 4 ? 'Haut / bas, 4 séances' : 'Push / pull / legs, ' + n + ' séances';
    h = '<p class="ob-k">Étape 6 · Programme</p><h2 class="ob-t">Ton programme</h2>'
      + '<div class="ob-cards"><button type="button" class="ob-card" aria-pressed="true"><b>Programme actuel</b><span>Haut A, Bas A, Haut B, Bas B, plus Bras Express en option</span></button>'
      + '<button type="button" class="ob-card" disabled><b>Créer le mien</b><span>Constructeur disponible à la prochaine mise à jour</span></button></div>'
      + '<div class="ob-sum"><p>Découpage conseillé pour tes ' + n + ' séances</p><b>' + rec + '</b></div>';
  } else {
    const xp = totalXP(), L = lvlOf(xp), rk = RANKS[rankIdx(xp)][0], t = computeTargets(p);
    h = '<p class="ob-k">Étape 7 · C’est prêt</p><h2 class="ob-t">Bienvenue' + (p.firstName ? ', ' + esc(p.firstName) : '') + '</h2><div class="ob-prev"><canvas id="obPrev"></canvas></div>'
      + '<div class="ob-sum"><b>Niveau ' + L + ' · Rang ' + rk + '</b><p>' + t.base.toLocaleString('fr-FR') + ' kcal au repos, ' + t.protein + ' g de protéines</p><b>Première quête</b><p>Valide ta prochaine séance</p></div>'
      + '<p class="ob-quote">« ' + esc(coachSay('hello', {}, ONB.coach.tone)) + ' » — ' + COACHES[ONB.coach.id].name + '</p>'
      + '<label class="ob-check"><input type="checkbox" data-f="heroAvatar"' + (ONB.heroAvatar ? ' checked' : '') + '> Afficher mon avatar dans l’accueil</label>';
  }
  B.innerHTML = h; B.scrollTop = 0;
  if (s === 'morpho') onbThumbs();
  if (s === 'perso' || s === 'accueil') onbPreview();
}
async function onbThumbs() {
  for (const v of ['slim', 'athletic', 'strong']) {
    const cv = document.querySelector('[data-thumb="' + v + '"]'); if (!cv) continue;
    const c = structuredClone(ONB.av); c.body.build = v;
    await AV.renderAvatar(AV.normalizeConfig(c, AV_CAT, AVINV).config, AV_CAT, AV_ASSETS, { expression: 'neutral', scale: 0.16, canvas: cv });
  }
}
async function onbPreview() {
  const cv = document.getElementById('obPrev'); if (!cv) return;
  ONB.av = AV.normalizeConfig(ONB.av, AV_CAT, AVINV).config;
  await AV.renderAvatar(avConfigNow(ONB.av), AV_CAT, AV_ASSETS, { expression: ONB_STEPS[ONB.i] === 'accueil' ? 'joy' : 'neutral', scale: 0.3, canvas: cv });
}
function onbNext() {
  const s = ONB_STEPS[ONB.i], p = ONB.p;
  if (s === 'profil') {
    ['birthYear', 'height', 'weight'].forEach(f => { p[f] = parseFloat(String(p[f]).replace(',', '.')) || ''; });
    const errs = profileValid(p);
    if (errs.length) { const e = document.getElementById('obErr'); if (e) e.textContent = 'À vérifier : ' + errs.join(', ') + '.'; return; }
  }
  if (s === 'accueil') return onbFinish();
  ONB.i++; jset('onb:draft', ONB); onbRender();
}
function onbFinish() {
  const p = ONB.p, t = computeTargets(p);
  PROFILE = Object.assign({}, p, { protein: t.protein, calBase: t.base, updatedAt: new Date().toISOString() });
  jset('profile', PROFILE);
  calbase = t.base; sset('calbase', String(calbase));
  AVCFG = AV.normalizeConfig(ONB.av, AV_CAT, AVINV).config; jset('avatar:config', AVCFG);
  COACH = Object.assign({}, ONB.coach); jset('coach', COACH);
  jset('coach:event', { date: todayStr(), text: coachSay('hello') });
  sset('ui:hero', ONB.heroAvatar ? 'avatar' : 'illus');
  sset('onb:done', '1'); sdel('onb:draft');
  onbClose(); applyProfile(); heroAvHash = '';
  try { renderMeals(); } catch (e) {}
  refreshV3(false); renderProfileP1();
}
// Portrait du profil : l'avatar s'il existe, sinon l'initiale du prénom
let pfFaceHash = '';
async function renderPfFace() {
  const box = document.getElementById('pfFace'); if (!box) return;
  const nm = document.getElementById('pfName'); if (nm) nm.textContent = PROFILE && PROFILE.firstName ? PROFILE.firstName : 'Ton profil';
  if (!AVCFG) { pfFaceHash = ''; box.innerHTML = '<b>' + esc(((PROFILE && PROFILE.firstName) || '?').trim().charAt(0).toUpperCase() || '?') + '</b>'; return; }
  const cfg = avConfigNow(), h = AV.hashOf([cfg, 'pf']); if (h === pfFaceHash) return; pfFaceHash = h;
  let cv = box.querySelector('canvas'); if (!cv) { box.innerHTML = ''; cv = document.createElement('canvas'); box.appendChild(cv); }
  try { await AV.renderAvatar(cfg, AV_CAT, AV_ASSETS, { expression: 'neutral', scale: 0.5, canvas: cv }); } catch (e) { pfFaceHash = ''; }
}
function renderProfileP1() {
  renderPfFace();
  const b = document.getElementById('pfAvB'); if (b) b.textContent = AVCFG ? 'Modifier' : 'Créer';
  const s = document.getElementById('pfCoachS'); if (s) s.textContent = COACH ? COACHES[COACH.id].name + ', ' + COACH.tone : 'Aucun';
  const hero = sget('ui:hero') || 'illus';
  document.querySelectorAll('#pfHero button').forEach(x => { x.setAttribute('aria-pressed', String(x.getAttribute('data-hero') === hero)); x.disabled = x.getAttribute('data-hero') === 'avatar' && !AVCFG; });
}

document.getElementById('onbBody').addEventListener('input', e => {
  const f = e.target.getAttribute('data-f'); if (!f || !ONB) return;
  if (e.target.type === 'checkbox') ONB[f === 'heroAvatar' ? 'heroAvatar' : 'p'] = f === 'heroAvatar' ? e.target.checked : Object.assign(ONB.p, { parentOk: e.target.checked });
  else ONB.p[f] = e.target.value;
  if (f === 'birthYear' && String(e.target.value).length === 4) { const y = e.target.value; onbRender(); const el = document.getElementById('ob_birthYear'); if (el) { el.focus(); el.value = y; } }
});
document.getElementById('onbBody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !ONB || b.disabled) return;
  const p = ONB.p, c = ONB.av;
  if (b.dataset.pick) {
    const f = b.dataset.pick, v = b.dataset.val;
    if (f === 'avbase') { c.base = v; ONB.baseChosen = true; }
    else if (f === 'tone') ONB.coach.tone = v;
    else p[f] = ['sportDays', 'sessions'].includes(f) ? Number(v) : v;
    onbRender(); return;
  }
  if (b.dataset.zone) { const z = b.dataset.zone; p.zones = p.zones.includes(z) ? p.zones.filter(x => x !== z) : p.zones.concat(z); onbRender(); return; }
  if (b.dataset.build) { c.body.build = b.dataset.build; ONB.buildChosen = true; onbRender(); return; }
  if (b.dataset.av) { const it = AV.itemById(AV_CAT, b.dataset.av); c[it.slot] = Object.assign({}, c[it.slot], { item: it.id, colorway: (it.colorways || [])[0] || null }); onbRender(); return; }
  if (b.dataset.sw) { const f = b.dataset.sw, v = b.dataset.val; if (f === 'skin') c.skin.tone = v; else if (f === 'hair') c.hair.color = v; else if (f === 'eyes') c.face.eyeColor = v; onbRender(); return; }
  if (b.dataset.coach) { ONB.coach.id = b.dataset.coach; onbRender(); return; }
  if (b.id === 'obRand') {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    c.skin.tone = pick(Object.keys(AV_CAT.palettes.skin)); c.hair.color = pick(Object.keys(AV_CAT.palettes.hair)); c.face.eyeColor = pick(Object.keys(AV_CAT.palettes.eyes));
    ['hair', 'beard', 'top', 'bottom', 'shoes'].forEach(sl => { const opts = AV_CAT.items.filter(i => i.slot === sl && AV.isOwned(i, AVINV) && AV.fitsBody(i, c)); if (opts.length) { const it = pick(opts); c[sl] = Object.assign({}, c[sl], { item: it.id, colorway: it.colorways ? pick(it.colorways) : null }); } });
    onbRender();
  }
});
document.getElementById('onbGo').onclick = () => onbNext();
document.getElementById('onbSkip').onclick = () => { ONB.i++; jset('onb:draft', ONB); onbRender(); };
document.getElementById('onbBack').onclick = () => { if (ONB.i > 0) { ONB.i--; onbRender(); } };
document.getElementById('pfAvB').onclick = () => onbOpen(AVCFG ? 3 : 0);
document.getElementById('pfCoachB').onclick = () => onbOpen(4);
document.getElementById('pfHero').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; sset('ui:hero', b.getAttribute('data-hero')); renderProfileP1(); heroAvHash = ''; renderHeroAvatar(); renderHeroTexts(); coachIntoHome(); });

// Branchements : après le rafraîchissement existant, sans le modifier
const _rgP1 = renderGoal; renderGoal = function () { _rgP1(); try { coachIntoHome(); } catch (e) { console.error(e); } };
const _rfP1 = refreshV3; refreshV3 = function (init) { _rfP1(init); try { const xp = totalXP(); avCheckUnlocks(xp, init); renderHeroAvatar(); renderHeroTexts(); coachIntoHome(); } catch (e) { console.error(e); } };

applyProfile(); renderProfileP1();
(function initP1() {
  const xp = totalXP(); avCheckUnlocks(xp, true); renderHeroAvatar(); renderHeroTexts(); makeAyaPortrait().then(() => coachIntoHome()); coachIntoHome();
  const hasData = storedWeekKeys().size > 0 || Object.keys(foodlog).length > 0;
  if (!sget('onb:done') && !hasData) onbOpen(null);
  try { renderToday(); renderSummaries(totalXP()); } catch (e) {}   // repères de macros avec l'objectif de protéines du profil
})();
