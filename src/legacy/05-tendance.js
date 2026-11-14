// ===== Calories adaptatives : la base au repos s'ajuste chaque semaine sur la tendance du poids =====
// Calcul dans src/body/trend.js (TB). Ici : repas et objectif de chaque jour, carte de la Nutrition,
// décision enregistrée (clé « calcheck », synchronisée) pour ne reproposer qu'une semaine plus tard.

function calIntakeByDay(){
  const out={};
  Object.keys(foodlog).forEach(d=>{
    let k=0; (foodlog[d]||[]).forEach(e=>{ const f=foodById(e.fid); if(f)k+=f.k*e.q; });
    out[d]={k:Math.round(k),target:calbase+dayBonus(dayact[d])};
  });
  return out;
}
function calProfile(){ try{ return JSON.parse(sget('profile')||'null')||{}; }catch(e){ return {}; } }
function calLast(){ try{ const v=JSON.parse(sget('calcheck')||'null'); return v&&typeof v==='object'?v:null; }catch(e){ return null; } }
function calCheckNow(){
  const p=calProfile();
  return TB.calorieCheck({ bodylog:bodylog, intake:calIntakeByDay(), today:todayStr(), goal:p.goal||'forme', calbase:calbase,
    mainSessions:TR.mainSessions(PROGRAM).length, sportWeek:sportWeekKcal(), weight:p.weight||null });
}
// Dépense des sports prévus dans la semaine (natation comprise), pour le bilan
function sportWeekKcal(){
  const w=weightNow(); let k=0;
  TR.sportsList(PROGRAM).forEach(e=>{ k+=TR.sportKcal(TR.sportOf(e),w)*e.days.length; });
  return k;
}
function calDayLabel(d){ return TB.parseDay(d).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}); }
const calNf=n=>Math.round(n).toLocaleString('fr-FR');

// Rappel discret dans Repas (point sur « Objectif » et une ligne) quand une proposition attend
function calNotice(r){
  const note=document.getElementById('calNote'), dot=document.getElementById('calDot');
  const on=!!r&&r.status==='ok'&&!!r.delta;
  if(dot)dot.hidden=!on;
  if(note){ note.hidden=!on; if(on)note.innerHTML='<span>Nouvelle base proposée : <b>'+calNf(r.to)+' kcal</b></span><svg width="7" height="11" viewBox="0 0 7 11" aria-hidden="true"><path d="M1.5 1.5 5.5 5.5 1.5 9.5" stroke="currentColor" stroke-width="1.7" fill="none"/></svg>'; }
}
function renderCalAdj(){
  const el=document.getElementById('calAdj'); if(!el)return;
  if(weekOffset!==0){ el.hidden=true; calNotice(null); return; }
  const r=calCheckNow(), last=calLast(), today=todayStr();
  el.hidden=false; el.className='caladj';
  calNotice(null);
  if(r.status==='pesees'){
    el.classList.add('info');
    el.innerHTML='<h2 class="ca-k">Ajustement chaque semaine</h2><p class="ca-p">Pèse-toi au moins 4 fois sur 3 semaines : chaque semaine, l’app comparera ta tendance à ton objectif et proposera d’ajuster ta base.</p>';
    return;
  }
  const goal=TB.GOAL_LABEL[r.goal]||r.goal;
  const head='<p class="ca-p">Ta tendance : <b>'+TB.fmtRate(r.rate)+'</b> par semaine. '+(r.desired?'Pour une '+goal+', on vise <b>'+TB.fmtRate(r.desired)+'</b>.':'Objectif '+goal+' : on vise la stabilité.')+'</p>';
  const how='<details class="ca-d"><summary>Comment c’est calculé</summary><p>'+(r.method==='bilan'
    ?'Sur les 3 dernières semaines, tu as noté tes repas '+r.days+' jours. Ce que tu manges, corrigé de l’évolution de ton poids (7 700 kcal par kilo), donne ta dépense réelle. On retire l’écart visé par ton objectif, puis le bonus moyen des jours d’entraînement.'
    :'Moins de 14 jours de repas notés sur 3 semaines : on ne peut pas mesurer ta dépense. On corrige alors la moitié de l’écart entre ta vitesse et la vitesse visée.')
    +' La base ne bouge jamais de plus de 200 kcal d’un coup.</p></details>';
  if(!TB.checkDue(last,today)){
    el.classList.add('info');
    const next=calDayLabel(TB.shiftDay(last.d,7));
    el.innerHTML='<h2 class="ca-k">Ajustement de la semaine</h2><p class="ca-p">'+(last.act==='apply'?'Base ajustée à <b>'+calNf(last.to)+' kcal</b>':'Base gardée à <b>'+calNf(last.from)+' kcal</b>')+'. Prochain point '+esc(next)+'.</p>';
    return;
  }
  if(!r.delta){
    el.classList.add('info');
    el.innerHTML='<h2 class="ca-k">Ajustement de la semaine</h2><p class="ca-p">Tu es dans le rythme : on garde <b>'+calNf(calbase)+' kcal</b>.</p>'+head+how;
    return;
  }
  calNotice(r);
  const tdee=r.method==='bilan'?'<p class="ca-p">Dépense estimée : <b>'+calNf(r.tdee)+' kcal</b> par jour, sur '+r.days+' jours de repas notés.</p>':'';
  el.innerHTML='<h2 class="ca-k">Ajustement de la semaine</h2>'
    +'<p class="ca-n"><span class="ca-l">Base proposée</span><s>'+calNf(r.from)+'</s><b>'+nfD(r.to)+'</b><span class="ca-u">kcal</span><span class="ca-dl">'+(r.delta>0?'+':'−')+Math.abs(r.delta)+'</span></p>'
    +head+tdee
    +'<div class="ca-b"><button type="button" data-ca="apply">Appliquer</button><button type="button" data-ca="keep">Garder '+calNf(r.from)+'</button></div>'+how;
}
document.getElementById('calNote').addEventListener('click',()=>showSub('nutrition','objectif'));

document.getElementById('calAdj').addEventListener('click',e=>{
  const b=e.target.closest('[data-ca]'); if(!b)return;
  const r=calCheckNow(); if(r.status!=='ok')return;
  const last=calLast()||{}, rec={d:todayStr(),act:b.dataset.ca,from:r.from,to:b.dataset.ca==='apply'?r.to:r.from,rate:r.rate,tdee:r.tdee,method:r.method};
  rec.hist=[{d:rec.d,act:rec.act,from:rec.from,to:rec.to}].concat(Array.isArray(last.hist)?last.hist:[]).slice(0,12);
  sset('calcheck',JSON.stringify(rec));
  if(rec.act==='apply'){ calbase=rec.to; saveCalbase(); TRUI.toast('Base passée à '+calNf(rec.to)+' kcal'); }
  else TRUI.toast('On garde '+calNf(rec.from)+' kcal. Prochain point dans 7 jours.');
  renderMeals();
});

const _rmCa=renderMeals; renderMeals=function(){ _rmCa(); try{ renderCalAdj(); }catch(e){ console.error(e); } };
const _rbCa=renderBody; renderBody=function(){ _rbCa(); try{ renderCalAdj(); }catch(e){ console.error(e); } };
renderCalAdj();
