// ---- Historique & série ----
function weekScore(d){ return d?TR.weekScore(d):0; }
function scoreAtOffset(o){ if(o===weekOffset)return weekScore(state); const st=readWeek(keyFor(o).k); return st?weekScore(st):0; }
function computeStreak(){ let streak=0; const start = scoreAtOffset(0)>=60?0:-1; for(let o=start;o>-520;o--){ if(scoreAtOffset(o)>=60)streak++; else break; } return streak; }
function renderHistory(){
  const sk=document.getElementById('sknum'); if(!sk)return;
  const streak=computeStreak();
  sk.textContent=streak;
  document.getElementById('skt').textContent = streak>1?'semaines de suite':'semaine de suite';
  document.getElementById('sksub').textContent = streak>0 ? (streak>=4?'Série solide, continue comme ça.':'Belle régularité, continue.') : 'Valide une semaine à 60 % pour lancer ta série.';
  const sm=document.getElementById('streakmeta'); if(sm)sm.textContent='';
  const box=document.getElementById('weekhist'); box.innerHTML='';
  for(let o=0;o>-12;o--){ const kf=keyFor(o); if(o!==0 && !sget(kf.k))continue; const sc=scoreAtOffset(o); const good=sc>=60;
    const lbl = o===0 ? '<b>Cette sem.</b>' : `S${kf.iw.week} · ${kf.monday.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}`;
    const row=document.createElement('div'); row.className='wk';
    row.innerHTML=`<span class="wl">${lbl}</span><span class="wbar"><i style="width:${sc}%"></i></span><span class="wp${good?' good':''}">${sc}%${good?' ✓':''}</span>`;
    box.appendChild(row);
  }
}
const _r2=render; render=function(){ _r2(); try{ renderHistory(); }catch(e){} };
renderHistory();
