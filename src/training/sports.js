// Sports en plus des séances de musculation : catalogue rangé par catégories, dépense estimée,
// icônes, recherche. Fonctions pures, sans accès au stockage ni au DOM.
//
// Dans le programme, un sport est { id, days, min?, int? } (sport du catalogue) ou
// { id: 'u…', n, c, met, days, min?, int? } (sport créé par l'utilisateur). min : durée d'une séance
// en minutes, si elle diffère de celle du catalogue ; int : intensité 0 tranquille, 2 intense
// (absente : normale).
//
// Dépense : MET d'une pratique modérée, d'après le Compendium des activités physiques
// (Ainsworth et al. 2011, mise à jour Herrmann et al. 2024). Ce qui s'ajoute à une journée de repos :
// (MET × intensité − 1) × poids (kg) × durée (h), arrondi à 50 kcal comme les autres bonus.

import { normalizeTxt } from './exercises.js';

export const SPORT_CATS = {
  eau: { n: 'Sports aquatiques', s: 'Sport aquatique' },
  course: { n: 'Course et marche', s: 'Endurance' },
  velo: { n: 'Vélo', s: 'Vélo' },
  cardio: { n: 'Cardio en salle', s: 'Cardio' },
  fitness: { n: 'Fitness et cours', s: 'Fitness' },
  zen: { n: 'Corps et esprit', s: 'Corps et esprit' },
  combat: { n: 'Sports de combat', s: 'Sport de combat' },
  collectif: { n: 'Sports collectifs', s: 'Sport collectif' },
  raquette: { n: 'Sports de raquette', s: 'Raquette' },
  neige: { n: 'Glisse et neige', s: 'Glisse' },
  montagne: { n: 'Montagne et escalade', s: 'Montagne' },
  danse: { n: 'Danse', s: 'Danse' },
  gym: { n: 'Gym et acrobatie', s: 'Gym' },
  force: { n: 'Sports de force', s: 'Force' },
  precision: { n: 'Adresse et précision', s: 'Précision' },
  autre: { n: 'Autres sports', s: 'Sport' },
};

// [id, nom, catégorie, MET, minutes par défaut, article, mots-clés pour la recherche]
const ROWS = [
  ['natation', 'Natation', 'eau', 5.8, 30, 'la', 'nage nager piscine crawl brasse dos papillon longueurs swim swimming'],
  ['eau-libre', 'Nage en eau libre', 'eau', 6, 45, 'la', 'mer lac open water natation'],
  ['longe-cote', 'Longe-côte', 'eau', 5, 60, 'le', 'marche aquatique marche en mer'],
  ['aquagym', 'Aquagym', 'eau', 5.5, 45, 'l’', 'aquafitness gym aquatique'],
  ['aquabike', 'Aquabike', 'eau', 6, 45, 'l’', 'aquabiking velo aquatique'],
  ['water-polo', 'Water-polo', 'eau', 10, 60, 'le', 'waterpolo'],
  ['natation-artistique', 'Natation artistique', 'eau', 8, 60, 'la', 'natation synchronisee synchro'],
  ['plongee', 'Plongée sous-marine', 'eau', 7, 60, 'la', 'scuba bouteille'],
  ['apnee', 'Apnée', 'eau', 5, 45, 'l’', 'freediving snorkeling plongee libre'],
  ['surf', 'Surf', 'eau', 3, 90, 'le', 'vagues'],
  ['bodyboard', 'Bodyboard', 'eau', 3, 60, 'le', 'vagues'],
  ['kitesurf', 'Kitesurf', 'eau', 6, 90, 'le', 'kite'],
  ['planche-voile', 'Planche à voile', 'eau', 4, 90, 'la', 'windsurf'],
  ['paddle', 'Stand up paddle', 'eau', 6, 60, 'le', 'sup paddle board'],
  ['kayak', 'Kayak', 'eau', 5, 60, 'le', ''],
  ['canoe', 'Canoë', 'eau', 5, 60, 'le', 'canoe'],
  ['aviron', 'Aviron', 'eau', 6, 60, 'l’', 'rowing'],
  ['rafting', 'Rafting', 'eau', 5, 120, 'le', 'eaux vives'],
  ['voile', 'Voile', 'eau', 3, 120, 'la', 'bateau regate deriveur catamaran'],
  ['ski-nautique', 'Ski nautique', 'eau', 6, 30, 'le', ''],
  ['wakeboard', 'Wakeboard', 'eau', 6, 45, 'le', 'wake'],

  ['course', 'Course à pied', 'course', 9, 40, 'la', 'running courir jogging run'],
  ['footing', 'Footing', 'course', 7, 30, 'le', 'jogging course lente endurance fondamentale'],
  ['fractionne', 'Fractionné', 'course', 10, 40, 'le', 'intervalles vma piste vitesse interval'],
  ['trail', 'Trail', 'course', 9, 75, 'le', 'trail running course nature sentiers'],
  ['course-orientation', 'Course d’orientation', 'course', 9, 60, 'la', 'orientation carte boussole'],
  ['course-obstacles', 'Course d’obstacles', 'course', 9, 60, 'la', 'obstacle race mud'],
  ['triathlon', 'Triathlon', 'course', 9, 90, 'le', 'tri'],
  ['duathlon', 'Duathlon', 'course', 9, 75, 'le', ''],
  ['marche', 'Marche', 'course', 3.5, 45, 'la', 'promenade balade walk walking pas'],
  ['marche-rapide', 'Marche rapide', 'course', 4.5, 45, 'la', 'marche sportive'],
  ['marche-nordique', 'Marche nordique', 'course', 4.8, 60, 'la', 'batons nordic walking'],
  ['randonnee', 'Randonnée', 'course', 6, 180, 'la', 'rando hiking trek'],

  ['velo-route', 'Vélo de route', 'velo', 8, 90, 'le', 'cyclisme route bike velo'],
  ['vtt', 'VTT', 'velo', 8.5, 90, 'le', 'velo tout terrain mountain bike'],
  ['gravel', 'Gravel', 'velo', 8, 90, 'le', 'velo'],
  ['balade-velo', 'Balade à vélo', 'velo', 4, 45, 'la', 'velo tranquille ville velotaf'],
  ['velo-salle', 'Vélo en salle (cours)', 'velo', 8.5, 45, 'le', 'spinning biking cours indoor'],
  ['velo-appart', 'Vélo d’appartement', 'velo', 7, 30, 'le', 'velo statique home trainer'],
  ['bmx', 'BMX', 'velo', 8.5, 45, 'le', 'velo'],
  ['cyclo-cross', 'Cyclo-cross', 'velo', 9, 60, 'le', 'velo'],

  ['tapis', 'Course sur tapis', 'cardio', 9, 30, 'la', 'tapis de course treadmill'],
  ['marche-inclinee', 'Marche inclinée sur tapis', 'cardio', 6, 30, 'la', 'incline walk tapis pente'],
  ['rameur', 'Rameur', 'cardio', 7, 20, 'le', 'rowing machine ergometre'],
  ['elliptique', 'Elliptique', 'cardio', 5, 30, 'l’', 'velo elliptique cross trainer'],
  ['stepper', 'Stepper', 'cardio', 9, 20, 'le', 'escaliers marches stairs'],
  ['corde-sauter', 'Corde à sauter', 'cardio', 10, 15, 'la', 'jump rope'],
  ['ski-erg', 'Ski-erg', 'cardio', 7, 20, 'le', 'skierg'],
  ['velo-air', 'Vélo à air', 'cardio', 8, 20, 'le', 'air bike assault'],

  ['hiit', 'HIIT', 'fitness', 8, 30, 'le', 'haute intensite tabata fractionne'],
  ['cross-training', 'Cross-training', 'fitness', 8, 60, 'le', 'crossfit wod box'],
  ['circuit', 'Circuit training', 'fitness', 8, 45, 'le', ''],
  ['renfo', 'Renforcement musculaire', 'fitness', 5, 45, 'le', 'renfo cours collectif pump body'],
  ['cardio-boxe', 'Cardio-boxe', 'fitness', 7, 45, 'la', 'fitness boxing boxe'],
  ['step', 'Step', 'fitness', 7, 45, 'le', ''],
  ['aerobic', 'Aérobic', 'fitness', 6.5, 45, 'l’', 'aerobics'],
  ['danse-fitness', 'Danse fitness', 'fitness', 6.5, 45, 'la', 'zumba'],
  ['boot-camp', 'Boot camp', 'fitness', 8, 60, 'le', 'bootcamp'],
  ['suspension', 'Entraînement en suspension', 'fitness', 6, 45, 'l’', 'sangles trx'],
  ['kettlebell', 'Kettlebell', 'fitness', 8, 30, 'le', 'swing'],
  ['abdos-fessiers', 'Abdos-fessiers', 'fitness', 4.5, 30, 'les', 'cuisses abdos fessiers caf'],

  ['yoga', 'Yoga', 'zen', 2.5, 60, 'le', 'hatha'],
  ['yoga-dynamique', 'Yoga dynamique', 'zen', 4, 60, 'le', 'vinyasa ashtanga power yoga'],
  ['pilates', 'Pilates', 'zen', 3, 45, 'le', ''],
  ['stretching', 'Stretching', 'zen', 2.3, 20, 'le', 'etirements souplesse'],
  ['mobilite', 'Mobilité', 'zen', 2.5, 20, 'la', 'mobility'],
  ['tai-chi', 'Tai-chi', 'zen', 3, 45, 'le', 'tai chi chuan'],
  ['qi-gong', 'Qi gong', 'zen', 2.5, 45, 'le', 'qigong'],
  ['barre-sol', 'Barre au sol', 'zen', 3.5, 45, 'la', 'barre fitness'],

  ['boxe', 'Boxe anglaise', 'combat', 8, 60, 'la', 'boxing boxe'],
  ['boxe-thai', 'Boxe thaï', 'combat', 8.5, 60, 'la', 'muay thai'],
  ['kickboxing', 'Kickboxing', 'combat', 8.5, 60, 'le', 'k1 full contact'],
  ['savate', 'Boxe française', 'combat', 8, 60, 'la', 'savate'],
  ['mma', 'MMA', 'combat', 9, 60, 'le', 'arts martiaux mixtes free fight'],
  ['judo', 'Judo', 'combat', 8, 90, 'le', ''],
  ['jjb', 'Jiu-jitsu brésilien', 'combat', 8, 90, 'le', 'jjb bjj'],
  ['grappling', 'Grappling', 'combat', 8, 60, 'le', 'no gi luta livre soumission'],
  ['lutte', 'Lutte', 'combat', 8, 90, 'la', 'wrestling greco romaine'],
  ['karate', 'Karaté', 'combat', 7, 90, 'le', ''],
  ['taekwondo', 'Taekwondo', 'combat', 7.5, 90, 'le', ''],
  ['kung-fu', 'Kung-fu', 'combat', 7, 90, 'le', 'wushu'],
  ['krav-maga', 'Krav-maga', 'combat', 7.5, 60, 'le', 'self defense'],
  ['aikido', 'Aïkido', 'combat', 5.5, 90, 'l’', ''],
  ['sambo', 'Sambo', 'combat', 8, 90, 'le', ''],
  ['capoeira', 'Capoeira', 'combat', 7, 60, 'la', ''],
  ['escrime', 'Escrime', 'combat', 6, 90, 'l’', 'epee fleuret sabre'],
  ['kendo', 'Kendo', 'combat', 6.5, 90, 'le', ''],

  ['football', 'Football', 'collectif', 7, 90, 'le', 'foot soccer'],
  ['futsal', 'Futsal', 'collectif', 8, 60, 'le', 'foot en salle'],
  ['foot-cinq', 'Foot à cinq', 'collectif', 8, 60, 'le', 'five foot a 5 urban'],
  ['basket', 'Basket-ball', 'collectif', 6.5, 60, 'le', 'basketball'],
  ['handball', 'Handball', 'collectif', 8, 60, 'le', 'hand'],
  ['volley', 'Volley-ball', 'collectif', 4, 90, 'le', 'volleyball'],
  ['beach-volley', 'Beach-volley', 'collectif', 8, 60, 'le', 'volley plage'],
  ['rugby', 'Rugby', 'collectif', 8.3, 80, 'le', ''],
  ['hockey-glace', 'Hockey sur glace', 'collectif', 8, 60, 'le', ''],
  ['hockey-gazon', 'Hockey sur gazon', 'collectif', 7.8, 60, 'le', ''],
  ['roller-hockey', 'Roller hockey', 'collectif', 7.5, 60, 'le', ''],
  ['baseball', 'Baseball', 'collectif', 5, 120, 'le', ''],
  ['softball', 'Softball', 'collectif', 5, 90, 'le', ''],
  ['foot-us', 'Football américain', 'collectif', 8, 120, 'le', 'american football'],
  ['ultimate', 'Ultimate', 'collectif', 8, 60, 'l’', 'frisbee'],
  ['cricket', 'Cricket', 'collectif', 4.8, 180, 'le', ''],
  ['crosse', 'Crosse', 'collectif', 8, 60, 'la', 'lacrosse'],

  ['tennis', 'Tennis', 'raquette', 7.3, 60, 'le', ''],
  ['padel', 'Padel', 'raquette', 6, 60, 'le', ''],
  ['badminton', 'Badminton', 'raquette', 5.5, 60, 'le', 'bad'],
  ['squash', 'Squash', 'raquette', 8, 45, 'le', ''],
  ['tennis-table', 'Tennis de table', 'raquette', 4, 60, 'le', 'ping pong'],
  ['pickleball', 'Pickleball', 'raquette', 4.5, 60, 'le', ''],
  ['beach-tennis', 'Beach tennis', 'raquette', 6, 60, 'le', 'plage'],

  ['ski-alpin', 'Ski alpin', 'neige', 5.3, 180, 'le', 'ski piste'],
  ['snowboard', 'Snowboard', 'neige', 5.3, 180, 'le', 'snow surf des neiges'],
  ['ski-fond', 'Ski de fond', 'neige', 9, 90, 'le', 'skating nordique'],
  ['ski-rando', 'Ski de randonnée', 'neige', 8, 180, 'le', 'skimo ski alpinisme peaux de phoque'],
  ['raquettes', 'Raquettes à neige', 'neige', 6, 120, 'les', 'raquette neige'],
  ['patinage', 'Patinage', 'neige', 5.5, 60, 'le', 'patin a glace patinoire'],
  ['roller', 'Roller', 'neige', 7, 60, 'le', 'rollers patins a roulettes'],
  ['skateboard', 'Skateboard', 'neige', 5, 60, 'le', 'skate'],

  ['escalade-salle', 'Escalade en salle', 'montagne', 6, 90, 'l’', 'grimpe voie climbing'],
  ['bloc', 'Bloc', 'montagne', 7, 90, 'le', 'bouldering escalade de bloc'],
  ['escalade-falaise', 'Escalade en falaise', 'montagne', 6, 180, 'l’', 'grimpe falaise'],
  ['alpinisme', 'Alpinisme', 'montagne', 8, 300, 'l’', 'haute montagne'],
  ['via-ferrata', 'Via ferrata', 'montagne', 6, 180, 'la', ''],
  ['rando-montagne', 'Randonnée en montagne', 'montagne', 7, 240, 'la', 'rando montagne denivele'],
  ['canyoning', 'Canyoning', 'montagne', 6, 180, 'le', 'canyon'],
  ['speleo', 'Spéléologie', 'montagne', 5, 180, 'la', 'speleo grotte'],

  ['danse-classique', 'Danse classique', 'danse', 5, 90, 'la', 'ballet'],
  ['danse-contemporaine', 'Danse contemporaine', 'danse', 5, 90, 'la', ''],
  ['modern-jazz', 'Modern jazz', 'danse', 5, 90, 'le', 'jazz'],
  ['hip-hop', 'Hip-hop', 'danse', 6, 60, 'le', 'danse urbaine street dance'],
  ['breakdance', 'Breakdance', 'danse', 7, 60, 'le', 'breaking bboy'],
  ['salsa', 'Salsa', 'danse', 4.5, 60, 'la', 'danse latine'],
  ['bachata', 'Bachata', 'danse', 4.5, 60, 'la', 'danse latine'],
  ['rock', 'Rock', 'danse', 5, 60, 'le', 'rock a 6 temps swing lindy hop'],
  ['danse-salon', 'Danse de salon', 'danse', 4, 60, 'la', 'valse tango cha cha'],
  ['danse-orientale', 'Danse orientale', 'danse', 4.5, 60, 'la', 'belly dance'],
  ['pole-dance', 'Pole dance', 'danse', 5, 60, 'la', ''],
  ['claquettes', 'Claquettes', 'danse', 4.8, 60, 'les', 'tap dance'],

  ['gym-artistique', 'Gymnastique artistique', 'gym', 4.5, 120, 'la', 'gym agres'],
  ['gym-rythmique', 'Gymnastique rythmique', 'gym', 4, 120, 'la', 'gym'],
  ['trampoline', 'Trampoline', 'gym', 4.5, 60, 'le', ''],
  ['parkour', 'Parkour', 'gym', 7, 60, 'le', 'freerun'],
  ['cirque', 'Arts du cirque', 'gym', 5, 90, 'les', 'acrobatie trapeze jonglage'],
  ['cheerleading', 'Cheerleading', 'gym', 6, 90, 'le', 'pom pom'],
  ['athletisme', 'Athlétisme', 'gym', 7, 90, 'l’', 'sprint saut lancer piste'],

  ['halterophilie', 'Haltérophilie', 'force', 6, 90, 'l’', 'arrache epaule jete weightlifting'],
  ['force-athletique', 'Force athlétique', 'force', 6, 90, 'la', 'powerlifting'],
  ['strongman', 'Strongman', 'force', 7, 90, 'le', ''],
  ['street-workout', 'Street workout', 'force', 5.5, 60, 'le', 'calisthenics barres'],
  ['bras-de-fer', 'Bras de fer', 'force', 3, 30, 'le', 'armwrestling'],

  ['golf', 'Golf', 'precision', 4.8, 240, 'le', ''],
  ['tir-arc', 'Tir à l’arc', 'precision', 4.3, 90, 'le', 'archery'],
  ['tir-sportif', 'Tir sportif', 'precision', 2.5, 60, 'le', 'carabine pistolet'],
  ['bowling', 'Bowling', 'precision', 3, 60, 'le', ''],
  ['petanque', 'Pétanque', 'precision', 2.5, 90, 'la', 'boules'],
  ['billard', 'Billard', 'precision', 2.5, 90, 'le', 'snooker'],
  ['flechettes', 'Fléchettes', 'precision', 2.5, 60, 'les', 'darts'],
  ['disc-golf', 'Disc golf', 'precision', 4, 90, 'le', 'frisbee golf'],

  ['equitation', 'Équitation', 'autre', 5.5, 60, 'l’', 'cheval'],
  ['karting', 'Karting', 'autre', 4, 30, 'le', 'kart'],
  ['moto-cross', 'Moto-cross', 'autre', 4, 60, 'le', 'motocross enduro'],
  ['paintball', 'Paintball', 'autre', 5, 60, 'le', ''],
  ['airsoft', 'Airsoft', 'autre', 5, 180, 'l’', ''],
  ['parapente', 'Parapente', 'autre', 3.5, 60, 'le', 'vol libre'],
];

// Sous-titre affiché sous le nom (sinon la catégorie) : la natation garde celui de l'app d'origine
const SUB = { natation: 'Technique' };
// Les plus pratiqués, en tête du catalogue
export const POPULAR = ['natation', 'course', 'football', 'velo-route', 'tennis', 'padel', 'basket', 'boxe', 'jjb', 'yoga', 'randonnee', 'escalade-salle'];

export const SPORTS = ROWS.map(([id, n, c, met, min, a, kw]) => ({
  id, n, c, met, min, a, sub: SUB[id] || SPORT_CATS[c].s,
  q: normalizeTxt(n + ' ' + kw + ' ' + SPORT_CATS[c].n),
}));
const BY_ID = new Map(SPORTS.map((s) => [s.id, s]));
export const SPORT_COUNT = SPORTS.length;

export function sportById(id) { return BY_ID.get(id) || null; }

export const INTENSITY = [
  { k: 0, n: 'Tranquille', f: 0.75 },
  { k: 1, n: 'Normale', f: 1 },
  { k: 2, n: 'Intense', f: 1.3 },
];
// Effort habituel proposé pour un sport créé
export const CUSTOM_MET = [['Léger', 3.5], ['Modéré', 5.5], ['Soutenu', 8]];

// Entrée du programme (ou de l'instantané d'une semaine) → tout ce qu'il faut pour l'afficher
export function sportOf(e) {
  const id = e && typeof e.id === 'string' ? e.id : '';
  const base = sportById(id);
  const int = e && (e.int === 0 || e.int === 2) ? e.int : 1;
  const days = e && Array.isArray(e.days) ? e.days : [];
  const gone = !!(e && e.gone);
  if (base) return { ...base, min: e.min > 0 ? e.min : base.min, int, days, gone, custom: false };
  const c = e && SPORT_CATS[e.c] ? e.c : 'autre';
  return { id, n: (e && typeof e.n === 'string' && e.n.trim()) || 'Sport', c, met: e && e.met > 0 ? e.met : 5.5,
    min: e && e.min > 0 ? e.min : 60, a: null, sub: SPORT_CATS[c].s, int, days, gone, custom: true, q: '' };
}

// Dépense en plus d'une journée de repos, arrondie à 50 kcal (au moins 50)
export function sportKcal(sp, weight = null, { min = sp.min, int = sp.int } = {}) {
  const kg = Number.isFinite(weight) && weight >= 30 && weight <= 250 ? weight : 75;
  const f = (INTENSITY[int] || INTENSITY[1]).f;
  const k = Math.max(0, sp.met * f - 1) * kg * (min / 60);
  return Math.max(50, Math.round(k / 50) * 50);
}

// « 45 min », « 1 h », « 1 h 30 »
export function fmtMin(m) {
  if (!(m > 0)) return '';
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60;
  return h + ' h' + (r ? ' ' + String(r).padStart(2, '0') : '');
}

// Nom dans une phrase : « natation », « VTT », « jiu-jitsu brésilien »
export function sportLower(sp) {
  const n = sp.n || '';
  if (sp.custom || /^[A-ZÀ-Ý]{2}/.test(n)) return n;
  return n.charAt(0).toLowerCase() + n.slice(1);
}
// Avec son article : « la natation », « l’escalade en salle », « les claquettes » ; sport créé : « Mon sport »
export function sportThe(sp) {
  if (!sp.a) return '« ' + sp.n + ' »';
  return sp.a + (sp.a.endsWith('’') ? '' : ' ') + sportLower(sp);
}

// Recherche : chaque mot tapé doit commencer un mot du nom, des mots-clés ou de la catégorie.
// Le nom qui commence par la recherche passe devant ; sinon l'ordre du catalogue.
export function searchSports(query, { c = '' } = {}) {
  const words = normalizeTxt(query).split(' ').filter(Boolean);
  const out = [];
  SPORTS.forEach((s, i) => {
    if (c && s.c !== c) return;
    let score = 0;
    if (words.length) {
      const toks = s.q.split(' ');
      if (!words.every((w) => toks.some((t) => t.startsWith(w)))) return;
      const name = normalizeTxt(s.n);
      score = name === words.join(' ') ? 3 : name.startsWith(words.join(' ')) ? 2 : words.every((w) => name.split(' ').some((t) => t.startsWith(w))) ? 1 : 0;
    }
    out.push({ s, score, i, pop: POPULAR.includes(s.id) ? 1 : 0 });
  });
  out.sort((a, b) => b.score - a.score || b.pop - a.pop || a.i - b.i);
  return out.map((o) => o.s);
}

// ---- Icônes (une par catégorie, même trait que les autres icônes de l'app) ----
const ICONS = {
  eau: '<path d="M3 10c1.6 0 1.6-1.4 3.2-1.4S7.8 10 9.4 10s1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4S20.6 10 21 10M3 15.5c1.6 0 1.6-1.4 3.2-1.4s1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4 1.4 1.4 1.8 1.4"/>',
  course: '<path d="M3.5 17.5h14.2c1.5 0 2.8-1.1 2.8-2.6 0-1.1-.7-2-1.7-2.4l-4.6-1.8-2.2-4.2-2.7 1.1-2.1-2.1-3.7 1.6z"/><path d="M9.6 9.9l1.6-.7M11 12.3l1.6-.7"/>',
  velo: '<circle cx="6" cy="16" r="3.6"/><circle cx="18" cy="16" r="3.6"/><path d="M6 16l3.8-6.8h5.8L18 16M9.8 9.2 13 16h1.8M14.6 6h2.6"/>',
  cardio: '<path d="M12 19.5s-7.5-4.4-7.5-9.7A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4c0 5.3-7.5 9.7-7.5 9.7z"/><path d="M7.5 12.3h2.6l1.4-2.2 1.8 4.2 1.4-2h1.8"/>',
  fitness: '<path d="M9 9.6V8a3 3 0 0 1 6 0v1.6"/><path d="M7.6 9.6h8.8a5.8 5.8 0 1 1-8.8 0z"/>',
  zen: '<path d="M12 18.6c-2.8-2.3-3.7-6-1.8-10.3.5-1.1 1.1-2 1.8-2.7.7.7 1.3 1.6 1.8 2.7 1.9 4.3 1 8-1.8 10.3z"/><path d="M12 18.6c-4.4.5-8-1.3-9.6-4.9 3.6-1.3 6.8-.4 9.6 2.7 2.8-3.1 6-4 9.6-2.7-1.6 3.6-5.2 5.4-9.6 4.9z"/>',
  combat: '<path d="M8 21v-3.6c-1.9-1.1-3-3.1-3-5.4V8.5A4.5 4.5 0 0 1 9.5 4h4.2A5.3 5.3 0 0 1 19 9.3v2.4c0 2.1-1 3.9-2.6 5V21z"/><path d="M8 17.4h8.4M5.1 11.4c1.5-1 3.6-.9 4.9.5"/>',
  collectif: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.4l3.1 2.3-1.2 3.6h-3.8l-1.2-3.6zM12 3.5v4.9M15.1 10.7l4.5-1.6M13.9 14.3l2.7 3.9M10.1 14.3l-2.7 3.9M8.9 10.7 4.4 9.1"/>',
  raquette: '<ellipse cx="14.2" cy="9.8" rx="5.2" ry="6.3" transform="rotate(45 14.2 9.8)"/><path d="M10.4 13.6 4 20M10.2 9.8l4 4M13.6 6.4l4 4"/>',
  neige: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.6 4.6 12 7l2.4-2.4M9.6 19.4 12 17l2.4 2.4M4.2 11.2l3.2.8-.8 3.2M19.8 12.8l-3.2-.8.8-3.2"/>',
  montagne: '<path d="M2.5 19.5 9.3 7.5l3.6 6 2.5-3.8 6.1 9.8z"/><path d="M7.4 10.8 9.3 12l1.8-1.3"/>',
  danse: '<path d="M9 17.5V6.3l10-2.3v11.2"/><circle cx="6.6" cy="17.6" r="2.4"/><circle cx="16.6" cy="15.3" r="2.4"/><path d="M9 9.6l10-2.3"/>',
  gym: '<path d="M8 3v7.2M16 3v7.2"/><circle cx="8" cy="14.8" r="4.3"/><circle cx="16" cy="14.8" r="4.3"/>',
  force: '<path d="M3 12h18M6.5 7.5v9M17.5 7.5v9M4.3 9.5v5M19.7 9.5v5"/>',
  precision: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  autre: '<circle cx="12" cy="14.6" r="5.4"/><path d="M8.6 3.5 12 9.2l3.4-5.7M12 12.4v4.4"/>',
};
export function sportIcon(sp, size = 20) {
  const c = sp && ICONS[sp.c] ? sp.c : 'autre';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${size <= 14 ? 2.2 : 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[c]}</svg>`;
}
export const SPORT_CAT_IDS = Object.keys(SPORT_CATS);
