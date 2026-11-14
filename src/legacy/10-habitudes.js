// ---- Barre « mes habitudes » : repas les plus utilisés, 1 tap ----
function topFoods(){
  const count={}; Object.keys(foodlog).forEach(d=>(foodlog[d]||[]).forEach(e=>{ count[e.fid]=(count[e.fid]||0)+e.q; }));
  const ids=Object.keys(count).sort((a,b)=>count[b]-count[a]);
  const favs=foodlib.filter(f=>f.fav).map(f=>f.id);
  const merged=[...new Set([...ids,...favs])].map(id=>foodById(id)).filter(Boolean);
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
