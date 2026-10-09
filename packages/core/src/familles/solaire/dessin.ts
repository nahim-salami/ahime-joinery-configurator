/**
 * Pourquoi ce fichier existe : le trait des deux protections solaires. Il
 * vivait dans `fermetures/dessin.ts` le temps d'un lot, et il en est sorti
 * avec son groupe — un volet roulant n'a aucune raison de télécharger le
 * dessin d'un brise-soleil (voir l'en-tête de `familles/solaire.ts`).
 *
 * CE QUE CES DEUX ÉLÉVATIONS MONTRENT ET QU'AUCUNE AUTRE NE MONTRE : la
 * place que le produit prend AVANT d'être déployé. Un BSO relevé occupe la
 * hauteur de son linteau ; un screen plus large que sa laize porte des
 * coutures. Les deux se voient sur le mur, les deux décident d'un achat, et
 * les deux sont invisibles sur une fiche produit.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { JoineryConfiguration } from '../../types.ts';
import type { ElevationLine, ElevationRect } from '../../drawing.ts';
import { nombreDeLes } from './screen-zip.ts';
import { hexDeLaToile } from '../../toiles-de-store.ts';

/**
 * L'ÉLÉVATION D'UN BRISE-SOLEIL ORIENTABLE.
 *
 * Ce qu'il faut montrer et que personne ne montre : LE PAQUET DE LAMES en
 * tête. Un BSO relevé n'est pas un store invisible — il occupe la hauteur de
 * son linteau, et c'est cette hauteur-là qui décide s'il se pose. La
 * dessiner à part du tablier est le seul moyen de la faire voir.
 *
 * Les lames se dessinent à LEUR PAS RÉEL — 69 ou 93 mm. À cette échelle, la
 * différence entre les deux modèles se voit, et c'est le premier argument de
 * choix : moins de lames pour la même hauteur.
 */
export function elevationBso(
  config: JoineryConfiguration,
  rects: ElevationRect[],
  lines: ElevationLine[],
): void {
  const W = config.widthMm;
  const H = config.heightMm;
  const modele = config.modeleBso ?? 'lamisol-90';
  const pas = modele === 'lamisol-90' ? 93 : 69;
  // Le coffre reprend la hauteur de linteau du modèle : c'est la place que
  // le paquet de lames occupe, et elle est proportionnée à la hauteur.
  const coffre = modele === 'lamisol-90' ? 290 : 315;

  rects.push({ role: 'coffre', xMm: 0, yMm: 0, widthMm: W, heightMm: Math.min(coffre, H) });
  if (H <= coffre) return;

  // LES DEUX COULISSES. Elles guident les lames et tiennent le store au
  // vent — sans elles, la classe de vent de ce produit n'existerait pas.
  const coulisseMm = 30;
  rects.push({ role: 'coulisse', xMm: 0, yMm: coffre, widthMm: coulisseMm, heightMm: H - coffre });
  rects.push({
    role: 'coulisse',
    xMm: W - coulisseMm,
    yMm: coffre,
    widthMm: coulisseMm,
    heightMm: H - coffre,
  });

  rects.push({
    role: 'tablier',
    xMm: coulisseMm,
    yMm: coffre,
    widthMm: Math.max(0, W - 2 * coulisseMm),
    heightMm: H - coffre,
  });

  for (let y = coffre + pas; y < H - 1; y += pas) {
    lines.push({ role: 'lame', x1Mm: coulisseMm, y1Mm: y, x2Mm: W - coulisseMm, y2Mm: y });
  }
}

/**
 * L'ÉLÉVATION D'UN SCREEN ZIP.
 *
 * Ce qu'il faut montrer et qu'aucun configurateur ne montre : LES COUTURES.
 * Un screen plus large que sa laize est fait de plusieurs lés, la couture se
 * voit à contre-jour, et un store de fenêtre est toujours à contre-jour.
 * La règle l'annonce en toutes lettres ; le dessin la met à sa place réelle,
 * pour que le client sache OÙ elle passera.
 *
 * Les lés sont répartis à égalité plutôt que remplis pleine laize puis
 * complétés d'une chute : c'est ce que fait l'atelier, parce qu'une couture
 * centrée se regarde mieux qu'une couture à 200 mm du bord.
 */
export function elevationScreenZip(
  config: JoineryConfiguration,
  rects: ElevationRect[],
  lines: ElevationLine[],
): void {
  const W = config.widthMm;
  const H = config.heightMm;
  const coffre = 120;
  const coulisseMm = 25;
  const barreDeChargeMm = 45;

  rects.push({ role: 'coffre', xMm: 0, yMm: 0, widthMm: W, heightMm: Math.min(coffre, H) });
  if (H <= coffre) return;

  rects.push({ role: 'coulisse', xMm: 0, yMm: coffre, widthMm: coulisseMm, heightMm: H - coffre });
  rects.push({
    role: 'coulisse',
    xMm: W - coulisseMm,
    yMm: coffre,
    widthMm: coulisseMm,
    heightMm: H - coffre,
  });

  const gaucheMm = coulisseMm;
  const toileMm = Math.max(0, W - 2 * coulisseMm);
  // LA TOILE PORTE SA TEINTE — lot O9b : sur un screen, c'est elle qu'on
  // regarde, et elle décide de ce qu'on voit dehors.
  rects.push({
    role: 'toile',
    xMm: gaucheMm,
    yMm: coffre,
    widthMm: toileMm,
    heightMm: H - coffre,
    teinte: hexDeLaToile(config),
  });

  // LES COUTURES, à leur place réelle. Zéro couture sur un store d'un seul
  // lé — et le dessin doit alors être vierge, pas orné d'un trait décoratif.
  const toile = config.toileScreen ?? 'soltis-92';
  const les = nombreDeLes(toile, W);
  for (let i = 1; i < les; i += 1) {
    const x = gaucheMm + (toileMm * i) / les;
    lines.push({ role: 'rainure', x1Mm: x, y1Mm: coffre, x2Mm: x, y2Mm: H - barreDeChargeMm });
  }

  rects.push({
    role: 'lame-finale',
    xMm: gaucheMm,
    yMm: H - barreDeChargeMm,
    widthMm: toileMm,
    heightMm: barreDeChargeMm,
  });
}
