// ---- Photos de progression ----
// Les photos sont des fichiers JPEG dans le stockage de l'app (src/core/photos.js), et non plus du
// texte base64 dans localStorage. `photos` garde la même forme : [{ id, d, img }], img = adresse locale.
let photos=[];
function loadPhotos(){ photos=MS.photos.all(); photos.sort((a,b)=>a.d<b.d?-1:1); }
function savePhotos(){ /* chaque ajout ou suppression est enregistré aussitôt par MS.photos */ }
function addPhotoFile(file){
  const reader=new FileReader();
  reader.onload=()=>{ const img=new Image();
    img.onload=()=>{ const max=760; let w=img.width,h=img.height;
      if(w>h&&w>max){ h=Math.round(h*max/w); w=max; } else if(h>=w&&h>max){ w=Math.round(w*max/h); h=max; }
      const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
      const x=new Date(); const d=`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
      const keep=blob=>{ if(!blob)return; MS.photos.add(blob,d).then(ph=>{ if(!photos.some(p=>p.id===ph.id))photos.push(ph); photos.sort((a,b)=>a.d<b.d?-1:1); renderPhotos(); }).catch(e=>console.error('[photos]',e)); };
      try{ c.toBlob(b=>keep(b||file),'image/jpeg',0.72); }catch(e){ keep(file); } };
    img.onerror=()=>{}; img.src=reader.result; };
  reader.readAsDataURL(file);
}
function delPhoto(idx){ const ph=photos[idx]; TRUI.ask({title:'Supprimer cette photo ?',ok:'Supprimer',danger:true}).then(ok=>{ if(!ok)return; const i=photos.indexOf(ph); if(i<0)return; photos.splice(i,1); if(ph&&ph.id)MS.photos.remove(ph.id).catch(e=>console.error('[photos]',e)); renderPhotos(); }); }
function renderPhotos(){
  const grid=document.getElementById('photogrid'), empty=document.getElementById('photoempty'), meta=document.getElementById('photometa');
  grid.innerHTML='';
  if(!photos.length){ empty.style.display='block'; meta.textContent='aucune photo'; return; }
  empty.style.display='none'; meta.textContent=photos.length+' photo'+(photos.length>1?'s':'');
  photos.slice().reverse().forEach((ph,ri)=>{ const idx=photos.length-1-ri;
    const cell=document.createElement('div'); cell.className='pi';
    const im=document.createElement('img'); im.src=ph.img; im.alt='Photo '+ph.d; im.onclick=()=>openLightbox(ph.img);
    const dt=document.createElement('div'); dt.className='pd'; dt.textContent=fmtD(ph.d);
    const x=document.createElement('button'); x.className='px'; x.textContent='✕'; x.setAttribute('aria-label','Supprimer'); x.onclick=()=>delPhoto(idx);
    cell.appendChild(im); cell.appendChild(dt); cell.appendChild(x); grid.appendChild(cell); });
}
function openLightbox(src){ document.getElementById('lbimg').src=src; document.getElementById('lightbox').hidden=false; }
function closeLightbox(){ document.getElementById('lightbox').hidden=true; document.getElementById('lbimg').src=''; }
document.getElementById('photoinput').addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(f)addPhotoFile(f); e.target.value=''; });
document.getElementById('lbclose').onclick=closeLightbox;
document.getElementById('lightbox').addEventListener('click',e=>{ if(e.target.id==='lightbox')closeLightbox(); });
loadPhotos(); renderPhotos();
