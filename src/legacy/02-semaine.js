function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=(t.getUTCDay()+6)%7;t.setUTCDate(t.getUTCDate()-day+3);const first=new Date(Date.UTC(t.getUTCFullYear(),0,4));const week=1+Math.round(((t-first)/86400000-3+((first.getUTCDay()+6)%7))/7);return {year:t.getUTCFullYear(),week};}
function mondayOf(d){const t=new Date(d);const day=(t.getDay()+6)%7;t.setDate(t.getDate()-day);t.setHours(0,0,0,0);return t;}
function keyFor(off){const base=mondayOf(new Date());base.setDate(base.getDate()+off*7);const iw=isoWeek(base);return {k:`fitweek:${iw.year}-W${String(iw.week).padStart(2,'0')}`,monday:base,iw};}
function fmt(d){return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});}

let weekOffset=0, state=null, selDay=-1, openCard=null;
// Semaine vierge : programme actuel. Semaine stockée : son propre programme (instantané) ;
// la semaine en cours suit le programme actuel (coches reportées exercice par exercice).
function blankState(){return TR.blankWeek(PROG_SNAP);}
function migrate(s,cur){if(cur)return TR.migrateWeek(s&&typeof s==='object'?s:null,PROG_SNAP);return s&&typeof s==='object'?TR.migrateWeek(s):blankState();}
// Lecture seule d'une semaine enregistrée (XP, score, série, compteurs), gardée en mémoire tant qu'elle ne change pas
const WEEK_CACHE=new Map();
function readWeek(k){const v=sget(k);if(!v)return null;const c=WEEK_CACHE.get(k);if(c&&c.raw===v)return c.st;let st=null;try{st=TR.migrateWeek(JSON.parse(v));}catch(e){st=null;}WEEK_CACHE.set(k,{raw:v,st:st});return st;}
function load(){const k=keyFor(weekOffset).k;let v=sget(k),s=null;if(v){try{s=JSON.parse(v);}catch(e){s=null;}}state=migrate(s,weekOffset===0);}
function save(){const k=keyFor(weekOffset).k;try{sset(k,JSON.stringify(TR.toStored(state)));}catch(e){}}
function weekMain(st){return (st||state).prog.s.filter(s=>!s.opt);}
function weekOpt(st){return (st||state).prog.s.filter(s=>s.opt);}

// Training se vit au jour le jour (11-jour.js) : l'entrée propose la séance, et la séance ouverte
// (openCard) s'affiche seule, avec ses exercices.
function render(){
  const wrap=document.getElementById('sessions');wrap.innerHTML='';
  const s=openCard&&state.prog.s.find(x=>x.id===openCard);if(s)wrap.appendChild(cardEl(s));
  renderSportRows();
  renderDays();renderNutrition();updateHero();
}
// « 2 nov. – 8 nov. · S45 »
function weekLabel(off){const {monday,iw}=keyFor(off);const sun=new Date(monday);sun.setDate(sun.getDate()+6);return `${fmt(monday)} – ${fmt(sun)} · S${iw.week}`;}
// Partie Sports : les sports de la semaine affichée, une coche par séance prévue (un sport retiré du
// programme mais déjà fait reste), puis ceux du programme sans jour. Toucher un sport du programme
// ouvre ses réglages (jours, durée, intensité) ; « Ajouter » ouvre le catalogue.
function weekSports(st){ return TR.snapSports((st||state).prog).filter(e=>((st||state).sport[e.id]||[]).length); }
const DAY3=['lun.','mar.','mer.','jeu.','ven.','sam.','dim.'];
function renderSportRows(){
  const box=document.getElementById('sportrows'); if(!box)return; box.innerHTML='';
  const cur=weekOffset===0, rows=weekSports(), seen=new Set(rows.map(e=>e.id));
  const noDay=cur?TR.sportsList(PROGRAM).filter(e=>!seen.has(e.id)):[];
  const title=(e,sp,sub)=>{ const open=cur&&!e.gone&&!!TR.sportEntry(PROGRAM,e.id);
    return '<span class="cd-day sw" aria-hidden="true">'+TR.sportIcon(sp,20)+'</span>'+(open?'<button type="button" class="tt sp-open" data-sp="'+esc(e.id)+'">':'<span class="tt">')
      +'<span class="n">'+esc(sp.n)+'</span><span class="s">'+esc(sub)+'</span>'+(open?'</button>':'</span>'); };
  rows.forEach(e=>{
    const sp=TR.sportOf(e), fl=state.sport[e.id], n=fl.length;
    const row=document.createElement('div'); row.className='sport'+(e.gone?' gone':''); row.dataset.sp=e.id;
    const days=Array.isArray(e.days)&&e.days.length?[...e.days].sort((a,b)=>a-b).map(d=>DAY3[d]).join(', '):n+' fois par semaine';
    const sub=e.gone?'Retiré du programme':(sp.id==='natation'?'Technique':'≈ '+TR.fmtMin(sp.min))+' · '+days;
    row.innerHTML=title(e,sp,sub)+'<div class="dots'+(n>3?' many':'')+'"></div>';
    const dots=row.querySelector('.dots');
    fl.forEach((on,i)=>{ const b=chkBtn(on,()=>{ state.sport[e.id][i]=!state.sport[e.id][i]; save(); render(); }); b.setAttribute('aria-label',sp.n+(n>1?', séance '+(i+1)+' sur '+n:'')); dots.appendChild(b); });
    box.appendChild(row);
  });
  noDay.forEach(e=>{
    const sp=TR.sportOf(e), row=document.createElement('div'); row.className='sport noday'; row.dataset.sp=e.id;
    row.innerHTML=title(e,sp,'Pas encore de jour : touche pour le placer');
    box.appendChild(row);
  });
  renderSportsView(rows,noDay);
}
function renderSportsView(rows,noDay){
  const sub=document.getElementById('spSub'); if(!sub)return;
  const cur=weekOffset===0; let done=0, tot=0;
  rows.forEach(e=>{ const fl=state.sport[e.id]||[]; tot+=fl.length; done+=fl.filter(Boolean).length; });
  const empty=!rows.length&&!noDay.length;
  sub.textContent=empty?'Aucun sport pour l’instant':tot?done+' séance'+(done>1?'s':'')+' sur '+tot+(cur?' cette semaine':' cette semaine-là'):'Aucun jour prévu pour l’instant';
  document.getElementById('spPast').hidden=cur;
  const wt=document.getElementById('spWeekT'); wt.textContent=cur?'Cette semaine':'Semaine passée'; wt.hidden=empty;
  document.getElementById('spHint').hidden=empty||!cur;
  const em=document.getElementById('spEmpty'); em.hidden=!empty;
  if(empty)em.innerHTML='<p class="sp-e-t">Natation, course, foot, boxe, yoga…</p><p class="sp-e-s">'+TR.SPORT_COUNT+' sports rangés par catégories. Ajoute ceux que tu pratiques : ils comptent dans ta semaine, ton XP et tes calories.</p>'
    +(cur?'<button type="button" class="aibtn" data-act="sp-add">Ajouter un sport</button>':'');
}
function addSportFromView(){ TRUI.addSportFlow(progCtx()); }
document.getElementById('spAdd').onclick=()=>{ if(weekOffset!==0){ weekOffset=0; openCard=null; load(); render(); } addSportFromView(); };
document.getElementById('spBack').onclick=()=>{ weekOffset=0; openCard=null; load(); render(); };
document.getElementById('v-sports').addEventListener('click',e=>{
  const o=e.target.closest('.sp-open'); if(o){ TRUI.openSportSheet(progCtx(),o.dataset.sp); return; }
  if(e.target.closest('[data-act="sp-add"]'))addSportFromView();
});
const CD_IC={clock:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  list:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17.5" r="1"/></svg>',
  check:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'};
// La séance ouverte : où elle en est (exercices cochés, durée), puis ses exercices. Son nom est
// dans le titre de la rubrique ; ici, ce qu'elle travaille.
function cardEl(s){
  const len=s.ex.length,done=state.training[s.id].filter(Boolean).length;const isDone=TR.isValidated(state,s);
  const card=document.createElement('div');card.className='card open'+(s.gone?' gone':'');card.dataset.sid=s.id;
  const hd=document.createElement('div');hd.className='chd'+(isDone?' done':'')+(!isDone&&done>0?' prog':'');
  const pctC=len?Math.round(done/len*100):0;
  const meta=len&&!s.gone?`<div class="cd-m"><span>${CD_IC.clock}≈ ${Math.max(15,TRUI.sessionMinutes(s))} min</span><span>${CD_IC.list}${len} exercice${len>1?'s':''}</span></div>`:'';
  const what=s.gone?'Retirée du programme':String(s.sub||'').replace(/ \+ /g,' et ').replace(/ — /g,', ');
  hd.innerHTML=`<div class="tt"><div class="n">${esc(what)}</div>${meta}<span class="pb"><i style="width:${pctC}%"></i></span></div>${isDone?'<span class="stamp" title="Validée">'+CD_IC.check+'<span class="vh-only">Validée</span></span>':''}<span class="cnt">${done}/${len}</span>`;
  card.appendChild(hd);
  const list=document.createElement('div');list.className='exlist';const inner=document.createElement('div');inner.className='inner';
  s.ex.forEach((ex,i)=>inner.appendChild(exRowEl(s,ex,i)));
  if(!len)inner.innerHTML='<p class="ex-empty">Aucun exercice. Ajoute-les depuis Programme.</p>';
  list.appendChild(inner);card.appendChild(list);return card;
}
function chkBtn(on,onclick){const b=document.createElement('button');b.className='chk';b.setAttribute('aria-pressed',on?'true':'false');b.innerHTML=CHECK;b.onclick=(e)=>{e.stopPropagation();onclick();};return b;}
function renderDays(){
  const todayIdx=weekOffset===0?(new Date().getDay()+6)%7:-1;
  if(selDay<0||selDay>6)selDay=todayIdx>=0?todayIdx:0;
  const wrap=document.getElementById('daypills');wrap.innerHTML='';
  DAYS.forEach((d,i)=>{const p=document.createElement('button');p.className='pill'+(i===selDay?' sel':'')+(i===todayIdx?' today':'');
    const prot=state.nutrition[i+1].protein;
    p.innerHTML=`<div class="dl">${d}</div><div class="dp"><i style="width:${Math.round(prot/7*100)}%"></i></div>`;
    p.onclick=()=>{selDay=i;render();};wrap.appendChild(p);});
}
function renderNutrition(){
  const nd=state.nutrition[selDay+1];
  document.getElementById('pcount').textContent=`${nd.protein}/7`;
  const pd=document.getElementById('pdots');pd.innerHTML='';
  for(let i=0;i<7;i++){const dot=document.createElement('button');dot.className='pdot';dot.setAttribute('data-on',i<nd.protein?'1':'0');dot.setAttribute('aria-label',`Protéine ${i+1}`);
    dot.onclick=()=>{nd.protein=(nd.protein===i+1)?i:i+1;save();render();};pd.appendChild(dot);}
  const hb=document.getElementById('habits');hb.innerHTML='';
  HABITS.forEach(h=>{const row=document.createElement('div');row.className='row';
    row.appendChild(chkBtn(nd[h.k],()=>{nd[h.k]=!nd[h.k];save();render();}));
    const info=document.createElement('div');info.className='exi';info.innerHTML=`<div class="en">${h.l}</div>`;
    row.appendChild(info);hb.appendChild(row);});
  let ok=0;for(let d=1;d<=7;d++)if(state.nutrition[d].protein>=6)ok++;
  document.getElementById('nutmeta').textContent=`${ok}/7 jours protéines OK`;
}
function updateHero(){
  const mc=TR.mainCount(state),sessions=TR.sessionsDone(state);
  let protDays=0,creaDays=0;for(let d=1;d<=7;d++){const n=state.nutrition[d];if(n.protein>=6)protDays++;if(n.crea)creaDays++;}
  const mp=mc?Math.min(1,sessions/mc):0,pp=protDays/7,cp=creaDays/7;const pct=Math.round((mp*0.45+pp*0.40+cp*0.15)*100);
  document.getElementById('ring').setAttribute('stroke-dashoffset',326.7*(1-pct/100));
  document.getElementById('pct').textContent=pct+'%';
  document.getElementById('v_m').textContent=sessions+'/'+mc;document.getElementById('v_p').textContent=protDays+'/7';document.getElementById('v_c').textContent=creaDays+'/7';
  document.getElementById('b_m').style.width=(mp*100)+'%';document.getElementById('b_p').style.width=(pp*100)+'%';document.getElementById('b_c').style.width=(cp*100)+'%';
  let v; if(pct>=85)v='En feu 🔥'; else if(pct>=60)v='Solide 💪'; else if(pct>=35)v='En bonne voie'; else v='On lance la semaine';
  document.getElementById('verdict').textContent=v;
}
document.getElementById('reset').onclick=()=>{TRUI.ask({title:'Remettre à zéro toutes les coches de cette semaine ?',ok:'Remettre à zéro',danger:true}).then(ok=>{if(ok){state=blankState();openCard=null;save();render();}});};
selDay=-1; load(); render();
