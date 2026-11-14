// ---- Flux IA : décrire un repas (ou le prendre en photo) → questions à clics → estimation ----
// Photo : l'IA liste les aliments qu'elle voit ; on décoche ce qui n'y est pas et on choisit la
// quantité de chacun. La photo, réduite, ne sert qu'à l'analyse : elle n'est pas gardée.
let aiData=null, aiAnswers={}, aiEstim=null, aiMode='text', aiImg=null, aiNote='', aiOff={};
function aiOpen(){ document.getElementById('aimodal').hidden=false; aiReset(); setTimeout(()=>document.getElementById('aitext').focus(),80); }
function aiClose(){ document.getElementById('aimodal').hidden=true; aiImg=null; }
function aiReset(){ aiData=null; aiAnswers={}; aiEstim=null; aiSlider={}; aiOpenAdj={}; aiExtras={}; aiMode='text'; aiImg=null; aiNote=''; aiOff={};
  document.getElementById('aititle').textContent='Décris ton repas';
  document.getElementById('aistep1').hidden=false; document.getElementById('aistep2').hidden=true; document.getElementById('aistep3').hidden=true;
  document.getElementById('aistep2').innerHTML=''; document.getElementById('aistep3').innerHTML='';
}
// ---- Accès à l'IA : clé personnelle (stockée uniquement sur le téléphone) ou compte ----
// L'appel lui-même est dans src/core/ai.js : clé perso → Anthropic directement ;
// sinon compte connecté → fonction serveur avec quota du jour.
const KEYK='ai:key';
let aiPendingTxt='', aiPendingImg=null;
function aiKey(){ try{ return (sget(KEYK)||'').trim(); }catch(e){ return ''; } }
function aiReady(){ return !!aiKey() || MS.ai.accountReady(); }
function renderAiStatus(){
  const s=document.getElementById('pfAiS'); if(!s)return; const key=!!aiKey(), acc=MS.ai.accountReady();
  s.textContent=key?(MS.cloud.enabled?'Clé personnelle':'Connectée'):(acc?'Incluse avec ton compte':'Non connectée'); s.setAttribute('data-on',(key||acc)?'1':'0');
  document.getElementById('pfAiB').textContent=key?'Modifier':(acc?'Ma clé':'Ajouter ma clé');
}
async function aiCall(prompt,maxTokens,keyOverride,image){
  return MS.ai.call(prompt,maxTokens,keyOverride||aiKey(),image||null);
}
function aiErrMsg(e){
  switch(e&&e.code){
    case 'network': return 'Impossible de joindre l’IA. Vérifie ta connexion.';
    case 'auth': return 'Clé refusée par Anthropic. Vérifie-la dans Profil.';
    case 'credit': return 'Crédit insuffisant sur ton compte Anthropic. Ajoute quelques dollars dans Billing.';
    case 'rate': return 'Trop de demandes. Réessaie dans quelques secondes.';
    case 'busy': return 'Le service est saturé. Réessaie dans un instant.';
    case 'trunc': case 'parse': return 'L’IA a donné une réponse incomplète. Réessaie.';
    case 'quota': return 'Tu as utilisé tes '+((e.quota&&e.quota.limit)||3)+' analyses IA du jour. Elles reviennent demain.';
    case 'session': return 'Ta connexion au compte a expiré. Reconnecte-toi pour continuer.';
    default: return 'L’IA a répondu par une erreur'+(e&&e.status?' ('+e.status+')':'')+'.';
  }
}
function aiBtns(items){
  const s2=document.getElementById('aistep2'); const box=document.createElement('div'); box.className='ai-err';
  items.forEach(it=>{ if(it.msg){ const d=document.createElement('div'); d.className='err'; d.textContent=it.msg; box.appendChild(d); return; }
    const b=document.createElement('button'); b.type='button'; b.className=it.cls; b.textContent=it.t; b.onclick=it.fn; box.appendChild(b); });
  s2.innerHTML=''; s2.appendChild(box);
}
function aiKeepPending(txt){ aiPendingTxt=txt; aiPendingImg=aiMode==='photo'&&aiImg?{img:aiImg,note:aiNote}:null; }
function aiNoKey(txt){
  aiKeepPending(txt); document.getElementById('aistep1').hidden=true; document.getElementById('aistep2').hidden=false;
  if(MS.cloud.enabled){
    aiBtns([{msg:'Connecte-toi pour utiliser l’analyse IA : 3 analyses offertes chaque jour, sans clé à configurer. En attendant, tu peux scanner un produit ou ajouter un aliment à la main.'},
          {cls:'aibtn',t:'Me connecter',fn:()=>MS.openAccount({from:'ai'})},
          {cls:'aisec',t:'Utiliser ma propre clé',fn:openKey},
          {cls:'aisec',t:'Scanner un produit',fn:()=>{ aiClose(); scanOpen('meal'); }},
          {cls:'aisec',t:'Ajouter un aliment à la main',fn:()=>{ aiClose(); const b=document.getElementById('openpick'); if(b)b.click(); }}]);
    return;
  }
  aiBtns([{msg:'L’analyse IA n’est pas encore connectée. Ajoute ta clé personnelle (2 minutes, une seule fois). En attendant, tu peux scanner un produit ou ajouter un aliment à la main.'},
          {cls:'aibtn',t:'Ajouter ma clé',fn:openKey},
          {cls:'aisec',t:'Scanner un produit',fn:()=>{ aiClose(); scanOpen('meal'); }},
          {cls:'aisec',t:'Ajouter un aliment à la main',fn:()=>{ aiClose(); const b=document.getElementById('openpick'); if(b)b.click(); }}]);
}
function aiFail(txt,e){
  if(e&&e.code==='nokey'){ aiNoKey(txt); return; }
  const items=[{msg:aiErrMsg(e)}];
  if(e&&e.code==='auth'){ aiKeepPending(txt); items.push({cls:'aibtn',t:'Vérifier ma clé',fn:openKey}); }
  else if(e&&e.code==='session'){ aiKeepPending(txt); items.push({cls:'aibtn',t:'Me reconnecter',fn:()=>MS.openAccount({from:'ai'})}); }
  else if(e&&e.code==='quota'){ items.push({cls:'aibtn',t:'Ajouter un aliment à la main',fn:()=>{ aiClose(); const b=document.getElementById('openpick'); if(b)b.click(); }}); if(!aiKey())items.push({cls:'aisec',t:'Utiliser ma propre clé',fn:()=>{ aiKeepPending(txt); openKey(); }}); }
  else if(aiMode==='photo'&&aiImg){ const im=aiImg, nt=aiNote; items.push({cls:'aibtn',t:'Réessayer',fn:()=>{ aiReset(); aiAnalyzePhoto(im,nt); }}); }
  else items.push({cls:'aibtn',t:'Réessayer',fn:()=>{ aiReset(); document.getElementById('aitext').value=txt; aiAnalyze(); }});
  items.push({cls:'aisec',t:'Scanner un produit',fn:()=>{ aiClose(); scanOpen('meal'); }});
  document.getElementById('aistep1').hidden=true; document.getElementById('aistep2').hidden=false; aiBtns(items);
}
function openKey(){ document.getElementById('keyin').value=aiKey(); const m=document.getElementById('keymsg'); m.textContent=''; m.classList.remove('err'); document.getElementById('keydel').hidden=!aiKey(); document.getElementById('keymodal').hidden=false; setTimeout(()=>document.getElementById('keyin').focus(),80); }
function closeKey(){ document.getElementById('keymodal').hidden=true; }
async function saveKey(){
  const v=document.getElementById('keyin').value.trim(), m=document.getElementById('keymsg'), b=document.getElementById('keysave');
  m.classList.remove('err');
  if(!v){ m.classList.add('err'); m.textContent='Colle d’abord ta clé.'; return; }
  if(!/^sk-ant-/.test(v)){ m.classList.add('err'); m.textContent='Une clé Anthropic commence par « sk-ant- ».'; return; }
  b.disabled=true; m.textContent='Test de la clé…';
  try{
    await aiCall('Réponds uniquement par le mot OK.',8,v);
    try{ sset(KEYK,v); }catch(e){}
    renderAiStatus(); m.textContent='Clé enregistrée. L’IA est connectée.';
    setTimeout(()=>{ closeKey(); if(document.getElementById('aimodal').hidden)return;
      if(aiPendingImg){ const p=aiPendingImg; aiPendingImg=null; aiPendingTxt=''; aiReset(); aiAnalyzePhoto(p.img,p.note); }
      else if(aiPendingTxt){ const t=aiPendingTxt; aiPendingTxt=''; aiReset(); document.getElementById('aitext').value=t; aiAnalyze(); } },900);
  }catch(e){ m.classList.add('err'); m.textContent=aiErrMsg(e); }
  b.disabled=false;
}
function delKey(){ try{ sset(KEYK,''); }catch(e){} renderAiStatus(); closeKey(); }
document.getElementById('pfAiB').onclick=openKey;
document.getElementById('keyclose').onclick=closeKey;
document.getElementById('keysave').onclick=saveKey;
document.getElementById('keydel').onclick=delKey;
document.getElementById('keymodal').addEventListener('click',e=>{ if(e.target.id==='keymodal')closeKey(); });
document.getElementById('keyin').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); saveKey(); } });
renderAiStatus();

async function aiAnalyze(){
  const txt=document.getElementById('aitext').value.trim(); if(!txt)return;
  if(!aiReady()){ aiNoKey(txt); return; }
  document.getElementById('aistep1').hidden=true;
  const s2=document.getElementById('aistep2'); s2.hidden=false;
  s2.innerHTML='<div class="spin"><i></i> Analyse du repas…</div>';
  const prompt=`Tu es un nutritionniste. L'utilisateur décrit un repas en français : "${txt}"

Identifie chaque aliment dont la quantité est incertaine et crée UNE question par aliment (jamais deux aliments dans la même question). Maximum 4 questions, les plus impactantes sur les calories.

Chaque question a 3 options (petite / moyenne / grande portion) avec ce que cette option AJOUTE : kcal (k), protéines (p), glucides (gluc) et lipides (lip), en grammes. Ajoute aussi les données d'un curseur d'ajustement fin pour cet aliment : unité, min, max, pas, et les kcal, protéines, glucides et lipides pour 1 unité.

Réponds UNIQUEMENT en JSON, sans texte ni backticks :
{"nom":"Nom court du repas","base_kcal":0,"base_prot":0,"base_gluc":0,"base_lip":0,"questions":[{"id":"q1","q":"Quelle portion de thon ?","options":[{"l":"50 g","k":58,"p":13,"gluc":0,"lip":0.4},{"l":"80 g","k":93,"p":21,"gluc":0,"lip":0.6},{"l":"120 g","k":139,"p":31,"gluc":0,"lip":1}],"slider":{"unit":"g","min":10,"max":200,"step":5,"k_per_unit":1.16,"p_per_unit":0.26,"gluc_per_unit":0,"lip_per_unit":0.008,"default":80}}]}

Règles : base_kcal/base_prot/base_gluc/base_lip = ce qui est certain quelle que soit la réponse (jamais les aliments qui ont une question). Glucides hors fibres, comme sur les étiquettes françaises. L'option du milieu doit être la portion la plus courante. Les libellés d'options indiquent la quantité concrète (ex. "80 g", "2 œufs", "1 c. à soupe").

IMPORTANT — matières grasses : pose TOUJOURS une dernière question sur la sauce et la matière grasse de cuisson, même si l'utilisateur n'en a pas parlé (c'est la source de calories la plus souvent oubliée). Adapte-la au plat : pour un wrap ou un sandwich, propose mayo/sauce blanche/ketchup ; pour un plat poêlé, propose spray/filet d'huile/beurre ; pour une salade, propose vinaigrette légère/classique. La première option doit toujours être "Aucune" à 0 kcal.`;
  try{
    const res=await aiCall(prompt,1800);
    if(res.stop==='max_tokens'){ const er=new Error('trunc'); er.code='trunc'; throw er; }
    let t=res.text.replace(/```json|```/g,'').trim();
    const a=t.indexOf('{'), b=t.lastIndexOf('}'); if(a>=0&&b>a)t=t.slice(a,b+1);
    let parsed; try{ parsed=JSON.parse(t); }catch(pe){ const er=new Error('parse'); er.code='parse'; throw er; }
    aiData=parsed;
    if(!aiData.questions)aiData.questions=[];
    aiData.questions.forEach(q=>{ const n=(q.options||[]).length; aiAnswers[q.id]= n?Math.floor((n-1)/2):0; });
    renderQuestions();
  }catch(e){ aiFail(txt,e); }
}
// ---- Photo du plat ----
const AI_PHOTO_MAX=1024;
function aiPhotoPick(){ const i=document.getElementById('aiphoto'); if(!i)return; i.value=''; i.click(); }
// Photo réduite à 1024 px de côté, en JPEG (sens de la photo respecté), pour l'envoi et l'aperçu
async function aiImageOf(file){
  let src=null, url=null;
  try{ src=await createImageBitmap(file,{imageOrientation:'from-image'}); }
  catch(e){ url=URL.createObjectURL(file); src=await new Promise((ok,ko)=>{ const im=new Image(); im.onload=()=>ok(im); im.onerror=ko; im.src=url; }); }
  try{
    const w=src.width||src.naturalWidth, h=src.height||src.naturalHeight; if(!w||!h)throw new Error('vide');
    const k=Math.min(1,AI_PHOTO_MAX/Math.max(w,h)), c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(w*k)); c.height=Math.max(1,Math.round(h*k));
    const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(src,0,0,c.width,c.height);
    const durl=c.toDataURL('image/jpeg',0.82);
    return { media_type:'image/jpeg', data:durl.slice(durl.indexOf(',')+1), url:durl };
  } finally { if(src&&src.close)src.close(); if(url)URL.revokeObjectURL(url); }
}
function aiPhotoPrompt(note){
  return `Tu es un nutritionniste. Voici la photo d'un repas.${note?` L'utilisateur précise : "${note}".`:''}

Liste les aliments que tu vois, chacun séparément (6 au maximum, les plus caloriques d'abord), avec un nom court et précis en français, cuisson comprise (ex. « riz blanc cuit », « blanc de poulet grillé », « frites »). "sur" : true si tu le vois clairement, false si tu le devines (sauce, huile, fromage fondu…).

Pour chaque aliment, une question sur sa quantité et 3 options (petite, moyenne, grande) estimées d'après la photo (taille de l'assiette, des couverts, des morceaux) : l'option du milieu est ton estimation la plus probable. Pour chaque option, ce qu'elle apporte : kcal (k), protéines (p), glucides (gluc) et lipides (lip), en grammes. Ajoute un curseur pour régler précisément : unité, min, max, pas, valeurs pour 1 unité, valeur par défaut = ton estimation.

Réponds UNIQUEMENT en JSON, sans texte ni backticks :
{"nom":"Nom court du plat","aliments":[{"n":"Riz blanc cuit","sur":true,"q":"Quelle quantité de riz ?","options":[{"l":"100 g","k":130,"p":2.7,"gluc":28,"lip":0.3},{"l":"150 g","k":195,"p":4,"gluc":42,"lip":0.5},{"l":"220 g","k":286,"p":5.9,"gluc":62,"lip":0.7}],"slider":{"unit":"g","min":30,"max":400,"step":10,"k_per_unit":1.3,"p_per_unit":0.027,"gluc_per_unit":0.28,"lip_per_unit":0.003,"default":150}}]}

Règles : glucides hors fibres, comme sur les étiquettes françaises. Les libellés indiquent une quantité concrète (« 150 g », « 2 œufs », « 1 c. à soupe »). Si le plat est cuisiné (poêlé, frit, en sauce), ajoute en dernier « Huile ou beurre de cuisson » avec "sur" : false et « Aucune » à 0 kcal en première option : c'est l'oubli le plus fréquent. Si la photo ne montre pas de repas, réponds {"nom":"","aliments":[]}.`;
}
async function aiAnalyzePhoto(img,note){
  aiMode='photo'; aiImg=img; aiNote=note||'';
  document.getElementById('aititle').textContent='Ton assiette';
  if(!aiReady()){ aiNoKey(''); return; }
  document.getElementById('aistep1').hidden=true;
  const s2=document.getElementById('aistep2'); s2.hidden=false;
  s2.innerHTML='<div class="plate-wait"><img src="'+img.url+'" alt="Ta photo"><div class="spin"><i></i> L’IA regarde ton assiette…</div></div>';
  try{
    const res=await aiCall(aiPhotoPrompt(aiNote),2000,null,img);
    if(res.stop==='max_tokens'){ const er=new Error('trunc'); er.code='trunc'; throw er; }
    let t=res.text.replace(/```json|```/g,'').trim();
    const a=t.indexOf('{'), b=t.lastIndexOf('}'); if(a>=0&&b>a)t=t.slice(a,b+1);
    let parsed; try{ parsed=JSON.parse(t); }catch(pe){ const er=new Error('parse'); er.code='parse'; throw er; }
    const items=(Array.isArray(parsed.aliments)?parsed.aliments:[]).filter(x=>x&&typeof x.n==='string'&&x.n.trim()&&Array.isArray(x.options)&&x.options.length).slice(0,8);
    if(!items.length){ aiNoFood(); return; }
    aiData={ nom:String(parsed.nom||'').trim()||'Mon assiette', base_kcal:0, base_prot:0, base_gluc:0, base_lip:0,
      questions:items.map((x,i)=>({ id:'a'+(i+1), n:x.n.trim(), q:typeof x.q==='string'&&x.q.trim()?x.q:'Quelle quantité ?', sur:x.sur!==false, options:x.options, slider:x.slider })) };
    aiData.questions.forEach(q=>{ const n=q.options.length; aiAnswers[q.id]=n?Math.floor((n-1)/2):0; if(!q.sur)aiOff[q.id]=true; });
    renderQuestions();
  }catch(e){ aiFail('',e); }
}
function aiNoFood(){
  aiBtns([{msg:'Je ne vois pas de repas sur cette photo. Prends le plat bien en face, ou décris-le.'},
    {cls:'aibtn',t:'Reprendre une photo',fn:aiPhotoPick},
    {cls:'aisec',t:'Décrire mon repas',fn:()=>{ aiReset(); setTimeout(()=>document.getElementById('aitext').focus(),60); }}]);
}
document.getElementById('aiphoto').addEventListener('change',async e=>{
  const f=e.target.files&&e.target.files[0]; if(!f)return;
  const m=document.getElementById('aimodal'), note=m.hidden?'':document.getElementById('aitext').value.trim();
  m.hidden=false; aiReset(); aiMode='photo';
  document.getElementById('aititle').textContent='Ton assiette';
  document.getElementById('aistep1').hidden=true;
  const s2=document.getElementById('aistep2'); s2.hidden=false; s2.innerHTML='<div class="spin"><i></i> Lecture de la photo…</div>';
  let img;
  try{ img=await aiImageOf(f); }
  catch(err){ aiBtns([{msg:'Impossible de lire cette photo. Essaie avec une autre, ou décris ton repas.'},{cls:'aibtn',t:'Choisir une autre photo',fn:aiPhotoPick},{cls:'aisec',t:'Décrire mon repas',fn:()=>aiReset()}]); return; }
  aiAnalyzePhoto(img,note);
});
document.getElementById('aiphotoBtn').onclick=aiPhotoPick;
document.getElementById('aiphoto2').onclick=aiPhotoPick;

const EXTRAS=[
 {id:'x1',l:'🥄 Huile / beurre',k:110,p:0,g:0,f:12},
 {id:'x2',l:'🥫 Sauce (mayo, crème)',k:95,p:0,g:1,f:10},
 {id:'x3',l:'🍅 Ketchup / sauce légère',k:25,p:0,g:6,f:0},
 {id:'x4',l:'🧀 Fromage râpé',k:80,p:5,g:0,f:6.5},
 {id:'x5',l:'🍞 Pain',k:80,p:3,g:15,f:1},
 {id:'x6',l:'🥤 Boisson sucrée',k:140,p:0,g:35,f:0},
 {id:'x7',l:'🍫 Dessert / sucrerie',k:180,p:2,g:24,f:9}
];
let aiSlider={}, aiOpenAdj={}, aiExtras={};
function renderQuestions(){
  const s2=document.getElementById('aistep2'); s2.innerHTML='';
  document.getElementById('aititle').textContent=aiData.nom||'Ton repas';
  const photo=aiMode==='photo';
  if(photo){
    const qs=aiData.questions||[], on=qs.filter(q=>!aiOff[q.id]).length;
    const h=document.createElement('div'); h.className='plate';
    h.innerHTML=(aiImg?`<img src="${aiImg.url}" alt="Ta photo">`:'')+`<div><p class="plate-t">${qs.length} aliment${qs.length>1?'s':''} repéré${qs.length>1?'s':''}${on<qs.length?' · '+on+' gardé'+(on>1?'s':''):''}</p><p class="plate-s">Décoche ce qui n’est pas dans ton assiette, puis choisis les quantités.</p></div>`;
    s2.appendChild(h);
  }
  (aiData.questions||[]).forEach(q=>{
    const b=document.createElement('div'); b.className='qblock'+(photo?' pi'+(aiOff[q.id]?' off':''):'');
    if(photo){
      const off=!!aiOff[q.id], hd=document.createElement('button'); hd.type='button'; hd.className='pi-h'; hd.setAttribute('aria-pressed',String(!off));
      hd.innerHTML=`<i class="pi-c" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></i><span class="pi-n">${esc(q.n)}${q.sur?'':'<small>peut-être</small>'}</span><span class="pi-k">${off?'':Math.round(qContrib(q).k)+' kcal'}</span>`;
      hd.onclick=()=>{ if(aiOff[q.id])delete aiOff[q.id]; else aiOff[q.id]=true; renderQuestions(); };
      b.appendChild(hd);
      if(off){ s2.appendChild(b); return; }
    }
    b.insertAdjacentHTML('beforeend',`<div class="qq">${esc(q.q)}</div>`);
    const o=document.createElement('div'); o.className='qopts';
    (q.options||[]).forEach((op,i)=>{ const btn=document.createElement('button'); btn.textContent=op.l;
      if(aiSlider[q.id]==null && aiAnswers[q.id]===i)btn.classList.add('on');
      btn.onclick=()=>{ aiAnswers[q.id]=i; delete aiSlider[q.id]; renderQuestions(); }; o.appendChild(btn); });
    b.appendChild(o);
    const scanbtn=document.createElement('button'); scanbtn.className='scanbtn'; scanbtn.textContent='📱 Scanner le produit';
    scanbtn.onclick=()=>scanStart(q.id); b.appendChild(scanbtn);
    if(aiSlider[q.id] && aiSlider[q.id].name){ const sc=document.createElement('div');
      const S=aiSlider[q.id], m1=x=>x==null?'–':frNum(x);
      sc.innerHTML=`<div class="ai-scan"><div class="ai-scan-n">${esc(S.name)} (${S.val} g)</div><div class="ai-scan-m">${S.kcal} kcal · P ${m1(S.prot)} · G ${m1(S.gluc)} · L ${m1(S.lip)}</div></div>`;
      b.appendChild(sc);
    }
    const sl=q.slider;
    if(sl && sl.min!=null && sl.max!=null){
      const tgl=document.createElement('button'); tgl.className='adjtgl';
      tgl.textContent = aiOpenAdj[q.id] ? 'Masquer l\'ajustement' : 'Ajuster précisément';
      tgl.onclick=()=>{ aiOpenAdj[q.id]=!aiOpenAdj[q.id];
        if(aiOpenAdj[q.id] && aiSlider[q.id]==null) aiSlider[q.id]= sl.default!=null? sl.default : Math.round((sl.min+sl.max)/2);
        renderQuestions(); };
      b.appendChild(tgl);
      if(aiOpenAdj[q.id]){
        const val = aiSlider[q.id]!=null? aiSlider[q.id] : (sl.default||sl.min);
        const box=document.createElement('div'); box.className='adjbox';
        box.innerHTML=`<div class="adjtop"><span class="al">Quantité précise</span><span class="av">${val} ${sl.unit||'g'}</span></div>`;
        const r=document.createElement('input'); r.type='range'; r.min=sl.min; r.max=sl.max; r.step=sl.step||1; r.value=val;
        r.addEventListener('input',e=>{ aiSlider[q.id]=parseFloat(e.target.value);
          box.querySelector('.av').textContent=aiSlider[q.id]+' '+(sl.unit||'g'); updateEstim(); });
        r.addEventListener('change',()=>renderQuestions());
        box.appendChild(r);
        const ends=document.createElement('div'); ends.className='adjends';
        ends.innerHTML=`<span>${sl.min} ${sl.unit||'g'}</span><span>${sl.max} ${sl.unit||'g'}</span>`;
        box.appendChild(ends); b.appendChild(box);
      }
    }
    s2.appendChild(b);
  });
  const ex=document.createElement('div'); ex.className='extras';
  ex.innerHTML='<div class="eh">Autre chose ?</div><div class="es">'+(photo?'Ce que la photo ne montre pas. Un autre aliment ? Ajoute-le ensuite avec « Ajouter un aliment ».':'Les oublis classiques — tape ce que tu as pris en plus.')+'</div>';
  const ec=document.createElement('div'); ec.className='exchips';
  EXTRAS.forEach(x=>{ const btn=document.createElement('button'); btn.innerHTML=`${x.l}<small>+${x.k}</small>`;
    if(aiExtras[x.id])btn.classList.add('on');
    btn.onclick=()=>{ aiExtras[x.id]=!aiExtras[x.id]; renderQuestions(); }; ec.appendChild(btn); });
  ex.appendChild(ec); s2.appendChild(ex);
  const t=aiTotals();
  const est=document.createElement('div'); est.className='estim'; est.id='aiestim';
  est.innerHTML=`<div class="en2">${esc(aiData.nom||'Repas')}</div><div class="ev">${t.k} kcal</div><div class="ep">${aiMacTxt(t)}</div>`;
  s2.appendChild(est);
  const lbl=document.createElement('label'); lbl.className='savetpl';
  lbl.innerHTML='<input type="checkbox" id="aitpl" checked> Enregistrer comme repas habituel (1 tap la prochaine fois)';
  s2.appendChild(lbl);
  const ok=document.createElement('button'); ok.className='aibtn'; ok.textContent='Ajouter à ma journée'; ok.onclick=aiConfirm; s2.appendChild(ok);
}
function updateEstim(){ const t=aiTotals(); const e=document.getElementById('aiestim'); if(!e)return;
  e.querySelector('.ev').textContent=t.k+' kcal'; e.querySelector('.ep').textContent=aiMacTxt(t);
  if(aiMode==='photo')document.querySelectorAll('#aistep2 .pi').forEach((b,i)=>{ const q=aiData.questions[i], k=b.querySelector('.pi-k'); if(q&&k&&!aiOff[q.id])k.textContent=Math.round(qContrib(q).k)+' kcal'; }); }
function aiMacTxt(t){ return t.p+' g de protéines'+(t.known?' · '+t.g+' g de glucides · '+t.l+' g de lipides':''); }
// Ce qu'apporte un aliment : produit scanné, quantité au curseur, ou option choisie
const aiNum=x=>(typeof x==='number'&&isFinite(x))?x:0;
function qContrib(q){
  const S=aiSlider[q.id]; let k=0,p=0,g=0,l=0,known=false;
  if(S && S.kcal!=null){ k=S.kcal; p=aiNum(S.prot); g=aiNum(S.gluc); l=aiNum(S.lip); }
  else if(S!=null && q.slider){ const sl=q.slider; k=S*aiNum(sl.k_per_unit); p=S*aiNum(sl.p_per_unit); g=S*aiNum(sl.gluc_per_unit); l=S*aiNum(sl.lip_per_unit); known=sl.gluc_per_unit!=null||sl.lip_per_unit!=null; }
  else { const op=(q.options||[])[aiAnswers[q.id]]; if(op){ k=aiNum(op.k); p=aiNum(op.p); g=aiNum(op.gluc); l=aiNum(op.lip); known=op.gluc!=null||op.lip!=null; } }
  return {k:k,p:p,g:g,l:l,known:known};
}
// Totaux du repas. Glucides et lipides : comptés si l'IA les a donnés (sinon le repas les aura « à compléter »).
// Photo : seulement les aliments gardés.
function aiTotals(){ const num=aiNum;
  let k=num(aiData.base_kcal), p=num(aiData.base_prot), g=num(aiData.base_gluc), l=num(aiData.base_lip);
  let known=aiData.base_gluc!=null||aiData.base_lip!=null;
  (aiData.questions||[]).forEach(q=>{
    if(aiOff[q.id])return;
    const c=qContrib(q); k+=c.k; p+=c.p; g+=c.g; l+=c.l; if(c.known)known=true;
  });
  EXTRAS.forEach(x=>{ if(aiExtras[x.id]){ k+=x.k; p+=x.p; g+=x.g; l+=x.f; } });
  return {k:Math.round(k), p:Math.round(p), g:Math.round(g), l:Math.round(l), known:known};
}
function aiConfirm(){
  const t=aiTotals(); const nom=aiData.nom||'Repas';
  const tpl=document.getElementById('aitpl'); const keep=tpl?tpl.checked:false;
  const id=keep?('c'+Date.now()):('tmp'+Date.now());
  foodlib.push({id:id,n:nom,k:t.k,p:t.p,g:t.known?t.g:null,l:t.known?t.l:null,u:'1 portion',fav:keep?1:0});
  saveFoodlib(); logFood(id);
  if(!keep){ foodlib=foodlib.filter(f=>f.id!==id||dayEntries().some(e=>e.fid===id)); saveFoodlib(); }
  aiClose();
}
document.getElementById('aibtn').onclick=aiOpen;
document.getElementById('aiclose').onclick=aiClose;
document.getElementById('aigo').onclick=aiAnalyze;
document.getElementById('aimodal').addEventListener('click',e=>{ if(e.target.id==='aimodal')aiClose(); });
