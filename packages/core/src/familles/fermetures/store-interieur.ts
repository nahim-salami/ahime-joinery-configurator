/**
 * Pourquoi ce fichier existe : le vénitien est le store intérieur le plus
 * vendu d'Europe, et ce catalogue ne connaissait que le store BANNE — celui
 * qu'on déroule au-dessus d'une terrasse. Ce ne sont pas deux tailles du
 * même produit.
 *
 * SA LISTE DE DIFFÉRENCES avec le store banne, avec lequel il partage un
 * mot et rien d'autre :
 *
 *   1. IL EST DEDANS. Pas de vent, pas de capteur, pas de bras articulé,
 *      pas d'avancée. Toutes les règles du store banne — la prise au vent,
 *      la classe de résistance, la longueur de bras — n'ont aucun sens ici.
 *   2. IL SE MESURE SUR LA FENÊTRE, pas sur la façade, et de deux façons
 *      qui ne donnent pas les mêmes chiffres : EN TABLEAU (dans
 *      l'embrasure, on perd la largeur des supports) ou EN APPLIQUE (sur le
 *      mur, on déborde de chaque côté pour éviter le jour latéral).
 *   3. SON PRODUIT EST SON TYPE. Un vénitien à lames orientables, un
 *      enrouleur à toile, un californien à bandes verticales, un plissé :
 *      quatre mécanismes, quatre prix, quatre façons d'occulter.
 *   4. SA TOILE DÉCIDE DE CE QU'IL FAIT. Occultant, tamisant ou screen —
 *      et un screen n'occulte PAS : il filtre. Un client qui commande un
 *      screen pour une chambre commande la mauvaise chose, et c'est la
 *      première réclamation du métier.
 *
 * Source : `ressources/donnees/familles-a-venir.json` — lames 15 à 50,
 * caissons 25 × 25 et 57 × 51, tubes 25 à 50, bandes 89 et 127.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { FamilleCatalog, PricingCatalog } from '../../catalog.ts';
import type { JoineryConfiguration, ValidationIssue } from '../../types.ts';

// LES TYPES, LES TOILES ET LES LAMES ONT REMONTÉ au lot O9a, dans
// `types-de-moustiquaire-et-de-store.ts`, pour la raison du lot MT5 : l'écran
// ici — le screen qui n'occulte pas, le caisson d'un vénitien.
export {
  LAMES_VENITIEN,
  TOILES,
  TYPES_STORE_INTERIEUR,
  type Toile,
  type TypeStoreInterieur,
} from '../../types-de-moustiquaire-et-de-store.ts';
import {
  LAMES_VENITIEN,
  TOILES,
  type Toile,
  type TypeStoreInterieur,
} from '../../types-de-moustiquaire-et-de-store.ts';

/**
 * LE DÉBORDEMENT en pose applique, par côté, en mm.
 *
 * Sans lui, le jour passe entre le store et le mur — et c'est précisément
 * ce qu'on venait empêcher. Soixante-dix millimètres est ce que le métier
 * applique ; en tableau, il n'y en a pas, mais on perd la place des
 * supports.
 */
export const DEBORDEMENT_APPLIQUE_MM = 70;
/** Ce que les supports mangent en pose tableau, par côté. */
export const SUPPORT_TABLEAU_MM = 10;

export const CATALOGUE_STORE_INTERIEUR: FamilleCatalog = {
  label: 'Store intérieur',
  matrices: {
    '1': {
      widthsMm: [600, 1000, 1400, 1800, 2400],
      heightsMm: [1000, 1500, 2000, 2500],
      cellsCents: [
        [6200, 7800, 9600, 11800, 15100],
        [7100, 8900, 11000, 13500, 17300],
        [8100, 10200, 12600, 15400, 19800],
        [9200, 11600, 14300, 17500, 22500],
      ],
    },
  },
  bornes: {
    minWidthMm: 300,
    minHeightMm: 300,
    vantauxMin: 1,
    vantauxMax: 1,
    vantailMinMm: 300,
    vantailMaxMm: { alu: 3000, bois: 2400, pvc: 2400 },
  },
  coefMateriauMilliemes: { alu: 1000, bois: 1350, pvc: 900 },
  // PAS DE VITRAGE : un store est DEVANT la fenêtre, il n'en est pas une.
  vitree: false,
  frameBandMm: { alu: 25, bois: 30, pvc: 25 },
};

/**
 * LES REMARQUES D'UN STORE INTÉRIEUR. Presque aucune n'est un refus : un
 * store se pose partout. Ce qu'on refuse, c'est de laisser un client
 * acheter un screen pour sa chambre.
 */
export function reglesStoreInterieur(contexte: {
  config: JoineryConfiguration;
  catalog: PricingCatalog;
}): ValidationIssue[] {
  const { config } = contexte;
  if (config.famille !== 'store-interieur') return [];
  const issues: ValidationIssue[] = [];

  const type = config.typeStoreInterieur ?? 'venitien';
  const toile = config.toileStore;

  // --- LE SCREEN QUI N'OCCULTE PAS. La première réclamation du métier.
  if (type === 'enrouleur' && toile && !TOILES[toile].occulte) {
    issues.push({
      code: 'toile-non-occultante',
      severite: 'avertissement',
      message:
        `Toile ${TOILES[toile].nom.toLowerCase()} : elle N’OCCULTE PAS. ${TOILES[toile].argument} ` +
        'Pour une chambre, c’est un occultant qu’il faut — et la différence ne se voit qu’une ' +
        'fois posé, au premier matin.',
      alternative: { label: 'Passer en toile occultante', patch: { toileStore: 'occultant' } },
    });
  }

  // --- LA COTE DE POSE. Deux façons, deux chiffres différents.
  const applique = config.pose === 'renovation';
  issues.push({
    code: 'store-cote-de-pose',
    severite: 'info',
    message: applique
      ? `Pose EN APPLIQUE : le store déborde de ${DEBORDEMENT_APPLIQUE_MM} mm de chaque côté, ` +
        'sinon le jour passe entre lui et le mur — ce qu’on venait justement empêcher. ' +
        `Largeur commandée : ${config.widthMm + 2 * DEBORDEMENT_APPLIQUE_MM} mm.`
      : `Pose EN TABLEAU : les supports mangent ${SUPPORT_TABLEAU_MM} mm de chaque côté. ` +
        `Largeur de toile utile : ${Math.max(0, config.widthMm - 2 * SUPPORT_TABLEAU_MM)} mm — ` +
        'un jour latéral reste, c’est le prix de la pose encastrée.',
  });

  // --- LE CAISSON D'UN VÉNITIEN. Une lame de 50 ne se range pas dans un
  // caisson de 25 : c'est de la géométrie, pas une préférence.
  if (type === 'venitien') {
    const lame = config.lameStoreMm ?? 25;
    const retenue =
      LAMES_VENITIEN.find((candidate) => candidate.largeurMm === lame) ?? LAMES_VENITIEN[2];
    issues.push({
      code: 'venitien-caisson',
      severite: 'info',
      message:
        `Lames de ${retenue.largeurMm} mm, caisson de ${retenue.caissonMm} mm. ` +
        (retenue.largeurMm >= 50
          ? 'Une lame de 50 se range dans un caisson de 57 : prévoyez la place au-dessus.'
          : 'Le caisson tient dans l’épaisseur d’un dormant courant.'),
    });
  }

  return issues;
}
