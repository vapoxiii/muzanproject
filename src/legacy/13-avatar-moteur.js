// ===== Moteur d'avatar (copie de avatar/engine.js et avatar/placeholders.js) =====
const AV = (function(){
// Moteur d'avatar paramétrique.
// Configuration (JSON) + catalogue (JSON) -> liste de calques -> image Canvas.
// Aucun appel réseau ni IA : tout est recomposé sur l'appareil.

const RANKS = [['E', 0], ['D', 400], ['C', 1500], ['B', 4500], ['A', 10000], ['S', 20000], ['SS', 35000]];
const levelFor = xp => Math.floor(Math.sqrt(Math.max(0, xp) / 25)) + 1;           // même formule que l'app
const rankFor = xp => RANKS.reduce((r, [k, v]) => (xp >= v ? k : r), 'E');
const rankIndex = r => RANKS.findIndex(x => x[0] === r);
const STAGE_THRESHOLDS = [24, 72, 150];                                             // séances validées
const physiqueStage = (sessions, th = STAGE_THRESHOLDS) => th.filter(t => sessions >= t).length;

const ITEM_SLOTS = ['hair', 'beard', 'top', 'bottom', 'shoes'];
const ACC_SLOTS = ['head', 'ears', 'neck', 'wrist_right', 'hand'];

// Empreinte courte (FNV-1a) : sert de clé de cache pour l'image composée.
function hashOf(value) {
  const s = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}

const itemById = (catalog, id) => catalog.items.find(i => i.id === id) || null;
const isOwned = (item, inventory) => item.unlock.type === 'starter' || inventory.includes(item.id);
const fitsBody = (item, cfg) =>
  (!item.bases || item.bases.includes(cfg.base)) && (!item.fits || item.fits.includes(cfg.body.build));

// Remplace tout élément absent du catalogue, non possédé ou incompatible avec le corps
// par l'élément de départ du même emplacement. Une mise à jour du catalogue ne casse jamais un avatar.
function normalizeConfig(config, catalog, inventory) {
  const c = structuredClone(config);
  const changes = [];
  c.body.physiqueStage = Math.max(0, Math.min(3, c.body.physiqueStage | 0));
  if (!catalog.palettes.skin[c.skin.tone]) c.skin.tone = Object.keys(catalog.palettes.skin)[0];
  if (!catalog.palettes.eyes[c.face.eyeColor]) c.face.eyeColor = Object.keys(catalog.palettes.eyes)[0];
  if (!catalog.palettes.hair[c.hair.color]) c.hair.color = Object.keys(catalog.palettes.hair)[0];
  const starter = slot => catalog.items.find(i => i.slot === slot && i.unlock.type === 'starter' && fitsBody(i, c));
  for (const slot of ITEM_SLOTS) {
    const ref = c[slot];
    const it = ref && itemById(catalog, ref.item);
    if (!it || it.slot !== slot || !isOwned(it, inventory) || !fitsBody(it, c)) {
      const s = starter(slot);
      if (s) {
        changes.push({ slot, from: ref ? ref.item : null, to: s.id });
        c[slot] = { ...(c[slot] || {}), item: s.id, colorway: (s.colorways || [])[0] || null };
      }
    } else if (it.colorways && !it.colorways.includes(ref.colorway)) {
      c[slot].colorway = it.colorways[0];
    }
  }
  const seen = new Set();
  c.accessories = (c.accessories || []).filter(a => {
    const it = itemById(catalog, a.item);
    const ok = it && it.slot === 'accessory' && isOwned(it, inventory) && fitsBody(it, c) && !seen.has(it.accSlot);
    if (ok) seen.add(it.accSlot); else changes.push({ slot: 'accessory', from: a.item, to: null });
    return ok;
  });
  return { config: c, changes };
}

const fillTemplate = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));

// Calcule la liste ordonnée des calques à dessiner, teintes comprises.
function resolveLayers(cfg, catalog, opts = {}) {
  const pal = catalog.palettes;
  const expr = opts.expression || 'neutral';
  const stage = cfg.body.physiqueStage || 0;
  const vars = { base: cfg.base, build: cfg.body.build, stage, expr };
  const equipped = [];
  for (const slot of ITEM_SLOTS) {
    const it = cfg[slot] && itemById(catalog, cfg[slot].item);
    if (it) equipped.push({ it, ref: cfg[slot] });
  }
  for (const a of cfg.accessories || []) {
    const it = itemById(catalog, a.item);
    if (it) equipped.push({ it, ref: a });
  }
  const flags = new Set();   // ex. une casquette pose « capped » : les cheveux prennent leur variante aplatie
  const hidden = new Set();  // ex. un sweat masque l'emplacement « cou »
  equipped.forEach(({ it }) => { (it.sets || []).forEach(f => flags.add(f)); (it.hides || []).forEach(h => hidden.add(h)); });

  const tintOf = (kind, ref) => {
    switch (kind) {
      case 'skin': return pal.skin[cfg.skin.tone];
      case 'eyes': return pal.eyes[cfg.face.eyeColor];
      case 'hair': return pal.hair[cfg.hair.color];
      case 'beard': return pal.hair[cfg.beard.color === 'inherit' ? cfg.hair.color : cfg.beard.color];
      case 'colorway': return pal.cloth[ref && ref.colorway] || null;
      default: return null;
    }
  };
  const layers = [];
  const add = (def, meta, ref) => layers.push({
    z: def.z, kind: def.kind || 'fill', tint: def.tint ? tintOf(def.tint, ref) : null,
    src: fillTemplate(def.src, { ...vars, ...meta }), meta: { ...vars, ...meta, part: def.part || null, kind: def.kind || 'fill' },
  });
  catalog.body.layers.forEach(def => add(def, { slot: 'body' }));
  catalog.face.layers.forEach(def => add(def, { slot: 'face' }));
  for (const { it, ref } of equipped) {
    if (it.slot === 'accessory' && hidden.has('acc:' + it.accSlot)) continue;
    const v = (it.variantsFrom || []).find(f => flags.has(f));
    const meta = { slot: it.slot, item: it.id, art: it.art, variant: v ? '_' + v : '', fitStage: it.stageVariants ? stage : 3 };
    (it.layers || []).forEach(def => add(def, meta, ref));
  }
  return layers.sort((a, b) => a.z - b.z);
}

// Compose l'avatar dans un canvas. `assets.get(src, meta)` renvoie une image (ou null si absente).
async function renderAvatar(cfg, catalog, assets, opts = {}) {
  const t0 = performance.now();
  const scale = opts.scale || 0.5;
  const W = Math.round(catalog.canvas.w * scale), H = Math.round(catalog.canvas.h * scale);
  const out = opts.canvas || document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const layers = resolveLayers(cfg, catalog, opts);
  const images = await Promise.all(layers.map(l => assets.get(l.src, l.meta)));
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
  const tc = tmp.getContext('2d');
  const missing = [];
  layers.forEach((l, i) => {
    const img = images[i];
    if (!img) { missing.push(l.src); return; }
    if (l.tint) {
      // aplat en niveaux de gris x couleur de palette, puis on restaure la transparence d'origine
      tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, W, H); tc.drawImage(img, 0, 0, W, H);
      tc.globalCompositeOperation = 'multiply'; tc.fillStyle = l.tint; tc.fillRect(0, 0, W, H);
      tc.globalCompositeOperation = 'destination-in'; tc.drawImage(img, 0, 0, W, H);
      ctx.drawImage(tmp, 0, 0);
    } else {
      ctx.drawImage(img, 0, 0, W, H);
    }
  });
  return { canvas: out, ms: performance.now() - t0, layers: layers.length, missing, hash: hashOf([cfg, opts.expression || 'neutral', scale]) };
}

// Fournisseur d'images réelles : <base>/<src>.webp, avec cache. Remplace les silhouettes provisoires
// dès que les dessins de l'illustrateur existent, sans changer le reste du code.
class ImageAssets {
  constructor(base) { this.base = base; this.cache = new Map(); }
  get(src) {
    if (!this.cache.has(src)) {
      this.cache.set(src, new Promise(resolve => {
        const im = new Image(); im.decoding = 'async';
        im.onload = () => resolve(im); im.onerror = () => resolve(null);
        im.src = this.base + src + '.webp';
      }));
    }
    return this.cache.get(src);
  }
}

// ---- Déblocages ----
function unlockMet(u, s) {
  switch (u.type) {
    case 'starter': return true;
    case 'level': return s.level >= u.value;
    case 'rank': return rankIndex(s.rank) >= rankIndex(u.value);
    case 'counter': return (s.counters[u.counter] || 0) >= u.gte;
    default: return false;   // quête, coach, événement, boutique : gérés par leurs propres systèmes
  }
}
function unlockLabel(u) {
  switch (u.type) {
    case 'starter': return 'De départ';
    case 'level': return 'Niveau ' + u.value;
    case 'rank': return 'Rang ' + u.value;
    case 'counter': return u.label || (u.counter + ' ≥ ' + u.gte);
    default: return u.label || u.type;
  }
}
// Renvoie les éléments nouvellement débloqués. Idempotent : un élément déjà possédé n'est jamais rendu deux fois.
function evaluateUnlocks(catalog, stats, inventory) {
  return catalog.items
    .filter(it => it.unlock.type !== 'starter' && !inventory.includes(it.id) && unlockMet(it.unlock, stats))
    .map(it => it.id);
}

// Silhouettes PROVISOIRES, dessinées par le code.
// Elles respectent exactement le format des futurs dessins : même gabarit 1024 x 1536, mêmes calques
// (aplat en niveaux de gris à teinter + contour), mêmes chemins. L'illustrateur les remplace fichier par fichier.

const INK = '#17131d', LW = 5;
const BUILDS = {
  slim: { sh: 120, wa: 86, hi: 104, arm: 27, leg: 46 },
  athletic: { sh: 148, wa: 98, hi: 112, arm: 36, leg: 56 },
  strong: { sh: 176, wa: 124, hi: 128, arm: 48, leg: 66 },
};

function geom(base, build, stage) {
  const b = BUILDS[build] || BUILDS.athletic, f = base === 'female', s = stage | 0;
  return {
    f, s, cx: 512, headY: 250, headRx: f ? 78 : 82, headRy: f ? 98 : 100,
    shY: 420, sh: (f ? b.sh * 0.86 : b.sh) + s * 8,
    waY: 740, wa: (f ? b.wa * 0.86 : b.wa) + s * 2,
    hiY: 860, hi: (f ? b.hi * 1.1 : b.hi) + s * 2,
    arm: (f ? b.arm * 0.86 : b.arm) + s * 5, leg: (f ? b.leg * 0.94 : b.leg) + s * 3,
    handY: 930, kneeY: 1130, ankleY: 1390,
  };
}

const q = (a, c, b, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
const tAtY = (a, c, b, y) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; (q(a, c, b, m)[1] < y ? (lo = m) : (hi = m)); } return (lo + hi) / 2; };

// Membre (bras ou jambe) : deux bords en courbe, coupés à la hauteur `toY` si besoin (manches, short).
function limb(outer, inner, toY) {
  const p = new Path2D(), N = 14;
  const to = toY == null ? 1 : tAtY(outer[0], outer[1], outer[2], toY);
  const ti = toY == null ? 1 : tAtY(inner[0], inner[1], inner[2], toY);
  for (let i = 0; i <= N; i++) { const pt = q(outer[0], outer[1], outer[2], to * i / N); i ? p.lineTo(...pt) : p.moveTo(...pt); }
  for (let i = N; i >= 0; i--) p.lineTo(...q(inner[0], inner[1], inner[2], ti * i / N));
  p.closePath();
  return p;
}
function arm(g, side, pad = 0, toY = null) {
  const x = d => g.cx + side * d, mid = (g.shY + g.handY) / 2;
  return limb(
    [[x(g.sh + g.arm * 0.45 + pad), g.shY + 10], [x(g.sh + g.arm * 0.6 + 16 + pad), mid], [x(g.sh + 30 + g.arm * 0.32 + pad * 0.5), g.handY - 26]],
    [[x(g.sh - g.arm * 0.55 - pad), g.shY + 86], [x(g.sh - g.arm * 0.25 + 16 - pad), mid], [x(g.sh + 30 - g.arm * 0.32 - pad * 0.5), g.handY - 26]],
    toY);
}
function leg(g, side, pad = 0, toY = null) {
  const x = d => g.cx + side * d;
  return limb(
    [[x(g.hi + pad), g.hiY - 10], [x(g.hi * 0.8 + pad), g.kneeY], [x(g.hi * 0.62 + pad * 0.6), g.ankleY]],
    [[x(6), g.hiY + 70], [x(g.hi * 0.8 - g.leg * 0.95 - pad), g.kneeY], [x(g.hi * 0.62 - g.leg * 0.55 - pad * 0.6), g.ankleY]],
    toY);
}
function torso(g, pad = 0, hemY = null) {
  const { cx } = g, p = new Path2D(), sh = g.sh + pad, wa = g.wa + pad, hi = g.hi + pad, hem = hemY || g.hiY + 30;
  p.moveTo(cx - 44, g.shY - 34);
  p.quadraticCurveTo(cx - sh * 0.8, g.shY - 16, cx - sh, g.shY + 10);
  p.bezierCurveTo(cx - sh - 4, g.shY + 90, cx - wa - 12, g.waY - 170, cx - wa, g.waY);
  p.bezierCurveTo(cx - wa + 2, g.waY + 50, cx - hi, g.hiY - 70, cx - hi, Math.min(g.hiY, hem));
  p.lineTo(cx - hi, hem); p.lineTo(cx + hi, hem); p.lineTo(cx + hi, Math.min(g.hiY, hem));
  p.bezierCurveTo(cx + hi, g.hiY - 70, cx + wa - 2, g.waY + 50, cx + wa, g.waY);
  p.bezierCurveTo(cx + wa + 12, g.waY - 170, cx + sh + 4, g.shY + 90, cx + sh, g.shY + 10);
  p.quadraticCurveTo(cx + sh * 0.8, g.shY - 16, cx + 44, g.shY - 34);
  p.closePath();
  return p;
}
const ellipse = (x, y, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; };
const handPos = (g, side) => [g.cx + side * (g.sh + 30), g.handY];
const footPos = (g, side) => [g.cx + side * (g.hi * 0.62 - g.leg * 0.27), g.ankleY + 26];

function shade(ctx, path, base = '#F1F1F1', depth = 0.14) {
  ctx.fillStyle = base; ctx.fill(path);
  ctx.save(); ctx.clip(path); ctx.strokeStyle = `rgba(0,0,0,${depth})`; ctx.lineWidth = 30; ctx.stroke(path); ctx.restore();
}
const ink = (ctx, path, w = LW) => { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.stroke(path); };
const stroke = (ctx, pts, w = LW * 0.7) => { const p = new Path2D(); p.moveTo(...pts[0]); for (let i = 1; i < pts.length; i += 2) p.quadraticCurveTo(...pts[i], ...pts[i + 1]); ink(ctx, p, w); };

// ---------- Corps ----------
function body(ctx, g, line) {
  const parts = [
    ellipse(g.cx - g.headRx + 2, g.headY + 12, 13, 24), ellipse(g.cx + g.headRx - 2, g.headY + 12, 13, 24),
    leg(g, -1), leg(g, 1), arm(g, -1), arm(g, 1), torso(g),
    (() => { const p = new Path2D(); p.rect(g.cx - 32, g.headY + g.headRy - 40, 64, g.shY - g.headY - g.headRy + 20); return p; })(),
    ellipse(g.cx, g.headY, g.headRx, g.headRy),
    ellipse(...handPos(g, -1), g.arm * 0.56, g.arm * 0.66), ellipse(...handPos(g, 1), g.arm * 0.56, g.arm * 0.66),
    ellipse(...footPos(g, -1), 40, 20), ellipse(...footPos(g, 1), 40, 20),
  ];
  if (!line) { parts.forEach(p => shade(ctx, p)); return; }
  parts.forEach(p => ink(ctx, p));
  const { cx, shY, s } = g;
  if (s >= 1) { stroke(ctx, [[cx - 20, shY - 2], [cx - g.sh * 0.4, shY - 14], [cx - g.sh * 0.7, shY + 4]], 3.5); stroke(ctx, [[cx + 20, shY - 2], [cx + g.sh * 0.4, shY - 14], [cx + g.sh * 0.7, shY + 4]], 3.5); }
  if (!g.f && s >= 1) { stroke(ctx, [[cx - g.sh * 0.72, shY + 130], [cx - g.sh * 0.35, shY + 158], [cx - 6, shY + 140]], 3.5); stroke(ctx, [[cx + g.sh * 0.72, shY + 130], [cx + g.sh * 0.35, shY + 158], [cx + 6, shY + 140]], 3.5); }
  if (g.f) { stroke(ctx, [[cx - g.sh * 0.6, shY + 150], [cx - g.sh * 0.32, shY + 182], [cx - 8, shY + 156]], 3.5); stroke(ctx, [[cx + g.sh * 0.6, shY + 150], [cx + g.sh * 0.32, shY + 182], [cx + 8, shY + 156]], 3.5); }
  if (s >= 2) { stroke(ctx, [[cx, shY + 200], [cx + 2, shY + 290], [cx, shY + 380]], 3); [250, 300, 350].forEach(y => { stroke(ctx, [[cx - 40, shY + y], [cx - 20, shY + y + 6], [cx - 6, shY + y]], 3); stroke(ctx, [[cx + 40, shY + y], [cx + 20, shY + y + 6], [cx + 6, shY + y]], 3); }); }
  if (s >= 3) [-1, 1].forEach(sd => stroke(ctx, [[cx + sd * (g.sh - 30), shY + 6], [cx + sd * (g.sh + 6), shY + 60], [cx + sd * (g.sh - 10), shY + 120]], 3));
}

// ---------- Visage ----------
function face(ctx, g, expr, layer) {
  const { cx, headY, f } = g, ex = f ? 32 : 34, ey = headY + 8;
  const h = { neutral: 15, focus: 10, determined: 12, tired: 6, joy: 0 }[expr] ?? 15;
  const eye = sd => { const p = new Path2D(), x = cx + sd * ex; p.moveTo(x - 20, ey); p.quadraticCurveTo(x, ey - h * 1.35, x + 20, ey); p.quadraticCurveTo(x, ey + h * 0.9, x - 20, ey); p.closePath(); return p; };
  if (layer === 'sclera') { if (h) [-1, 1].forEach(sd => { ctx.fillStyle = '#FFFFFF'; ctx.fill(eye(sd)); }); return; }
  if (layer === 'iris') {
    if (!h) return;
    [-1, 1].forEach(sd => { ctx.save(); ctx.clip(eye(sd)); ctx.fillStyle = '#DCDCDC'; ctx.fill(ellipse(cx + sd * ex, ey - 1, 9.5, 10.5)); ctx.restore(); });
    return;
  }
  [-1, 1].forEach(sd => {
    const x = cx + sd * ex;
    if (h) {
      ink(ctx, eye(sd), 3);
      stroke(ctx, [[x - 21, ey - 1], [x, ey - h * 1.4 - 3], [x + 21, ey - 1]], 5.5);
      ctx.save(); ctx.clip(eye(sd)); ctx.fillStyle = INK; ctx.fill(ellipse(x, ey - 1, 4.2, 5)); ctx.fillStyle = '#FFFFFF'; ctx.fill(ellipse(x + 3, ey - 5, 2.2, 2.2)); ctx.restore();
    } else {
      stroke(ctx, [[x - 18, ey + 2], [x, ey - 12], [x + 18, ey + 2]], 5);
    }
    const by = ey - 30, tilt = { determined: 9, focus: 5, tired: -6, joy: -3 }[expr] || 0;
    stroke(ctx, [[x - sd * 22, by - (f ? 2 : 0)], [x, by - 6], [x + sd * 20, by + tilt]], f ? 4 : 6);
  });
  stroke(ctx, [[cx - 2, headY + 30], [cx - 6, headY + 46], [cx + 4, headY + 50]], 3);
  const my = headY + 70;
  if (expr === 'joy') { const p = new Path2D(); p.moveTo(cx - 22, my - 4); p.quadraticCurveTo(cx, my + 20, cx + 22, my - 4); p.closePath(); ctx.fillStyle = INK; ctx.fill(p); }
  else if (expr === 'determined') stroke(ctx, [[cx - 16, my + 2], [cx + 2, my + 2], [cx + 18, my - 6]], 4);
  else if (expr === 'tired') stroke(ctx, [[cx - 10, my + 4], [cx, my + 2], [cx + 10, my + 4]], 3.5);
  else if (expr === 'focus') stroke(ctx, [[cx - 14, my + 2], [cx, my + 2], [cx + 14, my + 2]], 4);
  else stroke(ctx, [[cx - 16, my], [cx, my + 5], [cx + 16, my]], 3.5);
}

// ---------- Cheveux ----------
function hair(ctx, g, art, part, capped, line) {
  const { cx, headY, headRx: rx, headRy: ry } = g, top = headY - ry;
  const shapes = [];
  if (part === 'back') {
    if (art === 'long') { const p = new Path2D(); p.moveTo(cx - rx - 10, headY - 20); p.quadraticCurveTo(cx - rx - 40, headY + 160, cx - rx - 10, g.shY + 70); p.lineTo(cx + rx + 10, g.shY + 70); p.quadraticCurveTo(cx + rx + 40, headY + 160, cx + rx + 10, headY - 20); p.closePath(); shapes.push(p); }
  } else if (capped) {
    [-1, 1].forEach(sd => { const p = new Path2D(); p.moveTo(cx + sd * (rx - 4), headY - 40); p.quadraticCurveTo(cx + sd * (rx + 12), headY - 10, cx + sd * (rx + 2), headY + (art === 'long' ? 110 : 22)); p.lineTo(cx + sd * (rx - 14), headY - 10); p.closePath(); shapes.push(p); });
  } else if (art === 'curly') {
    const p = new Path2D();
    for (let i = 0; i <= 10; i++) { const a = Math.PI * (1.05 + i * 0.09), x = cx + Math.cos(a) * (rx + 6), y = headY - 18 + Math.sin(a) * (ry + 10); p.moveTo(x + 30, y); p.arc(x, y, 30, 0, Math.PI * 2); }
    p.moveTo(cx - rx, headY - 36); p.quadraticCurveTo(cx, top - 26, cx + rx, headY - 36); p.quadraticCurveTo(cx, headY - 60, cx - rx, headY - 36);
    shapes.push(p);
  } else {
    const p = new Path2D();
    p.moveTo(cx - rx - 8, headY + 6); p.quadraticCurveTo(cx - rx - 14, top - 12, cx, top - 20); p.quadraticCurveTo(cx + rx + 14, top - 12, cx + rx + 8, headY + 6);
    p.quadraticCurveTo(cx + rx - 6, headY - 40, cx + rx * 0.4, headY - ry * 0.52); p.quadraticCurveTo(cx, headY - ry * 0.4, cx - rx * 0.5, headY - ry * 0.5); p.quadraticCurveTo(cx - rx + 6, headY - 40, cx - rx - 8, headY + 6); p.closePath();
    shapes.push(p);
    if (art === 'long') [-1, 1].forEach(sd => { const s = new Path2D(); s.moveTo(cx + sd * (rx - 6), headY - 50); s.quadraticCurveTo(cx + sd * (rx + 20), headY + 60, cx + sd * (rx + 4), headY + 130); s.lineTo(cx + sd * (rx - 16), headY + 40); s.closePath(); shapes.push(s); });
    if (art === 'bun') shapes.push(ellipse(cx, top - 36, 34, 30));
  }
  shapes.forEach(p => (line ? ink(ctx, p) : shade(ctx, p, '#EDEDED', 0.18)));
}

// ---------- Barbe ----------
function beard(ctx, g, art, line) {
  const { cx, headY, headRx: rx } = g, p = new Path2D();
  p.moveTo(cx - rx + 4, headY + 10); p.quadraticCurveTo(cx - rx + 10, headY + 100, cx, headY + 108); p.quadraticCurveTo(cx + rx - 10, headY + 100, cx + rx - 4, headY + 10);
  p.lineTo(cx + rx - 18, headY + 30); p.quadraticCurveTo(cx + 30, headY + 80, cx, headY + 84); p.quadraticCurveTo(cx - 30, headY + 80, cx - rx + 18, headY + 30); p.closePath();
  if (art === 'stubble') { ctx.globalAlpha = 0.42; shade(ctx, p, '#BDBDBD', 0.05); ctx.globalAlpha = 1; return; }
  const m = new Path2D(); m.moveTo(cx - 26, headY + 62); m.quadraticCurveTo(cx, headY + 52, cx + 26, headY + 62); m.quadraticCurveTo(cx, headY + 60, cx - 26, headY + 62);
  if (line) { ink(ctx, p, 4); ink(ctx, m, 4); } else { shade(ctx, p, '#E6E6E6', 0.16); shade(ctx, m, '#E6E6E6', 0.1); }
}

// ---------- Hauts ----------
function top(ctx, g, art, line) {
  const { cx, shY } = g, shapes = [], details = [];
  if (art === 'tank') {
    const p = new Path2D(); const sh = g.sh, hi = g.hi + 6;
    p.moveTo(cx - 40, shY - 30); p.lineTo(cx - sh * 0.58, shY - 6); p.quadraticCurveTo(cx - sh * 0.62, shY + 120, cx - sh + 12, shY + 150);
    p.bezierCurveTo(cx - g.wa - 14, g.waY - 120, cx - g.wa - 6, g.waY, cx - hi, g.hiY + 24); p.lineTo(cx + hi, g.hiY + 24);
    p.bezierCurveTo(cx + g.wa + 6, g.waY, cx + g.wa + 14, g.waY - 120, cx + sh - 12, shY + 150); p.quadraticCurveTo(cx + sh * 0.62, shY + 120, cx + sh * 0.58, shY - 6); p.lineTo(cx + 40, shY - 30);
    p.quadraticCurveTo(cx, shY + 40, cx - 40, shY - 30); p.closePath(); shapes.push(p);
  } else {
    const loose = art === 'hoodie', pad = loose ? 16 : art === 'tee' ? 7 : 3;
    const sleeveTo = art === 'tee' ? shY + 160 : g.handY - 34;
    shapes.push(arm(g, -1, pad, sleeveTo), arm(g, 1, pad, sleeveTo), torso(g, pad, g.hiY + (loose ? 46 : 26)));
    const neck = new Path2D(); neck.moveTo(cx - 44, shY - 32); neck.quadraticCurveTo(cx, shY + (art === 'compression' ? -8 : 22), cx + 44, shY - 32); details.push(neck);
    if (loose) {
      const hood = new Path2D(); hood.moveTo(cx - 70, shY - 20); hood.quadraticCurveTo(cx, shY + 40, cx + 70, shY - 20); details.push(hood);
      const pocket = new Path2D(); pocket.moveTo(cx - 70, g.waY + 30); pocket.lineTo(cx + 70, g.waY + 30); pocket.lineTo(cx + 90, g.hiY + 10); pocket.lineTo(cx - 90, g.hiY + 10); pocket.closePath(); details.push(pocket);
      [-14, 14].forEach(d => { const s = new Path2D(); s.moveTo(cx + d, shY + 10); s.lineTo(cx + d * 1.3, shY + 120); details.push(s); });
      const band = new Path2D(); band.moveTo(cx - g.hi - 16, g.hiY + 22); band.lineTo(cx + g.hi + 16, g.hiY + 22); details.push(band);
    }
  }
  if (!line) { shapes.forEach(p => shade(ctx, p, '#EEEEEE', 0.16)); return; }
  shapes.forEach(p => ink(ctx, p)); details.forEach(p => ink(ctx, p, 3.5));
}

// ---------- Bas ----------
function bottom(ctx, g, art, line) {
  const short = art === 'shorts', pad = short ? 12 : 8, toY = short ? 1075 : g.ankleY - 14;
  const hip = new Path2D(); hip.moveTo(g.cx - g.hi - pad, g.hiY - 76); hip.lineTo(g.cx + g.hi + pad, g.hiY - 76); hip.lineTo(g.cx + g.hi + pad, g.hiY + 20); hip.lineTo(g.cx - g.hi - pad, g.hiY + 20); hip.closePath();
  const shapes = [hip, leg(g, -1, pad, toY), leg(g, 1, pad, toY)];
  if (!line) { shapes.forEach(p => shade(ctx, p, '#ECECEC', 0.17)); return; }
  shapes.forEach(p => ink(ctx, p));
  const band = new Path2D(); band.moveTo(g.cx - g.hi - pad, g.hiY - 50); band.lineTo(g.cx + g.hi + pad, g.hiY - 50); ink(ctx, band, 3.5);
  const fly = new Path2D(); fly.moveTo(g.cx, g.hiY - 50); fly.lineTo(g.cx, g.hiY + 40); ink(ctx, fly, 3);
  if (!short) [-1, 1].forEach(sd => { const c = new Path2D(), x = g.cx + sd * (g.hi * 0.62 - g.leg * 0.27); c.moveTo(x - g.leg * 0.55, g.ankleY - 44); c.lineTo(x + g.leg * 0.55, g.ankleY - 44); ink(ctx, c, 3); });
}

// ---------- Chaussures ----------
function shoes(ctx, g, art, line) {
  const shapes = [-1, 1].map(sd => {
    const [x, y] = footPos(g, sd), p = new Path2D(), hiTop = art === 'hightop';
    p.moveTo(x - sd * 30, y - (hiTop ? 70 : 26)); p.lineTo(x + sd * 22, y - (hiTop ? 70 : 26));
    p.quadraticCurveTo(x + sd * 56, y - 8, x + sd * 54, y + 20); p.lineTo(x - sd * 46, y + 20); p.quadraticCurveTo(x - sd * 50, y - 4, x - sd * 30, y - (hiTop ? 70 : 26)); p.closePath();
    return p;
  });
  if (!line) { shapes.forEach(p => shade(ctx, p, '#F4F4F4', 0.12)); return; }
  shapes.forEach(p => ink(ctx, p));
  [-1, 1].forEach(sd => { const [x, y] = footPos(g, sd), s = new Path2D(); s.moveTo(x - sd * 46, y + 10); s.lineTo(x + sd * 54, y + 10); ink(ctx, s, 3.5); });
}

// ---------- Accessoires ----------
function accessory(ctx, g, art, line) {
  const { cx, headY, headRx: rx, headRy: ry } = g, shapes = [];
  if (art === 'wristband') { const [x, y] = handPos(g, -1); const p = new Path2D(); p.rect(x - g.arm * 0.48, y - 66, g.arm * 0.96, 30); shapes.push(p); }
  if (art === 'earbuds') shapes.push(ellipse(cx - rx + 2, headY + 16, 9, 12), ellipse(cx + rx - 2, headY + 16, 9, 12));
  if (art === 'headband') { const p = new Path2D(); p.moveTo(cx - rx - 4, headY - 46); p.quadraticCurveTo(cx, headY - 84, cx + rx + 4, headY - 46); p.lineTo(cx + rx + 2, headY - 24); p.quadraticCurveTo(cx, headY - 62, cx - rx - 2, headY - 24); p.closePath(); shapes.push(p); }
  if (art === 'cap') { const d = new Path2D(); d.moveTo(cx - rx - 10, headY - 30); d.quadraticCurveTo(cx - rx - 6, headY - ry - 30, cx, headY - ry - 30); d.quadraticCurveTo(cx + rx + 6, headY - ry - 30, cx + rx + 10, headY - 30); d.closePath(); shapes.push(d); const b = new Path2D(); b.moveTo(cx - rx - 12, headY - 32); b.quadraticCurveTo(cx, headY - 10, cx + rx + 60, headY - 26); b.quadraticCurveTo(cx, headY - 48, cx - rx - 12, headY - 32); shapes.push(b); }
  if (art === 'chain') { const p = new Path2D(); p.moveTo(cx - 46, g.shY - 26); p.quadraticCurveTo(cx, g.shY + 90, cx + 46, g.shY - 26); p.quadraticCurveTo(cx, g.shY + 76, cx - 46, g.shY - 26); shapes.push(p, ellipse(cx, g.shY + 64, 12, 16)); }
  if (art === 'shaker') { const [x, y] = handPos(g, 1); const p = new Path2D(); p.roundRect ? p.roundRect(x - 26, y - 120, 52, 140, 12) : p.rect(x - 26, y - 120, 52, 140); shapes.push(p); const c = new Path2D(); c.rect(x - 22, y - 142, 44, 24); shapes.push(c); }
  if (!line) { shapes.forEach(p => shade(ctx, p, '#F2F2F2', 0.14)); return; }
  shapes.forEach(p => ink(ctx, p, 4));
}

class PlaceholderAssets {
  constructor(catalog, scale = 0.5) { this.W = catalog.canvas.w; this.H = catalog.canvas.h; this.k = scale; this.cache = new Map(); }
  get(src, meta) {
    if (!this.cache.has(src)) this.cache.set(src, Promise.resolve(this.paint(src, meta)));
    return this.cache.get(src);
  }
  paint(src, m) {
    const c = document.createElement('canvas'); c.width = Math.round(this.W * this.k); c.height = Math.round(this.H * this.k);
    const ctx = c.getContext('2d'); ctx.scale(this.k, this.k); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const layer = src.slice(src.lastIndexOf('_') + 1), line = layer === 'line';
    const fitStage = m.fitStage ?? m.stage;
    switch (m.slot) {
      case 'body': body(ctx, geom(m.base, m.build, m.stage), line); break;
      case 'face': face(ctx, geom(m.base, m.build, 0), m.expr, layer); break;
      case 'hair': hair(ctx, geom(m.base, m.build, 0), m.art, m.part, m.variant === '_capped', line); break;
      case 'beard': beard(ctx, geom(m.base, m.build, 0), m.art, line); break;
      case 'top': top(ctx, geom(m.base, m.build, fitStage), m.art, line); break;
      case 'bottom': bottom(ctx, geom(m.base, m.build, 3), m.art, line); break;
      case 'shoes': shoes(ctx, geom(m.base, m.build, 0), m.art, line); break;
      case 'accessory': accessory(ctx, geom(m.base, m.build, m.stage), m.art, line); break;
      default: return null;
    }
    return c;
  }
}

return { RANKS, levelFor, rankFor, rankIndex, physiqueStage, STAGE_THRESHOLDS, hashOf, itemById, isOwned, fitsBody, normalizeConfig, fillTemplate, resolveLayers, renderAvatar, ImageAssets, unlockMet, unlockLabel, evaluateUnlocks, PlaceholderAssets, geom };
})();
const AV_CAT = {"version": 1, "canvas": {"w": 1024, "h": 1536}, "palettes": {"skin": {"skin_01": "#F6DFCB", "skin_02": "#EFCFB2", "skin_03": "#E5BC97", "skin_04": "#D9A77F", "skin_05": "#C99068", "skin_06": "#B57A52", "skin_07": "#9C6440", "skin_08": "#7F4F31", "skin_09": "#643B24", "skin_10": "#4A2A19"}, "hair": {"hair_black": "#1A1512", "hair_darkbrown": "#3B2A20", "hair_brown": "#6B4A32", "hair_auburn": "#8A3F24", "hair_blonde": "#C9A46A", "hair_platinum": "#E3DCCB", "hair_silver": "#A9A9B3", "hair_violet": "#6E4BD8"}, "eyes": {"eye_brown_dark": "#4A2E1F", "eye_brown": "#7A4E2D", "eye_hazel": "#8C7A3A", "eye_green": "#3F7D5A", "eye_blue": "#3E6FA8", "eye_grey": "#7D8794"}, "cloth": {"black": "#1D1D24", "graphite": "#3D3D4A", "white": "#EDEDF2", "violet": "#7C4DEB", "lavender": "#B9A2F5", "red": "#B8333A", "navy": "#22305A", "olive": "#4F5A33", "sand": "#CDB892"}}, "body": {"layers": [{"z": 20, "src": "body/{base}_{build}_s{stage}_fill", "tint": "skin"}, {"z": 21, "src": "body/{base}_{build}_s{stage}_line", "kind": "line"}]}, "face": {"layers": [{"z": 24, "src": "face/{base}_{expr}_sclera"}, {"z": 25, "src": "face/{base}_{expr}_iris", "tint": "eyes"}, {"z": 26, "src": "face/{base}_{expr}_line", "kind": "line"}]}, "expressions": {"tired": "Au repos", "neutral": "Prêt", "focus": "Concentré", "determined": "En forme", "joy": "Dans la zone"}, "items": [{"id": "hair_m_boucles", "slot": "hair", "name": "Boucles", "rarity": "common", "bases": ["male"], "fits": ["athletic"], "unlock": {"type": "starter"}, "layers": [], "master": true}, {"id": "hair_m_rase", "slot": "hair", "name": "Rasé", "rarity": "common", "bases": ["male"], "fits": ["athletic"], "unlock": {"type": "starter"}, "layers": [], "master": true}, {"id": "top_m_debardeur", "slot": "top", "name": "Débardeur", "rarity": "common", "bases": ["male"], "fits": ["athletic"], "unlock": {"type": "starter"}, "layers": [], "master": true}, {"id": "top_m_aucun", "slot": "top", "name": "Torse nu", "rarity": "common", "bases": ["male"], "fits": ["athletic"], "unlock": {"type": "starter"}, "layers": [], "master": true}, {"id": "bottom_m_jogging", "slot": "bottom", "name": "Jogging", "rarity": "common", "bases": ["male"], "fits": ["athletic"], "unlock": {"type": "starter"}, "layers": [], "master": true}, {"id": "bottom_m_boxer", "slot": "bottom", "name": "Boxer", "rarity": "common", "bases": ["male"], "fits": ["athletic"], "unlock": {"type": "starter"}, "layers": [], "master": true}, {"id": "shoes_m_baskets", "slot": "shoes", "name": "Baskets", "rarity": "common", "bases": ["male"], "fits": ["athletic"], "unlock": {"type": "starter"}, "layers": [], "master": true}, {"id": "shoes_m_aucune", "slot": "shoes", "name": "Pieds nus", "rarity": "common", "bases": ["male"], "fits": ["athletic"], "unlock": {"type": "starter"}, "layers": [], "master": true}, {"id": "hair_short_01", "slot": "hair", "art": "short", "name": "Court", "rarity": "common", "unlock": {"type": "starter"}, "variantsFrom": ["capped"], "layers": [{"z": 60, "src": "hair/{art}_front{variant}_fill", "tint": "hair"}, {"z": 61, "src": "hair/{art}_front{variant}_line", "kind": "line"}], "bases": ["female"]}, {"id": "hair_curly_01", "slot": "hair", "art": "curly", "name": "Boucles", "rarity": "common", "unlock": {"type": "starter"}, "variantsFrom": ["capped"], "layers": [{"z": 60, "src": "hair/{art}_front{variant}_fill", "tint": "hair"}, {"z": 61, "src": "hair/{art}_front{variant}_line", "kind": "line"}], "bases": ["female"]}, {"id": "hair_long_01", "slot": "hair", "art": "long", "name": "Long", "rarity": "rare", "unlock": {"type": "level", "value": 5}, "variantsFrom": ["capped"], "layers": [{"z": 10, "src": "hair/{art}_back_fill", "tint": "hair", "part": "back"}, {"z": 11, "src": "hair/{art}_back_line", "kind": "line", "part": "back"}, {"z": 60, "src": "hair/{art}_front{variant}_fill", "tint": "hair"}, {"z": 61, "src": "hair/{art}_front{variant}_line", "kind": "line"}], "bases": ["female"]}, {"id": "hair_bun_01", "slot": "hair", "art": "bun", "name": "Chignon", "rarity": "rare", "unlock": {"type": "rank", "value": "D"}, "variantsFrom": ["capped"], "layers": [{"z": 60, "src": "hair/{art}_front{variant}_fill", "tint": "hair"}, {"z": 61, "src": "hair/{art}_front{variant}_line", "kind": "line"}], "bases": ["female"]}, {"id": "beard_none", "slot": "beard", "art": "none", "name": "Aucune", "rarity": "common", "unlock": {"type": "starter"}, "layers": [], "bases": ["male", "female"]}, {"id": "beard_stubble_01", "slot": "beard", "art": "stubble", "name": "Trois jours", "rarity": "common", "bases": ["female"], "unlock": {"type": "starter"}, "layers": [{"z": 28, "src": "beard/{art}_fill", "tint": "beard"}]}, {"id": "beard_short_01", "slot": "beard", "art": "short", "name": "Barbe courte", "rarity": "rare", "bases": ["female"], "unlock": {"type": "level", "value": 8}, "layers": [{"z": 28, "src": "beard/{art}_fill", "tint": "beard"}, {"z": 29, "src": "beard/{art}_line", "kind": "line"}]}, {"id": "top_tee_01", "slot": "top", "art": "tee", "name": "T-shirt", "rarity": "common", "unlock": {"type": "starter"}, "stageVariants": true, "colorways": ["black", "white", "graphite", "navy"], "layers": [{"z": 40, "src": "top/{art}_{base}_{build}_s{fitStage}_fill", "tint": "colorway"}, {"z": 41, "src": "top/{art}_{base}_{build}_s{fitStage}_line", "kind": "line"}], "bases": ["female"]}, {"id": "top_tank_01", "slot": "top", "art": "tank", "name": "Débardeur", "rarity": "common", "unlock": {"type": "starter"}, "stageVariants": true, "colorways": ["black", "graphite", "white"], "layers": [{"z": 40, "src": "top/{art}_{base}_{build}_s{fitStage}_fill", "tint": "colorway"}, {"z": 41, "src": "top/{art}_{base}_{build}_s{fitStage}_line", "kind": "line"}], "bases": ["female"]}, {"id": "top_compression_01", "slot": "top", "art": "compression", "name": "Haut de compression", "rarity": "rare", "unlock": {"type": "counter", "counter": "sessions_total", "gte": 24, "label": "24 séances validées"}, "stageVariants": true, "colorways": ["black", "graphite", "navy"], "layers": [{"z": 40, "src": "top/{art}_{base}_{build}_s{fitStage}_fill", "tint": "colorway"}, {"z": 41, "src": "top/{art}_{base}_{build}_s{fitStage}_line", "kind": "line"}], "bases": ["female"]}, {"id": "top_hoodie_01", "slot": "top", "art": "hoodie", "name": "Sweat du rang C", "rarity": "rare", "unlock": {"type": "rank", "value": "C"}, "hides": ["acc:neck"], "colorways": ["black", "violet", "lavender", "graphite"], "layers": [{"z": 40, "src": "top/{art}_{base}_{build}_fill", "tint": "colorway"}, {"z": 41, "src": "top/{art}_{base}_{build}_line", "kind": "line"}], "bases": ["female"]}, {"id": "top_tank_signature", "slot": "top", "art": "tank", "name": "Débardeur signature rang A", "rarity": "epic", "unlock": {"type": "rank", "value": "A"}, "stageVariants": true, "colorways": ["violet", "lavender"], "layers": [{"z": 40, "src": "top/{art}_{base}_{build}_s{fitStage}_fill", "tint": "colorway"}, {"z": 41, "src": "top/{art}_{base}_{build}_s{fitStage}_line", "kind": "line"}], "bases": ["female"]}, {"id": "bottom_jogger_01", "slot": "bottom", "art": "jogger", "name": "Jogging", "rarity": "common", "unlock": {"type": "starter"}, "colorways": ["black", "graphite", "navy", "olive"], "layers": [{"z": 32, "src": "bottom/{art}_{base}_{build}_fill", "tint": "colorway"}, {"z": 33, "src": "bottom/{art}_{base}_{build}_line", "kind": "line"}], "bases": ["female"]}, {"id": "bottom_shorts_01", "slot": "bottom", "art": "shorts", "name": "Short", "rarity": "common", "unlock": {"type": "starter"}, "colorways": ["black", "graphite", "navy"], "layers": [{"z": 32, "src": "bottom/{art}_{base}_{build}_fill", "tint": "colorway"}, {"z": 33, "src": "bottom/{art}_{base}_{build}_line", "kind": "line"}], "bases": ["female"]}, {"id": "bottom_jogger_elite", "slot": "bottom", "art": "jogger", "name": "Jogging Élite", "rarity": "legendary", "unlock": {"type": "rank", "value": "S"}, "colorways": ["violet", "black"], "layers": [{"z": 32, "src": "bottom/{art}_{base}_{build}_fill", "tint": "colorway"}, {"z": 33, "src": "bottom/{art}_{base}_{build}_line", "kind": "line"}], "bases": ["female"]}, {"id": "shoes_runner_01", "slot": "shoes", "art": "runner", "name": "Running", "rarity": "common", "unlock": {"type": "starter"}, "colorways": ["white", "black", "violet"], "layers": [{"z": 30, "src": "shoes/{art}_{base}_{build}_fill", "tint": "colorway"}, {"z": 31, "src": "shoes/{art}_{base}_{build}_line", "kind": "line"}], "bases": ["female"]}, {"id": "shoes_hightop_01", "slot": "shoes", "art": "hightop", "name": "Montantes", "rarity": "rare", "unlock": {"type": "level", "value": 10}, "colorways": ["black", "white", "red"], "layers": [{"z": 30, "src": "shoes/{art}_{base}_{build}_fill", "tint": "colorway"}, {"z": 31, "src": "shoes/{art}_{base}_{build}_line", "kind": "line"}], "bases": ["female"]}, {"id": "acc_wristband_01", "slot": "accessory", "accSlot": "wrist_right", "art": "wristband", "name": "Bracelet éponge", "rarity": "common", "unlock": {"type": "starter"}, "colorways": ["black", "white", "violet"], "layers": [{"z": 45, "src": "acc/{art}_{base}_{build}_s{stage}_fill", "tint": "colorway"}, {"z": 46, "src": "acc/{art}_{base}_{build}_s{stage}_line", "kind": "line"}], "bases": ["female"]}, {"id": "acc_earbuds_01", "slot": "accessory", "accSlot": "ears", "art": "earbuds", "name": "Écouteurs", "rarity": "common", "unlock": {"type": "level", "value": 3}, "colorways": ["white", "black"], "layers": [{"z": 62, "src": "acc/{art}_{base}_fill", "tint": "colorway"}, {"z": 63, "src": "acc/{art}_{base}_line", "kind": "line"}], "bases": ["female"]}, {"id": "acc_headband_01", "slot": "accessory", "accSlot": "head", "art": "headband", "name": "Bandeau", "rarity": "rare", "unlock": {"type": "counter", "counter": "sessions_hautB", "gte": 10, "label": "10 séances Haut B"}, "colorways": ["black", "violet", "red"], "layers": [{"z": 64, "src": "acc/{art}_{base}_fill", "tint": "colorway"}, {"z": 65, "src": "acc/{art}_{base}_line", "kind": "line"}], "bases": ["female"]}, {"id": "acc_cap_01", "slot": "accessory", "accSlot": "head", "art": "cap", "name": "Casquette", "rarity": "rare", "unlock": {"type": "level", "value": 15}, "sets": ["capped"], "colorways": ["black", "violet", "navy"], "layers": [{"z": 70, "src": "acc/{art}_{base}_fill", "tint": "colorway"}, {"z": 71, "src": "acc/{art}_{base}_line", "kind": "line"}], "bases": ["female"]}, {"id": "acc_chain_01", "slot": "accessory", "accSlot": "neck", "art": "chain", "name": "Chaîne", "rarity": "epic", "unlock": {"type": "rank", "value": "B"}, "colorways": ["sand", "white"], "layers": [{"z": 45, "src": "acc/{art}_{base}_fill", "tint": "colorway"}, {"z": 46, "src": "acc/{art}_{base}_line", "kind": "line"}], "bases": ["female"]}, {"id": "acc_shaker_01", "slot": "accessory", "accSlot": "hand", "art": "shaker", "name": "Shaker", "rarity": "rare", "unlock": {"type": "counter", "counter": "protein_days", "gte": 20, "label": "20 jours de protéines"}, "colorways": ["violet", "black"], "layers": [{"z": 80, "src": "acc/{art}_{base}_{build}_s{stage}_fill", "tint": "colorway"}, {"z": 81, "src": "acc/{art}_{base}_{build}_s{stage}_line", "kind": "line"}], "bases": ["female"]}], "defaultConfig": {"schemaVersion": 1, "base": "male", "body": {"build": "athletic", "heightClass": "tall", "physiqueStage": 0}, "skin": {"tone": "skin_06"}, "face": {"eyeColor": "eye_brown_dark"}, "hair": {"item": "hair_m_boucles", "color": "hair_black"}, "beard": {"item": "beard_none", "color": "inherit"}, "top": {"item": "top_m_debardeur", "colorway": null}, "bottom": {"item": "bottom_m_jogging", "colorway": null}, "shoes": {"item": "shoes_m_baskets", "colorway": null}, "accessories": []}};
