// Aperçu de test (page publiée dans Claude) : données d'exemple au premier lancement,
// et un bloc dans le Profil pour recharger l'exemple ou repartir de zéro.
// Construit seulement avec `npm run apercu` (VITE_APERCU=1) ; absent de l'app installée.
import { sget, sset, sdel, skeys, flushStorage } from '../core/storage.js';
import { photosAll, removePhoto } from '../core/photos.js';
import { demoData } from './demo.js';
import { ask, toast } from '../training/ui/dom.js';

const MODE = 'apercu:mode';

function hasAppData() { return skeys().some((k) => k !== MODE); }

// Premier lancement (ou après « Recharger l'exemple ») : on remplit avec l'exemple
export function seedIfEmpty() {
  if (hasAppData() && sget(MODE) !== 'recharger') return false;
  if (sget(MODE) === 'vide') return false;
  for (const k of skeys()) sdel(k);
  const d = demoData();
  for (const k in d) sset(k, d[k]);
  sset(MODE, 'exemple');
  return true;
}

async function resetTo(mode) {
  for (const k of skeys()) sdel(k);
  try { for (const p of photosAll()) await removePhoto(p.id); } catch (e) { /* rien */ }
  sset(MODE, mode);
  await flushStorage();
  location.reload();
}

const CSS = `
.apx{margin:30px 0 0; padding:16px; border-radius:20px; background:var(--surf); box-shadow:inset 0 0 0 1px rgba(197,163,255,.18)}
.apx-t{margin:0; font-size:15px; font-weight:700; color:var(--hot2)}
.apx-p{margin:6px 0 0; font-size:13px; font-weight:500; line-height:1.45; color:var(--muted)}
.apx-b{display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:14px}
.apx-b button{min-height:44px; border:0; border-radius:12px; background:var(--surf2); color:var(--txt); font-family:inherit; font-size:13.5px; font-weight:600; cursor:pointer}
`;

export function mountApercu() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  // en bas du Profil, après les réglages : un outil de test, à l'écart du parcours normal
  const pf = document.getElementById('pfFoot');
  if (pf) {
    const box = document.createElement('div');
    box.className = 'apx';
    box.setAttribute('data-new', '');
    const empty = sget(MODE) === 'vide';
    box.innerHTML = `<p class="apx-t">Aperçu de test</p>
      <p class="apx-p">${empty ? 'Tu es reparti de zéro, comme un nouvel utilisateur.' : 'Données d’exemple : 8 semaines de séances, de pesées et de repas.'}
      Tout reste dans ce navigateur. Le scanner, l’analyse IA, l’export et le compte ne marchent pas ici.</p>
      <div class="apx-b"><button type="button" id="apxDemo">Recharger l’exemple</button><button type="button" id="apxBlank">Repartir de zéro</button></div>`;
    pf.insertAdjacentElement('beforebegin', box);
    box.querySelector('#apxDemo').onclick = async () => {
      if (await ask({ title: 'Recharger les données d’exemple ?', text: 'Ce que tu as fait dans l’aperçu sera effacé.', ok: 'Recharger' })) resetTo('recharger');
    };
    box.querySelector('#apxBlank').onclick = async () => {
      if (await ask({ title: 'Repartir de zéro ?', text: 'L’aperçu s’ouvrira comme pour un nouvel utilisateur, avec la création du profil.', ok: 'Repartir de zéro' })) resetTo('vide');
    };
  }
  let seen = false;
  try { seen = sessionStorage.getItem('apercu:vu') === '1'; sessionStorage.setItem('apercu:vu', '1'); } catch (e) { /* rien */ }
  if (!seen) setTimeout(() => toast('Aperçu de test : réglages de l’exemple dans Profil'), 1200);
}
