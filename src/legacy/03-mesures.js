// ---- Mesures (poids + tour de taille) ----
let bodylog=[]; let metric='w';
function loadBody(){ let v=sget('bodylog'); try{ bodylog=v?JSON.parse(v):[]; }catch(e){ bodylog=[]; } if(!Array.isArray(bodylog))bodylog=[]; bodylog.sort((a,b)=>a.d<b.d?-1:1); }
function saveBody(){ try{ sset('bodylog',JSON.stringify(bodylog)); }catch(e){} }
function todayStr(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtD(s){ const p=s.split('-'); return p[2]+'/'+p[1]; }
function parseNum(x){ if(x==null)return null; x=(''+x).replace(',','.').trim(); if(x==='')return null; const n=parseFloat(x); return isFinite(n)?n:null; }
// Nombres à la française : 77,6 kg, 85,5 cm (le poids toujours avec une décimale)
function fmtV(m,v){ return m==='w'? v.toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1}) : (Math.round(v*10)/10).toLocaleString('fr-FR',{maximumFractionDigits:1}); }
function seriesFor(m){ return bodylog.filter(x=>x[m]!=null).map(x=>({d:x.d,v:x[m]})); }
function addMeasure(){
  const w=parseNum(document.getElementById('in_w').value);
  const t=parseNum(document.getElementById('in_t').value);
  if(w==null&&t==null)return;
  const d=todayStr(); let e=bodylog.find(x=>x.d===d);
  if(e){ if(w!=null)e.w=w; if(t!=null)e.t=t; } else { bodylog.push({d:d,w:w,t:t}); }
  bodylog.sort((a,b)=>a.d<b.d?-1:1); saveBody();
  document.getElementById('in_w').value=''; document.getElementById('in_t').value='';
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
  renderBody();
}
function delMeasure(d){ bodylog=bodylog.filter(x=>x.d!==d); saveBody(); renderBody(); }
function renderBody(){
  ['w','t'].forEach(m=>{
    const s=seriesFor(m); const unit=m==='w'?'kg':'cm';
    const stEl=document.getElementById(m==='w'?'st_w':'st_t');
    const sdEl=document.getElementById(m==='w'?'sd_w':'sd_t');
    if(s.length===0){ stEl.innerHTML='—'; sdEl.textContent=''; sdEl.className='sd flat'; return; }
    const cur=s[s.length-1].v, first=s[0].v, dv=cur-first;
    stEl.innerHTML=`${fmtV(m,cur)} <small>${unit}</small>`;
    if(s.length<2){ sdEl.textContent='point de départ'; sdEl.className='sd flat'; }
    else if(Math.abs(dv)<0.05){ sdEl.textContent='stable'; sdEl.className='sd flat'; }
    else { const down=dv<0; sdEl.textContent=`${down?'▼':'▲'} ${Math.abs(dv).toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1})} ${unit}`; sdEl.className='sd '+(down?'down':'up'); }
  });
  document.getElementById('mezmeta').textContent = bodylog.length? bodylog.length+' mesure'+(bodylog.length>1?'s':'') : 'aucune mesure';
  const tr = metric==='w' ? TB.trendSeries(bodylog) : null;
  document.getElementById('chart').innerHTML = chartSVG(seriesFor(metric), metric==='w'?'kg':'cm', tr);
  renderTrendLine(tr);
  const h=document.getElementById('hist'); h.innerHTML='';
  bodylog.slice(-6).reverse().forEach(e=>{
    const row=document.createElement('div'); row.className='h';
    // (classe h-d : « hd » est l'en-tête de l'accueil, qui étirait chaque ligne à sa hauteur)
    row.innerHTML=`<span class="h-d">${fmtD(e.d)}</span><span class="hv">${e.w!=null?fmtV('w',e.w)+' kg':''}</span><span class="hv hv-t">${e.t!=null?fmtV('t',e.t)+' cm':''}</span>`;
    const x=document.createElement('button'); x.className='hx'; x.textContent='✕'; x.setAttribute('aria-label','Supprimer la mesure du '+fmtD(e.d)); x.onclick=()=>delMeasure(e.d);
    row.appendChild(x); h.appendChild(row);
  });
}
// tr (poids) : tendance lissée à chaque pesée (src/body/trend.js). Avec elle, les pesées
// deviennent des points et la courbe suit la tendance, qui ne réagit pas aux variations du jour.
function chartSVG(s, unit, tr){
  const W=300,H=130,pl=10,pr=10,pt=14,pb=20;
  if(s.length===0) return '<div class="empty">Ajoute ta première mesure ci-dessous.</div>';
  const iw=W-pl-pr, ih=H-pt-pb, bottom=pt+ih;
  const vals=s.map(p=>p.v); let mn=Math.min(...vals), mx=Math.max(...vals);
  if(mx-mn<1){ const c=(mx+mn)/2; mn=c-1; mx=c+1; } else { const pad=(mx-mn)*0.18; mn-=pad; mx+=pad; }
  const X=i=> s.length===1? pl+iw/2 : pl+iw*i/(s.length-1);
  const Y=v=> pt+ih*(1-(v-mn)/(mx-mn));
  const withTrend = !!(tr && tr.length===s.length && s.length>=3);
  let path='',dots='';
  if(withTrend){
    tr.forEach((p,i)=>{ path+=(i===0?'M':'L')+X(i).toFixed(1)+' '+Y(p.t).toFixed(1)+' '; });
    s.forEach((p,i)=>{ if(i<s.length-1)dots+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="2.2" fill="#C5A3FF" fill-opacity="0.42"/>`; });
    const lp=s[s.length-1]; dots+=`<circle cx="${X(s.length-1).toFixed(1)}" cy="${Y(lp.v).toFixed(1)}" r="3.6" fill="#0B0A0F" stroke="#C5A3FF" stroke-width="2.4"/>`;
  } else s.forEach((p,i)=>{ const x=X(i),y=Y(p.v); path+=(i===0?'M':'L')+x.toFixed(1)+' '+y.toFixed(1)+' '; dots+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="#0B0A0F" stroke="#C5A3FF" stroke-width="2.4"/>`; });
  const lx=X(s.length-1), last=s[s.length-1], ly=Y(last.v);
  const line = s.length>1? `<path d="${path}" fill="none" stroke="url(#cg)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`:'';
  const area = s.length>1? `<path d="${path}L ${lx.toFixed(1)} ${bottom} L ${X(0).toFixed(1)} ${bottom} Z" fill="url(#cf)"/>`:'';
  const mm = unit==='kg'?'w':'t';
  const firstLbl=`<text x="${pl}" y="${H-5}" fill="#8A859E" font-size="11" font-weight="600">${fmtD(s[0].d)}</text>`;
  const lastLbl = s.length>1? `<text x="${W-pr}" y="${H-5}" fill="#8A859E" font-size="11" font-weight="600" text-anchor="end">${fmtD(last.d)}</text>`:'';
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block" role="img" aria-label="Courbe ${mm==='w'?'du poids':'du tour de taille'}, dernière mesure ${fmtV(mm,last.v)} ${unit}"><defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#925CFF"/><stop offset="1" stop-color="#C5A3FF"/></linearGradient><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#925CFF" stop-opacity="0.22"/><stop offset="1" stop-color="#925CFF" stop-opacity="0"/></linearGradient></defs>${area}${line}${dots}${firstLbl}${lastLbl}</svg>`;
}
// Sous la courbe du poids : tendance du jour et vitesse sur 3 semaines
function renderTrendLine(tr){
  const el=document.getElementById('mTrend'); if(!el)return;
  if(metric!=='w'||!tr||tr.length<3){ el.hidden=true; return; }
  const t=tr[tr.length-1].t, rate=TB.weeklyRate(bodylog,todayStr());
  el.hidden=false;
  el.innerHTML='<span class="mt-k">Tendance</span><b>'+t.toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1})+' kg</b>'
    +(rate==null?'<span class="mt-s">Encore quelques pesées pour voir ta vitesse.</span>':'<span class="mt-s"><b>'+TB.fmtRate(rate)+'</b> par semaine, sur 3 semaines</span>');
}
document.getElementById('addm').onclick=addMeasure;
['in_w','in_t'].forEach(id=>document.getElementById(id).addEventListener('keydown',e=>{ if(e.key==='Enter')addMeasure(); }));
document.getElementById('seg').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b)return; metric=b.getAttribute('data-m'); [...document.querySelectorAll('#seg button')].forEach(x=>{ x.classList.toggle('on',x===b); x.setAttribute('aria-pressed',String(x===b)); }); renderBody(); });
loadBody(); renderBody();
