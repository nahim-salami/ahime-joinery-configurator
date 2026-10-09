
/** Un maillage triangulé, en millimètres, sommets non indexés par sommet. */
export interface Maillage {
  positions: number[];
  normales: number[];
  indices: number[];
}

export type Point3 = { xMm: number; yMm: number; zMm: number };

/** Un point du plan de section : `u` transversal, `v` en profondeur. */
export type Point2 = [u: number, v: number];

/** L'axe le long duquel une section est extrudée. */
export type Axe = 'x' | 'y' | 'z';

export function maillageVide(): Maillage {
  return { positions: [], normales: [], indices: [] };
}

export function compterTriangles(maillage: Maillage): number {
  return maillage.indices.length / 3;
}

function soustraire(a: number[], b: number[]): number[] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function produitVectoriel(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normaliser(v: number[]): number[] {
  const longueur = Math.hypot(v[0], v[1], v[2]);
  return longueur < 1e-9 ? [0, 0, 1] : [v[0] / longueur, v[1] / longueur, v[2] / longueur];
}

/**
 * Un triangle à normale plate. Les sommets sont dupliqués à dessein : deux
 * faces voisines ne doivent PAS partager leurs normales, sinon l'arête
 * s'arrondit et le profilé perd son aspect usiné.
 */
export function ajouterTriangle(
  maillage: Maillage,
  a: number[],
  b: number[],
  c: number[],
  normale?: number[],
): void {
  const n = normale ?? normaliser(produitVectoriel(soustraire(b, a), soustraire(c, a)));
  const base = maillage.positions.length / 3;
  maillage.positions.push(...a, ...b, ...c);
  maillage.normales.push(...n, ...n, ...n);
  maillage.indices.push(base, base + 1, base + 2);
}

/** Un quadrilatère plan, dans l'ordre trigonométrique vu de sa normale. */
export function ajouterQuad(
  maillage: Maillage,
  a: number[],
  b: number[],
  c: number[],
  d: number[],
  normale?: number[],
): void {
  const n = normale ?? normaliser(produitVectoriel(soustraire(b, a), soustraire(c, a)));
  ajouterTriangle(maillage, a, b, c, n);
  ajouterTriangle(maillage, a, c, d, n);
}

/** Aire algébrique d'un polygone — son signe donne le sens de parcours. */
export function airePolygone(polygone: Point2[]): number {
  let aire = 0;
  for (let i = 0; i < polygone.length; i++) {
    const [u1, v1] = polygone[i];
    const [u2, v2] = polygone[(i + 1) % polygone.length];
    aire += u1 * v2 - u2 * v1;
  }
  return aire / 2;
}

function dansLeTriangle(p: Point2, a: Point2, b: Point2, c: Point2): boolean {
  const signe = (p1: Point2, p2: Point2, p3: Point2) =>
    (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = signe(p, a, b);
  const d2 = signe(p, b, c);
  const d3 = signe(p, c, a);
  const negatif = d1 < 0 || d2 < 0 || d3 < 0;
  const positif = d1 > 0 || d2 > 0 || d3 > 0;
  return !(negatif && positif);
}

export function trianguler(polygone: Point2[]): Array<[number, number, number]> {
  const n = polygone.length;
  if (n < 3) return [];
  const sensDirect = airePolygone(polygone) > 0;
  const restants = polygone.map((_, index) => index);
  const triangles: Array<[number, number, number]> = [];
  let garde = 0;

  while (restants.length > 3 && garde++ < n * n) {
    let oreilleTrouvee = false;
    for (let i = 0; i < restants.length; i++) {
      const iPrec = restants[(i - 1 + restants.length) % restants.length];
      const iCourant = restants[i];
      const iSuiv = restants[(i + 1) % restants.length];
      const a = polygone[iPrec];
      const b = polygone[iCourant];
      const c = polygone[iSuiv];

      // Un sommet convexe, dans le sens de parcours du polygone.
      const orientation = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
      if (sensDirect ? orientation <= 0 : orientation >= 0) continue;

      // Aucun autre sommet ne doit tomber dans l'oreille.
      let libre = true;
      for (const autre of restants) {
        if (autre === iPrec || autre === iCourant || autre === iSuiv) continue;
        if (dansLeTriangle(polygone[autre], a, b, c)) {
          libre = false;
          break;
        }
      }
      if (!libre) continue;

      triangles.push(sensDirect ? [iPrec, iCourant, iSuiv] : [iSuiv, iCourant, iPrec]);
      restants.splice(i, 1);
      oreilleTrouvee = true;
      break;
    }
    if (!oreilleTrouvee) break; // polygone dégénéré : on rend ce qu'on a
  }

  if (restants.length === 3) {
    triangles.push(
      sensDirect
        ? [restants[0], restants[1], restants[2]]
        : [restants[2], restants[1], restants[0]],
    );
  }
  return triangles;
}

/** Place un point de section (u, v) à la cote `t` le long de l'axe. */
function placer(axe: Axe, u: number, v: number, t: number): number[] {
  if (axe === 'x') return [t, u, v];
  if (axe === 'y') return [u, t, v];
  return [u, v, t];
}

export interface OptionsExtrusion {
  /** Cote de départ le long de l'axe — constante, ou fonction du point. */
  debut: number | ((u: number, v: number) => number);
  fin: number | ((u: number, v: number) => number);
  /** Décalage appliqué à toute la section, dans le plan (u, v). */
  decalage?: Point2;
  /** Faux pour une barre dont les bouts sont cachés (gain de triangles). */
  bouts?: boolean;
}

/**
 * Extrude une section le long d'un axe. Les bouts peuvent VARIER avec le
 * point de section : c'est ce qui donne la coupe d'onglet — au coin d'un
 * cadre, la barre est plus longue au bord extérieur qu'au bord intérieur,
 * et les deux barres se rejoignent sur la diagonale, comme à l'atelier.
 */
export function extruder(
  maillage: Maillage,
  polygone: Point2[],
  axe: Axe,
  options: OptionsExtrusion,
): void {
  if (polygone.length < 3) return;
  const [du, dv] = options.decalage ?? [0, 0];
  const points = polygone.map(([u, v]) => [u + du, v + dv] as Point2);
  const cote = (borne: OptionsExtrusion['debut'], p: Point2) =>
    typeof borne === 'function' ? borne(p[0], p[1]) : borne;

  const depart = points.map((p) => placer(axe, p[0], p[1], cote(options.debut, p)));
  const arrivee = points.map((p) => placer(axe, p[0], p[1], cote(options.fin, p)));

  // Les faces latérales : un quad par segment de la section.
  //
  // L'ordre des quatre sommets décide du SENS de la normale. Pour un
  // polygone parcouru dans le sens direct, la normale sortante de l'arête
  // i→j vaut (dy, −dx) : il faut donc partir de `depart[i]` vers
  // `depart[j]`, puis remonter. L'ordre inverse — celui de la première
  // version — donnait (−dy, dx), c'est-à-dire des faces tournées vers
  // l'INTÉRIEUR du volume. Rien ne se voyait franchement à l'écran (les
  // pièces sont fermées, et l'ambiante rattrapait), mais tout l'éclairage
  // était retourné et les profilés paraissaient plats. Attrapé par le
  // volume signé, jamais par une capture.
  // Les repères (u, v, t) des trois axes n'ont pas tous la même main.
  //   axe z : (u, v, t) → (x, y, z)  — identité, repère DIRECT
  //   axe x : (u, v, t) → (y, z, x)  — permutation circulaire, DIRECT
  //   axe y : (u, v, t) → (x, z, y)  — deux axes échangés, donc INDIRECT
  // Sur l'axe y, le sens de parcours s'inverse : sans cette correction, tous
  // les montants verticaux d'un cadre sortaient retournés — normales vers
  // l'intérieur, éclairage inversé, profilés qui paraissent plats.
  const repereIndirect = axe === 'y';
  const sensDirect = airePolygone(points) > 0 !== repereIndirect;

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    if (sensDirect) {
      ajouterQuad(maillage, depart[i], depart[j], arrivee[j], arrivee[i]);
    } else {
      ajouterQuad(maillage, depart[i], arrivee[i], arrivee[j], depart[j]);
    }
  }

  if (options.bouts === false) return;
  for (const [a, b, c] of trianguler(points)) {
    if (repereIndirect) {
      ajouterTriangle(maillage, depart[a], depart[b], depart[c]);
      ajouterTriangle(maillage, arrivee[c], arrivee[b], arrivee[a]);
    } else {
      ajouterTriangle(maillage, depart[c], depart[b], depart[a]);
      ajouterTriangle(maillage, arrivee[a], arrivee[b], arrivee[c]);
    }
  }
}

/** Un pavé droit — encore utile pour les pièces vraiment prismatiques. */
export function ajouterPave(maillage: Maillage, centre: Point3, tailles: Point3): void {
  const dx = tailles.xMm / 2;
  const dy = tailles.yMm / 2;
  extruder(
    maillage,
    [
      [centre.xMm - dx, centre.yMm - dy],
      [centre.xMm + dx, centre.yMm - dy],
      [centre.xMm + dx, centre.yMm + dy],
      [centre.xMm - dx, centre.yMm + dy],
    ],
    'z',
    { debut: centre.zMm - tailles.zMm / 2, fin: centre.zMm + tailles.zMm / 2 },
  );
}

/**
 * Un pavé tourné autour de l'axe des profondeurs — le retour d'une béquille,
 * un chanfrein incliné. L'angle est en radians, dans le plan de la façade.
 */
export function ajouterPaveOriente(
  maillage: Maillage,
  centre: Point3,
  tailles: Point3,
  angle: number,
): void {
  const dx = tailles.xMm / 2;
  const dy = tailles.yMm / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tourner = ([u, v]: Point2): Point2 => [
    centre.xMm + u * cos - v * sin,
    centre.yMm + u * sin + v * cos,
  ];
  extruder(
    maillage,
    [tourner([-dx, -dy]), tourner([dx, -dy]), tourner([dx, dy]), tourner([-dx, dy])],
    'z',
    { debut: centre.zMm - tailles.zMm / 2, fin: centre.zMm + tailles.zMm / 2 },
  );
}

/** Un rectangle aux angles arrondis, en points de section — plaques, rosaces. */
export function rectangleArrondi(
  largeur: number,
  hauteur: number,
  rayon: number,
  segments = 4,
): Point2[] {
  const r = Math.min(rayon, largeur / 2, hauteur / 2);
  const dx = largeur / 2 - r;
  const dy = hauteur / 2 - r;
  const points: Point2[] = [];
  const coins: Array<[number, number, number]> = [
    [dx, dy, 0],
    [-dx, dy, Math.PI / 2],
    [-dx, -dy, Math.PI],
    [dx, -dy, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, depart] of coins) {
    for (let i = 0; i <= segments; i++) {
      const angle = depart + (i / segments) * (Math.PI / 2);
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
  }
  return points;
}

/**
 * Un cylindre, normales LISSÉES autour de l'axe : une poignée ronde doit
 * être ronde à l'œil, pas facettée. Les bouts, eux, restent plats.
 */
export function ajouterCylindre(
  maillage: Maillage,
  centre: Point3,
  axe: Axe,
  rayon: number,
  longueur: number,
  segments = 20,
): void {
  const demi = longueur / 2;
  const t0 = axe === 'x' ? centre.xMm - demi : axe === 'y' ? centre.yMm - demi : centre.zMm - demi;
  const t1 = t0 + longueur;
  const cu = axe === 'x' ? centre.yMm : centre.xMm;
  const cv = axe === 'x' || axe === 'y' ? centre.zMm : centre.yMm;

  const anneau: Point2[] = [];
  const normales: Point2[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    normales.push([Math.cos(angle), Math.sin(angle)]);
    anneau.push([cu + rayon * Math.cos(angle), cv + rayon * Math.sin(angle)]);
  }

  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    const a = placer(axe, anneau[i][0], anneau[i][1], t0);
    const b = placer(axe, anneau[j][0], anneau[j][1], t0);
    const c = placer(axe, anneau[j][0], anneau[j][1], t1);
    const d = placer(axe, anneau[i][0], anneau[i][1], t1);
    const ni = placer(axe, normales[i][0], normales[i][1], 0);
    const nj = placer(axe, normales[j][0], normales[j][1], 0);
    // Normales par sommet : c'est ce lissage qui fait le rond.
    const base = maillage.positions.length / 3;
    maillage.positions.push(...a, ...b, ...c, ...d);
    maillage.normales.push(...ni, ...nj, ...nj, ...ni);
    maillage.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Les deux disques de bout, à normale plate.
  const centreT0 = placer(axe, cu, cv, t0);
  const centreT1 = placer(axe, cu, cv, t1);
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    ajouterTriangle(
      maillage,
      centreT0,
      placer(axe, anneau[j][0], anneau[j][1], t0),
      placer(axe, anneau[i][0], anneau[i][1], t0),
    );
    ajouterTriangle(
      maillage,
      centreT1,
      placer(axe, anneau[i][0], anneau[i][1], t1),
      placer(axe, anneau[j][0], anneau[j][1], t1),
    );
  }
}

/** Un cadre à construire : son emprise dans le plan de la façade. */
export interface Cadre {
  xMm: number;
  yMm: number;
  largeurMm: number;
  hauteurMm: number;
  /** Cote de la face extérieure du cadre. */
  zMm: number;
}

/**
 * Les quatre barres d'un cadre, **coupées d'onglet** aux angles — la coupe
 * à 45° de l'atelier. Le profil est donné avec `u` mesuré depuis le bord
 * EXTÉRIEUR de la barre et `v` en profondeur depuis `cadre.zMm`.
 *
 * Solution écartée : quatre pavés qui se chevauchent aux angles. Le
 * chevauchement se voit dès qu'une lumière rasante passe, et surtout il
 * ment : une menuiserie assemblée à recouvrement n'existe pas. C'est le
 * bout variable de `extruder()` qui donne l'onglet — au coin, la barre est
 * longue au bord extérieur, courte au bord intérieur, et les deux se
 * rejoignent exactement sur la diagonale.
 */
export function ajouterCadreMitre(maillage: Maillage, cadre: Cadre, profil: Point2[]): void {
  const { xMm: x0, yMm: y0, largeurMm: w, hauteurMm: h, zMm: z0 } = cadre;
  if (w <= 0 || h <= 0 || profil.length < 3) return;

  // Montant gauche : section dans le plan (x, z), extrudée selon y.
  extruder(
    maillage,
    profil.map(([u, v]) => [x0 + u, z0 + v] as Point2),
    'y',
    { debut: (x) => y0 + (x - x0), fin: (x) => y0 + h - (x - x0) },
  );
  // Montant droit.
  extruder(
    maillage,
    profil.map(([u, v]) => [x0 + w - u, z0 + v] as Point2),
    'y',
    { debut: (x) => y0 + (x0 + w - x), fin: (x) => y0 + h - (x0 + w - x) },
  );
  // Traverse basse : section dans le plan (y, z), extrudée selon x.
  extruder(
    maillage,
    profil.map(([u, v]) => [y0 + u, z0 + v] as Point2),
    'x',
    { debut: (y) => x0 + (y - y0), fin: (y) => x0 + w - (y - y0) },
  );
  // Traverse haute.
  extruder(
    maillage,
    profil.map(([u, v]) => [y0 + h - u, z0 + v] as Point2),
    'x',
    { debut: (y) => x0 + (y0 + h - y), fin: (y) => x0 + w - (y0 + h - y) },
  );
}

/**
 * Les quatre barres d'un cadre à **JOINT DROIT** — l'assemblage du
 * menuisier : les montants courent sur toute la hauteur, les traverses
 * viennent se loger entre eux. C'est le tenon-mortaise, vu de face.
 *
 * Solution écartée : garder l'onglet partout, puisqu'il est plus simple.
 * L'onglet est la coupe du PVC soudé et de l'aluminium serti ; le bois,
 * lui, s'assemble à joint droit depuis toujours — et cela SE VOIT, parce
 * que la ligne de joint part du coin en diagonale dans un cas et à
 * l'horizontale dans l'autre. Une fenêtre bois avec quatre onglets est une
 * fenêtre PVC teintée bois, et un menuisier le lit au premier coup d'œil
 * (docs/18 §2.4, G9).
 *
 * Le montant passe DEVANT en largeur : c'est lui qui porte les paumelles
 * et qui reçoit la charge.
 */
export function ajouterCadreDroit(
  maillage: Maillage,
  cadre: Cadre,
  profil: Point2[],
  largeurMontantMm: number,
): void {
  const { xMm: x0, yMm: y0, largeurMm: w, hauteurMm: h, zMm: z0 } = cadre;
  if (w <= 0 || h <= 0 || profil.length < 3) return;
  const montant = Math.min(largeurMontantMm, w / 2);

  // Les deux montants, sur toute la hauteur — bouts droits.
  extruder(
    maillage,
    profil.map(([u, v]) => [x0 + u, z0 + v] as Point2),
    'y',
    { debut: y0, fin: y0 + h },
  );
  extruder(
    maillage,
    profil.map(([u, v]) => [x0 + w - u, z0 + v] as Point2),
    'y',
    { debut: y0, fin: y0 + h },
  );
  // Les deux traverses, ENTRE les montants.
  for (const bas of [true, false]) {
    extruder(
      maillage,
      profil.map(([u, v]) => [(bas ? y0 + u : y0 + h - u), z0 + v] as Point2),
      'x',
      { debut: x0 + montant, fin: x0 + w - montant },
    );
  }
}

/**
 * Fusionne les sommets rigoureusement identiques — même position ET même
 * normale. Les faces plates sont émises en quads découpés en deux
 * triangles, qui partagent deux sommets : les rendre une seule fois retire
 * un tiers des sommets sans changer un seul triangle.
 *
 * Solution écartée : fusionner sur la seule position. Deux faces
 * perpendiculaires partagent leurs arêtes ; les fusionner moyennerait leurs
 * normales et arrondirait l'arête. C'est précisément ce qu'on ne veut pas
 * sur un profilé — d'où la clé qui inclut la normale.
 *
 * L'arrondi au millième de millimètre évite qu'une erreur de virgule
 * flottante empêche une fusion évidente.
 */
export function deduplique(maillage: Maillage): Maillage {
  const connus = new Map<string, number>();
  const positions: number[] = [];
  const normales: number[] = [];
  const indices: number[] = [];

  for (const index of maillage.indices) {
    const p = index * 3;
    const cle =
      `${Math.round(maillage.positions[p] * 1000)},` +
      `${Math.round(maillage.positions[p + 1] * 1000)},` +
      `${Math.round(maillage.positions[p + 2] * 1000)},` +
      `${Math.round(maillage.normales[p] * 1000)},` +
      `${Math.round(maillage.normales[p + 1] * 1000)},` +
      `${Math.round(maillage.normales[p + 2] * 1000)}`;
    let nouveau = connus.get(cle);
    if (nouveau === undefined) {
      nouveau = positions.length / 3;
      connus.set(cle, nouveau);
      positions.push(maillage.positions[p], maillage.positions[p + 1], maillage.positions[p + 2]);
      normales.push(maillage.normales[p], maillage.normales[p + 1], maillage.normales[p + 2]);
    }
    indices.push(nouveau);
  }
  return { positions, normales, indices };
}

/**
 * Un cylindre TENDU ENTRE DEUX POINTS, dans n'importe quelle direction.
 * Indispensable dès qu'un fer n'est ni vertical ni horizontal : les
 * diagonales d'un treillis, les cordes d'une volute. Posées sur un axe
 * fixe, elles sortaient en tirets épars au lieu d'un fer continu.
 *
 * Normales lissées autour de l'axe, bouts plats — mêmes conventions que
 * `ajouterCylindre`.
 */
export function ajouterCylindreEntre(
  maillage: Maillage,
  depart: Point3,
  arrivee: Point3,
  rayon: number,
  segments = 10,
): void {
  const dx = arrivee.xMm - depart.xMm;
  const dy = arrivee.yMm - depart.yMm;
  const dz = arrivee.zMm - depart.zMm;
  const longueur = Math.hypot(dx, dy, dz);
  if (longueur < 1e-6) return;
  const axe = [dx / longueur, dy / longueur, dz / longueur];

  // Une base perpendiculaire quelconque : on part du vecteur du monde le
  // moins colinéaire à l'axe, sans quoi le produit vectoriel s'annule.
  const secours = Math.abs(axe[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normaliser(produitVectoriel(axe, secours));
  const v = normaliser(produitVectoriel(axe, u));

  const anneau = (base: Point3, index: number) => {
    const angle = (index / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      point: [
        base.xMm + rayon * (cos * u[0] + sin * v[0]),
        base.yMm + rayon * (cos * u[1] + sin * v[1]),
        base.zMm + rayon * (cos * u[2] + sin * v[2]),
      ],
      normale: [cos * u[0] + sin * v[0], cos * u[1] + sin * v[1], cos * u[2] + sin * v[2]],
    };
  };

  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    const ai = anneau(depart, i);
    const aj = anneau(depart, j);
    const bi = anneau(arrivee, i);
    const bj = anneau(arrivee, j);
    const base = maillage.positions.length / 3;
    maillage.positions.push(...ai.point, ...aj.point, ...bj.point, ...bi.point);
    maillage.normales.push(...ai.normale, ...aj.normale, ...aj.normale, ...ai.normale);
    maillage.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const centreA = [depart.xMm, depart.yMm, depart.zMm];
  const centreB = [arrivee.xMm, arrivee.yMm, arrivee.zMm];
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    ajouterTriangle(maillage, centreA, anneau(depart, j).point, anneau(depart, i).point);
    ajouterTriangle(maillage, centreB, anneau(arrivee, i).point, anneau(arrivee, j).point);
  }
}

/** Les bornes d'un maillage — sert aux tests et au cadrage de la scène. */
export function boiteEnglobante(maillage: Maillage): { min: Point3; max: Point3 } | null {
  if (maillage.positions.length === 0) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < maillage.positions.length; i += 3) {
    for (let axe = 0; axe < 3; axe++) {
      min[axe] = Math.min(min[axe], maillage.positions[i + axe]);
      max[axe] = Math.max(max[axe], maillage.positions[i + axe]);
    }
  }
  return {
    min: { xMm: min[0], yMm: min[1], zMm: min[2] },
    max: { xMm: max[0], yMm: max[1], zMm: max[2] },
  };
}

/** Décale un maillage entier — poser une pièce construite à l'origine. */
export function translater(maillage: Maillage, decalage: Point3): void {
  for (let i = 0; i < maillage.positions.length; i += 3) {
    maillage.positions[i] += decalage.xMm;
    maillage.positions[i + 1] += decalage.yMm;
    maillage.positions[i + 2] += decalage.zMm;
  }
}

/** Fond un maillage dans un autre, en réindexant. */
export function fusionner(cible: Maillage, source: Maillage): void {
  const base = cible.positions.length / 3;
  cible.positions.push(...source.positions);
  cible.normales.push(...source.normales);
  for (const index of source.indices) cible.indices.push(base + index);
}

/**
 * Le balayage d'une SECTION le long d'un contour fermé quelconque — le
 * cadre d'une menuiserie qui n'est pas rectangulaire. `ajouterCadreMitre()`
 * fait la même chose pour un rectangle, en quatre barres coupées d'onglet ;
 * ici il n'y a plus quatre barres mais un développé continu, et c'est
 * exactement ce que le cintreur produit.
 *
 * Le principe : chaque point de la section, à sa distance `u` du bord
 * extérieur, décrit le contour DÉCALÉ de `u` vers l'intérieur, à la
 * profondeur `v`. La surface du profilé est le tissage entre les contours
 * de deux points consécutifs de la section. Les deux boucles étant fermées,
 * il n'y a aucun bouchon à poser.
 *
 * Solution écartée : trianguler la section à chaque sommet et coudre. Deux
 * fois plus de triangles pour le même résultat, et des bouchons internes
 * invisibles qui alourdissent le GLB de l'export en RA.
 *
 * `contourDecale` est injecté plutôt qu'importé : `geometrie/formes.ts`
 * dépend déjà de ce module, et l'inverse ferait un cycle.
 */
export function balayerContour(
  maillage: Maillage,
  contour: Point2[],
  profil: Point2[],
  zBase: number,
  contourDecale: (points: Point2[], distance: number) => Point2[],
): void {
  if (contour.length < 3 || profil.length < 3) return;
  const anneaux = profil.map(([u, v]) => ({
    points: contourDecale(contour, u),
    z: zBase + v,
  }));
  if (anneaux.some((anneau) => anneau.points.length !== contour.length)) return;

  // Le sens de parcours décide de l'orientation des faces. Un contour
  // parcouru dans le mauvais sens rend un solide entièrement retourné :
  // toutes ses normales pointent vers l'intérieur, et l'éclairage s'inverse
  // sans qu'aucune capture d'écran ne le montre. Le volume signé, lui, le dit.
  // Le sens de parcours décide de l'orientation des faces, et le repère du
  // monde retourne l'axe y par rapport à l'élévation : un contour positif
  // au dessin devient négatif ici. Le volume signé l'a dit — pas l'écran.
  const direct = airePolygone(contour) < 0;
  const nombre = contour.length;

  for (let k = 0; k < profil.length; k++) {
    const a = anneaux[k];
    const b = anneaux[(k + 1) % profil.length];
    for (let i = 0; i < nombre; i++) {
      const j = (i + 1) % nombre;
      const a1 = [a.points[i][0], a.points[i][1], a.z];
      const a2 = [a.points[j][0], a.points[j][1], a.z];
      const b1 = [b.points[i][0], b.points[i][1], b.z];
      const b2 = [b.points[j][0], b.points[j][1], b.z];
      if (direct) ajouterQuad(maillage, a1, a2, b2, b1);
      else ajouterQuad(maillage, a1, b1, b2, a2);
    }
  }
}

/**
 * Le PRISME d'un contour : le vitrage d'une menuiserie de forme. Le
 * polygone est triangulé une fois, les deux faces sont posées, et les
 * flancs les relient.
 */
export function ajouterPrisme(
  maillage: Maillage,
  contour: Point2[],
  zDebut: number,
  zFin: number,
): void {
  if (contour.length < 3) return;
  extruder(maillage, contour, 'z', { debut: zDebut, fin: zFin });
}
