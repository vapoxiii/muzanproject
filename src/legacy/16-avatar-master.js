// ===== Master avatar : personnage dessiné dans le style de Ren, assemblé par calques =====
const MASTER_IMG = MASTER_IMG_URLS;   // images : src/assets/master/
const MASTER_SKIN_REF = [57.5, 23.4, 33.9], MASTER_REF_TONE = 'skin_06';
const EXPR_FACE = { tired: 'visage_fatigue', focus: 'visage_concentre', determined: 'visage_determine', joy: 'visage_joie' };
const masterImgCache = {}, masterLayerCache = new Map();
function masterImg(k) {
  if (!masterImgCache[k]) masterImgCache[k] = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = MASTER_IMG[k]; });
  return masterImgCache[k];
}
// Conversion sRGB <-> Lab (pour changer la teinte de peau en gardant le relief du dessin)
const LIN = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const GAM = new Uint8ClampedArray(4096); for (let i = 0; i < 4096; i++) { const c = i / 4095; GAM[i] = Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); }
const labF = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116, labFi = t => t > 0.2069 ? t * t * t : (t - 16 / 116) / 7.787;
function rgb2lab(r, g, b, o) {
  const R = LIN[r], G = LIN[g], B = LIN[b];
  const fx = labF((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), fy = labF(0.2126 * R + 0.7152 * G + 0.0722 * B), fz = labF((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  o[0] = 116 * fy - 16; o[1] = 500 * (fx - fy); o[2] = 200 * (fy - fz);
}
const g4 = v => GAM[Math.max(0, Math.min(4095, Math.round(v * 4095)))];
function lab2rgb(L, a, b, o) {
  const fy = (L + 16) / 116, x = labFi(fy + a / 500) * 0.95047, y = labFi(fy), z = labFi(fy - b / 200) * 1.08883;
  o[0] = g4(3.2406 * x - 1.5372 * y - 0.4986 * z); o[1] = g4(-0.9689 * x + 1.8758 * y + 0.0415 * z); o[2] = g4(0.0557 * x - 0.2040 * y + 1.0570 * z);
}
function hexLab(hex) { const n = parseInt(hex.slice(1), 16), o = [0, 0, 0]; rgb2lab((n >> 16) & 255, (n >> 8) & 255, n & 255, o); return o; }
function recolorSkin(ctx, w, h, hex) {
  const t = hexLab(hex), ref = MASTER_SKIN_REF, k = t[0] > ref[0] ? 0.9 : 1.0;
  const d = ctx.getImageData(0, 0, w, h), px = d.data, lab = [0, 0, 0], rgb = [0, 0, 0];
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 20) continue;
    rgb2lab(px[i], px[i + 1], px[i + 2], lab);
    const L = lab[0], a = lab[1], b = lab[2], C = Math.hypot(a, b), hue = Math.atan2(b, a) * 57.2958;
    const wt = Math.min(1, Math.max(0, (C - 10) / 10)) * Math.min(1, Math.max(0, (L - 28) / 12)) * Math.max(0, 1 - Math.abs(hue - 55) / 40);
    if (wt <= 0) continue;
    lab2rgb(t[0] + (L - ref[0]) * k, a + (t[1] - ref[1]), b + (t[2] - ref[2]), rgb);
    px[i] = px[i] * (1 - wt) + rgb[0] * wt; px[i + 1] = px[i + 1] * (1 - wt) + rgb[1] * wt; px[i + 2] = px[i + 2] * (1 - wt) + rgb[2] * wt;
  }
  ctx.putImageData(d, 0, 0);
}
function masterLayer(k, skinHex, cuts) {
  const key = k + '|' + (skinHex || '') + '|' + (cuts || []).join(',');
  if (!masterLayerCache.has(key)) masterLayerCache.set(key, (async () => {
    const im = await masterImg(k); if (!im) return null;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const ctx = c.getContext('2d', { willReadFrequently: !!skinHex }); ctx.drawImage(im, 0, 0);
    if (skinHex) recolorSkin(ctx, c.width, c.height, skinHex);
    // vêtement porté par-dessus : on efface la peau qu'il doit cacher (sinon elle dépasse sur les bords)
    if (cuts && cuts.length) { ctx.globalCompositeOperation = 'destination-out'; for (const m of cuts) { const mi = await masterImg(m); if (mi) ctx.drawImage(mi, 0, 0); } ctx.globalCompositeOperation = 'source-over'; }
    return c;
  })());
  return masterLayerCache.get(key);
}
async function renderMaster(cfg, opts) {
  const t0 = performance.now(), W = 768, H = 1152;
  const out = opts.canvas || document.createElement('canvas'); out.width = W; out.height = H;
  const ctx = out.getContext('2d'); ctx.clearRect(0, 0, W, H);
  const tone = (cfg.skin && cfg.skin.tone) || MASTER_REF_TONE, skin = tone === MASTER_REF_TONE ? null : AV_CAT.palettes.skin[tone];
  const jog = !cfg.bottom || cfg.bottom.item === 'bottom_m_jogging', shoes = !cfg.shoes || cfg.shoes.item === 'shoes_m_baskets';
  const order = [['corps_rase', skin, [].concat(jog ? ['masque_jambes'] : [], shoes ? ['masque_pieds'] : [])]];
  const face = EXPR_FACE[opts.expression]; if (face) order.push([face, skin]);
  if (shoes) order.push(['baskets', null]);
  if (jog) order.push(['jogging', null]);
  if (!cfg.top || cfg.top.item === 'top_m_debardeur') order.push(['debardeur', null]);
  if (!cfg.hair || cfg.hair.item === 'hair_m_boucles') order.push(['cheveux_boucles', skin]);
  const layers = await Promise.all(order.map(([k, s, c]) => masterLayer(k, s, c)));
  layers.forEach(c => { if (c) ctx.drawImage(c, 0, 0, W, H); });
  return { canvas: out, ms: performance.now() - t0, layers: layers.length, missing: [], hash: AV.hashOf([cfg, opts.expression || 'neutral']) };
}
// Toute demande de rendu d'un avatar homme passe par le master ; la base femme reste provisoire en attendant son master
const _avRenderBase = AV.renderAvatar;
AV.renderAvatar = function (cfg, cat, assets, opts) { if (cfg && cfg.base === 'male') return renderMaster(cfg, opts || {}); return _avRenderBase(cfg, cat, assets, opts); };
const _avNormBase = AV.normalizeConfig;
AV.normalizeConfig = function (cfg, cat, inv) { const c = structuredClone(cfg); if (c.base === 'male') c.body = Object.assign({}, c.body, { build: 'athletic' }); return _avNormBase(c, cat, inv); };

// Déblocages : seulement les objets portables par la base de l'utilisateur (pas d'annonce d'objet inutilisable)
const _avEvalBase = AV.evaluateUnlocks;
AV.evaluateUnlocks = function (cat, s, inv) { const base = (AVCFG && AVCFG.base) || 'male'; return _avEvalBase(Object.assign({}, cat, { items: cat.items.filter(i => !i.bases || i.bases.includes(base)) }), s, inv); };

// Éditeur : vignettes des coiffures du master, options pas encore disponibles marquées « bientôt »
const _oqItemsMaster = oqItems;
oqItems = function (slot) {
  if (!(ONB && ONB.av.base === 'male' && slot === 'hair')) return _oqItemsMaster(slot);
  return '<div class="oq-mhair">' + AV_CAT.items.filter(i => i.slot === 'hair' && i.master).map(it =>
    '<button type="button" data-av="' + it.id + '" aria-pressed="' + (ONB.av.hair.item === it.id) + '"><canvas width="220" height="220" data-mthumb="' + it.id + '"></canvas>' + esc(it.name) + '</button>').join('') + '</div>';
};
async function drawMasterHairThumbs() {
  for (const cv of document.querySelectorAll('canvas[data-mthumb]')) {
    const cfg = structuredClone(ONB.av); cfg.hair = { item: cv.dataset.mthumb, color: 'hair_black' };
    const r = await renderMaster(cfg, { expression: 'neutral' }), ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 220, 220); ctx.drawImage(r.canvas, 768 * 0.36, 1152 * 0.05, 768 * 0.28, 768 * 0.28, 0, 0, 220, 220);
  }
}
const _oqRenderMaster = oqRender;
oqRender = function (full) {
  _oqRenderMaster(full);
  const q = OQ[ONB.qi], male = ONB.av.base === 'male', ctl = document.getElementById('oqCtl');
  if (q.type === 'morpho') {
    ctl.querySelectorAll('[data-base="female"]').forEach(b => { b.disabled = true; b.innerHTML = 'Femme <span class="oq-soon">Bientôt</span>'; });
    if (male) ctl.querySelectorAll('[data-build]').forEach(b => { if (b.dataset.build !== 'athletic') { b.disabled = true; b.insertAdjacentHTML('beforeend', '<span class="oq-soon">Bientôt</span>'); } });
  }
  if (q.type === 'perso' && male) {
    ctl.querySelectorAll('[data-tab="barbe"], [data-tab="yeux"]').forEach(b => b.remove());
    if (oqTab === 'barbe' || oqTab === 'yeux') { oqTab = 'peau'; return oqRender(false); }
    if (oqTab === 'cheveux') { ctl.querySelectorAll('.oq-sw').forEach(s => s.remove()); drawMasterHairThumbs(); }
  }
};
// Configurations déjà enregistrées : bascule sur les éléments du master
if (AVCFG && AVCFG.base === 'male') { AVCFG = AV.normalizeConfig(AVCFG, AV_CAT, AVINV).config; jset('avatar:config', AVCFG); }
// Accueil : rendu protégé contre les rendus concurrents (le dernier demandé gagne)
let heroTok = 0;
renderHeroAvatar = async function () {
  const hd = document.getElementById('hd'); if (!hd) return;
  const on = sget('ui:hero') === 'avatar' && !!AVCFG; hd.classList.toggle('av-on', on);
  if (!on) { heroAvHash = ''; return; }
  let cv = document.getElementById('hdAv');
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'hdAv'; cv.className = 'hd-av'; cv.setAttribute('aria-hidden', 'true'); document.querySelector('.hd-fig').appendChild(cv); }
  const expr = EXPR_OF[etatFor().k] || 'neutral', cfg = avConfigNow(), hh = AV.hashOf([cfg, expr]);
  if (hh === heroAvHash) return; heroAvHash = hh;
  const tok = ++heroTok, r = await AV.renderAvatar(cfg, AV_CAT, AV_ASSETS, { expression: expr });
  if (tok !== heroTok) return;
  cv.width = r.canvas.width; cv.height = r.canvas.height; cv.getContext('2d').drawImage(r.canvas, 0, 0);
};
// Un rendu provisoire lancé avant cette mise à jour peut encore écrire dans l'ancien canvas : on le détache
{ const old = document.getElementById('hdAv'); if (old) old.remove(); }
// Inventaire : on retire les objets d'une autre base, débloqués avant la mise à jour
if (AVCFG) { const b = AVCFG.base; AVINV = AVINV.filter(id => { const it = AV.itemById(AV_CAT, id); return it && (!it.bases || it.bases.includes(b)); }); jset('avatar:inv', AVINV); }
heroAvHash = ''; renderHeroAvatar();
try { renderHeroTexts(); coachIntoHome(); } catch (e) { console.error(e); }
