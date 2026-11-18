# MON-SUIVI

Suivi entraînement, nutrition, mesures et photos — app web installable sur l’écran d’accueil.
Version 2 : même app à l’écran, mais un vrai projet derrière.

- **Données sur le téléphone** dans IndexedDB (plus de limite de 5 Mo), photos en vrais fichiers.
  Reprise automatique des données de l’ancienne version au premier lancement.
- **Compte facultatif** (Supabase, hébergé dans l’UE) : sauvegarde et synchronisation entre appareils,
  connexion par code reçu par e-mail. Sans compte, tout reste en local, comme avant.
- **IA côté serveur** : l’analyse des repas passe par une fonction serveur avec la clé du projet et un
  quota par jour (gratuit 3, Pro 20, Pro+ illimité). La clé personnelle reste possible.
- **Hors ligne** : l’app s’ouvre sans réseau ; une nouvelle version s’installe au démarrage suivant.
- **Programme modifiable** : 352 exercices de musculation, classés par portion ou fonction travaillée
  (longue portion du biceps, haut des pectoraux…), séances et jours au choix, séries, répétitions et repos
  réglés au curseur. Ou construit avec le coach : ses questions, puis ses séances, où l’on choisit chaque
  exercice parmi ceux qui travaillent pareil. En séance : charges et répétitions notées série par série, pré-remplies
  avec la dernière fois, minuteur de repos, records.

---

## 1. Mettre la nouvelle version en ligne (sans compte)

1. **Avant tout**, dans l’app actuelle : Profil → *Exporter mes données*, et garde le fichier.
2. Mets le contenu de ce dossier **dans le même dépôt GitHub** que l’app actuelle (remplace les fichiers).
   Même dépôt = même adresse : l’icône de l’écran d’accueil ouvre la nouvelle version et les données sont
   reprises toutes seules. L’ancienne adresse `…/mon-suivi-app.html` continue de fonctionner.
3. Sur GitHub : *Settings → Pages → Source : GitHub Actions*. À chaque envoi sur `main`, le workflow
   `.github/workflows/deploy.yml` vérifie, construit et publie.
4. Si les données n’apparaissent pas (autre adresse, autre appareil) : Profil → *Importer une sauvegarde*
   avec le fichier exporté à l’étape 1. Le format est le même dans les deux sens.

L’ancien `localStorage` n’est pas effacé : revenir à l’ancienne version reste possible.

## 2. Activer les comptes (Supabase)

1. **Projet** : sur supabase.com, *New project*, région **Europe (Paris ou Francfort)**.
2. **Base** : *SQL Editor* → colle le contenu de `supabase/migrations/20261026120000_comptes_synchro_ia.sql` → *Run*.
   Le script peut être rejoué sans risque.
3. **Connexion par code** : *Authentication → Emails → Templates*. Dans **Magic Link** et dans
   **Confirm signup**, remplace le contenu par un message qui contient le code, par exemple :

   ```html
   <h2>Ton code MON-SUIVI</h2>
   <p>Saisis ce code dans l’app : <strong style="font-size:24px">{{ .Token }}</strong></p>
   <p>Il est valable une heure. Si tu n’as rien demandé, ignore ce message.</p>
   ```

   Garde la longueur du code à 6 chiffres (*Authentication → Providers → Email*).
4. **Fonctions serveur** (IA et suppression de compte), avec la CLI Supabase :

   ```sh
   npx supabase login
   npx supabase link --project-ref <reference-du-projet>
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... ALLOWED_ORIGINS=https://<ton-compte>.github.io
   npx supabase functions deploy
   ```

   (Mets la référence du projet dans `supabase/config.toml`. `verify_jwt = false` y est voulu : le jeton
   est vérifié dans la fonction.)
5. **Brancher l’app** : *Project Settings → API* → URL du projet et clé *anon* (ou *publishable*).
   Sur GitHub : *Settings → Secrets and variables → Actions → Variables* :
   `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`. Relance le workflow. Le bloc **Compte** apparaît
   en haut du Profil.
6. **Ton offre** : une fois connecté une première fois, dans le *SQL Editor* :

   ```sql
   update public.profiles set plan = 'pro_plus'
   where id = (select id from auth.users where email = 'ton@adresse.fr');
   ```

7. **Offre gratuite de Supabase** : un projet sans activité pendant une semaine est mis en pause.
   L’app continue de marcher en local ; la synchronisation reprend quand le projet est relancé
   (bouton *Restore* dans le tableau de bord).
8. **Avant d’ouvrir à d’autres personnes** : l’envoi d’e-mails par défaut de Supabase est très limité
   (quelques messages par heure, destinataires restreints). Configure un SMTP (*Authentication → SMTP*,
   ex. Resend), et relis `public/confidentialite.html` (projet de notice, points « à vérifier »).

## 3. Ce qui change à l’usage

- Rien à l’écran, sauf le bloc **Compte** du Profil (seulement si Supabase est configuré).
- **Nouveau téléphone** : à l’accueil, *J’ai déjà un compte ou une sauvegarde*, puis le code reçu par e-mail.
- **Synchronisation** : automatique (après chaque modification, au retour dans l’app, au retour du réseau).
  Sans réseau, les changements attendent. Si la même donnée a été modifiée sur deux appareils, les deux
  versions sont fusionnées (repas, mesures, coches… rien n’est écrasé) ; pour une valeur simple, la
  modification la plus récente l’emporte. Une copie de sécurité locale est faite avant la première
  synchronisation d’un téléphone qui avait déjà ses propres données.
- **Photos** : restent sur le téléphone tant que tu n’actives pas *Photos → Compte* dans le Profil.
- **Analyse IA** : avec un compte, plus besoin de clé (3 analyses par jour en gratuit). Avec une clé
  personnelle enregistrée, c’est elle qui est utilisée, sans quota.
- **Photo du plat** (*Nutrition → Repas → Photo*, ou *Décrire → Prendre le plat en photo*) : la photo,
  réduite à 1024 px en JPEG, part avec la demande ; l’IA liste les aliments qu’elle voit (ceux qu’elle
  devine, comme l’huile de cuisson, décochés d’office) et pose une question de quantité par aliment
  (petite, moyenne, grande, curseur précis ou produit scanné). On décoche ce qui n’est pas dans
  l’assiette ; le total se met à jour, puis le repas s’ajoute à la journée. Une photo compte pour une
  analyse. Elle n’est gardée nulle part (ni dans l’app, ni sur le serveur, ni dans les journaux).
- **Jamais envoyé** au serveur ni mis dans les sauvegardes : la clé IA personnelle.
- **Programme** : *Training → Programme* (ou *Profil → Programme → Modifier*). Séances, jours (un jour =
  une activité), exercices de la bibliothèque (recherche, y compris par portion : « longue portion » ;
  filtres par muscle et matériel, un muscle choisi étant rangé par portion ; exercice créé soi-même),
  réglages au curseur. *Remplacer* propose d’abord les exercices de la même portion. Tout s’enregistre tout de suite. Les semaines passées gardent le
  programme avec lequel elles ont été faites : l’XP, les scores et la série ne bougent pas quand on change
  de programme. Sans modification, c’est le programme d’origine, à l’identique.
- **Construire avec Ren** : en haut de *Mon programme*, et à la fin du premier lancement. Ren pose ses
  questions une par une : nombre de séances, type de programme, jours (les sports gardent les leurs),
  durée, lieu (salle, maison avec haltères, sans matériel), niveau, façon de travailler (lourd, équilibré,
  léger), zone prioritaire. Pour le type, il conseille selon le nombre de séances : full body jusqu’à 3,
  haut / bas à 4, push / pull / legs à 5 ou 6 (à 5, complété d’un haut / bas). Il dit combien de fois
  chaque muscle travaille dans la semaine, réagit si l’on choisit autre chose et grise ce qui ne tient pas.
  Ses séances sont faites de portions : le jour du tirage, longue portion du biceps, brachial, et la courte
  portion si les bras sont prioritaires ; le jour de la poussée, longue et latérale du triceps, etc.
  Puis deux chemins :
  *Ren propose les séances* (un onglet par séance ; chaque exercice indique sa portion ; touché, il montre
  ceux qui travaillent pareil, avec le matériel disponible et une phrase de Ren sur ce qui les rassemble ;
  on choisit le sien, ou dans toute la bibliothèque ; retirer, ajouter, puis valider) ou *Je choisis mes
  exercices* (séances vides, la bibliothèque s’ouvre sur la première).
  Rien n’est remplacé sans confirmation, et ses réponses sont reprises la fois suivante.
- **Accueil : le personnage, et sa roue** : l’accueil, c’est Ren en grand (sa pose suit la semaine :
  au repos, prêt, concentré, en forme, dans la zone ; ou ton avatar si tu l’as choisi dans *Profil →
  Accueil*), avec le rang et sa marche suivante (« Rang A dans … XP »), le niveau, la barre d’XP en
  segments, sa phrase du jour dans une bulle, et deux infos du jour : la séance (ou le sport, ou le
  repos) et les calories qui restent avec les protéines. Le toucher ouvre une roue de six parts autour
  de lui : *Progression* en haut, *Training* et *Sports* à droite, *Corps* en bas, *Profil* et
  *Nutrition* à gauche. On peut aussi appuyer sur lui, glisser jusqu’à une part et lâcher ; au clavier,
  Entrée l’ouvre, les flèches passent d’une part à l’autre, Échap la referme. Chaque partie a une
  maison, en bas, qui ramène à l’accueil (roue fermée) ; il n’y a plus de barre d’onglets.
- **Training, au jour le jour** : l’entrée de *Training*, c’est aujourd’hui. La date, les séances
  faites cette semaine, puis Ren et sa proposition : la séance prévue aujourd’hui ; si elle est déjà
  faite, la suivante ; un jour sans muscu, le sport prévu (il mène à *Sports*) ou le repos, avec
  « Je m’entraîne quand même » ; une séance faite aujourd’hui, la suivante annoncée ; la semaine
  bouclée, la séance en bonus. Dessous, une carte par séance du programme (où elle en est : faite
  lundi, prévue jeudi, à rattraper, en bonus ; exercices, durée, la dernière fois) : on les fait
  glisser pour en choisir une autre, la carte du centre se lance d’un toucher, et un bouton ramène à
  la proposition. « C’est parti » (ou « Reprendre », « Voir la séance ») ouvre la séance seule : ses
  exercices, leurs séries, l’écran de repos, avec un retour vers l’entrée. Rien de nouveau n’est
  enregistré : une séance est faite quand elle est validée, et son jour vient de la date de ses séries
  notées (cochée sans séries : « faite cette semaine »). Une séance déjà faite dans la semaine se
  rouvre telle quelle ; la semaine entière se lit dans *Progression → Semaines*. Couvertures
  provisoires : l’illustration d’un exercice de la séance, sinon un motif et un mot.
- **Interface « Dark Manga Premium »** : noir profond, cartes graphite sans contour, violet réservé à
  l’action, à la progression et à la sélection. *Nutrition* : une carte pour le jour (calories restantes, protéines, activité),
  puis les repas ; « Ajouter un aliment » en action principale. *Profil* : une carte d’identité (avatar ou
  initiale, rang en médaillon, niveau). Un nouveau rang s’affiche dans le moment « Séance validée ».
- **Glucides et lipides** : chaque aliment a ses protéines, glucides (hors fibres, comme sur les
  étiquettes) et lipides par portion. Les aliments de base les ont d'office (ceux déjà enregistrés
  les reçoivent à l'ouverture, s'ils n'ont pas été modifiés) ; un aliment créé à la main les a en
  option, le scanner les lit dans Open Food Facts, l'analyse IA les estime. Dans *Nutrition → Repas*,
  la carte du jour montre les trois avec un repère : protéines du profil, lipides à 30 % de l'objectif
  calorique, glucides pour le reste (expliqué dans *Objectif*). Un aliment sans ces valeurs est
  signalé, à compléter dans *Ajouter un aliment → Gérer mes aliments* ; rien n'est inventé.
- **Sports** : en plus des séances, 165 sports rangés en 16 catégories (aquatiques, course et marche,
  vélo, cardio en salle, fitness, corps et esprit, combat, collectifs, raquette, glisse, montagne et
  escalade, danse, gym, force, précision, autres), avec recherche (« foot », « muay », « zumba »…) et
  sport créé soi-même. Ils ont leur partie, *Sports* : une ligne par sport avec ses jours et une coche
  par séance prévue (+30 XP comme la natation) ; le toucher ouvre ses réglages (jours — un jour = une
  activité —, durée d’une séance, intensité), *Ajouter* ouvre le catalogue (aussi dans *Mon programme →
  Sports*). Chaque sport a aussi son jour dans la semaine de la Progression et une phrase de Ren. La dépense
  vient du Compendium des activités physiques : (MET × intensité − 1) × poids × durée, arrondie à
  50 kcal ; elle s'ajoute à l'objectif du jour en cochant le sport dans *Nutrition → Activité du jour*,
  où *Autre sport* ajoute un sport fait hors programme, avec sa durée. La natation reste enregistrée
  comme avant (champ `swim` des semaines), les autres sports dans `sport`.
- **Illustrations des exercices** : Ren fait le mouvement, le muscle travaillé brille en violet.
  En séance, l'image est à côté du rappel de la dernière fois (un toucher l'ouvre en grand) ; dans la
  bibliothèque, en vignette ; dans les réglages d'un exercice, au-dessus des curseurs. Un exercice pas
  encore illustré garde un pictogramme. Les images ne sont pas téléchargées à l'installation : elles
  sont gardées au premier affichage, puis disponibles hors ligne.
- **Parties en rubriques** : la Nutrition s’ouvre sur son entrée — Ren, sa phrase du moment (« Il te
  reste … kcal, dont … g de protéines à trouver »), le jour en une ligne et cinq tuiles : *Photo du plat*
  (l’action principale), *Ajouter un aliment*, *Mes repas*, *Protéines et habitudes*, *Objectif* (avec un
  point quand une nouvelle base est proposée). Une rubrique s’ouvre seule, avec un retour vers l’entrée
  en haut et la maison en bas ; le choix du jour vaut pour les repas et les protéines. La tuile des
  calories de l’accueil mène directement à *Mes repas*. La Progression se lit en *Rang* et *Semaines* ; le Corps en
  *Mesures* (poids, tour de taille) et *Photos*. Une catégorie à la fois, au toucher ou aux flèches du
  clavier ; les raccourcis de l’accueil (rang, séance du jour, calories) ouvrent directement la bonne.
  Un aliment s’ajoute depuis une fenêtre du bas (recherche, création, gestion de la liste).
- **Livre de recettes** (Nutrition, les ustensiles de la cuisine, ou la balance) : on écrit une recette une
  fois — ses ingrédients pris dans *Mes aliments*, scannés ou créés, en grammes, millilitres ou portions,
  le nombre de parts, la préparation si on veut — et l’app calcule une part. Quand on la refait, *+* dans
  le livre (ou la puce de la recette sous la balance) note une part dans la journée ; la page de la
  recette permet d’en noter une demie, une et demie… Chaque recette a son aliment « 1 part » dans
  *Mes aliments* (recherche, aliments fréquents) ; la modifier ou la supprimer ne change pas les jours
  déjà notés (l’ancienne version reste pour l’historique). Clé `recettes`, synchronisée ; calculs dans
  `src/nutrition/recettes.js`, écrans dans `src/legacy/20-recettes.js`.
- **Poids** (Corps → Mesures) : la courbe suit la tendance lissée (les pesées sont des points) ;
  au-dessus, la tendance du jour et la vitesse sur 3 semaines. Plus on se pèse (3 à 4 fois par semaine),
  plus elle est fiable.
- **Calories adaptatives** : une fois par semaine, Nutrition → Objectif propose une nouvelle base au
  repos (un point sur « Objectif » et une ligne dans Repas le signalent).
  Avec au moins 14 jours de repas notés sur 3 semaines, l’app mesure ta dépense réelle (ce que tu manges,
  corrigé de l’évolution du poids) ; sinon, elle corrige la moitié de l’écart entre ta vitesse et celle
  visée par ton objectif. Jamais plus de 200 kcal d’un coup ; tu appliques ou tu gardes.
- **Séance** : toucher un exercice ouvre ses séries, pré-remplies avec la dernière fois (et +1 cran de
  charge quand toutes les séries ont atteint le haut de la fourchette). ✓ valide une série et lance le
  minuteur de repos ; la dernière série prévue coche l’exercice, avec la même XP qu’avant. La coche
  directe, sans rien noter, marche toujours.
- **Écran de repos** : à chaque série validée, Ren tend son poignet. Sa montre donne l’heure du
  téléphone et le décompte du repos, avec un anneau violet qui suit le temps qui reste ; dessous :
  recommencer, pause ou reprise (aussi sur la montre), passer. En haut, l’avancée de la séance ; en bas,
  la suite (série suivante, exercice suivant ou fin de séance), qui mène à ses séries. La flèche de
  retour laisse le repos dans la barre de la séance, et un toucher sur la barre rouvre l’écran. Le
  minuteur garde une heure de fin, pas un décompte : rien ne dérive si l’app ralentit, passe en
  arrière-plan ou si l’écran se met en veille.
- **Se déconnecter** garde les données sur le téléphone. **Supprimer le compte** efface tout ce qui est
  en ligne (données, photos, compte) ; le téléphone garde les siennes.

## 4. Développer

```sh
npm ci
npm run dev        # http://127.0.0.1:5173 (sans .env : mode local)
npm run build      # dist/
npm run preview    # sert dist/ sur http://127.0.0.1:4173
```

Structure :

| Dossier | Contenu |
|---|---|
| `index.html` | balisage de l’app (l’accueil du personnage, les parties et leurs catégories, la maison) |
| `src/main.js` | démarrage : stockage, reprise, compte, puis l’app |
| `src/legacy/NN-*.js` | code d’origine découpé par domaine (programme, séance et séries, semaine, mesures, aliments, calories, photos, scanner, historique, IA, habitudes, accueil, Training du jour, sauvegarde, avatar, profil, onboarding, master avatar, compte). Les fichiers partagent une seule portée et sont mis bout à bout dans l’ordre des noms (greffon dans `vite.config.js`), précédés des imports `TR` (entraînement), `TRUI` (son interface), `TB` (tendance du poids) et `HOME` (roue de l’accueil). |
| `src/training/` | bibliothèque d’exercices et leurs cibles (portion, fonction : `exercises.js`), programme (`program.js`), programme du coach : types, séances par cible, dosage, remplaçants de la même cible (`coach.js`), semaine enregistrée avec l’instantané de son programme (`week.js`), séries, conseil de charge et records (`log.js`), catalogue des sports et leur dépense (`sports.js`), minuteur de repos (`rest.js`) ; `ui/` : constructeur, catalogue et réglages des sports, questions du coach, curseurs, fenêtres, écran de repos (`rest.js` ; ses huit éléments — salle, Ren, boîtier, écran de la montre, décompte, commandes, avancée, carte de la suite — se règlent chacun dans `training.css`, « Écran de repos ») |
| `src/core/` | stockage (`storage.js`), fusion (`merge.js`), photos, sauvegarde, compte (`auth.js`), synchronisation (`sync.js`, `remote.js`, `cloud.js`), IA (`ai.js`), service worker (`pwa.js`), scanner (`quagga.js`) |
| `src/home/` | roue de l’accueil : les six parts, la part sous le doigt, la taille selon l’écran, les gestes (toucher, glisser, clavier) (`wheel.js`) |
| `src/styles/` | `app.css` (système visuel : jetons de couleur, typographie, composants partagés — surtitre, en-tête de section, statut, barre, tuiles —, pages), `training.css` (séance, constructeur, curseurs), `cloud.css` (compte) |
| `src/ui/account.js` | bloc Compte, fenêtre de connexion, bandeaux |
| `src/assets/` | images extraites de l’ancien fichier (poses de Ren, calques du master avatar), portrait recadré de Ren pour les pastilles du coach, Ren qui montre sa montre (`img/ren-montre.webp`, provisoire : découpé dans la maquette, écran vidé ; la place du cadran sur le poignet tient dans les variables `--rw-*` de `.rr-ren`) |
| `public/` | icônes, manifeste, QuaggaJS, notice de confidentialité ; `exos/` : une illustration par exercice (480 × 480, nom avec empreinte) |
| `illustrations/` | demandes envoyées à ChatGPT (`lots.json`, `descriptions.js` ; couvertures de séance, emblèmes de rang, expressions de Ren et écran de repos dans `direction-artistique.js`), planches reçues (`recues/`), cases refaites (`retouches.json`) ; `python3 scripts/illustrations.py` découpe les planches en images d'exercices et écrit `src/training/illus-index.json` |
| `supabase/` | migration SQL, fonctions `ai` et `account` |
| `tests/` | tests unitaires, de bout en bout, et serveur local de test |

Pour faire évoluer le code d’origine, on peut sortir peu à peu un domaine de `src/legacy/` en vrai module
dans `src/` : `npm run check` signale tout nom resté non déclaré.

## 5. Aperçu de test

```sh
npm run apercu        # .tmp/apercu/page.html + files.json : l'app en mode local, avec un exemple
```

C’est la page publiée dans Claude pour essayer l’app sans l’installer : pas de service worker,
données d’exemple (« Alex ») au premier lancement, et en bas du Profil un bloc pour recharger
l’exemple ou repartir de zéro (absent de l’app installée). Le scanner, l’IA, l’export et le compte n’y fonctionnent pas.

## 6. Tests

```sh
npm test               # unitaires : fusion, stockage, synchro entre appareils, fonctions serveur
npm run check          # code d'origine : aucun nom non déclaré (mode strict)
npx playwright install chromium   # une fois, pour les tests dans le navigateur
npm run build && npm run test:e2e
                       # navigateur : mêmes données que l'ancienne app (valeur par valeur),
                       # reprise des données, sauvegardes dans les deux sens, hors ligne, mise à jour,
                       # catégories et raccourcis, constructeur de programme, programme construit
                       # avec Ren (séances proposées ou vides), séries et minuteur, écran de repos
                       # (horloge simulée), Training au jour le jour (proposition de Ren selon le
                       # jour, cartes, séance ouverte), glucides et lipides, scanner (caméra
                       # simulée qui montre un code-barres), illustrations
```

Avec PostgreSQL 15+ et le binaire PostgREST 12 installés en local :

```sh
export MS_PG=postgres://postgres@127.0.0.1:5432/postgres MS_POSTGREST=/chemin/vers/postgrest
npm test               # + migration sur un vrai PostgreSQL et serveur complet sans navigateur
npm run test:e2e:cloud # deux navigateurs, un compte : connexion, reprise, synchro, IA, photos, suppression
```
