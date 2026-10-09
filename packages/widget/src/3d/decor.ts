
import type { EncadrementBaie, TypeDecor, VuDepuis } from '../decor-famille.ts';
import {
  construireAllee,
  construireDehors,
  construireHaie,
  construireMaison,
  construirePiece,
  habillerFacade,
  matieresDecor,
} from './environnement.ts';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';

export interface OptionsDecor {
  /**
   * DANS QUOI l'ouvrage se pose. C'est `decor-famille.ts` qui le décide, et
   * lui seul : ce module-ci ne connaît aucune famille, il construit ce
   * qu'on lui demande.
   */
  type: TypeDecor;
  /**
   * D'où on regarde. La scène s'en sert pour placer la caméra ET le
   * soleil : ce qu'on regarde du dehors doit être ÉCLAIRÉ du dehors, sans
   * quoi il s'affiche à contre-jour.
   */
  vuDepuis?: VuDepuis;
  /** Hauteur d'allège : le mur sous l'ouvrage, en millimètres. */
  allegeMm: number;
  /** La pente du pan de couverture, en degrés — décor `rampant` seulement. */
  penteToitDeg?: number;
  /**
   * De combien le mur déborde la baie. Un galandage a besoin de plus : son
   * fourreau s'enfonce dans le mur sur toute la largeur d'un vantail, et un
   * mur trop court le laissait dépasser dans le vide.
   */
  debordMm?: number;
  /**
   * Le contour du dormant, quand la menuiserie n'est pas rectangulaire.
   * Le mur reste percé d'un rectangle — quatre panneaux, aucun CSG — et ce
   * contour sert à COMBLER ce qui reste entre le rectangle et la forme.
   * Sans lui, un plein cintre flottait dans un trou carré, deux triangles
   * de vide aux épaules.
   */
  contourMm?: Array<[number, number]>;
  /**
   * CE QUE LE MAÇON MONTE AUTOUR DU TROU. Le contour dit la forme de la
   * baie ; il ne dit pas qu'au-dessus d'un cintre on monte un ARC, ni qu'un
   * œil-de-bœuf n'a PAS d'appui. C'est `decor-famille.ts` qui en décide.
   */
  encadrement?: EncadrementBaie;
  /** Le mur au-dessus suit le RAMPANT du toit — une baie de pignon. */
  rampant?: boolean;
  /**
   * LA HAUTEUR DE L'OUVRAGE AU DROIT DE SES BORDS. C'est sur elle, et non
   * sur le hors-tout, qu'un maçon arase ses piliers : un chapeau de
   * gendarme de 1600 mm n'en fait que 1250 là où le fût le touche.
   */
  hauteurAuxBordsMm?: number;
  refoulement?: { sens: -1 | 1; longueurMm: number };
  /** Teinte du mur ; le pack peut la changer. */
  murHex?: string;
  solHex?: string;
  /** Teinte de l'appui de fenêtre — pierre grise par défaut. */
  appuiHex?: string;
  /** Teinte de la tablette intérieure — bois clair par défaut. */
  tabletteHex?: string;
}

/** L'épaisseur du mur maçonné, et le retrait de la menuiserie dedans. */
const MUR = {
  epaisseurMm: 300,
  debordMm: 900,
  saillieExterieureMm: 40,
  /**
   * DE COMBIEN LA FAÇADE DESCEND SOUS LE PLANCHER.
   *
   * Elle s'arrêtait au nu du plancher — c'est-à-dire au niveau de l'allège
   * saisie, à 900 mm sous une fenêtre — et rien ne la portait : le gazon
   * passait DESSOUS, et dès qu'on regardait la maison d'un peu bas, sa
   * SOUS-FACE apparaissait en bandeau sombre sur toute la longueur. Le mur
   * flottait, la maison avec.
   *
   * Un mur ne s'arrête pas au plancher : il descend en soubassement
   * jusqu'aux fondations. Six cents millimètres suffisent à ce qu'il sorte
   * du champ par le bas, quel que soit l'angle, et rien ne coûte de plus —
   * c'est le même panneau, plus haut.
   */
  soubassementMm: 600,
} as const;
const SOL = { epaisseurMm: 30, profondeurMm: 2200 };

const PILIER = {
  sectionMm: 300,
  arasementMm: 180,
  /** Le chapeau : son épaisseur et son débord sur chaque face. */
  chapeauEpaisseurMm: 60,
  chapeauDebordMm: 45,
  /** Le jeu entre le vantail et le pilier — il faut bien qu'il ouvre. */
  jeuMm: 15,
} as const;

const GARDE_AU_SOL_MM = 40;

const DALLE = {
  epaisseurMm: 220,
  profondeurMm: 2400,
  retraitRiveMm: 90,
  etagesSousMm: 3400,
} as const;

/**
 * L'APPUI de fenêtre — le seuil de béton ou de pierre sur lequel la
 * menuiserie repose, et la tablette qui lui répond dans la pièce.
 *
 * Le mur était NU sous la baie : la menuiserie s'arrêtait sur du vide, et
 * l'image manquait de la seule pièce que le client regarde quand il vérifie
 * si sa fenêtre va rentrer. C'est aussi l'objet de la troisième règle d'or
 * de la prise de cotes — « repérer le rejingot : la fenêtre se pose DERRIÈRE
 * lui, jamais dessus ». Une pièce qu'on demande au client de repérer et
 * qu'on ne lui montre nulle part.
 *
 * Le rejingot est le relevé arrière de l'appui. Il n'est pas décoratif :
 * c'est lui qui arrête l'eau que le vent pousse vers l'intérieur. Une
 * fenêtre posée DESSUS au lieu de derrière prend l'eau au premier orage.
 */
const APPUI = {
  epaisseurMm: 45,
  /** Ce dont l'appui déborde le nu du mur, dehors — la goutte d'eau. */
  saillieMm: 70,
  /** Ce dont il déborde la baie, de chaque côté : il coiffe les jambages. */
  debordLateralMm: 45,
  /** La pente d'écoulement. Un appui plat retient l'eau et se fend au gel. */
  penteDeg: 5,
  /** Le relevé arrière, derrière lequel le dormant se pose. */
  rejingotHauteurMm: 25,
  rejingotProfondeurMm: 30,
};

// La tablette intérieure. Son DESSUS s'arrête deux millimètres sous le nu du
// seuil : posé pile dessus, il partageait son plan avec le dessus de l'allège
// et avec le tableau d'une baie de pignon, et les trois se disputaient le
// pixel juste sous la fenêtre — là où l'on regarde quand on vérifie une cote.
const TABLETTE = { epaisseurMm: 28, profondeurMm: 190, debordLateralMm: 30, retraitMm: 2 };

/**
 * LE RAMPANT d'une baie de pignon : ce qu'on laisse de maçonnerie entre le
 * haut de la menuiserie et la sous-face du toit, et l'épaisseur de la rive.
 */
const RAMPANT = { margeMm: 320, riveEpaisseurMm: 90, debordMm: 260, egoutMm: 450 } as const;

const MAISON_DU_FOND = { largeurMm: 11000, profondeurMm: 8500 } as const;

/**
 * LA PROFONDEUR DE LA MAISON dont la façade porte la baie — celle qu'on
 * habille. Elle est ici, et non recopiée dans chaque appel, parce que le
 * TERRAIN doit aller jusque derrière elle : deux valeurs qui divergent, et
 * la maison se retrouve au bord du vide.
 */
const PROFONDEUR_MAISON_MM = 8000;

/**
 * Un panneau du décor. Il porte un NOM — « mur », « appui », « pilier » —
 * et ce n'est pas de la coquetterie : c'est ce qui permet de vérifier
 * qu'aucun décor extérieur ne porte d'appui de fenêtre. Le premier jet du
 * test le devinait par la géométrie, et confondait l'appui avec le sol.
 */
function panneau(
  nom: string,
  materiau: MeshStandardMaterial,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): Mesh | null {
  const largeur = (x1 - x0) / 1000;
  const hauteur = (y1 - y0) / 1000;
  const profondeur = (z1 - z0) / 1000;
  if (largeur <= 0.0001 || hauteur <= 0.0001 || profondeur <= 0.0001) return null;
  const maille = new Mesh(new BoxGeometry(largeur, hauteur, profondeur), materiau);
  maille.name = nom;
  maille.position.set((x0 + x1) / 2000, (y0 + y1) / 2000, (z0 + z1) / 2000);
  // Le décor REÇOIT les ombres — c'est là qu'elles se lisent — et en porte
  // lui-même : le tableau doit s'assombrir sous le linteau.
  maille.castShadow = true;
  maille.receiveShadow = true;
  return maille;
}

/** La boîte d'un contour — et son centre, qui sert de pôle à l'anneau. */
function boiteDuContour(contour: Array<[number, number]>) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of contour) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1 };
}

function centreDuContour(contour: Array<[number, number]>): [number, number] {
  const b = boiteDuContour(contour);
  return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
}

/**
 * LE RAMPANT — la ligne de toit au-dessus d'une baie de PIGNON.
 *
 * Elle ne se règle pas : elle se DÉDUIT des arêtes obliques de la
 * menuiserie. Un trapèze de comble et un triangle de pignon sont taillés
 * sur la pente du toit ; poser au-dessus d'eux une gouttière horizontale à
 * 3,10 m, avec une fenêtre voisine au même niveau et un appui de séjour
 * dessous, ne disait pas qu'on est sous un comble — cela disait le
 * contraire. Et une pente réglée à part de la menuiserie aurait divergé de
 * la sienne au premier changement de flèche.
 *
 * La marge est verticale et constante : c'est la hauteur de mur qu'un
 * charpentier laisse entre le haut de la baie et la sous-face du chevron.
 */
function rampantDuContour(
  contour: Array<[number, number]>,
  demiFacade: number,
  margeMm: number,
  yMin: number,
): Array<[number, number]> | null {
  const droites: Array<{ pente: number; ordonnee: number; milieu: number }> = [];
  for (let index = 0; index < contour.length; index++) {
    const a = contour[index];
    const b = contour[(index + 1) % contour.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (Math.abs(dx) < 1 || Math.abs(dy) < 1) continue;
    const pente = dy / dx;
    droites.push({ pente, ordonnee: a[1] - pente * a[0] + margeMm, milieu: (a[0] + b[0]) / 2 });
  }
  if (droites.length === 0) return null;
  droites.sort((a, b) => a.milieu - b.milieu);
  const enX = (d: (typeof droites)[number], x: number) => d.pente * x + d.ordonnee;
  const ligne: Array<[number, number]> = [[-demiFacade, enX(droites[0], -demiFacade)]];
  for (let index = 1; index < droites.length; index++) {
    const g = droites[index - 1];
    const d = droites[index];
    if (Math.abs(g.pente - d.pente) < 1e-6) continue;
    // LE FAÎTAGE : là où les deux versants se rencontrent.
    const x = (d.ordonnee - g.ordonnee) / (g.pente - d.pente);
    ligne.push([x, enX(g, x)]);
  }
  ligne.push([demiFacade, enX(droites[droites.length - 1], demiFacade)]);

  // L'ÉGOUT. Prolongée sans fin, la pente d'un rampant finit sous le seuil :
  // à 24 % sur neuf mètres de façade, elle descend de plus d'un mètre, et le
  // versant passait sous la fenêtre voisine. Un toit s'arrête à son ÉGOUT —
  // en dessous, le mur redevient droit et redescend jusqu'au sol.
  const borne: Array<[number, number]> = [];
  for (let index = 0; index < ligne.length; index++) {
    const point = ligne[index];
    const precedent = ligne[index - 1];
    if (precedent && (precedent[1] < yMin) !== (point[1] < yMin)) {
      // La pente croise l'égout : on marque le point de rencontre.
      const part = (yMin - precedent[1]) / (point[1] - precedent[1]);
      borne.push([precedent[0] + (point[0] - precedent[0]) * part, yMin]);
    }
    borne.push([point[0], Math.max(yMin, point[1])]);
  }
  return borne;
}

/** La hauteur du rampant à une abscisse donnée. */
function hauteurDuRampant(ligne: Array<[number, number]>, x: number): number {
  if (ligne.length < 2) return Infinity;
  if (x <= ligne[0][0]) return ligne[0][1];
  for (let index = 1; index < ligne.length; index++) {
    const a = ligne[index - 1];
    const b = ligne[index];
    if (x <= b[0]) {
      const part = (x - a[0]) / Math.max(1e-6, b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * part;
    }
  }
  return ligne[ligne.length - 1][1];
}

/**
 * LES SOMMETS DU BORD, ajoutés au contour.
 *
 * L'anneau cousu entre le contour et le bord suppose que deux sommets
 * voisins se projettent sur le MÊME côté du bord. Dès qu'un sommet du bord
 * passe entre les deux, le quadrilatère saute par-dessus et laisse un trou
 * dans le mur. C'était le cas du TRAPÈZE et du TRIANGLE, dont les quatre sommets
 * tombent déjà sur le bord : rien ne bougeait, rien n'était cousu, et le
 * pignon au-dessus du rampant n'existait tout simplement pas.
 *
 * Plutôt que d'insérer les coins dans la boucle EXTÉRIEURE — ce qui demande
 * de savoir sur quel côté chaque projection tombe, et dans quel sens aller
 * de l'une à l'autre —, on insère dans le contour le point qui se projette
 * SUR le coin : le rayon parti du centre vers le coin coupe le contour en un
 * point, et ce point devient un sommet. Les deux boucles retrouvent alors
 * leurs sommets face à face, et le quadrilatère redevient un quadrilatère.
 *
 * Cela suppose que le contour entoure le centre du trou — vrai de toutes
 * les formes de menuiserie, qui sont convexes. Un rayon qui ne coupe rien
 * est simplement ignoré.
 */
function insererLesCoins(
  contour: Array<[number, number]>,
  bord: Array<[number, number]>,
  centre: [number, number],
): Array<[number, number]> {
  const [cx, cy] = centre;
  const points = contour.map((p) => [...p] as [number, number]);
  for (const [coinX, coinY] of bord) {
    const dx = coinX - cx;
    const dy = coinY - cy;
    for (let index = 0; index < points.length; index++) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const det = dx * -ey - dy * -ex;
      if (Math.abs(det) < 1e-9) continue;
      const rx = a[0] - cx;
      const ry = a[1] - cy;
      // s : le long du rayon (> 0) ; u : le long de l'arête (dans [0, 1]).
      const s = (rx * -ey - ry * -ex) / det;
      const u = (dx * ry - dy * rx) / det;
      if (s <= 1e-9 || u < -1e-9 || u > 1 + 1e-9) continue;
      const point: [number, number] = [cx + dx * s, cy + dy * s];
      const proche = (p: [number, number]) => Math.hypot(p[0] - point[0], p[1] - point[1]) < 0.05;
      if (proche(a) || proche(b)) break;
      points.splice(index + 1, 0, point);
      break;
    }
  }
  return points;
}

/** Une soupe de triangles, refermée en maillage nommé — ou rien. */
function maillageDeTriangles(
  nom: string,
  materiau: MeshStandardMaterial,
  positions: number[],
): Mesh | null {
  if (positions.length < 9) return null;
  const geometrie = new BufferGeometry();
  geometrie.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometrie.computeVertexNormals();
  const maille = new Mesh(geometrie, materiau);
  maille.name = nom;
  maille.castShadow = true;
  maille.receiveShadow = true;
  return maille;
}

function comblementDeForme(
  materiau: MeshStandardMaterial,
  contour: Array<[number, number]>,
  bord: Array<[number, number]>,
  zExterieur: number,
  zInterieur: number,
): Array<Mesh | null> {
  if (contour.length < 3 || bord.length < 3) return [];
  const centre = centreDuContour(contour);
  const sommets = insererLesCoins(contour, bord, centre);
  /** Le point du BORD que le rayon centre → p atteint en sortant. */
  const versLeBord = ([x, y]: [number, number]): [number, number] => {
    const dx = x - centre[0];
    const dy = y - centre[1];
    let sortie = Infinity;
    for (let index = 0; index < bord.length; index++) {
      const a = bord[index];
      const b = bord[(index + 1) % bord.length];
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const det = dx * -ey - dy * -ex;
      if (Math.abs(det) < 1e-12) continue;
      const rx = a[0] - centre[0];
      const ry = a[1] - centre[1];
      const s = (rx * -ey - ry * -ex) / det;
      const u = (dx * ry - dy * rx) / det;
      if (s <= 1e-9 || u < -1e-9 || u > 1 + 1e-9) continue;
      sortie = Math.min(sortie, s);
    }
    const k = Number.isFinite(sortie) ? Math.max(1, sortie) : 1;
    return [centre[0] + dx * k, centre[1] + dy * k];
  };

  const ecoincons: number[] = [];
  const tableau: number[] = [];
  const m = (valeur: number) => valeur / 1000;
  /** Un triangle, sauf s'il est plat : une face nulle rend des normales NaN. */
  const pousser = (dans: number[], a: number[], b: number[], c: number[]) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (Math.hypot(nx, ny, nz) < 1e-9) return;
    dans.push(...a, ...b, ...c);
  };

  for (let index = 0; index < sommets.length; index++) {
    const p1 = sommets[index];
    const p2 = sommets[(index + 1) % sommets.length];
    const q1 = versLeBord(p1);
    const q2 = versLeBord(p2);
    // UNE ARÊTE QUI NE BOUGE PAS EST DÉJÀ MAÇONNÉE. Les jambages droits
    // d'un plein cintre, la traverse basse d'un trapèze : elles tombent sur
    // le bord même du trou, où le trumeau et l'allège présentent DÉJÀ leur
    // face intérieure. Y coudre une bande de plus posait deux surfaces au
    // même endroit — elles clignotaient l'une sur l'autre dès qu'on tournait.
    const bouge =
      Math.hypot(q1[0] - p1[0], q1[1] - p1[1]) > 0.05 ||
      Math.hypot(q2[0] - p2[0], q2[1] - p2[1]) > 0.05;
    if (!bouge) continue;

    // LES ÉCOINÇONS, sur les deux nus du mur. Le contour tourne dans le sens
    // HORAIRE une fois dans le monde : c'est la face intérieure qui suit
    // l'ordre p1 → p2 → q2 → q1, et l'extérieure qui l'inverse.
    for (const [z, dehors] of [
      [zExterieur, true],
      [zInterieur, false],
    ] as Array<[number, boolean]>) {
      const A = [m(p1[0]), m(p1[1]), m(z)];
      const B = [m(p2[0]), m(p2[1]), m(z)];
      const C = [m(q2[0]), m(q2[1]), m(z)];
      const D = [m(q1[0]), m(q1[1]), m(z)];
      if (dehors) {
        pousser(ecoincons, A, C, B);
        pousser(ecoincons, A, D, C);
      } else {
        pousser(ecoincons, A, B, C);
        pousser(ecoincons, A, C, D);
      }
    }

    // Le TABLEAU : la tranche de mur qu'on voit de biais, celle qui donne
    // sa profondeur à l'image. Sa normale regarde VERS l'ouverture.
    const A = [m(p1[0]), m(p1[1]), m(zExterieur)];
    const B = [m(p2[0]), m(p2[1]), m(zExterieur)];
    const C = [m(p2[0]), m(p2[1]), m(zInterieur)];
    const D = [m(p1[0]), m(p1[1]), m(zInterieur)];
    pousser(tableau, A, B, C);
    pousser(tableau, A, C, D);
  }

  return [
    maillageDeTriangles('mur', materiau, ecoincons),
    maillageDeTriangles('tableau', materiau, tableau),
  ];
}

/**
 * L'ENCADREMENT DE PIERRE — l'arc d'une baie cintrée, l'anneau d'un
 * œil-de-bœuf.
 *
 * Pourquoi il existe : le décor perçait le mur à la bonne forme, et
 * s'arrêtait là. Or au-dessus d'une baie cintrée, un maçon ne pose pas un
 * linteau droit — il monte un ARC, en claveaux dont le nombre est TOUJOURS
 * IMPAIR pour qu'une clé tienne le milieu, avec des joints qui rayonnent du
 * centre. Sans lui, la baie restait un trou dans un aplat d'enduit : la
 * forme y était, la maçonnerie non.
 *
 * Solution écartée : tailler de vrais claveaux, posés à contrepasse, avec
 * leurs lits et leurs joints de 5 mm. On dessine les JOINTS, pas les
 * pierres : le nombre impair et la clé suffisent à ce que l'œil lise « un
 * arc », et au-delà on modélise de la maçonnerie qu'on ne facture pas.
 *
 * L'anneau d'un œil-de-bœuf, lui, reste CONTINU — c'est le « tableau
 * massif » du commerce, une seule pièce percée, et non un appareillage.
 */
const ENCADREMENT = {
  /** La retombée de l'arc : la hauteur de pierre au-dessus de l'intrados. */
  retombeeMm: 190,
  /**
   * La largeur de pierre autour d'un œil-de-bœuf. C'est la cote du
   * commerce : un clair de Ø 800 se vend en 1100 hors-tout, soit 150 mm de
   * pierre tout autour.
   */
  oculusMm: 150,
  /** De combien la pierre est en saillie sur le nu du mur. */
  saillieMm: 25,
  /** Le nombre de claveaux. IMPAIR — sans quoi il n'y a pas de clé. */
  claveaux: 9,
  /** Le joint entre deux claveaux. */
  jointMm: 14,
  /** De combien la CLÉ dépasse ses voisins, en haut de l'arc. */
  cleDebordMm: 60,
} as const;

/** La longueur cumulée le long d'une polyligne. */
function longueursCumulees(points: Array<[number, number]>): number[] {
  const cumul = [0];
  for (let index = 1; index < points.length; index++) {
    cumul.push(
      cumul[index - 1] +
        Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]),
    );
  }
  return cumul;
}

/** Le morceau de polyligne compris entre deux abscisses curvilignes. */
function sousPolyligne(
  points: Array<[number, number]>,
  cumul: number[],
  debut: number,
  fin: number,
): Array<[number, number]> {
  const enL = (l: number): [number, number] => {
    if (l <= 0) return [...points[0]];
    const total = cumul[cumul.length - 1];
    if (l >= total) return [...points[points.length - 1]];
    let index = 1;
    while (index < cumul.length - 1 && cumul[index] < l) index++;
    const part = (l - cumul[index - 1]) / Math.max(1e-9, cumul[index] - cumul[index - 1]);
    return [
      points[index - 1][0] + (points[index][0] - points[index - 1][0]) * part,
      points[index - 1][1] + (points[index][1] - points[index - 1][1]) * part,
    ];
  };
  const morceau: Array<[number, number]> = [enL(debut)];
  for (let index = 0; index < points.length; index++) {
    if (cumul[index] > debut + 1e-6 && cumul[index] < fin - 1e-6) morceau.push([...points[index]]);
  }
  morceau.push(enL(fin));
  return morceau;
}

/**
 * La normale SORTANTE en chaque point d'une polyligne — celle qui s'éloigne
 * du centre de la baie. Sur un arc de cercle c'est le rayon ; sur une anse
 * de panier, qui n'a pas un seul centre, c'est la seule construction juste.
 */
function normalesSortantes(
  points: Array<[number, number]>,
  centre: [number, number],
  ferme: boolean,
): Array<[number, number]> {
  return points.map((point, index) => {
    const avant = points[ferme ? (index - 1 + points.length) % points.length : Math.max(0, index - 1)];
    const apres = points[ferme ? (index + 1) % points.length : Math.min(points.length - 1, index + 1)];
    let tx = apres[0] - avant[0];
    let ty = apres[1] - avant[1];
    const norme = Math.hypot(tx, ty) || 1;
    tx /= norme;
    ty /= norme;
    // Les deux perpendiculaires ; on garde celle qui s'éloigne du centre.
    const nx = -ty;
    const ny = tx;
    const versDehors = (point[0] - centre[0]) * nx + (point[1] - centre[1]) * ny >= 0;
    return [versDehors ? nx : -nx, versDehors ? ny : -ny] as [number, number];
  });
}

/**
 * Un claveau, ou l'anneau entier d'un oculus : le prisme compris entre une
 * ligne d'intrados et sa ligne d'extrados, en saillie sur le nu du mur.
 */
function poserPierre(
  dans: number[],
  intrados: Array<[number, number]>,
  extrados: Array<[number, number]>,
  zAvant: number,
  zArriere: number,
  ferme: boolean,
): void {
  const m = (valeur: number) => valeur / 1000;
  /**
   * Un quadrilatère dont la normale doit regarder DANS UNE DIRECTION DONNÉE.
   * L'enroulement se déduit, il ne se devine pas : c'est précisément la
   * faute qui a rendu le comblement invisible pendant deux lots.
   */
  const quadVers = (a: number[], b: number[], c: number[], d: number[], vers: number[]) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (Math.hypot(nx, ny, nz) < 1e-12) return;
    const bonSens = nx * vers[0] + ny * vers[1] + nz * vers[2] >= 0;
    const ordre = bonSens ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
    for (const sommet of ordre) dans.push(...sommet);
  };

  const dernier = ferme ? intrados.length : intrados.length - 1;
  for (let index = 0; index < dernier; index++) {
    const suivant = (index + 1) % intrados.length;
    const i0 = intrados[index], i1 = intrados[suivant];
    const e0 = extrados[index], e1 = extrados[suivant];
    // Le milieu du secteur, pour orienter les faces sans y réfléchir.
    const versDehors = [
      (e0[0] + e1[0]) / 2 - (i0[0] + i1[0]) / 2,
      (e0[1] + e1[1]) / 2 - (i0[1] + i1[1]) / 2,
      0,
    ];
    const versDedans = versDehors.map((v) => -v);
    // LA FACE VUE DE LA RUE — et son DOS.
    //
    // Le dos est plaqué contre le mur : on ne le voit jamais, et le premier
    // jet ne l'émettait pas pour économiser deux triangles par claveau. Une
    // pierre creuse jette pourtant une ombre creuse — trois.js remplit sa
    // carte d'ombres avec les faces ARRIÈRE d'un matériau `FrontSide`, et
    // l'anneau d'un œil-de-bœuf, qui n'en avait aucune, semait quatre
    // coins d'ombre en biais sur la maçonnerie. Une pierre est pleine.
    quadVers(
      [m(i0[0]), m(i0[1]), m(zAvant)],
      [m(i1[0]), m(i1[1]), m(zAvant)],
      [m(e1[0]), m(e1[1]), m(zAvant)],
      [m(e0[0]), m(e0[1]), m(zAvant)],
      [0, 0, -1],
    );
    quadVers(
      [m(i0[0]), m(i0[1]), m(zArriere)],
      [m(i1[0]), m(i1[1]), m(zArriere)],
      [m(e1[0]), m(e1[1]), m(zArriere)],
      [m(e0[0]), m(e0[1]), m(zArriere)],
      [0, 0, 1],
    );
    // L'INTRADOS — le dessous de l'arc, qui regarde l'ouverture.
    quadVers(
      [m(i0[0]), m(i0[1]), m(zAvant)],
      [m(i1[0]), m(i1[1]), m(zAvant)],
      [m(i1[0]), m(i1[1]), m(zArriere)],
      [m(i0[0]), m(i0[1]), m(zArriere)],
      versDedans,
    );
    // L'EXTRADOS — le dessus, qui regarde le mur.
    quadVers(
      [m(e0[0]), m(e0[1]), m(zAvant)],
      [m(e1[0]), m(e1[1]), m(zAvant)],
      [m(e1[0]), m(e1[1]), m(zArriere)],
      [m(e0[0]), m(e0[1]), m(zArriere)],
      versDehors,
    );
  }
  if (ferme) return;
  // LES DEUX ABOUTS — les joints. Sur un arc ouvert ce sont eux qu'on voit
  // se répéter le long de la courbe, et c'est à eux qu'on reconnaît un
  // appareillage plutôt qu'un bandeau moulé.
  for (const [bout, sens] of [
    [0, -1],
    [intrados.length - 1, 1],
  ] as Array<[number, number]>) {
    const i = intrados[bout], e = extrados[bout];
    const voisin = intrados[bout === 0 ? 1 : intrados.length - 2];
    const vers = [sens * (i[0] - voisin[0]), sens * (i[1] - voisin[1]), 0];
    quadVers(
      [m(i[0]), m(i[1]), m(zAvant)],
      [m(e[0]), m(e[1]), m(zAvant)],
      [m(e[0]), m(e[1]), m(zArriere)],
      [m(i[0]), m(i[1]), m(zArriere)],
      vers,
    );
  }
}

/**
 * L'encadrement de pierre d'une baie : un ARC en claveaux au-dessus d'un
 * sommet cintré, un ANNEAU continu autour d'un œil-de-bœuf.
 *
 * Il rend une pièce nommée `arc` ou `oculus` — un nom, parce qu'une pièce
 * sans nom est une pièce qu'aucun test ne peut voir.
 */
function encadrementDePierre(
  materiau: MeshStandardMaterial,
  contour: Array<[number, number]>,
  encadrement: EncadrementBaie,
  trou: { x0: number; x1: number; bas: number; haut: number },
  zExterieur: number,
): Mesh | null {
  if (encadrement === 'droit' || contour.length < 3) return null;
  const centre: [number, number] = [(trou.x0 + trou.x1) / 2, (trou.bas + trou.haut) / 2];
  const zAvant = zExterieur - ENCADREMENT.saillieMm;
  const positions: number[] = [];

  if (encadrement === 'oculus') {
    const normales = normalesSortantes(contour, centre, true);
    const extrados = contour.map(
      (point, index) =>
        [
          point[0] + normales[index][0] * ENCADREMENT.oculusMm,
          point[1] + normales[index][1] * ENCADREMENT.oculusMm,
        ] as [number, number],
    );
    poserPierre(positions, contour, extrados, zAvant, zExterieur, true);
    return maillageDeTriangles('oculus', materiau, positions);
  }

  // LA NAISSANCE : là où le contour cesse d'être vertical, c'est-à-dire le
  // point le plus haut qui touche encore un jambage. L'arc part de là, et
  // c'est sur les piédroits qu'il retombe — pas dans le vide.
  const surUnJambage = (point: [number, number]) =>
    Math.abs(point[0] - trou.x0) < 0.5 || Math.abs(point[0] - trou.x1) < 0.5;
  const naissance = Math.max(
    ...contour.filter(surUnJambage).map((point) => point[1]),
    trou.bas,
  );
  // Le sommet cintré, dans l'ordre du contour et d'un seul tenant.
  const arc: Array<[number, number]> = [];
  const n = contour.length;
  const depart = contour.findIndex(
    (point, index) =>
      point[1] >= naissance - 0.5 && contour[(index - 1 + n) % n][1] < naissance - 0.5,
  );
  if (depart < 0) return null;
  for (let pas = 0; pas < n; pas++) {
    const point = contour[(depart + pas) % n];
    if (point[1] < naissance - 0.5) break;
    arc.push([...point]);
  }
  if (arc.length < 3) return null;

  const cumul = longueursCumulees(arc);
  const total = cumul[cumul.length - 1];
  const cle = (ENCADREMENT.claveaux - 1) / 2;
  for (let index = 0; index < ENCADREMENT.claveaux; index++) {
    const debut = (total * index) / ENCADREMENT.claveaux + (index === 0 ? 0 : ENCADREMENT.jointMm / 2);
    const fin =
      (total * (index + 1)) / ENCADREMENT.claveaux -
      (index === ENCADREMENT.claveaux - 1 ? 0 : ENCADREMENT.jointMm / 2);
    const intrados = sousPolyligne(arc, cumul, debut, fin);
    // LA CLÉ dépasse ses voisins : c'est elle qui ferme l'arc, et c'est à
    // elle qu'on le reconnaît de la rue.
    const retombee = ENCADREMENT.retombeeMm + (index === cle ? ENCADREMENT.cleDebordMm : 0);
    const normalesDuMorceau = normalesSortantes(intrados, centre, false);
    const extrados = intrados.map(
      (point, k) =>
        [
          point[0] + normalesDuMorceau[k][0] * retombee,
          point[1] + normalesDuMorceau[k][1] * retombee,
        ] as [number, number],
    );
    poserPierre(positions, intrados, extrados, zAvant, zExterieur, false);
  }
  return maillageDeTriangles('arc', materiau, positions);
}

/**
 * LE VERSANT posé sur le rampant — et sa RIVE, la tranche de couverture
 * qu'on voit dépasser du pignon.
 *
 * C'est une seule et même pièce, et c'est ce qui la rend bon marché : un
 * versant de toit vu par le pignon est le rampant EXTRUDÉ dans la
 * profondeur. Sa tranche fait la rive, sa face supérieure fait le toit.
 *
 * Sans profondeur, il ne faisait que la rive — et par-dessus le mur coupé,
 * on voyait le dessus du plafond de la pièce et le fond du décor. Un mur
 * qu'on ouvre demande un toit qui le referme.
 */
function riveDeRampant(
  materiau: MeshStandardMaterial,
  rampant: Array<[number, number]>,
  zExterieur: number,
): Array<Mesh | null> {
  const pieces: Array<Mesh | null> = [];
  const z0 = zExterieur - RAMPANT.debordMm;
  const z1 = zExterieur + PROFONDEUR_MAISON_MM + 300;
  for (let index = 0; index < rampant.length - 1; index++) {
    const a = rampant[index];
    const b = rampant[index + 1];
    const longueur = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (longueur < 1) continue;
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const maille = new Mesh(
      new BoxGeometry(
        (longueur + RAMPANT.debordMm) / 1000,
        RAMPANT.riveEpaisseurMm / 1000,
        (z1 - z0) / 1000,
      ),
      materiau,
    );
    maille.name = 'rampant';
    // Le pavé est posé SUR la ligne du rampant : on le décale d'une
    // demi-épaisseur le long de sa propre perpendiculaire, sans quoi il la
    // chevauche et mord sur la maçonnerie.
    const decalage = RAMPANT.riveEpaisseurMm / 2;
    maille.position.set(
      ((a[0] + b[0]) / 2 - Math.sin(angle) * decalage) / 1000,
      ((a[1] + b[1]) / 2 + Math.cos(angle) * decalage) / 1000,
      (z0 + z1) / 2000,
    );
    maille.rotation.z = angle;
    maille.castShadow = true;
    maille.receiveShadow = true;
    pieces.push(maille);
  }
  return pieces;
}

const RAIL = {
  /** La largeur du rail vue de dessus, et sa hauteur hors sol. */
  largeurMm: 90,
  hauteurMm: 35,
  /** Le poteau de guidage, planté au bout du refoulement. */
  poteauSectionMm: 120,
  poteauHauteurMm: 900,
} as const;

export function margeDeCadrageMm(type: TypeDecor): number {
  const pilier = PILIER.jeuMm + PILIER.sectionMm + PILIER.chapeauDebordMm;
  if (type === 'piliers') return pilier;
  // LE REFOULEMENT NE SE CADRE PAS EN ENTIER, et c'est un arbitrage. Il
  // image deux fois trop large. On en montre le DÉPART : le rail sort du
  //
  // La LONGUEUR exacte, elle, est une COTE : sa place est sur l'élévation
  // et sur le plan de masse, où les cotes vivent déjà.
  if (type === 'rail') return pilier + 700;
  return 0;
}

/**
 * LE NIVEAU DU SOL de ce décor, en millimètres dans le repère du cœur.
 *
 * Il sert à une seule chose, et elle compte : EMPÊCHER LA CAMÉRA DE
 * PASSER DESSOUS. Un sol est une dalle mince ; en tournant vers le bas ou
 * en reculant, on finissait par le traverser et regarder la scène par
 * en dessous — la pelouse vue de sa face cachée, la maison flottant sur
 * rien. C'est le genre de chose qui ruine une image en une seconde et
 * qu'aucun test de géométrie ne voit.
 *
 * Le sol n'est pas au même endroit partout : sous une baie c'est le
 * plancher de la pièce (l'allège sous la menuiserie), dehors c'est le
 * terrain sous la garde au sol, et sur un balcon c'est le dessous de la
 * dalle.
 */
export function niveauDuSolMm(
  type: TypeDecor,
  allegeMm: number,
  /**
   * LE PAN, quand c'en est un. Le terrain n'y est pas sous l'ouvrage : il
   * est sous la RIVE, elle-même sous la fenêtre — et d'autant plus bas que
   * la pente est forte. Un plancher de caméra fixe laissait la vue plonger
   * sous la pelouse à quinze degrés et la coincer au ras des tuiles à
   * soixante ; c'est la même famille d'erreur que la caméra passée sous le
   * gazon, déjà corrigée une fois.
   */
  rampant?: { penteToitDeg?: number; hauteurOuvrageMm: number },
): number {
  // UNE PIÈCE A SON SOL SOUS L'OUVRAGE, et c'est toute la différence avec
  // pose par terre, et le lire comme une fenêtre le faisait flotter d'un
  // mètre (lot D10).
  if (type === 'piece') return -SOL.epaisseurMm;
  if (type === 'baie' || type === 'facade') return -Math.max(0, allegeMm) - SOL.epaisseurMm;
  if (type === 'dalle') return -DALLE.epaisseurMm;
  if (type === 'rampant' && rampant) {
    const pente = inclinaisonDuRampant(rampant.penteToitDeg);
    return (
      -AVAL_RAMPANT_MM(rampant.hauteurOuvrageMm) * Math.cos(pente) -
      MUR_SOUS_RAMPANT_MM -
      SOL.epaisseurMm
    );
  }
  return -GARDE_AU_SOL_MM - SOL.epaisseurMm;
}

/**
 * DE COMBIEN LE CADRAGE DOIT S'ÉLEVER, pour laisser entrer ce qu'il y a
 * derrière.
 *
 * Une baie n'en a pas besoin : on est dans une pièce, et le plafond est le
 * plafond. Dehors, en revanche, cadrer sur le seul ouvrage coupe la maison
 * à mi-toit — et une maison sans toit n'est pas une maison, c'est un mur
 * beige au fond de l'image.
 */
export function hauteurDeCielMm(
  type: TypeDecor,
  dehors: boolean,
  hauteurOuvrageMm?: number,
): number {
  const borne = (ciel: number) =>
    hauteurOuvrageMm === undefined ? ciel : Math.min(ciel, Math.max(0, hauteurOuvrageMm));
  if (type === 'piliers' || type === 'rail' || type === 'terrain') return borne(2600);
  if (type === 'dalle') return borne(1600);
  // DANS UNE PIÈCE, LE PLAFOND EST LE PLAFOND : rien à ajouter au-dessus,
  // comme pour une baie regardée du dedans.
  if (type === 'piece') return 0;
  // Sous un store, on voit la FAÇADE au-dessus : sans elle le store flotte
  // devant un aplat beige, et on ne sait plus à quelle maison il est vissé.
  if (type === 'facade') return borne(1900);
  // UNE BAIE REGARDÉE DU DEHORS — un volet, une porte d'entrée. Cadrée sur
  // le seul ouvrage, elle s'affiche dans un aplat de mur : on ne voit ni le
  // toit, ni les fenêtres voisines, et la façade construite derrière ne
  // sert à rien. Du DEDANS, au contraire, le plafond est le plafond : rien
  // à ajouter.
  if (type === 'baie' && dehors) return borne(2400);
  // SUR UN RAMPANT, RIEN À AJOUTER : le pan est déjà taillé serré autour de
  // la fenêtre (voir `AMONT_RAMPANT_MM`), et l'élargir encore la réduirait
  // à un timbre sur un aplat de tuiles. Ce qu'on achète est la fenêtre, pas
  // la couverture.
  if (type === 'rampant') return 0;
  return 0;
}

function piliersDePortail(
  materiauMur: MeshStandardMaterial,
  materiauChapeau: MeshStandardMaterial,
  demiLargeur: number,
  haut: number,
): Array<Mesh | null> {
  const pieces: Array<Mesh | null> = [];
  const hautPilier = haut + PILIER.arasementMm;
  const z0 = -PILIER.sectionMm / 2;
  const z1 = PILIER.sectionMm / 2;
  for (const cote of [-1, 1] as const) {
    const interieur = cote * (demiLargeur + PILIER.jeuMm);
    const exterieur = interieur + cote * PILIER.sectionMm;
    const [x0, x1] = cote < 0 ? [exterieur, interieur] : [interieur, exterieur];
    // Le fût, du sol à l'arasement — il descend SOUS la garde au sol du
    pieces.push(panneau('pilier', materiauMur, x0, x1, -GARDE_AU_SOL_MM, hautPilier, z0, z1));
    // Le CHAPEAU, qui déborde de toutes parts : c'est lui qui empêche l'eau
    // de ruisseler sur le fût et de le lessiver.
    pieces.push(
      panneau(
        'chapeau',
        materiauChapeau,
        x0 - PILIER.chapeauDebordMm,
        x1 + PILIER.chapeauDebordMm,
        hautPilier,
        hautPilier + PILIER.chapeauEpaisseurMm,
        z0 - PILIER.chapeauDebordMm,
        z1 + PILIER.chapeauDebordMm,
      ),
    );
  }
  return pieces;
}

function railDeCoulissant(
  materiauMur: MeshStandardMaterial,
  materiauChapeau: MeshStandardMaterial,
  demiLargeur: number,
  haut: number,
  refoulement: { sens: -1 | 1; longueurMm: number },
): Array<Mesh | null> {
  const pieces: Array<Mesh | null> = [];
  // Le vantail s'efface du côté de `sens` ; le PILIER DE RÉCEPTION est donc
  const cote = -refoulement.sens as -1 | 1;
  const hautPilier = haut + PILIER.arasementMm;
  const interieur = cote * (demiLargeur + PILIER.jeuMm);
  const exterieur = interieur + cote * PILIER.sectionMm;
  const [x0, x1] = cote < 0 ? [exterieur, interieur] : [interieur, exterieur];
  pieces.push(
    panneau('pilier', materiauMur, x0, x1, -GARDE_AU_SOL_MM, hautPilier, -PILIER.sectionMm / 2, PILIER.sectionMm / 2),
  );
  pieces.push(
    panneau(
      'chapeau',
      materiauChapeau,
      x0 - PILIER.chapeauDebordMm,
      x1 + PILIER.chapeauDebordMm,
      hautPilier,
      hautPilier + PILIER.chapeauEpaisseurMm,
      -PILIER.sectionMm / 2 - PILIER.chapeauDebordMm,
      PILIER.sectionMm / 2 + PILIER.chapeauDebordMm,
    ),
  );

  // LE RAIL, du pilier de réception jusqu'au bout du refoulement. Sa
  // longueur EST la cote qui manque au client.
  const boutRefoulement = refoulement.sens * (demiLargeur + refoulement.longueurMm);
  const [rail0, rail1] = refoulement.sens < 0 ? [boutRefoulement, interieur] : [interieur, boutRefoulement];
  pieces.push(
    panneau(
      'rail',
      materiauChapeau,
      rail0,
      rail1,
      -GARDE_AU_SOL_MM,
      -GARDE_AU_SOL_MM + RAIL.hauteurMm,
      -RAIL.largeurMm / 2,
      RAIL.largeurMm / 2,
    ),
  );

  // LE POTEAU DE GUIDAGE, au bout : il tient le vantail effacé et marque
  // la fin du refoulement.
  const guide0 = boutRefoulement - refoulement.sens * RAIL.poteauSectionMm;
  pieces.push(
    panneau(
      'poteau-guidage',
      materiauMur,
      Math.min(guide0, boutRefoulement),
      Math.max(guide0, boutRefoulement),
      // UN POTEAU EST PLANTÉ, pas posé : il descend sous le niveau du sol.
      // Arasé au ras du rail, son dessous partageait le plan du dessous du
      // rail — invisible, mais c'est la même coïncidence qui fait clignoter
      // les faces qu'on voit.
      -GARDE_AU_SOL_MM - 60,
      RAIL.poteauHauteurMm,
      -RAIL.poteauSectionMm / 2,
      RAIL.poteauSectionMm / 2,
    ),
  );
  return pieces;
}

/**
 * Le décor, aux cotes de l'ouvrage. Rendu comme un groupe que la scène
 * ajoute — et retire — d'un bloc.
 *
 * Le repère est celui du cœur : x centré sur l'ouvrage, y = 0 au bas du
 * dormant, z = 0 au nu extérieur.
 */
/**
 * CE QUE LE PAN DÉBORDE de la fenêtre, dans son plan, en amont (vers le
 * faîtage) et en aval (vers la rive). Deux fonctions et non deux nombres :
 * le cadrage de la scène en a besoin autant que la construction, et un pan
 * dessiné d'une taille et cadré d'une autre laisse la caméra sous les
 * tuiles.
 */
const AMONT_RAMPANT_MM = (hauteurOuvrageMm: number) => Math.max(2000, hauteurOuvrageMm * 1.4);
const AVAL_RAMPANT_MM = (hauteurOuvrageMm: number) => Math.max(2000, hauteurOuvrageMm * 1.4);
/** Le mur porté sous la rive, en mm — ce sur quoi le toit est posé. */
const MUR_SOUS_RAMPANT_MM = 2600;

/**
 * LE PAN DE COUVERTURE d'une fenêtre de toit, percé à sa mesure.
 *
 * CE QU'IL FAUT COMPRENDRE AVANT DE LE LIRE : l'ouvrage arrive VERTICAL,
 * comme toute menuiserie de ce cœur — c'est l'objet fabriqué, et le rapport
 * de mesure le décrit debout. C'est la SCÈNE qui le couche dans la pente,
 * du même angle que ce décor. Les deux tournent ensemble ou l'un traverse
 * l'autre ; c'est pourquoi l'angle se calcule ICI, une fois, et que la
 * scène le relit par `inclinaisonDuRampant()`.
 *
 * La rotation va du plan VERTICAL au plan du toit : (90° − pente). À 35°,
 * le pan bascule de 55° en arrière ; à 90°, il ne bascule plus du tout — et
 * c'est bien ce que dit la règle de la famille, qui refuse au-delà : « ce
 * n'est plus un toit, c'est un mur ».
 */
function construireRampant(
  horsToutMm: { xMm: number; yMm: number; zMm: number },
  options: OptionsDecor,
  document_?: Document,
): Group {
  const groupe = new Group();
  groupe.name = 'decor';
  const env = matieresDecor(document_);
  const pente = inclinaisonDuRampant(options.penteToitDeg);

  const demiLargeur = horsToutMm.xMm / 2;
  const haut = horsToutMm.yMm;
  // L'ÉPAISSEUR DU PAN — chevrons, isolant, liteaux, tuiles. Quarante
  // centimètres est l'ordre de grandeur d'une toiture isolée, et c'est ce
  // qui donne au tableau de la fenêtre sa profondeur : une fenêtre de toit
  // se voit toujours au fond d'une embrasure épaisse.
  const epaisseur = 400;
  // Ce que le pan déborde autour de la fenêtre, DANS son plan.
  // LE PAN RESTE SERRÉ AUTOUR DE LA FENÊTRE, et c'est un arbitrage de
  // cadrage : un toit de huit mètres réduisait la menuiserie à un timbre au
  // milieu d'un aplat de tuiles. On en montre assez pour qu'on lise « c'est
  // un toit », pas la maison entière — elle n'est pas ce qu'on achète.
  const cote = Math.max(2400, demiLargeur * 3);
  const amont = AMONT_RAMPANT_MM(haut);
  const aval = AVAL_RAMPANT_MM(haut);

  const pan = new Group();
  pan.name = 'rampant';
  // Le pan bascule en arrière : monter dans son plan, c'est monter ET
  // reculer. C'est ce qui fait qu'on voit un toit et non une façade.
  pan.rotation.x = -pente;
  const tuile = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
  ) => {
    if (x1 - x0 < 1 || y1 - y0 < 1) return;
    const maille = new Mesh(new BoxGeometry(x1 - x0, y1 - y0, epaisseur), env.toiture);
    maille.position.set((x0 + x1) / 2, (y0 + y1) / 2, -epaisseur / 2);
    maille.castShadow = true;
    maille.receiveShadow = true;
    pan.add(maille);
  };
  // QUATRE PANNEAUX AUTOUR DU TROU, jamais une soustraction : c'est la même
  // règle que le mur d'une baie — aucun CSG dans ce décor.
  tuile(-demiLargeur - cote, -demiLargeur, -aval, haut + amont);
  tuile(demiLargeur, demiLargeur + cote, -aval, haut + amont);
  tuile(-demiLargeur, demiLargeur, haut, haut + amont);
  tuile(-demiLargeur, demiLargeur, -aval, 0);
  groupe.add(pan);

  // LA RIVE BASSE ET LE MUR DESSOUS. Un pan de toit qui s'arrête dans le
  // vide flotte ; c'est la gouttière et le haut du mur qui disent qu'on est
  // sur une maison, et à quelle hauteur.
  // OÙ TOMBE LA RIVE, dans le repère du monde. Une rotation d'axe X de
  // −`pente` envoie le point local (0, y, 0) sur (y·cos pente, −y·sin pente)
  // : descendre le rampant, c'est descendre ET revenir vers le spectateur.
  // Le premier jet avait échangé le sinus et le cosinus — la gouttière
  // partait alors dans le toit, et le mur avec elle.
  const yRive = -aval * Math.cos(pente);
  const zRive = aval * Math.sin(pente);
  const gouttiere = new Mesh(
    new BoxGeometry(2 * (demiLargeur + cote), 140, 160),
    env.menuiserieVoisine,
  );
  gouttiere.position.set(0, yRive - 90, zRive + 80);
  gouttiere.castShadow = true;
  groupe.add(gouttiere);

  // LE MUR sous la gouttière, jusqu'à un plancher qu'on ne voit pas : il
  // n'est là que pour poser le toit sur quelque chose.
  const hauteurMur = MUR_SOUS_RAMPANT_MM;
  const mur = new Mesh(
    new BoxGeometry(2 * (demiLargeur + cote) - 300, hauteurMur, 3000),
    env.enduit,
  );
  mur.position.set(0, yRive - hauteurMur / 2, zRive - 1500);
  mur.receiveShadow = true;
  groupe.add(mur);

  // LE TERRAIN, loin dessous. Il donne l'échelle : sans lui, un pan de toit
  // isolé pourrait aussi bien faire deux mètres que dix — et c'est
  // exactement ce qu'on ne veut pas d'une fenêtre qu'on juge de loin.
  groupe.add(
    construireDehors(env, {
      demiLargeurMm: demiLargeur + cote,
      solMm: yRive - hauteurMur,
      hauteurOuvrageMm: haut,
      zFondMm: zRive + 3000,
    }),
  );

  // La marque du niveau du sol, pour les tests : voir `basDuDecorMm`.
  groupe.userData.basMm = yRive - hauteurMur;
  groupe.userData.penteRad = pente;
  return groupe;
}

/**
 * L'INCLINAISON DU PAN, en radians — l'angle dont la scène doit coucher
 * l'ouvrage pour qu'il entre dans le toit.
 *
 * Exportée parce que DEUX modules en dépendent et qu'ils ne peuvent pas
 * diverger : le décor tourne le pan, la scène tourne la menuiserie. Un
 * demi-degré d'écart et la fenêtre traverse la couverture.
 */
export function inclinaisonDuRampant(penteToitDeg: number | undefined): number {
  const pente = Math.min(90, Math.max(5, penteToitDeg ?? 35));
  return Math.PI / 2 - (pente * Math.PI) / 180;
}

export function construireDecor(
  horsToutMm: { xMm: number; yMm: number; zMm: number },
  options: OptionsDecor,
  /**
   * Le document qui sert à DESSINER les textures procédurales — grain
   * d'enduit, fil de bois. Optionnel : dans Node, où les tests de décor
   * vérifient des cotes et non des pixels, il n'y a pas de canevas, et le
   * décor doit se construire quand même.
   */
  document_?: Document,
): Group {
  const groupe = new Group();
  groupe.name = 'decor';

  // ---- LE PAN DE COUVERTURE : le seul décor qui ne soit pas vertical ----
  //
  // Une fenêtre de toit se pose DANS la pente. Elle sortait jusqu'ici dans
  // le décor `baie`, c'est-à-dire verticale dans un mur de maison, avec le
  // toit dessiné juste au-dessus d'elle — la capture montrait une petite
  // fenêtre de couloir sous un rampant, et personne n'aurait reconnu le
  // produit qu'on lui vendait.
  //
  // IL EST CONSTRUIT ET RENDU ICI, sans passer par la suite de la fonction :
  // tout ce qui vient après suppose un mur vertical, un sol au pied et une
  // allège. Un pan de toit n'a rien de tout cela — il a une PENTE, une
  // rive basse, et du ciel autour.
  if (options.type === 'rampant') {
    return construireRampant(horsToutMm, options, document_);
  }

  // Le mur est volontairement plus SOMBRE que la menuiserie : un enduit
  // clair sous une fenêtre blanche redonnait le même éblouissement que le
  // fond blanc d'origine, et les profilés reperdaient leurs arêtes.
  const materiauMur = new MeshStandardMaterial({
    color: new Color(options.murHex ?? '#b0a695'),
    roughness: 0.96,
    metalness: 0,
  });
  const materiauSol = new MeshStandardMaterial({
    color: new Color(options.solHex ?? '#7d7365'),
    roughness: 0.9,
    metalness: 0,
  });

  const debord = Math.max(MUR.debordMm, options.debordMm ?? 0);
  const demiLargeur = horsToutMm.xMm / 2;
  const contourBaie =
    options.contourMm && options.contourMm.length >= 3 ? options.contourMm : null;
  // LA FAÇADE, quand il y en a une : ce n'est plus un fragment de mur mais
  // le mur D'UNE MAISON. Le décor d'une baie s'arrêtait à 900 mm autour de
  // l'ouverture ; vu de l'intérieur cela suffisait, mais dès qu'on tournait
  // autour, la fenêtre se retrouvait dans un panneau de maçonnerie posé sur
  // une pelouse. Elle doit être là où elle serait vraiment : dans une
  // façade, à côté d'autres fenêtres, sous un toit.
  // UNE FAÇADE DE PIGNON EST PLUS ÉTROITE. La maison ne rétrécit pas : on
  // cadre le pignon, qui est le pan court d'une maison — et surtout, une
  // pente prolongée sur neuf mètres descend d'un mètre et demi, ce qui ne
  // ressemble plus à rien.
  const demiFacade =
    options.rampant && options.type === 'baie'
      ? Math.max(3300, demiLargeur + 1700, demiLargeur + debord)
      : Math.max(4600, demiLargeur + 3000, demiLargeur + debord);
  const haut = horsToutMm.yMm;
  // LA HAUTEUR AU DROIT DES BORDS — celle sur laquelle un pilier s'arase.
  // Elle vaut le hors-tout sur une forme droite, et le cœur la corrige dès
  // que le sommet monte au milieu.
  const hautAuxBords = Math.min(haut, options.hauteurAuxBordsMm ?? haut);
  const allege = Math.max(0, options.allegeMm);
  const basDuMur = -allege;
  // LE PIED DE LA FAÇADE — sous le plancher, pas à son nu. Voir
  // `MUR.soubassementMm` : le mur s'arrêtait sur le vide et montrait sa
  // sous-face dès qu'on le regardait d'en bas.
  const basFacade = basDuMur - MUR.soubassementMm;
  // Le mur va du nu extérieur (légèrement en saillie) jusque dans la pièce :
  // c'est ce retour intérieur — le tableau — qui donne la profondeur.
  const fondDuMeubleMm = Math.max(0, horsToutMm.zMm);
  const zExterieur = -MUR.saillieExterieureMm;
  const zInterieur = MUR.epaisseurMm - MUR.saillieExterieureMm;

  // LE TROU SE PERCE SUR LA BOÎTE DU CONTOUR, jamais sur le hors-tout. Les
  // deux se confondent — c'est même ce qu'un test exige — mais ils se
  // confondent parce que le cœur a été corrigé, pas par nature : un
  // œil-de-bœuf commandé en 1600 × 1350 rendait un hors-tout de 1475, et le
  // cercle se retrouvait collé à droite dans sa propre baie. Percer sur ce
  // qu'on va vraiment poser est la seule façon que les deux ne divergent
  // jamais plus.
  const trou = (() => {
    if (!contourBaie) return { x0: -demiLargeur, x1: demiLargeur, bas: 0, haut: horsToutMm.yMm };
    let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of contourBaie) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    // Le BAS reste le seuil : toutes les formes y descendent, et l'allège
    // est ce qui se trouve dessous.
    return { x0, x1, bas: 0, haut: y1 };
  })();

  const type = options.type;
  /**
   * La demi-largeur de la PIÈCE. Elle vaut désormais toute la largeur
   * disponible sous la façade, et c'est un arbitrage assumé.
   *
   * Elle valait `max(1900, demiLargeur + 1300)` — la largeur d'une chambre,
   * ce qui est juste sur un plan. Mais la caméra cadre depuis 3 à 4 mètres :
   * dès qu'on la faisait tourner au-delà d'un demi-radian, elle sortait de
   * la pièce par un mur de retour et se retrouvait DANS la maçonnerie.
   * L'écran devenait alors uniformément beige — la couleur de l'enduit vue
   * de l'intérieur d'un mur. Deux vues sur vingt-neuf n'affichaient plus
   * rien du tout (docs/18 §2.9).
   *
   * Une pièce plus large n'est pas moins crédible : ses murs de retour
   * sortent simplement du champ, et ce qu'on garde — le sol, le plafond,
   * le tableau — est exactement ce qui donne son échelle à la fenêtre. Une
   * caméra qui traverse un mur, elle, n'est jamais crédible.
   */
  const demiPiece = demiFacade - 400;
  // LE RAMPANT, quand la baie est une baie de pignon. Il change tout le
  // haut de la façade : le mur n'y monte plus jusqu'à une gouttière
  // horizontale, il s'arrête sur la pente du toit.
  const rampant =
    type === 'baie' && options.rampant && contourBaie
      ? rampantDuContour(
          contourBaie,
          demiFacade,
          RAMPANT.margeMm,
          // L'ÉGOUT, un peu au-dessus du seuil : sous un comble, le toit
          // descend bas — c'est même ce qui fait qu'on y met une baie de
          // cette forme — mais il ne passe pas sous la fenêtre.
          trou.bas + RAMPANT.egoutMm,
        )
      : null;
  // LA HAUTEUR SOUS GOUTTIÈRE — et une MAISON DE PLAIN-PIED, à dessein.
  //
  // Le premier jet montait à 5,4 m, la hauteur d'une maison à étage. Le
  // toit ne rentrait alors JAMAIS dans le cadre : cadrer une porte de
  // 2,15 m et un faîtage à 7 m demande six mètres d'image, où la porte —
  // ce qu'on vend — devient un trait. On ne voyait donc qu'un aplat
  // d'enduit, et la maison construite derrière ne servait a rien.
  //
  // À 3,1 m, la gouttière et son toit entrent dans le champ juste
  // au-dessus de l'ouvrage. C'est une maison de plain-pied : moins
  // fréquente qu'un R+1, mais VISIBLE — et un toit qu'on voit vaut mieux
  // qu'un etage qu'on devine.
  const gouttiereFacade =
    type === 'facade'
      ? // Sous un store, la gouttière passe AU-DESSUS de lui : il est vissé
        // en haut du mur, souvent juste sous le débord de toit.
        Math.max(haut + 500, basDuMur + 3100)
      : Math.max(haut + 1100, basDuMur + 3100);
  // Le mur n'est PERCÉ que pour une baie. Ailleurs il n'y a pas de mur du
  const perce = type === 'baie';
  // La pierre de l'appui et le bois de la tablette : deux matières de plus,
  // et deux seulement. Le décor doit rester un décor — il donne l'échelle,
  // il ne se vend pas.
  const materiauAppui = new MeshStandardMaterial({
    color: new Color(options.appuiHex ?? '#9c968b'),
    roughness: 0.88,
    metalness: 0,
  });
  // Les matières de l'ENVIRONNEMENT, créées ici parce que la RIVE du
  // rampant en a besoin : une rive de toit se couvre du même matériau que
  // le toit, sans quoi elle se lit comme un bandeau de béton.
  const env = matieresDecor(document_);
  //
  // ELLE FAISAIT L'INVERSE DE CE QU'ELLE DIT, et pendant tout ce temps
  // (lot D17). `Math.max(14000, demiLargeur * 6)` recule la maison quand
  // l'ouvrage est GRAND et la plaque au minimum quand il est PETIT —
  // mètre se cadre à un mètre soixante : la maison de sept mètres restait
  // à quatorze, et remplissait le fond.
  //
  // Elle s'éloigne donc À MESURE QUE L'OUVRAGE EST PETIT, ce que le
  // mètre, quatorze — le recul d'un jardin, celui des piliers — dès six
  // mètres d'ouvrage. Le sol la suit, puisque c'est cette même cote qui
  // dit jusqu'où il va.
  const reculMaison =
    options.type === 'terrain'
      ? Math.min(38000, 14000 + 8 * Math.max(0, 3000 - Math.min(3000, demiLargeur)))
      : 14000;
  const materiauTablette = new MeshStandardMaterial({
    color: new Color(options.tabletteHex ?? '#d8cfc0'),
    roughness: 0.7,
    metalness: 0,
  });
  // LE BORD DU MUR — ce sur quoi l'anneau vient se coudre.
  //
  // Sur une façade droite c'est le TROU : quatre panneaux autour, et
  // l'anneau ne comble que ce qui reste entre le rectangle et la forme.
  // Sur un PIGNON c'est la façade entière, rampant compris : le mur n'y
  // monte plus jusqu'à une gouttière horizontale, et aucune boîte ne sait
  // s'arrêter sur une pente. Le même anneau tuile alors toute la façade,
  // percée de sa baie — c'est exactement le même calcul, avec un bord de
  // neuf mètres au lieu d'un bord d'un mètre six.
  const bordDuMur: Array<[number, number]> = rampant
    ? [[-demiFacade, basFacade], ...rampant, [demiFacade, basFacade]]
    : [
        [trou.x0, trou.bas],
        [trou.x0, trou.haut],
        [trou.x1, trou.haut],
        [trou.x1, trou.bas],
      ];
  const pieces = perce
    ? [
        // Les deux TRUMEAUX — les pans de façade de part et d'autre de la
        // baie. Leur face intérieure, au bord de l'ouverture, forme le
        // TABLEAU : l'épaisseur qu'on voit de biais, celle qui donne toute
        // la profondeur à l'image.
        rampant
          ? null
          : panneau('mur', materiauMur, -demiFacade, trou.x0, basFacade, gouttiereFacade, zExterieur, zInterieur),
        rampant
          ? null
          : panneau('mur', materiauMur, trou.x1, demiFacade, basFacade, gouttiereFacade, zExterieur, zInterieur),
        // Le linteau, et tout le pan de façade au-dessus.
        rampant
          ? null
          : panneau('linteau', materiauMur, trou.x0, trou.x1, trou.haut, gouttiereFacade, zExterieur, zInterieur),
        // L'allège, quand il y en a une : sous une porte, il n'y en a pas.
        allege > 0 && !rampant
          ? panneau('allege', materiauMur, trou.x0, trou.x1, basFacade, trou.bas, zExterieur, zInterieur)
          : null,
        // Et le comblement, quand la menuiserie n'est pas rectangulaire.
        ...(contourBaie
          ? comblementDeForme(materiauMur, contourBaie, bordDuMur, zExterieur, zInterieur)
          : []),
        // L'ARC de décharge, ou l'ANNEAU de l'œil-de-bœuf. La pierre est
        // celle de l'appui : c'est la même dans la vraie vie.
        contourBaie
          ? encadrementDePierre(
              materiauAppui,
              contourBaie,
              options.encadrement ?? 'droit',
              trou,
              zExterieur,
            )
          : null,
        // LA RIVE du toit, posée sur le rampant.
        ...(rampant ? riveDeRampant(env.toiture, rampant, zExterieur) : []),
      ]
    : type === 'facade'
      ? [
          // LA FAÇADE D'UNE MAISON, pas un panneau. Le store se visse
          // dessus ; sans toit ni ouvertures autour, il s'ombrageait un
          // aplat beige et on ne savait pas à quelle maison il tenait.
          panneau(
            'mur',
            materiauMur,
            -demiFacade,
            demiFacade,
            basFacade,
            gouttiereFacade,
            0,
            MUR.epaisseurMm,
          ),
        ]
      : type === 'piece'
        ? [
            // et il s'arrête au plafond de la pièce : ce qui est au-dessus
            // n'existe pas pour qui regarde son salon.
            //
            // IL EST INDISPENSABLE, et c'est ce que le lot D10 a mesuré : la
            // pièce seule (sol, plafond, retours) n'a PAS de mur du fond, par
            // décision écrite — « la caméra est dedans, un quatrième mur lui
            // passerait derrière la nuque ». Vrai pour une fenêtre, qu'on
            // sur le vide.
            panneau(
              'mur',
              materiauMur,
              -demiPiece,
              demiPiece,
              basDuMur,
              Math.max(haut + 320, basDuMur + 2500),
              // depuis sa face (`zCentre = -profondeur / 2`) et font sortir
              // les façades en z positif. Le mur se place donc au-delà du
              // fond, jamais devant — la première rédaction l'a mis à
              // `zInterieur`, c'est-à-dire DEVANT, et la vue « Dedans » ne
              -fondDuMeubleMm - MUR.epaisseurMm,
              -fondDuMeubleMm,
            ),
          ]
      : type === 'piliers'
        ? // DEUX PILIERS, et rien au-dessus. La pierre du chapeau est celle
          // de l'appui de fenêtre : c'est la même dans la vraie vie.
          piliersDePortail(materiauMur, materiauAppui, demiLargeur, hautAuxBords)
        : type === 'rail'
          ? railDeCoulissant(
              materiauMur,
              materiauAppui,
              demiLargeur,
              hautAuxBords,
              // À défaut de refoulement connu, on le prend égal au passage :
              options.refoulement ?? { sens: -1, longueurMm: demiLargeur * 2 },
            )
        : type === 'dalle'
          ? [
              // le vide — c'est ce vide qui explique pourquoi il existe, et
              // pourquoi ses barreaux sont si serrés.
              panneau(
                'dalle',
                materiauSol,
                -demiLargeur - debord,
                demiLargeur + debord,
                -DALLE.epaisseurMm,
                0,
                -DALLE.retraitRiveMm,
                DALLE.profondeurMm,
              ),
            ]
          : // LE TERRAIN seul. Un ouvrage linéaire porte ses propres
            // poteaux : le métré les compte, la géométrie les dessine, et
            // le décor n'a rien à ajouter qu'un sol.
            [];
  // L'APPUI et sa TABLETTE — seulement sous une vraie ALLÈGE. Une
  // porte-fenêtre n'a pas d'appui, elle a un seuil ; une porte d'entrée non
  // plus. Le test `allege > 0` dit exactement « il y a du mur là-dessous »,
  // c'est-à-dire « c'est une fenêtre ».
  // UN ŒIL-DE-BŒUF N'A PAS D'APPUI, et ce n'est pas un détail : c'est le
  // problème connu de ce produit. Faute de seuil, l'eau n'a nulle part où
  // s'écouler ; le métier la règle par un cochonnet qui fait le tour de la
  // baie et par un recul du dormant dans le tableau — pas par une pierre
  // d'appui à rejingot, qui n'aurait aucun bord droit sur lequel s'appuyer.
  // Le décor lui servait pourtant l'appui, son rejingot ET sa tablette.
  if (perce && allege > 0 && options.encadrement !== 'oculus') {
    const appui = panneau(
      'appui',
      materiauAppui,
      -demiLargeur - APPUI.debordLateralMm,
      demiLargeur + APPUI.debordLateralMm,
      -APPUI.epaisseurMm,
      0,
      zExterieur - APPUI.saillieMm,
      APPUI.rejingotProfondeurMm,
    );
    if (appui) {
      // La PENTE, donnée par une rotation : le nez de l'appui plonge vers
      // la rue. Un appui horizontal retient l'eau, elle gèle, et la pierre
      // se fend — c'est la première chose qu'un maçon corrige.
      const pente = (APPUI.penteDeg * Math.PI) / 180;
      appui.rotation.x = -pente;
      // Une rotation autour du CENTRE fait plonger le nez ET remonter la
      // culée d'autant. Six millimètres, et l'appui venait butter sous le
      // dormant qu'il est censé porter. On le redescend de ce que la pente
      // lui a fait gagner : le dessus de sa culée revient au nu du seuil,
      // exactement là où la menuiserie se pose.
      const profondeurAppui = APPUI.rejingotProfondeurMm + APPUI.saillieMm - zExterieur;
      appui.position.y -= (Math.sin(pente) * profondeurAppui) / 2000;
      pieces.push(appui);
    }
    // Le REJINGOT, derrière lequel le dormant vient se poser.
    pieces.push(
      panneau(
        'rejingot',
        materiauAppui,
        -demiLargeur - APPUI.debordLateralMm,
        demiLargeur + APPUI.debordLateralMm,
        0,
        APPUI.rejingotHauteurMm,
        zExterieur - APPUI.rejingotProfondeurMm,
        zExterieur,
      ),
    );
    // La TABLETTE intérieure — la planche d'appui côté pièce, celle sur
    // laquelle on pose les plantes.
    pieces.push(
      panneau(
        'tablette',
        materiauTablette,
        -demiLargeur - TABLETTE.debordLateralMm,
        demiLargeur + TABLETTE.debordLateralMm,
        -TABLETTE.epaisseurMm - TABLETTE.retraitMm,
        -TABLETTE.retraitMm,
        zInterieur - TABLETTE.profondeurMm * 0.55,
        zInterieur + TABLETTE.profondeurMm * 0.45,
      ),
    );
  }

  // ── L'ENVIRONNEMENT ─────────────────────────────────────────────────
  //
  // marchand l'a dit en le regardant — « on doit voir la maison derrière et
  //
  // Tout est bâti en volumes, sans une texture : c'est une maquette
  // d'architecte, et c'est un choix — voir l'en-tête de `environnement.ts`.
  /** Poser une pièce d'environnement, quand elle existe. */
  const poserFond = (piece: Mesh | Group | null) => {
    if (piece) groupe.add(piece);
  };
  const solEnv =
    type === 'baie' || type === 'facade' || type === 'piece' ? basDuMur : -GARDE_AU_SOL_MM;

  if (type === 'baie') {
    // LA MAISON AUTOUR DE LA BAIE : sa toiture, sa porte d'entrée, ses
    // autres fenêtres. La menuiserie qu'on configure est alors LA SIENNE —
    // celle qu'on remplace — au milieu de celles qu'on garde.
    groupe.add(
      habillerFacade(env, {
        demiLargeurFacadeMm: demiFacade,
        solMm: basDuMur,
        gouttiereMm: gouttiereFacade,
        faitageMm: gouttiereFacade + 1700,
        profondeurMm: PROFONDEUR_MAISON_MM,
        zExterieurMm: zExterieur,
        piedMm: basFacade,
        baie: { demiLargeurMm: demiLargeur, basMm: basDuMur, hautMm: haut },
        ...(rampant ? { rampant } : {}),
      }),
    );
    // On regarde sa fenêtre depuis SA PIÈCE, et par elle on voit le jardin.
    // C'est ce qui donne enfin une profondeur au clair de vitrage : devant
    // un fond uni, une baie de quatre mètres et un châssis de soixante
    // centimètres se ressemblent.
    groupe.add(
      construirePiece(env, {
        // LA PIÈCE est plus étroite que la façade : une chambre ne fait pas
        // la largeur de la maison. Elle suivait le débord du mur, et le mur
        // étant devenu une façade de neuf mètres, la pièce l'était aussi.
        demiLargeurMm: demiPiece,
        solMm: basDuMur,
        plafondMm: Math.max(haut + 320, basDuMur + 2500),
        zDebutMm: zInterieur,
        profondeurMm: 5200,
        // SOUS UN COMBLE, la pièce n'a pas de plafond : elle a le rampant.
        ...(rampant
          ? {
              sousRampant: {
                gaucheMm: hauteurDuRampant(rampant, -demiPiece) - 60,
                droiteMm: hauteurDuRampant(rampant, demiPiece) - 60,
              },
            }
          : {}),
      }),
    );
    groupe.add(
      construireDehors(env, {
        demiLargeurMm: demiLargeur,
        solMm: basDuMur,
        hauteurOuvrageMm: haut,
        // LE TERRAIN PASSE SOUS LA MAISON. Il s'arrêtait au nu de la façade,
        // et la maison se tenait au bord du vide au lieu d'être posée sur
        // l'herbe. Il va maintenant jusque derrière son mur de fond.
        zFondMm: PROFONDEUR_MAISON_MM + 3000,
      }),
    );
  } else if (type === 'piece') {
    // fonction que pour une fenêtre regardée du dedans, et c'est le sujet du
    // lot D10 : le décor d'intérieur n'était pas à INVENTER, il était à
    // ROUTER. Ce qui manquait n'était pas de la géométrie, c'était une valeur
    // dans un type — et la question que personne n'avait posée à une famille
    //
    // AUCUN DEHORS N'EST POSÉ ICI : ni terrain, ni toiture, ni façade. Un
    groupe.add(
      construirePiece(env, {
        demiLargeurMm: demiPiece,
        solMm: basDuMur,
        plafondMm: Math.max(haut + 320, basDuMur + 2500),
        // z négatifs depuis sa face ; le mur est donc DERRIÈRE lui, et la
        // pièce s'étend devant, du côté où sont les façades et la poignée.
        zDebutMm: -fondDuMeubleMm,
        profondeurMm: 5200,
      }),
    );
  } else if (type === 'facade') {
    // Un store banne est vissé sur UNE MAISON, au-dessus d'une terrasse —
    // et sous lui il y a la PORTE-FENÊTRE qu'il abrite. Sans elle, il
    // ombrage un mur, et personne ne comprend à quoi il sert.
    groupe.add(
      habillerFacade(env, {
        demiLargeurFacadeMm: demiFacade,
        solMm: basDuMur,
        gouttiereMm: gouttiereFacade,
        faitageMm: gouttiereFacade + 1700,
        profondeurMm: PROFONDEUR_MAISON_MM,
        zExterieurMm: 0,
        piedMm: basFacade,
        // Seule la BANDE DE FIXATION du store est protégée : le mur en
        // dessous doit rester libre, c'est là que va la porte-fenêtre.
        baie: { demiLargeurMm: demiLargeur, basMm: haut - 250, hautMm: haut + 250 },
        porteCentrale: true,
      }),
    );
    poserFond(
      construireHaie(env, {
        x0Mm: -demiLargeur - 12000,
        x1Mm: demiLargeur + 12000,
        zMm: -9000,
        hauteurMm: 1600,
        solMm: basDuMur,
      }),
    );
  } else if (type === 'piliers' || type === 'rail') {
    // allée qui mène au garage.
    groupe.add(
      construireMaison(env, {
        largeurMm: 9500,
        profondeurMm: MAISON_DU_FOND.profondeurMm,
        gouttiereMm: 4800,
        faitageMm: 6800,
        // QUATORZE MÈTRES, et non neuf. À neuf mètres la maison écrasait le
        // Reculée d'un jardin — ce qu'on a devant chez soi —, la
        // perspective la remet à sa place : présente, dominante, mais
        zFacadeMm: 14000,
        solMm: solEnv,
        garage: true,
        // Legerement decalee, jamais pile en face : une maison exactement
        decalageXMm: -700,
      }),
    );
    poserFond(
      construireAllee(env, {
        largeurMm: Math.min(demiLargeur * 2, 4200),
        z0Mm: -1500,
        z1Mm: 14000,
        solMm: solEnv,
      }),
    );
    // n'existe jamais seul, il ferme une ligne.
    for (const cote of [-1, 1] as const) {
      const depart = cote * (demiLargeur + PILIER.jeuMm + PILIER.sectionMm);
      poserFond(
        construireHaie(env, {
          x0Mm: Math.min(depart, depart + cote * 14000),
          x1Mm: Math.max(depart, depart + cote * 14000),
          zMm: 0,
          // rez-de-chaussée de la maison et son garage — c'est-à-dire ce
          // qu'on voulait montrer. Neuf cents millimètres, la hauteur
          // d'une haie de séparation : on voit par-dessus.
          hauteurMm: 900,
          solMm: solEnv,
        }),
      );
    }
  } else if (type === 'terrain') {
    // Un ouvrage linéaire ferme un TERRAIN : la maison est au fond, et
    //
    // d'un mètre se cadre de près : une maison à onze mètres, plein axe,
    // remplissait alors tout le fond et sortait du cadre par le toit. Elle
    // s'éloigne donc à mesure que l'ouvrage est petit, et se pose de côté —
    // c'est d'ailleurs ce qu'on voit d'un jardin : la maison est quelque
    // part, pas en face.
    groupe.add(
      construireMaison(env, {
        largeurMm: MAISON_DU_FOND.largeurMm,
        profondeurMm: MAISON_DU_FOND.profondeurMm,
        gouttiereMm: 5000,
        faitageMm: 7000,
        zFacadeMm: reculMaison,
        solMm: solEnv,
        garage: true,
        decalageXMm: -(demiLargeur + 5500),
      }),
    );
  } else if (type === 'dalle') {
    // flotte, et le vide devant ne veut rien dire.
    //
    // Sa façade est habillée comme les autres — porte-fenêtre, ouvertures
    // encadrées, toiture. Le premier jet y posait la maison générique du
    // fond, dont les ouvertures sont de simples aplats : à deux mètres,
    // elles se lisaient comme des rectangles collés.
    const demiDalle = Math.max(5200, demiLargeur + 2600);
    const solDalle = -DALLE.epaisseurMm;
    const gouttiereDalle = solDalle + 3000;
    const piedImmeuble = solDalle - DALLE.etagesSousMm;
    pieces.push(
      panneau(
        'mur',
        materiauMur,
        -demiDalle,
        demiDalle,
        // LE BÂTIMENT DESCEND SOUS LA DALLE, jusqu'à son rez-de-chaussée.
        // Il s'arrêtait au nu de la dalle, et la façade entière — mur,
        // toiture, pignons — pendait dans le vide.
        piedImmeuble,
        gouttiereDalle,
        DALLE.profondeurMm,
        DALLE.profondeurMm + MUR.epaisseurMm,
      ),
    );
    // ET IL EST POSÉ SUR UN TERRAIN. C'était le seul décor à n'avoir AUCUN
    // trois dans le dégradé de fond. Le vide sous un balcon n'est pas
    // l'absence de sol — c'est la HAUTEUR qui l'en sépare, et elle ne se lit
    // que si le sol est là, en bas, avec l'herbe dessus.
    {
      const emprise = Math.max(SOL.profondeurMm * 8, demiDalle * 3);
      pieces.push(
        panneau(
          'sol',
          env.gazon,
          -demiDalle - emprise,
          demiDalle + emprise,
          piedImmeuble - SOL.epaisseurMm,
          piedImmeuble,
          -emprise,
          DALLE.profondeurMm + PROFONDEUR_MAISON_MM + 3000,
        ),
      );
    }
    groupe.add(
      habillerFacade(env, {
        demiLargeurFacadeMm: demiDalle,
        solMm: solDalle,
        gouttiereMm: gouttiereDalle,
        faitageMm: gouttiereDalle + 1600,
        profondeurMm: 7000,
        zExterieurMm: DALLE.profondeurMm,
        piedMm: piedImmeuble,
        baie: { demiLargeurMm: 0, basMm: 0, hautMm: 0 },
        porteCentrale: true,
      }),
    );
  }

  // LE SOL, qui ancre l'échelle — et il n'est pas le même partout.
  //
  //  · derrière une BAIE, il part vers la pièce : c'est un sol intérieur ;
  //  · devant une FAÇADE, il s'étend dehors, là où se tient l'observateur
  //    sous son store — c'est une terrasse ;
  //  · sous des PILIERS et sur un TERRAIN, il court de part et d'autre :
  //  · une DALLE porte son propre sol, elle n'en veut pas un second.
  if (type === 'baie') {
    pieces.push(
      panneau(
        'sol',
        materiauSol,
        -demiLargeur - debord,
        demiLargeur + debord,
        // DEUX MILLIMÈTRES SOUS LE PARQUET, et non à son nu. La pièce pose
        // son propre plancher (`piece-sol`) au même niveau, plus large :
        // deux dalles dont le DESSUS est exactement à la même hauteur se
        // disputent le pixel, et c'est la première chose qu'on voit en
        // ouvrant l'onglet — la vue d'une fenêtre est prise du dedans.
        basDuMur - SOL.epaisseurMm - 2,
        basDuMur - 2,
        zInterieur - SOL.profondeurMm * 0.12,
        zInterieur + SOL.profondeurMm,
      ),
    );
  } else if (type === 'facade') {
    // LA PELOUSE D'ABORD, LA TERRASSE DESSUS. Le décor du store n'avait que
    // sa terrasse — quelques mètres carrés devant la baie — et la MAISON,
    // large de neuf mètres et profonde de huit, ne reposait sur rien : ses
    // deux tiers latéraux et tout son arrière flottaient au-dessus du vide.
    // Une façade se lit comme une façade parce qu'elle touche le sol.
    const empriseSol = Math.max(SOL.profondeurMm * 8, demiFacade * 3);
    pieces.push(
      panneau(
        'sol',
        env.gazon,
        -demiFacade - empriseSol,
        demiFacade + empriseSol,
        basDuMur - SOL.epaisseurMm - 20,
        basDuMur - 20,
        -empriseSol,
        // Jusque sous la maison : sa façade est en z = 0, son corps s'enfonce
        // derrière elle.
        MAISON_DU_FOND.profondeurMm + 3000,
      ),
    );
    pieces.push(
      panneau(
        'sol',
        materiauSol,
        -demiLargeur - debord,
        demiLargeur + debord,
        basDuMur - SOL.epaisseurMm,
        basDuMur,
        -SOL.profondeurMm * 2.2,
        0,
      ),
    );
  } else if (type !== 'dalle' && type !== 'piece') {
    // DANS UNE PIÈCE, IL N'Y A PAS DE PELOUSE — et cette ligne est le
    // deuxième piège du lot D10. La branche du gazon était le cas PAR DÉFAUT
    // (`else if (type !== 'dalle')`), donc toute valeur NOUVELLE de
    // par terre, et l'herbe repoussait sous lui. **Un défaut qui accueille
    // tout ce qui arrive est un défaut qui aura tort au prochain type** —
    // c'est la faute du lot MT1a, où une ouverture qu'aucune branche ne nomme
    // tombait dans le cas attrape-tout, retrouvée sur un décor.
    //
    // DEHORS, le sol est une PELOUSE, et il déborde largement : ses bords
    // sortent du champ, et l'œil ne cherche plus où il s'arrête. Un aplat
    // gris se lisait comme un studio photo ; un terrain vert se lit comme
    // un terrain, et c'est sur lui que l'allée prend son sens.
    //
    // ET IL VA JUSQUE SOUS LA MAISON DU FOND. Le premier jet le dimensionnait
    // sur l'OUVRAGE — huit fois la profondeur du seuil — alors que la maison,
    // elle, se place à quatorze mètres et en occupe huit et demi. La pelouse
    // s'arrêtait donc à 17,6 m et la maison courait jusqu'à 22,5 : son
    // arrière-corps pendait dans le vide, et l'arête du gazon lui coupait le
    // rez-de-chaussée en travers. La cote qui commande le sol n'est pas
    // celle du produit, c'est celle de ce qu'on pose dessus.
    const empriseSol = Math.max(SOL.profondeurMm * 8, demiLargeur * 5);
    const fondSol = reculMaison + MAISON_DU_FOND.profondeurMm + 3000;
    pieces.push(
      panneau(
        'sol',
        env.gazon,
        -demiLargeur - empriseSol,
        demiLargeur + empriseSol,
        -GARDE_AU_SOL_MM - SOL.epaisseurMm,
        -GARDE_AU_SOL_MM,
        -empriseSol,
        Math.max(empriseSol, fondSol),
      ),
    );
  }

  for (const piece of pieces) {
    if (piece) groupe.add(piece);
  }
  return groupe;
}

