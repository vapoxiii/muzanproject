// Cartes du social : ce qu'on partage en story ou en message — séance, record, rang, série, recette,
// programme, exercice, texte. Elles sont construites à partir des données de l'app, nettoyées à la
// réception (rien de ce qui vient d'un autre compte n'est pris tel quel), affichées, puis importées chez
// soi (la recette dans son livre, le programme ou l'exercice dans son entraînement).
// Jamais de poids, de mesures ni de calories du jour dans une carte.
// Importé par le code d'origine sous le nom SOC (voir vite.config.js).
import { normalizeProgram, newId } from '../training/program.js';
import { exoById } from '../training/exercises.js';
import { fmtSets, fmtKg } from '../training/log.js';
import { cleanRecipe, perPart } from '../nutrition/recettes.js';

export const KINDS = ['seance', 'record', 'rang', 'serie', 'recette', 'programme', 'exercice', 'texte'];
export const LABEL = { seance: 'Séance', record: 'Record', rang: 'Rang', serie: 'Série', recette: 'Recette', programme: 'Programme', exercice: 'Exercice', texte: 'Texte' };
export const RANK_NAMES = { E: 'Recrue', D: 'Initié', C: 'Confirmé', B: 'Aguerri', A: 'Élite', S: 'Maître', SS: 'Légende' };
export const TEXT_BGS = 6;
export const MAX_TEXT = 280;

// ---------- nettoyage ----------
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;
export const str = (v, max) => (typeof v === 'string' ? v.replace(CTRL, '').trim().slice(0, max) : '');
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const int = (v, a, b, d = null) => (fin(v) ? Math.min(b, Math.max(a, Math.round(v))) : d);
const num = (v, a, b, d = null) => (fin(v) ? Math.min(b, Math.max(a, Math.round(v * 100) / 100)) : d);
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const MODES = ['r', 't', 'd'];

function cleanSet(s) {
  if (!s || typeof s !== 'object') return null;
  const w = s.w == null ? null : num(s.w, 0, 1000, null), r = num(s.r, 0, 100000, null);
  if (!(r > 0) && !(w > 0)) return null;
  return { w: w > 0 ? w : null, r: r > 0 ? r : null };
}
// des séances au format du programme, vérifiées comme un programme reçu d'un autre appareil
function cleanSessions(sessions, custom) {
  const list = (Array.isArray(sessions) ? sessions : []).filter((s) => s && typeof s === 'object').slice(0, 14).map((s) => ({ ...s, days: [], id: undefined }));
  if (!list.length) return { sessions: [], custom: [] };
  const p = normalizeProgram({ sessions: list, sports: [], custom: Array.isArray(custom) ? custom.slice(0, 40) : [] });
  const sessionsOut = p.sessions.map((s) => ({ name: s.name, sub: s.sub, opt: s.opt, ex: s.ex.map(({ id, ...e }) => e) })).filter((s) => s.ex.length);
  const used = new Set(sessionsOut.flatMap((s) => s.ex.map((e) => e.x)));
  return { sessions: sessionsOut, custom: p.custom.filter((c) => used.has(c.id)) };
}

// Une carte reçue (ou à envoyer) remise en forme ; null si elle est inutilisable
export function cleanCard(kind, d) {
  if (!KINDS.includes(kind) || !d || typeof d !== 'object' || Array.isArray(d)) return null;
  if (kind === 'texte') {
    const t = str(d.t, MAX_TEXT);
    return t ? { t, bg: int(d.bg, 0, TEXT_BGS - 1, 0) } : null;
  }
  if (kind === 'rang') return RANK_NAMES[d.rk] ? { rk: d.rk, lvl: int(d.lvl, 1, 999, null) } : null;
  if (kind === 'serie') { const w = fin(d.w) && d.w >= 1 ? int(d.w, 1, 520) : null; return w ? { w } : null; }
  if (kind === 'record') {
    const n = str(d.n, 80), s = cleanSet(d.s);
    return n && s ? { n, mode: MODES.includes(d.mode) ? d.mode : 'r', s, d: isDay(d.d) ? d.d : null } : null;
  }
  if (kind === 'seance') {
    const ex = (Array.isArray(d.ex) ? d.ex : []).slice(0, 24).filter((e) => e && typeof e === 'object').map((e) => ({
      n: str(e.n, 80), mode: MODES.includes(e.mode) ? e.mode : 'r',
      s: (Array.isArray(e.s) ? e.s : []).slice(0, 12).map(cleanSet).filter(Boolean), rec: e.rec === true, ok: e.ok === true,
    })).filter((e) => e.n && (e.s.length || e.ok)).map(({ ok, ...e }) => (ok && !e.s.length ? { ...e, ok } : e));
    if (!ex.length) return null;
    const out = { n: str(d.n, 40) || 'Séance', sub: str(d.sub, 60), d: isDay(d.d) ? d.d : null, ex };
    const min = int(d.min, 1, 600, null); if (min) out.min = min;
    const imp = cleanSessions([d.ses], d.custom);
    if (imp.sessions.length) { out.ses = imp.sessions[0]; out.custom = imp.custom; }
    return out;
  }
  if (kind === 'recette') {
    const r = cleanRecipe({ id: 'carte', n: d.n, parts: d.parts, items: Array.isArray(d.items) ? d.items.slice(0, 40) : [], prep: d.prep });
    if (!r) return null;
    const items = r.items.map((it) => ({ n: str(it.n, 60) || 'Ingrédient', u: str(it.u, 30) || '1 portion', k: num(it.k, 0, 20000, 0), p: num(it.p, 0, 2000, 0),
      g: it.g == null ? null : num(it.g, 0, 2000, null), l: it.l == null ? null : num(it.l, 0, 2000, null), q: num(it.q, 0, 1000, 0) })).filter((it) => it.q > 0);
    return items.length ? { n: str(r.n, 60) || 'Recette', parts: r.parts, items, prep: str(r.prep, 4000) } : null;
  }
  if (kind === 'programme') {
    const { sessions, custom } = cleanSessions(d.sessions, d.custom);
    return sessions.length ? { n: str(d.n, 60), sessions, custom } : null;
  }
  if (kind === 'exercice') {
    const { sessions, custom } = cleanSessions([{ name: 'Exercice', ex: [d.e] }], d.custom);
    const e = sessions[0] && sessions[0].ex[0];
    return e ? { e, custom } : null;
  }
  return null;
}

// ---------- construire une carte depuis l'app ----------
const stripSession = (s) => ({ name: s.name, sub: s.sub || '', opt: !!s.opt, ex: s.ex.map(({ id, ...e }) => e) });
const customUsed = (program, sessions) => {
  const used = new Set(sessions.flatMap((s) => s.ex.map((e) => e.x)));
  return ((program && program.custom) || []).filter((c) => used.has(c.id));
};
export const textCard = (t, bg = 0) => cleanCard('texte', { t, bg });
export const rankCard = (rk, lvl) => cleanCard('rang', { rk, lvl });
export const streakCard = (w) => cleanCard('serie', { w });
export const recordCard = ({ n, mode, s, d }) => cleanCard('record', { n, mode, s, d });
export const recipeCard = (rec) => cleanCard('recette', rec);
export function programCard(program, n = '') {
  const sessions = (program.sessions || []).map(stripSession).filter((s) => s.ex.length);
  return cleanCard('programme', { n, sessions, custom: customUsed(program, sessions) });
}
export function exerciseCard(e, program) {
  const { id, ...ex } = e;
  return cleanCard('exercice', { e: ex, custom: customUsed(program, [{ ex: [ex] }]) });
}
// Séance faite : ses exercices avec les séries notées (log de la semaine), les records, et la séance
// elle-même (pour qu'un ami puisse l'ajouter à son programme). ses : séance de l'instantané de la semaine ;
// done : ses cases cochées (un exercice coché sans séries notées compte, affiché « fait »).
export function sessionCard({ ses, log, done = null, d = null, recs = [], program = null, min = null }) {
  const ex = ses.ex.map((e, i) => {
    const entry = log && log[e.id];
    return { n: e.n || 'Exercice', mode: e.mode, s: entry && Array.isArray(entry.s) ? entry.s : [], rec: recs.includes(e.id), ok: !!(done && done[i]) };
  });
  const days = ses.ex.map((e) => log && log[e.id] && log[e.id].d).filter(isDay).sort();
  const def = stripSession(ses);
  return cleanCard('seance', { n: ses.name, sub: ses.sub, d: d || days[days.length - 1] || null, ex, min, ses: def, custom: customUsed(program, [def]) });
}

// ---------- lire une carte ----------
export function setsText(mode, sets) { return fmtSets(mode, sets); }
export function bestSetText(mode, s) { return fmtSets(mode, [s]); }
export function sessionTotals(d) {
  let sets = 0, vol = 0, recs = 0;
  for (const e of d.ex || []) {
    sets += e.s.length; if (e.rec) recs++;
    if (e.mode === 'r') for (const s of e.s) if (s.w > 0 && s.r > 0) vol += s.w * s.r;
  }
  return { sets, vol: Math.round(vol), recs };
}
const plural = (n, one, many) => n + ' ' + (n > 1 ? many : one);
export function exerciseText(e) {
  const unit = e.mode === 't' ? ' s' : e.mode === 'd' ? ' m' : '';
  const range = e.lo == null ? (e.mode === 'r' ? 'max' : '') : e.hi != null && e.hi !== e.lo ? e.lo + '–' + e.hi + unit : e.lo + unit;
  return e.sets + ' × ' + (range || 'libre') + (e.each ? ' par côté' : '') + (e.rest ? ' · repos ' + (e.rest >= 60 ? Math.floor(e.rest / 60) + ' min' + (e.rest % 60 ? ' ' + (e.rest % 60) + ' s' : '') : e.rest + ' s') : '');
}
// Une ligne pour la liste des conversations, une notification, un lecteur d'écran
export function cardTitle(kind, d) {
  if (!d) return LABEL[kind] || 'Carte';
  switch (kind) {
    case 'texte': return d.t.length > 70 ? d.t.slice(0, 68) + '…' : d.t;
    case 'rang': return 'Rang ' + d.rk + ' atteint · ' + RANK_NAMES[d.rk];
    case 'serie': return plural(d.w, 'semaine', 'semaines') + ' de suite';
    case 'record': return 'Record · ' + d.n + ' ' + bestSetText(d.mode, d.s);
    case 'seance': return 'Séance · ' + d.n;
    case 'recette': return 'Recette · ' + d.n;
    case 'programme': return 'Programme · ' + plural(d.sessions.length, 'séance', 'séances');
    case 'exercice': return 'Exercice · ' + (d.e.n || exoName(d.e, d.custom));
    default: return LABEL[kind] || 'Carte';
  }
}
export function exoName(e, custom = []) {
  if (e.n) return e.n;
  const c = (custom || []).find((x) => x.id === e.x);
  if (c) return c.n;
  const x = exoById(e.x);
  return x ? x.n : 'Exercice';
}
function dayText(d) {
  if (!isDay(d)) return '';
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// HTML d'une carte. esc : échappement (obligatoire : tout ce qui vient d'une carte est du texte) ;
// thumb(x) : vignette d'un exercice ; size : 'mini' (message), 'big' (story).
export function cardHtml(kind, d, { esc, thumb = null, size = 'mini' } = {}) {
  if (!d || typeof esc !== 'function') return '';
  const head = (txt) => `<p class="sc-k">${esc(txt)}</p>`;
  const wrap = (inner, extra = '') => `<div class="sc-card sc-${kind} sc-${size}${extra}">${inner}</div>`;
  if (kind === 'texte') return wrap(`<p class="sc-txt">${esc(d.t)}</p>`, ' sc-bg' + d.bg);
  if (kind === 'rang') return wrap(`${head('Rang atteint')}<div class="sc-rank"><b>${esc(d.rk)}</b></div><p class="sc-t">${esc(RANK_NAMES[d.rk])}</p>${d.lvl ? `<p class="sc-s">Niveau ${esc(d.lvl)}</p>` : ''}`);
  if (kind === 'serie') return wrap(`${head('Série')}<p class="sc-big-n">${esc(d.w)}</p><p class="sc-t">${d.w > 1 ? 'semaines de suite' : 'semaine de suite'}</p><p class="sc-s">Au moins 60 % du programme chaque semaine.</p>`);
  if (kind === 'record') return wrap(`${head('Nouveau record')}<p class="sc-big-v">${esc(bestSetText(d.mode, d.s))}</p><p class="sc-t">${esc(d.n)}</p>${d.d ? `<p class="sc-s">${esc(dayText(d.d))}</p>` : ''}`);
  if (kind === 'seance') {
    const t = sessionTotals(d);
    const meta = [plural(d.ex.length, 'exercice', 'exercices'), t.sets ? plural(t.sets, 'série', 'séries') : '', t.vol ? fmtKg(t.vol) + ' kg soulevés' : '', d.min ? d.min + ' min' : ''].filter(Boolean).join(' · ');
    const max = size === 'big' ? 8 : 4;
    const rows = d.ex.slice(0, max).map((e) => `<li><span>${esc(e.n)}${e.rec ? ' <em class="sc-rec">Record</em>' : ''}</span>${e.s.length ? `<b>${esc(setsText(e.mode, e.s))}</b>` : '<b class="sc-ok">fait</b>'}</li>`).join('');
    const more = d.ex.length > max ? `<li class="sc-more">+ ${esc(plural(d.ex.length - max, 'autre exercice', 'autres exercices'))}</li>` : '';
    return wrap(`${head('Séance terminée' + (d.d ? ' · ' + dayText(d.d) : ''))}<p class="sc-t">${esc(d.n)}</p>${d.sub ? `<p class="sc-s">${esc(d.sub)}</p>` : ''}<p class="sc-m">${esc(meta)}${t.recs ? ' · <b>' + esc(plural(t.recs, 'record', 'records')) + '</b>' : ''}</p><ul class="sc-list">${rows}${more}</ul>`);
  }
  if (kind === 'recette') {
    const pp = perPart(d), max = size === 'big' ? 8 : 4;
    const rows = d.items.slice(0, max).map((it) => `<li><span>${esc(it.n)}</span></li>`).join('');
    const more = d.items.length > max ? `<li class="sc-more">+ ${esc(plural(d.items.length - max, 'autre ingrédient', 'autres ingrédients'))}</li>` : '';
    return wrap(`${head('Recette')}<p class="sc-t">${esc(d.n)}</p><p class="sc-m">${esc('Pour ' + plural(d.parts, 'part', 'parts') + ' · ' + Math.round(pp.k) + ' kcal la part · ' + Math.round(pp.p) + ' g de protéines')}</p><ul class="sc-list sc-ing">${rows}${more}</ul>`);
  }
  if (kind === 'programme') {
    const rows = d.sessions.slice(0, size === 'big' ? 7 : 4).map((s) => `<li><span>${esc(s.name)}${s.sub ? ' <small>' + esc(s.sub) + '</small>' : ''}</span><b>${esc(plural(s.ex.length, 'exercice', 'exercices'))}</b></li>`).join('');
    const more = d.sessions.length > (size === 'big' ? 7 : 4) ? `<li class="sc-more">+ ${esc(plural(d.sessions.length - (size === 'big' ? 7 : 4), 'autre séance', 'autres séances'))}</li>` : '';
    return wrap(`${head('Programme')}<p class="sc-t">${esc(d.n || plural(d.sessions.length, 'séance', 'séances'))}</p><ul class="sc-list">${rows}${more}</ul>`);
  }
  if (kind === 'exercice') {
    const name = exoName(d.e, d.custom);
    return wrap(`${head('Exercice')}<div class="sc-exo">${thumb ? thumb(d.e.x) : ''}<div><p class="sc-t">${esc(name)}</p><p class="sc-m">${esc(exerciseText(d.e))}</p></div></div>`);
  }
  return '';
}

// ---------- importer chez soi ----------
// La recette reçue, prête pour le livre (le code de l'app lui donne un id et son aliment « 1 part »)
export function importRecipe(d) {
  const c = cleanCard('recette', d);
  return c ? { n: c.n, parts: c.parts, items: c.items.map((it) => ({ ...it })), prep: c.prep } : null;
}
// Exercices créés reçus : on reprend celui qui a le même nom chez soi, sinon on l'ajoute (nouvel id)
function mergeCustom(program, custom) {
  const map = new Map(), mine = (program.custom || []).slice();
  for (const c of custom || []) {
    const same = mine.find((m) => m.n.trim().toLowerCase() === c.n.trim().toLowerCase() && (m.mode || 'r') === (c.mode || 'r'));
    if (same) map.set(c.id, same.id);
    else { const id = newId('c-'); mine.push({ ...c, id }); map.set(c.id, id); }
  }
  return { custom: mine, map };
}
const remapEx = (e, map) => ({ ...e, id: newId('e'), x: map.get(e.x) || e.x });
// Ajoute des séances reçues au programme (sans jour : on les place soi-même). Renvoie le programme
// (à enregistrer) et le nombre de séances ajoutées (14 séances au plus dans un programme).
export function importSessions(program, sessions, custom, { suffix = '' } = {}) {
  const p = structuredClone(program);
  const { custom: merged, map } = mergeCustom(p, custom);
  p.custom = merged;
  const names = new Set(p.sessions.map((s) => s.name.toLowerCase()));
  let added = 0;
  for (const s of sessions || []) {
    if (p.sessions.length >= 14) break;
    let name = s.name;
    if (names.has(name.toLowerCase()) && suffix) name = (name + ' ' + suffix).slice(0, 40);
    names.add(name.toLowerCase());
    p.sessions.push({ id: newId('s'), name, sub: s.sub || '', opt: !!s.opt, days: [], ex: s.ex.map((e) => remapEx(e, map)) });
    added++;
  }
  return { program: p, added };
}
// Ajoute un exercice reçu à une séance de son programme
export function importExercise(program, sessionId, e, custom) {
  const p = structuredClone(program);
  const ses = p.sessions.find((s) => s.id === sessionId);
  if (!ses) return { program: p, added: 0 };
  const { custom: merged, map } = mergeCustom(p, custom);
  p.custom = merged;
  ses.ex.push(remapEx(e, map));
  return { program: p, added: 1 };
}

// ---------- pseudos ----------
export const HANDLE_RE = /^[a-z0-9_][a-z0-9_.]{1,18}[a-z0-9_]$/;
// Proposition de pseudo à partir du prénom : « Béa Martin » → « bea.martin »
export function suggestHandle(name) {
  const base = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9_.\s-]/g, '').trim().replace(/[\s-]+/g, '.').replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 20);
  return base.length >= 3 ? base.replace(/\.$/, '') : '';
}
export function handleProblem(h) {
  if (!h) return 'Choisis un pseudo.';
  if (h.length < 3) return '3 caractères au moins.';
  if (h.length > 20) return '20 caractères au plus.';
  if (!/^[a-z0-9_.]+$/.test(h)) return 'Lettres minuscules sans accent, chiffres, « _ » et « . » seulement.';
  if (h.startsWith('.') || h.endsWith('.')) return 'Pas de point au début ni à la fin.';
  return HANDLE_RE.test(h) ? '' : 'Ce pseudo n’est pas valable.';
}
// Couleurs des pastilles (avatar à initiale) : index 0 à 7
export const AVATAR_COLORS = 8;
export function initial(name, handle) {
  const s = String(name || handle || '?').trim();
  const ch = Array.from(s)[0] || '?';
  return ch.toUpperCase();
}

// Temps écoulé, court : « à l'instant », « 5 min », « 3 h », « hier », « 12 nov. »
export function ago(iso, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'à l’instant';
  if (s < 3600) return Math.floor(s / 60) + ' min';
  if (s < 86400) return Math.floor(s / 3600) + ' h';
  if (s < 2 * 86400) return 'hier';
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
