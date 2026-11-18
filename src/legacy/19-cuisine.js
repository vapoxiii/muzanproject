// ---- La cuisine de la Nutrition ----
// L'ambiance suit le soleil (jour, coucher de soleil, nuit : src/nutrition/kitchen.js, sous le nom KIT) ;
// la balance affiche les calories notées aujourd'hui et, touchée, propose les façons de noter un repas ;
// les bocaux ouvrent « Mes aliments ».
let KZ_T = null;
function renderKitchen() {
  const hub = document.getElementById('nutHub'), img = document.getElementById('kzImg'); if (!hub || !img) return;
  const now = new Date(), k = KIT.kitchenFor(now);
  hub.setAttribute('data-moment', k.moment); hub.setAttribute('data-ambiance', k.ambiance);
  if (img.getAttribute('src') !== k.src) img.src = k.src;
  const tt = todayTotals(), v = document.getElementById('kzVal');
  if (v) v.querySelector('b').textContent = nf(tt.k);
  document.getElementById('kzScale').setAttribute('aria-label', 'La balance : ' + nf(tt.k) + ' kcal notées aujourd’hui. Ajouter ce que tu as mangé');
  // mise à jour pile au prochain changement d'ambiance (au plus tard dans 6 h)
  clearTimeout(KZ_T);
  const nx = KIT.nextChange(now); KZ_T = setTimeout(renderKitchen, nx ? Math.min(nx.getTime() - now.getTime() + 1000, 6 * 3600e3) : 6 * 3600e3);
}
const _rnhKZ = renderNutritionHub;
renderNutritionHub = function () { _rnhKZ(); try { renderKitchen(); } catch (e) { console.error(e); } };
document.addEventListener('visibilitychange', () => { if (!document.hidden) try { renderKitchen(); } catch (e) {} });

// La balance : « Qu'as-tu mangé ? » — photo, code-barres, recherche, description ; tes recettes (une
// part en un geste, le livre : 20-recettes.js) ; puis les repas du jour
function kitchenScaleSheet() {
  goToday();
  const tt = todayTotals(), tg = todayTarget(), left = tg.t - tt.k, n = (foodlog[todayStr()] || []).length;
  const svg = (act) => { const t = document.querySelector('#nutHub .ph-tile[data-act="' + act + '"] i'); return t ? t.innerHTML : ''; };
  const ai = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.6 4.3 4.4 1.6-4.4 1.6L12 15.3l-1.6-4.3L6 9.4l4.4-1.6zM18.5 14.5l.8 2.1 2.2.8-2.2.8-.8 2.1-.8-2.1-2.2-.8 2.2-.8z"/></svg>';
  const node = document.createElement('div'); node.className = 'sheet kz-sheet';
  node.innerHTML = '<div class="sheeth"><span class="st">Qu’as-tu mangé&nbsp;?</span><button type="button" aria-label="Fermer" data-k="x">✕</button></div>' +
    '<p class="kz-sum"><b>' + nf(tt.k) + ' kcal</b> notées aujourd’hui · ' + (left >= 0 ? 'il te reste ' + nf(left) + ' kcal' : 'objectif dépassé de ' + nf(-left) + ' kcal') + '</p>' +
    '<div class="kz-acts">' +
      '<button type="button" class="main" data-k="photo"><i>' + svg('photo') + '</i><span><b>Photo du plat</b><small>Je liste ton assiette</small></span></button>' +
      '<button type="button" data-k="scan"><i>' + svg('scan') + '</i><span><b>Scanner</b><small>Code-barres</small></span></button>' +
      '<button type="button" data-k="add"><i>' + svg('add') + '</i><span><b>Chercher</b><small>Tes aliments</small></span></button>' +
      '<button type="button" data-k="ai"><i>' + ai + '</i><span><b>Décrire</b><small>En quelques mots</small></span></button>' +
    '</div>' +
    recScaleHtml() +
    '<button type="button" class="kz-meals" data-k="meals">Mes repas du jour<span>' + (n ? n + ' noté' + (n > 1 ? 's' : '') : 'aucun encore') + '</span><svg width="8" height="13" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5 6.5 6.5l-5 5" stroke="currentColor" stroke-width="1.7" fill="none"/></svg></button>';
  const close = TRUI.openLayer(node, { label: 'La balance : ajouter ce que tu as mangé' });
  node.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k],[data-rc]'); if (!b) return;
    const k = b.dataset.k; close();
    if (b.dataset.rc) recLogById(b.dataset.rc, 1);
    else if (k === 'photo') aiPhotoPick();
    else if (k === 'scan') scanOpen('meal');
    else if (k === 'add') openPicker();
    else if (k === 'ai') document.getElementById('aibtn').click();
    else if (k === 'book') openRecipeBook();
    else if (k === 'meals') openSub('nutrition', 'repas', true);
  });
}
document.getElementById('kzScale').onclick = kitchenScaleSheet;
document.getElementById('kzJars').onclick = () => { goToday(); openPicker(); };
// à l'arrivée dans la Nutrition, l'heure a pu changer : on relit l'ambiance ; et une première fois au lancement
const _svKZ = showView;
showView = function (v) { const r = _svKZ.apply(this, arguments); if (v === 'nutrition') try { renderKitchen(); } catch (e) { console.error(e); } return r; };
try { renderKitchen(); } catch (e) { console.error(e); }
