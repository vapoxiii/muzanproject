// Interface du compte : bloc « Compte » du Profil, fenêtre de connexion par code,
// bandeaux (données reçues d'un autre appareil, nouvelle version), écran d'erreur.

import { brandMark } from './brand.js';
import { CLOUD_ENABLED, CONSENT_VERSION } from '../core/config.js';
import { auth, onAuthChange, onAccountInfo, sendCode, verifyCode, signOut, deleteAccount, refreshAccount, getClient } from '../core/auth.js';
import { connectAndSync } from '../core/cloud.js';
import { sync, onSyncChange, syncNow, setPhotoBackup, photosEnabled, clearRemoteChanged, snapshotInfo, snapshotBackup, dropSnapshot } from '../core/sync.js';
import { supabaseRemote } from '../core/remote.js';
import { buildBackup, downloadJSON, restoreBackup, parseBackup } from '../core/backup.js';
import { resetSyncState, flushStorage, sget } from '../core/storage.js';
import { setBridgeHook } from '../core/bridge.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PLAN_L = { free: 'Gratuite', pro: 'Pro', pro_plus: 'Pro+' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

let modalStep = 'email', pendingEmail = '', fromOnboarding = false, busy = false, resendAt = 0;

function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function nowHM(ts) {
  const d = new Date(ts), diff = Date.now() - ts;
  if (diff < 60000) return 'à l’instant';
  if (diff < 3600000) return 'il y a ' + Math.round(diff / 60000) + ' min';
  return 'à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ---------- textes de l'app qui parlent de l'endroit où sont les données ----------
function updatePrivacyTexts() {
  const on = !!auth.user;
  const ph = $('photoPrivacy');
  if (ph) ph.textContent = on && photosEnabled() ? 'Elles sont sauvegardées dans ton compte, visibles par toi seul.' : 'Elles restent uniquement sur ton téléphone.';
  const ft = $('pfFoot');
  if (ft) ft.textContent = on ? 'Tes données sont enregistrées sur ce téléphone et synchronisées avec ton compte.' : 'Tes coches sont sauvegardées automatiquement, en local sur ton téléphone.';
}

// ---------- bloc du Profil ----------
function mountProfileBlock() {
  const prof = $('v-profile'); if (!prof || $('pfAccount')) return;
  const block = el(`<div id="pfAccount" class="acc">
    <h2 class="grp-t acc-sh">Compte<span class="grp-m" id="accMeta"></span></h2>
    <div class="grp">
      <div class="pf-row"><span class="pf-k">Sauvegarde en ligne</span><span class="pf-s" id="accS" data-on="0">Non connectée</span><button type="button" class="pf-b" id="accB">Se connecter</button></div>
      <div class="pf-row" id="accSyncRow" hidden><span class="pf-k">Synchronisation</span><span class="pf-s" id="accSyncS"></span><button type="button" class="pf-b act" id="accSyncB">Synchroniser</button></div>
      <div class="pf-row" id="accAiRow" hidden><span class="pf-k">Analyses IA</span><span class="pf-s" id="accAiS"></span></div>
      <div class="pf-row" id="accPhRow" hidden><span class="pf-k">Photos</span><div class="seg2" id="accPh"><button type="button" data-ph="0">Ce téléphone</button><button type="button" data-ph="1">Compte</button></div></div>
    </div>
    <p class="pf-hint" id="accHint"></p>
  </div>`);
  const head = prof.querySelector('header');
  head.after(block);
  $('accB').onclick = () => openAccount({});
  $('accSyncB').onclick = () => { syncNow(); };
  $('accPh').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) togglePhotos(b.dataset.ph === '1'); });
}

function renderProfileBlock() {
  if (!$('pfAccount')) return;
  const u = auth.user, a = auth.account || {};
  $('accS').textContent = u ? u.email || 'Connectée' : 'Non connectée';
  $('accS').setAttribute('data-on', u ? '1' : '0');
  $('accB').textContent = u ? 'Gérer' : 'Se connecter';
  $('accSyncRow').hidden = !u; $('accAiRow').hidden = !u; $('accPhRow').hidden = !u;
  $('accMeta').textContent = u && a.plan ? 'Offre ' + (PLAN_L[a.plan] || a.plan) : '';
  $('accHint').textContent = u
    ? 'L’app marche aussi sans réseau : les changements partent dès que la connexion revient.'
    : 'Retrouve tes données sur tous tes appareils et l’analyse IA des repas sans clé. Sans compte, tout reste sur ce téléphone.';
  if (u) {
    let s;
    if (sync.state === 'syncing') s = 'En cours…';
    else if (sync.state === 'offline') s = 'Hors ligne' + (sync.pending ? ' · ' + sync.pending + ' en attente' : '');
    else if (sync.state === 'error') s = 'Erreur, nouvel essai bientôt';
    else s = sync.lastAt ? 'À jour, ' + nowHM(sync.lastAt) : 'En attente';
    $('accSyncS').textContent = s;
    $('accSyncS').setAttribute('data-on', sync.state === 'idle' && sync.lastAt ? '1' : '0');
    $('accSyncB').disabled = sync.state === 'syncing';
    const lim = a.ai_limit, used = a.ai_used || 0;
    $('accAiS').textContent = a.plan == null ? '—' : (lim == null ? 'Illimitées' : `${used} sur ${lim} aujourd’hui`);
    const on = photosEnabled();
    document.querySelectorAll('#accPh button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.ph === '1') === on)));
  }
  updatePrivacyTexts();
}

async function togglePhotos(on) {
  if (on === photosEnabled()) return;
  if (on) {
    if (!confirm('Sauvegarder tes photos de progression dans ton compte ? Elles seront envoyées sur le serveur (Union européenne), visibles par toi seul, et retrouvées sur tes autres appareils.')) return;
    await setPhotoBackup(true);
  } else {
    if (!confirm('Arrêter la sauvegarde des photos ? Les photos en ligne seront supprimées du serveur ; elles restent sur tes appareils.')) return;
    try {
      const c = await getClient();
      await supabaseRemote(c, auth.user.id).purgePhotos();
    } catch (e) { alertMsg('Impossible de joindre le serveur. Réessaie avec du réseau.'); return; }
    await setPhotoBackup(false);
  }
  renderProfileBlock();
}

function alertMsg(t) { const m = $('accMsg'); if (m && !$('accmodal').hidden) { m.textContent = t; m.classList.add('err'); } else alert(t); }

// ---------- fenêtre du compte ----------
function mountModal() {
  if ($('accmodal')) return;
  const m = el(`<div id="accmodal" class="modal" hidden><div class="sheet acc-sheet" role="dialog" aria-modal="true" aria-labelledby="accT">
    <div class="sheeth"><span class="st" id="accT">Ton compte</span><button type="button" id="accX" aria-label="Fermer">✕</button></div>
    <div id="accBody"></div>
  </div></div>`);
  document.body.appendChild(m);
  $('accX').onclick = closeAccount;
  m.addEventListener('click', (e) => { if (e.target.id === 'accmodal') closeAccount(); });
}

function openAccount(opts) {
  if (!CLOUD_ENABLED) return;
  mountModal();
  fromOnboarding = opts.from === 'onboarding';
  modalStep = auth.user ? 'manage' : (pendingEmail && modalStep === 'code' ? 'code' : 'email');
  renderModal();
  $('accmodal').hidden = false;
  if (auth.user) refreshAccount().then(renderModal).catch(() => {});
  setTimeout(() => { const f = $('accEmail') || $('accCode'); if (f && !('ontouchstart' in window)) f.focus(); }, 80);
}
function closeAccount() { const m = $('accmodal'); if (m) m.hidden = true; }

function setMsg(t, err) { const m = $('accMsg'); if (!m) return; m.textContent = t || ''; m.classList.toggle('err', !!err); }

function renderModal() {
  const B = $('accBody'); if (!B) return;
  const a = auth.account || {};
  if (modalStep === 'email') {
    $('accT').textContent = 'Ton compte';
    B.innerHTML = `<div class="acc-brand">${brandMark({ size: 'l' })}</div><p class="key-p">Sauvegarde tes séances, repas, mesures et photos, retrouve-les sur tous tes appareils, et utilise l’analyse IA des repas sans clé : <b>3 analyses offertes par jour</b>. Pas de mot de passe : tu reçois un code par e-mail.</p>
      <input id="accEmail" class="acc-in" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" placeholder="ton@email.fr" aria-label="Adresse e-mail" value="${esc(pendingEmail)}">
      <label class="acc-ok"><input type="checkbox" id="accOk"> <span>J’accepte que mes données de suivi (séances, repas, poids, mensurations, et mes photos si je l’active) soient hébergées dans l’Union européenne pour être sauvegardées et synchronisées. Ce sont des données de santé : je peux tout supprimer à tout moment depuis le Profil. <a href="./confidentialite.html" target="_blank" rel="noopener">Détails</a></span></label>
      <p class="key-msg" id="accMsg" role="status"></p>
      <button type="button" class="aibtn" id="accSend">Recevoir mon code</button>
      ${fromOnboarding ? '<button type="button" class="aisec" id="accFile">J’ai plutôt un fichier de sauvegarde</button>' : ''}
      <p class="key-n">Sans compte, l’app fonctionne entièrement sur ce téléphone, comme avant.</p>`;
    $('accSend').onclick = onSend;
    $('accEmail').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); onSend(); } });
    if ($('accFile')) $('accFile').onclick = () => { closeAccount(); const f = $('bkFile'); if (f) { f.value = ''; f.click(); } };
  } else if (modalStep === 'code') {
    $('accT').textContent = 'Code de connexion';
    B.innerHTML = `<div class="acc-brand">${brandMark({ size: 'l' })}</div><p class="key-p">On vient d’envoyer un code à <b>${esc(pendingEmail)}</b>. Il arrive en général en moins d’une minute (pense aux indésirables).</p>
      <input id="accCode" class="acc-in acc-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="000000" aria-label="Code reçu par e-mail">
      <p class="key-msg" id="accMsg" role="status"></p>
      <button type="button" class="aibtn" id="accVerify">Me connecter</button>
      <button type="button" class="aisec" id="accResend">Renvoyer le code</button>
      <button type="button" class="aisec" id="accBack">Changer d’adresse</button>`;
    $('accVerify').onclick = onVerify;
    const c = $('accCode');
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); onVerify(); } });
    c.addEventListener('input', () => { const v = c.value.replace(/\D/g, ''); if (v !== c.value) c.value = v; if (v.length === 6) onVerify(); });
    $('accResend').onclick = () => { if (Date.now() < resendAt) { setMsg('Attends quelques secondes avant de redemander un code.', true); return; } onSend(true); };
    $('accBack').onclick = () => { modalStep = 'email'; renderModal(); };
  } else if (modalStep === 'done') {
    $('accT').textContent = 'Connecté';
    B.innerHTML = `<p class="key-p" id="accDoneT">Connexion réussie. Synchronisation de tes données…</p><div class="spin"><i></i> Un instant</div>`;
  } else {
    $('accT').textContent = 'Ton compte';
    const snap = snapshotInfo();
    const lim = a.ai_limit;
    B.innerHTML = `<p class="key-p">Connecté avec <b>${esc(auth.user ? auth.user.email : '')}</b>.</p>
      <div class="acc-list">
        <div><span>Offre</span><b>${esc(PLAN_L[a.plan] || '—')}</b></div>
        <div><span>Analyses IA aujourd’hui</span><b>${a.plan == null ? '—' : lim == null ? 'Illimitées' : (a.ai_used || 0) + ' sur ' + lim}</b></div>
        <div><span>Synchronisation</span><b id="accSyncM">${esc(syncLine())}</b></div>
      </div>
      <p class="key-msg" id="accMsg" role="status"></p>
      <button type="button" class="aibtn" id="accSyncNow">Synchroniser maintenant</button>
      ${snap ? `<button type="button" class="aisec" id="accSnap">Revenir aux données d’avant la première synchro (${esc(new Date(snap.at).toLocaleDateString('fr-FR'))})</button>` : ''}
      <button type="button" class="key-del" id="accOut">Me déconnecter</button>
      <button type="button" class="key-del acc-danger" id="accDel">Supprimer mon compte et mes données en ligne</button>
      <p class="key-n">Te déconnecter garde tes données sur ce téléphone. Supprimer le compte efface tout ce qui est en ligne ; ce qui est sur tes appareils reste.</p>`;
    $('accSyncNow').onclick = async () => { setMsg('Synchronisation…'); await syncNow(); setMsg(sync.state === 'idle' ? 'Tout est à jour.' : syncLine(), sync.state !== 'idle'); };
    $('accOut').onclick = onSignOut;
    $('accDel').onclick = onDelete;
    if ($('accSnap')) $('accSnap').onclick = onSnapshot;
  }
}

function syncLine() {
  if (sync.state === 'syncing') return 'En cours…';
  if (sync.state === 'offline') return 'Hors ligne' + (sync.pending ? ', ' + sync.pending + ' en attente' : '');
  if (sync.state === 'error') return 'Erreur : ' + String((sync.error && sync.error.message) || '').slice(0, 80);
  return sync.lastAt ? 'À jour, ' + nowHM(sync.lastAt) : 'En attente';
}

const AUTH_MSG = {
  rate: 'Trop de demandes de code. Réessaie dans une minute.',
  badcode: 'Code incorrect ou expiré. Vérifie-le ou redemande un code.',
  network: 'Pas de connexion. Réessaie avec du réseau.',
  closed: 'Les inscriptions ne sont pas encore ouvertes.',
};

async function onSend(resend) {
  if (busy) return;
  const email = resend === true ? pendingEmail : ($('accEmail') ? $('accEmail').value.trim().toLowerCase() : '');
  if (resend !== true) {
    if (!EMAIL_RE.test(email)) { setMsg('Vérifie ton adresse e-mail.', true); return; }
    if (!$('accOk').checked) { setMsg('Coche la case pour accepter l’hébergement de tes données.', true); return; }
  }
  busy = true; const b = $('accSend') || $('accResend'); if (b) b.disabled = true;
  setMsg('Envoi du code…');
  try {
    await sendCode(email);
    pendingEmail = email; resendAt = Date.now() + 30000;
    try { sessionStorage.setItem('ms-consent', CONSENT_VERSION); } catch (e) { /* rien */ }
    modalStep = 'code'; renderModal();
    setMsg(resend === true ? 'Nouveau code envoyé.' : '');
    setTimeout(() => { const c = $('accCode'); if (c) c.focus(); }, 60);
  } catch (e) {
    setMsg(AUTH_MSG[e.code] || 'Envoi impossible : ' + e.message, true);
  } finally { busy = false; if (b) b.disabled = false; }
}

async function onVerify() {
  if (busy) return;
  const code = ($('accCode').value || '').replace(/\D/g, '');
  if (code.length < 6) { setMsg('Le code fait 6 chiffres.', true); return; }
  busy = true; $('accVerify').disabled = true; setMsg('Vérification…');
  try {
    await verifyCode(pendingEmail, code);
    modalStep = 'done'; renderModal();
    await connectAndSync();      // premier passage de synchro pour ce compte
    const got = sync.remoteChanged.length > 0;
    const t = $('accDoneT');
    if (sync.state !== 'idle') { if (t) t.textContent = 'Connecté. La synchronisation reprendra dès que le réseau le permet.'; setTimeout(closeAccount, 1600); }
    else if (got) {
      if (t) t.textContent = 'Tes données sont récupérées. Ouverture…';
      await flushStorage();
      setTimeout(() => location.reload(), 700);
    } else { if (t) t.textContent = 'C’est fait : tes données sont sauvegardées.'; setTimeout(closeAccount, 1400); }
  } catch (e) {
    setMsg(AUTH_MSG[e.code] || 'Connexion impossible : ' + e.message, true);
    modalStep = modalStep === 'done' ? 'code' : modalStep;
  } finally { busy = false; const v = $('accVerify'); if (v) v.disabled = false; }
}

async function onSignOut() {
  if (!confirm('Te déconnecter sur ce téléphone ? Tes données restent ici ; elles ne seront plus synchronisées.')) return;
  if (sync.pending) { setMsg('Envoi des derniers changements…'); try { await syncNow(); } catch (e) { /* tant pis */ } }
  await signOut();        // l'état de synchro est gardé : se reconnecter au même compte reprend où on en était
  await flushStorage();
  closeAccount();
}

async function onDelete() {
  if (!confirm('Supprimer définitivement ton compte et toutes tes données en ligne (sauvegarde, photos) ? Les données de ce téléphone restent.')) return;
  setMsg('Suppression…');
  try {
    try { if (photosEnabled()) { const c = await getClient(); await supabaseRemote(c, auth.user.id).purgePhotos(); } } catch (e) { /* le serveur supprime aussi les fichiers */ }
    await deleteAccount();
    resetSyncState(); await flushStorage();
    setMsg('Compte supprimé.');
    setTimeout(closeAccount, 1200);
  } catch (e) {
    setMsg(e.code === 'network' ? 'Pas de connexion. Réessaie avec du réseau.' : 'Suppression impossible : ' + e.message, true);
  }
}

async function onSnapshot() {
  const snap = snapshotInfo(); if (!snap) return;
  if (!confirm('Remettre sur ce téléphone les données d’avant la première synchronisation (' + new Date(snap.at).toLocaleString('fr-FR') + ') ? Elles remplaceront les données actuelles, puis seront synchronisées.')) return;
  const backup = snapshotBackup();
  await restoreBackup(parseBackup(JSON.stringify(backup)));
  await dropSnapshot();
  location.reload();
}

// ---------- bandeaux ----------
function banner(id, text, action, onAction) {
  let b = $(id);
  if (!b) {
    b = el(`<div class="ms-banner" id="${id}" role="status"><span></span><button type="button"></button><button type="button" class="ms-banner-x" aria-label="Fermer">✕</button></div>`);
    document.body.appendChild(b);
    b.querySelector('.ms-banner-x').onclick = () => { b.hidden = true; if (id === 'syncBanner') clearRemoteChanged(); };
  }
  b.querySelector('span').textContent = text;
  const btn = b.querySelector('button'); btn.textContent = action; btn.onclick = onAction;
  b.hidden = false;
}

function onSync() {
  renderProfileBlock();
  const m = $('accSyncM'); if (m) m.textContent = syncLine();
  if (sync.remoteChanged.length && modalStep !== 'done') {
    banner('syncBanner', 'Nouvelles données reçues d’un autre appareil.', 'Actualiser', async () => { await flushStorage(); location.reload(); });
  }
}

export function showUpdateBanner(apply) {
  banner('updBanner', 'Une nouvelle version de l’app est prête.', 'Mettre à jour', () => { apply(); setTimeout(() => location.reload(), 1500); });
}

// ---------- écran d'erreur au démarrage ----------
export function showFatal(e) {
  if ($('msFatal')) return;
  const d = el(`<div id="msFatal" class="ms-fatal" role="alert"><div>
    <h2>L’app n’a pas pu démarrer</h2>
    <p>Tes données sont intactes sur ce téléphone. Tu peux les exporter avant toute chose, puis recharger.</p>
    <button type="button" class="aibtn" id="msFatalExport">Exporter mes données</button>
    <button type="button" class="aisec" id="msFatalReload">Recharger</button>
    <pre>${esc(String((e && (e.stack || e.message)) || e).slice(0, 600))}</pre>
  </div></div>`);
  document.body.appendChild(d);
  $('msFatalReload').onclick = () => location.reload();
  $('msFatalExport').onclick = async () => {
    try { const out = await buildBackup(); const x = new Date(); downloadJSON(out, `sauvegarde-suivi-${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}.json`); }
    catch (err) { alert('Export impossible : ' + err.message); }
  };
}

// ---------- montage ----------
export function mountCloudUI() {
  setBridgeHook('openAccount', openAccount);
  if (!CLOUD_ENABLED) return;
  mountProfileBlock();
  mountModal();
  renderProfileBlock();
  onAuthChange(() => {
    renderProfileBlock();
    if (!$('accmodal').hidden && modalStep !== 'done') { modalStep = auth.user ? 'manage' : 'email'; renderModal(); }
    window.dispatchEvent(new CustomEvent('ms:auth'));
  });
  onAccountInfo(() => { renderProfileBlock(); if (!$('accmodal').hidden && modalStep === 'manage') renderModal(); });
  onSyncChange(onSync);
  setInterval(renderProfileBlock, 30000);
  if (sync.remoteChanged.length) onSync();
  window.dispatchEvent(new CustomEvent('ms:auth'));
}
