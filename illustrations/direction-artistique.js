// Direction artistique : les textes envoyés à ChatGPT pour les couvertures de séance, les emblèmes
// de rang, les expressions de Ren et l'écran de repos. Une nouvelle conversation par série, un message par image ; le
// premier message porte les règles. Repris par la page des salves (bouton Copier pour chaque message).

const COUV_RAPPEL = 'Même série : même Ren, même tenue, même contre-jour violet venu de la droite, les 40 % de gauche vides et sombres, aucun texte ni logo.';
const EMB_RAPPEL = 'Même hexagone, même taille et même place que l’emblème précédent, même plaque centrale vide, fond transparent, aucune lettre, aucune lueur floue autour.';

const COUV_REGLES = `Je crée les couvertures des séances d’une application de musculation au style manga sombre. Il y en a 9, une par type de séance : je te les demande une par une, une image par message.

Images jointes : Ren, le coach de l’application (une image de face et une planche de ses poses).

Format, pour chaque message :
- Une seule image, sans commentaire. Paysage 1536 × 1024.
- Ren est dans la moitié droite de l’image. Les 40 % de gauche restent vides et très sombres : l’application y écrit le nom de la séance. Rien dans cette zone : ni objet, ni lumière, ni ligne.
- Son visage reste entre 20 % et 70 % de la hauteur : l’image sera aussi recadrée en bandeau.
- Les bords se fondent dans le noir #0B0A0F, surtout à gauche et en bas, pour que l’image se fonde dans le fond de l’application. Pas de cadre, pas de coins arrondis.
- Aucun texte, aucun chiffre, aucun logo, aucune signature.
- Si j’écris « refais : … », refais la dernière image en corrigeant seulement ce point.

Ren, dans toutes les couvertures :
- Identique aux images jointes : même visage, mêmes cheveux noirs bouclés, même peau, même morphologie athlétique, une oreillette blanche.
- Tenue, sauf pour la natation : son débardeur noir sans manches, son jogging noir ample resserré aux chevilles et des baskets blanches unies, sans logo, sans lettre, sans bande. Pas de bracelet. Aucune marque nulle part.

Rendu, le même pour les 9 couvertures, qui forment une série :
- Illustration manga moderne, comme une couverture de tome : traits nets, ombres franches, contraste fort.
- Décor : une salle de sport plongée dans le noir, à peine suggérée, le matériel flou dans l’ombre. Pas de fenêtre, pas de néon, pas d’écran.
- Lumière : un contre-jour violet (#925CFF) venu de la droite dessine le contour de Ren ; une lumière faible et froide éclaire son visage. Tout le reste est dans l’ombre.
- Couleurs : noir, violets (#925CFF, #C5A3FF), la peau de Ren et un peu de blanc. Aucune autre couleur vive.
- Quand la scène est en mouvement, quelques lignes de vitesse manga, fines et discrètes, derrière Ren. Jamais sur son visage ni dans la zone de gauche.
- Caméra de cinéma : contre-plongée ou plongée marquée, cadrage serré, de la profondeur.
- Technique correcte : dos neutre, bonne prise, articulations dans l’axe.`;

const COUVERTURES = [
  ['Poussée', 'Couverture 1 : Poussée (pectoraux, épaules, triceps).',
    'Ren debout, en développé militaire avec deux haltères : bras tendus au-dessus de la tête, haltères qui se touchent presque, mâchoire serrée, regard droit devant. Contre-plongée marquée, cadrage des haltères jusqu’aux hanches.'],
  ['Tirage', 'Couverture 2 : Tirage (dos, biceps).',
    'Ren en haut d’une traction à la barre fixe, le menton au-dessus de la barre, vu de trois-quarts arrière en contre-plongée : le dos large en V, les dorsaux dessinés par le contre-jour violet. Il tourne la tête : on voit son profil. La barre sort du cadre par la droite ; à gauche, elle se perd dans l’ombre avant le milieu de l’image.'],
  ['Jambes', 'Couverture 3 : Jambes.',
    'Ren en squat, une barre chargée sur le haut du dos, en bas du mouvement : cuisses à l’horizontale, dos droit, regard droit devant. Caméra basse, de trois-quarts avant. À gauche, la barre et ses disques se perdent dans l’ombre.'],
  ['Jambes 2', 'Couverture 4 : Jambes, deuxième séance de la semaine. Elle ne doit pas ressembler à la couverture 3.',
    'Ren en fente avant, un haltère dans chaque main, bras le long du corps, genou arrière près du sol, buste droit, regard concentré. Vue de profil trois-quarts, caméra basse.'],
  ['Haut du corps', 'Couverture 5 : Haut du corps.',
    'Ren en pompe, vu de face au ras du sol : les mains au premier plan, les épaules et les bras puissants, le corps droit qui s’éloigne derrière lui, regard vers nous. Perspective forte.'],
  ['Full body', 'Couverture 6 : Full body (tout le corps).',
    'Ren en kettlebell swing, en haut du mouvement : hanches tendues, bras tendus devant lui, kettlebell à hauteur de poitrine, corps gainé. Vue de trois-quarts. Une ligne de vitesse suit l’arc de la kettlebell, qui reste dans la moitié droite de l’image.'],
  ['Bras', 'Couverture 7 : Bras.',
    'Ren de trois-quarts, en curl avec un haltère : biceps contracté au maximum, l’autre bras le long du corps, regard sur son biceps, léger sourire en coin. Cadrage de la tête à la taille.'],
  ['Natation', 'Couverture 8 : Natation.',
    'Ren dans une piscine sombre, dans l’eau jusqu’à la poitrine, les avant-bras posés sur le rebord, cheveux mouillés, gouttes d’eau sur les épaules, regard vers nous. L’eau est noire avec des reflets violets ondulés ; à gauche, l’eau et le rebord restent calmes et dans l’ombre.',
    'Même Ren, même contre-jour violet venu de la droite, les 40 % de gauche vides et sombres, aucun texte ni logo. Seule la tenue change : torse nu, lunettes de natation relevées sur le front, pas de bonnet, pas d’oreillette.'],
  ['Repos', 'Couverture 9 : Jour de repos.',
    'Ambiance calme : lumière plus douce, pas de lignes de vitesse. Ren assis sur un banc, une serviette sombre sur la nuque, les coudes sur les genoux, une gourde noire unie dans une main, yeux mi-clos, petit sourire tranquille. Caméra à hauteur des yeux.'],
];

const EMB_REGLES = `Je crée les emblèmes des rangs d’une application de musculation au style manga sombre. Il y a 7 rangs, du plus bas au plus haut : E, D, C, B, A, S et SS. Je te les demande un par un, une image par message.

Format, pour chaque message :
- Une seule image carrée 1024 × 1024, sans commentaire, sur fond transparent (PNG). Si le fond transparent est impossible : fond vert uni #00FF00, sans ombre et sans reflet vert sur l’emblème.
- L’emblème est vu de face, centré.
- Aucune lettre, aucun chiffre, aucun texte : l’application écrit la lettre du rang au centre.
- Bords nets : aucune lueur, fumée ou étincelle floue qui déborde sur le fond. L’application ajoute la lueur elle-même.
- Si j’écris « refais : … », refais le dernier emblème en corrigeant seulement ce point.

La base, la même pour les 7 rangs :
- Un hexagone régulier, pointe en haut, en métal, d’environ 55 % de la largeur de l’image, exactement au centre.
- Au centre de l’hexagone, une plaque lisse, sombre (#15141C) et vide, qui en occupe environ les deux tiers : la lettre sera écrite dessus.
- Cet hexagone garde exactement la même taille et la même place dans les 7 images. Seuls les matières et les ornements autour changent : chaque rang reprend le précédent et monte d’un cran. Les ornements peuvent occuper l’espace autour, en gardant une marge de 5 % au bord de l’image.
- Style : emblème de jeu vidéo au rendu manga, net et moderne. Métal brossé, émail et cristal, reflets francs, sans surcharge. Lisible même en tout petit, à 40 pixels.
- Couleurs : noir, acier, argent, violets (#925CFF, #C5A3FF) et blanc. Pas d’or, pas de jaune, pas de rouge, pas de bleu.

La progression, pour que tu saches où on va :
- E, Recrue : acier sombre et mat, bord simple, aucun ornement.
- D, Initié : acier un peu plus clair, un fin liseré violet le long du bord.
- C, Confirmé : bord en émail violet et un petit chevron sous l’hexagone.
- B, Aguerri : cadre chromé brillant, émail violet, deux lames stylisées qui dépassent sur les côtés.
- A, Élite : émail violet profond, liseré violet clair, deux ailes métalliques stylisées.
- S, Maître : argent et cristal violet taillé, ailes plus grandes, trois pointes de couronne au-dessus.
- SS, Légende : double cadre argent et violet, grandes ailes, couronne, flammes violettes stylisées en aplats nets tout autour et deux petites étoiles.`;

const EMBLEMES = [
  ['E', 'Emblème 1 : E, Recrue.',
    'Acier sombre et mat, bord simple, aucun ornement. Sobre, mais déjà soigné : c’est le premier rang.'],
  ['D', 'Emblème 2 : D, Initié.',
    'Reprends E : acier un peu plus clair, et un fin liseré violet (#925CFF) le long du bord. Pas d’autre ornement.'],
  ['C', 'Emblème 3 : C, Confirmé.',
    'Reprends D : le bord devient de l’émail violet, et un petit chevron métallique pointe vers le bas sous l’hexagone.'],
  ['B', 'Emblème 4 : B, Aguerri.',
    'Reprends C : le cadre devient chromé et brillant, et deux lames stylisées dépassent à l’horizontale de chaque côté de l’hexagone.'],
  ['A', 'Emblème 5 : A, Élite.',
    'Reprends B : émail violet profond, liseré violet clair (#C5A3FF), et les lames deviennent deux ailes métalliques stylisées, de chaque côté.'],
  ['S', 'Emblème 6 : S, Maître.',
    'Reprends A : cadre en argent et cristal violet taillé, ailes plus grandes, et trois pointes de couronne au-dessus de l’hexagone.'],
  ['SS', 'Emblème 7 : SS, Légende.',
    'Reprends S : double cadre argent et violet, grandes ailes, couronne, des flammes violettes stylisées en aplats nets tout autour et deux petites étoiles. Le plus spectaculaire des sept, mais toujours net et lisible.'],
];

const EXPRESSIONS = `Je crée les expressions de Ren, le coach d’une application de musculation au style manga, pour les petites pastilles rondes à côté de ses messages.

Images jointes : Ren (une image de face et une planche de ses poses).

Format :
- Une seule image, sans commentaire. Paysage 1536 × 1024, grille de 3 colonnes sur 2 lignes : 6 cases carrées identiques, séparées par un trait noir fin et droit.
- Dans chaque case : fond uni #1D1B28 et Ren en buste, la tête et le haut des épaules. Le visage est grand et bien au centre : il doit rester lisible dans un rond de 40 pixels.
- Exactement le même cadrage dans les 6 cases : même taille de tête, même place, même angle. Seule l’expression change.
- Tête légèrement tournée vers la droite de l’image, de trois-quarts, regard vers nous.
- Aucun texte, aucun numéro, aucun cadre, aucune bulle, aucun logo.
- Ordre : ligne du haut de gauche à droite, puis ligne du bas de gauche à droite.
- Si j’écris « refais 4 : … », refais l’image en corrigeant seulement l’expression 4.

Ren, dans les 6 cases :
- Identique aux images jointes : même visage, mêmes cheveux noirs bouclés, même peau. Son débardeur noir sans manches et une oreillette blanche.
- Même style de dessin que les images jointes : manga, traits nets, ombres douces. Un contre-jour violet (#925CFF) détache ses cheveux et ses épaules du fond.

Les 6 expressions :
1. Concentré : regard intense, sourcils légèrement froncés, bouche fermée.
2. Souriant : sourire franc et chaleureux, regard bienveillant.
3. Fier : sourire en coin, menton un peu relevé, regard satisfait.
4. Épaté : sourcils levés, yeux grands ouverts, bouche ouverte dans un sourire enthousiaste.
5. Serein : yeux mi-clos, petit sourire calme, une serviette sombre sur l’épaule, quelques gouttes de sueur.
6. Exigeant : regard dur et direct, sourcils froncés, mâchoire serrée, pas de sourire.`;

const REPOS_RAPPEL = 'Même rendu que l’image 1, mais personne dans l’image.';
const REPOS_REGLES = `Je crée l’écran de repos d’une application de musculation au style manga sombre : entre deux séries, Ren tend son poignet vers l’utilisateur pour lui montrer sa montre connectée. L’application dessine elle-même tout le cadran (l’heure, le décompte, l’anneau) par-dessus l’écran de la montre, ainsi que les boutons et la carte du bas. Je te demande deux images, une par message.

Images jointes : Ren, le coach de l’application (une image de face et une planche de ses poses), et la maquette de l’écran, qui montre la pose voulue.

Format, pour chaque message :
- Une seule image, sans commentaire. Portrait 1024 × 1536.
- Aucun texte, aucun chiffre, aucun logo, aucune signature, aucun bouton ni élément d’interface : ni l’heure, ni le décompte, ni les boutons, ni la carte de la maquette.
- Si j’écris « refais : … », refais la dernière image en corrigeant seulement ce point.

Ren :
- Identique aux images jointes : même visage, mêmes cheveux noirs bouclés, même peau, même morphologie athlétique, une oreillette blanche.
- Son débardeur noir sans manches. Aucune marque nulle part, pas de bracelet éponge.

Rendu : illustration manga moderne, traits nets, ombres franches, contraste fort. Couleurs : noir, violets (#925CFF, #C5A3FF), la peau de Ren et un peu de blanc.`;

const REPOS = [
  ['Ren et sa montre', 'Image 1 : Ren, seul, sur fond transparent.',
    'Ren de face, très légèrement de trois-quarts, cadré de la taille au sommet de la tête, dans la pose de la maquette : il avance le bras droit vers nous à hauteur de poitrine, l’avant-bras à l’horizontale qui traverse l’image vers la droite, poing fermé, et nous regarde par-dessus, calme et sûr de lui. À ce poignet, une montre connectée inspirée de l’Apple Watch : boîtier rectangulaire aux angles très arrondis, contour métallique gris violet, couronne crantée sur le côté, bracelet noir. L’écran de la montre est entièrement noir, uni et vide : ni heure, ni anneau, ni icône, ni reflet blanc (l’app y dessine le cadran). La montre est grande, son cadran bien tourné vers nous, centrée horizontalement, vers 45 % de la hauteur, sur environ un tiers de la largeur de l’image. Tout le visage et tout le poing sont dans l’image ; le bas du corps se perd dans le noir. Fond entièrement transparent (PNG) : aucun décor, aucun halo, aucune ombre au sol.'],
  ['La salle', 'Image 2 : la salle, sans personnage.',
    'Une salle de musculation plongée dans le noir, vue à hauteur d’homme : au loin, des fenêtres et des éclairages violets (#925CFF) flous, deux ou trois lampes de plafond allumées, un rack et des haltères dans l’ombre, un mur de béton. Tout est flou, comme derrière un personnage au premier plan (profondeur de champ), avec un léger grain. Le centre de l’image reste sombre et calme : Ren y sera posé. Le tiers du bas se fond dans le noir #07060B : les boutons et la carte s’y posent. Pas de graffiti, pas d’inscription, pas de miroir.', REPOS_RAPPEL],
];

// Cuisine de la Nutrition : le décor, puis Ren au shaker, à part. L'app pose les zones à toucher
// (frigo, ardoise, balance, shaker de Ren), le titre, la bulle de Ren et la maison par-dessus.
const CUISINE_RAPPEL = 'Même rendu que l’image 1 ; cette fois Ren seul, sans décor, pour se tenir dans cette cuisine.';
const CUISINE_REGLES = `Je crée l’entrée de la partie Nutrition d’une application de musculation au style manga sombre : une cuisine dont on touche les objets. La balance posée sur le plan de travail sert à noter ce qu’on a mangé, le réfrigérateur ouvre ses aliments, l’ardoise au mur montre l’objectif de calories, et Ren, le coach, se tient dans la cuisine, un shaker à la main. L’application ajoute elle-même les textes, les boutons et ce qui s’écrit sur l’ardoise. Je te demande deux images, une par message.

Images jointes : Ren, le coach de l’application (une image de face et une planche de ses poses).

Format, pour chaque message :
- Une seule image, sans commentaire. Portrait 1024 × 1536.
- Aucun texte, aucun chiffre, aucun logo, aucune marque, aucune signature, aucun élément d’interface.
- Si j’écris « refais : … », refais la dernière image en corrigeant seulement ce point.

Rendu : illustration manga moderne, traits nets, ombres franches, contraste fort. Couleurs : noir, violets (#925CFF, #C5A3FF), un peu de blanc et quelques touches de lumière chaude.`;

const CUISINE = [
  ['La cuisine', 'Image 1 : la cuisine, sans personnage.',
    `Une cuisine moderne la nuit, vue de face à hauteur d’homme, sobre et haut de gamme : façades noires mates, plan de travail en pierre sombre, quelques lumières chaudes sous les meubles hauts, une lueur violette (#925CFF) venue de la droite. Composition à respecter, car l’application pose ses éléments par-dessus :
- Le quart du haut : mur et meubles hauts dans la pénombre, calmes, sans objet. Le titre et la bulle de Ren s’y posent.
- À gauche, un grand réfrigérateur noir à deux portes, de face, entier et bien lisible, du bas du premier quart jusqu’au plan de travail. Il n’est pas collé au bord : un sixième de la largeur reste libre à sa gauche, car les bords de l’image sont coupés sur certains téléphones. Ni écran ni distributeur sur ses portes.
- Au mur, au centre, au-dessus du plan de travail : une petite ardoise noire encadrée de bois clair, accrochée bien droite, face à nous, entièrement vide (l’application y écrira à la craie).
- Le plan de travail traverse toute l’image aux deux tiers de la hauteur. Dessus, au centre, une balance de cuisine numérique plate, bien visible, son écran éteint et noir. Rien d’autre sur la moitié gauche du plan de travail.
- La moitié droite, au-dessus du plan de travail, reste dégagée et sombre : Ren y sera posé (image 2, à part).
- Sous le plan de travail, les façades se fondent dans le noir #0B0A0F sur le dernier sixième de l’image : le bouton de l’application s’y pose.
Pas de personnage, pas de fenêtre, pas d’écran, pas d’inscription, pas d’aliments en désordre.`],
  ['Ren au shaker', 'Image 2 : Ren, seul, sur fond transparent.',
    `Ren de face, très légèrement de trois-quarts, cadré de la mi-cuisse au sommet de la tête, détendu et sûr de lui : de la main droite, il tient un shaker de protéines à hauteur de poitrine, un peu tendu vers nous ; l’autre main dans la poche de son jogging. Petit sourire, il nous regarde. Le shaker est noir mat avec un bouchon violet (#925CFF), sans logo, sans graduation, sans texte, et bien visible : on le touchera dans l’application.
Ren est identique aux images jointes : même visage, mêmes cheveux noirs bouclés, même peau, même morphologie athlétique, une oreillette blanche. Son débardeur noir sans manches et son jogging noir ample. Aucune marque nulle part, pas de bracelet, pas de montre. Un contre-jour violet (#925CFF) venu de la droite, comme la lueur de la cuisine.
Fond transparent (PNG). Si le fond transparent est impossible : fond vert uni #00FF00, sans reflet vert sur Ren.`, CUISINE_RAPPEL],
];

// Premier message : les règles, puis la première image ; ensuite un rappel court (ou celui propre à
// l'image) et la scène
const serie = (regles, rappel, items) => items.map(([nom, titre, scene, propre], i) => ({
  nom,
  texte: i === 0 ? `${regles}\n\n${titre}\n${scene}` : `${titre} ${propre || rappel}\n${scene}`,
}));

export const SERIES = [
  {
    id: 'couvertures', titre: 'Couvertures de séance', format: '9 images · paysage 1536 × 1024',
    joins: ['ren.png', 'ren-poses.png'],
    app: 'En fond de la carte « Séance du jour » de l’accueil et en bandeau des séances dans Entraînement. Le nom de la séance s’écrit à gauche. Deux couvertures Jambes, parce que ton programme a deux séances jambes.',
    parts: serie(COUV_REGLES, COUV_RAPPEL, COUVERTURES),
  },
  {
    id: 'emblemes', titre: 'Emblèmes de rang', format: '7 images · carré 1024 × 1024, fond transparent',
    joins: [],
    app: 'Dans le bouton de rang de l’accueil, le profil, l’échelle des rangs et l’écran de passage de rang. La lettre et la lueur sont ajoutées par l’app.',
    parts: serie(EMB_REGLES, EMB_RAPPEL, EMBLEMES),
  },
  {
    id: 'expressions', titre: 'Expressions de Ren', format: '1 image · 6 cases',
    joins: ['ren.png', 'ren-poses.png'],
    app: 'Dans les pastilles de Ren, à côté de ses messages : concentré pour la séance du jour, fier quand elle est validée, serein les jours de repos, épaté pour un objet ou un rang débloqué, exigeant si tu as choisi ce ton.',
    parts: [{ nom: '6 expressions', texte: EXPRESSIONS }],
  },
  {
    id: 'repos', titre: 'Écran de repos', format: '2 images · portrait 1024 × 1536 (Ren sur fond transparent, puis la salle)',
    joins: ['ren.png', 'ren-poses.png', 'ta maquette de l’écran de repos'],
    app: 'Dans l’écran de repos, après chaque série validée : la salle en fond, Ren devant, et l’app pose le cadran sur l’écran noir de sa montre. En attendant, l’app utilise Ren découpé dans ta maquette, cadran vidé.',
    parts: serie(REPOS_REGLES, REPOS_RAPPEL, REPOS),
  },
  {
    id: 'cuisine', titre: 'Cuisine de la Nutrition', format: '2 images · portrait 1024 × 1536 (la cuisine, puis Ren sur fond transparent)',
    joins: ['ren.png', 'ren-poses.png'],
    app: 'L’entrée de la Nutrition : la cuisine en fond, Ren devant à droite, sa bulle au-dessus. La balance pour noter ce que tu as mangé (scanner, photo du plat, recherche) et voir tes repas du jour, le shaker de Ren pour les protéines et habitudes, l’ardoise pour l’objectif (l’app y écrit tes calories à la craie), le frigo pour tes aliments.',
    parts: serie(CUISINE_REGLES, CUISINE_RAPPEL, CUISINE),
  },
];
