/**
 * Pourquoi ce fichier existe : le TRACÉ des onze formes pesait deux
 * kilo-octets et demi dans le chargement initial, et une menuiserie
 * RECTANGULAIRE — l'écrasante majorité de ce qui se configure — n'en lit
 * pas une ligne. Séparer le tracé des UTILITAIRES de polygone (`formes.ts`,
 * qui reste dans l'entrée parce que l'offset et la boîte servent à tout)
 * est ce qui permet à Rollup de le laisser dans le morceau de la famille.
 *
 * Solution écartée : garder les onze formes dans `formes.ts` et compter sur
 * le secouage d'arbre. C'est ce qu'on a essayé d'abord, et le budget n'a pas
 * bougé d'un octet : `formes.ts` est importé par l'entrée ET par les
 * familles, donc Rollup le place ENTIER dans le morceau partagé. Le module
 * est l'unité de découpe, pas la fonction.
 *
 * Incident fondateur : le lot « physique » (mécanique + acoustique) a fait
 * passer le chargement initial à 95,4 ko pour un budget de 95,0. La couture
 * était nommée depuis le lot 7.5 ; c'est ce jour-là qu'elle a dû rendre.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { Point2 } from './maillage.ts';
import {
  EPAULE_CHAPEAU,
  airePolygoneElevation,
  flecheEffective,
  type Forme,
} from './formes.ts';

/**
 * Le pas de discrétisation d'un arc, en degrés. 4° donne 45 segments sur un
 * demi-cercle : à l'échelle d'une fenêtre affichée sur un écran, la corde
 * s'écarte de l'arc de moins d'un dixième de millimètre.
 */
const PAS_DEGRES = 4;

function arc(
  centre: Point2,
  rayonX: number,
  rayonY: number,
  angleDepart: number,
  angleFin: number,
): Point2[] {
  const etendue = Math.abs(angleFin - angleDepart);
  const segments = Math.max(2, Math.ceil((etendue * 180) / Math.PI / PAS_DEGRES));
  const angles: number[] = [];
  for (let index = 0; index <= segments; index++) {
    angles.push(angleDepart + ((angleFin - angleDepart) * index) / segments);
  }
  // Les EXTREMUMS de l'arc — les quatre quadrants — doivent être des
  // sommets, sinon la corde passe en deçà et la boîte du contour rétrécit :
  // un plein cintre de 1600 mm de haut sortait à 1599,63 mm, et le sommet
  // de l'arc n'était plus le sommet. Un tiers de millimètre, mais sur la
  // cote qui part à l'atelier.
  const bas = Math.min(angleDepart, angleFin);
  const haut = Math.max(angleDepart, angleFin);
  for (let quart = Math.ceil(bas / (Math.PI / 2)); quart * (Math.PI / 2) <= haut; quart++) {
    angles.push(quart * (Math.PI / 2));
  }
  angles.sort((a, b) => (angleFin >= angleDepart ? a - b : b - a));
  const points: Point2[] = [];
  for (const angle of angles) {
    const point: Point2 = [
      centre[0] + Math.cos(angle) * rayonX,
      centre[1] + Math.sin(angle) * rayonY,
    ];
    const dernier = points[points.length - 1];
    if (dernier && Math.hypot(point[0] - dernier[0], point[1] - dernier[1]) < 1e-7) continue;
    points.push(point);
  }
  return points;
}

/**
 * Le contour extérieur d'une menuiserie, en coordonnées d'élévation. Le
 * polygone est parcouru dans le sens des aiguilles d'une montre à l'écran
 * (y vers le bas), et son premier point est le coin bas-gauche pour toutes
 * les formes ouvertes — c'est la convention que `decouperBande()` et
 * `offsetContour()` supposent.
 */
export function contourForme(
  forme: Forme,
  widthMm: number,
  heightMm: number,
  flecheMm?: number,
  coteBas: 'gauche' | 'droite' = 'gauche',
): Point2[] {
  const W = widthMm;
  const H = heightMm;
  const f = flecheEffective(forme, W, H, flecheMm);

  return orienter(contourBrut(forme, W, H, f, coteBas));
}

/**
 * Tous les contours sortent dans le MÊME sens — horaire à l'écran, aire
 * signée positive. `offsetContour()` en dépend, et un cercle construit à
 * l'envers rendait un dormant qui grossissait au lieu de rentrer.
 */
function orienter(points: Point2[]): Point2[] {
  return airePolygoneElevation(points) < 0 ? [...points].reverse() : points;
}

function contourBrut(
  forme: Forme,
  W: number,
  H: number,
  f: number,
  coteBas: 'gauche' | 'droite',
): Point2[] {
  if (forme === 'rond' || forme === 'ovale') {
    // Fermée sur elle-même : ni montant ni traverse, un seul développé.
    const rayonX = forme === 'rond' ? Math.min(W, H) / 2 : W / 2;
    const rayonY = forme === 'rond' ? Math.min(W, H) / 2 : H / 2;
    // Le cercle est parcouru en sens horaire à l'écran, comme les autres.
    const points = arc([W / 2, H / 2], rayonX, rayonY, Math.PI, -Math.PI);
    points.pop(); // le dernier point rejoint le premier
    return points;
  }

  if (forme === 'trapeze') {
    const gauche = coteBas === 'gauche' ? f : 0;
    const droite = coteBas === 'gauche' ? 0 : f;
    return [
      [0, H],
      [0, gauche],
      [W, droite],
      [W, H],
    ];
  }

  if (forme === 'chevron') {
    // LE CHEVRON EST LE TRIANGLE. Deux pans droits qui se rejoignent au
    // milieu, au-dessus de deux épaules — c'est exactement le contour du
    // triangle de pignon, et le redessiner serait une duplication sans
    // comparateur (docs/11 §2.6).
    //
    // Ce qui les sépare n'est pas la géométrie mais la PROPORTION et le
    // NOM : un pignon monte à 45 % de sa hauteur et s'appelle triangle, un
    // les vend séparément parce qu'un client ne cherche pas « triangle de
    // qu'un contour, et un test l'exige.
    return contourBrut('triangle', W, H, f, coteBas);
  }

  if (forme === 'chapeau-de-gendarme') {
    // Le sommet ne part PAS des angles : il naît d'une traverse droite —
    // l'épaule. C'est tout ce qui sépare un chapeau de gendarme d'un
    // surbaissé, et c'est ce qu'on reconnaît de la rue.
    const epaule = W * EPAULE_CHAPEAU;
    const demi = (W - 2 * epaule) / 2;
    const rayon = (f * f + demi * demi) / (2 * f);
    const centre: Point2 = [W / 2, rayon];
    let angleGauche = Math.atan2(f - rayon, -demi);
    const angleDroit = Math.atan2(f - rayon, demi);
    if (angleGauche > angleDroit) angleGauche -= 2 * Math.PI;
    const sommet = arc(centre, rayon, rayon, angleGauche, angleDroit);
    return [[0, H], [0, f], ...sommet, [W, f], [W, H]];
  }

  if (forme === 'concave') {
    // courbe creuse vers le bas.
    //
    // LA HAUTEUR COMMANDÉE EST LE HORS-TOUT, ici comme partout ailleurs au
    // son contour. Sur un concave le point haut est aux bords, sur un
    // chapeau de gendarme il est au milieu — la convention ne change pas
    // pour autant, c'est la forme qui déplace son sommet.
    //
    // La cote qui s'en déduit et qui intéresse le décor est autre : la
    // hauteur AU DROIT DU PILIER (`hauteurAuxBordsMm`), celle sur laquelle
    // le maçon arase son fût. Une note d'une phrase disait ici « c'est aux
    // seul concave : le décor l'a crue, et arasait ses piliers 530 mm au
    // dessus d'un chapeau de gendarme.
    const demi = W / 2;
    const rayon = (f * f + demi * demi) / (2 * f);
    const centre: Point2 = [W / 2, f - rayon];
    const angleGauche = Math.atan2(-centre[1], -demi);
    const angleDroit = Math.atan2(-centre[1], demi);
    const creux = arc(centre, rayon, rayon, angleGauche, angleDroit);
    return [[0, H], ...creux, [W, H]];
  }

  if (forme === 'triangle') {
    const montant = Math.max(0, H - f);
    const points: Point2[] = [[0, H]];
    if (montant < H) points.push([0, H - montant]);
    points.push([W / 2, 0]);
    if (montant < H) points.push([W, H - montant]);
    points.push([W, H]);
    return points;
  }

  if (forme === 'plein-cintre' || forme === 'surbaisse') {
    // Un arc de cercle passant par (0, f), (W/2, 0) et (W, f). Son rayon
    // sort de la corde et de la montée : R = (f² + (W/2)²) / 2f.
    const demiCorde = W / 2;
    const rayon = (f * f + demiCorde * demiCorde) / (2 * f);
    const centreY = f + (rayon - f); // = rayon, mesuré depuis le sommet
    const centre: Point2 = [W / 2, centreY];
    // Le sommet est du côté des y DÉCROISSANTS, donc à l'angle −π/2 : le
    // balayage doit passer par là. Sans ce recadrage, `atan2` rend +π à
    // gauche pour un plein cintre et l'arc partait vers le BAS — la
    // fenêtre sortait en demi-lune posée à l'envers.
    let angleGauche = Math.atan2(f - centreY, -demiCorde);
    const angleDroit = Math.atan2(f - centreY, demiCorde);
    if (angleGauche > angleDroit) angleGauche -= 2 * Math.PI;
    const sommet = arc(centre, rayon, rayon, angleGauche, angleDroit);
    return [[0, H], ...sommet, [W, H]];
  }

  if (forme === 'anse-de-panier') {
    return [[0, H], ...anseDePanier(W, f), [W, H]];
  }

  return [
    [0, H],
    [0, 0],
    [W, 0],
    [W, H],
  ];
}

/**
 * L'anse de panier à TROIS CENTRES — le tracé du compagnon, pas une demi-
 * ellipse. Deux petits arcs aux naissances, un grand arc au sommet ; les
 * tangentes sont continues aux raccords, ce qui est exactement la
 * différence visible entre une anse de panier et une ellipse aplatie.
 *
 * Solution écartée : une demi-ellipse. Elle se code en trois lignes, mais
 * son rayon de courbure varie sans cesse — un profilé cintré ainsi devrait
 * changer de réglage à chaque millimètre. Le tracé à trois centres, lui, se
 * fabrique avec trois réglages.
 */
function anseDePanier(widthMm: number, flecheMm: number): Point2[] {
  const a = widthMm / 2;
  const b = flecheMm;
  if (b >= a * 0.999) {
    // Montée égale à la demi-largeur : c'est un plein cintre, pas une anse.
    return arc([a, a], a, a, Math.PI, 0).map(([x, y]) => [x, a - (a - y)] as Point2);
  }
  // Repère de tracé : origine au milieu de la ligne de naissance, y vers le
  // HAUT — celui du compagnon. On revient aux coordonnées d'élévation à la
  // fin, une seule fois.
  const r = Math.max(1, Math.min(b * 0.6, a * 0.5));
  const R = ((a - r) * (a - r) + b * b - r * r) / (2 * (b - r));

  const centreGrand: Point2 = [0, b - R];
  const centrePetitGauche: Point2 = [-a + r, 0];
  const centrePetitDroit: Point2 = [a - r, 0];

  // Le raccord est sur la droite des centres : tangentes continues, donc
  // un profilé qui ne change de réglage de cintrage que deux fois.
  const angleVers = (de: Point2, vers: Point2) =>
    Math.atan2(vers[1] - de[1], vers[0] - de[0]);
  const versGauche = angleVers(centreGrand, centrePetitGauche);
  const versDroit = angleVers(centreGrand, centrePetitDroit);

  const petitGauche = arc(centrePetitGauche, r, r, Math.PI, versGauche);
  const grand = arc(centreGrand, R, R, versGauche, versDroit);
  const petitDroit = arc(centrePetitDroit, r, r, versDroit, 0);

  return [...petitGauche, ...grand.slice(1), ...petitDroit.slice(1)].map(
    ([x, y]) => [a + x, b - y] as Point2,
  );
}
