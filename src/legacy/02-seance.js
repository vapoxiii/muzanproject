// ===== Séance : séries (charge × répétitions), minuteur et écran de repos, accès au constructeur de programme =====
// (fichier placé avant 02-semaine.js : ses fonctions servent dès le premier affichage)
// Les séries d'un exercice sont dans la semaine : state.log[idExercice] = { x, d, s: [{ w, r }] }.
// Toucher le nom d'un exercice ouvre ses séries, pré-remplies avec la dernière fois ;
// valider la dernière série prévue coche l'exercice (même XP qu'avant).

const LG={open:null,drafts:{},extra:{},cache:new Map()};
const LG_IC={
  chev:'<svg width="12" height="8" viewBox="0 0 14 9" aria-hidden="true"><path d="M1 1.5l6 6 6-6" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
  up:'<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gear:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  check:'<svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const LG_BODY=new Set(['pdc','elastique','anneaux']);

function lgKey(){ return keyFor(weekOffset).k; }
function lgDraftKey(ex){ return lgKey()+'|'+ex.id; }
// Journal des séries de toutes les semaines enregistrées ; la semaine affichée est lue en direct
function lgWeeks(){
  const out=[], cur=lgKey();
  skeys().forEach(k=>{
    if(k.indexOf('fitweek:')!==0||k===cur)return;
    const raw=sget(k); if(!raw)return;
    let c=LG.cache.get(k);
    if(!c||c.raw!==raw){ let log={}; try{ const o=JSON.parse(raw); if(o&&o.log&&typeof o.log==='object')log=o.log; }catch(e){} c={raw:raw,st:{log:log}}; LG.cache.set(k,c); }
    out.push({k:k,st:c.st});
  });
  if(state)out.push({k:cur,st:state});
  return out;
}
function lgDate(s){
  if(weekOffset===0)return todayStr();
  const m=new Date(keyFor(weekOffset).monday); m.setDate(m.getDate()+((s.days&&s.days.length)?s.days[0]:0));
  return m.getFullYear()+'-'+String(m.getMonth()+1).padStart(2,'0')+'-'+String(m.getDate()).padStart(2,'0');
}
function lgPlanned(ex){ return Math.max(1,(ex.sets||3)*(ex.each?2:1)); }
function lgStep(ex){ return ex.mode==='t'?5:ex.mode==='d'?5:1; }
function lgUnit(ex){ return ex.mode==='t'?'s':ex.mode==='d'?'m':'reps'; }
function lgShort(ex,set){
  if(!set)return '';
  if(ex.mode==='t')return TR.fmtSec(Math.round(set.r||0));
  if(ex.mode==='d')return (set.w>0?TR.fmtKg(set.w)+' kg · ':'')+(set.r||0)+' m';
  return set.w>0?TR.fmtKg(set.w)+' kg':(set.r||0)+' reps';
}

// ---- Ligne d'exercice dans une séance ----
function exRowEl(s,ex,i){
  const frag=document.createDocumentFragment();
  const on=!!state.training[s.id][i], open=LG.open===ex.id;
  const row=document.createElement('div'); row.className='row ex-row'+(open?' open':''); row.dataset.eid=ex.id;
  row.appendChild(chkBtn(on,()=>{state.training[s.id][i]=!state.training[s.id][i];save();render();}));
  const info=document.createElement('div'); info.className='exi'; info.setAttribute('role','button'); info.tabIndex=0;
  info.setAttribute('aria-expanded',String(open)); info.setAttribute('aria-label',ex.n+', '+TR.describe(ex)+(open?', fermer les séries':', noter les séries'));
  const tag=ex.a?'<span class="pri">'+esc(TR.zoneLabel(ex,PROGRAM))+'</span>':'';
  info.innerHTML=`<div class="en${ex.a?' armt':''}">${esc(ex.n)}${tag}</div><div class="ed">${esc(TR.describe(ex))}</div>`;
  info.onclick=()=>{ LG.open=open?null:ex.id; render(); if(!open)lgScroll(ex.id); };
  info.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); info.onclick(); } };
  row.appendChild(info);
  const entry=state.log[ex.id], n=entry?entry.s.length:0;
  let chip='';
  if(n)chip='<span class="ex-chip done">'+n+'/'+lgPlanned(ex)+'</span>';
  else{ const last=TR.lastEntry(ex.x,lgWeeks(),{exceptKey:lgKey(),exceptId:ex.id,before:weekOffset===0?null:lgDate(s)}); if(last)chip='<span class="ex-chip">'+esc(lgShort(ex,last.s[0]))+'</span>'; }
  const go=document.createElement('span'); go.className='ex-go'; go.setAttribute('aria-hidden','true'); go.innerHTML=chip+LG_IC.chev;
  go.onclick=()=>info.onclick();
  row.appendChild(go);
  frag.appendChild(row);
  if(open)frag.appendChild(loggerEl(s,ex,i));
  return frag;
}
function lgScroll(eid){
  setTimeout(()=>{ const r=document.querySelector('#v-training .ex-row[data-eid="'+CSS.escape(eid)+'"]'); if(!r||!r.getBoundingClientRect)return;
    const b=r.getBoundingClientRect(); if(b.top<70||b.bottom>window.innerHeight*0.45){ try{ window.scrollBy({top:b.top-90,behavior:REDUCED?'auto':'smooth'}); }catch(e){} } },40);
}

// ---- Séries d'un exercice ----
function lgContext(s,ex){
  const cur=lgKey(), x=TR.exoOf(ex,PROGRAM), weeks=lgWeeks();
  const entry=state.log[ex.id], done=entry?entry.s:[];
  const last=TR.lastEntry(ex.x,weeks,{exceptKey:cur,exceptId:ex.id,before:weekOffset===0?null:lgDate(s)});
  const sg=TR.suggest(ex,last,x);
  const best=TR.bestValues(ex.x,ex.mode,weeks,{exceptKey:cur,exceptId:ex.id});
  return {cur:cur,x:x,entry:entry,done:done,last:last,sg:sg,best:best};
}
// Valeurs proposées pour la série j (pas encore faite) : brouillon, sinon dernière fois / conseil ;
// la charge suit celle de la dernière série faite aujourd'hui
function lgPending(ex,c,j){
  const d=(LG.drafts[lgDraftKey(ex)]||{})[j];
  if(d)return d;
  const base=c.sg.sets[Math.min(j,c.sg.sets.length-1)]||{w:null,r:null};
  const prev=c.done[c.done.length-1];
  return {w:prev?prev.w:base.w, r:(prev&&c.sg.kind==='first')?prev.r:base.r};
}
function loggerEl(s,ex,i){
  const c=lgContext(s,ex), n=Math.max(lgPlanned(ex),c.done.length)+(LG.extra[lgDraftKey(ex)]||0);
  const rec=TR.recordIndex(ex.mode,c.done,c.best);
  const body=c.x&&LG_BODY.has(c.x.e), perHand=c.x&&(c.x.e==='halteres'||c.x.e==='kb');
  let info;
  if(c.last) info='Dernière fois, '+esc(TR.fmtDateShort(c.last.d))+' : <b>'+esc(TR.fmtSets(ex.mode,c.last.s))+'</b>';
  else if(ex.mode==='t') info='Première fois : note ton temps à chaque série.';
  else if(ex.mode==='d') info='Première fois : note la distance et la charge.';
  else info='Première fois : '+(ex.lo!=null&&!ex.max?'prends une charge que tu tiens '+(ex.hi??ex.lo)+' fois.':'note ta charge et tes répétitions.');
  let tip='';
  if(c.sg.kind==='up') tip='<p class="lg-tip up">'+LG_IC.up+'<span>+'+esc(TR.fmtKg(c.sg.step))+' kg aujourd’hui : tu as fait '+ex.hi+' partout la dernière fois.</span></p>';
  else if(c.sg.kind==='top') tip='<p class="lg-tip">Tu as fait '+ex.hi+' partout la dernière fois : ajoute une répétition ou du lest.</p>';
  const unit=lgUnit(ex), uName=ex.mode==='t'?'Secondes':ex.mode==='d'?'Mètres':'Répétitions';
  let rows='';
  for(let j=0;j<n;j++){
    const isDone=j<c.done.length, isNext=j===c.done.length, v=isDone?c.done[j]:lgPending(ex,c,j);
    const canOk=isDone?j===c.done.length-1:isNext;
    rows+=`<div class="ls${isDone?' done':''}${isNext?' next':''}${rec===j?' rec':''}" data-i="${j}">
      <span class="ls-n">${j+1}</span>
      <label class="ls-w"><input type="text" inputmode="decimal" data-f="w" value="${v.w!=null?esc(TR.fmtKg(v.w)):''}" placeholder="${body?'PDC':''}" aria-label="Charge en kilos${perHand?' par '+(c.x.e==='kb'?'kettlebell':'haltère'):''}, série ${j+1}" autocomplete="off" enterkeyhint="done"></label>
      <div class="ls-r"><button type="button" class="ls-st" data-st="-1" aria-label="${uName} : moins, série ${j+1}">−</button><input type="text" inputmode="numeric" data-f="r" value="${v.r!=null?esc(String(v.r)):''}" placeholder="${esc(ex.mode==='r'&&ex.lo!=null&&!ex.max?String(ex.lo):'')}" aria-label="${uName}, série ${j+1}" autocomplete="off" enterkeyhint="done"><button type="button" class="ls-st" data-st="1" aria-label="${uName} : plus, série ${j+1}">+</button></div>
      <button type="button" class="ls-ok" data-ok aria-pressed="${isDone}" aria-label="${isDone?'Annuler la série '+(j+1):'Valider la série '+(j+1)}"${canOk?'':' disabled'}>${LG_IC.check}</button>
      ${rec===j?'<span class="ls-rec">Record</span>':''}</div>`;
  }
  const el=document.createElement('div'); el.className='lg'; el.dataset.eid=ex.id; el.dataset.sid=s.id; el.dataset.i=i;
  const wHead=body?'Lest (kg)':perHand?'Kg par '+(c.x.e==='kb'?'kettlebell':'haltère'):'Charge (kg)';
  // le geste, illustré : à gauche du rappel de la dernière fois ; un toucher l'ouvre en grand
  const ill=TR.illusSrc(ex.x);
  const top=ill?`<div class="lg-top"><button type="button" class="lg-ill" data-lg="ill" aria-label="${esc('Voir le geste en grand : '+ex.n)}"><img src="${esc(ill)}" alt="" decoding="async"><span>${TRUI.ICON.zoom}</span></button><div class="lg-tx"><p class="lg-last">${info}</p>${tip}</div></div>`:`<p class="lg-last">${info}</p>${tip}`;
  el.innerHTML=`${top}
    <div class="ls ls-hd" aria-hidden="true"><span></span><span>${wHead}</span><span>${unit==='reps'?'Répétitions':unit==='s'?'Secondes':'Mètres'}</span><span></span></div>
    <div class="lg-sets">${rows}</div>
    <div class="lg-foot"><button type="button" class="lg-add" data-lg="add">+ Série</button>
      <span class="lg-goal">Objectif ${esc(TR.describe(ex))} · repos ${esc(TR.fmtRest(ex.rest))}</span>
      ${weekOffset===0&&!s.gone?'<button type="button" class="lg-cfg" data-lg="cfg" aria-label="Réglages de l’exercice">'+LG_IC.gear+'</button>':''}</div>`;
  return el;
}

function lgFind(node){
  const lg=node.closest('.lg'); if(!lg)return null;
  const s=state.prog.s.find(x=>x.id===lg.dataset.sid); if(!s)return null;
  const ex=s.ex.find(x=>x.id===lg.dataset.eid); if(!ex)return null;
  return {lg:lg,s:s,ex:ex,i:+lg.dataset.i};
}
function lgRowVals(row){
  return {w:TR.parseNum(row.querySelector('[data-f="w"]').value), r:TR.parseNum(row.querySelector('[data-f="r"]').value)};
}
function lgSetDraft(ex,j,v){ const k=lgDraftKey(ex); (LG.drafts[k]=LG.drafts[k]||{})[j]=v; }

// Valider la série suivante, ou annuler la dernière faite
function lgOk(f,row){
  const j=+row.dataset.i, entry=state.log[f.ex.id], done=entry?entry.s:[];
  if(j<done.length){
    if(j!==done.length-1)return;
    done.pop();
    if(!done.length)delete state.log[f.ex.id];
    if(entry&&entry.auto&&done.length<lgPlanned(f.ex)){ state.training[f.s.id][f.i]=false; delete entry.auto; }
    save(); render(); return;
  }
  if(j!==done.length)return;
  const v=lgRowVals(row);
  if(!(v.r>0)){ const inp=row.querySelector('[data-f="r"]'); row.classList.remove('err'); void row.offsetWidth; row.classList.add('err'); if(inp)inp.focus(); return; }
  if(v.w!=null&&v.w<0)v.w=null;
  restAudio();
  const c=lgContext(f.s,f.ex);
  const wasRec=TR.recordIndex(f.ex.mode,c.done.slice(),c.best)>=0;
  const isRec=!wasRec&&TR.recordIndex(f.ex.mode,[{w:v.w,r:v.r}],c.best)===0;
  const e=state.log[f.ex.id]||(state.log[f.ex.id]={x:f.ex.x,d:lgDate(f.s),s:[]});
  e.x=f.ex.x; e.d=lgDate(f.s); e.s.push({w:v.w,r:v.r});
  const dk=lgDraftKey(f.ex); if(LG.drafts[dk]){ delete LG.drafts[dk][j]; }
  let next=null;
  if(e.s.length===lgPlanned(f.ex)){
    if(!state.training[f.s.id][f.i]){ state.training[f.s.id][f.i]=true; e.auto=true; }
    // exercice terminé : on ouvre le suivant pas encore fait
    next=f.s.ex.find((x,k)=>k>f.i&&!state.training[f.s.id][k])||null;
    LG.open=next?next.id:null;
  }
  save(); render();
  if(next)lgScroll(next.id);
  if(isRec)TRUI.toast('Record : '+TR.fmtSets(f.ex.mode,[{w:v.w,r:v.r}]));
  if(f.ex.rest>0)restStart(f.ex.rest,{sid:f.s.id,eid:f.ex.id});
}

const trView=document.getElementById('v-training');
trView.addEventListener('click',e=>{
  const st=e.target.closest('[data-st]');
  if(st){
    const f=lgFind(st); if(!f)return;
    const row=st.closest('.ls'), inp=row.querySelector('[data-f="r"]'), j=+row.dataset.i;
    const cur=TR.parseNum(inp.value)||0, nv=Math.max(0,cur+(+st.dataset.st)*lgStep(f.ex));
    inp.value=String(nv);
    const entry=state.log[f.ex.id];
    if(entry&&j<entry.s.length){ entry.s[j].r=nv; save(); render(); }
    else lgSetDraft(f.ex,j,lgRowVals(row));
    return;
  }
  const ok=e.target.closest('[data-ok]');
  if(ok){ const f=lgFind(ok); if(f)lgOk(f,ok.closest('.ls')); return; }
  const b=e.target.closest('[data-lg]');
  if(b){
    const f=lgFind(b); if(!f)return;
    if(b.dataset.lg==='add'){ const k=lgDraftKey(f.ex); LG.extra[k]=(LG.extra[k]||0)+1; render(); return; }
    if(b.dataset.lg==='cfg'){ TRUI.openExerciseSheet(progCtx(),f.s.id,f.ex.id); return; }
    if(b.dataset.lg==='ill'){ TRUI.openIllus(f.ex.x,{name:f.ex.n}); return; }
  }
});
trView.addEventListener('change',e=>{
  const inp=e.target.closest('.ls input'); if(!inp)return;
  const f=lgFind(inp); if(!f)return;
  const row=inp.closest('.ls'), j=+row.dataset.i, v=lgRowVals(row), entry=state.log[f.ex.id];
  if(entry&&j<entry.s.length){ if(inp.dataset.f==='r'&&!(v.r>0)){ render(); return; } entry.s[j]={w:v.w,r:v.r}; save(); render(); }
  else lgSetDraft(f.ex,j,v);
});
trView.addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  const inp=e.target.closest('.ls input'); if(!inp)return;
  e.preventDefault(); inp.blur();
});

// ---- Minuteur de repos : la barre au-dessus de la maison, et l'écran de repos de Ren ----
// Un seul minuteur (TR.createRestTimer) : une heure de fin, pas un décompte, donc aucune dérive si
// l'app ralentit ou passe en arrière-plan. La barre et l'écran le lisent tous les deux.
const REST={timer:TR.createRestTimer(),t:null,el:null,ac:null,doneT:null,info:null,screen:null};
function restEl(){
  if(REST.el)return REST.el;
  const d=document.createElement('div'); d.id='restBar'; d.className='trest'; d.hidden=true; d.setAttribute('role','timer'); d.setAttribute('aria-label','Repos');
  d.innerHTML='<div class="trest-in"><button type="button" class="trest-t" data-rest="open" aria-label="Ouvrir l’écran de repos"><span class="trest-k">Repos</span><b class="trest-v">0:00</b></button><div class="trest-b"><button type="button" data-rest="-15" aria-label="15 secondes de moins">−15 s</button><button type="button" data-rest="15" aria-label="15 secondes de plus">+15 s</button><button type="button" data-rest="skip" class="trest-skip">Passer</button></div><i class="trest-p" aria-hidden="true"></i></div>';
  d.addEventListener('click',e=>{
    const b=e.target.closest('[data-rest]'); if(!b)return;
    if(b.dataset.rest==='skip'){ restStop(); return; }
    if(b.dataset.rest==='open'){ if(REST.t!=null)restScreenOpen(); return; }
    REST.timer.add((+b.dataset.rest)*1000); restTick();
  });
  document.body.appendChild(d); REST.el=d; return d;
}
// info : la série qui vient d'être validée ({ sid, eid }) ; avec elle, Ren tend son poignet
function restStart(sec,info){
  const d=restEl(); clearTimeout(REST.doneT); d.classList.remove('fin'); d.querySelector('.trest-k').textContent='Repos';
  REST.timer.start(sec*1000); REST.info=info||null; d.hidden=false;
  document.documentElement.classList.add('trest-on');
  requestAnimationFrame(()=>d.classList.add('on'));
  clearInterval(REST.t); REST.t=setInterval(restTick,250); restTick();
  if(REST.info)restScreenOpen();
}
function restTick(){
  const d=REST.el; if(!d||REST.t==null)return;
  const left=REST.timer.left(), s=Math.ceil(left/1000), paused=REST.timer.paused;
  d.querySelector('.trest-v').textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  d.querySelector('.trest-k').textContent=paused?'En pause':'Repos';
  d.classList.toggle('paused',paused);
  d.querySelector('.trest-p').style.transform='scaleX('+REST.timer.progress().toFixed(4)+')';
  if(REST.timer.done)restDone();
}
function restDone(){
  clearInterval(REST.t); REST.t=null;
  // fini pendant que l'app était cachée : pas de bip en retard au retour
  const late=REST.timer.overdue()>3000;
  const d=REST.el; d.classList.add('fin'); d.classList.remove('paused'); d.querySelector('.trest-k').textContent='C’est reparti'; d.querySelector('.trest-v').textContent='';
  if(!late){ restBeep(); try{ if(navigator.vibrate)navigator.vibrate([120,80,120]); }catch(e){} }
  if(REST.screen&&REST.screen.open)REST.screen.finish();
  REST.doneT=setTimeout(restStop,2600);
}
function restStop(){
  clearInterval(REST.t); REST.t=null; clearTimeout(REST.doneT); REST.timer.stop();
  if(REST.screen&&REST.screen.open)REST.screen.close();
  REST.screen=null;
  const d=REST.el; if(!d)return;
  d.classList.remove('on','fin','paused'); document.documentElement.classList.remove('trest-on');
  setTimeout(()=>{ if(!d.classList.contains('on'))d.hidden=true; },220);
}
// au retour dans l'app : le temps restant est relu tout de suite (et la fin annoncée si elle est passée)
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&REST.t!=null)restTick(); });

// L'écran de repos (src/training/ui/rest.js) : sa montre, ses commandes, la suite de la séance
function restScreenOpen(){
  if(REST.screen&&REST.screen.open)return;
  REST.screen=TRUI.openRestScreen({
    timer:REST.timer, data:restScreenData,
    onToggle:()=>{ REST.timer.toggle(); restTick(); },
    onRestart:()=>{ REST.timer.restart(); restTick(); },
    onSkip:()=>restStop(),
    onNext:()=>restGoNext(),
    onClose:()=>{ REST.screen=null; },
  });
}
// « 3 × 6–10 reps », « Série 3 sur 4 · 6–10 reps »
function restReps(t,ex){ return t.replace(/(\d)-(\d)/g,'$1–$2')+(ex.mode==='r'&&ex.lo!=null&&!ex.max&&!ex.each?' reps':''); }
function restScreenData(){
  const inf=REST.info, s=inf&&state.prog.s.find(x=>x.id===inf.sid); if(!s)return {progress:[],next:null};
  const flags=state.training[s.id]||[];
  const sets=(ex)=>{ const e=state.log[ex.id]; return e?e.s.length:0; };
  const progress=s.ex.map((ex,k)=>flags[k]?1:Math.min(1,sets(ex)/lgPlanned(ex)));
  const ci=s.ex.findIndex(x=>x.id===inf.eid), cur=s.ex[ci];
  const where=s.name+(ci>=0?' · exercice '+(ci+1)+' sur '+s.ex.length:'');
  if(cur&&!flags[ci]&&sets(cur)<lgPlanned(cur)){
    const n=sets(cur), p=lgPlanned(cur), tg=TR.targetText(cur);
    return {progress, where, next:{kind:'set', id:cur.id, name:cur.n, detail:'Série '+(n+1)+' sur '+p+(tg?' · '+restReps(tg,cur):''), img:TR.illusSrc(cur.x)}};
  }
  const nx=s.ex.find((x,k)=>k>ci&&!flags[k])||s.ex.find((x,k)=>k!==ci&&!flags[k]);
  if(nx)return {progress, where, next:{kind:'exercise', id:nx.id, name:nx.n, detail:restReps(TR.describe(nx),nx), img:TR.illusSrc(nx.x)}};
  return {progress, where, next:{kind:'end', name:'Séance terminée', detail:'Tous les exercices sont faits. Bravo.', img:null}};
}
// la carte du prochain exercice : retour à la séance, ses séries ouvertes ; le repos continue dans la barre
function restGoNext(){
  const d=restScreenData(), n=d.next; if(!n||!n.id)return;
  if(REST.screen&&REST.screen.open)REST.screen.close();
  if(REST.info&&REST.info.sid)openSession(REST.info.sid,{keep:true});
  LG.open=n.id; render(); lgScroll(n.id);
}
// Le son : sur iPhone, Web Audio est coupé par le bouton silencieux (session « ambient »). On demande une
// session « transient » (sons brefs, la musique baisse un instant puis reprend) quand Safari le permet,
// et l'AudioContext est créé et débloqué au toucher (iOS ne joue rien sans geste de l'utilisateur).
function restAudio(){
  try{ if(navigator.audioSession&&navigator.audioSession.type!=='transient')navigator.audioSession.type='transient'; }catch(e){}
  try{
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return;
    if(!REST.ac||REST.ac.state==='closed')REST.ac=new AC();
    if(REST.ac.state!=='running')REST.ac.resume();
    // un son muet joué pendant le geste débloque la sortie audio pour le bip de fin
    const o=REST.ac.createOscillator(), g=REST.ac.createGain(); g.gain.value=0.0001; o.connect(g); g.connect(REST.ac.destination); o.start(); o.stop(REST.ac.currentTime+0.02);
  }catch(e){}
}
function restBeep(){
  const ac=REST.ac; if(!ac)return;
  try{
    if(ac.state!=='running')ac.resume();
    // trois bips nets et forts (onde triangle, 1 kHz)
    [0,0.28,0.56].forEach((t0,i)=>{ const o=ac.createOscillator(), g=ac.createGain(), t=ac.currentTime+0.05+t0; o.type='triangle'; o.frequency.value=i===2?1320:1000;
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.9,t+0.015); g.gain.setValueAtTime(0.9,t+0.16); g.gain.exponentialRampToValueAtTime(0.0001,t+0.22);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t+0.24); });
  }catch(e){}
}
// au retour dans l'app, le premier toucher redébloque le son (iOS le suspend en arrière-plan)
document.addEventListener('touchend',()=>{ if(REST.ac&&REST.ac.state!=='running')restAudio(); },{passive:true});

// ---- Programme : constructeur, textes du profil, choix de l'onboarding ----
// Le coach (src/training/ui/coach.js) pose ses questions puis propose ses séances ; hooks : { onDone, openEditor }
function coachCtx(hooks){
  const cid=(COACH&&COACHES[COACH.id])?COACH.id:'ren';
  return Object.assign({
    program:()=>PROGRAM, apply:(p)=>{ applyProgram(p); return PROGRAM; }, profile:()=>PROFILE,
    coach:()=>({ id:cid, name:COACHES[cid].name }), pose:(k)=>RENIMG(k), portrait:()=>coachFace(cid),
    answers:()=>jget('coach:prog',null), store:(a)=>jset('coach:prog',a),
    openEditor:(opts)=>{ showView('training'); openProgramEditor(opts); }, onDone:()=>showView('training'),
  }, hooks||{});
}
function openCoachProgram(from,hooks){ return TRUI.openCoachBuilder(coachCtx(hooks),{ from:from||'editor' }); }
function progCtx(){ return { program:()=>PROGRAM, save:(p)=>{ applyProgram(p); return PROGRAM; }, zones:()=>(PROFILE&&PROFILE.zones)||[], weight:()=>weightNow(),
  coach:(hooks)=>openCoachProgram('editor',hooks),
  coachCard:()=>{ const cid=(COACH&&COACHES[COACH.id])?COACH.id:'ren'; return { name:COACHES[cid].name, img:coachFace(cid) }; } }; }
function applyProgram(p){
  setProgram(p);
  if(weekOffset===0){ state=TR.migrateWeek(TR.toStored(state),PROG_SNAP); save(); }
  render(); renderProgramTexts();
}
function openProgramEditor(opts){ return TRUI.openEditor(progCtx(),opts||{}); }
function renderProgramTexts(){
  const a=document.getElementById('pfProgS'); if(a)a.textContent=TR.countText(PROGRAM);
  const h=document.getElementById('pfProgH'); if(h)h.textContent=TR.scheduleText(PROGRAM);
}
function onbProgramChoice(pc,p){
  if(pc==='reco'){
    const t=TR.recommendedTemplate(p.sessions||4);
    applyProgram(TR.templateProgram(t.key,{current:PROGRAM,zones:p.zones||[]}));
    TRUI.toast('Programme « '+t.name+' » prêt');
  } else if(pc==='coach'){
    setTimeout(()=>{ showView('training'); openCoachProgram('onboarding'); },420);
  } else if(pc==='create'){
    setTimeout(()=>{ showView('training'); openProgramEditor(); },420);
  }
}
document.getElementById('progOpen').onclick=()=>openProgramEditor();
document.getElementById('pfProgB').onclick=()=>openProgramEditor();
renderProgramTexts();
