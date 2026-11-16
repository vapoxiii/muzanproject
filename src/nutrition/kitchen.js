// La cuisine de la Nutrition : son ambiance suit le soleil.
//   jour             du lever du soleil jusqu'à une heure avant son coucher
//   soir (coucher)   d'une heure avant le coucher à 40 minutes après
//   nuit             le reste
// Les heures du soleil sont calculées pour la date du jour (équation du lever du soleil), à la
// position de la France par défaut : en novembre, le coucher arrive vers 17 h ; en juin, vers 21 h 30.
// Une image manquante serait remplacée par celle du jour.
// Importé par le code d'origine sous le nom KIT (voir vite.config.js).
import JOUR from '../assets/img/cuisine/cuisine-jour.webp';
import SOIR from '../assets/img/cuisine/cuisine-soir.webp';
import NUIT from '../assets/img/cuisine/cuisine-nuit.webp';

// les trois images ont exactement le même cadrage (la balance, les bocaux au même endroit)
export const KITCHEN_IMAGES = { jour: JOUR, soir: SOIR, nuit: NUIT };

// centre de la France (les heures du soleil n'y varient que de quelques minutes d'une ville à l'autre)
export const FRANCE = { lat: 46.6, lon: 2.4 };
export const SOIR_AVANT = 60;   // minutes avant le coucher du soleil
export const SOIR_APRES = 40;   // minutes après

const RAD = Math.PI / 180;
const DAY = 86_400_000;
const sin = (d) => Math.sin(d * RAD), cos = (d) => Math.cos(d * RAD);

// Lever et coucher du soleil (UTC) pour le jour civil de `date` (heure du téléphone).
// Rend { rise, set } en Date, ou { polar: 'nuit' | 'jour' } là où le soleil ne se lève ou ne se couche pas.
export function sunTimes(date, { lat, lon } = FRANCE) {
  const noon = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const n = Math.round(noon / DAY + 2440587.5 - 2451545.0 + 0.0008);   // jours depuis le 1er janvier 2000, midi
  const Js = n - lon / 360;                                            // midi solaire moyen
  const M = (357.5291 + 0.98560028 * Js) % 360;                        // anomalie moyenne
  const C = 1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M);
  const L = (M + C + 180 + 102.9372) % 360;                            // longitude écliptique
  const transit = 2451545.0 + Js + 0.0053 * sin(M) - 0.0069 * sin(2 * L);
  const dec = Math.asin(sin(L) * sin(23.4397)) / RAD;                  // déclinaison
  const cosW = (sin(-0.833) - sin(lat) * sin(dec)) / (cos(lat) * cos(dec));
  if (cosW > 1) return { polar: 'nuit' };
  if (cosW < -1) return { polar: 'jour' };
  const w = Math.acos(cosW) / RAD;
  const toDate = (j) => new Date((j - 2440587.5) * DAY);
  return { rise: toDate(transit - w / 360), set: toDate(transit + w / 360) };
}

// Moment de la journée : 'jour', 'soir' (coucher de soleil) ou 'nuit'
export function momentAt(date = new Date(), where = FRANCE) {
  const s = sunTimes(date, where);
  if (s.polar) return s.polar;
  const t = date.getTime(), set = s.set.getTime();
  if (t >= set - SOIR_AVANT * 60_000 && t < set + SOIR_APRES * 60_000) return 'soir';
  if (t >= s.rise.getTime() && t < set) return 'jour';
  return 'nuit';
}

// Image à montrer pour ce moment (celle du jour tant que les autres ne sont pas là) et son ambiance
export function kitchenFor(date = new Date(), where = FRANCE, images = KITCHEN_IMAGES) {
  const moment = momentAt(date, where);
  const ambiance = images[moment] ? moment : 'jour';
  return { moment, ambiance, src: images[ambiance] };
}

// Prochain changement d'ambiance, pour mettre la cuisine à jour pile à l'heure
export function nextChange(date = new Date(), where = FRANCE) {
  const s = sunTimes(date, where);
  if (s.polar) return null;
  const t = date.getTime();
  const marks = [s.rise.getTime(), s.set.getTime() - SOIR_AVANT * 60_000, s.set.getTime() + SOIR_APRES * 60_000].filter((m) => m > t);
  return marks.length ? new Date(Math.min(...marks)) : null;
}
