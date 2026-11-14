// ---- Calories adaptatives selon l'entraînement du jour ----
const CAL_BONUS={m:250,n:200,b:100};
let dayact={}, calbase=2400;
function loadCal(){ let v=sget('dayact'); try{ dayact=v?JSON.parse(v):{}; }catch(e){ dayact={}; } if(!dayact||typeof dayact!=='object')dayact={}; let b=parseNum(sget('calbase')); if(b!=null&&b>0)calbase=Math.round(b); }
function saveDayact(){ try{ sset('dayact',JSON.stringify(dayact)); }catch(e){} }
function saveCalbase(){ try{ sset('calbase',String(calbase)); }catch(e){} }
function dayActFor(){ return dayact[selDateStr()]||{}; }
// Activité d'un jour : { m: muscu, b: Bras Express, n: natation (ancien format, +200),
// sp: { idSport: kcal ajoutées }, spn: { idSport: nom } (sport créé, absent du programme) }
function dayBonus(a){
  a=a||{}; let t=0; if(a.m)t+=CAL_BONUS.m; if(a.n)t+=CAL_BONUS.n; if(a.b)t+=CAL_BONUS.b;
  if(a.sp&&typeof a.sp==='object')for(const k in a.sp){ const v=+a.sp[k]; if(v>0&&v<5000)t+=Math.round(v); }
  return t;
}
function dayTarget(){ return calbase+dayBonus(dayActFor()); }
// Poids actuel : dernière pesée, sinon celui du profil (dépense des sports)
// (le profil est relu dans le stockage : ce fichier s'exécute avant celui qui déclare PROFILE)
function weightNow(){ for(let i=bodylog.length-1;i>=0;i--){ const w=+(bodylog[i]&&bodylog[i].w); if(w>0)return w; } const p=+(calProfile().weight||0); return p>0?p:null; }
function sportName(id,a){ const e=TR.sportEntry(PROGRAM,id); if(e||TR.sportById(id))return TR.sportOf(e||{id:id}).n; return (a&&a.spn&&a.spn[id])||'Autre sport'; }
// Puces du jour : muscu, les sports du programme, Bras, les sports ajoutés ce jour-là
function actChips(){
  const a=dayActFor(), sp=a.sp||{}, out=[['m','Muscu',CAL_BONUS.m,!!a.m]], seen=new Set();
  TR.sportsList(PROGRAM).forEach(e=>{
    const s=TR.sportOf(e); seen.add(s.id);
    const on=!!(sp[s.id]||(s.id==='natation'&&a.n));
    out.push(['sp:'+s.id,s.n,on?(sp[s.id]||CAL_BONUS.n):TR.sportKcal(s,weightNow()),on]);
  });
  out.push(['b','Bras',CAL_BONUS.b,!!a.b]);
  if(a.n&&!seen.has('natation')){ out.push(['sp:natation','Natation',CAL_BONUS.n,true]); seen.add('natation'); }
  for(const k in sp)if(!seen.has(k)&&+sp[k]>0)out.push(['sp:'+k,sportName(k,a),+sp[k],true]);
  return out;
}
function setDayAct(k,a){ ['m','n','b'].forEach(x=>{ if(!a[x])delete a[x]; }); if(a.sp&&!Object.keys(a.sp).length)delete a.sp; if(a.spn&&!Object.keys(a.spn).length)delete a.spn;
  if(!Object.keys(a).length)delete dayact[k]; else dayact[k]=a; saveDayact(); renderMeals(); }
function toggleAct(key){
  if(key==='more'){ addDaySport(); return; }
  const k=selDateStr(), a=JSON.parse(JSON.stringify(dayact[k]||{}));
  if(key.indexOf('sp:')===0){
    const id=key.slice(3); a.sp=a.sp||{};
    if(a.sp[id]||(id==='natation'&&a.n)){ delete a.sp[id]; if(id==='natation')delete a.n; if(a.spn)delete a.spn[id]; }
    else a.sp[id]=TR.sportKcal(TR.sportOf(TR.sportEntry(PROGRAM,id)||{id:id}),weightNow());
  } else a[key]=!a[key];
  setDayAct(k,a);
}
// Un sport fait ce jour-là, hors programme : on choisit le sport, puis sa durée
function addDaySport(){
  TRUI.openSportPicker({ title:'Sport du jour', weight:weightNow(), mine:Object.keys((dayActFor().sp)||{}), onPick:entry=>{
    const s=TR.sportOf(entry);
    TRUI.askNumber({ title:s.n, text:'Combien de temps ? Pour estimer ce que tu as dépensé.', value:s.min, min:5, max:300, step:5, unit:'min', fmt:TR.fmtMin, ok:'Ajouter' }).then(min=>{
      if(min==null)return;
      const k=selDateStr(), a=JSON.parse(JSON.stringify(dayact[k]||{})), kcal=TR.sportKcal(s,weightNow(),{min:min});
      a.sp=a.sp||{}; a.sp[s.id]=kcal; if(s.id==='natation')delete a.n;
      if(s.custom){ a.spn=a.spn||{}; a.spn[s.id]=s.n; }
      setDayAct(k,a); TRUI.toast(s.n+' : +'+kcal+' kcal');
    });
  } });
}
// Le chiffre phare de la Nutrition : ce qui reste à manger aujourd'hui (ou le dépassement)
function renderCalObj(){
  const tEl=document.getElementById('caltarget'); if(!tEl)return;
  const tgt=dayTarget(), eaten=dayTotals().k, left=tgt-eaten, n=x=>Math.round(x).toLocaleString('fr-FR');
  tEl.textContent='objectif '+n(tgt)+' kcal';
  document.getElementById('caleaten').textContent=n(eaten)+' mangée'+(eaten>1?'s':'');
  const lEl=document.getElementById('calleft'); lEl.textContent=nfD(Math.abs(left)); lEl.className='num '+(left>=0?'ok':'over');
  const lL=document.getElementById('calleftL'); if(lL)lL.textContent=left>=0?(left>1?'kcal restantes':'kcal restante'):'kcal au-dessus de l’objectif';
  const big=document.getElementById('calBig'); if(big)big.classList.toggle('over',left<0);
  const fill=document.getElementById('calfill'); fill.style.width=Math.max(0,Math.min(100, tgt>0? eaten/tgt*100:0))+'%'; fill.className = eaten>tgt?'over':'';
  const ac=document.getElementById('actchips');
  if(ac)ac.innerHTML=actChips().map(([k,l,v,on])=>'<button type="button" data-a="'+esc(k)+'" class="'+(on?'on':'')+'" aria-pressed="'+on+'">'+esc(l)+' <small>+'+n(v)+'</small></button>').join('')
    +'<button type="button" class="act-more" data-a="more"><svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.5v11M1.5 7h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Autre sport</button>';
  const bb=document.getElementById('basebtn'); if(bb)bb.textContent=n(calbase)+' kcal';
}
document.getElementById('actchips').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b)toggleAct(b.getAttribute('data-a')); });
document.getElementById('basebtn').onclick=()=>{ TRUI.askNumber({title:'Calories de base, jour de repos',text:'Plus 250 kcal les jours de muscu, 100 pour Bras Express ; pour la natation et les autres sports, selon la durée.',value:calbase,min:1200,max:4500,step:50,unit:'kcal'}).then(n=>{ if(n!=null&&n>0){ calbase=Math.round(n); saveCalbase(); renderMeals(); } }); };

loadFood(); loadCal(); renderMeals();
const _render=render; render=function(){ _render(); try{ renderMeals(); }catch(e){} };
