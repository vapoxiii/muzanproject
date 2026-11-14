// ===== Training au jour le jour =====
// L'entrée de Training, c'est aujourd'hui : Ren propose une séance d'après le programme et ce qui est
// déjà fait cette semaine ; les cartes des séances glissent pour en choisir une autre ; « C'est parti »
// ouvre la séance, seule (ses exercices, ses séries, l'écran de repos : 02-seance.js, 02-semaine.js).
// Rien de nouveau n'est enregistré. Une séance est faite quand elle est validée (80 % de ses exercices
// cochés, comme avant) ; son jour vient de la date de ses séries notées, et une séance cochée sans
// séries est « faite cette semaine ». La semaine entière reste dans Progression, Semaines.
const TD={chosen:null,train:false,center:null,sig:'',raf:0};
const TD_DAY=DAYFULL.map(d=>d.toLowerCase());
const TD_IC={
  play:'<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor"/></svg>',
  check:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  back:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4.5h4.5"/></svg>',
  moon:'<svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  plan:'<svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
};
function tdNb(t){ return String(t).replace(/ ([?!:;])/g,' $1'); }
function tdCap(t){ return t?t.charAt(0).toUpperCase()+t.slice(1):t; }
function tdById(id){ return (id&&state.prog.s.find(s=>s.id===id))||null; }
// les cartes : les séances du programme (une séance retirée mais commencée cette semaine reste)
function tdCards(){ return state.prog.s.filter(s=>!s.gone||TR.doneCount(state,s.id)>0); }
function tdMain(){ return state.prog.s.filter(s=>!s.opt&&!s.gone); }
function tdOpts(){ return state.prog.s.filter(s=>s.opt&&!s.gone); }
function tdDone(s){ return TR.isValidated(state,s); }
// le jour d'une séance : la date de ses séries notées cette semaine (la dernière) ; '' sans séries
function tdDate(s){ let d=''; s.ex.forEach(ex=>{ const e=state.log&&state.log[ex.id]; if(e&&typeof e.d==='string'&&e.d>d)d=e.d; }); return d; }
function tdDayOf(ds){ const p=ds.split('-'), dt=new Date(+p[0],+p[1]-1,+p[2]); return (dt.getDay()+6)%7; }
function tdDoneToday(s){ return tdDone(s)&&tdDate(s)===todayStr(); }
// ce que la séance travaille, dans une phrase : « poussée et bras », « à la maison »
function tdFocus(s){ const t=String(s.sub||'').trim(); if(!t)return ''; if(/maison/i.test(t))return 'à la maison'; return t.replace(/\s*\+\s*/g,' et ').replace(/\s*—\s*/g,', ').toLowerCase(); }
// le sport prévu aujourd'hui (natation, football…) et s'il est coché
function tdSport(){
  const pd=planOfSnap(state.prog)[todayIdx()]; if(!pd||pd.t!=='s')return null;
  const sp=TR.sportOf(TR.snapSports(state.prog).find(e=>e.id===pd.sp)||{id:pd.sp});
  return {sp:sp,done:!!(state.sport[pd.sp]||[])[pd.i]};
}

// ---- ce que Ren propose ----
function tdRemaining(){ return tdMain().filter(s=>!tdDone(s)); }
// la prochaine séance à faire : la plus proche à partir d'aujourd'hui, sinon la dernière ratée, sinon une sans jour
function tdNext(){
  const d=todayIdx(), rem=tdRemaining(); if(!rem.length)return null;
  const days=s=>s.days||[], from=s=>Math.min(...days(s).filter(x=>x>=d));
  const up=rem.filter(s=>days(s).some(x=>x>=d)).sort((a,b)=>from(a)-from(b));
  if(up.length)return up[0];
  const late=rem.filter(s=>days(s).length).sort((a,b)=>Math.max(...days(b))-Math.max(...days(a)));
  return late[0]||rem[0];
}
function tdWhen(s){
  const d=todayIdx(), days=s.days||[];
  if(days.includes(d))return 'aujourd’hui';
  const later=days.filter(x=>x>d);
  if(later.length){ const x=Math.min(...later); return x===d+1?'demain':TD_DAY[x]; }
  return days.length?'à rattraper':'quand tu veux';
}
// st : jour (la séance prévue aujourd'hui), deja (celle d'aujourd'hui est déjà faite : la suivante),
// repos (rien de prévu : la suivante, si on s'entraîne quand même), fait (une séance faite aujourd'hui),
// boucle (toutes les séances de la semaine faites : le bonus), bonus (que des séances en bonus), vide
function tdProposal(){
  const cards=tdCards(), main=tdMain(), opts=tdOpts();
  if(!main.length&&!opts.length)return {st:'vide',id:null};
  const today=cards.find(tdDoneToday); if(today)return {st:'fait',id:today.id};
  if(!main.length)return {st:'bonus',id:opts[0].id};
  if(!tdRemaining().length)return {st:'boucle',id:(opts[0]||main[0]).id};
  const d=todayIdx(), planned=main.find(s=>(s.days||[]).includes(d));
  if(planned&&!tdDone(planned))return {st:'jour',id:planned.id};
  const nx=tdNext();
  return planned?{st:'deja',id:nx.id,planned:planned.id}:{st:'repos',id:nx.id};
}
// un jour sans muscu, une semaine finie sans bonus (ou avec un sport aujourd'hui) : la carte du repos
function tdRestLike(pr){ return pr.st==='vide'||pr.st==='repos'||(pr.st==='boucle'&&(!tdOpts().length||!!tdSport())); }
function tdResting(pr){ return pr.st==='vide'||(tdRestLike(pr)&&!TD.train); }
function tdCurrent(pr){ return TD.chosen&&tdCards().some(s=>s.id===TD.chosen)?TD.chosen:pr.id; }
function tdCoach(){ const co=coachSaved(); return co&&co.id==='aya'?'aya':'ren'; }

function tdStatus(s){
  const d=todayIdx();
  if(tdDone(s)){
    const ds=tdDate(s); if(!ds)return {k:'done',t:'Faite cette semaine',w:'faite cette semaine'};
    const x=tdDayOf(ds);
    return x===d?{k:'done',t:'Faite aujourd’hui',w:'faite aujourd’hui',today:true}:{k:'done',t:'Faite '+TD_DAY[x],w:'faite '+TD_DAY[x]};
  }
  if(s.gone)return {k:'late',t:'Retirée',w:'retirée du programme'};
  if(s.opt)return {k:'bonus',t:'En bonus',w:'en bonus'};
  const days=s.days||[];
  if(days.includes(d))return {k:'today',t:'Aujourd’hui',w:'prévue aujourd’hui'};
  const later=days.filter(x=>x>d);
  if(later.length){ const x=Math.min(...later); return {k:'later',t:'Prévue '+TD_DAY[x],w:'prévue '+(x===d+1?'demain':TD_DAY[x])}; }
  if(!days.length)return {k:'later',t:'Sans jour',w:'sans jour prévu'};
  const x=Math.max(...days); return {k:'late',t:'À rattraper',w:'prévue '+TD_DAY[x]+', pas encore faite'};
}
// la dernière fois, d'après les séries notées les semaines d'avant
function tdLast(s){
  let best='';
  const cur=lgKey();
  lgWeeks().forEach(w=>{ if(w.k===cur)return; const log=(w.st&&w.st.log)||{}; s.ex.forEach(ex=>{ const e=log[ex.id]; if(e&&typeof e.d==='string'&&e.d>best)best=e.d; }); });
  if(!best)return '';
  const p=best.split('-'), then=new Date(+p[0],+p[1]-1,+p[2]), now=new Date(); now.setHours(0,0,0,0);
  const n=Math.round((now-then)/86400000); if(n<=0)return '';
  return 'Dernière fois '+(n===1?'hier':n<14?'il y a '+n+' jours':'le '+(then.getDate()===1?'1er':then.getDate())+' '+then.toLocaleDateString('fr-FR',{month:'long'}));
}

// ---- la phrase de Ren, pour la séance au centre ----
function tdSay(id,pr){
  const tough=(coachSaved()||{}).tone==='exigeant', n=tdMain().length;
  if(pr.st==='vide')return 'Ton programme est vide. On le construit ensemble ?';
  if(tdResting(pr)){
    const sp=tdSport(), spT=sp?'Aujourd’hui, '+TR.sportLower(sp.sp)+(sp.done?' : c’est fait.':'.'):'';
    if(pr.st==='boucle')return n+' sur '+n+' cette semaine ! '+(spT||'Profite du repos.');
    if(sp)return spT+' Pas de muscu prévue.';
    return 'Aujourd’hui, repos. Tes muscles se reconstruisent.';
  }
  const s=tdById(id); if(!s)return '';
  const f=tdFocus(s), fx=f?' : '+f:'', k=TR.doneCount(state,s.id), len=s.ex.length, going=!tdDone(s)&&k>0;
  const prog=s.name+' est en cours : '+k+' exercice'+(k>1?'s':'')+' sur '+len+'.';
  if(id===pr.id){
    if(pr.st==='jour')return going?prog.replace(/\.$/,'. On termine ?'):tough?'Aujourd’hui, '+s.name+fx+'. Pas d’excuse.':'Aujourd’hui, c’est '+s.name+fx+'. On y va ?';
    if(pr.st==='deja')return tdById(pr.planned).name+' est déjà faite. Je te propose '+s.name+fx+'.';
    if(pr.st==='repos')return (going?prog:'Alors '+s.name+fx+'.')+' Elle reste à faire cette semaine.';
    if(pr.st==='fait'){ const nx=tdNext(); return s.name+', c’est fait. '+(nx?'Prochaine : '+nx.name+', '+tdWhen(nx)+'.':'Semaine bouclée !'); }
    if(pr.st==='boucle'&&s.opt)return n+' sur '+n+' cette semaine ! '+s.name+' en bonus, si tu veux.';
    if(pr.st==='bonus')return 'Pas de séance prévue dans ton programme. '+s.name+', en bonus, si tu veux.';
  }
  const st=tdStatus(s);
  if(st.k==='done')return st.today?s.name+', faite aujourd’hui.':s.name+', '+st.w+'. Tu peux la revoir.';
  if(going)return prog;
  if(st.k==='bonus')return f==='à la maison'?s.name+', en bonus et à la maison.':s.name+', en bonus'+fx+'.';
  if(s.gone)return s.name+' a été retirée de ton programme.';
  if(st.k==='late')return s.name+', '+st.w+'. Bonne idée.';
  if(st.k==='later')return (s.days||[]).length?s.name+' est '+st.w+'. Tu l’avances ?':s.name+fx+', quand tu veux.';
  return s.name+' est prévue aujourd’hui.';
}
// le bouton : lancer, reprendre ou revoir la séance au centre ; s'entraîner quand même un jour de repos
function tdCta(id,pr){
  if(pr.st==='vide')return {t:'Construire mon programme',main:true};
  if(tdResting(pr))return {t:pr.st==='boucle'&&!tdOpts().length?'Voir mes séances':'Je m’entraîne quand même',main:false};
  const s=tdById(id); if(!s)return {t:'C’est parti',main:true,icon:true};
  if(tdDone(s))return {t:'Voir la séance',main:false,s:s};
  if(TR.doneCount(state,s.id)>0)return {t:'Reprendre la séance',main:true,s:s};
  return {t:'C’est parti',main:true,icon:true,s:s};
}

// ---- les cartes ----
function tdWord(s){
  const n=String(s.name||'').toLowerCase(), t=n+' '+String(s.sub||'').toLowerCase();
  if(/bras/.test(n))return 'BRAS'; if(/^bas|legs|jambe/.test(t))return 'JAMBES'; if(/full/.test(t))return 'FULL BODY';
  if(/pull|tirage|dos/.test(t))return 'TIRAGE'; if(/push|pouss/.test(t))return 'POUSSÉE'; if(/haut/.test(t))return 'HAUT';
  const w=String(s.name||'').toUpperCase(); return w&&w.length<=10?w:'SÉANCE';
}
// couverture provisoire : l'illustration d'un exercice de la séance, sinon un motif et un mot
function tdCover(s){ for(const ex of s.ex){ const u=TR.illusSrc(ex.x); if(u)return u; } return null; }
function tdCardHTML(s){
  const st=tdStatus(s), img=tdCover(s), w=tdWord(s), f=tdFocus(s), len=s.ex.length, k=TR.doneCount(state,s.id);
  const done=st.k==='done', going=!done&&k>0, min=sessionMinutes(s), last=done||going?'':tdLast(s);
  const cov=img?'<span class="tc-cov" aria-hidden="true"><img src="'+esc(img)+'" alt="" decoding="async"></span>'
    :'<span class="tc-cov pat" aria-hidden="true"><b'+(w.length>7?' class="long"':'')+'>'+esc(w)+'</b></span>';
  const nEx=len+' exercice'+(len>1?'s':''), meta=(going?k+' sur '+len+' exercices faits':nEx)+' · ≈ '+min+' min';
  const label=s.name+(f?', '+f:'')+', '+st.w+'. '+(going?k+' exercices faits sur '+len:nEx)+', environ '+min+' minutes.';
  return '<button type="button" class="tc'+(done?' is-done':'')+'" data-sid="'+esc(s.id)+'" data-opt="'+(s.opt?1:0)+'" data-done="'+k+'" data-len="'+len+'" aria-label="'+esc(label)+'" tabindex="-1">'+cov
    +'<span class="tc-tx"><span class="tc-st '+st.k+'">'+(done?TD_IC.check:'')+esc(st.t)+'</span>'
    +'<b class="tc-n">'+esc(s.name)+'</b>'+(f?'<span class="tc-sub">'+esc(tdCap(f))+'</span>':'')
    +'<span class="tc-meta">'+esc(meta)+(last?'<br>'+esc(last):'')+'</span>'
    +(going?'<span class="tc-pb"><i style="width:'+Math.round(k/len*100)+'%"></i></span>':'')+'</span></button>';
}
// la carte du jour sans muscu : le sport prévu (elle mène à Sports), ou le repos ; ou le programme vide
function tdRestHTML(pr){
  const pat='<span class="tc-cov pat" aria-hidden="true"></span>';
  if(pr.st==='vide')return '<div class="tc tc-r">'+pat+'<span class="tc-ic">'+TD_IC.plan+'</span><span class="tc-tx"><span class="tc-st rest">Programme</span><b class="tc-n">Aucune séance</b><span class="tc-sub">Ton programme est vide</span><span class="tc-meta">Construis-le avec '+(tdCoach()==='aya'?'Aya':'Ren')+', ou toi-même</span></span></div>';
  const sp=tdSport(), nx=tdNext(), n=tdMain().length, fin=pr.st==='boucle';
  const meta=nx?'Prochaine séance : '+nx.name+', '+tdWhen(nx):n+' séance'+(n>1?'s':'')+' sur '+n+' cette semaine';
  const chip='<span class="tc-st rest">'+(fin?'Semaine bouclée':'Aujourd’hui')+'</span>';
  if(sp){
    const s=sp.sp, sub=sp.done?'C’est fait':'≈ '+TR.fmtMin(s.min)+' · dans Sports';
    return '<button type="button" class="tc tc-r" data-sp="'+esc(s.id)+'" aria-label="'+esc('Aujourd’hui, '+s.n+', '+(sp.done?'c’est fait':'environ '+TR.fmtMin(s.min))+'. Voir dans Sports')+'">'+pat
      +'<span class="tc-ic">'+TR.sportIcon(s,58)+'</span><span class="tc-tx">'+chip+'<b class="tc-n">'+esc(s.n)+'</b><span class="tc-sub">'+esc(sub)+'</span><span class="tc-meta">'+esc(tdNb(meta))+'</span></span></button>';
  }
  return '<div class="tc tc-r">'+pat+'<span class="tc-ic">'+TD_IC.moon+'</span><span class="tc-tx">'+chip+'<b class="tc-n">Repos</b><span class="tc-sub">'+(fin?'Profite du repos':'Pas de muscu prévue')+'</span><span class="tc-meta">'+esc(tdNb(meta))+'</span></span></div>';
}

// ---- rendu de l'entrée ----
function tdRender(){
  const hub=document.getElementById('trHub'); if(!hub||!state)return;
  const pr=tdProposal(), main=tdMain(), rest=tdResting(pr), coach=tdCoach();
  document.getElementById('thDate').textContent=heroDateLabel();
  document.getElementById('thPips').innerHTML=main.slice(0,14).map(s=>'<i'+(tdDone(s)?' class="on"':'')+'></i>').join('');
  document.getElementById('thWho').textContent=coach==='aya'?'Aya':'Ren';
  hub.classList.toggle('no-fig',coach!=='ren');
  hub.dataset.pose=rest?'forme':pr.st==='fait'||pr.st==='boucle'?'zone':'concentre';
  const cr=document.getElementById('trCards'), rc=document.getElementById('thRest'), dots=document.getElementById('thDots');
  // les cartes sont prêtes même un jour de repos (« Je m'entraîne quand même » les montre)
  const list=tdCards(), html=list.map(tdCardHTML).join('');
  if(html!==TD.sig){ cr.innerHTML=html; dots.innerHTML=list.map(()=>'<i></i>').join(''); TD.sig=html; TD.center=null; }
  cr.hidden=rest; dots.hidden=rest; rc.hidden=!rest;
  if(rest){
    TD.center=null;
    const rh=tdRestHTML(pr); if(rc.innerHTML!==rh)rc.innerHTML=rh;
    document.getElementById('thHint').textContent='';
    tdBack(null); tdSetSay(tdSay(null,pr)); tdSetCta(null,pr);
    return;
  }
  document.getElementById('thHint').textContent=list.length>1?'Glisse pour changer de séance':'';
  const id=tdCurrent(pr);
  if(!tdCenterOn(id,false)){ TD.center=null; tdOnCenter(id,pr); }   // entrée cachée : on centrera en la montrant
}
function tdSetSay(t){ const el=document.getElementById('thSay'), v=tdNb(t); if(el.textContent!==v)el.textContent=v; }
function tdSetCta(id,pr){
  const c=tdCta(id,pr), b=document.getElementById('trGo');
  b.className='th-go'+(c.main?'':' sec'); b.innerHTML=(c.icon?TD_IC.play:'')+'<span>'+esc(c.t)+'</span>';
  if(c.s)b.setAttribute('aria-label',c.t+' : '+c.s.name); else b.removeAttribute('aria-label');
}
function tdBack(t,act){ const b=document.getElementById('thBack'); b.hidden=!t; if(t){ b.dataset.act=act; b.innerHTML=TD_IC.back+'<span>'+esc(t)+'</span>'; } }
// la séance au centre : phrase de Ren, bouton, points, retour à la proposition
function tdOnCenter(id,pr){
  pr=pr||tdProposal();
  tdSetSay(tdSay(id,pr)); tdSetCta(id,pr);
  const ids=tdCards().map(s=>s.id);
  [...document.getElementById('thDots').children].forEach((d,i)=>d.classList.toggle('cur',ids[i]===id));
  if(id!==pr.id)tdBack(pr.st==='fait'?'Séance du jour':(tdCoach()==='aya'?'Proposition d’Aya':'Proposition de Ren'),'prop');
  else if(TD.train&&tdRestLike(pr))tdBack('Revenir au repos','rest');
  else tdBack(null);
}
// centrer une carte ; false si l'entrée est cachée (rien à mesurer)
function tdCenterOn(id,smooth){
  const cr=document.getElementById('trCards'), c=id&&cr.querySelector('.tc[data-sid="'+CSS.escape(id)+'"]');
  if(!c||!cr.clientWidth)return false;
  const left=c.offsetLeft-(cr.clientWidth-c.offsetWidth)/2;
  try{ cr.scrollTo({left:left,behavior:smooth&&!REDUCED?'smooth':'auto'}); }catch(e){ cr.scrollLeft=left; }
  if(!smooth)tdUpdateCenter(true);
  return true;
}
function tdUpdateCenter(force){
  const cr=document.getElementById('trCards'); if(cr.hidden||!cr.clientWidth)return;
  const r=cr.getBoundingClientRect(), mid=r.left+r.width/2; let best=null, bd=Infinity;
  for(const c of cr.children){ const b=c.getBoundingClientRect(), d=Math.abs(b.left+b.width/2-mid); if(d<bd){ bd=d; best=c; } }
  if(!best||(!force&&best.dataset.sid===TD.center))return;
  TD.center=best.dataset.sid;
  for(const c of cr.children){ const on=c===best; c.classList.toggle('cur',on); c.tabIndex=on?0:-1; c.setAttribute('aria-current',on?'true':'false'); }
  const pr=tdProposal(); TD.chosen=TD.center===pr.id?null:TD.center;
  tdOnCenter(TD.center,pr);
}
// le bouton principal (et un toucher sur la carte au centre)
function tdStart(){
  const pr=tdProposal();
  if(pr.st==='vide'){ openProgramEditor(); return; }
  if(tdResting(pr)){ TD.train=true; TD.chosen=null; tdRender(); return; }
  const id=TD.center||tdCurrent(pr); if(id)openSession(id);
}
// La séance ouverte, seule : ses exercices et leurs séries ; le retour, en haut, ramène à l'entrée
function openSession(sid,o){
  if(!tdById(sid))return;
  if(weekOffset!==0){ weekOffset=0; load(); }
  if(openCard!==sid&&!(o&&o.keep))LG.open=null;
  openCard=sid;
  showView('training','seance');
  render(); window.scrollTo(0,0); focusTitle('training');
}
// titre de la séance ouverte : son nom ; dessous, où elle en est dans la semaine
function tdSesHead(){
  const s=tdById(openCard), ps=document.querySelector('#v-training > .ps');
  if(!s){ if(ps&&!ps.hidden&&curView==='training')setHub('training',true); return; }   // séance retirée du programme
  const pr=tdProposal(), st=tdStatus(s);
  document.getElementById('trSesT').textContent=s.name;
  document.getElementById('trSesS').textContent=st.k!=='done'&&s.id===pr.id&&pr.st==='jour'?'Séance du jour':st.t;
}

(function(){
  const cr=document.getElementById('trCards');
  cr.addEventListener('scroll',()=>{ if(!TD.raf)TD.raf=requestAnimationFrame(()=>{ TD.raf=0; tdUpdateCenter(false); }); },{passive:true});
  // toucher une carte de côté la centre ; toucher celle du centre la lance
  cr.addEventListener('click',e=>{ const c=e.target.closest('.tc'); if(!c)return; if(c.dataset.sid!==TD.center)tdCenterOn(c.dataset.sid,true); else tdStart(); });
  cr.addEventListener('keydown',e=>{
    const c=e.target.closest('.tc'); if(!c)return;
    const list=[...cr.children], i=list.indexOf(c), j={ArrowRight:i+1,ArrowLeft:i-1,Home:0,End:list.length-1}[e.key];
    if(j==null||j<0||j>=list.length)return;
    e.preventDefault(); tdCenterOn(list[j].dataset.sid,true); try{ list[j].focus({preventScroll:true}); }catch(err){}
  });
  document.getElementById('thBack').onclick=()=>{
    const act=document.getElementById('thBack').dataset.act; TD.chosen=null;
    if(act==='rest'){ TD.train=false; tdRender(); } else tdCenterOn(tdProposal().id,true);
  };
  // hors ligne, une illustration pas encore gardée en cache (elles le sont au premier affichage) : le motif
  cr.addEventListener('error',e=>{
    const im=e.target; if(!im||im.tagName!=='IMG')return;
    const cov=im.closest('.tc-cov'), c=im.closest('.tc'), s=c&&tdById(c.dataset.sid); if(!cov||!s)return;
    const w=tdWord(s); cov.className='tc-cov pat'; cov.innerHTML='<b'+(w.length>7?' class="long"':'')+'>'+esc(w)+'</b>';
  },true);
  document.getElementById('trGo').onclick=tdStart;
  document.getElementById('thRest').addEventListener('click',e=>{ const b=e.target.closest('[data-sp]'); if(b)goSession('sp:'+b.dataset.sp); });
  window.addEventListener('resize',()=>{ if(curView==='training'&&TD.center)tdCenterOn(TD.center,false); });
})();

// Branchement : chaque rendu met l'entrée et la séance ouverte à jour ; arriver dans Training depuis
// une autre partie repart de la proposition de Ren ; l'entrée se recentre quand elle réapparaît.
const _rJ=render; render=function(){ _rJ(); try{ tdRender(); tdSesHead(); }catch(e){ console.error(e); } };
const _svJ=showView; showView=function(v,sub,focus){ if(v==='training'&&curView!=='training'){ TD.chosen=null; TD.train=false; } return _svJ(v,sub,focus); };
const _shJ=setHub; setHub=function(v,on){ _shJ(v,on); if(v==='training'&&on){ try{ tdRender(); }catch(e){ console.error(e); } } };
tdRender();
