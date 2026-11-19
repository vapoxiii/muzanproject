// ---- Social : profil (@pseudo), stories de 24 h, messages privés, amis ----
// Le serveur décide de tout ce qui est permis (supabase/migrations/*_social.sql) ; ici, l'interface.
// Accès au serveur : MS.social (src/social/api.js). Cartes partagées (séance, record, rang, série,
// recette, programme, exercice, texte) : construites, nettoyées, affichées et importées par SOC
// (src/social/cards.js). Rien ne part sans geste de l'utilisateur ; jamais de poids, de mesures ni de
// calories du jour.
const SO = { prof: undefined, people: [], inbox: [], stories: [], badges: { unread: 0, requests: 0, stories: 0 }, err: null, loading: false, user: null, timer: null, chat: null, viewer: null, off: false };
const SO_MIN_AGE = 15;
const SO_REACT = ['🔥', '💪', '👏', '😮'];
const SO_RULES = [
  'Respect : pas d’insultes, de harcèlement ni de moqueries sur le physique.',
  'Rien de sexuel, de violent, de haineux ni d’illégal.',
  'Pas de conseils dangereux : dopage, régimes extrêmes, blessures cachées.',
  'Pas de spam ni de publicité.',
  'Tu as 15 ans ou plus.',
];
const SO_REASONS = [['harcelement', 'Harcèlement ou intimidation'], ['haine', 'Propos haineux'], ['sexuel', 'Contenu sexuel'], ['spam', 'Spam ou arnaque'], ['danger', 'Conseil dangereux pour la santé'], ['mineur', 'Met en danger un mineur'], ['autre', 'Autre chose']];
const SO_IC = {
  plus: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.5v11M1.5 7h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M12.5 5.5 19 12l-6.5 6.5"/></svg>',
  more: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/></svg>',
  lock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  chat: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16h-6l-4.5 3.5V16A2.5 2.5 0 0 1 4.5 13.5z"/></svg>',};
// pictogramme de chaque sorte de carte (choix d'une carte à partager)
const SO_KIND_IC = (() => {
  const P = {
    seance: '<path d="M7 7.5v9M17 7.5v9M4.5 10v4M19.5 10v4M7 12h10"/>',
    record: '<path d="M8 4.5h8v4.5a4 4 0 0 1-8 0zM8 6.5H5.5v1A3 3 0 0 0 8 10.4M16 6.5h2.5v1a3 3 0 0 1-2.5 2.9M12 13v3.5M8.5 19.5h7M10 16.5h4v3h-4z"/>',
    rang: '<path d="M12 3.5 19 7v5.5c0 4-3 6.6-7 8-4-1.4-7-4-7-8V7z"/><path d="M9.2 12.2l1.9 1.9 3.8-4"/>',
    serie: '<path d="M12 21c3.6 0 6-2.4 6-5.8 0-3.3-2.3-5.2-3.4-7.7-.6 1.6-1.4 2.6-2.6 3-.2-2.7-1.2-5.2-3.2-7 .1 3-1.4 4.8-2.6 6.6A7.3 7.3 0 0 0 6 15.2C6 18.6 8.4 21 12 21z"/>',
    recette: '<path d="M4 11.5h16a8 8 0 0 1-16 0zM9 8c0-1.5 1-1.6 1-3M13 8c0-1.5 1-1.6 1-3"/>',
    programme: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4M8 13.5h3M8 16.5h6"/>',
    exercice: '<circle cx="12" cy="5.5" r="1.8"/><path d="M5 9.5h14M12 9.5v5l-2.5 5.5M12 14.5l2.5 5.5M7.5 8v3M16.5 8v3"/>',
    texte: '<path d="M5 18 9.5 6h1L15 18M6.6 14h6.8M16.5 12.5c.5-1 1.4-1.5 2.4-1.5 1.4 0 2.1.9 2.1 2.3V18M21 15.2c-2.6 0-4.4.6-4.4 1.6 0 .8.7 1.3 1.6 1.3 1.6 0 2.8-1.1 2.8-2.9"/>',
  };
  const out = {};
  for (const k in P) out[k] = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[k] + '</svg>';
  return out;
})();

// ---------- petits outils ----------
const soName = (p) => (p && (p.name || '').trim()) || (p && p.handle ? '@' + p.handle : 'Quelqu’un');
const soAv = (p, size = '') => '<span class="so-av so-c' + ((p && p.color) | 0) % 8 + (size ? ' so-av-' + size : '') + '" aria-hidden="true">' + esc(SOC.initial(p && p.name, p && p.handle)) + '</span>';
const soPlural = (n, one, many) => n + ' ' + (n > 1 ? many : one);
function soErrText(e) {
  const k = e && e.kind;
  if (k === 'network') return 'Pas de connexion. Réessaie quand le réseau revient.';
  if (k === 'setup') return 'Le social n’est pas encore activé sur le serveur.';
  if (k === 'limit') return 'Doucement : trop d’actions d’un coup. Réessaie dans quelques minutes.';
  if (k === 'denied') return 'Ce n’est pas possible avec ce compte.';
  if (k === 'offline') return 'Connecte-toi à ton compte pour utiliser le social.';
  return 'Ça n’a pas marché. Réessaie.';
}
function soSeen() { try { return JSON.parse(localStorage.getItem('social:seen') || '{}') || {}; } catch (e) { return {}; } }
function soMarkSeen(id) {
  const s = soSeen(), now = Date.now();
  s[id] = now;
  for (const k in s) if (now - s[k] > 3 * 86400e3) delete s[k];
  try { localStorage.setItem('social:seen', JSON.stringify(s)); } catch (e) {}
}
// Âge d'après l'année de naissance du profil (null si on ne la connaît pas)
function soAge() { const y = +(PROFILE && PROFILE.birthYear); return y > 1900 ? new Date().getFullYear() - y : null; }
// Carte publique : rang, niveau, série, séances validées (jamais de poids ni de calories)
function soMyStats() {
  const xp = totalXP(), rk = RANKS[rankIdx(xp)][0];
  let n = 0;
  storedWeekKeys().forEach((k) => { const st = k === keyFor(weekOffset).k ? state : readWeek(k); if (st) n += TR.sessionsDone(st); });
  return { rk, lvl: lvlOf(xp), w: computeStreak(), n };
}
const soStatsText = (s) => !s ? '' : [s.rk ? 'Rang ' + s.rk : '', s.lvl ? 'niveau ' + s.lvl : '', s.w ? soPlural(s.w, 'semaine', 'semaines') + ' de suite' : '', s.n ? soPlural(s.n, 'séance', 'séances') : ''].filter(Boolean).join(' · ');
const soThumb = (x) => TRUI.thumb(x, 'sc-th');
const soCard = (kind, data, size) => SOC.cardHtml(kind, data, { esc, thumb: soThumb, size });
function soBtnBusy(b, on) { if (!b) return; b.disabled = on; b.classList.toggle('so-busy', on); }

// ---------- l'écran Social ----------
function soEl(id) { return document.getElementById(id); }
function soGate(kind) {
  const g = soEl('soGate'), main = soEl('soMain'), me = soEl('soMe');
  main.hidden = true; me.hidden = true;
  let h = '';
  if (kind === 'off') h = '<div class="so-gate"><p class="so-gate-t">Le social arrive bientôt</p><p>Stories de tes séances, messages, recettes et programmes partagés avec tes amis. Il a besoin des comptes Grind, qui ne sont pas encore activés sur cette version.</p></div>';
  else if (kind === 'signin') h = '<div class="so-gate"><p class="so-gate-t">Retrouve tes amis sur Grind</p><ul class="so-gate-l"><li>Des stories de 24 h : ta séance, un record, ton rang, une recette.</li><li>Des messages privés avec ceux qui te suivent en retour.</li><li>Des recettes, des séances et des programmes à ajouter chez toi en un geste.</li></ul><p class="so-gate-s">Il faut un compte : il sauvegarde aussi tes données.</p><button type="button" class="tr-btn wide" data-so="signin">Créer mon compte ou me connecter</button></div>';
  else if (kind === 'create') h = '<div class="so-gate"><p class="so-gate-t">Ton profil social</p><p>Un pseudo, un prénom, et c’est parti. Ton profil est privé : c’est toi qui acceptes qui te suit.</p><p class="so-gate-s">Tes abonnés voient ta progression (rang, série, séances validées) ; le reste, seulement quand tu le partages. Jamais ton poids, tes mesures ni tes calories.</p><button type="button" class="tr-btn wide" data-so="create">Créer mon profil</button></div>';
  else if (kind === 'loading') h = '<div class="so-gate so-loading" aria-busy="true"><p>Chargement…</p></div>';
  else h = '<div class="so-gate"><p class="so-gate-t">' + (kind === 'setup' ? 'Pas encore disponible' : 'Hors ligne') + '</p><p>' + esc(soErrText(SO.err)) + '</p><button type="button" class="tr-btn ghost wide" data-so="retry">Réessayer</button></div>';
  g.innerHTML = h;
}
// Le compte a changé (déconnexion, autre compte sur le même téléphone) : on repart de zéro
function soSameUser() {
  const uid = MS.social.userId();
  if (SO.user !== uid) { SO.user = uid; SO.prof = undefined; SO.people = []; SO.inbox = []; SO.stories = []; SO.badges = { unread: 0, requests: 0, stories: 0 }; }
}
async function socialRender(force) {
  if (!soEl('v-social')) return;
  if (!MS.social.available()) { soGate('off'); return; }
  if (!MS.social.signedIn()) { SO.prof = undefined; soGate('signin'); return; }
  soSameUser();
  if (SO.prof === undefined || force) {
    if (SO.prof === undefined) soGate('loading');
    try { SO.prof = await MS.social.myProfile(); SO.err = null; } catch (e) { SO.err = e; soGate(e.kind === 'setup' ? 'setup' : 'error'); return; }
  }
  if (!SO.prof) { soGate('create'); return; }
  soEl('soGate').innerHTML = ''; soEl('soMain').hidden = false;
  const me = soEl('soMe'); me.hidden = false; me.innerHTML = soAv(SO.prof, 'md');
  soEl('soSub').textContent = '@' + SO.prof.handle + (SO.prof.is_public ? ' · compte public' : ' · compte privé');
  soDrawStories(); soDrawInbox(); soDrawPeople();
  await soRefresh();
  soSyncStats();
}
async function soRefresh() {
  if (!SO.prof || SO.loading) return;
  SO.loading = true;
  try {
    const [stories, inbox, people, badges] = await Promise.all([MS.social.stories(), MS.social.inbox(), MS.social.people(), MS.social.badges()]);
    SO.stories = stories || []; SO.inbox = inbox || []; SO.people = people || []; SO.badges = badges || SO.badges;
    SO.err = null;
  } catch (e) { SO.err = e; if (curView === 'social') TRUI.toast(soErrText(e)); }
  SO.loading = false;
  soDrawStories(); soDrawInbox(); soDrawPeople(); soShowBadges();
}
// la carte publique suit l'app (rang, série…) sans qu'on y pense
async function soSyncStats() {
  if (!SO.prof) return;
  const st = soMyStats(), cur = SO.prof.stats || {};
  if (st.rk === cur.rk && st.lvl === cur.lvl && st.w === cur.w && st.n === cur.n) return;
  try { SO.prof = await MS.social.updateProfile({ stats: st }); } catch (e) { /* plus tard */ }
}

// ---------- stories ----------
function soStoryGroups() {
  const by = new Map();
  for (const s of SO.stories) {
    const data = SOC.cleanCard(s.kind, s.data); if (!data) continue;
    const g = by.get(s.user_id) || { user: { id: s.user_id, handle: s.handle, name: s.name, color: s.color }, mine: s.mine, items: [] };
    g.items.push({ ...s, data }); by.set(s.user_id, g);
  }
  const seen = soSeen(), list = [...by.values()];
  for (const g of list) { g.unseen = g.items.some((s) => !seen[s.id]); g.last = g.items[g.items.length - 1].created_at; }
  const mine = list.find((g) => g.mine) || null;
  const others = list.filter((g) => !g.mine).sort((a, b) => (b.unseen - a.unseen) || (a.last < b.last ? 1 : -1));
  return { mine, others };
}
function soDrawStories() {
  const box = soEl('soStories'); if (!box || !SO.prof) return;
  const { mine, others } = soStoryGroups();
  let h = '<button type="button" class="so-st me' + (mine ? ' has' + (mine.unseen ? ' new' : '') : '') + '" data-st="me"><span class="so-ring">' + soAv(SO.prof, 'lg') + '</span><em class="so-st-add" aria-hidden="true">' + SO_IC.plus + '</em><span class="so-st-n">' + (mine ? 'Ta story' : 'Ajouter') + '</span></button>';
  for (const g of others) h += '<button type="button" class="so-st' + (g.unseen ? ' new' : '') + '" data-st="' + esc(g.user.id) + '" aria-label="' + esc('Story de ' + soName(g.user) + (g.unseen ? ', pas encore vue' : '')) + '"><span class="so-ring">' + soAv(g.user, 'lg') + '</span><span class="so-st-n">' + esc(soName(g.user)) + '</span></button>';
  if (!others.length) h += '<p class="so-st-empty">Les stories de ceux que tu suis apparaîtront ici pendant 24 h.</p>';
  box.innerHTML = h;
}
function soOpenStories(uid) {
  const { mine, others } = soStoryGroups();
  const groups = (mine ? [mine] : []).concat(others);
  let gi = groups.findIndex((g) => (uid === 'me' ? g.mine : g.user.id === uid));
  if (gi < 0) return;
  const seen = soSeen();
  let si = Math.max(0, groups[gi].items.findIndex((s) => !seen[s.id]));
  let timer = null, paused = false, closed = false;
  const node = document.createElement('div'); node.className = 'so-viewer';
  const close = TRUI.openLayer(node, { sheet: false, label: 'Stories', onClose: () => { closed = true; clearTimeout(timer); SO.viewer = null; soDrawStories(); } });
  SO.viewer = { close };
  const person = (g) => SO.people.find((p) => p.id === g.user.id) || null;
  function show() {
    clearTimeout(timer);
    const g = groups[gi], s = g.items[si]; if (!s) { close(); return; }
    soMarkSeen(s.id);
    const p = person(g), canDm = !g.mine && p && p.i_follow === 'accepted' && p.follows_me === 'accepted';
    node.innerHTML = '<div class="so-v-top"><div class="so-v-bars">' + g.items.map((x, i) => '<i class="' + (i < si ? 'done' : i === si ? 'on' : '') + '"><b></b></i>').join('') + '</div>' +
      '<div class="so-v-who"><button type="button" class="so-v-p" data-act="who">' + soAv(g.user, 'sm') + '<span><b>' + esc(g.mine ? 'Ta story' : soName(g.user)) + '</b><small>' + esc(SOC.ago(s.created_at)) + '</small></span></button>' +
      '<button type="button" class="so-v-x" data-act="close" aria-label="Fermer">' + TRUI.ICON.close + '</button></div></div>' +
      '<div class="so-v-card"><button type="button" class="so-v-prev" data-act="prev" aria-label="Story précédente"></button>' + soCard(s.kind, s.data, 'big') + '<button type="button" class="so-v-next" data-act="next" aria-label="Story suivante"></button></div>' +
      '<div class="so-v-actions">' + (g.mine ? '' : soImportButtons(s.kind, s.data, g.user)) + '</div>' +
      (g.mine
        ? '<div class="so-v-foot mine"><button type="button" class="so-v-b" data-act="del">Retirer</button><button type="button" class="so-v-b main" data-act="add">' + SO_IC.plus + ' Nouvelle story</button></div>'
        : canDm
          ? '<div class="so-v-foot"><div class="so-v-react">' + SO_REACT.map((r) => '<button type="button" data-react="' + r + '" aria-label="Réagir ' + r + '">' + r + '</button>').join('') + '</div>' +
            '<form class="so-v-reply"><input type="text" maxlength="2000" placeholder="' + esc('Répondre à ' + soName(g.user)) + '" aria-label="Répondre" enterkeyhint="send" autocomplete="off"><button type="submit" aria-label="Envoyer">' + SO_IC.send + '</button></form></div>'
          : '<div class="so-v-foot"><p class="so-v-note">Pour répondre, suivez-vous l’un l’autre.</p></div>');
    const bar = node.querySelector('.so-v-bars i.on b');
    if (bar) { bar.style.transitionDuration = '0ms'; bar.style.width = '0%'; requestAnimationFrame(() => { if (!paused) { bar.style.transitionDuration = '6500ms'; bar.style.width = '100%'; } }); }
    if (!paused) timer = setTimeout(next, 6500);
  }
  function next() { const g = groups[gi]; if (si < g.items.length - 1) si++; else if (gi < groups.length - 1) { gi++; si = 0; } else { close(); return; } if (!closed) show(); }
  function prev() { if (si > 0) si--; else if (gi > 0) { gi--; si = groups[gi].items.length - 1; } if (!closed) show(); }
  function pause(on) { paused = on; clearTimeout(timer); const bar = node.querySelector('.so-v-bars i.on b'); if (bar && on) { const w = getComputedStyle(bar).width; bar.style.transitionDuration = '0ms'; bar.style.width = w; } if (!on) timer = setTimeout(next, 4000); }
  async function sendToAuthor(payload, okMsg) {
    const g = groups[gi], s = g.items[si];
    try { await MS.social.send(g.user.id, { ...payload, story: s.id, data: Object.assign({ reply: { k: s.kind, t: SOC.cardTitle(s.kind, s.data) } }, payload.data || {}) }); TRUI.toast(okMsg); soRefresh(); }
    catch (e) { TRUI.toast(soErrText(e)); }
  }
  node.addEventListener('focusin', (e) => { if (e.target.matches('.so-v-reply input')) pause(true); });
  node.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = node.querySelector('.so-v-reply input'), t = inp.value.trim(); if (!t) return;
    inp.value = ''; inp.blur(); sendToAuthor({ kind: 'texte', body: t }, 'Réponse envoyée'); pause(false);
  });
  node.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const act = b.dataset.act, g = groups[gi], s = g.items[si];
    if (act === 'close') close();
    else if (act === 'next') next();
    else if (act === 'prev') prev();
    else if (act === 'who') { if (!g.mine) { pause(true); soOpenPerson(g.user.handle); } }
    else if (b.dataset.react) { b.classList.add('pop'); sendToAuthor({ kind: 'reaction', body: b.dataset.react }, 'Réaction envoyée ' + b.dataset.react); }
    else if (act === 'add') { close(); soCompose({ mode: 'story' }); }
    else if (act === 'del') {
      pause(true);
      if (!(await TRUI.ask({ title: 'Retirer cette story ?', text: 'Elle disparaît pour tout le monde.', ok: 'Retirer', danger: true }))) { pause(false); return; }
      try { await MS.social.deleteStory(s.id); SO.stories = SO.stories.filter((x) => x.id !== s.id); g.items.splice(si, 1); TRUI.toast('Story retirée'); if (!g.items.length) { close(); return; } si = Math.min(si, g.items.length - 1); paused = false; show(); }
      catch (er) { TRUI.toast(soErrText(er)); pause(false); }
    } else if (b.dataset.imp) { pause(true); soImport(s.kind, s.data, g.user, b.dataset.imp); }
  });
  show();
}

// ---------- messages ----------
function soPreview(c) {
  if (c.last_deleted) return 'Message retiré';
  const who = c.last_mine ? 'Toi : ' : '';
  if (c.last_kind === 'carte') return who + 'a partagé une carte';
  if (c.last_kind === 'reaction') return who + 'a réagi ' + c.last_body;
  return who + c.last_body;
}
function soDrawInbox() {
  const box = soEl('soInbox'); if (!box || !SO.prof) return;
  const list = SO.inbox.filter((c) => c.handle);
  const friends = SO.people.filter((p) => p.i_follow === 'accepted' && p.follows_me === 'accepted' && !list.some((c) => c.other === p.id));
  let h = '';
  if (list.length) h += '<div class="grp so-list">' + list.map((c) => '<button type="button" class="so-row' + (c.unread ? ' unread' : '') + '" data-chat="' + esc(c.other) + '">' + soAv(c, 'md') +
    '<span class="so-row-t"><b>' + esc(soName(c)) + '</b><span>' + esc(soPreview(c)) + '</span></span><span class="so-row-m"><small>' + esc(SOC.ago(c.last_at)) + '</small>' + (c.unread ? '<em class="so-dot">' + c.unread + '</em>' : '') + '</span></button>').join('') + '</div>';
  if (friends.length) h += '<p class="so-lab">Écrire à un ami</p><div class="so-chips">' + friends.slice(0, 12).map((p) => '<button type="button" class="so-chip" data-chat="' + esc(p.id) + '">' + soAv(p, 'xs') + esc(soName(p)) + '</button>').join('') + '</div>';
  if (!list.length && !friends.length) h += '<div class="so-empty"><p class="so-empty-t">Pas encore de messages</p><p>Les messages se font entre personnes qui se suivent l’une l’autre. Cherche tes amis dans l’onglet Amis.</p><button type="button" class="tr-btn ghost" data-so="tab-amis">Trouver des amis</button></div>';
  box.innerHTML = h;
}
function soPerson(id) { return SO.people.find((p) => p.id === id) || SO.inbox.map((c) => ({ id: c.other, handle: c.handle, name: c.name, color: c.color, can_dm: c.can_dm })).find((p) => p.id === id) || null; }
function soOpenChat(person) {
  if (!person) return;
  if (SO.chat) SO.chat.close();
  let msgs = [], timer = null, closed = false, sending = false;
  const node = document.createElement('div'); node.className = 'pe so-chat';
  node.innerHTML = '<div class="pe-top so-c-top"><button type="button" class="pe-ico" data-act="close" aria-label="Retour">' + TRUI.ICON.back + '</button>' +
    '<button type="button" class="so-c-who" data-act="who">' + soAv(person, 'sm') + '<span><b>' + esc(soName(person)) + '</b><small>@' + esc(person.handle) + '</small></span></button>' +
    '<button type="button" class="pe-ico so-c-more" data-act="more" aria-label="Plus d’options">' + SO_IC.more + '</button></div>' +
    '<div class="so-c-body" aria-live="polite"><p class="so-c-load">Chargement…</p></div>' +
    '<form class="so-c-bar"><button type="button" class="so-c-plus" data-act="card" aria-label="Partager une carte : séance, recette, programme…">' + SO_IC.plus + '</button>' +
    '<textarea rows="1" maxlength="2000" placeholder="Message" aria-label="Message" enterkeyhint="send"></textarea>' +
    '<button type="submit" class="so-c-send" aria-label="Envoyer">' + SO_IC.send + '</button></form>';
  const body = node.querySelector('.so-c-body'), bar = node.querySelector('.so-c-bar'), ta = bar.querySelector('textarea');
  const close = TRUI.openLayer(node, { sheet: false, label: 'Conversation avec ' + soName(person), onClose: () => { closed = true; clearInterval(timer); SO.chat = null; soRefresh(); } });
  SO.chat = { close, id: person.id };
  const canDm = () => { const p = soPerson(person.id); return !!(p && (p.can_dm || (p.i_follow === 'accepted' && p.follows_me === 'accepted'))); };
  function dayLabel(iso) {
    const d = new Date(iso), t = new Date(); const k = (x) => x.toDateString();
    if (k(d) === k(t)) return 'Aujourd’hui';
    const y = new Date(t); y.setDate(t.getDate() - 1); if (k(d) === k(y)) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function bubble(m) {
    const time = new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    let inner;
    const reply = m.data && m.data.reply && typeof m.data.reply.t === 'string' ? '<p class="so-b-reply">' + esc((m.mine ? 'Réponse à sa story · ' : 'Réponse à ta story · ') + SOC.str(m.data.reply.t, 80)) + '</p>' : '';
    if (m.deleted) inner = '<p class="so-b-gone">Message retiré</p>';
    else if (m.kind === 'reaction') inner = reply + '<p class="so-b-react">' + esc(m.body) + '</p>';
    else if (m.kind === 'carte') {
      const k = m.data && m.data.k, d = k && SOC.cleanCard(k, m.data.d);
      inner = d ? soCard(k, d, 'mini') + (m.mine ? '' : '<div class="so-b-acts">' + soImportButtons(k, d, person) + '</div>') + (m.body ? '<p class="so-b-t">' + esc(m.body) + '</p>' : '') : '<p class="so-b-gone">Carte illisible</p>';
    } else inner = reply + '<p class="so-b-t">' + esc(m.body) + '</p>';
    return '<div class="so-b ' + (m.mine ? 'me' : 'them') + (m.kind === 'carte' && !m.deleted ? ' card' : '') + (m.kind === 'reaction' ? ' react' : '') + '" data-m="' + esc(m.id) + '">' + inner + '<span class="so-b-time">' + esc(time) + '</span></div>';
  }
  function draw(stick) {
    const atEnd = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
    if (!msgs.length) body.innerHTML = '<div class="so-c-empty">' + soAv(person, 'xl') + '<p><b>' + esc(soName(person)) + '</b></p><p>Dis bonjour, ou partage une séance, une recette, ton programme avec le +.</p></div>';
    else {
      let h = '', day = '';
      msgs.forEach((m, i) => {
        const dl = dayLabel(m.created_at); if (dl !== day) { day = dl; h += '<p class="so-c-day">' + esc(dl) + '</p>'; }
        h += bubble(m);
        const last = i === msgs.length - 1;
        if (last && m.mine && m.read_at) h += '<p class="so-c-seen">Vu</p>';
      });
      body.innerHTML = h;
    }
    if (stick || atEnd) body.scrollTop = body.scrollHeight;
    const ok = canDm();
    bar.classList.toggle('off', !ok);
    ta.disabled = !ok; bar.querySelector('.so-c-send').disabled = !ok; bar.querySelector('.so-c-plus').disabled = !ok;
    ta.placeholder = ok ? 'Message' : 'Suivez-vous l’un l’autre pour vous écrire';
  }
  async function load(first) {
    try {
      const got = await MS.social.thread(person.id);
      if (closed) return;
      const changed = JSON.stringify(got) !== JSON.stringify(msgs);
      msgs = got || [];
      if (changed || first) draw(first);
      if (msgs.some((m) => !m.mine && !m.read_at)) { await MS.social.markRead(person.id); soPollBadges(); }
    } catch (e) { if (first) body.innerHTML = '<p class="so-c-load">' + esc(soErrText(e)) + '</p>'; }
  }
  async function send(payload) {
    if (sending) return false;
    sending = true; soBtnBusy(bar.querySelector('.so-c-send'), true);
    try { await MS.social.send(person.id, payload); await load(true); return true; }
    catch (e) { TRUI.toast(soErrText(e)); return false; }
    finally { sending = false; soBtnBusy(bar.querySelector('.so-c-send'), false); }
  }
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); bar.requestSubmit(); } });
  bar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = ta.value.trim(); if (!t) return;
    const keep = ta.value; ta.value = ''; grow();
    if (!(await send({ kind: 'texte', body: t }))) { ta.value = keep; grow(); }
  });
  node.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    const bub = e.target.closest('.so-b');
    if (!b && bub && !bub.querySelector('.so-b-gone')) { soMessageMenu(msgs.find((m) => m.id === bub.dataset.m), person, () => load(true)); return; }
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'close') close();
    else if (act === 'who') soOpenPerson(person.handle);
    else if (act === 'more') soPersonMenu(person, { inChat: true });
    else if (act === 'card') { const c = await soCompose({ mode: 'send', to: person }); if (c) await send({ kind: 'carte', data: { k: c.kind, d: c.data } }); }
    else if (b.dataset.imp) { const m = msgs.find((x) => x.id === (bub && bub.dataset.m)); if (m && m.data) soImport(m.data.k, SOC.cleanCard(m.data.k, m.data.d), person, b.dataset.imp); }
  });
  draw(true); load(true);
  timer = setInterval(() => { if (document.visibilityState === 'visible') load(false); }, 4000);
}
async function soMessageMenu(m, person, after) {
  if (!m) return;
  const items = m.mine ? [['del', 'Retirer ce message', true]] : [['report', 'Signaler ce message', true]];
  if (m.kind === 'texte' && navigator.clipboard) items.unshift(['copy', 'Copier le texte']);
  const act = await soMenu(m.mine ? 'Ton message' : 'Message de ' + soName(person), items);
  if (act === 'copy') { try { await navigator.clipboard.writeText(m.body); TRUI.toast('Texte copié'); } catch (e) {} }
  else if (act === 'del') {
    if (!(await TRUI.ask({ title: 'Retirer ce message ?', text: 'Il disparaît aussi chez ' + soName(person) + '.', ok: 'Retirer', danger: true }))) return;
    try { await MS.social.deleteMessage(m.id); after(); } catch (e) { TRUI.toast(soErrText(e)); }
  } else if (act === 'report') soReport({ user: person.id, who: person, kind: 'message', target: m.id, snapshot: { kind: m.kind, body: m.body, data: m.data, at: m.created_at } });
}
// Petite feuille de choix ; renvoie la clé choisie (null si fermée)
function soMenu(title, items) {
  return new Promise((resolve) => {
    let done = false;
    const node = document.createElement('div'); node.className = 'sheet tr-sheet so-menu';
    node.innerHTML = '<div class="sheeth"><span class="st">' + esc(title) + '</span><button type="button" data-k="" aria-label="Fermer">' + TRUI.ICON.close + '</button></div>' +
      items.map(([k, l, danger]) => '<button type="button" class="so-menu-b' + (danger ? ' danger' : '') + '" data-k="' + esc(k) + '">' + esc(l) + '</button>').join('');
    const close = TRUI.openLayer(node, { label: title, onClose: () => { if (!done) resolve(null); } });
    node.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; done = true; resolve(b.dataset.k || null); close(); });
  });
}

// ---------- amis ----------
function soRel(p) {
  if (p.follows_me === 'pending') return 'request';
  if (p.i_follow === 'accepted' && p.follows_me === 'accepted') return 'friend';
  if (p.i_follow === 'accepted') return 'following';
  if (p.i_follow === 'pending') return 'asked';
  if (p.follows_me === 'accepted') return 'follower';
  return 'none';
}
function soFollowBtn(p) {
  const r = soRel(p);
  if (r === 'request') return '<span class="so-acts"><button type="button" class="so-b-sm main" data-acc="' + esc(p.id) + '">Accepter</button><button type="button" class="so-b-sm" data-dec="' + esc(p.id) + '" aria-label="' + esc('Refuser la demande de ' + soName(p)) + '">Refuser</button></span>';
  if (r === 'friend') return '<button type="button" class="so-b-sm" data-chat="' + esc(p.id) + '">' + SO_IC.chat + ' Message</button>';
  if (r === 'following') return '<button type="button" class="so-b-sm" data-unf="' + esc(p.id) + '">Abonné</button>';
  if (r === 'asked') return '<button type="button" class="so-b-sm" data-unf="' + esc(p.id) + '">Demandé</button>';
  if (r === 'follower') return '<button type="button" class="so-b-sm main" data-fol="' + esc(p.id) + '">Suivre en retour</button>';
  return '<button type="button" class="so-b-sm main" data-fol="' + esc(p.id) + '">Suivre</button>';
}
function soPersonRow(p, sub) {
  return '<div class="so-row so-prow"><button type="button" class="so-row-main" data-who="' + esc(p.handle) + '">' + soAv(p, 'md') + '<span class="so-row-t"><b>' + esc(soName(p)) + (p.is_public ? '' : ' <i class="so-lock" title="Compte privé">' + SO_IC.lock + '</i>') + '</b><span>@' + esc(p.handle) + (sub ? ' · ' + esc(sub) : '') + '</span></span></button>' + soFollowBtn(p) + '</div>';
}
function soDrawPeople() {
  const box = soEl('soPeople'); if (!box || !SO.prof) return;
  const groups = { request: [], friend: [], following: [], asked: [], follower: [] };
  for (const p of SO.people) { const r = soRel(p); if (groups[r]) groups[r].push(p); }
  const sec = (title, list) => (list.length ? '<p class="so-lab">' + esc(title) + ' <span>' + list.length + '</span></p><div class="grp so-list">' + list.map((p) => soPersonRow(p, '')).join('') + '</div>' : '');
  let h = sec('Demandes', groups.request) + sec('Amis', groups.friend) + sec('Tu suis', groups.following) + sec('Demandes envoyées', groups.asked) + sec('Te suivent', groups.follower);
  if (!SO.people.length) h = '<div class="so-empty"><p class="so-empty-t">Personne pour l’instant</p><p>Cherche un pseudo ou un prénom. Donne aussi le tien à tes amis : <b>@' + esc(SO.prof.handle) + '</b></p></div>';
  box.innerHTML = h;
}
let SO_QT = null;
async function soSearch(q) {
  const box = soEl('soFound'); if (!box) return;
  if (String(q).trim().replace(/^@/, '').length < 2) { box.innerHTML = ''; return; }
  try {
    const list = await MS.social.search(q);
    if (soEl('soQ').value !== q) return;
    box.innerHTML = list.length ? '<div class="grp so-list so-found">' + list.map((p) => soPersonRow(p, '')).join('') + '</div>' : '<p class="so-none">Personne ne correspond. Vérifie l’orthographe du pseudo.</p>';
  } catch (e) { box.innerHTML = '<p class="so-none">' + esc(soErrText(e)) + '</p>'; }
}
async function soFollowAct(kind, id, btn) {
  soBtnBusy(btn, true);
  try {
    if (kind === 'fol') { const r = await MS.social.follow(id); TRUI.toast(r && r.status === 'accepted' ? 'Tu le suis' : 'Demande envoyée'); }
    else if (kind === 'unf') {
      const p = soPerson(id) || {};
      const asked = p.i_follow === 'pending';
      if (!(await TRUI.ask({ title: asked ? 'Annuler ta demande ?' : 'Ne plus suivre ' + soName(p) + ' ?', text: asked ? '' : (p.is_public ? '' : 'Son compte est privé : il faudra redemander.'), ok: asked ? 'Annuler la demande' : 'Ne plus suivre', cancel: 'Garder' }))) { soBtnBusy(btn, false); return; }
      await MS.social.unfollow(id);
    }
    else if (kind === 'acc') { await MS.social.accept(id); TRUI.toast('Demande acceptée'); }
    else if (kind === 'dec') await MS.social.removeFollower(id);
  } catch (e) { TRUI.toast(soErrText(e)); }
  soBtnBusy(btn, false);
  await soRefresh();
  const q = soEl('soQ'); if (q && q.value) soSearch(q.value);
}

// ---------- fiches ----------
async function soOpenPerson(handle) {
  let p = null;
  try { p = await MS.social.profile(handle); } catch (e) { TRUI.toast(soErrText(e)); return; }
  if (!p) { TRUI.toast('Ce profil n’est pas disponible.'); return; }
  if (p.me) { soOpenMe(); return; }
  const node = document.createElement('div'); node.className = 'sheet tr-sheet so-prof';
  const close = TRUI.openLayer(node, { label: 'Profil de ' + soName(p) });
  function draw() {
    const r = soRel({ i_follow: p.i_follow, follows_me: p.follows_me });
    const st = p.stats ? soStatsText(p.stats) : '';
    let main;
    if (r === 'request') main = '<button type="button" class="tr-btn" data-p="acc">Accepter sa demande</button>';
    else if (p.i_follow === 'accepted') main = '<button type="button" class="tr-btn ghost" data-p="unf">Abonné</button>';
    else if (p.i_follow === 'pending') main = '<button type="button" class="tr-btn ghost" data-p="unf">Demande envoyée</button>';
    else main = '<button type="button" class="tr-btn" data-p="fol">' + (p.follows_me === 'accepted' ? 'Suivre en retour' : 'Suivre') + '</button>';
    node.innerHTML = '<div class="sheeth"><span class="st"></span><button type="button" data-p="close" aria-label="Fermer">' + TRUI.ICON.close + '</button></div>' +
      '<div class="so-prof-h">' + soAv(p, 'xl') + '<p class="so-prof-n">' + esc(soName(p)) + '</p><p class="so-prof-u">@' + esc(p.handle) + (p.public ? ' · compte public' : ' · compte privé') + '</p>' +
      (p.bio ? '<p class="so-prof-bio">' + esc(p.bio) + '</p>' : '') +
      '<p class="so-prof-c"><b>' + nf(p.followers) + '</b> ' + (p.followers > 1 ? 'abonnés' : 'abonné') + ' · <b>' + nf(p.following) + '</b> ' + (p.following > 1 ? 'abonnements' : 'abonnement') + '</p>' +
      (st ? '<p class="so-prof-s">' + esc(st) + '</p>' : (!p.public && p.i_follow !== 'accepted' ? '<p class="so-prof-s">' + SO_IC.lock + ' Compte privé : suis-le pour voir ses stories et sa progression.</p>' : '')) + '</div>' +
      '<div class="so-prof-b">' + main + (p.can_dm ? '<button type="button" class="tr-btn ghost" data-p="chat">' + SO_IC.chat + ' Message</button>' : '') +
      (p.stories ? '<button type="button" class="tr-btn ghost" data-p="stories">Voir sa story</button>' : '') + '</div>' +
      '<button type="button" class="so-prof-more" data-p="more">Bloquer ou signaler</button>';
  }
  async function reload() { try { const q = await MS.social.profile(p.handle); if (q) { p = q; draw(); } } catch (e) {} }
  node.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    const k = b.dataset.p;
    if (k === 'close') close();
    else if (k === 'fol' || k === 'unf' || k === 'acc') { await soFollowAct(k, p.id, b); await reload(); }
    else if (k === 'chat') { close(); soOpenChat(p); }
    else if (k === 'stories') { close(); soOpenStories(p.id); }
    else if (k === 'more') { close(); soPersonMenu(p, {}); }
  });
  draw();
}
async function soPersonMenu(p, { inChat = false } = {}) {
  const items = [];
  if (!inChat) items.push(['chat', 'Envoyer un message']);
  if (p.follows_me === 'accepted') items.push(['remove', 'Retirer de mes abonnés']);
  items.push(['block', 'Bloquer', true], ['report', 'Signaler', true]);
  const act = await soMenu(soName(p), inChat ? items : items.filter((x) => x[0] !== 'chat' || p.can_dm));
  if (act === 'chat') soOpenChat(p);
  else if (act === 'remove') { if (await TRUI.ask({ title: 'Retirer ' + soName(p) + ' de tes abonnés ?', text: 'Il ne verra plus tes stories. Il n’est pas prévenu.', ok: 'Retirer', danger: true })) { try { await MS.social.removeFollower(p.id); soRefresh(); TRUI.toast('Retiré de tes abonnés'); } catch (e) { TRUI.toast(soErrText(e)); } } }
  else if (act === 'block') soBlock(p);
  else if (act === 'report') soReport({ user: p.id, who: p, kind: 'profil', target: null, snapshot: { handle: p.handle, name: p.name, bio: p.bio } });
}
async function soBlock(p) {
  if (!(await TRUI.ask({ title: 'Bloquer ' + soName(p) + ' ?', text: 'Vous ne vous suivrez plus, vous ne pourrez plus vous écrire ni voir vos stories. Il n’est pas prévenu. Tu peux le débloquer depuis ton profil social.', ok: 'Bloquer', danger: true }))) return;
  try { await MS.social.block(p.id); TRUI.toast(soName(p) + ' est bloqué'); if (SO.chat && SO.chat.id === p.id) SO.chat.close(); soRefresh(); }
  catch (e) { TRUI.toast(soErrText(e)); }
}
function soReport({ user, who, kind, target, snapshot }) {
  const node = document.createElement('div'); node.className = 'sheet tr-sheet so-rep';
  node.innerHTML = '<div class="sheeth"><span class="st">Signaler</span><button type="button" data-r="close" aria-label="Fermer">' + TRUI.ICON.close + '</button></div>' +
    '<p class="so-rep-p">Pourquoi ? Ton signalement est anonyme pour ' + esc(soName(who)) + '.</p>' +
    '<div class="so-rep-l" role="radiogroup" aria-label="Raison">' + SO_REASONS.map(([k, l]) => '<label class="so-rep-o"><input type="radio" name="soRep" value="' + k + '"><span>' + esc(l) + '</span></label>').join('') + '</div>' +
    '<textarea class="so-rep-n" maxlength="500" rows="2" placeholder="Un détail ? (facultatif)" aria-label="Détail"></textarea>' +
    '<label class="so-rep-b"><input type="checkbox" checked> Bloquer aussi ' + esc(soName(who)) + '</label>' +
    '<button type="button" class="tr-btn wide danger" data-r="send" disabled>Envoyer le signalement</button>';
  const close = TRUI.openLayer(node, { label: 'Signaler' });
  const go = node.querySelector('[data-r="send"]');
  node.addEventListener('change', () => { go.disabled = !node.querySelector('input[name="soRep"]:checked'); });
  node.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    if (b.dataset.r === 'close') { close(); return; }
    const r = node.querySelector('input[name="soRep"]:checked'); if (!r) return;
    soBtnBusy(go, true);
    try {
      await MS.social.report({ user, kind, target, reason: r.value, note: node.querySelector('.so-rep-n').value.trim(), snapshot });
      if (node.querySelector('.so-rep-b input').checked) { await MS.social.block(user); if (SO.chat && SO.chat.id === user) SO.chat.close(); }
      close(); TRUI.toast('Merci, c’est envoyé. On regarde ça.'); soRefresh();
    } catch (er) { soBtnBusy(go, false); TRUI.toast(soErrText(er)); }
  });
}

// ---------- mon profil ----------
function soOpenMe() {
  const p = SO.prof; if (!p) return;
  const node = document.createElement('div'); node.className = 'sheet tr-sheet so-prof';
  const nFollowers = SO.people.filter((x) => x.follows_me === 'accepted').length, nFollowing = SO.people.filter((x) => x.i_follow === 'accepted').length;
  node.innerHTML = '<div class="sheeth"><span class="st">Mon profil social</span><button type="button" data-m="close" aria-label="Fermer">' + TRUI.ICON.close + '</button></div>' +
    '<div class="so-prof-h">' + soAv(p, 'xl') + '<p class="so-prof-n">' + esc(soName(p)) + '</p><p class="so-prof-u">@' + esc(p.handle) + (p.is_public ? ' · compte public' : ' · compte privé') + '</p>' +
    (p.bio ? '<p class="so-prof-bio">' + esc(p.bio) + '</p>' : '') +
    '<p class="so-prof-c"><b>' + nf(nFollowers) + '</b> ' + (nFollowers > 1 ? 'abonnés' : 'abonné') + ' · <b>' + nf(nFollowing) + '</b> ' + (nFollowing > 1 ? 'abonnements' : 'abonnement') + '</p>' +
    '<p class="so-prof-s">' + esc(soStatsText(p.stats) || 'Ta progression apparaîtra ici.') + '</p></div>' +
    '<div class="so-prof-b"><button type="button" class="tr-btn" data-m="story">' + SO_IC.plus + ' Nouvelle story</button><button type="button" class="tr-btn ghost" data-m="edit">Modifier le profil</button></div>' +
    '<div class="grp so-list so-set">' +
      '<button type="button" class="so-set-r" data-m="blocked">Comptes bloqués' + TRUI.ICON.chev + '</button>' +
      '<button type="button" class="so-set-r" data-m="rules">Règles de la communauté' + TRUI.ICON.chev + '</button>' +
    '</div>' +
    '<button type="button" class="pe-del" data-m="leave">Quitter le social</button>';
  const close = TRUI.openLayer(node, { label: 'Mon profil social' });
  node.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    const k = b.dataset.m;
    if (k === 'close') close();
    else if (k === 'story') { close(); soCompose({ mode: 'story' }); }
    else if (k === 'edit') { close(); soOpenProfileEditor(SO.prof); }
    else if (k === 'rules') soShowRules();
    else if (k === 'blocked') soShowBlocked();
    else if (k === 'leave') {
      if (!(await TRUI.ask({ title: 'Quitter le social ?', text: 'Ton profil, tes abonnements, tes stories et tes messages sont effacés. Tes données d’entraînement et de nutrition ne bougent pas.', ok: 'Tout effacer', danger: true }))) return;
      try { await MS.social.deleteProfile(); SO.prof = null; close(); TRUI.toast('Ton profil social est effacé'); socialRender(); }
      catch (er) { TRUI.toast(soErrText(er)); }
    }
  });
}
function soShowRules() {
  const node = document.createElement('div'); node.className = 'sheet tr-sheet so-rules';
  node.innerHTML = '<div class="sheeth"><span class="st">Règles de la communauté</span><button type="button" data-x aria-label="Fermer">' + TRUI.ICON.close + '</button></div>' +
    '<ol class="so-rules-l">' + SO_RULES.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ol>' +
    '<p class="pe-note">Un message, une story ou un profil qui ne les respecte pas : « Signaler ». Un compte qui ne les respecte pas peut être suspendu.</p>';
  const close = TRUI.openLayer(node, { label: 'Règles de la communauté' });
  node.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) close(); });
}
async function soShowBlocked() {
  let list = [];
  try { list = await MS.social.blocked(); } catch (e) { TRUI.toast(soErrText(e)); return; }
  const node = document.createElement('div'); node.className = 'sheet tr-sheet so-blocked';
  const close = TRUI.openLayer(node, { label: 'Comptes bloqués' });
  function draw() {
    node.innerHTML = '<div class="sheeth"><span class="st">Comptes bloqués</span><button type="button" data-x aria-label="Fermer">' + TRUI.ICON.close + '</button></div>' +
      (list.length ? '<div class="grp so-list">' + list.map((p) => '<div class="so-row so-prow">' + soAv(p, 'md') + '<span class="so-row-t"><b>' + esc(soName(p)) + '</b><span>@' + esc(p.handle) + '</span></span><button type="button" class="so-b-sm" data-ub="' + esc(p.id) + '">Débloquer</button></div>').join('') + '</div>' : '<p class="pe-note">Personne.</p>');
  }
  node.addEventListener('click', async (e) => {
    if (e.target.closest('[data-x]')) { close(); return; }
    const b = e.target.closest('[data-ub]'); if (!b) return;
    try { await MS.social.unblock(b.dataset.ub); list = list.filter((p) => p.id !== b.dataset.ub); draw(); soRefresh(); } catch (er) { TRUI.toast(soErrText(er)); }
  });
  draw();
}
// Création (ou modification) du profil : pseudo, prénom, couleur, bio, public ou privé ; âge et règles à la création
function soOpenProfileEditor(cur) {
  const editing = !!cur, age = soAge();
  if (!editing && age != null && age < SO_MIN_AGE) {
    TRUI.ask({ title: 'Le social est réservé aux 15 ans et plus', text: 'Tout le reste de Grind reste à toi : entraînement, nutrition, progression.', ok: 'Compris', cancel: 'Fermer' });
    return;
  }
  const v = editing ? { handle: cur.handle, name: cur.name, color: cur.color, bio: cur.bio, pub: cur.is_public }
    : { handle: SOC.suggestHandle(PROFILE && PROFILE.firstName), name: String((PROFILE && PROFILE.firstName) || '').slice(0, 40), color: Math.floor(Math.random() * 8), bio: '', pub: false };
  const node = document.createElement('div'); node.className = 'pe so-ed';
  node.innerHTML = '<div class="pe-top"><button type="button" class="pe-ico" data-e="close" aria-label="Fermer">' + TRUI.ICON.close + '</button><span class="pe-tt">' + (editing ? 'Modifier le profil' : 'Profil social') + '</span><button type="button" class="pe-ok" data-e="save">' + (editing ? 'Enregistrer' : 'Créer') + '</button></div>' +
    '<div class="pe-body">' +
      '<div class="so-ed-av"></div>' +
      '<label class="xs-name"><span>Pseudo</span><span class="so-at"><b aria-hidden="true">@</b><input type="text" id="soEdH" maxlength="20" autocomplete="off" autocapitalize="none" spellcheck="false" value="' + esc(v.handle) + '" aria-describedby="soEdHm"></span></label>' +
      '<p class="so-ed-m" id="soEdHm" aria-live="polite"></p>' +
      '<label class="xs-name"><span>Prénom affiché</span><input type="text" id="soEdN" maxlength="40" autocomplete="given-name" value="' + esc(v.name) + '"></label>' +
      '<p class="pe-lab">Couleur</p><div class="so-ed-c" role="radiogroup" aria-label="Couleur de ta pastille">' + Array.from({ length: 8 }, (_, i) => '<button type="button" class="so-c' + i + '" role="radio" data-c="' + i + '" aria-label="Couleur ' + (i + 1) + '" aria-checked="' + (i === v.color) + '"></button>').join('') + '</div>' +
      '<label class="xs-name"><span>Bio <span class="rc-opt">· facultatif</span></span><input type="text" id="soEdB" maxlength="160" autocomplete="off" placeholder="Ex. Prise de masse, 4 séances par semaine" value="' + esc(v.bio) + '"></label>' +
      '<label class="so-ed-pub"><span><b>Compte public</b><small>Public : tout le monde peut te suivre et voir tes stories. Privé : tu acceptes chaque abonné.</small></span><input type="checkbox" id="soEdP"' + (v.pub ? ' checked' : '') + ' role="switch"></label>' +
      (editing ? '' :
        '<div class="so-ed-rules"><p class="pe-lab">Règles de la communauté</p><ol>' + SO_RULES.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ol>' +
        '<label class="so-ed-ok"><input type="checkbox" id="soEdOk"> <span>J’ai 15 ans ou plus et j’accepte ces règles</span></label></div>' +
        '<p class="pe-note">Ton profil montre ta progression à tes abonnés : rang, niveau, série, séances validées. Le reste, seulement quand tu le décides : stories, messages, cartes. Jamais ton poids, tes mesures, tes photos ni tes calories.</p>') +
    '</div>';
  const close = TRUI.openLayer(node, { sheet: false, label: editing ? 'Modifier le profil social' : 'Créer mon profil social' });
  const hIn = node.querySelector('#soEdH'), nIn = node.querySelector('#soEdN'), msg = node.querySelector('#soEdHm'), av = node.querySelector('.so-ed-av');
  const drawAv = () => { av.innerHTML = soAv({ name: nIn.value, handle: hIn.value, color: v.color }, 'xl'); };
  const checkH = () => { const pb = SOC.handleProblem(hIn.value); msg.textContent = pb; msg.classList.toggle('bad', !!pb); return !pb; };
  hIn.addEventListener('input', () => { const low = hIn.value.toLowerCase().replace(/\s+/g, '').replace(/^@/, ''); if (low !== hIn.value) hIn.value = low; checkH(); drawAv(); });
  nIn.addEventListener('input', drawAv);
  node.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-c]');
    if (c) { v.color = +c.dataset.c; node.querySelectorAll('[data-c]').forEach((x) => x.setAttribute('aria-checked', String(x === c))); drawAv(); return; }
    const b = e.target.closest('[data-e]'); if (!b) return;
    if (b.dataset.e === 'close') { close(); return; }
    if (!checkH()) { try { hIn.focus(); } catch (er) {} return; }
    if (!editing && !node.querySelector('#soEdOk').checked) { TRUI.toast('Coche la case des règles pour continuer'); return; }
    const fields = { handle: hIn.value, name: nIn.value.trim().slice(0, 40), color: v.color, bio: node.querySelector('#soEdB').value.trim().slice(0, 160), isPublic: node.querySelector('#soEdP').checked };
    soBtnBusy(b, true);
    try {
      SO.prof = editing ? await MS.social.updateProfile(fields) : await MS.social.createProfile({ ...fields, stats: soMyStats() });
      close(); TRUI.toast(editing ? 'Profil enregistré' : 'Bienvenue, @' + SO.prof.handle + ' !');
      socialRender();
    } catch (er) {
      soBtnBusy(b, false);
      if (er.kind === 'taken') { msg.textContent = 'Ce pseudo est déjà pris.'; msg.classList.add('bad'); try { hIn.focus(); } catch (x) {} }
      else if (er.kind === 'reserved') { msg.textContent = 'Ce pseudo est réservé.'; msg.classList.add('bad'); }
      else TRUI.toast(soErrText(er));
    }
  });
  checkH(); drawAv();
}

// ---------- cartes : ce qu'on peut partager depuis l'app ----------
function soWeekSessions(off) {
  const k = keyFor(off).k, st = off === 0 && weekOffset === 0 ? state : readWeek(k);
  if (!st || !st.prog) return [];
  return st.prog.s.filter((s) => TR.isValidated(st, s)).map((s) => ({ k, st, s, d: s.ex.map((e) => st.log && st.log[e.id] && st.log[e.id].d).filter(Boolean).sort().pop() || '' }));
}
function soRecordsOf(k, st, s, weeks) {
  const out = [];
  for (const e of s.ex) {
    const entry = st.log && st.log[e.id]; if (!entry || !entry.s || !entry.s.length) continue;
    const best = TR.bestValues(e.x, e.mode, weeks, { exceptKey: k, exceptId: e.id });
    if (!Object.keys(best).length) continue;          // première fois : pas encore un record
    const i = TR.recordIndex(e.mode, entry.s, best);
    if (i >= 0) out.push({ id: e.id, n: e.n || TR.exName(e, PROGRAM), mode: e.mode, s: entry.s[i], d: entry.d });
  }
  return out;
}
function soShareOptions() {
  const opts = [];
  const sessions = soWeekSessions(0).concat(soWeekSessions(-1)).sort((a, b) => (a.d < b.d ? 1 : -1));
  const weeks = lgWeeks();
  if (sessions.length) {
    const x = sessions[0], recs = soRecordsOf(x.k, x.st, x.s, weeks);
    const card = SOC.sessionCard({ ses: x.s, log: x.st.log, done: x.st.training && x.st.training[x.s.id], d: x.d || null, recs: recs.map((r) => r.id), program: PROGRAM });
    if (card) opts.push({ id: 'seance', t: 'Ma dernière séance', s: x.s.name + (x.d ? ' · ' + TR.fmtDateShort(x.d) : ''), kind: 'seance', data: card });
  }
  const recs = sessions.flatMap((x) => soRecordsOf(x.k, x.st, x.s, weeks)).slice(0, 6);
  for (const r of recs) { const c = SOC.recordCard(r); if (c) opts.push({ id: 'rec-' + r.id, t: 'Record : ' + r.n, s: SOC.bestSetText(r.mode, r.s), kind: 'record', data: c }); }
  const st = soMyStats();
  opts.push({ id: 'rang', t: 'Mon rang', s: 'Rang ' + st.rk + ' · ' + SOC.RANK_NAMES[st.rk] + ' · niveau ' + st.lvl, kind: 'rang', data: SOC.rankCard(st.rk, st.lvl) });
  if (st.w > 0) opts.push({ id: 'serie', t: 'Ma série', s: soPlural(st.w, 'semaine', 'semaines') + ' de suite', kind: 'serie', data: SOC.streakCard(st.w) });
  opts.push({ id: 'recette', t: 'Une recette', s: recettes.length ? soPlural(recettes.length, 'recette', 'recettes') + ' dans ton livre' : 'Ton livre est vide', kind: 'recette', pick: 'recette', off: !recettes.length });
  const pc = SOC.programCard(PROGRAM, '');
  if (pc) opts.push({ id: 'programme', t: 'Mon programme', s: TR.countText(PROGRAM), kind: 'programme', data: pc });
  opts.push({ id: 'exercice', t: 'Un exercice', s: 'De ton programme', kind: 'exercice', pick: 'exercice' });
  opts.push({ id: 'texte', t: 'Un mot', s: 'Motivation, objectif, défi…', kind: 'texte', pick: 'texte' });
  return opts;
}
// Choisir une carte, la voir, puis publier (story) ou envoyer (message). Renvoie { kind, data } ou null.
function soCompose({ mode, to = null }) {
  return new Promise((resolve) => {
    let step = 'list', cur = null, bg = 0, done = false;
    const opts = soShareOptions();
    const node = document.createElement('div'); node.className = 'sheet tr-sheet so-comp';
    const title = mode === 'story' ? 'Partager en story · 24 h' : 'Partager avec ' + soName(to);
    const close = TRUI.openLayer(node, { label: title, onClose: () => { if (!done) resolve(null); } });
    const finish = (v) => { done = true; resolve(v); close(); };
    function list() {
      step = 'list';
      node.innerHTML = '<div class="sheeth"><span class="st">' + esc(title) + '</span><button type="button" data-c="close" aria-label="Fermer">' + TRUI.ICON.close + '</button></div>' +
        '<div class="so-comp-l">' + opts.map((o) => '<button type="button" class="so-comp-o" data-o="' + esc(o.id) + '"' + (o.off ? ' disabled' : '') + '><span class="so-comp-k so-k-' + o.kind + '">' + SO_KIND_IC[o.kind] + '</span><span><b>' + esc(o.t) + '</b><small>' + esc(o.s) + '</small></span>' + TRUI.ICON.chev + '</button>').join('') + '</div>';
    }
    function preview(kind, data) {
      step = 'preview'; cur = { kind, data };
      node.innerHTML = '<div class="sheeth"><button type="button" class="so-comp-back" data-c="back" aria-label="Retour">' + TRUI.ICON.back + '</button><span class="st">Aperçu</span><button type="button" data-c="close" aria-label="Fermer">' + TRUI.ICON.close + '</button></div>' +
        '<div class="so-comp-p">' + soCard(kind, data, mode === 'story' ? 'big' : 'mini') + '</div>' +
        '<p class="pe-note">' + (mode === 'story' ? 'Visible 24 h par ' + (SO.prof && SO.prof.is_public ? 'tout le monde' : 'tes abonnés') + '.' : 'Envoyé à ' + esc(soName(to)) + ', qui pourra l’ajouter chez lui.') + '</p>' +
        '<button type="button" class="tr-btn wide" data-c="go">' + (mode === 'story' ? 'Publier la story' : 'Envoyer') + '</button>';
    }
    function pickRecipe() {
      step = 'pick';
      node.innerHTML = '<div class="sheeth"><button type="button" class="so-comp-back" data-c="back" aria-label="Retour">' + TRUI.ICON.back + '</button><span class="st">Une recette</span><button type="button" data-c="close" aria-label="Fermer">' + TRUI.ICON.close + '</button></div>' +
        '<div class="so-comp-l">' + RCP.sortRecipes(recettes).map((r) => { const pp = RCP.perPart(r); return '<button type="button" class="so-comp-o" data-r="' + esc(r.id) + '"><span><b>' + esc(r.n) + '</b><small>' + esc(nf(pp.k) + ' kcal la part · ' + soPlural(r.parts, 'part', 'parts')) + '</small></span>' + TRUI.ICON.chev + '</button>'; }).join('') + '</div>';
    }
    function pickExercise() {
      step = 'pick';
      node.innerHTML = '<div class="sheeth"><button type="button" class="so-comp-back" data-c="back" aria-label="Retour">' + TRUI.ICON.back + '</button><span class="st">Un exercice</span><button type="button" data-c="close" aria-label="Fermer">' + TRUI.ICON.close + '</button></div>' +
        '<div class="so-comp-l">' + PROGRAM.sessions.filter((s) => s.ex.length).map((s) => '<p class="so-lab">' + esc(s.name) + '</p>' + s.ex.map((e) => '<button type="button" class="so-comp-o so-comp-ex" data-ex="' + esc(e.id) + '">' + TRUI.thumb(e.x) + '<span><b>' + esc(TR.exName(e, PROGRAM)) + '</b><small>' + esc(SOC.exerciseText(e)) + '</small></span>' + TRUI.ICON.chev + '</button>').join('')).join('') + '</div>';
    }
    function writeText() {
      step = 'pick';
      node.innerHTML = '<div class="sheeth"><button type="button" class="so-comp-back" data-c="back" aria-label="Retour">' + TRUI.ICON.back + '</button><span class="st">Un mot</span><button type="button" data-c="close" aria-label="Fermer">' + TRUI.ICON.close + '</button></div>' +
        '<div class="so-comp-p"><div class="sc-card sc-texte sc-' + (mode === 'story' ? 'big' : 'mini') + ' sc-bg' + bg + '"><textarea class="sc-txt so-comp-t" maxlength="' + SOC.MAX_TEXT + '" rows="4" placeholder="Écris quelque chose…" aria-label="Ton texte"></textarea></div></div>' +
        '<div class="so-comp-bg" role="radiogroup" aria-label="Fond">' + Array.from({ length: SOC.TEXT_BGS }, (_, i) => '<button type="button" class="sc-bg' + i + '" role="radio" data-bg="' + i + '" aria-checked="' + (i === bg) + '" aria-label="Fond ' + (i + 1) + '"></button>').join('') + '</div>' +
        '<button type="button" class="tr-btn wide" data-c="text">Continuer</button>';
      setTimeout(() => { const t = node.querySelector('.so-comp-t'); if (t) try { t.focus(); } catch (e) {} }, 60);
    }
    node.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const c = b.dataset.c;
      if (c === 'close') { close(); return; }
      if (c === 'back') { list(); return; }
      if (b.dataset.bg != null) {
        bg = +b.dataset.bg; node.querySelectorAll('[data-bg]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        const card = node.querySelector('.sc-card'); card.className = card.className.replace(/sc-bg\d/, 'sc-bg' + bg); return;
      }
      if (c === 'text') { const d = SOC.textCard(node.querySelector('.so-comp-t').value, bg); if (!d) { TRUI.toast('Écris quelque chose'); return; } preview('texte', d); return; }
      if (c === 'go') {
        if (mode === 'send') { finish(cur); return; }
        soBtnBusy(b, true);
        try { await MS.social.postStory(cur.kind, cur.data); finish(cur); TRUI.toast('Story publiée pour 24 h'); soRefresh(); }
        catch (er) { soBtnBusy(b, false); TRUI.toast(soErrText(er)); }
        return;
      }
      if (b.dataset.r) { const r = recettes.find((x) => x.id === b.dataset.r); const d = r && SOC.recipeCard(r); if (d) preview('recette', d); return; }
      if (b.dataset.ex) { const e2 = PROGRAM.sessions.flatMap((s) => s.ex).find((x) => x.id === b.dataset.ex); const d = e2 && SOC.exerciseCard(e2, PROGRAM); if (d) preview('exercice', d); return; }
      if (b.dataset.o) {
        const o = opts.find((x) => x.id === b.dataset.o); if (!o || o.off) return;
        if (o.pick === 'recette') pickRecipe();
        else if (o.pick === 'exercice') pickExercise();
        else if (o.pick === 'texte') writeText();
        else preview(o.kind, o.data);
      }
    });
    list();
  });
}
// Partager une carte venue d'ailleurs dans l'app (la page d'une recette) : en story, ou à un ami
async function socialShare(kind, data) {
  if (!MS.social.signedIn()) { if (await TRUI.ask({ title: 'Partager avec tes amis', text: 'Le social demande un compte et un profil social.', ok: 'Ouvrir le Social', cancel: 'Plus tard' })) showView('social', null, true); return; }
  if (SO.prof === undefined) { try { SO.prof = await MS.social.myProfile(); } catch (e) { TRUI.toast(soErrText(e)); return; } }
  if (!SO.prof) { if (await TRUI.ask({ title: 'Crée ton profil social', text: 'Un pseudo, et tu pourras partager tes recettes, tes séances et ton programme.', ok: 'Créer mon profil', cancel: 'Plus tard' })) soOpenProfileEditor(null); return; }
  if (!SO.people.length) { try { SO.people = await MS.social.people(); } catch (e) {} }
  const friends = SO.people.filter((p) => soRel(p) === 'friend');
  const act = await soMenu('Partager « ' + SOC.cardTitle(kind, data) + ' »', [['story', 'En story, pendant 24 h']].concat(friends.slice(0, 20).map((p) => ['to:' + p.id, 'À ' + soName(p)])));
  if (!act) return;
  try {
    if (act === 'story') { await MS.social.postStory(kind, data); TRUI.toast('Story publiée pour 24 h'); }
    else { const p = friends.find((x) => 'to:' + x.id === act); await MS.social.send(p.id, { kind: 'carte', data: { k: kind, d: data } }); TRUI.toast('Envoyé à ' + soName(p)); }
    soRefresh();
  } catch (e) { TRUI.toast(soErrText(e)); }
}

// Une séance de la semaine affichée, en carte (avec ses records)
function soSessionCard(id) {
  const s = state && state.prog && state.prog.s.find((x) => x.id === id); if (!s) return null;
  const d = s.ex.map((e) => state.log && state.log[e.id] && state.log[e.id].d).filter(Boolean).sort().pop() || null;
  const recs = soRecordsOf(keyFor(weekOffset).k, state, s, lgWeeks());
  return SOC.sessionCard({ ses: s, log: state.log, done: state.training && state.training[s.id], d, recs: recs.map((r) => r.id), program: PROGRAM });
}
// « Séance validée » : « Partager » à côté de « Continuer », quand on a un profil social
const _smSO = showMoment;
showMoment = function (id, gain, x0, x1) {
  _smSO.apply(this, arguments);
  const m = soEl('moment'), b = soEl('moShare'); if (!m || !b) return;
  const ok = MS.social.available() && MS.social.signedIn() && !!SO.prof && !!soSessionCard(id);
  m.classList.toggle('can-share', ok); b.hidden = !ok;
  if (!ok) return;
  b.dataset.sid = id; b.dataset.rank = rankIdx(x1) > rankIdx(x0) ? '1' : '';
  clearTimeout(moTimer); moTimer = setTimeout(hideMoment, 6500);          // le temps de choisir
};
soEl('moShare').addEventListener('click', async (e) => {
  e.stopPropagation(); hideMoment();
  const b = e.currentTarget, card = soSessionCard(b.dataset.sid); if (!card) return;
  let kind = 'seance', data = card;
  if (b.dataset.rank) {
    const st = soMyStats();
    const act = await soMenu('Partager', [['seance', 'Ma séance : ' + card.n], ['rang', 'Mon nouveau rang : ' + st.rk + ', ' + SOC.RANK_NAMES[st.rk]]]);
    if (!act) return;
    if (act === 'rang') { kind = 'rang'; data = SOC.rankCard(st.rk, st.lvl); }
  }
  socialShare(kind, data);
});

// ---------- importer une carte reçue ----------
function soImportButtons(kind, d, from) {
  if (!d) return '';
  if (kind === 'recette') return '<button type="button" class="so-imp" data-imp="recette">' + SO_IC.plus + ' Ajouter à mes recettes</button>';
  if (kind === 'programme') return '<button type="button" class="so-imp" data-imp="programme">' + SO_IC.plus + ' Ajouter à mon programme</button>';
  if (kind === 'seance' && d.ses) return '<button type="button" class="so-imp" data-imp="seance">' + SO_IC.plus + ' Ajouter cette séance</button>';
  if (kind === 'exercice') return '<button type="button" class="so-imp" data-imp="exercice">' + SO_IC.plus + ' Ajouter à une séance</button>';
  return '';
}
async function soImport(kind, d, from, what) {
  if (!d) return;
  const suffix = from && from.handle ? '(@' + from.handle + ')' : '';
  if (what === 'recette') {
    const r = SOC.importRecipe(d); if (!r) return;
    if (recettes.some((x) => x.n.toLowerCase() === r.n.toLowerCase())) r.n = (r.n + ' ' + suffix).trim().slice(0, 60);
    r.id = RCP.newId('rc'); r.at = Date.now();
    recFoodSync(r); recettes.push(r); saveRecettes(); renderMeals();
    TRUI.toast('« ' + r.n + ' » ajoutée à ton livre de recettes');
    return;
  }
  if (what === 'exercice') {
    const ses = PROGRAM.sessions;
    const act = await soMenu('Ajouter « ' + SOC.exoName(d.e, d.custom) + ' » à…', ses.map((s) => ['s:' + s.id, s.name + ' · ' + soPlural(s.ex.length, 'exercice', 'exercices')]));
    if (!act) return;
    const { program, added } = SOC.importExercise(PROGRAM, act.slice(2), d.e, d.custom);
    if (added) { applyProgram(program); TRUI.toast('Exercice ajouté à ' + (ses.find((s) => 's:' + s.id === act) || {}).name); }
    return;
  }
  const sessions = what === 'seance' ? [d.ses] : d.sessions;
  const n = sessions.length;
  if (!(await TRUI.ask({ title: n > 1 ? 'Ajouter ' + n + ' séances à ton programme ?' : 'Ajouter « ' + sessions[0].name + ' » à ton programme ?', text: 'Elles arrivent sans jour : tu les places dans ta semaine depuis Training. Ton programme actuel ne change pas.', ok: 'Ajouter' }))) return;
  const { program, added } = SOC.importSessions(PROGRAM, sessions, d.custom, { suffix });
  if (!added) { TRUI.toast('Ton programme a déjà 14 séances : retires-en une d’abord.'); return; }
  applyProgram(program);
  TRUI.toast(added > 1 ? added + ' séances ajoutées à ton programme' : 'Séance ajoutée à ton programme' + (added < n ? ' (limite de 14 séances)' : ''));
}

// ---------- pastilles : messages non lus, demandes ----------
function soShowBadges() {
  const b = SO.badges || {}, n = (b.unread || 0) + (b.requests || 0);
  const nm = soEl('soNMsg'), nr = soEl('soNReq');
  if (nm) { nm.hidden = !b.unread; nm.textContent = b.unread || ''; }
  if (nr) { nr.hidden = !b.requests; nr.textContent = b.requests || ''; }
  const menu = soEl('menuBtn');
  if (menu) {
    let dot = menu.querySelector('.nv-dot');
    if (n && !dot) { dot = document.createElement('i'); dot.className = 'nv-dot'; dot.setAttribute('aria-hidden', 'true'); menu.appendChild(dot); }
    if (dot) dot.hidden = !n;
    menu.setAttribute('aria-label', 'Menu : où on va ?' + (n ? ' (' + n + ' nouveauté' + (n > 1 ? 's' : '') + ' dans Social)' : ''));
  }
  const lab = document.querySelector('.wh-l[data-go="social"]');
  if (lab) {
    let em = lab.querySelector('.wh-n');
    if (n && !em) { em = document.createElement('em'); em.className = 'wh-n'; lab.appendChild(em); }
    if (em) { em.hidden = !n; em.textContent = n > 9 ? '9+' : String(n); }
  }
}
async function soPollBadges() {
  if (SO.off || !MS.social.available() || !MS.social.signedIn()) return;
  soSameUser();
  try {
    if (SO.prof === undefined) SO.prof = await MS.social.myProfile();   // aussi pour « Partager » après une séance
    if (!SO.prof) return;
    SO.badges = await MS.social.badges(); soShowBadges();
  } catch (e) { if (e.kind === 'setup') SO.off = true; }
}

// ---------- branchements ----------
document.getElementById('v-social').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.so === 'signin') MS.openAccount({});
  else if (b.dataset.so === 'create') soOpenProfileEditor(null);
  else if (b.dataset.so === 'retry') socialRender(true);
  else if (b.dataset.so === 'tab-amis') { showSub('social', 'amis'); setTimeout(() => { const q = soEl('soQ'); if (q) try { q.focus(); } catch (er) {} }, 60); }
  else if (b.id === 'soMe') soOpenMe();
  else if (b.dataset.st) { if (b.dataset.st === 'me' && !soStoryGroups().mine) soCompose({ mode: 'story' }); else soOpenStories(b.dataset.st); }
  else if (b.dataset.chat) soOpenChat(soPerson(b.dataset.chat));
  else if (b.dataset.who) soOpenPerson(b.dataset.who);
  else for (const k of ['fol', 'unf', 'acc', 'dec']) if (b.dataset[k]) { soFollowAct(k, b.dataset[k], b); break; }
});
document.getElementById('soQ').addEventListener('input', (e) => { clearTimeout(SO_QT); const q = e.target.value; SO_QT = setTimeout(() => soSearch(q), 280); });
document.getElementById('soQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
const _svSO = showView;
showView = function (v) { const r = _svSO.apply(this, arguments); if (v === 'social') socialRender(); return r; };
window.addEventListener('ms:auth', () => { SO.off = false; if (!MS.social.signedIn()) { SO.prof = undefined; SO.badges = { unread: 0, requests: 0, stories: 0 }; soShowBadges(); } if (curView === 'social') socialRender(); else soPollBadges(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { soPollBadges(); if (curView === 'social' && SO.prof) soRefresh(); } });
setInterval(() => { if (document.visibilityState !== 'visible') return; if (curView === 'social' && SO.prof && !SO.chat) soRefresh(); else soPollBadges(); }, 60000);
setTimeout(soPollBadges, 2500);
