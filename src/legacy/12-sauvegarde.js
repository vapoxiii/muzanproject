// ---- Sauvegarde : export / import de toutes les données locales (hors clé IA) ----
// Même format de fichier qu'avant (src/core/backup.js) : une sauvegarde de l'ancienne
// version se restaure ici, photos comprises, et inversement.
function bkMsg(t,cls){ const m=document.getElementById('bkMsg'); m.textContent=t; m.className='pf-hint'+(cls?' '+cls:''); }
async function bkExport(){
  bkMsg('Préparation de la sauvegarde…');
  try{
    const r=await MS.backup.exportFile('sauvegarde-suivi-'+todayStr()+'.json');
    bkMsg('Sauvegarde créée ('+r.count+' éléments, '+Math.max(1,Math.round(r.size/1024))+' Ko). Range-la dans Fichiers ou iCloud. Ta clé IA n’y est pas.','ok');
  }catch(e){ console.error(e); bkMsg('Impossible de créer la sauvegarde.','err'); }
}
function bkImportFile(file){
  if(!file)return;
  const r=new FileReader();
  r.onload=async()=>{
    let parsed; try{ parsed=MS.backup.parse(r.result); }
    catch(e){ bkMsg(e.code==='foreign'?'Ce fichier ne vient pas de cette app.':'Ce fichier n’est pas une sauvegarde lisible.','err'); return; }
    const o=parsed.o, keys=parsed.keys;
    const when=o.exportedAt?new Date(o.exportedAt).toLocaleDateString('fr-FR'):'date inconnue';
    if(!await TRUI.ask({title:'Restaurer la sauvegarde du '+when+' ('+keys.length+' éléments) ?',text:'Tes données actuelles seront remplacées.',ok:'Restaurer'}))return;
    bkMsg('Restauration…');
    try{ await MS.backup.restore(parsed); }
    catch(e){ console.error(e); bkMsg('La restauration a échoué. Tes données n’ont peut-être pas toutes été remplacées : réessaie.','err'); return; }
    bkMsg('Sauvegarde restaurée. Rechargement…','ok'); setTimeout(()=>location.reload(),600);
  };
  r.onerror=()=>bkMsg('Impossible de lire ce fichier.','err');
  r.readAsText(file);
}
document.getElementById('bkExport').onclick=bkExport;
document.getElementById('bkImport').onclick=()=>{ const f=document.getElementById('bkFile'); f.value=''; f.click(); };
document.getElementById('bkFile').addEventListener('change',e=>bkImportFile(e.target.files[0]));
