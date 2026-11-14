// Réponse à une photo de repas : les aliments vus, chacun avec sa quantité à choisir
export const PLATE = { nom: 'Poulet, riz et brocolis', aliments: [
  { n: 'Riz blanc cuit', sur: true, q: 'Quelle quantité de riz ?', options: [{ l: '100 g', k: 130, p: 2.7, gluc: 28, lip: 0.3 }, { l: '150 g', k: 195, p: 4, gluc: 42, lip: 0.5 }, { l: '220 g', k: 286, p: 5.9, gluc: 62, lip: 0.7 }], slider: { unit: 'g', min: 30, max: 400, step: 10, k_per_unit: 1.3, p_per_unit: 0.027, gluc_per_unit: 0.28, lip_per_unit: 0.003, default: 150 } },
  { n: 'Blanc de poulet grillé', sur: true, q: 'Quelle quantité de poulet ?', options: [{ l: '100 g', k: 165, p: 31, gluc: 0, lip: 3.6 }, { l: '140 g', k: 231, p: 43, gluc: 0, lip: 5 }, { l: '200 g', k: 330, p: 62, gluc: 0, lip: 7.2 }] },
  { n: 'Brocolis vapeur', sur: true, q: 'Quelle quantité de brocolis ?', options: [{ l: '60 g', k: 21, p: 1.7, gluc: 2.4, lip: 0.2 }, { l: '100 g', k: 35, p: 2.8, gluc: 4, lip: 0.4 }, { l: '150 g', k: 52, p: 4.2, gluc: 6, lip: 0.6 }] },
  { n: 'Huile ou beurre de cuisson', sur: false, q: 'Quelle matière grasse ?', options: [{ l: 'Aucune', k: 0, p: 0, gluc: 0, lip: 0 }, { l: '1 c. à café', k: 45, p: 0, gluc: 0, lip: 5 }, { l: '1 c. à soupe', k: 90, p: 0, gluc: 0, lip: 10 }] },
] };
