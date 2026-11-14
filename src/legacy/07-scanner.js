// ---- Scanner code-barres + Open Food Facts ----
let scanMode='meal', scanCurQ=null, scanActive=false, scanLast='', scanProd=null, scanBusy=false;
let scanStream=null, scanVideo=null, scanTimer=null, scanTick=0;
const SCAN_STRATS=[{locate:false},{locate:true,p:'medium'},{locate:false},{locate:true,p:'large'}];
const SCAN_CV=document.createElement('canvas');
function scanStart(qid){ scanOpen('question',qid); }
function scanSetMsg(t){ const m=document.getElementById('scanmsg'); if(m)m.textContent=t; }
function scanRes(html){ document.getElementById('scanres').innerHTML=html; }
function scanHalt(){
  scanActive=false; clearTimeout(scanTimer);
  if(scanStream){ try{ scanStream.getTracks().forEach(t=>t.stop()); }catch(e){} scanStream=null; }
  scanVideo=null;
}
function scanStop(){ scanHalt(); document.getElementById('scanner').hidden=true; document.getElementById('scanvideo').innerHTML=''; scanCurQ=null; scanProd=null; scanBusy=false; }
function scanFail(msg,showRetry){
  scanHalt(); document.querySelector('.scan-cam').classList.add('done');
  scanRes('<p class="sr-msg err">'+esc(msg)+'</p>'+(showRetry?'<button type="button" class="sr-again" id="scanAgain">Scanner à nouveau</button>':''));
  const b=document.getElementById('scanAgain'); if(b)b.onclick=()=>scanOpen(scanMode,scanCurQ);
}
async function scanOpen(mode,qid){
  scanHalt();
  scanMode=mode||'meal'; scanCurQ=qid||null; scanLast=''; scanProd=null; scanBusy=false; scanTick=0;
  document.getElementById('scanner').hidden=false;
  document.querySelector('.scan-cam').classList.remove('done');
  scanSetMsg('Place le code-barres dans le cadre'); scanRes('');
  const box=document.getElementById('scanvideo'); box.innerHTML='';
  if(typeof Quagga==='undefined'){   // module de lecture chargé à la première utilisation
    scanSetMsg('Chargement du scanner…'); try{ await MS.loadQuagga(); }catch(e){}
    if(document.getElementById('scanner').hidden)return;
    scanSetMsg('Place le code-barres dans le cadre');
  }
  if(typeof Quagga==='undefined'){ scanSetMsg('Scanner indisponible'); scanFail('Le module de lecture n’a pas pu se charger. Vérifie ta connexion puis réessaie.',true); return; }
  let stream;
  try{
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw {name:'Unsupported'};
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
  }catch(e){
    const n=e&&e.name; scanSetMsg('Caméra indisponible');
    if(n==='NotAllowedError'||n==='PermissionDeniedError')scanFail('Accès à la caméra refusé. Dans Réglages > Safari > Caméra, autorise ce site, puis rouvre l’app.',true);
    else if(n==='NotFoundError')scanFail('Aucune caméra trouvée sur cet appareil.',false);
    else scanFail('La caméra n’est pas disponible ici ('+(n||'erreur')+').',true);
    return;
  }
  if(document.getElementById('scanner').hidden){ stream.getTracks().forEach(t=>t.stop()); return; }   // fermé pendant la demande d'accès
  scanStream=stream;
  const v=document.createElement('video'); v.setAttribute('playsinline',''); v.setAttribute('webkit-playsinline',''); v.muted=true; v.autoplay=true; v.srcObject=stream;
  box.appendChild(v); scanVideo=v;
  try{ await v.play(); }catch(e){}
  scanActive=true; scanLoop();
}
async function scanLoop(){
  if(!scanActive||!scanVideo)return;
  const v=scanVideo;
  if(v.readyState>=2&&v.videoWidth){
    const W=Math.min(960,v.videoWidth), H=Math.round(v.videoHeight*W/v.videoWidth);
    SCAN_CV.width=W; SCAN_CV.height=H; SCAN_CV.getContext('2d').drawImage(v,0,0,W,H);
    const st=SCAN_STRATS[scanTick++%SCAN_STRATS.length], src=SCAN_CV.toDataURL('image/jpeg',0.85);
    const code=await new Promise(res=>{
      let done=false; const to=setTimeout(()=>{ if(!done){ done=true; res(null); } },2000);
      try{
        Quagga.decodeSingle({src:src,numOfWorkers:0,inputStream:{size:W},locate:st.locate,locator:{patchSize:st.p||'medium',halfSample:true},
          decoder:{readers:['ean_reader','ean_8_reader','upc_reader']}},r=>{ if(done)return; done=true; clearTimeout(to); res(r&&r.codeResult?r.codeResult.code:null); });
      }catch(e){ done=true; clearTimeout(to); res(null); }
    });
    if(scanActive&&code)scanOnCode(code);
  }
  if(scanActive)scanTimer=setTimeout(scanLoop,50);
}
function scanOnCode(code){
  if(!scanActive||scanBusy)return;
  if(code!==scanLast){ scanLast=code; return; }   // deux lectures identiques de suite : évite les fausses détections
  scanBusy=true; scanHalt(); scanLookup(code);
}
function offNum(n,k){ const v=n&&n[k]; const x=typeof v==='string'?parseFloat(v):v; return (typeof x==='number'&&isFinite(x))?x:null; }
async function scanLookup(code){
  document.querySelector('.scan-cam').classList.add('done');
  scanSetMsg('Produit détecté'); scanRes('<p class="sr-msg">Recherche du produit…</p>');
  let d=null;
  try{
    const r=await fetch('https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(code)+'.json?fields=code,product_name,generic_name,brands,nutriments,serving_quantity');
    d=await r.json();
  }catch(e){ scanFail('Impossible de joindre Open Food Facts. Vérifie ta connexion.',true); return; }
  if(!d||d.status!==1||!d.product){ scanFail('Produit introuvable dans la base Open Food Facts ('+code+').',true); return; }
  const p=d.product, n=p.nutriments||{};
  let kcal=offNum(n,'energy-kcal_100g'); if(kcal==null){ const kj=offNum(n,'energy_100g'); if(kj!=null)kcal=kj/4.184; }
  const prot=offNum(n,'proteins_100g'), gluc=offNum(n,'carbohydrates_100g'), lip=offNum(n,'fat_100g');
  if(kcal==null){ scanFail('Ce produit n’a pas de valeurs nutritionnelles dans la base. Essaie un autre produit.',true); return; }
  const brand=String(p.brands||'').split(',')[0].trim();
  // glucides et lipides pour 100 g ; absents de la base, ils restent « à compléter » (null)
  scanProd={code:code, name:(p.product_name||p.generic_name||'Produit scanné').trim(), brand:brand, k:kcal, p:prot==null?0:prot, noProt:prot==null,
    g:gluc, l:lip, serving:parseFloat(p.serving_quantity)||0};
  scanRender();
}
function scanRender(){
  const P=scanProd; if(!P)return;
  const def=P.serving>0?Math.round(P.serving):100;
  const chips=[]; if(P.serving>0)chips.push({v:Math.round(P.serving),l:'1 portion · '+Math.round(P.serving)+' g'}); [50,100,150,200].forEach(v=>{ if(!chips.some(c=>c.v===v))chips.push({v:v,l:v+' g'}); });
  scanSetMsg('Produit trouvé');
  scanRes('<div class="sr-name">'+esc(P.name)+'</div>'+(P.brand?'<div class="sr-brand">'+esc(P.brand)+'</div>':'')+
    '<div class="sr-per num">'+Math.round(P.k)+' kcal pour 100 g</div>'+
    '<div class="sr-mac num">'+[['Protéines',P.noProt?null:P.p],['Glucides',P.g],['Lipides',P.l]].map(([k,v])=>'<span>'+k+' <b>'+(v==null?'–':frNum(Math.round(v*10)/10)+' g')+'</b></span>').join('')+'</div>'+
    '<div class="sr-q"><label for="scanqty">Quantité</label><div class="sr-qi"><input id="scanqty" type="text" inputmode="decimal" value="'+def+'"><span>g</span></div></div>'+
    '<div class="sr-chips" id="srChips">'+chips.map(c=>'<button type="button" data-v="'+c.v+'">'+esc(c.l)+'</button>').join('')+'</div>'+
    '<div class="sr-tot"><b class="num" id="srK">0</b> kcal <span class="sr-tm num">P <i id="srP">0</i> · G <i id="srG">–</i> · L <i id="srL">–</i></span></div>'+
    '<button type="button" class="sr-add" id="scanAdd">'+(scanMode==='question'?'Utiliser pour cette question':'Ajouter à ma journée')+'</button>'+
    '<button type="button" class="sr-again" id="scanAgain">Scanner un autre produit</button>');
  const inp=document.getElementById('scanqty');
  const qty=()=>{ const q=parseFloat(String(inp.value).replace(',','.')); return (isFinite(q)&&q>0)?Math.min(q,5000):0; };
  const upd=()=>{ const q=qty();
    const g1=x=>x==null?'–':frNum(Math.round(x*q/100*10)/10);
    document.getElementById('srK').textContent=nf(P.k*q/100); document.getElementById('srP').textContent=(P.p*q/100).toFixed(1).replace('.',',');
    document.getElementById('srG').textContent=g1(P.g); document.getElementById('srL').textContent=g1(P.l);
    document.querySelectorAll('#srChips button').forEach(b=>b.classList.toggle('on',+b.getAttribute('data-v')===q)); };
  inp.addEventListener('input',upd);
  document.querySelectorAll('#srChips button').forEach(b=>b.onclick=()=>{ inp.value=b.getAttribute('data-v'); upd(); });
  document.getElementById('scanAgain').onclick=()=>scanOpen(scanMode,scanCurQ);
  document.getElementById('scanAdd').onclick=()=>{ const q=qty(); if(!q){ inp.focus(); return; } scanConfirm(q); };
  upd();
}
function scanConfirm(qty){
  const P=scanProd; if(!P)return;
  const r1=x=>x==null?null:Math.round(x*qty/100*10)/10;
  const kcal=Math.round(P.k*qty/100), prot=Math.round(P.p*qty/100*10)/10, gluc=r1(P.g), lip=r1(P.l), short=P.name.length>38?P.name.slice(0,36)+'…':P.name;
  if(scanMode==='question'&&scanCurQ&&aiData){
    aiSlider[scanCurQ]={val:qty,kcal:kcal,prot:prot,gluc:gluc,lip:lip,name:short}; aiAnswers[scanCurQ]=-1; renderQuestions(); scanStop(); return;
  }
  const u=qty+' g'; let f=foodlib.find(x=>x.bc===P.code&&x.u===u);
  if(!f){ f={id:'c'+Date.now(),n:short+' · '+u,k:kcal,p:prot,g:gluc,l:lip,u:u,fav:1,bc:P.code}; foodlib.push(f); saveFoodlib(); }
  else if(f.g==null&&f.l==null&&(gluc!=null||lip!=null)){ f.g=gluc; f.l=lip; saveFoodlib(); }
  logFood(f.id);
  scanStop(); try{ aiClose(); }catch(e){}
  const t=document.getElementById('xpToast'); if(t){ t.textContent='+'+kcal+' kcal ajoutés'; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); setTimeout(()=>t.classList.remove('on'),1600); }
}
document.getElementById('scanOpen').onclick=()=>scanOpen('meal');
document.getElementById('aiscan').onclick=()=>{ aiClose(); scanOpen('meal'); };
document.getElementById('scanclose').onclick=scanStop;
