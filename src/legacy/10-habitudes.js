// ---- Barre « mes habitudes » : repas les plus utilisés, 1 tap ----
function topFoods(){
  // une ancienne version d'une recette compte pour sa version actuelle (recettes : 20-recettes.js)
  const cur=id=>{ const f=foodById(id); if(!f)return null; if(!f.old)return id; const n=f.rec&&foodlib.find(x=>x.rec===f.rec&&!x.old); return n?n.id:null; };
  const count={}; Object.keys(foodlog).forEach(d=>(foodlog[d]||[]).forEach(e=>{ const id=cur(e.fid); if(id)count[id]=(count[id]||0)+e.q; }));
  const ids=Object.keys(count).sort((a,b)=>count[b]-count[a]);
  const favs=foodlib.filter(f=>f.fav).map(f=>f.id);
  const merged=[...new Set([...ids,...favs])].map(id=>foodById(id)).filter(f=>f&&!f.old);
  return merged.slice(0,10);
}
function renderQuick(){
  const box=document.getElementById('quickrow'); if(!box)return; box.innerHTML='';
  const list=topFoods();
  if(!list.length){ box.innerHTML='<div class="none">Tes aliments fréquents apparaîtront ici, à ajouter en un geste.</div>'; return; }
  list.forEach(f=>{ const b=document.createElement('button'); b.type='button'; b.className='qchip';
    b.innerHTML=`${esc(f.n)}<small>${f.k}</small>`; b.setAttribute('aria-label','Ajouter '+f.n+', '+f.k+' kcal'); b.onclick=()=>logFood(f.id); box.appendChild(b); });
}
const _r3=renderMeals; renderMeals=function(){ _r3(); try{ renderQuick(); }catch(e){} };
renderQuick();
