// ===== Accueil : le personnage (rang, XP, sa phrase, les infos du jour), la roue des parties, la progression =====
// L'XP est calculée uniquement à partir des données déjà enregistrées (lecture seule) : aucune donnée ni aucun calcul existant n'est modifié.
const XP={ex:5,ses:50,bras:25,swim:30,prot:15,habit:5,meal:2,mealCap:5,measure:10,photo:25,week:100};
const RANKS=[['E',0],['D',400],['C',1500],['B',4500],['A',10000],['S',20000],['SS',35000]];
const DAYL=['L','M','M','J','V','S','D'];
const DAYFULL=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const ETAT_L={repos:'Au repos',pret:'Prêt',concentre:'Concentré',forme:'En forme',zone:'Dans la zone'};
let PROT_GOAL=190;
const REDUCED=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
let lastXP=null, valSnap=null, moTimer=null, toastTimer=null, curView='home', WHEEL=null;
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function nf(n){ return Math.round(n).toLocaleString('fr-FR'); }
// chiffres en Bebas Neue : espace insécable ordinaire (l'espace fine n'existe pas dans la police)
function nfD(n){ return nf(n).replace(/\u202f/g,'\u00a0'); }
function lvlOf(xp){ return Math.floor(Math.sqrt(Math.max(0,xp)/25))+1; }
function lvlPct(xp){ const L=lvlOf(xp), a=25*(L-1)*(L-1), b=25*L*L; return Math.max(0,Math.min(100,(xp-a)/(b-a)*100)); }
function rankIdx(xp){ let r=0; RANKS.forEach((x,i)=>{ if(xp>=x[1])r=i; }); return r; }
function sesInfo(id,st){ return (st||state).prog.s.find(x=>x.id===id)||{id:id,name:id,sub:'',ex:[]}; }
function subLabel(s){ const t=String(s.sub||'').toLowerCase().replace(' + ',' et ').replace(' — ',', '); return t.charAt(0).toUpperCase()+t.slice(1); }
function todayIdx(){ return (new Date().getDay()+6)%7; }
function storedWeekKeys(){
  const ks=new Set();
  skeys().forEach(k=>{ if(k.indexOf('fitweek:')===0)ks.add(k); });
  return ks;
}
function weekXP(st){ return TR.weekXP(st,XP); }
function totalXP(){
  let xp=0; const cur=keyFor(weekOffset).k; const ks=storedWeekKeys(); ks.add(cur);
  ks.forEach(k=>{ const st=k===cur?state:readWeek(k); if(st)xp+=weekXP(st); });
  Object.keys(foodlog).forEach(d=>{ xp+=Math.min((foodlog[d]||[]).length,XP.mealCap)*XP.meal; });
  const wk=new Set(); bodylog.forEach(e=>{ const p=String(e.d||'').split('-'); if(p.length===3){ const iw=isoWeek(new Date(+p[0],+p[1]-1,+p[2])); wk.add(iw.year+'-'+iw.week); } }); xp+=wk.size*XP.measure;
  const mo=new Set(); photos.forEach(ph=>{ if(ph&&ph.d)mo.add(String(ph.d).slice(0,7)); }); xp+=mo.size*XP.photo;
  return xp;
}
function curWeekState(){ if(weekOffset===0)return state; const v=sget(keyFor(0).k); if(!v)return blankState(); try{ return migrate(JSON.parse(v),true); }catch(e){ return blankState(); } }
function sessionsDone(st){ return TR.sessionsDone(st); }
function etatFor(){
  const st=curWeekState(), sc=weekScore(st), ti=todayIdx();
  let k; if(sc<15)k=ti<=1?'pret':'repos'; else if(sc<40)k='pret'; else if(sc<60)k='concentre'; else if(sc<80)k='forme'; else k='zone';
  return {k:k,l:ETAT_L[k]};
}
function heroDateLabel(){ const d=new Date(); return DAYFULL[todayIdx()]+' '+(d.getDate()===1?'1er':d.getDate())+' '+d.toLocaleDateString('fr-FR',{month:'long'}); }
function setsOf(ex){ return (ex.sets||3)*(ex.each?2:1); }
// durée estimée avec les séries et le temps de repos de chaque exercice (même calcul que le constructeur)
function sessionMinutes(s){ return Math.max(15,TRUI.sessionMinutes(s)); }
// Repères de macros pour le jour choisi : protéines du profil, lipides = 30 % des calories, glucides = le reste
function macroTargets(){ const kc=dayTarget(), p=PROT_GOAL, l=Math.round(kc*0.30/9), g=Math.max(0,Math.round((kc-p*4-l*9)/4)); return {p:p,g:g,l:l}; }
function todayTotals(){ let k=0,p=0; (foodlog[todayStr()]||[]).forEach(e=>{ const f=foodById(e.fid); if(f){ k+=f.k*e.q; p+=f.p*e.q; } }); return {k:Math.round(k),p:Math.round(p)}; }
function todayTarget(){ const a=dayact[todayStr()]||{}; return {t:calbase+dayBonus(a),a:a}; }

function animNum(el,to){
  if(!el)return; const from=parseFloat(el.getAttribute('data-v')||'0'); el.setAttribute('data-v',to);
  if(REDUCED||from===to){ el.textContent=nfD(to); return; }
  if(el._raf)cancelAnimationFrame(el._raf);
  const t0=performance.now(), dur=480;
  const step=t=>{ const k=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-k,3); el.textContent=nfD(from+(to-from)*e); if(k<1)el._raf=requestAnimationFrame(step); };
  el._raf=requestAnimationFrame(step);
}
// Infos du jour, tuile de droite : les calories qui restent (ou le dépassement) et les protéines
function renderToday(){
  const n=document.getElementById('tdKcalN'); if(!n)return;
  const tt=todayTotals(), tg=todayTarget(), left=tg.t-tt.k, over=left<0;
  document.getElementById('tdKcalK').textContent=over?'Objectif dépassé':'Il te reste';
  n.textContent=(over?'+'+nf(-left):nf(left))+' kcal';
  document.getElementById('tdKcalP').textContent='Protéines '+nf(tt.p)+' / '+nf(PROT_GOAL)+' g';
  const b=document.getElementById('tdKcalB'); if(b)b.style.width=Math.max(0,Math.min(100,tg.t?tt.k/tg.t*100:0))+'%';
  document.getElementById('tdKcal').setAttribute('aria-label',(over?'Objectif dépassé de '+nf(-left):'Il te reste '+nf(left))+' kilocalories, protéines '+nf(tt.p)+' grammes sur '+nf(PROT_GOAL)+'. Voir la nutrition');
  renderNutritionHub();      // mêmes chiffres à l'entrée de la Nutrition (objectif de protéines du profil compris)
}
const RANK_T={E:['e','Recrue'],D:['e','Initié'],C:['c','Confirmé'],B:['c','Aguerri'],A:['a','Élite'],S:['s','Maître'],SS:['s','Légende']};
let lastLevel=null;
// Infos du jour, tuile de gauche : la séance du jour (ou le sport, ou le repos) et où elle en est.
// goalT garde le nom puis le détail (<span>), comme l'ancienne carte.
function renderGoal(){
  const ti=todayIdx(), st=curWeekState(), pd=planOfSnap(st.prog)[ti];
  let t, sub='', meta, target, prog=-1, ov='Séance du jour', st2='todo';
  if(pd.t==='m'){
    const s=sesInfo(pd.id,st), arr=st.training[pd.id], done=arr.filter(Boolean).length, tot=s.ex.length, ok=TR.isValidated(st,s);
    t=s.name; sub=subLabel(s); target=pd.id;
    if(ok){ st2='done'; meta='Validée, bravo'; }
    else if(done){ st2='prog'; meta='En cours · '+done+'/'+tot; prog=tot?done/tot*100:0; }
    else meta=sessionMinutes(s)+' min · '+tot+' exercice'+(tot>1?'s':'');
  } else if(pd.t==='s'){
    // un sport (natation, course…) : sa durée, coché ou pas
    const sp=TR.sportOf(TR.snapSports(st.prog).find(e=>e.id===pd.sp)||{id:pd.sp}), fl=st.sport[pd.sp]||[], did=!!fl[pd.i];
    t=sp.n; sub=sp.sub; target='sp:'+sp.id; ov='Aujourd’hui';
    if(did){ st2='done'; meta=sp.a==='la'?'Faite':sp.a==='le'?'Fait':'C’est fait'; } else meta='≈ '+TR.fmtMin(sp.min)+' · bonus';
  } else {
    t='Repos'; sub='Jour off'; target='program'; ov='Aujourd’hui'; st2='rest';
    const op=weekOpt(st).filter(x=>!x.gone)[0]; meta=op?op.name+' si tu veux':'Récupère bien';
  }
  document.getElementById('goalOv').textContent=ov;
  document.getElementById('goalT').innerHTML=esc(t)+(sub?'<span>'+esc(sub)+'</span>':'');
  const M=document.getElementById('goalM'); M.textContent=meta; M.setAttribute('data-st',st2);
  const BW=document.getElementById('goalBarW'), BF=document.getElementById('goalBar');
  if(BW){ BW.hidden=prog<0; if(BF)BF.style.width=Math.max(0,prog)+'%'; }
  const B=document.getElementById('goalB'); B.setAttribute('data-target',target);
  B.setAttribute('aria-label',ov+' : '+t+(sub?', '+sub:'')+'. '+meta);
}
function renderHome(xp){
  const hd=document.getElementById('hd'); if(!hd)return;
  const L=lvlOf(xp), start=25*(L-1)*(L-1), next=25*L*L, ri=rankIdx(xp), rk=RANKS[ri][0], et=etatFor(), rt=RANK_T[rk];
  hd.setAttribute('data-etat',et.k);
  document.getElementById('hzDate').textContent=heroDateLabel();
  document.getElementById('hzRank').textContent=rk;
  const em=document.getElementById('hzRankEm'); em.setAttribute('data-tier',rt[0]); em.classList.toggle('ss',rk==='SS');
  document.getElementById('hzRankT').textContent=rt[1];
  const nr=RANKS[ri+1], nxt=nr?'Rang '+nr[0]+' dans '+nf(nr[1]-xp)+' XP':'Rang maximal atteint';
  const rn=document.getElementById('hzRankNx'); if(rn)rn.textContent=nxt;
  document.getElementById('hzRankBtn').setAttribute('aria-label','Rang '+rk+', '+rt[1]+'. '+nxt+'. Voir ta progression');
  const lv=document.getElementById('hzLvl'), bar=document.getElementById('hzBar'), pct=Math.max(2,lvlPct(xp));
  bar._pct=pct;
  if(lastLevel!==null&&L>lastLevel&&!REDUCED){
    // Montée de niveau : la barre se remplit, repart de zéro, puis rejoint la progression du nouveau niveau
    bar._anim=true; clearTimeout(bar._lt); bar.style.width='100%';
    bar._lt=setTimeout(()=>{ bar.style.transition='none'; bar.style.width='0%'; void bar.offsetWidth; bar.style.transition=''; bar.style.width=bar._pct+'%'; bar._anim=false; },750);
    lv.classList.remove('lvlup'); void lv.offsetWidth; lv.classList.add('lvlup');
  } else if(!bar._anim){ bar.style.width=pct+'%'; }
  lastLevel=L;
  lv.textContent=L;
  document.getElementById('hzNext').textContent=nf(next-xp)+' XP avant le niveau '+(L+1);
  const hx=document.getElementById('hzXp'); if(hx)hx.textContent=nf(xp-start)+' / '+nf(next-start)+' XP sur le niveau '+L;
  const he=document.getElementById('hzEtat'); if(he)he.textContent=et.l;
  renderGoal(); renderToday(); renderHeroTexts(); renderHomeWeek();
}
// Accueil, en bas : la semaine (séances faites sur prévues, et la note de la semaine en barre)
function renderHomeWeek(){
  const t=document.getElementById('hdWkT'), b=document.getElementById('hdWkB'); if(!t||!b)return;
  const st=curWeekState(), n=sessionsDone(st), tot=TR.mainCount(st), sc=Math.round(weekScore(st));
  t.textContent=n+' séance'+(n>1?'s':'')+' sur '+tot;
  b.style.width=Math.max(2,Math.min(100,sc))+'%';
  document.getElementById('hdWk').setAttribute('aria-label','Ta semaine : '+n+' séance'+(n>1?'s':'')+' sur '+tot+'. Voir la progression');
}
function coachSaved(){ try{ return JSON.parse(sget('coach')||'null'); }catch(e){ return null; } }
// Entrée de la Nutrition : le jour en une ligne, la phrase de Ren, le détail de chaque tuile
function renderNutritionHub(){
  const say=document.getElementById('nhSay'); if(!say)return;
  const tt=todayTotals(), tg=todayTarget(), left=tg.t-tt.k, pl=Math.max(0,PROT_GOAL-tt.p), n=(foodlog[todayStr()]||[]).length;
  // (le coach est relu dans le stockage : ce rendu peut passer avant la déclaration de COACH, plus loin)
  const co=coachSaved(), tough=!!co&&co.tone==='exigeant';
  document.getElementById('nhSub').textContent=nf(tt.k)+' kcal sur '+nf(tg.t)+', protéines '+nf(tt.p)+' / '+nf(PROT_GOAL)+' g';
  let line;
  if(!n)line=tough?'Rien de noté aujourd’hui. Photo de ton assiette, maintenant.':'Rien de noté aujourd’hui. Prends ton assiette en photo, je m’occupe du reste.';
  else if(left<0)line=tough?'Objectif dépassé de '+nf(-left)+' kcal. On se recadre demain.':'Objectif dépassé de '+nf(-left)+' kcal. Pas grave, demain on repart.';
  else if(!pl)line='Protéines validées. Il te reste '+nf(left)+' kcal.';
  else line='Il te reste '+nf(left)+' kcal, dont '+nf(pl)+' g de protéines à trouver.';
  say.innerHTML=sayTwoTone(line.replace(/ ([?!:;])/g,'\u00a0$1').replace(/(\d) (g|kcal)\b/g,'$1\u00a0$2'));
  const who=document.getElementById('nhWho'), id=co&&co.id==='aya'?'aya':'ren';
  if(who)who.textContent=id==='aya'?'Aya':'Ren';
  const hub=document.getElementById('nutHub'); if(hub)hub.classList.toggle('no-fig',id!=='ren');
  // (textes courts : une tuile fait une demi-largeur de téléphone)
  document.getElementById('nhMeals').textContent=n?n+' aujourd’hui':'Aucun encore';
  document.getElementById('nhProt').textContent=nf(tt.p)+' / '+nf(PROT_GOAL)+' g';
  const dot=document.getElementById('calDot');
  document.getElementById('nhGoal').textContent=dot&&!dot.hidden?'Nouvelle base':nf(tg.t)+' kcal';
}
// Le personnage de l'accueil : Ren illustré, ou l'avatar si on l'a choisi dans Profil, Accueil
function heroIsAvatar(){ return document.getElementById('hd').classList.contains('av-on'); }
function renderHeroTexts(){
  const av=heroIsAvatar(), who=av?'ton personnage':'Ren';
  const b=document.getElementById('hdRen'); if(b)b.setAttribute('aria-label',(av?'Ton personnage':'Ren')+' : choisir où aller');
  const h=document.getElementById('hdHint'); if(h)h.textContent='Touche '+who+' pour choisir où aller';
}
function renderWeekStrip(){
  const box=document.getElementById('wkDays'); if(!box)return; box.innerHTML='';
  const ti=weekOffset===0?todayIdx():-1;
  planOfSnap(state.prog).forEach((p,i)=>{
    const d=document.createElement('div'); d.className='dy'+(i===ti?' today':''); d.setAttribute('role','listitem');
    let h=0, cls='', lab='Repos';
    if(p.t==='m'){ const s=sesInfo(p.id), done=state.training[p.id].filter(Boolean).length, tot=s.ex.length; h=TR.isValidated(state,s)?100:(tot?Math.round(done/tot*100):0); lab=s.name+', '+done+' sur '+tot; }
    else if(p.t==='s'){ const ok=!!(state.sport[p.sp]||[])[p.i], sp=TR.sportOf(TR.snapSports(state.prog).find(e=>e.id===p.sp)||{id:p.sp}); h=ok?100:0; cls='sw'; lab=sp.n+(ok?', c’est fait':', à faire'); }
    const prot=state.nutrition[i+1].protein>=6;
    d.setAttribute('aria-label',DAYFULL[i]+' : '+lab+(prot?', protéines validées':''));
    d.innerHTML='<div class="dy-b'+(p.t==='r'?' rest':'')+'">'+(p.t==='r'?'':'<i class="'+cls+'" style="height:'+h+'%"></i>')+'</div><span class="dy-d'+(prot?' on':'')+'"></span><span class="dy-l" aria-hidden="true">'+DAYL[i]+'</span>';
    box.appendChild(d);
  });
}
function renderProgress(xp){
  const le=document.getElementById('rkL'); if(!le)return;
  const L=lvlOf(xp), ri=rankIdx(xp), rk=RANKS[ri][0], nr=RANKS[ri+1];
  le.textContent=rk; le.classList.toggle('ss',rk==='SS');
  const rt=document.getElementById('rkT'); if(rt)rt.textContent='Rang '+rk+' · '+RANK_T[rk][1];
  document.getElementById('rkLvl').textContent='Niveau '+L;
  document.getElementById('rkXp').textContent=nf(xp)+' XP au total';
  if(nr){ const span=nr[1]-RANKS[ri][1];
    document.getElementById('rkTo').textContent='Vers le rang '+nr[0];
    document.getElementById('rkRem').textContent=nf(nr[1]-xp)+' XP restants';
    document.getElementById('rkBar').style.width=Math.max(2,(xp-RANKS[ri][1])/span*100)+'%'; }
  else { document.getElementById('rkTo').textContent='Rang maximal atteint'; document.getElementById('rkRem').textContent=''; document.getElementById('rkBar').style.width='100%'; }
  const ol=document.getElementById('rkLadder'); ol.innerHTML='';
  for(let i=RANKS.length-1;i>=0;i--){ const r=RANKS[i], li=document.createElement('li');
    li.className='rkr'+(i<ri?' past':(i===ri?' cur':(i===ri+1?' next':'')));
    const mark= i===ri?'<span class="rkm">Tu es ici</span>':(i===ri+1?'<span class="rkm dim">Prochain</span>':(i<ri?'<svg width="14" height="11" viewBox="0 0 14 11" role="img" aria-label="Atteint"><path d="M1 5.5l4 4L13 1.5" stroke="#C5A3FF" stroke-width="2" fill="none"/></svg>':''));
    li.innerHTML='<span class="rkl">'+r[0]+'</span><span class="rkx"><b>'+RANK_T[r[0]][1]+'</b><small>'+(r[1]?nf(r[1])+' XP':'Départ')+'</small></span>'+mark;
    ol.appendChild(li); }
  document.getElementById('pgSub').textContent='Rang '+rk+', niveau '+L+', '+etatFor().l.toLowerCase();
  renderWeekStrip();
  const ws=document.getElementById('wkSub');
  if(ws)ws.textContent=(weekOffset===0?'Cette semaine':'Semaine passée')+', '+weekLabel(weekOffset);
}
function renderSummaries(xp){
  const st=state, n=sessionsDone(st), ti=todayIdx();
  document.getElementById('trmeta').textContent=n+' séance'+(n>1?'s':'')+' sur '+TR.mainCount(st)+' cette semaine';
  let p=0,c=0; for(let d=1;d<=7;d++){ if(st.nutrition[d].protein>=6)p++; if(st.nutrition[d].crea)c++; }
  document.getElementById('nutmeta').textContent=(weekOffset===0?'Cette semaine':'Cette semaine-là')+' : protéines validées '+p+' jour'+(p>1?'s':'')+' sur 7, créatine '+c+' sur 7.';
  const t=dayTotals(); document.getElementById('dtot').textContent=nf(t.k)+' kcal, '+t.p+' g de protéines';
  // protéines, glucides et lipides du jour choisi, dans la carte des calories. Repères : les
  // protéines du profil, les lipides à 30 % de l'objectif calorique, les glucides pour le reste.
  const mt=macroTargets();
  [['Prot',t.p,mt.p],['Gluc',t.g,mt.g],['Lip',t.l,mt.l]].forEach(([k,v,g])=>{
    const ve=document.getElementById('cal'+k+'V'), be=document.getElementById('cal'+k+'B'); if(!ve)return;
    ve.innerHTML='<b>'+nf(v)+'</b> / '+nf(g)+' g'; if(be)be.style.width=Math.max(0,Math.min(100,g?v/g*100:0))+'%'; });
  const mn=document.getElementById('calMacN');
  if(mn){ mn.hidden=!t.miss; if(t.miss)mn.textContent=t.miss+' aliment'+(t.miss>1?'s':'')+' sans glucides ni lipides : complète-les dans Ajouter un aliment, Gérer mes aliments.'; }
  const rp=document.getElementById('calRep');
  if(rp)rp.textContent='Repères du jour : '+nf(mt.p)+' g de protéines, '+nf(mt.l)+' g de lipides (30 % des calories) et '+nf(mt.g)+' g de glucides (le reste).';
  const md=document.getElementById('mealday');
  if(md){ const sd=selDay<0?0:selDay; const dd=new Date(keyFor(weekOffset).monday); dd.setDate(dd.getDate()+sd);
    md.textContent=(weekOffset===0&&sd===ti)?'Repas d’aujourd’hui':'Repas du '+DAYFULL[sd].toLowerCase()+' '+(dd.getDate()===1?'1er':dd.getDate())+' '+dd.toLocaleDateString('fr-FR',{month:'long'}); }
  const np=document.getElementById('nutPast'); if(np)np.hidden=(weekOffset===0);
  const L=lvlOf(xp), rk=RANKS[rankIdx(xp)][0];
  document.getElementById('pfSub').textContent='Niveau '+L+', rang '+rk+', '+nf(xp)+' XP';
  // carte d'identité du profil : barre du niveau, rang sur le portrait
  const pb2=document.getElementById('pfBar'); if(pb2)pb2.style.width=Math.max(2,lvlPct(xp))+'%';
  const pn=document.getElementById('pfNx'); if(pn)pn.textContent=nf(25*L*L-xp)+' XP avant le niveau '+(L+1);
  const pr=document.getElementById('pfRank'); if(pr){ pr.textContent=rk; pr.setAttribute('data-tier',RANK_T[rk][0]); }
  document.getElementById('pfCal').textContent=nf(calbase)+' kcal';
}
function renderHistSummary(){
  const s=computeStreak();
  const sm=document.getElementById('streakmeta'); if(sm)sm.textContent='';
  const sub=document.getElementById('sksub'); if(sub)sub.textContent=s>0?(s>=4?'Série solide, continue comme ça.':'Belle régularité, continue.'):'Valide une semaine à 60 % pour lancer ta série.';
}
function validatedSet(st){ return TR.validatedIds(st); }
function refreshV3(init){
  const xp=totalXP(), k=keyFor(weekOffset).k, cur=validatedSet(state);
  let newly=null;
  if(!init&&valSnap&&valSnap.k===k){ cur.forEach(id=>{ if(!newly&&!valSnap.set.has(id))newly=id; }); }
  valSnap={k:k,set:cur};
  const prev=lastXP;
  renderHome(xp); renderProgress(xp); renderSummaries(xp);
  if(!init&&prev!=null){
    if(newly)showMoment(newly,xp-prev,prev,xp);
    else if(xp>prev)xpToast(xp-prev);
  }
  lastXP=xp;
}
function showMoment(id,gain,x0,x1){
  const m=document.getElementById('moment'); if(!m)return;
  const s=sesInfo(id), l0=lvlOf(x0), l1=lvlOf(x1), up=l1>l0;
  document.getElementById('moK').textContent= (id==='brasX'&&s.name==='Bras Express')?'Bras Express, à la maison':s.name+(s.sub?', '+subLabel(s).toLowerCase():'');
  document.getElementById('moGain').textContent='+'+gain+' XP';
  const lv=document.getElementById('moLvl'); lv.textContent='Niveau '+l1; lv.hidden=!up;
  const r0=rankIdx(x0), r1=rankIdx(x1), mr=document.getElementById('moRk');
  // nouveau rang : il prend la place du niveau, à droite des XP gagnées
  if(mr){ mr.hidden=!(r1>r0); if(r1>r0){ lv.hidden=true; const k=RANKS[r1][0], t=RANK_T[k]; document.getElementById('moRkL').textContent=k; document.getElementById('moRkT').textContent=t[1];
    const em=document.getElementById('moRkEm'); em.setAttribute('data-tier',t[0]); em.classList.toggle('ss',k==='SS'); } }
  const bar=document.getElementById('moBar');
  bar.style.setProperty('--from',lvlPct(x0)+'%'); bar.style.setProperty('--to',(up?100:lvlPct(x1))+'%');
  document.getElementById('moChar').src=document.getElementById('poseZone').src;
  m.hidden=false;
  setTimeout(()=>{ const b=document.getElementById('moBtn'); if(b&&b.focus){ try{ b.focus({preventScroll:true}); }catch(e){} } },60);
  clearTimeout(moTimer); moTimer=setTimeout(hideMoment,3800);
}
function hideMoment(){ const m=document.getElementById('moment'); if(m)m.hidden=true; clearTimeout(moTimer); }
function xpToast(n){
  const t=document.getElementById('xpToast'); if(!t)return;
  t.textContent='+'+n+' XP'; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('on'),1400);
}
function goToday(){ const ti=todayIdx(); if(weekOffset!==0){ weekOffset=0; openCard=null; load(); } selDay=ti; render(); }
// Une partie de l'app à la fois. L'accueil n'a pas de maison ; les autres parties en ont une, en bas.
// focus : arrivée depuis la roue, le titre de la partie prend le focus (clavier, lecteur d'écran).
function showView(v,sub,focus){
  const was=curView; curView=v;
  if(v!=='home'&&WHEEL)WHEEL.close();
  document.querySelectorAll('.view').forEach(s=>{ s.hidden=s.getAttribute('data-view')!==v; });
  document.documentElement.classList.toggle('at-home',v==='home');
  document.documentElement.classList.remove('at-hub');
  // une partie à rubriques en tuiles s'ouvre sur son entrée, sauf si on demande une rubrique
  if(hubOf(v)){ if(sub)openSub(v,sub); else setHub(v,true); }
  else if(sub)showSub(v,sub,false);
  window.scrollTo(0,0);
  if(v==='home'&&was!=='home')replayHome();
  if(focus)focusTitle(v);
  tabSync();
}
function focusTitle(v){
  const hub=hubOf(v), t=document.querySelector(hub&&!hub.hidden?'#v-'+v+' .ph-t':'#v-'+v+' .vh-t');
  if(t)try{ t.focus({preventScroll:true}); }catch(e){}
}
// Parties à rubriques en tuiles (la Nutrition pour l'instant) : l'entrée (Ren, sa phrase, les tuiles),
// puis une rubrique à la fois, avec un retour vers l'entrée en haut et la maison en bas.
function hubOf(v){ const view=document.getElementById('v-'+v); return view?view.querySelector(':scope > .ph'):null; }
function setHub(v,on){
  const view=document.getElementById('v-'+v), hub=hubOf(v); if(!hub)return;
  hub.hidden=!on; const ps=view.querySelector(':scope > .ps'); if(ps)ps.hidden=on;
  if(curView===v)document.documentElement.classList.toggle('at-hub',on);
  if(on)replayHub(hub);
}
function openSub(v,key,focus){ setHub(v,false); showSub(v,key,false); window.scrollTo(0,0); if(focus)focusTitle(v); }
function replayHub(hub){ if(REDUCED)return; hub.classList.remove('enter'); void hub.offsetWidth; hub.classList.add('enter'); }
// Catégories d'une partie (Nutrition, Progression, Corps) : une seule visible à la fois. Les éléments
// marqués data-panels="a b" ne s'affichent qu'avec ces catégories (le choix du jour, par exemple).
const SUB_CUR={};
function showSub(v,key,scroll){
  const view=document.getElementById('v-'+v); if(!view)return;
  const panels=[...view.querySelectorAll('[data-panel]')]; if(!panels.length)return;
  if(!panels.some(p=>p.dataset.panel===key))key=panels[0].dataset.panel;
  const changed=SUB_CUR[v]!==key; SUB_CUR[v]=key;
  if(hubOf(v)&&curView===v)setHub(v,false);
  const nav=view.querySelector('.sub[role="tablist"]'), tabs=nav?[...nav.querySelectorAll('[role="tab"]')]:[];
  tabs.forEach(t=>{ const on=t.dataset.p===key; t.setAttribute('aria-selected',on?'true':'false'); t.tabIndex=on?0:-1; });
  panels.forEach(p=>{ p.hidden=p.dataset.panel!==key; });
  view.querySelectorAll('[data-panels]').forEach(e=>{ e.hidden=!e.dataset.panels.split(' ').includes(key); });
  // rubrique ouverte depuis une tuile : son nom en titre
  const cur=panels.find(p=>p.dataset.panel===key), t=view.querySelector('.vh-sub .vh-t'); if(t&&cur&&cur.dataset.name)t.textContent=cur.dataset.name;
  if(changed&&scroll!==false&&nav){ const top=nav.getBoundingClientRect().top; if(top<0)window.scrollTo(0,Math.max(0,window.scrollY+top-12)); }
}
document.querySelectorAll('.sub[data-sub]').forEach(nav=>{
  nav.addEventListener('click',e=>{ const t=e.target.closest('[role="tab"]'); if(t)showSub(nav.dataset.sub,t.dataset.p); });
  nav.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    const tabs=[...nav.querySelectorAll('[role="tab"]')], i=tabs.indexOf(document.activeElement); if(i<0)return;
    e.preventDefault();
    const j=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    tabs[j].focus(); showSub(nav.dataset.sub,tabs[j].dataset.p);
  });
  showSub(nav.dataset.sub,null,false);
});
// Retour à l'accueil : le personnage et les infos du jour réapparaissent
function replayHome(){
  if(REDUCED)return;
  const hd=document.getElementById('hd'); if(!hd)return;
  hd.classList.remove('enter'); void hd.offsetWidth; hd.classList.add('enter');
}
function scrollToEl(el,block){ if(el&&el.scrollIntoView)setTimeout(()=>el.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:block||'start'}),60); }
// La séance du jour (tuile de l'accueil) : la séance s'ouvre directement ; un sport, sa ligne dans Sports
function goSession(target){
  const sp=target==='swim'?'natation':String(target||'').indexOf('sp:')===0?target.slice(3):null;
  goToday();
  if(!sp){ if(target&&state.prog.s.some(s=>s.id===target))openSession(target); else showView('training'); return; }
  showView('sports');
  scrollToEl([...document.querySelectorAll('#v-sports .sport')].find(r=>r.dataset.sp===sp)||null,'start');
}

// Entrées des parties : une tuile ouvre sa rubrique (data-sub) ou lance son action (data-act) ;
// le retour, en haut d'une rubrique, ramène à l'entrée
document.querySelectorAll('.view.part').forEach(view=>{
  const v=view.dataset.view;
  view.addEventListener('click',e=>{
    const t=e.target.closest('.ph-tile');
    if(t){ if(t.dataset.sub)openSub(v,t.dataset.sub,true); else if(t.dataset.act)hubAct(v,t.dataset.act); return; }
    if(e.target.closest('[data-back]')){ setHub(v,true); window.scrollTo(0,0); focusTitle(v); }
  });
});
function hubAct(v,act){
  if(v==='nutrition'){ goToday(); if(act==='photo')aiPhotoPick(); else if(act==='add')openPicker(); else if(act==='scan')scanOpen('meal'); }
}
document.getElementById('goalB').onclick=()=>{ const tgt=document.getElementById('goalB').getAttribute('data-target'); if(tgt==='program'){ goToday(); showView('training'); } else goSession(tgt); };
document.getElementById('tdKcal').onclick=()=>{ goToday(); showView('nutrition','repas'); };
document.getElementById('hzRankBtn').onclick=()=>showView('progress','rang');
document.getElementById('hdWk').onclick=()=>showView('progress','semaines');
document.getElementById('pfFaceBtn').onclick=()=>showView('progress','rang');
// Barre de navigation : Accueil, Menu (la roue « Où on va ? »), Progression, Profil.
// Les parties ouvertes depuis la roue (Training, Nutrition, Sports, Corps) allument le Menu.
function tabSync(){
  const wh=WHEEL&&WHEEL.isOpen();
  const cur=wh?'menu':curView==='home'?'home':curView==='progress'?'progress':curView==='profile'?'profile':'menu';
  document.querySelectorAll('#mainnav .nv').forEach(b=>{ if(b.dataset.tab===cur)b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
}
document.getElementById('homeBtn').onclick=()=>{ if(WHEEL&&WHEEL.isOpen())WHEEL.close(); showView('home'); };
document.getElementById('menuBtn').onclick=()=>{ if(curView!=='home')showView('home'); if(WHEEL&&!WHEEL.isOpen())WHEEL.open(); else if(WHEEL)WHEEL.close(); tabSync(); };
document.getElementById('progBtn').onclick=()=>showView('progress');
document.getElementById('profBtn').onclick=()=>showView('profile');
document.getElementById('nutBack').onclick=()=>goToday();
document.getElementById('pfCalB').onclick=()=>document.getElementById('basebtn').click();
document.getElementById('moment').addEventListener('click',hideMoment);
document.addEventListener('keydown',e=>{ if(e.key==='Escape')hideMoment(); });

// La roue : le personnage au centre, une part par partie de l'app
WHEEL=HOME.mountWheel({
  host:document.getElementById('hd'), trigger:document.getElementById('hdRen'),
  // au centre : Ren (sa pose bras croisés, cadrée sur le buste), ou le buste de l'avatar
  centerSrc:()=>{ if(heroIsAvatar()){ const cv=document.getElementById('hdAv'); try{ if(cv&&cv.width){
      const n=Math.round(cv.width*0.5), c=document.createElement('canvas'); c.width=c.height=n;
      c.getContext('2d').drawImage(cv,Math.round((cv.width-n)/2),Math.round(cv.height*0.05),n,n,0,0,n,n); return c.toDataURL('image/png'); } }catch(e){} }
    const im=document.getElementById('hdFace'); return im?im.src:''; },
  onPick:(k)=>showView(k,null,true),
  onToggle:(on)=>{ document.documentElement.classList.toggle('wh-open',on); tabSync(); },
});
tabSync();

// Branchement sur les rendus existants (après eux, sans les modifier)
const _uhV3=updateHero; updateHero=function(){ _uhV3(); try{ refreshV3(false); }catch(e){ console.error(e); } };
const _rmV3=renderMeals; renderMeals=function(){ _rmV3(); try{ refreshV3(false); }catch(e){ console.error(e); } };
const _rbV3=renderBody; renderBody=function(){ _rbV3(); try{ renderBodySub(); refreshV3(false); }catch(e){ console.error(e); } };
const _rpV3=renderPhotos; renderPhotos=function(){ _rpV3(); try{ refreshV3(false); }catch(e){ console.error(e); } };
const _rhV3=renderHistory; renderHistory=function(){ _rhV3(); try{ renderHistSummary(); }catch(e){ console.error(e); } };
// une nouvelle base de calories proposée : la tuile Objectif le dit aussi
const _cnV3=calNotice; calNotice=function(r){ _cnV3(r); try{ renderNutritionHub(); }catch(e){ console.error(e); } };

// Corps : la dernière pesée sous le titre
function renderBodySub(){
  const el=document.getElementById('bdSub'); if(!el)return;
  const w=[...bodylog].reverse().find(e=>e.w!=null), t=[...bodylog].reverse().find(e=>e.t!=null);
  if(!w&&!t){ el.textContent='Aucune mesure pour l’instant'; return; }
  const parts=[]; if(w)parts.push(fmtV('w',w.w)+' kg'); if(t)parts.push('tour de taille '+fmtV('t',t.t)+' cm');
  const p=String((w||t).d).split('-'), d=new Date(+p[0],+p[1]-1,+p[2]);
  el.textContent=parts.join(', ')+', mesuré le '+d.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
}

showView('home');
refreshV3(true); renderHistSummary(); renderBodySub();
