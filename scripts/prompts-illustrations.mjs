// Demandes à envoyer à un outil d'images (ChatGPT) pour illustrer chaque exercice : des salves de
// 30 exercices, dans l'ordre de la bibliothèque, envoyées 6 par 6 (une image de 6 cases par message). Écrit illustrations/lots.json (texte de chaque salve
// et identifiants des exercices, dans l'ordre : c'est ce qui relie ensuite chaque image à son exercice).
//   node scripts/prompts-illustrations.mjs
import { writeFileSync } from 'node:fs';
import { EXERCISES } from '../src/training/exercises.js';
import { D } from '../illustrations/descriptions.js';

const SIZE = 30;

// Muscle à faire briller, selon la cible
const HL = {
  'pecs-milieu': 'les pectoraux', 'pecs-haut': 'le haut des pectoraux, sous la clavicule', 'pecs-bas': 'le bas des pectoraux',
  'dos-largeur': 'les grands dorsaux (côtés du dos, sous les aisselles)', 'dos-epaisseur': 'le milieu du dos, entre les omoplates, et les grands dorsaux',
  'lombaires': 'les lombaires (bas du dos, de chaque côté de la colonne)', 'ep-ant': 'l’avant des épaules', 'ep-lat': 'le côté des épaules (deltoïdes latéraux)',
  'ep-post': 'l’arrière des épaules', 'coiffe': 'l’épaule, en profondeur (coiffe des rotateurs)', 'trap-haut': 'le haut des trapèzes, entre le cou et les épaules',
  'bi': 'les biceps', 'bi-long': 'les biceps, surtout la longue portion (côté extérieur du bras)', 'bi-court': 'les biceps, surtout la courte portion (côté intérieur du bras)',
  'brachial': 'le brachial (sous le biceps, côté extérieur) et le dessus de l’avant-bras',
  'tri-lat': 'les triceps, surtout la portion latérale (extérieur de l’arrière du bras)', 'tri-long': 'les triceps, surtout la longue portion (arrière du bras, vers l’aisselle)',
  'tri-poly': 'les triceps', 'avb-flech': 'les avant-bras, face intérieure', 'avb-ext': 'les avant-bras, face extérieure', 'grip': 'les avant-bras et les mains',
  'abs-haut': 'les abdominaux, surtout la partie haute', 'abs-bas': 'les abdominaux, surtout la partie basse', 'obliques': 'les obliques (côtés de la taille)',
  'gainage': 'toute la sangle abdominale', 'quad-squat': 'les quadriceps (avant des cuisses)', 'quad-uni': 'les quadriceps (avant des cuisses)',
  'quad-iso': 'les quadriceps (avant des cuisses)', 'isch-hanche': 'les ischio-jambiers (arrière des cuisses)', 'isch-genou': 'les ischio-jambiers (arrière des cuisses)',
  'fess-grand': 'les fessiers', 'fess-moyen': 'le moyen fessier (haut et côté de la fesse)', 'adducteurs': 'les adducteurs (intérieur des cuisses)',
  'mol-gastro': 'les mollets', 'mol-sol': 'les mollets, surtout leur partie basse (soléaire)', 'tibial': 'le devant du tibia', 'cou': 'les muscles du cou',
  'sdt': 'les fessiers, les ischio-jambiers et les lombaires', 'halterophilie': 'les jambes, les fessiers, les trapèzes et les épaules',
  'portes': 'les avant-bras, les trapèzes et la sangle abdominale', 'metcon': 'tout le corps', 'cardio': 'les jambes',
};
// Vue par défaut : trois-quarts avant, légèrement en plongée (celle de la planche validée)
const VIEW = { f: 'Vue de face.', tav: '', tar: 'Vue de trois-quarts arrière.', dos: 'Vue de dos.', dessus: 'Vue de dessus.' };
const PER_IMAGE = 6;

const missing = EXERCISES.filter((x) => !D[x.id]).map((x) => x.id);
const unknown = Object.keys(D).filter((id) => !EXERCISES.some((x) => x.id === id));
if (missing.length || unknown.length) { console.error('sans description :', missing, '— inconnus :', unknown); process.exit(1); }

function line(x, i) {
  const o = D[x.id];
  const v = o.v && VIEW[o.v] ? ' ' + VIEW[o.v] : '';
  return `${i}. ${x.n}. ${o.d} Muscle en violet : ${o.h || HL[x.c]}.${v}`;
}

const N = Math.ceil(EXERCISES.length / SIZE);
// Premier message d'une salve : les règles et les 6 premiers exercices
function rules(k, n) {
  const refs = k === 1
    ? 'Images jointes : Ren, le coach de l’application (une image de face et une planche de ses poses). C’est lui qui fait tous les exercices.'
    : 'Images jointes : Ren, le coach de l’application (une image de face et une planche de ses poses), et une planche déjà validée de la série 1 : copie exactement son rendu, sa caméra et son format.';
  return `Je crée les illustrations des exercices d’une application de musculation. Voici la série ${k} sur ${N} : ${n} exercices, que je t’envoie 6 par 6.

${refs}

Format :
- Pour chaque message : une seule image avec ses ${PER_IMAGE} exercices, sans commentaire. Image paysage 1536 × 1024, grille de 3 colonnes sur 2 lignes, 6 cases carrées identiques séparées par un trait noir fin et droit.
- Dans chaque case : fond uni #14131B, un seul exercice, entier et centré, avec une marge tout autour : cadre assez large pour que tout le matériel (barre et disques, câbles, machine) tienne dans la case sans être coupé. Pas de coin arrondi, pas de cadre.
- Aucun numéro, aucun texte, aucun titre, aucune flèche, aucun logo.
- Ordre dans l’image : ligne du haut de gauche à droite, puis ligne du bas de gauche à droite. S’il y a moins de 6 exercices, laisse les cases restantes vides.
- Si j’écris « refais 4 : … », refais l’image qui contient l’exercice 4 en corrigeant seulement ce point.

Personnage et rendu, pour toutes les cases :
- Le personnage est toujours Ren, identique aux images jointes : même visage, mêmes cheveux noirs bouclés, même peau, même morphologie athlétique. Expression concentrée, regard sur le mouvement.
- Même style de dessin que les images de Ren : illustration manga, traits nets, ombres douces. Le matériel est dessiné dans le même style.
- Tenue, toujours la même : torse nu (jamais de débardeur ni de t-shirt), un short de sport noir court, à mi-cuisse, pour que les cuisses restent visibles, des chaussettes blanches et des baskets blanches unies, sans bandes ni logo. Aucune marque nulle part. Pas de serviette, pas de bouteille.
- Seul le muscle indiqué brille en violet (#8B5CF6), directement sur la peau, comme éclairé de l’intérieur, à l’endroit exact du muscle. Seule exception : les fessiers, couverts par le short, où la lueur se voit à travers le tissu. Le reste du corps garde ses couleurs.
- Matériel réaliste et sobre, sans marque : métal anthracite (#2E2A42) et gris (#8B86A3), coussins violet très sombre (#3B3651). Au sol, seulement une ombre douce.
- Caméra : trois-quarts avant, légèrement en plongée, sauf si une autre vue est indiquée. Exercices allongés : tête à gauche de la case.
- Montre exactement la position décrite, avec une technique correcte : dos neutre, articulations dans l’axe, bonne prise, bon angle de banc. Deux exercices proches doivent se distinguer au premier coup d’œil.

`;
}
// Messages suivants : les 6 exercices de l'image, avec un rappel des règles
function next(img, from, to) {
  return `Image ${img} : exercices ${from} à ${to}. Même Ren (torse nu, short court, baskets blanches unies, sans bandes sur le côté), même rendu, même format (grille 3 × 2, 6 cases carrées, sans numéro ni texte, matériel entier dans chaque case).

`;
}

const lots = [];
for (let k = 0; k < N; k++) {
  const xs = EXERCISES.slice(k * SIZE, (k + 1) * SIZE);
  const parts = [];
  for (let p = 0; p * PER_IMAGE < xs.length; p++) {
    const from = p * PER_IMAGE + 1, to = Math.min(xs.length, (p + 1) * PER_IMAGE);
    const body = xs.slice(from - 1, to).map((x, i) => line(x, from + i)).join('\n');
    const head = p === 0 ? rules(k + 1, xs.length) + `Image 1 : exercices 1 à ${to}.\n\n` : next(p + 1, from, to);
    parts.push({ image: p + 1, from, to, text: head + body });
  }
  lots.push({ lot: k + 1, ids: xs.map((x) => x.id), names: xs.map((x) => x.n), muscles: [...new Set(xs.map((x) => x.m))], parts });
}
writeFileSync(new URL('../illustrations/lots.json', import.meta.url), JSON.stringify({ size: SIZE, total: EXERCISES.length, lots }, null, 1) + '\n');
console.log(N, 'salves,', lots.reduce((a, l) => a + l.parts.length, 0), 'images,', EXERCISES.length, 'exercices ; texte le plus long', Math.max(...lots.flatMap((l) => l.parts.map((p) => p.text.length))), 'caractères');
