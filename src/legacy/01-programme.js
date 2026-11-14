// ---- Programme d'entraînement ----
// Avant le constructeur, les séances étaient écrites ici en dur. Elles sont maintenant dans le
// stockage (clé « program », synchronisée) ; sans programme enregistré, c'est le programme
// d'origine (Haut A, Bas A, Haut B, Bas B, Bras Express), à l'identique : src/training/program.js.
// Chaque semaine garde un instantané de son programme (state.prog) : voir src/training/week.js.
let PROGRAM=TR.parseProgram(sget('program'));
let PROG_SNAP=TR.snapshotOf(PROGRAM);
function planOfSnap(snap){ return TR.planOf({sessions:snap.s.filter(s=>!s.gone),sports:TR.snapSports(snap)}); }
function setProgram(p){
  PROGRAM=TR.normalizeProgram(p); PROG_SNAP=TR.snapshotOf(PROGRAM);
  try{ sset('program',JSON.stringify(PROGRAM)); }catch(e){}
}
const DAYS=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const HABITS=[{k:'crea',l:'Créatine (3-5 g)'},{k:'eau',l:'Eau (2-3 L)'},{k:'legumes',l:'Légumes / fruits'}];
const CHECK='<svg viewBox="0 0 20 20" fill="none"><path d="M4 10.5l4 4 8-9" stroke="#15101F" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ---- Stockage : sget / sset / sdel / skeys viennent de src/core/storage.js (IndexedDB, cache synchrone) ----
