/**
 * Pourquoi ce fichier existe : LE CHARGEMENT INITIAL A BESOIN DE LA SPIRALE,
 * ET IL N'A AUCUN BESOIN DES PROFILÉS — lot O10.
 *
 * `hauteurCoffreMm()` vivait dans `geometrie/profils.ts`, six cent quatre-vingts
 * lignes de sections de profilés, de faces de vitrage et de galbes : un module
 * de DESSIN, donc paresseux, donc gratuit. Le lot O10 a fait lire la spirale
 * par `structural.ts` — qui est dans l'entrée, puisque le prix, la thermique et
 * la validation lisent tous trois la cote de vantail. **MESURÉ : 93 651 octets
 * gzippés pour 92 672, dépassement de 979.** Tout visiteur venu configurer une
 * fenêtre téléchargeait les sections de profilé pour trois lignes de racine
 * carrée.
 *
 * C'est la coupure du lot MT5, appliquée une neuvième fois : **la DÉCLARATION
 * remonte, la RÈGLE reste.** Ce qui remonte ici est le calcul du diamètre
 * d'enroulement et les quatre tailles du commerce — ce dont l'entrée a besoin
 * pour savoir ce que le coffre d'un bloc-baie prend sur la hauteur. Ce qui
 * reste en bas est tout le reste : le profil plat, les faces de vitrage, les
 * galbes, la lame finale et la coulisse, que seul un dessin lit.
 *
 * `profils.ts` RÉEXPORTE les trois symboles, pour que ses lecteurs de dessin
 * n'aient pas deux endroits à connaître ; l'entrée, elle, lit ce fichier
 * DIRECTEMENT — sans quoi la réexportation ramènerait le module entier et la
 * coupure ne couperait rien.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

/**
 * LA HAUTEUR D'UNE LAME de volet roulant, en mm — la VRAIE.
 *
 * Quarante et un millimètres : c'est la lame courante du PVC comme de
 * l'aluminium domestique. Les grandes lames de 55 existent, et les 77 sont
 * celles d'une porte de garage enroulable — pas d'un volet de fenêtre.
 *
 * Elle était écrite en dur dans le calcul du coffre, et le DESSIN en utilisait
 * une autre de son côté. Deux nombres pour la même pièce dans la même famille :
 * celui qui calcule le coffre et celui qui trace les lames ne parlaient pas du
 * même volet. La cote vit à un seul endroit, et le dessin dit explicitement
 * quand il s'en écarte, et pourquoi.
 */
export const LAME_VOLET_ROULANT_MM = 41;

/** Le tube d'enroulement octogonal, en mm — le standard domestique. */
export const TUBE_VOLET_MM = 60;

/**
 * LA HAUTEUR DU COFFRE d'un volet roulant, calculée depuis le DIAMÈTRE
 * D'ENROULEMENT — jamais depuis une fraction de la hauteur.
 *
 * Un tablier ne « rentre » pas dans son coffre : il s'ENROULE sur un tube, et
 * le rouleau grossit avec la longueur enroulée. C'est ce diamètre-là qui décide
 * de la hauteur du caisson, et c'est pourquoi le métier vend des coffres en
 * 165, 180, 205 et 250 — quatre tailles, pas un continuum.
 *
 * Solution écartée : `min(250, max(150, hauteur × 0,12))`. Elle donnait un
 * coffre qui grandit régulièrement avec la baie, ce qui est vrai en gros ; mais
 * elle plaçait un coffre de 168 mm sur un tablier de 2,20 m, là où le rouleau
 * seul en mesure 207. Le poseur voit l'erreur en arrivant sur le chantier — le
 * caisson commandé ne referme pas.
 *
 * Le calcul : le rouleau est une spirale, sa section vaut celle du tablier
 * déroulé. `D = √(Dtube² + 4·L·e/π)` où `L` est la longueur de tablier et `e`
 * l'épaisseur d'une lame. Trente millimètres de garde au-dessus, puis on prend
 * la taille de coffre commercialisée immédiatement supérieure.
 */
export function hauteurCoffreMm(
  hauteurTablierMm: number,
  options: { lameMm?: number; epaisseurLameMm?: number; tubeMm?: number } = {},
): number {
  const lame = options.lameMm ?? LAME_VOLET_ROULANT_MM;
  const epaisseur = options.epaisseurLameMm ?? (lame >= 50 ? 13 : 9);
  const tube = options.tubeMm ?? TUBE_VOLET_MM;
  const longueur = Math.max(0, hauteurTablierMm);
  const diametre = Math.sqrt(tube * tube + (4 * longueur * epaisseur) / Math.PI);
  const besoin = diametre + 30;
  // Les tailles du commerce. Au-delà, on rend le besoin brut : c'est un
  // coffre hors catalogue, et mieux vaut une cote juste qu'une cote ronde.
  for (const taille of [165, 180, 205, 250]) if (besoin <= taille) return taille;
  return Math.round(besoin);
}
