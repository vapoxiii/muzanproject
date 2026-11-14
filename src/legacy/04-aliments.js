// ---- Bibliothèque d'aliments + repas du jour ----
// Valeurs par portion : k kcal, p protéines, g glucides (hors fibres, comme sur les étiquettes), l lipides.
const FOOD_SEED=[
 {id:'f1',n:'Skyr nature',k:95,p:15,g:6,l:0.3,u:'pot 150g'},
 {id:'f2',n:'Fromage blanc 0%',k:47,p:8,g:4,l:0.2,u:'100 g'},
 {id:'f3',n:'Œuf',k:78,p:6,g:0.4,l:5.3,u:'1 œuf'},
 {id:'f4',n:'Blanc de poulet',k:165,p:31,g:0,l:3.6,u:'100 g'},
 {id:'f5',n:'Thon au naturel',k:116,p:26,g:0,l:0.8,u:'boîte 100g'},
 {id:'f6',n:'Riz cuit',k:130,p:2.7,g:28,l:0.3,u:'100 g'},
 {id:'f7',n:'Pâtes cuites',k:158,p:6,g:29,l:0.9,u:'100 g'},
 {id:'f8',n:"Flocons d'avoine",k:150,p:5,g:23,l:2.8,u:'40 g'},
 {id:'f9',n:'Banane',k:105,p:1.3,g:24,l:0.4,u:'1 moyenne'},
 {id:'f10',n:'Pomme',k:95,p:0.5,g:21,l:0.3,u:'1 moyenne'},
 {id:'f11',n:'Pain complet',k:80,p:4,g:12,l:1.1,u:'1 tranche'},
 {id:'f12',n:'Whey',k:120,p:24,g:3,l:1.5,u:'dose 30g'},
 {id:'f13',n:"Huile d'olive",k:119,p:0,g:0,l:13.5,u:'1 c. à soupe'},
 {id:'f14',n:'Amandes',k:174,p:6,g:2.5,l:15,u:'30 g'},
 {id:'f15',n:'Yaourt grec',k:130,p:13,g:6,l:6,u:'150 g'},
 {id:'f16',n:'Lait 1/2 écrémé',k:92,p:7,g:9.6,l:3.2,u:'200 ml'},
 {id:'f17',n:'Jambon blanc',k:45,p:7,g:0.4,l:1.6,u:'1 tranche'},
 {id:'f18',n:'Emmental',k:120,p:8,g:0,l:9,u:'30 g'},
 {id:'f19',n:'Steak haché 5%',k:130,p:21,g:0,l:5,u:'100 g'},
 {id:'f20',n:'Saumon',k:208,p:20,g:0,l:13,u:'100 g'},
 {id:'f21',n:'Lentilles cuites',k:116,p:9,g:12,l:0.4,u:'100 g'},
 {id:'f22',n:'Avocat',k:160,p:2,g:2,l:15,u:'1/2'},
 {id:'f23',n:'Pomme de terre cuite',k:87,p:2,g:18,l:0.1,u:'100 g'}
];
let foodlib=[], foodlog={}, editFid=null;
function loadFood(){
  let a=sget('foodlib'); try{ foodlib=a?JSON.parse(a):null; }catch(e){ foodlib=null; }
  if(!Array.isArray(foodlib)||!foodlib.length){ foodlib=FOOD_SEED.slice(); saveFoodlib(); }
  else { let ch=false; foodlib.forEach(f=>{ const s0=FOOD_SEED.find(x=>x.id===f.id); if(s0&&f.g==null&&f.l==null&&f.k===s0.k&&f.n===s0.n){ f.g=s0.g; f.l=s0.l; ch=true; } }); if(ch)saveFoodlib(); }
  let l=sget('foodlog'); try{ foodlog=l?JSON.parse(l):{}; }catch(e){ foodlog={}; } if(!foodlog||typeof foodlog!=='object')foodlog={};
}
function saveFoodlib(){ try{ sset('foodlib',JSON.stringify(foodlib)); }catch(e){} }
function saveFoodlog(){ try{ sset('foodlog',JSON.stringify(foodlog)); }catch(e){} }
function selDateStr(){ const m=keyFor(weekOffset).monday; const d=new Date(m); d.setDate(d.getDate()+(selDay<0?0:selDay)); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
// quantités et grammes à la française (2,25 ; 2,7 g)
function frNum(x){ return (Math.round(x*100)/100).toLocaleString('fr-FR',{maximumFractionDigits:2}); }
function foodById(id){ return foodlib.find(f=>f.id===id); }
function dayEntries(){ return foodlog[selDateStr()]||[]; }
function setDayEntries(arr){ const k=selDateStr(); if(arr.length)foodlog[k]=arr; else delete foodlog[k]; saveFoodlog(); }
function logFood(id){ const arr=dayEntries().slice(); const e=arr.find(x=>x.fid===id); if(e)e.q++; else arr.push({fid:id,q:1}); setDayEntries(arr); renderMeals(); }
function chgQty(id,dq){ let arr=dayEntries().slice(); const e=arr.find(x=>x.fid===id); if(!e)return; e.q+=dq; if(e.q<=0)arr=arr.filter(x=>x.fid!==id); setDayEntries(arr); renderMeals(); }
function rmFood(id){ setDayEntries(dayEntries().filter(x=>x.fid!==id)); renderMeals(); }
function hasMac(f){ return f.g!=null&&f.l!=null; }
function dayTotals(){ let k=0,p=0,g=0,l=0,miss=0; dayEntries().forEach(e=>{ const f=foodById(e.fid); if(f){ k+=f.k*e.q; p+=f.p*e.q; if(hasMac(f)){ g+=f.g*e.q; l+=f.l*e.q; } else miss++; } }); return {k:Math.round(k),p:Math.round(p),g:Math.round(g),l:Math.round(l),miss:miss}; }
// « P 15 · G 6 · L 0,3 » : protéines, glucides, lipides d'une quantité (grammes) ; arrondis au gramme
// dans les lignes de repas (int), au dixième dans la liste des aliments (valeurs d'une portion)
function macLine(f,q,int){ const r=x=>int?String(Math.round(x*q)):frNum(Math.round(x*q*10)/10); return 'P '+r(f.p)+' · G '+(f.g!=null?r(f.g):'–')+' · L '+(f.l!=null?r(f.l):'–'); }
function renderMeals(){
  const t=dayTotals();
  const dt=document.getElementById('dtot'); if(dt)dt.textContent=`${t.k} kcal · ${t.p} g`;
  const box=document.getElementById('meallog'); if(!box)return; box.innerHTML='';
  const arr=dayEntries();
  if(!arr.length){ box.innerHTML='<div class="none">Rien de noté pour ce jour.</div>'; }
  arr.forEach(e=>{ const f=foodById(e.fid); if(!f)return;
    const row=document.createElement('div'); row.className='ml';
    // nom, puis kcal et macros sur une ligne discrète : le nom garde la place
    row.innerHTML=`<div class="mn-w"><div class="mn">${esc(f.n)}</div><div class="mm"><span class="mk">${Math.round(f.k*e.q)} kcal</span><span class="mmc">${macLine(f,e.q,true)}</span></div></div><div class="qty"><button type="button" data-a="m" aria-label="Une portion de moins">−</button><span>${frNum(e.q)}</span><button type="button" data-a="p" aria-label="Une portion de plus">+</button></div><button type="button" class="mx" aria-label="Retirer ${esc(f.n)}">✕</button>`;
    row.querySelector('[data-a="m"]').onclick=()=>chgQty(e.fid,-1);
    row.querySelector('[data-a="p"]').onclick=()=>chgQty(e.fid,1);
    row.querySelector('.mx').onclick=()=>rmFood(e.fid);
    box.appendChild(row); });
  // protéines des repas notés, dans la catégorie Protéines ; total du jour dans la fenêtre d'ajout
  const pm=document.getElementById('protMeals'); if(pm)pm.textContent=t.p+' g de protéines dans tes repas notés';
  const pt=document.getElementById('pickTot'); if(pt)pt.textContent=(arr.length?'Déjà noté : '+t.k.toLocaleString('fr-FR')+' kcal':'Rien de noté pour l’instant')+'.';
  renderManage(); renderCalObj();
}
function renderPicker(q){
  const box=document.getElementById('foodresults'); if(!box)return; box.innerHTML='';
  const query=(q||'').toLowerCase().trim();
  const list=foodlib.filter(f=>!query||f.n.toLowerCase().includes(query)).slice(0,40);
  if(!list.length){ box.innerHTML='<div class="none">Aucun résultat. Crée-le ci-dessous.</div>'; return; }
  list.forEach(f=>{ const r=document.createElement('button'); r.type='button'; r.className='fr';
    r.innerHTML=`<span class="frn">${esc(f.n)}<small>${esc(f.u)} · ${macLine(f,1)}</small></span><span class="frk">${f.k} kcal</span><span class="add" aria-hidden="true"></span>`;
    r.setAttribute('aria-label','Ajouter '+f.n+', '+f.k+' kcal');
    r.onclick=()=>{ logFood(f.id); r.classList.remove('added'); void r.offsetWidth; r.classList.add('added'); };
    box.appendChild(r); });
}
// Fenêtre d'ajout (recherche, création, gestion des aliments), par-dessus la page
function openPicker(){
  const pk=document.getElementById('picker'); pk.hidden=false;
  const fs=document.getElementById('foodsearch'); fs.value=''; renderPicker(''); renderMeals();
  setTimeout(()=>{ try{ fs.focus({preventScroll:true}); }catch(e){} },60);
}
function closePicker(){
  const pk=document.getElementById('picker'); if(pk.hidden)return; pk.hidden=true;
  editFid=null; document.getElementById('nf_save').textContent='Ajouter à ma liste';
  document.getElementById('newfoodform').hidden=true; document.getElementById('managelist').hidden=true;
  const b=document.getElementById('openpick'); if(b&&b.focus){ try{ b.focus({preventScroll:true}); }catch(e){} }
}
function renderManage(){
  const box=document.getElementById('managelist'); if(!box||box.hidden)return; box.innerHTML='';
  foodlib.forEach(f=>{ const r=document.createElement('div'); r.className='mgr';
    r.innerHTML=`<div class="mgn">${esc(f.n)}<small>${f.k} kcal · ${macLine(f,1)} · ${esc(f.u)}</small></div>`;
    const ed=document.createElement('button'); ed.className='mgb'; ed.textContent='✎'; ed.setAttribute('aria-label','Modifier'); ed.onclick=()=>startEdit(f.id);
    const dl=document.createElement('button'); dl.className='mgb'; dl.textContent='✕'; dl.setAttribute('aria-label','Supprimer'); dl.onclick=()=>{ foodlib=foodlib.filter(x=>x.id!==f.id); saveFoodlib(); renderMeals(); const fs=document.getElementById('foodsearch'); renderPicker(fs?fs.value:''); };
    r.appendChild(ed); r.appendChild(dl); box.appendChild(r); });
}
function startEdit(id){ const f=foodById(id); if(!f)return; editFid=id;
  document.getElementById('picker').hidden=false; document.getElementById('newfoodform').hidden=false;
  document.getElementById('nf_n').value=f.n; document.getElementById('nf_k').value=f.k; document.getElementById('nf_p').value=f.p; document.getElementById('nf_u').value=f.u;
  document.getElementById('nf_g').value=f.g!=null?frNum(f.g):''; document.getElementById('nf_l').value=f.l!=null?frNum(f.l):'';
  document.getElementById('nf_save').textContent='Enregistrer les modifs';
  document.getElementById('nf_n').scrollIntoView({behavior:'smooth',block:'center'});
}
function saveNewFood(){
  const n=document.getElementById('nf_n').value.trim();
  const k=parseNum(document.getElementById('nf_k').value);
  const p=parseNum(document.getElementById('nf_p').value);
  const g=parseNum(document.getElementById('nf_g').value), l=parseNum(document.getElementById('nf_l').value);
  const u=document.getElementById('nf_u').value.trim()||'1 portion';
  if(!n||k==null)return;
  // glucides et lipides : facultatifs ; laissés vides, ils restent « à compléter »
  if(editFid){ const f=foodById(editFid); if(f){ f.n=n; f.k=Math.round(k); f.p=(p==null?0:p); f.g=g; f.l=l; f.u=u; } editFid=null; document.getElementById('nf_save').textContent='Ajouter à ma liste'; saveFoodlib(); }
  else { const id='c'+Date.now(); foodlib.push({id:id,n:n,k:Math.round(k),p:(p==null?0:p),g:g,l:l,u:u}); saveFoodlib(); logFood(id); }
  ['nf_n','nf_k','nf_p','nf_g','nf_l','nf_u'].forEach(x=>{ document.getElementById(x).value=''; });
  document.getElementById('newfoodform').hidden=true;
  const fs=document.getElementById('foodsearch'); renderPicker(fs?fs.value:''); renderMeals();
}
function reportProteins(){ const p=dayTotals().p; const dots=Math.max(0,Math.min(7,Math.round(p/27))); state.nutrition[(selDay<0?0:selDay)+1].protein=dots; save(); renderDays(); renderNutrition(); updateHero(); }
document.getElementById('openpick').onclick=openPicker;
document.getElementById('pickclose').onclick=closePicker;
document.getElementById('picker').addEventListener('click',e=>{ if(e.target.id==='picker')closePicker(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!document.getElementById('picker').hidden)closePicker(); });
document.getElementById('foodsearch').addEventListener('input',e=>renderPicker(e.target.value));
document.getElementById('newfoodbtn').onclick=()=>{ const f=document.getElementById('newfoodform'); f.hidden=!f.hidden; if(!f.hidden)document.getElementById('nf_n').focus(); };
document.getElementById('nf_save').onclick=saveNewFood;
document.getElementById('reportp').onclick=reportProteins;
document.getElementById('managetgl').onclick=()=>{ const m=document.getElementById('managelist'); m.hidden=!m.hidden; renderManage(); };
