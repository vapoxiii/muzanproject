// Bibliothèque des exercices de musculation.
//
// Une ligne par exercice : [id, nom, muscle principal, matériel, type, options, muscles secondaires, mots-clés]
//  - id : stable (enregistré dans les programmes et l'historique) — ne jamais le changer ;
//  - type : 'c' polyarticulaire, 'i' isolation ;
//  - options : p = courant (affiché en premier), h = mouvement de base lourd,
//              t = se mesure en temps, d = en distance, x = jusqu'à l'échec par défaut ;
//  - mots-clés : autres noms (souvent anglais) pour la recherche.

export const MUSCLES = {
  pecs: 'Pectoraux', dos: 'Dos', epaules: 'Épaules', biceps: 'Biceps', triceps: 'Triceps',
  avbras: 'Avant-bras', abdos: 'Abdos', quadris: 'Quadriceps', ischios: 'Ischios', fessiers: 'Fessiers',
  mollets: 'Mollets', adducteurs: 'Adducteurs', lombaires: 'Lombaires', trapezes: 'Trapèzes', cou: 'Cou',
  complet: 'Corps entier', cardio: 'Cardio',
};

export const EQUIP = {
  halteres: 'Haltères', barre: 'Barre', machine: 'Machine', poulie: 'Poulie', pdc: 'Poids du corps',
  ez: 'Barre EZ', smith: 'Smith', kb: 'Kettlebell', elastique: 'Élastique', trapbar: 'Trap bar',
  landmine: 'Landmine', disque: 'Disque', ballon: 'Ballon', anneaux: 'Anneaux / TRX', autre: 'Autre',
};

// Zones prioritaires choisies à l'onboarding → groupes musculaires
export const ZONES = {
  bras: ['biceps', 'triceps', 'avbras'], epaules: ['epaules'], dos: ['dos', 'lombaires', 'trapezes'],
  pecs: ['pecs'], jambes: ['quadris', 'ischios', 'fessiers', 'adducteurs', 'mollets'], abdos: ['abdos'],
};
export const ZONE_LABEL = { bras: 'Bras', epaules: 'Épaules', dos: 'Dos', pecs: 'Pecs', jambes: 'Jambes', abdos: 'Abdos' };

// Pas de progression de la charge (kg) selon le matériel ; 0 = on progresse en répétitions
export const LOAD_STEP = {
  barre: 2.5, ez: 2.5, smith: 2.5, trapbar: 2.5, landmine: 2.5, halteres: 2, kb: 4, machine: 2.5, poulie: 2.5,
  disque: 2.5, ballon: 1, autre: 2.5, pdc: 0, elastique: 0, anneaux: 0,
};

const ROWS = [
  // ---------- Pectoraux ----------
  ['dc-barre', 'Développé couché barre', 'pecs', 'barre', 'c', 'ph', 'triceps epaules', 'bench press dc'],
  ['dc-halteres', 'Développé couché haltères', 'pecs', 'halteres', 'c', 'p', 'triceps epaules', 'dumbbell bench press'],
  ['dc-machine', 'Développé couché machine', 'pecs', 'machine', 'c', 'p', 'triceps epaules', 'chest press presse pectoraux'],
  ['dc-smith', 'Développé couché Smith', 'pecs', 'smith', 'c', '', 'triceps epaules', 'smith bench press'],
  ['dc-convergent', 'Développé convergent', 'pecs', 'machine', 'c', '', 'triceps epaules', 'hammer strength iso lateral chest press'],
  ['dc-pause', 'Développé couché avec pause', 'pecs', 'barre', 'c', 'h', 'triceps epaules', 'paused bench press'],
  ['dc-floor-barre', 'Floor press barre', 'pecs', 'barre', 'c', '', 'triceps', 'développé au sol'],
  ['dc-floor-halteres', 'Floor press haltères', 'pecs', 'halteres', 'c', '', 'triceps', 'développé au sol'],
  ['dc-unilateral', 'Développé couché haltère un bras', 'pecs', 'halteres', 'c', '', 'triceps abdos', 'single arm unilatéral'],
  ['dc-squeeze', 'Squeeze press haltères', 'pecs', 'halteres', 'c', '', 'triceps', 'prise neutre serrée'],
  ['di-barre', 'Développé incliné barre', 'pecs', 'barre', 'c', 'ph', 'epaules triceps', 'incline bench press'],
  ['di-halteres', 'Développé incliné haltères', 'pecs', 'halteres', 'c', 'p', 'epaules triceps', 'incline dumbbell press'],
  ['di-machine', 'Développé incliné machine', 'pecs', 'machine', 'c', '', 'epaules triceps', 'incline chest press'],
  ['di-smith', 'Développé incliné Smith', 'pecs', 'smith', 'c', '', 'epaules triceps', 'incline smith press'],
  ['dd-barre', 'Développé décliné barre', 'pecs', 'barre', 'c', '', 'triceps', 'decline bench press'],
  ['dd-halteres', 'Développé décliné haltères', 'pecs', 'halteres', 'c', '', 'triceps', 'decline dumbbell press'],
  ['dd-machine', 'Développé décliné machine', 'pecs', 'machine', 'c', '', 'triceps', 'decline chest press'],
  ['ec-halteres', 'Écarté couché haltères', 'pecs', 'halteres', 'i', 'p', '', 'dumbbell fly flyes'],
  ['ei-halteres', 'Écarté incliné haltères', 'pecs', 'halteres', 'i', '', 'epaules', 'incline fly'],
  ['ed-halteres', 'Écarté décliné haltères', 'pecs', 'halteres', 'i', '', '', 'decline fly'],
  ['pec-deck', 'Pec deck (butterfly)', 'pecs', 'machine', 'i', 'p', '', 'pec fly machine écarté machine'],
  ['ec-poulie', 'Écarté poulie vis-à-vis', 'pecs', 'poulie', 'i', 'p', '', 'cable crossover cross over'],
  ['ec-poulie-haute', 'Écarté poulie haute', 'pecs', 'poulie', 'i', '', '', 'high to low cable fly'],
  ['ec-poulie-basse', 'Écarté poulie basse', 'pecs', 'poulie', 'i', '', 'epaules', 'low to high cable fly'],
  ['ec-poulie-1bras', 'Écarté poulie un bras', 'pecs', 'poulie', 'i', '', '', 'single arm cable fly'],
  ['ec-couche-poulie', 'Écarté couché à la poulie', 'pecs', 'poulie', 'i', '', '', 'lying cable fly'],
  ['dev-poulie', 'Développé debout à la poulie', 'pecs', 'poulie', 'c', '', 'triceps epaules', 'standing cable press'],
  ['pullover-halt', 'Pull-over haltère', 'pecs', 'halteres', 'i', '', 'dos triceps', 'pullover'],
  ['svend', 'Svend press', 'pecs', 'disque', 'i', '', 'epaules', 'plate press'],
  ['pompes', 'Pompes', 'pecs', 'pdc', 'c', 'p', 'triceps epaules abdos', 'push ups'],
  ['pompes-larges', 'Pompes prise large', 'pecs', 'pdc', 'c', '', 'epaules', 'wide push ups'],
  ['pompes-inclinees', 'Pompes mains surélevées', 'pecs', 'pdc', 'c', '', 'triceps', 'incline push ups'],
  ['pompes-declinees', 'Pompes pieds surélevés', 'pecs', 'pdc', 'c', '', 'epaules triceps', 'decline push ups'],
  ['pompes-archer', 'Pompes archer', 'pecs', 'pdc', 'c', '', 'triceps', 'archer push ups'],
  ['pompes-lestees', 'Pompes lestées', 'pecs', 'pdc', 'c', '', 'triceps epaules', 'weighted push ups'],
  ['pompes-anneaux', 'Pompes aux anneaux', 'pecs', 'anneaux', 'c', '', 'triceps abdos', 'ring push ups trx'],
  ['ec-anneaux', 'Écarté aux anneaux', 'pecs', 'anneaux', 'i', '', 'abdos', 'ring fly trx'],
  ['dips-pecs', 'Dips buste penché (pectoraux)', 'pecs', 'pdc', 'c', 'p', 'triceps epaules', 'chest dips'],
  ['dev-elastique', 'Développé avec élastique', 'pecs', 'elastique', 'c', '', 'triceps', 'band press'],
  ['ec-elastique', 'Écarté avec élastique', 'pecs', 'elastique', 'i', '', '', 'band fly'],
  ['dev-landmine-pecs', 'Développé landmine à deux mains', 'pecs', 'landmine', 'c', '', 'epaules triceps', 'landmine press'],

  // ---------- Dos ----------
  ['tractions', 'Tractions pronation', 'dos', 'pdc', 'c', 'p', 'biceps avbras', 'pull ups'],
  ['tractions-sup', 'Tractions supination', 'dos', 'pdc', 'c', 'p', 'biceps', 'chin ups'],
  ['tractions-neutre', 'Tractions prise neutre', 'dos', 'pdc', 'c', '', 'biceps avbras', 'neutral grip pull ups'],
  ['tractions-larges', 'Tractions prise large', 'dos', 'pdc', 'c', '', 'biceps', 'wide grip pull ups'],
  ['tractions-lestees', 'Tractions lestées', 'dos', 'pdc', 'c', 'h', 'biceps avbras', 'weighted pull ups'],
  ['tractions-neg', 'Tractions négatives', 'dos', 'pdc', 'c', 'p', 'biceps avbras', 'negative pull ups excentrique'],
  ['tractions-assist', 'Tractions assistées (élastique)', 'dos', 'elastique', 'c', '', 'biceps', 'band assisted pull ups'],
  ['tractions-machine', 'Tractions assistées à la machine', 'dos', 'machine', 'c', '', 'biceps', 'assisted pull up machine'],
  ['tractions-austr', 'Tractions australiennes', 'dos', 'pdc', 'c', '', 'biceps abdos', 'inverted row rowing inversé'],
  ['row-anneaux', 'Rowing aux anneaux / TRX', 'dos', 'anneaux', 'c', '', 'biceps', 'ring row trx row'],
  ['scap-pull', 'Tractions scapulaires', 'dos', 'pdc', 'i', '', 'trapezes', 'scapular pull ups'],
  ['tv-poulie', 'Tirage vertical poulie', 'dos', 'poulie', 'c', 'p', 'biceps', 'lat pulldown tirage poitrine'],
  ['tv-serre', 'Tirage vertical prise serrée', 'dos', 'poulie', 'c', '', 'biceps', 'close grip pulldown'],
  ['tv-neutre', 'Tirage vertical prise neutre', 'dos', 'poulie', 'c', '', 'biceps', 'neutral grip pulldown'],
  ['tv-sup', 'Tirage vertical supination', 'dos', 'poulie', 'c', '', 'biceps', 'underhand pulldown'],
  ['tv-1bras', 'Tirage vertical un bras', 'dos', 'poulie', 'c', '', 'biceps', 'single arm pulldown'],
  ['tv-machine', 'Tirage vertical machine', 'dos', 'machine', 'c', '', 'biceps', 'pulldown machine convergent'],
  ['tv-nuque', 'Tirage nuque', 'dos', 'poulie', 'c', '', 'biceps epaules', 'behind the neck pulldown'],
  ['tv-bras-tendus', 'Tirage bras tendus à la poulie', 'dos', 'poulie', 'i', 'p', 'triceps', 'straight arm pulldown pull over poulie'],
  ['pullover-corde', 'Pull-over à la corde', 'dos', 'poulie', 'i', '', '', 'rope pullover'],
  ['th-poulie', 'Rowing poulie assis', 'dos', 'poulie', 'c', 'p', 'biceps trapezes', 'seated cable row tirage horizontal'],
  ['th-large', 'Rowing poulie prise large', 'dos', 'poulie', 'c', '', 'trapezes epaules', 'wide grip cable row'],
  ['th-1bras', 'Rowing poulie un bras', 'dos', 'poulie', 'c', '', 'biceps', 'single arm cable row'],
  ['row-machine', 'Rowing machine appui poitrine', 'dos', 'machine', 'c', 'p', 'biceps trapezes', 'chest supported row machine'],
  ['row-convergent', 'Rowing machine convergente', 'dos', 'machine', 'c', '', 'biceps', 'hammer strength row iso lateral'],
  ['row-barre', 'Rowing barre buste penché', 'dos', 'barre', 'c', 'ph', 'biceps lombaires', 'bent over row barbell row'],
  ['row-yates', 'Rowing barre supination (Yates)', 'dos', 'barre', 'c', '', 'biceps', 'yates row underhand row'],
  ['row-pendlay', 'Rowing Pendlay', 'dos', 'barre', 'c', 'h', 'lombaires', 'pendlay row'],
  ['row-tbar', 'Rowing barre en T', 'dos', 'landmine', 'c', 'p', 'biceps', 't bar row'],
  ['row-tbar-machine', 'Rowing T-bar appui poitrine', 'dos', 'machine', 'c', '', 'biceps', 'chest supported t bar row'],
  ['row-meadows', 'Rowing Meadows', 'dos', 'landmine', 'c', '', 'biceps avbras', 'meadows row'],
  ['row-smith', 'Rowing Smith', 'dos', 'smith', 'c', '', 'biceps', 'smith row'],
  ['row-1bras', 'Rowing haltère un bras', 'dos', 'halteres', 'c', 'p', 'biceps', 'one arm dumbbell row rowing unilatéral'],
  ['row-halteres', 'Rowing haltères buste penché', 'dos', 'halteres', 'c', '', 'biceps lombaires', 'dumbbell bent over row'],
  ['row-incline', 'Rowing haltères sur banc incliné', 'dos', 'halteres', 'c', '', 'biceps trapezes', 'chest supported dumbbell row seal row'],
  ['row-kroc', 'Rowing Kroc', 'dos', 'halteres', 'c', '', 'biceps avbras', 'kroc row'],
  ['row-kb', 'Rowing kettlebell', 'dos', 'kb', 'c', '', 'biceps', 'kettlebell row'],
  ['row-elastique', 'Rowing avec élastique', 'dos', 'elastique', 'c', '', 'biceps', 'band row'],
  ['tv-elastique', 'Tirage vertical avec élastique', 'dos', 'elastique', 'c', '', 'biceps', 'band pulldown'],
  ['renegade', 'Renegade row', 'dos', 'halteres', 'c', '', 'abdos pecs', 'renegade row'],
  ['sdt', 'Soulevé de terre', 'dos', 'barre', 'c', 'ph', 'ischios fessiers lombaires avbras', 'deadlift sdt'],
  ['sdt-sumo', 'Soulevé de terre sumo', 'fessiers', 'barre', 'c', 'h', 'ischios adducteurs dos', 'sumo deadlift'],
  ['sdt-trapbar', 'Soulevé de terre trap bar', 'quadris', 'trapbar', 'c', 'h', 'fessiers dos ischios', 'trap bar deadlift hex bar'],
  ['rack-pull', 'Rack pull (soulevé partiel)', 'dos', 'barre', 'c', '', 'trapezes lombaires', 'rack pull block pull'],
  ['sdt-deficit', 'Soulevé de terre en déficit', 'dos', 'barre', 'c', '', 'ischios quadris', 'deficit deadlift'],
  ['sdt-halteres', 'Soulevé de terre haltères', 'dos', 'halteres', 'c', '', 'ischios fessiers', 'dumbbell deadlift'],
  ['sdt-kb', 'Soulevé de terre kettlebell', 'fessiers', 'kb', 'c', '', 'ischios', 'kettlebell deadlift'],

  // ---------- Lombaires ----------
  ['ext-lombaires', 'Extensions lombaires (banc à 45°)', 'lombaires', 'pdc', 'i', 'p', 'fessiers ischios', 'back extension 45'],
  ['hyperext', 'Hyperextensions (banc romain)', 'lombaires', 'pdc', 'i', '', 'fessiers ischios', 'hyperextension banc romain'],
  ['ext-lombaires-machine', 'Extensions lombaires à la machine', 'lombaires', 'machine', 'i', '', '', 'back extension machine'],
  ['superman', 'Superman', 'lombaires', 'pdc', 'i', '', 'fessiers', 'superman au sol'],
  ['reverse-hyper', 'Reverse hyper', 'lombaires', 'machine', 'i', '', 'fessiers ischios', 'reverse hyperextension'],
  ['bird-dog', 'Bird dog', 'lombaires', 'pdc', 'i', '', 'abdos fessiers', 'quadrupédie bras jambe'],

  // ---------- Épaules ----------
  ['dm-barre', 'Développé militaire barre', 'epaules', 'barre', 'c', 'ph', 'triceps', 'overhead press ohp military press'],
  ['dm-assis-barre', 'Développé militaire assis', 'epaules', 'barre', 'c', '', 'triceps', 'seated overhead press'],
  ['de-halteres', 'Développé épaules haltères', 'epaules', 'halteres', 'c', 'p', 'triceps', 'dumbbell shoulder press développé assis'],
  ['de-halteres-debout', 'Développé épaules haltères debout', 'epaules', 'halteres', 'c', '', 'triceps abdos', 'standing dumbbell press'],
  ['arnold', 'Développé Arnold', 'epaules', 'halteres', 'c', '', 'triceps', 'arnold press'],
  ['de-machine', 'Développé épaules machine', 'epaules', 'machine', 'c', 'p', 'triceps', 'shoulder press machine'],
  ['de-smith', 'Développé épaules Smith', 'epaules', 'smith', 'c', '', 'triceps', 'smith shoulder press'],
  ['de-nuque', 'Développé nuque', 'epaules', 'barre', 'c', '', 'triceps trapezes', 'behind the neck press'],
  ['push-press', 'Push press', 'epaules', 'barre', 'c', 'h', 'triceps quadris', 'push press'],
  ['de-landmine', 'Développé landmine un bras', 'epaules', 'landmine', 'c', '', 'pecs triceps', 'landmine press'],
  ['de-z', 'Développé Z (assis au sol)', 'epaules', 'barre', 'c', '', 'abdos triceps', 'z press'],
  ['de-kb', 'Développé kettlebell', 'epaules', 'kb', 'c', '', 'triceps', 'kettlebell press'],
  ['de-elastique', 'Développé épaules avec élastique', 'epaules', 'elastique', 'c', '', 'triceps', 'band shoulder press'],
  ['pompes-piquees', 'Pompes piquées', 'epaules', 'pdc', 'c', '', 'triceps', 'pike push ups'],
  ['hspu', 'Pompes en équilibre', 'epaules', 'pdc', 'c', '', 'triceps trapezes', 'handstand push ups hspu'],
  ['el-halteres', 'Élévations latérales haltères', 'epaules', 'halteres', 'i', 'p', '', 'lateral raise'],
  ['el-poulie', 'Élévations latérales poulie', 'epaules', 'poulie', 'i', 'p', '', 'cable lateral raise'],
  ['el-machine', 'Élévations latérales machine', 'epaules', 'machine', 'i', '', '', 'lateral raise machine'],
  ['el-allonge', 'Élévations latérales allongé sur le côté', 'epaules', 'halteres', 'i', '', '', 'lying lateral raise'],
  ['el-penche', 'Élévations latérales sur banc incliné', 'epaules', 'halteres', 'i', '', '', 'incline lateral raise'],
  ['el-elastique', 'Élévations latérales avec élastique', 'epaules', 'elastique', 'i', '', '', 'band lateral raise'],
  ['ef-halteres', 'Élévations frontales haltères', 'epaules', 'halteres', 'i', '', 'pecs', 'front raise'],
  ['ef-poulie', 'Élévations frontales poulie', 'epaules', 'poulie', 'i', '', 'pecs', 'cable front raise'],
  ['ef-disque', 'Élévations frontales disque', 'epaules', 'disque', 'i', '', '', 'plate front raise'],
  ['ef-barre', 'Élévations frontales barre', 'epaules', 'barre', 'i', '', '', 'barbell front raise'],
  ['oiseau', 'Oiseau haltères', 'epaules', 'halteres', 'i', 'p', 'trapezes dos', 'rear delt fly reverse fly arrière d épaule'],
  ['oiseau-poulie', 'Oiseau à la poulie', 'epaules', 'poulie', 'i', '', 'trapezes', 'cable rear delt fly'],
  ['reverse-pec', 'Reverse pec deck', 'epaules', 'machine', 'i', 'p', 'trapezes', 'oiseau machine rear delt machine'],
  ['face-pull', 'Face pull', 'epaules', 'poulie', 'i', 'p', 'trapezes', 'face pull corde'],
  ['face-pull-el', 'Face pull avec élastique', 'epaules', 'elastique', 'i', '', 'trapezes', 'band face pull'],
  ['pull-apart', 'Écartés avec élastique (pull-apart)', 'epaules', 'elastique', 'i', '', 'trapezes dos', 'band pull apart'],
  ['tm-barre', 'Tirage menton barre', 'epaules', 'barre', 'c', '', 'trapezes biceps', 'upright row'],
  ['tm-poulie', 'Tirage menton poulie', 'epaules', 'poulie', 'c', '', 'trapezes', 'cable upright row'],
  ['tm-halteres', 'Tirage menton haltères', 'epaules', 'halteres', 'c', '', 'trapezes', 'dumbbell upright row'],
  ['y-raise', 'Élévations en Y', 'epaules', 'halteres', 'i', '', 'trapezes', 'y raise'],
  ['ytw-sol', 'Y-T-W allongé au sol', 'epaules', 'pdc', 'i', '', 'trapezes dos', 'prone ytw raises'],
  ['rot-ext-poulie', 'Rotations externes à la poulie', 'epaules', 'poulie', 'i', '', '', 'external rotation coiffe des rotateurs'],
  ['rot-ext-halt', 'Rotations externes haltère', 'epaules', 'halteres', 'i', '', '', 'external rotation coiffe des rotateurs'],
  ['rot-int-poulie', 'Rotations internes à la poulie', 'epaules', 'poulie', 'i', '', '', 'internal rotation coiffe des rotateurs'],

  // ---------- Trapèzes ----------
  ['shrug-barre', 'Shrugs barre', 'trapezes', 'barre', 'i', 'p', 'avbras', 'shrug haussements d épaules'],
  ['shrug-halteres', 'Shrugs haltères', 'trapezes', 'halteres', 'i', 'p', 'avbras', 'dumbbell shrug haussements d épaules'],
  ['shrug-machine', 'Shrugs machine', 'trapezes', 'machine', 'i', '', '', 'shrug machine'],
  ['shrug-smith', 'Shrugs Smith', 'trapezes', 'smith', 'i', '', '', 'smith shrug'],
  ['shrug-trapbar', 'Shrugs trap bar', 'trapezes', 'trapbar', 'i', '', 'avbras', 'trap bar shrug'],
  ['shrug-poulie', 'Shrugs poulie', 'trapezes', 'poulie', 'i', '', '', 'cable shrug'],
  ['shrug-incline', 'Shrugs sur banc incliné', 'trapezes', 'halteres', 'i', '', '', 'incline shrug kelso'],

  // ---------- Biceps ----------
  ['curl-barre', 'Curl barre', 'biceps', 'barre', 'i', 'p', 'avbras', 'barbell curl'],
  ['curl-serre', 'Curl barre prise serrée', 'biceps', 'barre', 'i', '', 'avbras', 'close grip curl'],
  ['curl-large', 'Curl barre prise large', 'biceps', 'barre', 'i', '', '', 'wide grip curl'],
  ['curl-ez', 'Curl barre EZ', 'biceps', 'ez', 'i', 'p', 'avbras', 'ez curl'],
  ['curl-halteres', 'Curl haltères', 'biceps', 'halteres', 'i', 'p', 'avbras', 'dumbbell curl alterné'],
  ['curl-simultane', 'Curl haltères simultané', 'biceps', 'halteres', 'i', '', 'avbras', 'dumbbell curl'],
  ['curl-incline', 'Curl incliné haltères', 'biceps', 'halteres', 'i', 'p', '', 'incline curl'],
  ['curl-incline-poulie', 'Curl incliné à la poulie', 'biceps', 'poulie', 'i', '', '', 'incline cable curl'],
  ['curl-marteau', 'Curl marteau', 'biceps', 'halteres', 'i', 'p', 'avbras', 'hammer curl'],
  ['curl-marteau-corde', 'Curl marteau à la corde', 'biceps', 'poulie', 'i', '', 'avbras', 'rope hammer curl'],
  ['curl-marteau-croise', 'Curl marteau croisé', 'biceps', 'halteres', 'i', '', 'avbras', 'cross body hammer curl'],
  ['curl-pupitre', 'Curl pupitre barre EZ', 'biceps', 'ez', 'i', 'p', '', 'preacher curl larry scott'],
  ['curl-pupitre-halt', 'Curl pupitre haltère', 'biceps', 'halteres', 'i', '', '', 'dumbbell preacher curl'],
  ['curl-pupitre-machine', 'Curl pupitre machine', 'biceps', 'machine', 'i', '', '', 'preacher curl machine'],
  ['curl-concentre', 'Curl concentré', 'biceps', 'halteres', 'i', 'p', '', 'concentration curl'],
  ['curl-poulie', 'Curl poulie basse', 'biceps', 'poulie', 'i', '', 'avbras', 'cable curl'],
  ['curl-poulie-1bras', 'Curl poulie un bras', 'biceps', 'poulie', 'i', '', '', 'single arm cable curl'],
  ['curl-poulie-haute', 'Curl poulie haute (bras écartés)', 'biceps', 'poulie', 'i', '', '', 'high cable curl'],
  ['curl-bayesian', 'Curl Bayesian (poulie derrière soi)', 'biceps', 'poulie', 'i', '', '', 'bayesian curl'],
  ['curl-araignee', 'Curl araignée', 'biceps', 'halteres', 'i', '', '', 'spider curl'],
  ['curl-zottman', 'Curl Zottman', 'biceps', 'halteres', 'i', '', 'avbras', 'zottman curl'],
  ['curl-drag', 'Drag curl', 'biceps', 'barre', 'i', '', '', 'drag curl'],
  ['curl-drag-halt', 'Drag curl haltères', 'biceps', 'halteres', 'i', '', '', 'dumbbell drag curl'],
  ['curl-21', 'Curl 21', 'biceps', 'ez', 'i', '', '', '21s'],
  ['curl-machine', 'Curl machine', 'biceps', 'machine', 'i', '', '', 'biceps machine'],
  ['curl-elastique', 'Curl avec élastique', 'biceps', 'elastique', 'i', '', '', 'band curl'],
  ['curl-kb', 'Curl kettlebell', 'biceps', 'kb', 'i', '', 'avbras', 'kettlebell curl'],
  ['curl-sac', 'Curl sac lesté', 'biceps', 'autre', 'i', '', 'avbras', 'sandbag curl maison'],

  // ---------- Triceps ----------
  ['barre-front', 'Barre au front (barre EZ)', 'triceps', 'ez', 'i', 'p', '', 'skull crusher french press extension couché'],
  ['barre-front-halt', 'Barre au front haltères', 'triceps', 'halteres', 'i', '', '', 'dumbbell skull crusher'],
  ['pushdown-barre', 'Extension triceps poulie haute (barre)', 'triceps', 'poulie', 'i', 'p', '', 'pushdown triceps'],
  ['pushdown-corde', 'Extension triceps à la corde (pushdown)', 'triceps', 'poulie', 'i', 'p', '', 'rope pushdown'],
  ['pushdown-1bras', 'Extension triceps poulie un bras', 'triceps', 'poulie', 'i', '', '', 'single arm pushdown'],
  ['pushdown-inv', 'Extension triceps prise inversée', 'triceps', 'poulie', 'i', '', '', 'reverse grip pushdown'],
  ['ext-poulie-tete', 'Extension triceps poulie au-dessus de la tête', 'triceps', 'poulie', 'i', 'p', '', 'overhead cable extension'],
  ['ext-halt-tete', 'Extension triceps haltère au-dessus de la tête', 'triceps', 'halteres', 'i', '', '', 'overhead dumbbell extension'],
  ['ext-halt-2mains', 'Extension triceps haltère à deux mains', 'triceps', 'halteres', 'i', '', '', 'seated overhead extension'],
  ['ext-ez-tete', 'Extension triceps barre EZ au-dessus de la tête', 'triceps', 'ez', 'i', '', '', 'overhead ez extension'],
  ['ext-elastique-tete', 'Extension triceps élastique au-dessus de la tête', 'triceps', 'elastique', 'i', '', '', 'band overhead extension'],
  ['kickback', 'Kickback haltère', 'triceps', 'halteres', 'i', '', '', 'triceps kickback'],
  ['kickback-poulie', 'Kickback poulie', 'triceps', 'poulie', 'i', '', '', 'cable kickback'],
  ['dips-triceps', 'Dips', 'triceps', 'pdc', 'c', 'p', 'pecs epaules', 'dips barres parallèles'],
  ['dips-banc', 'Dips entre deux bancs', 'triceps', 'pdc', 'c', '', 'pecs', 'bench dips'],
  ['dips-machine', 'Dips à la machine', 'triceps', 'machine', 'c', '', 'pecs', 'dip machine'],
  ['dc-serre', 'Développé couché prise serrée', 'triceps', 'barre', 'c', 'p', 'pecs epaules', 'close grip bench press'],
  ['pompes-diamant', 'Pompes prise serrée (diamant)', 'triceps', 'pdc', 'c', '', 'pecs', 'diamond push ups close grip push ups'],
  ['jm-press', 'JM press', 'triceps', 'barre', 'c', '', '', 'jm press'],
  ['tate-press', 'Tate press', 'triceps', 'halteres', 'i', '', '', 'tate press'],
  ['ext-triceps-machine', 'Extension triceps machine', 'triceps', 'machine', 'i', '', '', 'triceps machine'],
  ['ext-triceps-el', 'Extension triceps avec élastique', 'triceps', 'elastique', 'i', '', '', 'band pushdown'],

  // ---------- Avant-bras ----------
  ['wrist-curl', 'Wrist curl (flexion des poignets)', 'avbras', 'barre', 'i', 'p', '', 'flexion poignets'],
  ['wrist-curl-halt', 'Wrist curl haltères', 'avbras', 'halteres', 'i', '', '', 'flexion poignets dumbbell wrist curl'],
  ['reverse-wrist', 'Reverse wrist curl (extension des poignets)', 'avbras', 'barre', 'i', 'p', '', 'extension poignets'],
  ['reverse-wrist-halt', 'Reverse wrist curl haltères', 'avbras', 'halteres', 'i', '', '', 'extension poignets dumbbell reverse wrist curl'],
  ['wrist-dos', 'Wrist curl derrière le dos', 'avbras', 'barre', 'i', '', '', 'behind the back wrist curl'],
  ['curl-inverse', 'Curl inversé', 'avbras', 'ez', 'i', 'p', 'biceps', 'reverse curl pronation'],
  ['wrist-roller', 'Rouleau à poignets', 'avbras', 'autre', 'i', '', '', 'wrist roller'],
  ['dead-hang', 'Dead hang (suspension à la barre)', 'avbras', 'pdc', 'i', 'ptx', 'dos', 'suspension barre grip'],
  ['gripper', 'Pince de préhension', 'avbras', 'autre', 'i', '', '', 'hand gripper grip'],
  ['pinch', 'Pinch grip (disques)', 'avbras', 'disque', 'i', 't', '', 'plate pinch'],
  ['pron-sup', 'Pronation-supination haltère', 'avbras', 'halteres', 'i', '', '', 'rotation poignet'],

  // ---------- Abdos ----------
  ['crunch', 'Crunch', 'abdos', 'pdc', 'i', 'p', '', 'crunch'],
  ['crunch-poulie', 'Crunch à la poulie', 'abdos', 'poulie', 'i', 'p', '', 'cable crunch kneeling'],
  ['crunch-machine', 'Crunch machine', 'abdos', 'machine', 'i', '', '', 'ab machine'],
  ['crunch-inverse', 'Crunch inversé', 'abdos', 'pdc', 'i', '', '', 'reverse crunch'],
  ['crunch-bicyclette', 'Crunch bicyclette', 'abdos', 'pdc', 'i', '', '', 'bicycle crunch'],
  ['crunch-obliques', 'Crunch obliques', 'abdos', 'pdc', 'i', '', '', 'oblique crunch'],
  ['crunch-decline', 'Crunch sur banc décliné', 'abdos', 'pdc', 'i', '', '', 'decline crunch'],
  ['situp', 'Sit-up', 'abdos', 'pdc', 'i', '', '', 'sit up redressement assis'],
  ['rjs', 'Relevés de jambes suspendu', 'abdos', 'pdc', 'i', 'p', 'avbras', 'hanging leg raise'],
  ['rgs', 'Relevés de genoux suspendu', 'abdos', 'pdc', 'i', '', 'avbras', 'hanging knee raise'],
  ['rj-chaise', 'Relevés de jambes à la chaise romaine', 'abdos', 'pdc', 'i', '', '', 'captain chair leg raise'],
  ['rj-sol', 'Relevés de jambes au sol', 'abdos', 'pdc', 'i', '', '', 'lying leg raise'],
  ['toes-bar', 'Toes to bar', 'abdos', 'pdc', 'i', '', 'avbras dos', 'toes to bar t2b'],
  ['planche', 'Gainage (planche)', 'abdos', 'pdc', 'i', 'pt', 'epaules', 'plank gainage ventral'],
  ['planche-laterale', 'Gainage latéral', 'abdos', 'pdc', 'i', 't', '', 'side plank'],
  ['planche-lestee', 'Gainage lesté', 'abdos', 'disque', 'i', 't', '', 'weighted plank'],
  ['gainage-dyn', 'Gainage dynamique (planche commando)', 'abdos', 'pdc', 'i', '', 'epaules triceps', 'commando plank'],
  ['hollow', 'Hollow hold', 'abdos', 'pdc', 'i', 't', '', 'hollow body'],
  ['l-sit', 'L-sit', 'abdos', 'pdc', 'i', 't', 'triceps', 'l sit'],
  ['ab-wheel', 'Roue abdominale', 'abdos', 'autre', 'i', 'p', 'dos', 'ab wheel rollout'],
  ['rotations-russes', 'Rotations russes', 'abdos', 'ballon', 'i', '', '', 'russian twist'],
  ['pallof', 'Pallof press', 'abdos', 'poulie', 'i', '', '', 'pallof press anti rotation'],
  ['woodchop', 'Bûcheron à la poulie', 'abdos', 'poulie', 'i', '', 'epaules', 'woodchopper cable woodchop'],
  ['dead-bug', 'Dead bug', 'abdos', 'pdc', 'i', '', '', 'dead bug'],
  ['mountain', 'Mountain climbers', 'abdos', 'pdc', 'i', 't', 'cardio', 'mountain climber'],
  ['dragon-flag', 'Dragon flag', 'abdos', 'pdc', 'i', '', '', 'dragon flag'],
  ['v-ups', 'V-ups', 'abdos', 'pdc', 'i', '', '', 'v up jackknife'],
  ['ciseaux', 'Ciseaux', 'abdos', 'pdc', 'i', '', '', 'flutter kicks'],
  ['flexion-laterale', 'Flexions latérales haltère', 'abdos', 'halteres', 'i', '', '', 'side bend obliques'],

  // ---------- Quadriceps ----------
  ['squat', 'Squat barre', 'quadris', 'barre', 'c', 'ph', 'fessiers ischios lombaires', 'back squat squat arrière'],
  ['squat-avant', 'Squat avant (front squat)', 'quadris', 'barre', 'c', 'h', 'fessiers abdos', 'front squat'],
  ['squat-pause', 'Squat avec pause', 'quadris', 'barre', 'c', '', 'fessiers', 'pause squat'],
  ['box-squat', 'Box squat', 'quadris', 'barre', 'c', '', 'fessiers ischios', 'box squat'],
  ['squat-smith', 'Squat Smith', 'quadris', 'smith', 'c', '', 'fessiers', 'smith squat'],
  ['hack-squat', 'Hack squat', 'quadris', 'machine', 'c', 'p', 'fessiers', 'hack squat machine'],
  ['hack-barre', 'Hack squat barre', 'quadris', 'barre', 'c', '', 'fessiers', 'barbell hack squat'],
  ['presse', 'Presse à cuisses', 'quadris', 'machine', 'c', 'p', 'fessiers ischios', 'leg press presse 45'],
  ['presse-horizontale', 'Presse horizontale', 'quadris', 'machine', 'c', '', 'fessiers', 'seated leg press'],
  ['presse-1jambe', 'Presse à cuisses unilatérale', 'quadris', 'machine', 'c', '', 'fessiers', 'single leg press'],
  ['pendulum', 'Pendulum squat', 'quadris', 'machine', 'c', '', 'fessiers', 'pendulum squat'],
  ['belt-squat', 'Belt squat', 'quadris', 'machine', 'c', '', 'fessiers', 'belt squat'],
  ['v-squat', 'V-squat (machine)', 'quadris', 'machine', 'c', '', 'fessiers', 'v squat'],
  ['goblet', 'Goblet squat', 'quadris', 'halteres', 'c', 'p', 'fessiers abdos', 'goblet squat kettlebell'],
  ['zercher', 'Zercher squat', 'quadris', 'barre', 'c', '', 'fessiers abdos', 'zercher squat'],
  ['squat-landmine', 'Squat landmine', 'quadris', 'landmine', 'c', '', 'fessiers', 'landmine squat'],
  ['squat-pdc', 'Squat au poids du corps', 'quadris', 'pdc', 'c', '', 'fessiers', 'air squat bodyweight squat'],
  ['squat-saute', 'Squat sauté', 'quadris', 'pdc', 'c', '', 'fessiers mollets', 'jump squat'],
  ['pistol', 'Pistol squat', 'quadris', 'pdc', 'c', '', 'fessiers', 'pistol squat squat une jambe'],
  ['bulgare', 'Fente bulgare', 'quadris', 'halteres', 'c', 'p', 'fessiers', 'bulgarian split squat squat bulgare'],
  ['bulgare-smith', 'Fente bulgare Smith', 'quadris', 'smith', 'c', '', 'fessiers', 'smith bulgarian split squat'],
  ['fentes-avant', 'Fentes avant haltères', 'quadris', 'halteres', 'c', 'p', 'fessiers', 'lunges fentes'],
  ['fentes-arriere', 'Fentes arrière', 'quadris', 'halteres', 'c', '', 'fessiers', 'reverse lunges'],
  ['fentes-marchees', 'Fentes marchées', 'quadris', 'halteres', 'c', 'p', 'fessiers', 'walking lunges'],
  ['fentes-barre', 'Fentes barre', 'quadris', 'barre', 'c', '', 'fessiers', 'barbell lunges'],
  ['fentes-smith', 'Fentes Smith', 'quadris', 'smith', 'c', '', 'fessiers', 'smith lunges'],
  ['split-squat', 'Split squat (fente statique)', 'quadris', 'halteres', 'c', '', 'fessiers', 'split squat'],
  ['fentes-pdc', 'Fentes au poids du corps', 'quadris', 'pdc', 'c', '', 'fessiers', 'bodyweight lunges'],
  ['bulgare-pdc', 'Fente bulgare au poids du corps', 'quadris', 'pdc', 'c', '', 'fessiers', 'bodyweight bulgarian split squat'],
  ['step-up', 'Step-up (montée sur banc)', 'quadris', 'halteres', 'c', '', 'fessiers', 'step up'],
  ['leg-ext', 'Leg extension', 'quadris', 'machine', 'i', 'p', '', 'leg extension extension des jambes'],
  ['leg-ext-1', 'Leg extension unilatéral', 'quadris', 'machine', 'i', '', '', 'single leg extension'],
  ['sissy', 'Sissy squat', 'quadris', 'pdc', 'i', '', '', 'sissy squat'],
  ['chaise', 'Chaise contre un mur', 'quadris', 'pdc', 'i', 't', 'fessiers', 'wall sit'],
  ['spanish-squat', 'Spanish squat (élastique)', 'quadris', 'elastique', 'i', '', '', 'spanish squat'],

  // ---------- Ischios ----------
  ['rdl', 'Soulevé de terre roumain', 'ischios', 'barre', 'c', 'ph', 'fessiers lombaires', 'romanian deadlift rdl'],
  ['rdl-halteres', 'Soulevé de terre roumain haltères', 'ischios', 'halteres', 'c', 'p', 'fessiers lombaires', 'dumbbell rdl'],
  ['rdl-1jambe', 'Soulevé de terre roumain unilatéral', 'ischios', 'halteres', 'c', '', 'fessiers abdos', 'single leg rdl'],
  ['sldl', 'Soulevé de terre jambes tendues', 'ischios', 'barre', 'c', 'p', 'fessiers lombaires', 'stiff leg deadlift sldl'],
  ['good-morning', 'Good morning', 'ischios', 'barre', 'c', '', 'lombaires fessiers', 'good morning'],
  ['leg-curl-allonge', 'Leg curl allongé', 'ischios', 'machine', 'i', 'p', 'mollets', 'lying leg curl'],
  ['leg-curl-assis', 'Leg curl assis', 'ischios', 'machine', 'i', 'p', '', 'seated leg curl'],
  ['leg-curl-debout', 'Leg curl debout', 'ischios', 'machine', 'i', '', '', 'standing leg curl'],
  ['leg-curl-poulie', 'Leg curl à la poulie', 'ischios', 'poulie', 'i', '', '', 'cable leg curl'],
  ['leg-curl-ballon', 'Leg curl sur ballon', 'ischios', 'ballon', 'i', '', 'fessiers', 'swiss ball leg curl'],
  ['leg-curl-halt', 'Leg curl haltère', 'ischios', 'halteres', 'i', '', '', 'dumbbell leg curl'],
  ['leg-curl-glisse', 'Leg curl glissé au sol', 'ischios', 'pdc', 'i', '', 'fessiers', 'slider leg curl serviette'],
  ['nordic', 'Nordic curl', 'ischios', 'pdc', 'i', '', '', 'nordic hamstring curl ischios nordiques'],
  ['ghr', 'Glute-ham raise', 'ischios', 'machine', 'i', '', 'fessiers', 'ghr glute ham'],

  // ---------- Fessiers ----------
  ['hip-thrust', 'Hip thrust', 'fessiers', 'barre', 'c', 'ph', 'ischios', 'hip thrust barre'],
  ['hip-thrust-machine', 'Hip thrust machine', 'fessiers', 'machine', 'c', '', 'ischios', 'glute drive'],
  ['hip-thrust-smith', 'Hip thrust Smith', 'fessiers', 'smith', 'c', '', 'ischios', 'smith hip thrust'],
  ['hip-thrust-1', 'Hip thrust unilatéral', 'fessiers', 'pdc', 'c', '', 'ischios', 'single leg hip thrust'],
  ['pont', 'Pont fessier', 'fessiers', 'barre', 'c', 'p', 'ischios', 'glute bridge relevé de bassin'],
  ['pont-1', 'Pont fessier unilatéral', 'fessiers', 'pdc', 'c', '', 'ischios', 'single leg glute bridge'],
  ['kickback-fess', 'Kickback fessier à la poulie', 'fessiers', 'poulie', 'i', 'p', 'ischios', 'glute kickback cable'],
  ['kickback-fess-machine', 'Kickback fessier machine', 'fessiers', 'machine', 'i', '', 'ischios', 'glute kickback machine'],
  ['abduction', 'Abduction machine', 'fessiers', 'machine', 'i', 'p', '', 'hip abduction abducteurs'],
  ['abduction-poulie', 'Abduction à la poulie', 'fessiers', 'poulie', 'i', '', '', 'cable hip abduction'],
  ['marche-laterale', 'Marche latérale avec élastique', 'fessiers', 'elastique', 'i', '', '', 'monster walk lateral band walk'],
  ['clamshell', 'Clamshell (élastique)', 'fessiers', 'elastique', 'i', '', '', 'clamshell coquillage'],
  ['pull-through', 'Pull-through à la poulie', 'fessiers', 'poulie', 'c', '', 'ischios', 'cable pull through'],
  ['frog-pump', 'Frog pump', 'fessiers', 'pdc', 'i', '', '', 'frog pump'],
  ['donkey-kick', 'Donkey kick', 'fessiers', 'pdc', 'i', '', 'ischios', 'donkey kick quadrupédie'],
  ['fire-hydrant', 'Fire hydrant', 'fessiers', 'pdc', 'i', '', '', 'fire hydrant'],
  ['squat-sumo', 'Squat sumo haltère', 'fessiers', 'halteres', 'c', '', 'adducteurs quadris', 'sumo squat'],
  ['kb-swing', 'Kettlebell swing', 'fessiers', 'kb', 'c', 'p', 'ischios lombaires', 'kettlebell swing kb swing'],

  // ---------- Adducteurs ----------
  ['adduction', 'Adduction machine', 'adducteurs', 'machine', 'i', 'p', '', 'hip adduction adducteurs'],
  ['adduction-poulie', 'Adduction à la poulie', 'adducteurs', 'poulie', 'i', '', '', 'cable adduction'],
  ['copenhagen', 'Gainage Copenhague', 'adducteurs', 'pdc', 'i', 't', 'abdos', 'copenhagen plank'],
  ['fentes-laterales', 'Fentes latérales', 'adducteurs', 'halteres', 'c', '', 'quadris fessiers', 'lateral lunge'],
  ['squat-cosaque', 'Squat cosaque', 'adducteurs', 'pdc', 'c', '', 'quadris fessiers', 'cossack squat'],

  // ---------- Mollets ----------
  ['mollets-debout', 'Mollets debout machine', 'mollets', 'machine', 'i', 'p', '', 'standing calf raise extension mollets'],
  ['mollets-assis', 'Mollets assis machine', 'mollets', 'machine', 'i', 'p', '', 'seated calf raise'],
  ['mollets-assis-halt', 'Mollets assis avec haltères', 'mollets', 'halteres', 'i', '', '', 'seated dumbbell calf raise'],
  ['mollets-presse', 'Mollets à la presse', 'mollets', 'machine', 'i', 'p', '', 'calf press'],
  ['mollets-smith', 'Mollets Smith', 'mollets', 'smith', 'i', '', '', 'smith calf raise'],
  ['mollets-halt', 'Mollets haltère unilatéral', 'mollets', 'halteres', 'i', '', '', 'single leg calf raise'],
  ['mollets-donkey', 'Mollets donkey', 'mollets', 'machine', 'i', '', '', 'donkey calf raise'],
  ['mollets-pdc', 'Mollets au poids du corps', 'mollets', 'pdc', 'i', '', '', 'bodyweight calf raise marche'],
  ['tibial', 'Releveurs (tibial antérieur)', 'mollets', 'autre', 'i', '', '', 'tibialis raise tibia'],

  // ---------- Cou ----------
  ['cou-flexion', 'Flexion du cou (disque)', 'cou', 'disque', 'i', '', '', 'neck flexion'],
  ['cou-extension', 'Extension du cou (harnais)', 'cou', 'autre', 'i', '', 'trapezes', 'neck extension harness'],
  ['cou-lateral', 'Flexion latérale du cou', 'cou', 'disque', 'i', '', '', 'lateral neck flexion'],

  // ---------- Corps entier : haltérophilie, kettlebell, strongman ----------
  ['epaule', 'Épaulé (power clean)', 'complet', 'barre', 'c', 'h', 'quadris fessiers trapezes', 'power clean'],
  ['epaule-suspendu', 'Épaulé suspendu', 'complet', 'barre', 'c', '', 'trapezes ischios', 'hang clean'],
  ['epaule-jete', 'Épaulé-jeté', 'complet', 'barre', 'c', 'h', 'epaules quadris', 'clean and jerk'],
  ['arrache', 'Arraché', 'complet', 'barre', 'c', 'h', 'epaules quadris', 'snatch'],
  ['arrache-suspendu', 'Arraché suspendu', 'complet', 'barre', 'c', '', 'epaules', 'hang snatch'],
  ['arrache-halt', 'Arraché haltère', 'complet', 'halteres', 'c', '', 'epaules fessiers', 'dumbbell snatch'],
  ['thruster', 'Thruster', 'complet', 'barre', 'c', '', 'quadris epaules', 'thruster'],
  ['thruster-halt', 'Thruster haltères', 'complet', 'halteres', 'c', '', 'quadris epaules', 'dumbbell thruster'],
  ['clean-press', 'Épaulé-développé haltères', 'complet', 'halteres', 'c', '', 'epaules quadris', 'clean and press'],
  ['overhead-squat', 'Squat bras tendus (overhead squat)', 'complet', 'barre', 'c', '', 'quadris epaules', 'overhead squat'],
  ['turkish', 'Turkish get-up', 'complet', 'kb', 'c', '', 'epaules abdos', 'turkish get up tgu'],
  ['kb-snatch', 'Arraché kettlebell', 'complet', 'kb', 'c', '', 'epaules fessiers', 'kettlebell snatch'],
  ['kb-clean', 'Épaulé kettlebell', 'complet', 'kb', 'c', '', 'epaules fessiers', 'kettlebell clean'],
  ['farmer', 'Farmer walk (marche du fermier)', 'complet', 'halteres', 'c', 'pd', 'avbras trapezes abdos', 'farmer carry marche lestée'],
  ['suitcase', 'Suitcase carry (marche unilatérale)', 'complet', 'halteres', 'c', 'd', 'abdos avbras', 'suitcase carry'],
  ['overhead-carry', 'Marche bras tendus', 'complet', 'halteres', 'c', 'd', 'epaules abdos', 'overhead carry waiter walk'],
  ['sled-push', 'Poussée de traîneau', 'complet', 'autre', 'c', 'd', 'quadris fessiers', 'sled push prowler'],
  ['sled-pull', 'Tirage de traîneau', 'complet', 'autre', 'c', 'd', 'dos ischios', 'sled pull sled drag'],
  ['sandbag-carry', 'Port de sac lesté', 'complet', 'autre', 'c', 'd', 'avbras abdos', 'sandbag carry'],
  ['tire-flip', 'Retournement de pneu', 'complet', 'autre', 'c', '', 'dos quadris', 'tire flip'],
  ['wall-ball', 'Wall ball', 'complet', 'ballon', 'c', '', 'quadris epaules', 'wall ball'],
  ['box-jump', 'Sauts sur box', 'complet', 'pdc', 'c', '', 'quadris mollets', 'box jump'],
  ['burpees', 'Burpees', 'complet', 'pdc', 'c', '', 'pecs quadris cardio', 'burpee'],
  ['muscle-up', 'Muscle-up', 'complet', 'pdc', 'c', '', 'dos triceps', 'muscle up'],
  ['man-maker', 'Man maker', 'complet', 'halteres', 'c', '', 'pecs epaules quadris', 'man maker'],
  ['slam-ball', 'Slam ball', 'complet', 'ballon', 'c', '', 'abdos epaules', 'ball slam'],

  // ---------- Cardio ----------
  ['rameur', 'Rameur', 'cardio', 'machine', 'c', 't', 'dos quadris', 'rowing machine concept2'],
  ['velo', 'Vélo', 'cardio', 'machine', 'c', 't', 'quadris', 'vélo stationnaire bike'],
  ['air-bike', 'Air bike', 'cardio', 'machine', 'c', 't', '', 'assault bike'],
  ['tapis', 'Course sur tapis', 'cardio', 'machine', 'c', 't', '', 'treadmill tapis de course'],
  ['marche-inclinee', 'Marche inclinée sur tapis', 'cardio', 'machine', 'c', 't', 'fessiers mollets', 'incline walk'],
  ['elliptique', 'Vélo elliptique', 'cardio', 'machine', 'c', 't', '', 'elliptical'],
  ['escalier', 'Simulateur d’escalier', 'cardio', 'machine', 'c', 't', 'fessiers quadris', 'stairmaster stepper'],
  ['ski-erg', 'Ski erg', 'cardio', 'machine', 'c', 't', 'dos triceps', 'ski erg'],
  ['corde', 'Corde à sauter', 'cardio', 'autre', 'c', 't', 'mollets', 'jump rope'],
  ['battle-rope', 'Battle rope', 'cardio', 'autre', 'c', 't', 'epaules', 'battle ropes cordes ondulatoires'],
  ['jumping-jacks', 'Jumping jacks', 'cardio', 'pdc', 'c', 't', '', 'jumping jack'],
  ['course', 'Course à pied', 'cardio', 'autre', 'c', 't', '', 'running footing'],
];

// ---- Cibles : la portion ou la fonction que l'exercice fait travailler ----
// Deux exercices de la même cible se remplacent l'un l'autre. m : groupe musculaire de la cible ;
// n : nom ; s : nom court, dans la liste de son muscle ; tip : ce qui les rassemble (dit par le coach).
// L'ordre est celui de l'affichage (dans un muscle, la cible la plus courante d'abord).
export const CIBLES = {
  'pecs-milieu': { m: 'pecs', n: 'Milieu des pectoraux', s: 'Milieu', tip: 'Bras qui poussent devant toi : tout le pectoral travaille, surtout sa partie centrale.' },
  'pecs-haut': { m: 'pecs', n: 'Haut des pectoraux', s: 'Haut', tip: 'Banc incliné ou bras qui montent : le haut des pectoraux (faisceau claviculaire) fait le gros du travail.' },
  'pecs-bas': { m: 'pecs', n: 'Bas des pectoraux', s: 'Bas', tip: 'Bras qui poussent vers le bas, comme aux dips : le bas des pectoraux prend le relais.' },
  'dos-largeur': { m: 'dos', n: 'Largeur du dos', s: 'Largeur', tip: 'Tirer de haut en bas, coudes vers les hanches : le grand dorsal, celui qui donne la largeur.' },
  'dos-epaisseur': { m: 'dos', n: 'Épaisseur du dos', s: 'Épaisseur', tip: 'Tirer vers le ventre en serrant les omoplates : rhomboïdes et milieu des trapèzes, pour l’épaisseur.' },
  'lombaires': { m: 'lombaires', n: 'Lombaires', s: '', tip: 'Le bas du dos, celui qui protège la colonne. Lent et contrôlé.' },
  'ep-ant': { m: 'epaules', n: 'Avant de l’épaule', s: 'Avant', tip: 'Pousser au-dessus de la tête ou monter les bras devant : l’avant de l’épaule fait le travail.' },
  'ep-lat': { m: 'epaules', n: 'Côté de l’épaule', s: 'Côté', tip: 'Monter les bras sur les côtés : le deltoïde latéral, celui qui élargit les épaules.' },
  'ep-post': { m: 'epaules', n: 'Arrière de l’épaule', s: 'Arrière', tip: 'Ouvrir les bras vers l’arrière : le deltoïde postérieur, souvent oublié, et bon pour la posture.' },
  'coiffe': { m: 'epaules', n: 'Coiffe des rotateurs', s: 'Coiffe des rotateurs', tip: 'Les petits muscles qui tiennent l’épaule. Léger, lent, sans à-coups.' },
  'trap-haut': { m: 'trapezes', n: 'Haut des trapèzes', s: '', tip: 'Hausser les épaules, tenir une seconde en haut, redescendre lentement.' },
  'bi': { m: 'biceps', n: 'Biceps, les deux portions', s: 'Les deux portions', tip: 'Coudes le long du corps : les deux portions du biceps travaillent ensemble.' },
  'bi-long': { m: 'biceps', n: 'Longue portion du biceps', s: 'Longue portion', tip: 'Coudes derrière le buste : la longue portion est étirée et travaille davantage.' },
  'bi-court': { m: 'biceps', n: 'Courte portion du biceps', s: 'Courte portion', tip: 'Coudes devant le buste, comme au pupitre : la courte portion travaille davantage.' },
  'brachial': { m: 'biceps', n: 'Brachial', s: 'Brachial', tip: 'Prise marteau ou pouces vers le bas : le brachial, sous le biceps, et le dessus de l’avant-bras.' },
  'tri-lat': { m: 'triceps', n: 'Portion latérale du triceps', s: 'Portion latérale', tip: 'Coudes collés au corps : les portions latérale et médiale travaillent davantage.' },
  'tri-long': { m: 'triceps', n: 'Longue portion du triceps', s: 'Longue portion', tip: 'Bras au-dessus de la tête : la longue portion est étirée. C’est la plus grosse des trois.' },
  'tri-poly': { m: 'triceps', n: 'Triceps, les trois portions', s: 'Les trois portions', tip: 'Pousser lourd, coudes serrés : les trois portions du triceps, avec les pectoraux en renfort.' },
  'avb-flech': { m: 'avbras', n: 'Avant-bras, fléchisseurs', s: 'Fléchisseurs', tip: 'Fermer le poignet : le dessous de l’avant-bras.' },
  'avb-ext': { m: 'avbras', n: 'Avant-bras, extenseurs', s: 'Extenseurs', tip: 'Relever le poignet : le dessus de l’avant-bras, qui équilibre les fléchisseurs.' },
  'grip': { m: 'avbras', n: 'Grip et poignets', s: 'Grip', tip: 'Serrer et tenir : un grip solide pour tous les tirages.' },
  'abs-haut': { m: 'abdos', n: 'Haut des abdos', s: 'Haut', tip: 'Enrouler le buste vers le bassin : le grand droit, surtout dans sa partie haute.' },
  'abs-bas': { m: 'abdos', n: 'Bas des abdos', s: 'Bas', tip: 'Ramener le bassin vers le buste : le grand droit, surtout dans sa partie basse.' },
  'obliques': { m: 'abdos', n: 'Obliques', s: 'Obliques', tip: 'Tourner, s’incliner ou résister à la rotation : les côtés de la taille.' },
  'gainage': { m: 'abdos', n: 'Gainage', s: 'Gainage', tip: 'Ne pas bouger : toute la sangle abdominale, celle qui protège le dos.' },
  'quad-squat': { m: 'quadris', n: 'Quadriceps, squat et presse', s: 'Squat et presse', tip: 'Les deux jambes poussent ensemble : quadriceps et fessiers, avec de la charge.' },
  'quad-uni': { m: 'quadris', n: 'Quadriceps, une jambe à la fois', s: 'Une jambe à la fois', tip: 'Une jambe à la fois : aucune ne compense l’autre, et les fessiers travaillent en plus.' },
  'quad-iso': { m: 'quadris', n: 'Quadriceps en isolation', s: 'Isolation', tip: 'Seul le genou bouge : le quadriceps travaille seul, droit fémoral compris.' },
  'isch-hanche': { m: 'ischios', n: 'Ischios, par la hanche', s: 'Par la hanche', tip: 'Le buste bascule, jambes presque tendues : les ischios travaillent étirés.' },
  'isch-genou': { m: 'ischios', n: 'Ischios, par le genou', s: 'Par le genou', tip: 'Fléchir le genou : le seul moyen de faire travailler la courte portion du biceps fémoral.' },
  'fess-grand': { m: 'fessiers', n: 'Grand fessier', s: 'Grand fessier', tip: 'Pousser le bassin vers l’avant : le grand fessier, en contraction complète.' },
  'fess-moyen': { m: 'fessiers', n: 'Moyen fessier', s: 'Moyen fessier', tip: 'Écarter la jambe : le haut et le côté des fessiers, qui stabilisent le bassin.' },
  'adducteurs': { m: 'adducteurs', n: 'Adducteurs', s: '', tip: 'Rapprocher les jambes : l’intérieur des cuisses.' },
  'mol-gastro': { m: 'mollets', n: 'Mollets, jambes tendues', s: 'Jambes tendues', tip: 'Jambes tendues : les jumeaux, qui donnent le galbe du mollet.' },
  'mol-sol': { m: 'mollets', n: 'Mollets, genoux fléchis', s: 'Genoux fléchis', tip: 'Genoux fléchis : les jumeaux se relâchent, c’est le soléaire qui travaille.' },
  'tibial': { m: 'mollets', n: 'Tibial antérieur', s: 'Tibial antérieur', tip: 'Relever la pointe du pied : le devant du tibia.' },
  'cou': { m: 'cou', n: 'Cou', s: '', tip: 'Lent et léger, toujours.' },
  'sdt': { m: 'dos', n: 'Soulevé de terre', s: 'Soulevé de terre', tip: 'Soulever du sol : toute la chaîne arrière, dos, fessiers et ischios.' },
  'halterophilie': { m: 'complet', n: 'Haltérophilie', s: 'Haltérophilie', tip: 'Du sol au-dessus de la tête, en explosif : la technique avant la charge.' },
  'portes': { m: 'complet', n: 'Portés et traîneau', s: 'Portés et traîneau', tip: 'Marcher chargé : grip, gainage et trapèzes.' },
  'metcon': { m: 'complet', n: 'Corps entier, explosif', s: 'Explosif', tip: 'Tout le corps, vite : pour le cardio et la puissance.' },
  'cardio': { m: 'cardio', n: 'Cardio', s: '', tip: 'Pour le cœur et la récupération.' },
};
const CIBLE_IDS = {
  'pecs-milieu': 'dc-barre dc-halteres dc-machine dc-smith dc-convergent dc-pause dc-floor-barre dc-floor-halteres dc-unilateral dc-squeeze ec-halteres pec-deck ec-poulie ec-poulie-1bras ec-couche-poulie dev-poulie pullover-halt svend pompes pompes-larges pompes-archer pompes-lestees pompes-anneaux ec-anneaux dev-elastique ec-elastique',
  'pecs-haut': 'di-barre di-halteres di-machine di-smith ei-halteres ec-poulie-basse pompes-declinees dev-landmine-pecs',
  'pecs-bas': 'dd-barre dd-halteres dd-machine ed-halteres ec-poulie-haute pompes-inclinees dips-pecs',
  'dos-largeur': 'tractions tractions-sup tractions-neutre tractions-larges tractions-lestees tractions-neg tractions-assist tractions-machine scap-pull tv-poulie tv-serre tv-neutre tv-sup tv-1bras tv-machine tv-nuque tv-bras-tendus pullover-corde tv-elastique',
  'dos-epaisseur': 'tractions-austr row-anneaux th-poulie th-large th-1bras row-machine row-convergent row-barre row-yates row-pendlay row-tbar row-tbar-machine row-meadows row-smith row-1bras row-halteres row-incline row-kroc row-kb row-elastique renegade',
  'lombaires': 'ext-lombaires hyperext ext-lombaires-machine superman reverse-hyper bird-dog',
  'ep-ant': 'dm-barre dm-assis-barre de-halteres de-halteres-debout arnold de-machine de-smith de-nuque push-press de-landmine de-z de-kb de-elastique pompes-piquees hspu ef-halteres ef-poulie ef-disque ef-barre',
  'ep-lat': 'el-halteres el-poulie el-machine el-allonge el-penche el-elastique tm-barre tm-poulie tm-halteres',
  'ep-post': 'oiseau oiseau-poulie reverse-pec face-pull face-pull-el pull-apart y-raise ytw-sol',
  'coiffe': 'rot-ext-poulie rot-ext-halt rot-int-poulie',
  'trap-haut': 'shrug-barre shrug-halteres shrug-machine shrug-smith shrug-trapbar shrug-poulie shrug-incline',
  'bi': 'curl-barre curl-ez curl-halteres curl-simultane curl-poulie curl-poulie-1bras curl-21 curl-elastique curl-kb curl-sac',
  'bi-long': 'curl-incline curl-incline-poulie curl-bayesian curl-drag curl-drag-halt curl-serre',
  'bi-court': 'curl-pupitre curl-pupitre-halt curl-pupitre-machine curl-concentre curl-poulie-haute curl-araignee curl-machine curl-large',
  'brachial': 'curl-marteau curl-marteau-corde curl-marteau-croise curl-zottman curl-inverse',
  'tri-lat': 'pushdown-barre pushdown-corde pushdown-1bras pushdown-inv kickback kickback-poulie tate-press ext-triceps-machine ext-triceps-el',
  'tri-long': 'barre-front barre-front-halt ext-poulie-tete ext-halt-tete ext-halt-2mains ext-ez-tete ext-elastique-tete',
  'tri-poly': 'dips-triceps dips-banc dips-machine dc-serre pompes-diamant jm-press',
  'avb-flech': 'wrist-curl wrist-curl-halt wrist-dos',
  'avb-ext': 'reverse-wrist reverse-wrist-halt',
  'grip': 'wrist-roller dead-hang gripper pinch pron-sup',
  'abs-haut': 'crunch crunch-poulie crunch-machine crunch-decline situp',
  'abs-bas': 'crunch-inverse rjs rgs rj-chaise rj-sol toes-bar dragon-flag v-ups ciseaux',
  'obliques': 'crunch-bicyclette crunch-obliques planche-laterale rotations-russes pallof woodchop flexion-laterale',
  'gainage': 'planche planche-lestee gainage-dyn hollow l-sit ab-wheel dead-bug mountain',
  'quad-squat': 'squat squat-avant squat-pause box-squat squat-smith hack-squat hack-barre presse presse-horizontale pendulum belt-squat v-squat goblet zercher squat-landmine squat-pdc squat-saute',
  'quad-uni': 'pistol presse-1jambe bulgare bulgare-smith bulgare-pdc fentes-avant fentes-arriere fentes-marchees fentes-barre fentes-smith fentes-pdc split-squat step-up',
  'quad-iso': 'leg-ext leg-ext-1 sissy chaise spanish-squat',
  'isch-hanche': 'rdl rdl-halteres rdl-1jambe sldl good-morning',
  'isch-genou': 'leg-curl-allonge leg-curl-assis leg-curl-debout leg-curl-poulie leg-curl-ballon leg-curl-halt leg-curl-glisse nordic ghr',
  'fess-grand': 'hip-thrust hip-thrust-machine hip-thrust-smith hip-thrust-1 pont pont-1 kickback-fess kickback-fess-machine pull-through frog-pump donkey-kick squat-sumo kb-swing',
  'fess-moyen': 'abduction abduction-poulie marche-laterale clamshell fire-hydrant',
  'adducteurs': 'adduction adduction-poulie copenhagen fentes-laterales squat-cosaque',
  'mol-gastro': 'mollets-debout mollets-presse mollets-smith mollets-halt mollets-donkey mollets-pdc',
  'mol-sol': 'mollets-assis mollets-assis-halt',
  'tibial': 'tibial',
  'cou': 'cou-flexion cou-extension cou-lateral',
  'sdt': 'sdt sdt-sumo sdt-trapbar rack-pull sdt-deficit sdt-halteres sdt-kb',
  'halterophilie': 'epaule epaule-suspendu epaule-jete arrache arrache-suspendu arrache-halt kb-snatch kb-clean clean-press thruster thruster-halt overhead-squat',
  'portes': 'farmer suitcase overhead-carry sandbag-carry sled-push sled-pull',
  'metcon': 'turkish tire-flip wall-ball box-jump burpees muscle-up man-maker slam-ball',
  'cardio': 'rameur velo air-bike tapis marche-inclinee elliptique escalier ski-erg corde battle-rope jumping-jacks course',
};
const CIBLE_OF = new Map(Object.entries(CIBLE_IDS).flatMap(([c, ids]) => ids.split(' ').map((id) => [id, c])));
export const CIBLE_LIST = CIBLE_IDS;      // pour les tests : chaque exercice dans une seule cible

// ---- Recherche ----
export function normalizeTxt(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[’'`]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}

function build(row) {
  const [id, n, m, e, t, f, s, al] = row;
  const mode = f.includes('t') ? 't' : f.includes('d') ? 'd' : 'r';
  const c = CIBLE_OF.get(id) || null;
  return {
    id, n, m, e, t, mode, c,
    pop: f.includes('p'), heavy: f.includes('h'), max: f.includes('x'),
    sec: s ? s.split(' ') : [],
    q: normalizeTxt(n + ' ' + (al || '') + ' ' + MUSCLES[m] + ' ' + EQUIP[e] + (c ? ' ' + CIBLES[c].n : '')),
  };
}

export const EXERCISES = ROWS.map(build);
const BY_ID = new Map(EXERCISES.map((x) => [x.id, x]));

export function exoById(id) { return BY_ID.get(id) || null; }
// Nom de ce que l'exercice travaille : sa cible, sinon son muscle
export function cibleName(x) { return x ? (x.c && CIBLES[x.c] ? CIBLES[x.c].n : MUSCLES[x.m] || '') : ''; }

// Exercices créés par l'utilisateur ({ id: 'c-…', n, m, e, mode }) : même forme que la bibliothèque
export function customExo(c) {
  const m = MUSCLES[c.m] ? c.m : 'complet', e = EQUIP[c.e] ? c.e : 'autre';
  return { id: c.id, n: String(c.n || 'Exercice'), m, e, t: c.t === 'c' ? 'c' : 'i', mode: ['r', 't', 'd'].includes(c.mode) ? c.mode : 'r', c: null,
    pop: false, heavy: false, max: false, sec: [], custom: true, q: normalizeTxt(c.n + ' ' + MUSCLES[m] + ' ' + EQUIP[e]) };
}

// Recherche : tous les mots tapés doivent apparaître (début de mot), filtres muscle / matériel.
// Classement : nom qui commence par la recherche, muscle principal avant secondaire, courants d'abord.
export function searchExos(query, { m = '', e = '', extra = [] } = {}) {
  const words = normalizeTxt(query).split(' ').filter(Boolean);
  const all = extra.length ? EXERCISES.concat(extra) : EXERCISES;
  const out = [];
  for (const x of all) {
    if (e && x.e !== e) continue;
    let mScore = 0;
    if (m) { if (x.m === m) mScore = 2; else if (x.sec.includes(m)) mScore = 1; else continue; }
    let ok = true, starts = false;
    if (words.length) {
      const toks = x.q.split(' ');
      for (const w of words) { if (!toks.some((t) => t.startsWith(w))) { ok = false; break; } }
      if (!ok) continue;
      starts = normalizeTxt(x.n).startsWith(words.join(' '));
    }
    out.push({ x, s: (starts ? 8 : 0) + mScore * 4 + (x.custom ? 3 : 0) + (x.pop ? 1 : 0) + (x.pop && x.heavy ? 1 : 0) });
  }
  out.sort((a, b) => b.s - a.s || a.x.n.localeCompare(b.x.n, 'fr'));
  return out.map((o) => o.x);
}

// ---- Réglages proposés par défaut pour un exercice ----
// sets : séries ; lo-hi : répétitions (ou secondes, ou mètres) ; rest : repos en secondes
export function defaultsFor(x) {
  if (!x) return { mode: 'r', sets: 3, lo: 8, hi: 12, rest: 90 };
  if (x.mode === 't') {
    if (x.m === 'cardio') return { mode: 't', sets: 1, lo: 600, hi: 1200, rest: 0 };
    return { mode: 't', sets: 3, lo: 30, hi: 60, rest: 60, max: x.max || undefined };
  }
  if (x.mode === 'd') return { mode: 'd', sets: 3, lo: 30, hi: 40, rest: 90 };
  if (x.m === 'mollets') return { mode: 'r', sets: 4, lo: 10, hi: 15, rest: 60 };
  if (x.m === 'abdos') return { mode: 'r', sets: 3, lo: 12, hi: 20, rest: 60 };
  if (x.m === 'avbras') return { mode: 'r', sets: 3, lo: 15, hi: 20, rest: 60 };
  if (x.heavy) return { mode: 'r', sets: 3, lo: 5, hi: 8, rest: 180 };
  if (x.t === 'c') return { mode: 'r', sets: 3, lo: 8, hi: 12, rest: 120 };
  return { mode: 'r', sets: 3, lo: 10, hi: 15, rest: 75 };
}
