// ---- Chrono : chronomètre libre, minuteur réglable, durée de la séance ----
// Tout se calcule à partir d'heures (Date.now), jamais d'un décompte : rien ne dérive si l'app passe
// en arrière-plan. L'état est gardé sur le téléphone (localStorage), pas synchronisé : c'est un outil.
const CHR_KEY='ren:chrono:v1';
const CHR=(function(){
  let d=null; try{ d=JSON.parse(localStorage.getItem(CHR_KEY)||'null'); }catch(e){}
  d=d&&typeof d==='object'?d:{};
  return {
    sw:Object.assign({t0:0,acc:0,run:false,laps:[]},d.sw||{}),     // chronomètre libre
    ses:d.ses||null,                                               // { sid, day, t0, acc, run, end }
    pre:+d.pre||90,                                                // dernier minuteur choisi (s)
    close:null, tab:'sw', t:null,
  };
})();
function chrSave(){ try{ localStorage.setItem(CHR_KEY,JSON.stringify({sw:CHR.sw,ses:CHR.ses,pre:CHR.pre})); }catch(e){} }
function chrDay(){ const n=new Date(); return n.getFullYear()+'-'+(n.getMonth()+1)+'-'+n.getDate(); }
function chrEl(c){ return c.acc+(c.run?Math.max(0,Date.now()-c.t0):0); }
// 75 300 ms → « 1:15,3 » ; au-delà d'une heure « 1:02:05 »
function chrFmt(ms,tenths){
  const t=Math.max(0,Math.floor(ms/100)), s=Math.floor(t/10), h=Math.floor(s/3600), m=Math.floor(s/60)%60, ss=String(s%60).padStart(2,'0');
  const base=h?h+':'+String(m).padStart(2,'0')+':'+ss:m+':'+ss;
  return tenths&&!h?base+'<small>,'+(t%10)+'</small>':base;
}
function chrMin(sec){ return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0'); }

// ---- la fenêtre ----
function chrOpen(tab){
  if(CHR.close)return;
  if(tab)CHR.tab=tab;
  const n=TRUI.esc;
  const node=document.createElement('div'); node.className='sheet chr';
  node.innerHTML='<div class="sheeth"><p class="st">Chrono</p><button type="button" aria-label="Fermer" data-c="x">✕</button></div>'+
    '<div class="chr-tabs" role="tablist"><button type="button" role="tab" data-tab="sw">Chronomètre</button><button type="button" role="tab" data-tab="tm">Minuteur</button></div>'+
    '<div data-pane="sw"><p class="chr-big" id="chrSw"></p><p class="chr-sub" id="chrSwS"></p>'+
      '<div class="chr-row"><button type="button" class="chr-b" data-c="lap"></button><button type="button" class="chr-b go" data-c="go"></button></div>'+
      '<ol class="chr-laps" id="chrLaps"></ol></div>'+
    '<div data-pane="tm"><div class="chr-pre" id="chrPre"></div>'+
      '<div class="chr-adj"><button type="button" data-c="m15" aria-label="15 secondes de moins">−15 s</button><p class="chr-big" id="chrTm"></p><button type="button" data-c="p15" aria-label="15 secondes de plus">+15 s</button></div>'+
      '<p class="chr-sub">Le minuteur tourne dans la barre du bas, même si tu changes d’écran. Bip à la fin.</p>'+
      '<button type="button" class="chr-b go" data-c="tgo" style="width:100%">Lancer</button></div>';
  node.querySelector('#chrPre').innerHTML=[30,60,90,120,180,300].map(s=>'<button type="button" data-pre="'+s+'">'+n(chrMin(s))+'</button>').join('');
  node.addEventListener('click',e=>{
    const t=e.target.closest('[data-tab]'); if(t){ CHR.tab=t.dataset.tab; chrPaint(); return; }
    const p=e.target.closest('[data-pre]'); if(p){ CHR.pre=+p.dataset.pre; chrSave(); chrPaint(); return; }
    const b=e.target.closest('[data-c]'); if(!b)return;
    const c=b.dataset.c, sw=CHR.sw;
    if(c==='x'){ CHR.close&&CHR.close(); return; }
    if(c==='go'){ if(sw.run){ sw.acc=chrEl(sw); sw.run=false; } else { sw.t0=Date.now(); sw.run=true; } chrSave(); chrPaint(); return; }
    if(c==='lap'){
      if(sw.run){ const tot=chrEl(sw), prev=sw.laps.length?sw.laps[sw.laps.length-1]:0; sw.laps.push(tot); if(sw.laps.length>99)sw.laps.shift(); void prev; }
      else { sw.acc=0; sw.laps=[]; }
      chrSave(); chrPaint(); return;
    }
    if(c==='m15'||c==='p15'){ CHR.pre=Math.max(5,Math.min(3600,CHR.pre+(c==='p15'?15:-15))); chrSave(); chrPaint(); return; }
    if(c==='tgo'){ restAudio(); restStart(CHR.pre,null); CHR.close&&CHR.close(); return; }
  });
  CHR.node=node;
  CHR.close=TRUI.openLayer(node,{sheet:true,label:'Chrono et minuteur',onClose:()=>{ CHR.close=null; CHR.node=null; clearInterval(CHR.t); CHR.t=null; }});
  chrPaint(); clearInterval(CHR.t); CHR.t=setInterval(chrPaint,100);
}
function chrPaint(){
  const node=CHR.node; if(!node)return;
  node.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===CHR.tab)));
  node.querySelectorAll('[data-pane]').forEach(p=>{ p.hidden=p.dataset.pane!==CHR.tab; });
  const sw=CHR.sw, el=chrEl(sw);
  node.querySelector('#chrSw').innerHTML=chrFmt(el,true);
  node.querySelector('#chrSwS').textContent=sw.run?'En marche':el?'En pause':'';
  const go=node.querySelector('[data-c="go"]'), lap=node.querySelector('[data-c="lap"]');
  go.textContent=sw.run?'Pause':el?'Reprendre':'Démarrer';
  lap.textContent=sw.run?'Tour':'Remettre à zéro'; lap.disabled=!sw.run&&!el;
  const laps=node.querySelector('#chrLaps'), k=sw.laps.length+'|'+(sw.laps[sw.laps.length-1]||0);
  if(laps.dataset.k!==k){
    laps.dataset.k=k;
    laps.innerHTML=sw.laps.map((t,i)=>'<li><span>Tour '+(i+1)+'</span><b>'+chrFmt(t-(i?sw.laps[i-1]:0),true).replace(/<\/?small>/g,'')+'</b><span>'+chrFmt(t,false)+'</span></li>').reverse().join('');
  }
  node.querySelectorAll('[data-pre]').forEach(b=>b.classList.toggle('on',+b.dataset.pre===CHR.pre));
  node.querySelector('#chrTm').textContent=chrMin(CHR.pre);
}
document.getElementById('chronoOpen').onclick=()=>chrOpen();

// ---- durée de la séance : démarre au toucher ou à la première série validée, s'arrête quand tout est fait ----
function sesCur(){ const c=CHR.ses; return c&&c.sid===openCard&&c.day===chrDay()?c:null; }
function sesDone(sid){ const f=state&&state.training&&state.training[sid], s=tdById(sid); return !!(s&&f&&s.ex.length&&s.ex.every((x,k)=>f[k])); }
function sesStart(){ CHR.ses={sid:openCard,day:chrDay(),t0:Date.now(),acc:0,run:true,end:false}; chrSave(); sesPaint(); }
function sesPaint(){
  const b=document.getElementById('sesClock'); if(!b)return;
  const c=sesCur(), v=document.getElementById('sesClockV');
  if(c&&c.run&&!c.end&&sesDone(c.sid)){ c.acc=chrEl(c); c.run=false; c.end=true; chrSave(); }
  b.classList.toggle('run',!!(c&&c.run)); b.classList.toggle('pause',!!(c&&!c.run&&!c.end)); b.classList.toggle('fin',!!(c&&c.end));
  if(!c){ v.textContent='Démarrer'; b.setAttribute('aria-label','Démarrer le chrono de la séance'); return; }
  const t=chrFmt(chrEl(c),false);
  v.textContent=c.end?'Faite en '+t:t;
  b.setAttribute('aria-label',c.end?'Séance faite en '+t:c.run?'Durée de la séance '+t+', toucher pour mettre en pause':'Chrono de la séance en pause, toucher pour reprendre');
}
document.getElementById('sesClock').onclick=()=>{
  const c=sesCur();
  if(!c){ sesStart(); return; }
  if(c.end){ TRUI.ask({title:'Relancer le chrono de la séance ?',text:'La durée repart de zéro.',ok:'Relancer'}).then(ok=>{ if(ok)sesStart(); }); return; }
  if(c.run){ c.acc=chrEl(c); c.run=false; } else { c.t0=Date.now(); c.run=true; }
  chrSave(); sesPaint();
};
// la première série validée lance le chrono s'il ne tourne pas encore
const _lgOkChr=lgOk;
lgOk=function(f,row){
  const before=state.log[f.ex.id]?state.log[f.ex.id].s.length:0;
  _lgOkChr(f,row);
  const after=state.log[f.ex.id]?state.log[f.ex.id].s.length:0;
  if(after>before&&f.s.id===openCard&&!sesCur())sesStart();
  sesPaint();
};
const _renderChr=render;
render=function(){ const r=_renderChr.apply(this,arguments); sesPaint(); return r; };
setInterval(()=>{ const ps=document.querySelector('#v-training > .ps'); if(ps&&!ps.hidden)sesPaint(); },1000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ sesPaint(); chrPaint(); } });
