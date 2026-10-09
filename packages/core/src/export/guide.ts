/**
 * Pourquoi ce fichier existe : le GUIDE DE COTES est « la pièce de
 * conversion majeure » ([docs/06](../../../../docs/06-parcours-utilisateurs.md)),
 * et la cote fausse est le risque n° 3 du projet
 * ([docs/00 §6](../../../../docs/00-dossier-de-cadrage.md)). Le widget
 * disait déjà QUOI mesurer, en deux phrases venues du catalogue. Il ne
 * montrait pas OÙ, et deux phrases ne remplacent pas un dessin quand le
 * client a un mètre à la main devant un tableau qui penche.
 *
 * **LE DESSIN SORT DU MOTEUR.** C'est la règle du dépôt, et elle vaut ici
 * autant qu'ailleurs : un schéma dessiné à la main dans le widget aurait
 * fini par contredire les cotes que le moteur calcule — le recouvrement de
 * rénovation vaut 50 mm parce que `catalog.poses.renovation.recouvrementMm`
 * vaut 50, et le jour où un marchand le change à 40, le schéma doit suivre.
 * On rend donc une `Elevation`, comme le plan de masse : `elevationToSvg()`
 * la dessine sans une ligne de plus, et le PDF du lot 6 saura la relire.
 *
 * Solution écartée : quatre SVG dessinés par un illustrateur et livrés en
 * données. Ils seraient plus beaux, et faux dès la première pose qu'un
 * marchand ajoute — la compétence `prise-de-cotes` §5 dit exactement cela :
 * le guide est PAR TYPE DE POSE, jamais générique.
 *
 * Ce module N'EST PAS réexporté depuis `index.ts`, et c'est délibéré : il
 * ne sert qu'à l'écran qui le regarde. Même raison que `export/plan.ts` et
 * `export/pdf.ts` — le client qui saisit ses cotes sans ouvrir le guide n'a
 * aucune raison d'en payer le code.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import { DEFAULT_CATALOG, type PoseDef, type PricingCatalog } from '../catalog.ts';
import type { Elevation, ElevationCote, ElevationLine, ElevationRect } from '../drawing.ts';
import type { Pose } from '../types.ts';

/** L'axe que le schéma illustre — chacun a sa coupe. */
export type AxeDeCote = 'largeur' | 'hauteur';

/**
 * Les cotes du schéma, en millimètres.
 *
 * Ce ne sont PAS des cotes de fabrication : ce sont les proportions d'un
 * dessin d'explication. Un tableau de 1 200 mm dans un mur de 400 se lit
 * mal sur une vignette ; on dessine donc un mur épais et un tableau court,
 * comme le ferait un croquis de chantier. La seule chose qui doit être
 * juste est la RELATION — ce qui recouvre quoi, et où se pose le mètre.
 */
const S = {
  /** L'ouverture dessinée, dans l'axe illustré. */
  ouvertureMm: 1150,
  /**
   * La PROFONDEUR de la coupe — l'épaisseur du mur.
   *
   * Elle diffère selon l'axe, et ce n'est pas une inattention. Sur la coupe
   * horizontale, la profondeur est la petite dimension d'un dessin large ;
   * sur la coupe verticale, c'est la LARGEUR d'un dessin déjà haut de deux
   * mètres. Un mur de 400 y donnait une vignette de 400 sur 2 200 —
   * géométriquement juste, illisible à 400 pixels. On l'épaissit donc pour
   * le dessin vertical, comme le ferait un croquis de chantier.
   */
  murLargeurMm: 540,
  murHauteurMm: 900,
  /** Le retour de maçonnerie de chaque côté — le tableau. */
  jambageMm: 420,
  /** Le linteau en haut, l'appui en bas de la coupe verticale. */
  linteauMm: 300,
  /** L'épaisseur du doublage isolant intérieur, pose en applique. */
  doublageMm: 160,
  /** Le recouvrement du dormant sur le doublage, par côté. */
  recouvrementDoublageMm: 70,
  /**
   * La section du dormant neuf, vue en coupe. Épaisse à dessein : à 70 mm
   * dans une ouverture de 1 200, le dormant se lisait comme un trait, et un
   * schéma où l'on ne distingue pas la menuiserie n'explique rien.
   */
  dormantMm: 150,
  /** Le rejingot — le relevé de l'appui, derrière lequel la menuiserie se pose. */
  rejingotMm: 90,
  /** La marge autour du dessin, pour loger les cotes. */
  margeMm: 340,
} as const;

/** Un rectangle du schéma. */
function pave(
  role: ElevationRect['role'],
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
): ElevationRect {
  return { role, xMm, yMm, widthMm, heightMm };
}

/** Une cote horizontale, portée sous le dessin. */
function coteHorizontale(
  code: string,
  label: string,
  xMm: number,
  largeurMm: number,
  yMm: number,
): ElevationCote {
  return {
    code,
    label,
    valeurMm: largeurMm,
    orientation: 'horizontale',
    x1Mm: xMm,
    y1Mm: yMm,
    x2Mm: xMm + largeurMm,
    y2Mm: yMm,
    textXMm: xMm + largeurMm / 2,
    textYMm: yMm,
  };
}

/** Une cote verticale, portée à droite du dessin. */
function coteVerticale(
  code: string,
  label: string,
  yMm: number,
  hauteurMm: number,
  xMm: number,
): ElevationCote {
  return {
    code,
    label,
    valeurMm: hauteurMm,
    orientation: 'verticale',
    x1Mm: xMm,
    y1Mm: yMm,
    x2Mm: xMm,
    y2Mm: yMm + hauteurMm,
    textXMm: xMm,
    textYMm: yMm + hauteurMm / 2,
  };
}

/**
 * LA COUPE HORIZONTALE — celle qui explique la LARGEUR.
 *
 * Vue de dessus, à hauteur de poignée : les deux jambages de maçonnerie,
 * l'ouverture entre eux, et la menuiserie posée dedans. C'est le dessin qui
 * répond à « d'où à où je tends mon mètre ».
 *
 * L'INTÉRIEUR est en bas — la convention du métier, celle qui donne aussi
 * le sens d'ouverture (compétence `metier-menuiserie`).
 */
function coupeEnLargeur(pose: PoseDef): {
  rects: ElevationRect[];
  lines: ElevationLine[];
  cote: { debutMm: number; longueurMm: number };
} {
  const rects: ElevationRect[] = [];
  const lines: ElevationLine[] = [];
  const mur = S.murLargeurMm;
  const xOuverture = S.jambageMm;

  rects.push(pave('maconnerie', 0, 0, S.jambageMm, mur));
  rects.push(pave('maconnerie', xOuverture + S.ouvertureMm, 0, S.jambageMm, mur));

  if (pose.tapee) {
    // POSE EN APPLIQUE : le doublage isolant court sur le mur INTÉRIEUR, et
    // le dormant se plaque dessus — il le recouvre. La cote à saisir n'est
    // donc plus le tableau seul, et c'est toute la difficulté de cette pose.
    rects.push(pave('doublage', 0, mur, S.jambageMm, S.doublageMm));
    rects.push(pave('doublage', xOuverture + S.ouvertureMm, mur, S.jambageMm, S.doublageMm));
    const xDormant = xOuverture - S.recouvrementDoublageMm;
    const largeurDormant = S.ouvertureMm + 2 * S.recouvrementDoublageMm;
    rects.push(pave('dormant', xDormant, mur, largeurDormant, S.dormantMm));
    return { rects, lines, cote: { debutMm: xDormant, longueurMm: largeurDormant } };
  }

  if (pose.recouvrementMm > 0) {
    // RÉNOVATION : l'ancien dormant RESTE. Le neuf vient se loger dedans et
    // le coiffe par l'extérieur d'une aile de recouvrement. Le client mesure
    // l'intérieur de l'ANCIEN — c'est tout l'objet de ce schéma, et
    // l'erreur qu'il évite coûte une menuiserie.
    const ancienMm = pose.ouvrantExistantMm + 40;
    rects.push(pave('existant', xOuverture, 0, ancienMm, mur));
    rects.push(pave('existant', xOuverture + S.ouvertureMm - ancienMm, 0, ancienMm, mur));
    const xNeuf = xOuverture + ancienMm;
    const largeurNeuf = S.ouvertureMm - 2 * ancienMm;
    const yNeuf = mur - S.dormantMm - 40;
    rects.push(pave('dormant', xNeuf, yNeuf, largeurNeuf, S.dormantMm));
    // L'AILE DE RECOUVREMENT coiffe l'ancien cadre par l'extérieur, HORS
    // cote saisie. C'est la pièce que le client ne doit surtout pas mesurer.
    const aile = Math.max(24, pose.recouvrementMm);
    rects.push(pave('recouvrement', xNeuf - aile, yNeuf - 40, aile, 40));
    rects.push(pave('recouvrement', xNeuf + largeurNeuf, yNeuf - 40, aile, 40));
    return { rects, lines, cote: { debutMm: xNeuf, longueurMm: largeurNeuf } };
  }

  // NEUF EN TABLEAU et DÉPOSE TOTALE : la menuiserie se loge dans la
  // maçonnerie nue, et la cote EST le tableau.
  const yDormant = mur - S.dormantMm - 30;
  rects.push(pave('dormant', xOuverture, yDormant, S.ouvertureMm, S.dormantMm));
  // LES TROIS MESURES, rendues visibles : règle d'or n° 1, on retient la
  // plus petite. Elles apparaissent sur les poses qui se mesurent DANS LA
  // MAÇONNERIE — neuf en tableau et dépose totale. Sur l'applique et la
  // rénovation, le dessin a déjà quelque chose de plus important à dire
  // (le doublage recouvert, l'ancien cadre conservé) et trois traits de
  // plus n'y seraient que du décor.
  // Les trois traits tiennent dans la part EXTÉRIEURE de l'ouverture, là
  // où la menuiserie ne les recouvre pas : trois mesures lisibles valent
  // mieux que trois mesures cachées derrière un dormant.
  for (const part of [0.14, 0.3, 0.46]) {
    const y = mur * part;
    lines.push({
      role: 'symbole',
      x1Mm: xOuverture,
      y1Mm: y,
      x2Mm: xOuverture + S.ouvertureMm,
      y2Mm: y,
    });
  }
  return { rects, lines, cote: { debutMm: xOuverture, longueurMm: S.ouvertureMm } };
}

/**
 * LA COUPE VERTICALE — celle qui explique la HAUTEUR.
 *
 * Le linteau en haut, l'appui en bas, et le REJINGOT : ce relevé de
 * quelques centimètres derrière lequel la menuiserie se pose, jamais
 * dessus. C'est l'erreur de cote la plus fréquente du métier, et la seule
 * qu'un texte ne suffit pas à éviter.
 */
function coupeEnHauteur(pose: PoseDef): {
  rects: ElevationRect[];
  lines: ElevationLine[];
  cote: { debutMm: number; longueurMm: number };
} {
  const rects: ElevationRect[] = [];
  const lines: ElevationLine[] = [];
  const mur = S.murHauteurMm;
  const yOuverture = S.linteauMm;
  const yAppui = yOuverture + S.ouvertureMm;

  rects.push(pave('maconnerie', 0, 0, mur, S.linteauMm));
  rects.push(pave('maconnerie', 0, yAppui, mur, S.linteauMm));
  // LE REJINGOT — le relevé de l'appui, côté intérieur. La menuiserie se
  // pose DERRIÈRE lui, jamais dessus (règle d'or n° 3).
  rects.push(pave('maconnerie', mur - S.rejingotMm, yAppui - S.rejingotMm, S.rejingotMm, S.rejingotMm));

  if (pose.tapee) {
    rects.push(pave('doublage', mur, 0, S.doublageMm, S.linteauMm));
    rects.push(pave('doublage', mur, yAppui, S.doublageMm, S.linteauMm));
    const yDormant = yOuverture - S.recouvrementDoublageMm;
    const hauteurDormant = S.ouvertureMm + 2 * S.recouvrementDoublageMm;
    rects.push(pave('dormant', mur, yDormant, S.dormantMm, hauteurDormant));
    return { rects, lines, cote: { debutMm: yDormant, longueurMm: hauteurDormant } };
  }

  if (pose.recouvrementMm > 0) {
    const ancienMm = pose.ouvrantExistantMm + 40;
    rects.push(pave('existant', 0, yOuverture, mur, ancienMm));
    rects.push(pave('existant', 0, yAppui - ancienMm, mur, ancienMm));
    const yNeuf = yOuverture + ancienMm;
    const hauteurNeuf = S.ouvertureMm - 2 * ancienMm;
    const xNeuf = mur - S.dormantMm - 40;
    rects.push(pave('dormant', xNeuf, yNeuf, S.dormantMm, hauteurNeuf));
    const aile = Math.max(24, pose.recouvrementMm);
    rects.push(pave('recouvrement', xNeuf - 40, yNeuf - aile, 40, aile));
    rects.push(pave('recouvrement', xNeuf - 40, yNeuf + hauteurNeuf, 40, aile));
    return { rects, lines, cote: { debutMm: yNeuf, longueurMm: hauteurNeuf } };
  }

  const xDormant = mur - S.dormantMm - 30;
  rects.push(pave('dormant', xDormant, yOuverture, S.dormantMm, S.ouvertureMm));
  for (const part of [0.14, 0.3, 0.46]) {
    const x = mur * part;
    lines.push({ role: 'symbole', x1Mm: x, y1Mm: yOuverture, x2Mm: x, y2Mm: yAppui });
  }
  return { rects, lines, cote: { debutMm: yOuverture, longueurMm: S.ouvertureMm } };
}

/**
 * LE SCHÉMA D'UNE POSE, pour un axe.
 *
 * Il rend une `Elevation` : la même structure que le dessin de face, donc le
 * même exportateur, donc un seul dessin à maintenir. Le libellé de la cote
 * est celui du CATALOGUE — `mesureLargeur` / `mesureHauteur` — parce qu'un
 * marchand qui ajoute une pose écrit ses lignes de mesure avec, et le
 * schéma doit les porter sans qu'on rouvre ce fichier.
 */
export function computeSchemaPose(
  pose: Pose,
  axe: AxeDeCote,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): Elevation {
  const def = catalog.poses[pose];
  if (!def) {
    throw new Error(
      `Pose « ${pose} » inconnue du catalogue. Les poses disponibles : ` +
        `${Object.keys(catalog.poses).join(', ')}.`,
    );
  }

  const { rects, lines, cote } = axe === 'largeur' ? coupeEnLargeur(def) : coupeEnHauteur(def);

  // Le cadre de rendu : l'enveloppe de tout ce qu'on a posé, plus la marge
  // des cotes. On le CALCULE plutôt que de le figer — un recouvrement de
  // rénovation qui change de valeur déborderait d'un cadre fixe.
  const xMin = Math.min(...rects.map((r) => r.xMm));
  const yMin = Math.min(...rects.map((r) => r.yMm));
  const xMax = Math.max(...rects.map((r) => r.xMm + r.widthMm));
  const yMax = Math.max(...rects.map((r) => r.yMm + r.heightMm));

  // LE LIBELLÉ DE LA COTE EST COURT, et c'est une correction : le premier
  // jet portait la phrase entière du catalogue sur la ligne de cote. Sur la
  // coupe verticale elle s'écrivait à la verticale, plus haute que le
  // dessin, et rendait la vignette illisible. La phrase est de la PROSE :
  // elle vit à côté du schéma, dans l'écran qui le montre — un dessin porte
  // des cotes, pas des paragraphes.
  const cotes: ElevationCote[] = [
    axe === 'largeur'
      ? coteHorizontale('a-mesurer', 'Largeur à saisir', cote.debutMm, cote.longueurMm, yMax + S.margeMm / 2)
      : coteVerticale('a-mesurer', 'Hauteur à saisir', cote.debutMm, cote.longueurMm, xMax + S.margeMm / 2),
  ];

  return {
    // Le schéma n'appartient à aucune famille : c'est une coupe de mur. On
    // déclare « fenetre » parce que le type l'exige, et le titre du SVG dit
    // la vérité — la famille ne sert qu'aux packs de thème.
    famille: 'fenetre',
    widthMm: xMax - xMin,
    heightMm: yMax - yMin,
    viewBox: {
      xMm: xMin - S.margeMm,
      yMm: yMin - S.margeMm,
      widthMm: xMax - xMin + 2 * S.margeMm,
      heightMm: yMax - yMin + 2 * S.margeMm,
    },
    rects,
    contours: [],
    lines,
    cotes,
    poignees: [],
    disques: [],
    couleurs: { cadreInterieur: '#ffffff', cadreExterieur: '#ffffff', vitrage: '#dfe9ee' },
  };
}

/**
 * LES RÈGLES D'OR de la prise de cotes — celles qui valent quelle que soit
 * la pose. Trois suffisent, et c'est un choix : le piège Neuffer est de
 * noyer le client (docs/09), et le guide tient en un écran par pose.
 *
 * Elles vivent ICI, dans le module PARESSEUX du guide, et non dans le
 * catalogue. Le catalogue est chargé au premier octet parce que le prix en
 * dépend ; trois phrases de conseil de chantier n'ont rien à y faire. Le
 * budget l'a dit tout seul : les y mettre a coûté 0,4 ko à tout le monde,
 * y compris à qui n'ouvre jamais le guide.
 *
 * Ce sont des DONNÉES, jamais du code — elles se traduisent, et elles ne
 * sont pas universelles : le rejingot est une pièce du bâti français, un
 * marchand britannique parlera de *sill*. Un marchand qui veut les siennes
 * les pose dans `catalog.guideCotes`.
 */
const REGLES_OR = [
  'Mesurez TROIS FOIS par axe — en haut, au milieu, en bas — et retenez la plus petite. Un tableau est rarement d’équerre.',
  'Comparez les deux DIAGONALES. Plus de 5 mm d’écart : signalez-le, le jeu de pose devra le rattraper.',
  'Repérez le REJINGOT, ce relevé de quelques centimètres sur l’appui : la menuiserie se pose DERRIÈRE lui, jamais dessus.',
];

/** Les règles d'or : celles du marchand si elles existent, celles du paquet sinon. */
export function reglesDOr(catalog: PricingCatalog = DEFAULT_CATALOG): string[] {
  return catalog.guideCotes?.regles ?? REGLES_OR;
}

/** Les poses illustrées — celles que le catalogue déclare, dans son ordre. */
export function posesIllustrees(catalog: PricingCatalog = DEFAULT_CATALOG): PoseDef[] {
  return Object.values(catalog.poses);
}
