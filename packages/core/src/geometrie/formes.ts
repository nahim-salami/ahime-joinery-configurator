/**
 * Pourquoi ce fichier existe : jusqu'ici, TOUT était rectangulaire. Une
 * menuiserie était quatre nombres, et `drawing.ts` ne savait rien dessiner
 * d'autre. Or le plein cintre, le surbaissé, l'anse de panier, le rampant
 * de comble, le triangle et l'œil-de-bœuf sont des produits courants —
 * partout, et pas seulement en France : c'est la forme qui change d'un pays
 * à l'autre bien plus que la quincaillerie.
 *
 * Ce module ne dessine rien. Il rend des CONTOURS : des polygones fermés,
 * en coordonnées d'élévation (origine en haut à gauche, y vers le bas), que
 * `drawing.ts` transforme en trait et que `geometry3d.ts` balaye avec une
 * section de profilé. Une seule source de forme pour les deux vues, comme
 * il n'y a qu'une source de cotes.
 *
 * Solution écartée : des courbes de Bézier dans le SVG. Élégantes à
 * l'affichage, inutilisables partout ailleurs — l'atelier coupe des
 * segments, le DXF veut des polylignes, le maillage veut des sommets, et le
 * cintrage d'un profilé se commande par une flèche et un développé, pas par
 * des points de contrôle. Tout est donc discrétisé ici, une fois, avec un
 * pas assez fin pour que l'œil ne voie pas les facettes.
 *
 * Incident fondateur : l'offset. Le cadre d'une menuiserie cintrée n'est
 * pas le contour « rétréci » au prorata — c'est le contour DÉCALÉ vers
 * l'intérieur d'une distance constante, avec des angles coupés en onglet.
 * Une homothétie donnerait un dormant plus épais en haut qu'en bas, et
 * l'atelier ne saurait pas la fabriquer.
 *
 * Ce que ce fichier NE contient PLUS : le tracé des onze formes, parti dans
 * `contours.ts`. Ici ne restent que les opérations de POLYGONE — offset,
 * boîte, découpe, développé — dont le dessin rectangulaire se sert à chaque
 * élévation. La ligne de partage est celle du budget : `formes.ts` est
 * importé par l'entrée, `contours.ts` par les seules familles qui vendent
 * des formes. Rollup découpe par module, jamais par fonction ; les laisser
 * ensemble faisait payer le plein cintre à qui configure un rectangle.
 */

import type { Point2 } from './maillage.ts';

export type Forme =
  | 'rectangle'
  | 'plein-cintre'
  | 'surbaisse'
  | 'anse-de-panier'
  | 'trapeze'
  | 'triangle'
  | 'chapeau-de-gendarme'
  | 'concave'
  | 'chevron'
  | 'rond'
  | 'ovale';

/** Les formes dont le sommet est courbe — celles qui exigent un cintrage. */
export const FORMES_CINTREES: Forme[] = [
  'plein-cintre',
  'surbaisse',
  'anse-de-panier',
  'chapeau-de-gendarme',
  'concave',
  'rond',
  'ovale',
];

export const EPAULE_CHAPEAU = 0.22;

/** Les formes fermées sur elles-mêmes : ni montant, ni traverse basse. */
export const FORMES_CLOSES: Forme[] = ['rond', 'ovale'];


/** La montée par défaut d'une forme, quand la configuration n'en dit rien. */
export function flecheParDefaut(forme: Forme, widthMm: number, heightMm: number): number {
  if (forme === 'plein-cintre') return widthMm / 2;
  if (forme === 'surbaisse') return Math.round(widthMm * 0.22);
  if (forme === 'anse-de-panier') return Math.round(widthMm * 0.33);
  if (forme === 'trapeze') return Math.round(heightMm * 0.28);
  if (forme === 'triangle') return Math.round(heightMm * 0.45);
  // une montée proportionnée à la hauteur y donnerait une bosse dérisoire.
  if (forme === 'chapeau-de-gendarme') return Math.round(widthMm * 0.1);
  if (forme === 'concave') return Math.round(widthMm * 0.07);
  if (forme === 'chevron') return Math.round(widthMm * 0.12);
  return 0;
}

/**
 * La montée effective, bornée à ce qui est constructible : un arc ne peut
 * pas monter plus haut que la menuiserie, ni dépasser le demi-cercle (au
 * delà, ce n'est plus un arc surbaissé mais un arc outrepassé — un autre
 * produit, et un autre outillage de cintrage).
 */
export function flecheEffective(
  forme: Forme,
  widthMm: number,
  heightMm: number,
  flecheMm: number | undefined,
): number {
  if (forme === 'plein-cintre') return widthMm / 2;
  if (forme === 'rectangle' || forme === 'rond' || forme === 'ovale') return 0;
  const demandee = flecheMm ?? flecheParDefaut(forme, widthMm, heightMm);
  if (forme === 'trapeze' || forme === 'triangle' || forme === 'chevron') {
    return Math.max(0, Math.min(demandee, heightMm * 0.85));
  }
  if (forme === 'chapeau-de-gendarme') {
    // L'arc naît sur la corde RÉDUITE par les épaules : au-delà de sa
    // demi-corde, il devient outrepassé et ne se cintre plus d'une passe.
    const demiCorde = (widthMm * (1 - 2 * EPAULE_CHAPEAU)) / 2;
    return Math.max(1, Math.min(demandee, Math.min(demiCorde, heightMm * 0.5)));
  }
  if (forme === 'concave') {
    // Un creux plus profond que la moitié de la hauteur donnerait un
    return Math.max(1, Math.min(demandee, Math.min(widthMm / 4, heightMm * 0.5)));
  }
  return Math.max(1, Math.min(demandee, Math.min(widthMm / 2, heightMm * 0.9)));
}


/** L'aire signée d'un polygone — positive en sens horaire à l'écran. */
export function airePolygoneElevation(points: Point2[]): number {
  let somme = 0;
  for (let index = 0; index < points.length; index++) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    somme += x1 * y2 - x2 * y1;
  }
  return somme / 2;
}

/**
 * Le contour DÉCALÉ vers l'intérieur d'une distance constante, angles
 * coupés en onglet. C'est ce décalage — et non une homothétie — qui donne
 * un dormant d'épaisseur constante sur tout le développé : c'est ainsi
 * qu'on le fabrique, et c'est donc ainsi qu'il faut le dessiner.
 *
 * Rend un tableau vide quand le décalage mange la forme (une pointe de
 * triangle, un arc trop plat) : à l'appelant de le dire au client plutôt
 * que de tracer un polygone retourné.
 */
export function offsetContour(points: Point2[], distanceMm: number): Point2[] {
  const aligne = offsetAligne(points, distanceMm);
  // Le décalage a-t-il mangé la forme ? Le signe de l'aire ne suffit PAS à
  // le dire : un cercle décalé au-delà de son rayon se retourne autour de
  // son centre et garde la même aire signée. Ce qui trahit le retournement,
  // c'est l'ARÊTE — quand une arête décalée pointe à l'envers de l'arête
  // d'origine, elle s'est croisée en chemin.
  for (let index = 0; index < points.length; index++) {
    const suivant = (index + 1) % points.length;
    const dx = points[suivant][0] - points[index][0];
    const dy = points[suivant][1] - points[index][1];
    const ox = aligne[suivant][0] - aligne[index][0];
    const oy = aligne[suivant][1] - aligne[index][1];
    if (Math.hypot(dx, dy) < 1e-9) continue;
    if (dx * ox + dy * oy < 0) return [];
  }
  const propre = aligne.filter((point, index) => {
    const suivant = aligne[(index + 1) % aligne.length];
    return Math.hypot(suivant[0] - point[0], suivant[1] - point[1]) > 1e-7;
  });
  if (propre.length < 3) return [];
  return propre;
}

/**
 * Le même décalage, mais qui rend EXACTEMENT un sommet par sommet d'entrée.
 * C'est ce qu'exige le balayage 3D : la surface d'un profilé est le tissage
 * entre les contours décalés de chaque point de sa section, et deux
 * contours de longueurs différentes ne se tissent pas.
 */
export function offsetAligne(points: Point2[], distanceMm: number): Point2[] {
  if (points.length < 3) return [];
  if (distanceMm === 0) return points.map((point) => [point[0], point[1]] as Point2);
  const sens = Math.sign(airePolygoneElevation(points)) || 1;
  const sortie: Point2[] = [];

  for (let index = 0; index < points.length; index++) {
    const precedent = points[(index - 1 + points.length) % points.length];
    const courant = points[index];
    const suivant = points[(index + 1) % points.length];

    const e1 = normaliser([courant[0] - precedent[0], courant[1] - precedent[1]]);
    const e2 = normaliser([suivant[0] - courant[0], suivant[1] - courant[1]]);
    if (!e1 || !e2) {
      sortie.push([courant[0], courant[1]]);
      continue;
    }

    // La normale INTÉRIEURE d'une arête, dans un repère où y descend.
    // Le signe se vérifie sur le rectangle : sur le montant gauche, elle
    // doit pointer vers +x. Pris à l'envers, tout le dormant grossissait
    // au lieu de rentrer — un cadre de 58 mm rendait la menuiserie plus
    // grande que le tableau.
    const n1: Point2 = [-e1[1] * sens, e1[0] * sens];
    const n2: Point2 = [-e2[1] * sens, e2[0] * sens];
    const bissectrice: Point2 = [n1[0] + n2[0], n1[1] + n2[1]];
    const longueur = Math.hypot(bissectrice[0], bissectrice[1]);
    if (longueur < 1e-9) {
      sortie.push([courant[0], courant[1]]); // demi-tour : rien à décaler
      continue;
    }

    // Longueur d'onglet : d / cos(θ/2), avec cos(θ/2) déduit du produit
    // scalaire des deux normales.
    const cosDemi = Math.sqrt(Math.max(0, (1 + n1[0] * n2[0] + n1[1] * n2[1]) / 2));
    if (cosDemi < 0.08) {
      // Angle trop aigu : l'onglet partirait à des mètres. On laisse le
      // sommet en place — la pointe sera arrondie, jamais explosée.
      sortie.push([courant[0], courant[1]]);
      continue;
    }
    const echelle = distanceMm / cosDemi;
    sortie.push([
      courant[0] + (bissectrice[0] / longueur) * echelle,
      courant[1] + (bissectrice[1] / longueur) * echelle,
    ]);
  }

  return sortie;
}

function normaliser(vecteur: Point2): Point2 | null {
  const longueur = Math.hypot(vecteur[0], vecteur[1]);
  if (longueur < 1e-9) return null;
  return [vecteur[0] / longueur, vecteur[1] / longueur];
}

/**
 * La part d'un contour comprise entre deux abscisses — le vantail d'une
 * menuiserie cintrée. Découpage de Sutherland–Hodgman contre deux
 * demi-plans verticaux : c'est court, c'est exact, et ça marche aussi bien
 * sur un rectangle que sur une anse de panier.
 */
export function decouperBande(points: Point2[], xMin: number, xMax: number): Point2[] {
  const gauche = decouperDemiPlan(points, (point) => point[0] >= xMin, xMin);
  return decouperDemiPlan(gauche, (point) => point[0] <= xMax, xMax);
}

function decouperDemiPlan(
  points: Point2[],
  dedans: (point: Point2) => boolean,
  xCoupe: number,
): Point2[] {
  if (points.length === 0) return [];
  const sortie: Point2[] = [];
  for (let index = 0; index < points.length; index++) {
    const courant = points[index];
    const suivant = points[(index + 1) % points.length];
    const courantDedans = dedans(courant);
    const suivantDedans = dedans(suivant);
    if (courantDedans) sortie.push(courant);
    if (courantDedans !== suivantDedans) {
      const dx = suivant[0] - courant[0];
      if (Math.abs(dx) > 1e-9) {
        const t = (xCoupe - courant[0]) / dx;
        sortie.push([xCoupe, courant[1] + (suivant[1] - courant[1]) * t]);
      }
    }
  }
  return sortie;
}

/** La boîte englobante d'un contour — pour poser une poignée ou une cote. */
export function boiteContour(points: Point2[]): {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
} {
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const [x, y] of points) {
    xMin = Math.min(xMin, x);
    yMin = Math.min(yMin, y);
    xMax = Math.max(xMax, x);
    yMax = Math.max(yMax, y);
  }
  if (!Number.isFinite(xMin)) return { xMm: 0, yMm: 0, widthMm: 0, heightMm: 0 };
  return { xMm: xMin, yMm: yMin, widthMm: xMax - xMin, heightMm: yMax - yMin };
}

/**
 * Le DÉVELOPPÉ d'un contour : la longueur de profilé qu'il faut couper. Sur
 * une menuiserie cintrée, ce n'est plus le périmètre du rectangle — et
 * c'est précisément ce que l'atelier commande au cintreur.
 */
export function developpeMm(points: Point2[]): number {
  let total = 0;
  for (let index = 0; index < points.length; index++) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    total += Math.hypot(x2 - x1, y2 - y1);
  }
  return total;
}

/**
 * L'intersection d'un contour avec un rectangle d'axes. C'est la clé de
 * toute la mécanique des formes : le dessin rectangulaire est calculé
 * comme avant — dormant, imposte, vantaux, clairs, options — puis CHAQUE
 * pièce est intersectée avec la forme, décalée de sa propre bande.
 *
 * Solution écartée : réécrire `elevationVitree()` en géométrie libre. Toute
 * la logique de composition (imposte, vantail de service, sens d'ouverture,
 * bloc-baie) aurait été à refaire, et deux chemins auraient coexisté — un
 * pour le rectangle, un pour le reste. Le premier bug de l'un n'aurait pas
 * été celui de l'autre.
 */
export function intersecterBoite(
  points: Point2[],
  boite: { xMm: number; yMm: number; widthMm: number; heightMm: number },
): Point2[] {
  let sortie = points;
  const plans: Array<(point: Point2) => number> = [
    (point) => point[0] - boite.xMm,
    (point) => boite.xMm + boite.widthMm - point[0],
    (point) => point[1] - boite.yMm,
    (point) => boite.yMm + boite.heightMm - point[1],
  ];
  for (const plan of plans) {
    sortie = decouperPlan(sortie, plan);
    if (sortie.length < 3) return [];
  }
  return sortie;
}

/** Sutherland–Hodgman contre un demi-plan donné par sa fonction de signe. */
function decouperPlan(points: Point2[], dedans: (point: Point2) => number): Point2[] {
  if (points.length === 0) return [];
  const sortie: Point2[] = [];
  for (let index = 0; index < points.length; index++) {
    const courant = points[index];
    const suivant = points[(index + 1) % points.length];
    const dCourant = dedans(courant);
    const dSuivant = dedans(suivant);
    if (dCourant >= 0) sortie.push(courant);
    if ((dCourant >= 0) !== (dSuivant >= 0)) {
      const t = dCourant / (dCourant - dSuivant);
      sortie.push([
        courant[0] + (suivant[0] - courant[0]) * t,
        courant[1] + (suivant[1] - courant[1]) * t,
      ]);
    }
  }
  return sortie;
}

/**
 * La part d'un segment qui reste DANS un contour convexe — ou rien. Sans
 * elle, les petits-bois d'une fenêtre en plein cintre sortaient par le haut
 * de l'arc et se dessinaient sur le dormant, et les barreaux d'une grille
 * de défense traversaient la maçonnerie.
 *
 * Toutes les formes de ce module sont convexes : le découpage par
 * demi-plans successifs (Cyrus–Beck) suffit et reste exact.
 */
export function couperSegment(
  contour: Point2[],
  depart: Point2,
  arrivee: Point2,
): [Point2, Point2] | null {
  if (contour.length < 3) return null;
  const sens = Math.sign(airePolygoneElevation(contour)) || 1;
  const dx = arrivee[0] - depart[0];
  const dy = arrivee[1] - depart[1];
  let tEntree = 0;
  let tSortie = 1;

  for (let index = 0; index < contour.length; index++) {
    const a = contour[index];
    const b = contour[(index + 1) % contour.length];
    // Normale intérieure de l'arête a→b.
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const nx = -ey * sens;
    const ny = ex * sens;
    const denominateur = dx * nx + dy * ny;
    const numerateur = (a[0] - depart[0]) * nx + (a[1] - depart[1]) * ny;
    if (Math.abs(denominateur) < 1e-12) {
      // Parallèle : hors du demi-plan, tout le segment est dehors.
      if (numerateur > 1e-9) return null;
      continue;
    }
    const t = numerateur / denominateur;
    if (denominateur > 0) tEntree = Math.max(tEntree, t);
    else tSortie = Math.min(tSortie, t);
    if (tEntree > tSortie) return null;
  }

  if (tSortie - tEntree < 1e-6) return null;
  return [
    [depart[0] + dx * tEntree, depart[1] + dy * tEntree],
    [depart[0] + dx * tSortie, depart[1] + dy * tSortie],
  ];
}
