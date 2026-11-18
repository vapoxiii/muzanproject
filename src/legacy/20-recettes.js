// ---- Livre de recettes (Nutrition) ----
// On écrit une recette une fois : ses ingrédients (pris dans Mes aliments, scannés ou créés), le nombre
// de parts, la préparation si on veut. Quand on la refait, un geste suffit pour en noter une part.
// Chaque recette a son aliment « 1 part » dans Mes aliments (u '1 part', rec = id de la recette) : elle se
// note comme un aliment, et on la retrouve dans la recherche et les aliments fréquents.
// Calculs et règles : src/nutrition/recettes.js (RCP). Entrées : les ustensiles de la cuisine, la balance.
let recettes = [];
let RC_BOOK = null;    // le livre ouvert : { draw }
let RC_SCAN = null;    // ingrédient attendu du scanner : fonction(ingrédient)

function loadRecettes() {
  let v = null;
  try { v = JSON.parse(sget('recettes') || '[]'); } catch (e) { v = []; }
  recettes = (Array.isArray(v) ? v : []).map(RCP.cleanRecipe).filter(Boolean);
}
function saveRecettes() { try { sset('recettes', JSON.stringify(recettes)); } catch (e) {} }
function recById(id) { return recettes.find((r) => r.id === id) || null; }

const recParts = (x) => frNum(x) + ' part' + (x >= 2 ? 's' : '');
const recGr = (x) => (x == null ? '–' : nf(x) + ' g');
const recMac = (v) => 'P ' + recGr(v.p) + ' · G ' + recGr(v.g) + ' · L ' + recGr(v.l);
const recMacS = (v) => 'P ' + nf(v.p) + ' · G ' + (v.g == null ? '–' : nf(v.g)) + ' · L ' + (v.l == null ? '–' : nf(v.l));
const RC_SCAN_IC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8V5.5A1.5 1.5 0 0 1 4.5 4H7M17 4h2.5A1.5 1.5 0 0 1 21 5.5V8M21 16v2.5a1.5 1.5 0 0 1-1.5 1.5H17M7 20H4.5A1.5 1.5 0 0 1 3 18.5V16"/><path d="M7 9v6M10.5 9v6M13.5 9v6M17 9v6"/></svg>';
const RC_CHEV = '<svg width="8" height="13" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5 6.5 6.5l-5 5" stroke="currentColor" stroke-width="1.7" fill="none"/></svg>';
// « 250 g », « 400 ml », « 1 œuf », « 3 × 1 œuf »
function recQtyLabel(it) {
  const a = RCP.unitAmount(it.u);
  if (a) return frNum(RCP.shownQty(it)) + ' ' + a.unit;
  return it.q === 1 ? it.u : frNum(it.q) + ' × ' + it.u;
}

// L'aliment « 1 part » de la recette, d'après ses ingrédients. Déjà noté dans une journée et changé :
// l'ancien reste (old) pour que ces jours gardent leurs calories.
function recFoodSync(r) {
  const plan = RCP.planFood(r, foodlib, foodlog);
  if (plan.retire) { const o = foodById(plan.retire); if (o) o.old = 1; }
  if (plan.create) { const f = Object.assign({ id: RCP.newId('r') }, plan.create); foodlib.push(f); r.fid = f.id; }
  else { const f = foodById(plan.update); Object.assign(f, plan.values); delete f.old; }
  saveFoodlib();
}
// Noter des parts d'une recette dans le jour affiché (aujourd'hui depuis la cuisine)
function recLog(r, parts) {
  let f = r.fid ? foodById(r.fid) : null;
  if (!f || f.old) { recFoodSync(r); saveRecettes(); f = foodById(r.fid); }
  const arr = dayEntries().slice(), e = arr.find((x) => x.fid === f.id);
  if (e) e.q = Math.round((e.q + parts) * 100) / 100; else arr.push({ fid: f.id, q: parts });
  setDayEntries(arr); renderMeals();
  TRUI.toast(r.n + ' : ' + recParts(parts) + ' notée' + (parts >= 2 ? 's' : '') + ', ' + nf(f.k * parts) + ' kcal');
}
function recLogById(id, parts) { const r = recById(id); if (r) recLog(r, parts || 1); }
function recDelete(id) {
  recettes = recettes.filter((r) => r.id !== id); saveRecettes();
  // son aliment : gardé (caché) s'il a été noté, pour les jours passés ; retiré sinon
  foodlib.forEach((f) => { if (f.rec === id && RCP.usedIn(foodlog, f.id)) f.old = 1; });
  foodlib = foodlib.filter((f) => f.rec !== id || f.old);
  saveFoodlib(); renderMeals();
}

// La balance : les recettes les plus faites, une part en un geste, puis le livre
function recScaleHtml() {
  const n = recettes.length;
  let h = '';
  if (n) {
    const top = RCP.favorites(recettes, RCP.usage(foodlog, foodlib), 4);
    h += '<p class="kz-rc-t">Refaire une recette</p><div class="kz-rc-l" role="group" aria-label="Noter une part d’une recette">' +
      top.map((r) => { const k = RCP.perPart(r).k; return '<button type="button" class="qchip" data-rc="' + esc(r.id) + '" aria-label="' + esc('Noter une part de ' + r.n + ', ' + nf(k) + ' kcal') + '">' + esc(r.n) + '<small>' + nf(k) + '</small></button>'; }).join('') +
      '</div>';
  }
  h += '<button type="button" class="kz-rcrow" data-k="book">Mes recettes<span>' + (n ? n + ' recette' + (n > 1 ? 's' : '') : 'écris la première') + '</span>' + RC_CHEV + '</button>';
  return '<div class="kz-rc">' + h + '</div>';
}

// ---------- le livre ----------
function openRecipeBook() {
  if (RC_BOOK) return;
  let q = '';
  const node = document.createElement('div'); node.className = 'pe rc-book';
  node.innerHTML = '<div class="pe-top"><button type="button" class="pe-ico" data-act="close" aria-label="Fermer">' + TRUI.ICON.close + '</button><span class="pe-tt">Nutrition</span><button type="button" class="pe-ok" data-act="new">Nouvelle</button></div>' +
    '<div class="pe-body"><h1 class="pe-t">Mes recettes</h1><p class="pe-s rc-sub"></p>' +
    '<label class="pk-q rc-search" hidden>' + TRUI.ICON.search + '<input type="search" placeholder="Une recette, un ingrédient…" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="Chercher une recette"></label>' +
    '<div class="rc-wrap"></div></div>';
  const sub = node.querySelector('.rc-sub'), wrap = node.querySelector('.rc-wrap'), sbox = node.querySelector('.rc-search'), sin = sbox.querySelector('input');
  const close = TRUI.openLayer(node, { sheet: false, label: 'Mes recettes', onClose: () => { RC_BOOK = null; } });
  const card = (r) => {
    const pp = RCP.perPart(r);
    return '<div class="rc-card"><button type="button" class="rc-open" data-open="' + esc(r.id) + '"><b>' + esc(r.n) + '</b>' +
      '<span>' + esc(nf(pp.k) + ' kcal la part · ' + nf(pp.p) + ' g de protéines · ' + recParts(r.parts)) + '</span></button>' +
      '<button type="button" class="rc-log" data-log="' + esc(r.id) + '" aria-label="' + esc('Noter une part de ' + r.n) + '">' + TRUI.ICON.plus + '</button></div>';
  };
  function draw() {
    const all = RCP.sortRecipes(recettes), n = all.length;
    sub.textContent = n ? n + ' recette' + (n > 1 ? 's' : '') + ' · touche + pour noter une part' : 'Ton livre de recettes';
    sbox.hidden = n < 6;
    if (sbox.hidden && q) { q = ''; sin.value = ''; }
    if (!n) {
      wrap.innerHTML = '<div class="rc-empty"><p class="rc-empty-t">Écris tes recettes une fois.</p>' +
        '<p class="rc-empty-p">Tes ingrédients et le nombre de parts : je calcule ce que vaut une part. Quand tu la refais, un geste suffit pour l’ajouter à ta journée.</p>' +
        '<button type="button" class="tr-btn wide" data-act="new">Écrire ma première recette</button></div>';
      return;
    }
    const list = RCP.searchRecipes(all, q);
    wrap.innerHTML = (list.length ? '<div class="grp rc-list">' + list.map(card).join('') + '</div>' : '<p class="pe-note">Aucune recette ne correspond.</p>') +
      '<button type="button" class="pe-add" data-act="new">' + TRUI.ICON.plus + '<span>Nouvelle recette</span></button>';
  }
  node.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'close') { close(); return; }
    if (act === 'new') { openRecipeEditor(null); return; }
    if (b.dataset.open) { openRecipeSheet(b.dataset.open); return; }
    if (b.dataset.log) {
      recLogById(b.dataset.log, 1);
      b.classList.add('done'); b.innerHTML = TRUI.ICON.check;
      clearTimeout(b._t); b._t = setTimeout(() => { b.classList.remove('done'); b.innerHTML = TRUI.ICON.plus; }, 1400);
    }
  });
  let st = null;
  sin.addEventListener('input', () => { clearTimeout(st); st = setTimeout(() => { q = sin.value; draw(); }, 60); });
  sin.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sin.blur(); } });
  RC_BOOK = { draw };
  draw();
}

// ---------- une recette : la lire, en noter des parts ----------
function openRecipeSheet(id) {
  const r = recById(id); if (!r) return;
  const pp = RCP.perPart(r);
  let parts = 1;
  const node = document.createElement('div'); node.className = 'sheet tr-sheet rc-sheet';
  node.innerHTML = '<div class="sheeth"><span class="st">' + esc(r.n) + '</span><button type="button" data-act="close" aria-label="Fermer">' + TRUI.ICON.close + '</button></div>' +
    '<p class="rc-sh-s">Pour ' + esc(recParts(r.parts)) + ' · <b>' + nf(pp.k) + ' kcal</b> la part</p>' +
    '<p class="rc-sh-m">' + esc(recMac(pp)) + '</p>' +
    '<p class="pe-lab">Ingrédients</p>' +
    '<ul class="rc-ings">' + r.items.map((it) => '<li><span>' + esc(it.n) + '</span><b>' + esc(recQtyLabel(it)) + '</b></li>').join('') + '</ul>' +
    (r.prep ? '<p class="pe-lab">Préparation</p><p class="rc-prep">' + esc(r.prep).replace(/\n/g, '<br>') + '</p>' : '') +
    '<div class="rc-eat"><div class="qty" role="group" aria-label="Parts mangées"><button type="button" data-d="-1" aria-label="Une demi-part de moins">−</button><span aria-live="polite"></span><button type="button" data-d="1" aria-label="Une demi-part de plus">+</button></div>' +
    '<button type="button" class="tr-btn rc-eat-go" data-act="eat"></button></div>' +
    '<button type="button" class="tr-btn ghost wide rc-edit" data-act="edit">' + TRUI.ICON.edit + '<span>Modifier la recette</span></button>';
  const close = TRUI.openLayer(node, { label: r.n });
  const qn = node.querySelector('.rc-eat .qty span'), go = node.querySelector('.rc-eat-go');
  const upd = () => { qn.textContent = recParts(parts); go.textContent = 'Ajouter · ' + nf(pp.k * parts) + ' kcal'; };
  node.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.d) { parts = Math.min(10, Math.max(0.5, parts + (+b.dataset.d) * 0.5)); upd(); return; }
    const act = b.dataset.act;
    if (act === 'close') close();
    else if (act === 'eat') { close(); recLog(r, parts); }
    else if (act === 'edit') { close(); openRecipeEditor(r.id); }
  });
  upd();
}

// ---------- écrire ou modifier une recette ----------
function openRecipeEditor(id) {
  const src = id ? recById(id) : null;
  const R = src ? RCP.cleanRecipe(JSON.parse(JSON.stringify(src))) : { id: RCP.newId('rc'), n: '', parts: 1, items: [], prep: '', at: Date.now() };
  let dirty = false;
  const node = document.createElement('div'); node.className = 'pe rc-ed';
  node.innerHTML = '<div class="pe-top"><button type="button" class="pe-ico" data-act="close" aria-label="Fermer">' + TRUI.ICON.close + '</button><span class="pe-tt">' + (src ? 'Modifier la recette' : 'Nouvelle recette') + '</span><button type="button" class="pe-ok" data-act="save">Enregistrer</button></div>' +
    '<div class="pe-body">' +
      '<label class="xs-name rc-name"><span>Nom de la recette</span><input type="text" maxlength="60" autocomplete="off" enterkeyhint="done" placeholder="Ex. Bolo maison, porridge protéiné…"></label>' +
      '<div class="rc-parts"><div><p class="rc-parts-k">Pour combien de parts ?</p><p class="pe-note">Une part, c’est ce que tu manges en une fois.</p></div>' +
        '<div class="qty" role="group" aria-label="Nombre de parts"><button type="button" data-pd="-1" aria-label="Une part de moins">−</button><span aria-live="polite"></span><button type="button" data-pd="1" aria-label="Une part de plus">+</button></div></div>' +
      '<p class="pe-lab">Ingrédients</p>' +
      '<div class="rc-ings-ed"></div>' +
      '<button type="button" class="pe-add" data-act="add">' + TRUI.ICON.plus + '<span>Ajouter un ingrédient</span></button>' +
      '<div class="rc-tot" aria-live="polite"></div>' +
      '<p class="pe-lab">Préparation <span class="rc-opt">· facultatif</span></p>' +
      '<textarea class="rc-prep-in" rows="4" maxlength="4000" placeholder="Les étapes, la cuisson, une astuce…" aria-label="Préparation"></textarea>' +
      (src ? '<button type="button" class="pe-del" data-act="del">Supprimer la recette</button>' : '') +
    '</div>';
  const nameIn = node.querySelector('.rc-name input'), partsEl = node.querySelector('.rc-parts .qty span');
  const ings = node.querySelector('.rc-ings-ed'), tot = node.querySelector('.rc-tot'), prepIn = node.querySelector('.rc-prep-in');
  nameIn.value = R.n; prepIn.value = R.prep;
  const label = src ? 'Modifier la recette' : 'Nouvelle recette';
  const tryClose = async () => {
    if (dirty && !(await TRUI.ask({ title: 'Quitter sans enregistrer ?', text: 'Tes changements dans cette recette seront perdus.', ok: 'Quitter', cancel: 'Rester', danger: true }))) return;
    closeEd();
  };
  const closeEd = TRUI.openLayer(node, { sheet: false, label, guard: tryClose });

  const ingMeta = (it) => { const v = RCP.itemValues(it); return nf(v.k) + ' kcal · ' + recMacS(v); };
  function row(it, i) {
    const a = RCP.unitAmount(it.u), how = a ? (a.unit === 'g' ? 'en grammes' : 'en millilitres') : 'en portions de ' + it.u;
    return '<div class="rc-ing" data-i="' + i + '"><span class="rc-ing-t"><b>' + esc(it.n) + '</b><span>' + esc(ingMeta(it)) + '</span></span>' +
      '<label class="rc-qi' + (a ? '' : ' n') + '"><input type="text" inputmode="decimal" autocomplete="off" value="' + esc(frNum(RCP.shownQty(it))) + '" aria-label="' + esc('Quantité de ' + it.n + ', ' + how) + '"><span>' + esc(a ? a.unit : '× ' + it.u) + '</span></label>' +
      '<button type="button" class="rc-x" data-x="' + i + '" aria-label="' + esc('Retirer ' + it.n) + '">' + TRUI.ICON.close + '</button></div>';
  }
  function drawTot() {
    if (!R.items.length) { tot.innerHTML = '<p class="pe-note">Ajoute tes ingrédients : je calcule la recette entière et une part.</p>'; return; }
    const t = RCP.totals(R.items), pp = RCP.perPart(R);
    tot.innerHTML = '<div class="rc-tot-c"><p class="rc-tot-k">Une part</p><p class="rc-tot-v"><b>' + nf(pp.k) + '</b> kcal</p><p class="rc-tot-m">' + esc(recMac(pp)) + '</p></div>' +
      '<p class="rc-tot-all">Toute la recette : ' + nf(t.k) + ' kcal · ' + esc(recMacS(t)) + '</p>' +
      (t.sans.length ? '<p class="rc-warn">Glucides et lipides inconnus pour ' + esc(t.sans.join(', ')) + ' : ils ne sont pas comptés.</p>' : '');
  }
  function drawIngs(focus) {
    ings.innerHTML = R.items.length ? R.items.map(row).join('') : '<p class="rc-none">Aucun ingrédient pour l’instant.</p>';
    drawTot();
    if (focus == null) return;
    const inp = ings.querySelector('.rc-ing[data-i="' + focus + '"] input');
    if (inp) { try { inp.focus({ preventScroll: true }); inp.select(); inp.closest('.rc-ing').scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }
  }
  const drawParts = () => { partsEl.textContent = R.parts; };

  function save() {
    const n = nameIn.value.trim();
    if (!n) { TRUI.toast('Donne un nom à ta recette'); try { nameIn.focus(); } catch (e) {} return; }
    if (!R.items.length) { TRUI.toast('Ajoute au moins un ingrédient'); return; }
    const miss = R.items.findIndex((it) => !(it.q > 0));
    if (miss >= 0) {
      TRUI.toast('Indique la quantité : ' + R.items[miss].n);
      const inp = ings.querySelector('.rc-ing[data-i="' + miss + '"] input'); if (inp) try { inp.focus(); } catch (e) {}
      return;
    }
    R.n = n.slice(0, 60); R.prep = prepIn.value.trim().slice(0, 4000); R.parts = RCP.clampParts(R.parts);
    recFoodSync(R);
    const i = recettes.findIndex((x) => x.id === R.id);
    if (i >= 0) recettes[i] = R; else recettes.push(R);
    saveRecettes(); renderMeals();
    dirty = false; closeEd();
    TRUI.toast(src ? 'Recette enregistrée' : 'Recette ajoutée à ton livre');
    if (RC_BOOK) RC_BOOK.draw();
  }
  async function del() {
    const ok = await TRUI.ask({ title: 'Supprimer « ' + src.n + ' » ?', text: 'Les jours où tu l’as notée gardent leurs calories.', ok: 'Supprimer', danger: true });
    if (!ok) return;
    recDelete(R.id); dirty = false; closeEd();
    TRUI.toast('Recette supprimée');
    if (RC_BOOK) RC_BOOK.draw();
  }

  ings.addEventListener('input', (e) => {
    const inp = e.target.closest('.rc-qi input'); if (!inp) return;
    const el = inp.closest('.rc-ing'), it = R.items[+el.dataset.i]; if (!it) return;
    const v = parseNum(inp.value);
    it.q = v == null ? 0 : RCP.qtyFromShown(it, v);
    el.querySelector('.rc-ing-t span').textContent = ingMeta(it);
    dirty = true; drawTot();
  });
  ings.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); e.target.blur(); } });
  nameIn.addEventListener('input', () => { dirty = true; });
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nameIn.blur(); } });
  prepIn.addEventListener('input', () => { dirty = true; });
  node.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pd) { R.parts = RCP.clampParts(R.parts + (+b.dataset.pd)); dirty = true; drawParts(); drawTot(); return; }
    if (b.dataset.x != null) { R.items.splice(+b.dataset.x, 1); dirty = true; drawIngs(); return; }
    const act = b.dataset.act;
    if (act === 'close') tryClose();
    else if (act === 'save') save();
    else if (act === 'del') del();
    else if (act === 'add') openIngredientPicker(R, (first) => { if (first != null) { dirty = true; drawIngs(first); } });
  });
  drawParts(); drawIngs();
  if (!src) setTimeout(() => { try { nameIn.focus({ preventScroll: true }); } catch (e) {} }, 80);
}

// ---------- ajouter des ingrédients : Mes aliments, un produit scanné, un aliment créé ----------
// onDone(i) : i = rang du premier ingrédient ajouté (null si aucun), pour y régler la quantité
function openIngredientPicker(R, onDone) {
  const before = R.items.length, mine = new Map();   // id d'aliment → ingrédient ajouté pendant cette ouverture
  let q = '', creating = false;
  const node = document.createElement('div'); node.className = 'sheet tr-sheet pk rc-pk';
  node.innerHTML = '<div class="sheeth"><span class="st">Ajouter des ingrédients</span><button type="button" class="pk-done" data-act="close">Terminé</button></div>' +
    '<label class="pk-q">' + TRUI.ICON.search + '<input type="search" placeholder="Chercher dans mes aliments…" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="Chercher un aliment"></label>' +
    '<div class="rc-pk-acts"><button type="button" class="tr-btn ghost sm" data-act="scan">' + RC_SCAN_IC + '<span>Scanner un produit</span></button><button type="button" class="tr-btn ghost sm" data-act="new">' + TRUI.ICON.plus + '<span>Créer un aliment</span></button></div>' +
    '<p class="pk-n" aria-live="polite"></p><div class="pk-res"></div><div class="pk-new"></div>';
  const close = TRUI.openLayer(node, { label: 'Ajouter des ingrédients', onClose: () => onDone(R.items.length > before ? before : null) });
  const input = node.querySelector('.pk-q input'), res = node.querySelector('.pk-res'), count = node.querySelector('.pk-n'), nw = node.querySelector('.pk-new');
  // les aliments les plus notés d'abord ; ni les recettes, ni les repas décrits une seule fois
  const use = {};
  for (const d in foodlog) for (const e of foodlog[d] || []) if (e) use[e.fid] = (use[e.fid] || 0) + 1;
  const foods = () => {
    const f0 = RCP.fold(q).trim();
    return foodlib.filter((f) => !f.old && !f.rec && !String(f.id).startsWith('tmp') && (!f0 || RCP.fold(f.n).includes(f0)))
      .sort((a, b) => (use[b.id] || 0) - (use[a.id] || 0) || String(a.n).localeCompare(String(b.n), 'fr', { sensitivity: 'base' }));
  };
  const item = (f) => {
    const on = mine.has(f.id);
    return '<button type="button" class="pk-it' + (on ? ' on' : '') + '" data-f="' + esc(f.id) + '" aria-pressed="' + on + '"><span class="pk-t"><b>' + esc(f.n) + '</b>' +
      '<span>' + esc(f.u + ' · ' + f.k + ' kcal · ' + macLine(f, 1)) + '</span></span><span class="pk-add" aria-hidden="true">' + (on ? TRUI.ICON.check : TRUI.ICON.plus) + '</span></button>';
  };
  const form = (name) => '<div class="pk-form rc-new"><p class="pe-lab">Nouvel aliment <span class="rc-opt">· valeurs d’une portion, comme sur l’étiquette</span></p>' +
    '<input type="text" class="rc-nf-n" maxlength="60" placeholder="Nom (ex. Lait de coco)" value="' + esc(name) + '" aria-label="Nom de l’aliment">' +
    '<div class="nf4"><input type="text" inputmode="numeric" class="rc-nf-k" placeholder="kcal" aria-label="Calories"><input type="text" inputmode="decimal" class="rc-nf-p" placeholder="prot. g" aria-label="Protéines en grammes">' +
    '<input type="text" inputmode="decimal" class="rc-nf-g" placeholder="gluc. g" aria-label="Glucides en grammes"><input type="text" inputmode="decimal" class="rc-nf-l" placeholder="lip. g" aria-label="Lipides en grammes"></div>' +
    '<input type="text" class="rc-nf-u" maxlength="30" value="100 g" placeholder="Portion (ex. 100 g, 1 pot)" aria-label="Portion">' +
    '<button type="button" class="tr-btn wide" data-act="create">Créer et ajouter</button></div>';
  function draw() {
    const list = foods();
    count.textContent = mine.size ? mine.size + ' ajouté' + (mine.size > 1 ? 's' : '') + ' · quantités à régler dans la recette'
      : list.length ? 'Touche un aliment pour l’ajouter' : 'Aucun aliment trouvé';
    res.innerHTML = list.map(item).join('');
    const qt = input.value.trim();
    nw.innerHTML = creating ? form(qt) : (!list.length && qt.length >= 2 ? '<button type="button" class="tr-btn ghost wide" data-act="new">' + TRUI.ICON.plus + '<span>Créer « ' + esc(qt) + ' »</span></button>' : '');
  }
  function create() {
    const v = (c) => node.querySelector(c).value;
    const n = v('.rc-nf-n').trim(), k = parseNum(v('.rc-nf-k'));
    if (!n || k == null) { TRUI.toast(!n ? 'Donne un nom à l’aliment' : 'Indique ses calories'); return; }
    const p = parseNum(v('.rc-nf-p')), g = parseNum(v('.rc-nf-g')), l = parseNum(v('.rc-nf-l'));
    const f = { id: 'c' + Date.now(), n: n.slice(0, 60), k: Math.round(k), p: p == null ? 0 : p, g, l, u: v('.rc-nf-u').trim().slice(0, 30) || '1 portion' };
    foodlib.push(f); saveFoodlib();
    const it = RCP.itemFrom(f, 1); R.items.push(it); mine.set(f.id, it);
    creating = false; q = ''; input.value = ''; draw();
    TRUI.toast(f.n + ' : ajouté à la recette et à tes aliments');
  }
  let t = null;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { q = input.value; creating = false; draw(); }, 60); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  node.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'close') { close(); return; }
    if (act === 'new') { creating = true; draw(); const f = node.querySelector('.rc-nf-n'); if (f) { try { f.focus(); } catch (er) {} } return; }
    if (act === 'create') { create(); return; }
    if (act === 'scan') {
      // le produit scanné arrive dans la recette, avec la quantité choisie au scanner
      RC_SCAN = (it) => { R.items.push(it); onDone(R.items.length - 1); };
      close(); scanOpen('recette');
      return;
    }
    if (b.dataset.f) {
      const id = b.dataset.f;
      if (mine.has(id)) { const i = R.items.indexOf(mine.get(id)); if (i >= 0) R.items.splice(i, 1); mine.delete(id); }
      else { const f = foodById(id); if (!f) return; const it = RCP.itemFrom(f, 1); R.items.push(it); mine.set(id, it); }
      draw();
    }
  });
  draw();
}

// Le scanner, pour une recette : le produit rejoint Mes aliments (pour 100 g, réutilisable) et la recette,
// avec la quantité choisie. La fenêtre du scanner passe alors au-dessus de la recette.
const _scanOpenRC = scanOpen;
scanOpen = function (mode) {
  document.getElementById('scanner').classList.toggle('rc-top', mode === 'recette');
  if (mode !== 'recette') RC_SCAN = null;
  return _scanOpenRC.apply(this, arguments);
};
const _scanRenderRC = scanRender;
scanRender = function () {
  _scanRenderRC.apply(this, arguments);
  if (scanMode === 'recette') { const b = document.getElementById('scanAdd'); if (b) b.textContent = 'Ajouter à la recette'; }
};
const _scanConfirmRC = scanConfirm;
scanConfirm = function (qty) {
  if (scanMode !== 'recette') return _scanConfirmRC.apply(this, arguments);
  const P = scanProd; if (!P) return;
  const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
  let f = foodlib.find((x) => x.bc === P.code && x.u === '100 g' && !x.old);
  if (!f) {
    f = { id: 'c' + Date.now(), n: P.name.length > 38 ? P.name.slice(0, 36) + '…' : P.name, k: Math.round(P.k), p: r1(P.p), g: r1(P.g), l: r1(P.l), u: '100 g', bc: P.code };
    foodlib.push(f); saveFoodlib();
  }
  const cb = RC_SCAN; RC_SCAN = null;
  scanStop();
  if (cb) cb(RCP.itemFrom(f, qty / 100));
};

loadRecettes();
document.getElementById('kzBook').onclick = () => { goToday(); openRecipeBook(); };
