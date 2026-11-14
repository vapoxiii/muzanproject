// ===== Compte et synchronisation : branchements avec le cœur (src/core, src/ui) =====
// Connexion ou déconnexion : statut de l'IA du Profil à jour, et l'analyse de repas
// qui attendait une connexion repart d'elle-même.
window.addEventListener('ms:auth', () => {
  try { renderAiStatus(); } catch (e) { console.error(e); }
  if (MS.ai.accountReady() && aiPendingTxt && !document.getElementById('aimodal').hidden) {
    const t = aiPendingTxt; aiPendingTxt = ''; aiReset(); document.getElementById('aitext').value = t; aiAnalyze();
  }
});
// Scanner : le module de lecture des codes-barres se charge en arrière-plan à la première
// visite de la Nutrition (il n'est plus chargé au démarrage).
{ let asked = false; const _svQ = showView; showView = function (v, sub, focus) { _svQ(v, sub, focus); if (v === 'nutrition' && !asked) { asked = true; MS.loadQuagga().catch(() => {}); } }; }
