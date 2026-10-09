/**
 * Pourquoi ce fichier existe : LES FERRURES D'UN VOLET BATTANT n'ont qu'un
 * lecteur, le volume du groupe des fermetures — lot D16c.
 *
 * Elles vivaient dans `geometrie/quincaillerie.ts`, avec la béquille, la
 * paumelle et la barre de tirage que `geometry3d.ts` pose sur toute
 * menuiserie. Quand le bloc du volet battant a quitté ce morceau commun, les
 * laisser là aurait fait IMPORTER la trousse par deux morceaux — le volume
 * commun et celui du groupe —, et Rollup l'aurait extraite dans un troisième,
 * rangé dans la base que paie tout visiteur. C'est exactement ce que le lot
 * D16b a mesuré sur le store banne : **sortir un bloc qui partage une trousse
 * avec ce qu'il quitte ne rend rien**. Ce qui n'a qu'un lecteur descend avec
 * lui.
 *
 * Le code est DÉPLACÉ, pas réécrit : les cotes du serrurier, les pentures
 * appointies, le gond qui s'enfonce vers le tableau, l'espagnolette et la
 * bergère sont ceux du lot où ils ont été posés, et
 * `volume-des-fermetures-epingle.test.ts` épingle leurs maillages au
 * millimètre.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import {
  ajouterCylindre,
  ajouterCylindreEntre,
  ajouterPaveOriente,
  extruder,
  type Maillage,
  type Point2,
  type Point3,
} from '../../geometrie/maillage.ts';

const FERRURE_VOLET = {
  pentureLargeur: 40,
  pentureEpaisseur: 6,
  /** La part de la largeur du battant que la penture couvre. */
  penturePart: 0.78,
  /** Le nœud roulé qui coiffe le gond, au bout de la penture. */
  noeudRayon: 11,
  noeudHauteur: 34,
  gondRayon: 9,
  gondScellement: 90,
  espagnoletteRayon: 8,
  espagnoletteBequille: 96,
  arretPlatine: 46,
  arretCrochet: 62,
};

/**
 * Une PENTURE de volet — la barre plate qui porte le battant et qui pivote
 * sur son gond. Elle se pose sur la face de la RUE, à plat, et son bout
 * libre est appointi : la pointe n'est pas décorative, elle évite d'arrêter
 * le fer net sur une planche qui travaille.
 *
 * `sens` vaut −1 quand les gonds sont à gauche (la penture part vers la
 * droite) et +1 dans l'autre cas.
 *
 * Solution écartée : une charnière à deux ailes, comme sur une porte
 * d'entrée. Un volet ne se ferre pas ainsi — il se pose sur des GONDS
 * scellés dans le tableau, et c'est ce qui permet de le dégonder pour le
 * repeindre.
 */
export function ajouterPenture(
  maillage: Maillage,
  ancrage: Point3,
  sens: 1 | -1,
  longueur: number,
): void {
  const l = FERRURE_VOLET.pentureLargeur;
  const e = FERRURE_VOLET.pentureEpaisseur;
  const pointe = Math.min(longueur * 0.22, 90);
  // La lame, vue de face : un rectangle qui s'affine en pointe au bout.
  const profil: Point2[] = [
    [0, -l / 2],
    [longueur - pointe, -l / 2],
    [longueur, -l * 0.16],
    [longueur, l * 0.16],
    [longueur - pointe, l / 2],
    [0, l / 2],
  ].map(([u, v]) => [ancrage.xMm + sens * u, ancrage.yMm + v] as Point2);
  extruder(maillage, profil, 'z', { debut: ancrage.zMm - e, fin: ancrage.zMm });

  // Le NŒUD : le cylindre roulé au bout de la penture, qui coiffe le gond.
  ajouterCylindre(
    maillage,
    { xMm: ancrage.xMm, yMm: ancrage.yMm, zMm: ancrage.zMm - e / 2 },
    'y',
    FERRURE_VOLET.noeudRayon,
    FERRURE_VOLET.noeudHauteur,
    12,
  );
}

/**
 * Un GOND — le fer scellé dans le tableau sur lequel la penture vient se
 * poser. Deux branches : une queue horizontale qui entre dans la maçonnerie
 * et une broche verticale qui reçoit le nœud.
 */
export function ajouterGond(maillage: Maillage, ancrage: Point3, sens: 1 | -1): void {
  const r = FERRURE_VOLET.gondRayon;
  // La queue de scellement, enfoncée vers le mur.
  ajouterCylindreEntre(
    maillage,
    { xMm: ancrage.xMm + sens * FERRURE_VOLET.gondScellement, yMm: ancrage.yMm, zMm: ancrage.zMm },
    { xMm: ancrage.xMm, yMm: ancrage.yMm, zMm: ancrage.zMm },
    r,
    10,
  );
  // La broche verticale — celle qui porte réellement le volet.
  ajouterCylindre(
    maillage,
    { xMm: ancrage.xMm, yMm: ancrage.yMm + FERRURE_VOLET.noeudHauteur * 0.2, zMm: ancrage.zMm },
    'y',
    r * 0.85,
    FERRURE_VOLET.noeudHauteur * 1.35,
    10,
  );
}

/**
 * L'ESPAGNOLETTE — la tringle verticale qui ferme un volet battant, et sa
 * béquille. Elle court sur toute la hauteur du battant et vient se crocher
 * en haut et en bas : c'est ce qui distingue un volet qui FERME d'un volet
 * simplement poussé.
 *
 * Elle est sur la face INTÉRIEURE — celle de la fenêtre. On ne ferme pas
 * ses volets depuis la rue.
 */
export function ajouterEspagnolette(
  maillage: Maillage,
  ancrage: Point3,
  hauteur: number,
  sens: 1 | -1,
): void {
  const r = FERRURE_VOLET.espagnoletteRayon;
  ajouterCylindre(maillage, ancrage, 'y', r, hauteur, 12);
  // Les deux crochets d'about, haut et bas.
  for (const signe of [1, -1] as const) {
    ajouterCylindreEntre(
      maillage,
      { xMm: ancrage.xMm, yMm: ancrage.yMm + (signe * hauteur) / 2, zMm: ancrage.zMm },
      {
        xMm: ancrage.xMm + sens * 34,
        yMm: ancrage.yMm + (signe * hauteur) / 2,
        zMm: ancrage.zMm + 14,
      },
      r * 0.8,
      8,
    );
  }
  // La béquille, à mi-hauteur, qui retombe — comme celle d'une fenêtre.
  ajouterCylindre(
    maillage,
    { xMm: ancrage.xMm, yMm: ancrage.yMm, zMm: ancrage.zMm + 22 },
    'z',
    r * 1.6,
    44,
    12,
  );
  ajouterPaveOriente(
    maillage,
    {
      xMm: ancrage.xMm + sens * FERRURE_VOLET.espagnoletteBequille * 0.34,
      yMm: ancrage.yMm - FERRURE_VOLET.espagnoletteBequille * 0.3,
      zMm: ancrage.zMm + 40,
    },
    { xMm: FERRURE_VOLET.espagnoletteBequille, yMm: 17, zMm: 15 },
    sens * -0.72,
  );
}

/**
 * L'ARRÊT DE VOLET, que le métier appelle la BERGÈRE — le crochet scellé en
 * façade qui retient le battant ouvert contre le mur. Sans lui, le premier
 * coup de vent claque le volet contre la fenêtre, et c'est le vitrage qui
 * paie.
 *
 * Il se pose sur le MUR, à hauteur d'appui, en dehors du tableau — donc au
 * large du battant ouvert.
 */
export function ajouterArretVolet(maillage: Maillage, ancrage: Point3, sens: 1 | -1): void {
  const platine = FERRURE_VOLET.arretPlatine;
  // La platine scellée, un disque plat contre la façade.
  ajouterCylindre(maillage, ancrage, 'z', platine / 2, 10, 14);
  // Le crochet : une tige qui sort du mur, puis se relève en S.
  const sortie = { xMm: ancrage.xMm, yMm: ancrage.yMm, zMm: ancrage.zMm - FERRURE_VOLET.arretCrochet };
  ajouterCylindreEntre(maillage, ancrage, sortie, 7, 10);
  ajouterCylindreEntre(
    maillage,
    sortie,
    { xMm: ancrage.xMm + sens * 30, yMm: ancrage.yMm + 26, zMm: sortie.zMm - 12 },
    6,
    10,
  );
}
