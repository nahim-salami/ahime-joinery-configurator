
import {
  ajouterCadreMitre,
  ajouterCylindre,
  ajouterCylindreEntre,
  ajouterPave,
  ajouterPaveOriente,
  extruder,
  rectangleArrondi,
  type Maillage,
  type Point2,
  type Point3,
} from './maillage.ts';

/** Les cotes du commerce, en millimètres. */
const BEQUILLE = {
  plaqueLargeur: 42,
  plaqueHauteur: 118,
  plaqueEpaisseur: 9,
  plaqueRayon: 12,
  colRayon: 11.5,
  colLongueur: 24,
  brasLongueur: 62,
  brasSection: 20,
  brasProfondeur: 19,
  retourLongueur: 38,
  retourAngle: (20 * Math.PI) / 180,
};

const PAUMELLE = { rayon: 9.5, hauteur: 58, capuchonRayon: 11.5, capuchonHauteur: 6 };
const GALET = { rayon: 11, epaisseur: 8 };
// Une barre de tirage de baie n'est pas une petite poignée : sur un
// coulissant alu de 2,15 m, elle mesure couramment 900 mm et se saisit à
// n'importe quelle hauteur. En faire une poignée de 280 mm donne au rendu
const BARRE = {
  rayon: 9,
  entretoiseRayon: 7,
  entretoiseLongueur: 32,
  hauteurMin: 260,
  hauteurMax: 900,
  partDeLaHauteur: 0.42,
};

/**
 * La MANIVELLE d'un volet roulant — une tringle oscillante qui sort du
 * caisson en biais et se termine par une poignée coudée. Elle se vend là où
 * la sangle ne passe pas : derrière un plan de travail, sur une baie large,
 * en étage.
 *
 * Solution écartée : une simple tige verticale. Ce qui identifie une
 * manivelle, c'est justement qu'elle est OBLIQUE — le cardan sort du
 * caisson à 45 degrés pour qu'on l'attrape sans lever le bras, et une tige
 * droite ressemble à une tringle à rideau.
 *
 * `sens` vaut +1 quand elle sort à droite du coffre.
 */
export function ajouterManivelle(
  maillage: Maillage,
  ancrage: Point3,
  longueur: number,
  sens: 1 | -1,
): void {
  const inclinaison = (52 * Math.PI) / 180;
  const bout: Point3 = {
    xMm: ancrage.xMm + sens * longueur * Math.cos(inclinaison) * 0.35,
    yMm: ancrage.yMm - longueur * Math.sin(inclinaison),
    zMm: ancrage.zMm + longueur * 0.18,
  };
  // Le cardan, à la sortie du caisson.
  ajouterCylindre(maillage, ancrage, 'z', 13, 26, 12);
  // La tringle oblique.
  ajouterCylindreEntre(maillage, ancrage, bout, 6, 10);
  // La poignée coudée, celle qu'on tourne.
  ajouterCylindreEntre(
    maillage,
    bout,
    { xMm: bout.xMm + sens * 58, yMm: bout.yMm - 26, zMm: bout.zMm },
    5,
    10,
  );
  ajouterCylindre(
    maillage,
    { xMm: bout.xMm + sens * 58, yMm: bout.yMm - 52, zMm: bout.zMm },
    'y',
    9,
    54,
    12,
  );
}

/**
 * Une BUTÉE de lame finale — le petit taquet qui empêche le tablier
 * d'entrer tout entier dans le coffre. Sans elles, un volet remonté à fond
 * disparaît dans son caisson et ne se rattrape plus d'en bas : il faut
 * démonter le coffre pour aller rechercher la lame.
 */
export function ajouterButeeLameFinale(maillage: Maillage, ancrage: Point3): void {
  ajouterPave(maillage, ancrage, { xMm: 34, yMm: 16, zMm: 26 });
}

/**
 * Une béquille de fenêtre : plaque, col, levier retombant. `sens` vaut +1
 * quand le levier retombe vers la droite (poignée sur le montant gauche) et
 * −1 dans l'autre cas — un levier qui plonge vers le vitrage au lieu du vide
 * se voit tout de suite.
 */
export function ajouterBequille(maillage: Maillage, ancrage: Point3, sens: 1 | -1): void {
  const zPlaque = ancrage.zMm;

  // La plaque, aux angles arrondis, plaquée sur l'ouvrant.
  extruder(
    maillage,
    rectangleArrondi(BEQUILLE.plaqueLargeur, BEQUILLE.plaqueHauteur, BEQUILLE.plaqueRayon, 5).map(
      ([u, v]) => [u + ancrage.xMm, v + ancrage.yMm] as [number, number],
    ),
    'z',
    { debut: zPlaque, fin: zPlaque + BEQUILLE.plaqueEpaisseur },
  );

  // Le col : le cylindre qui porte le levier.
  const zCol = zPlaque + BEQUILLE.plaqueEpaisseur;
  ajouterCylindre(
    maillage,
    { xMm: ancrage.xMm, yMm: ancrage.yMm, zMm: zCol + BEQUILLE.colLongueur / 2 },
    'z',
    BEQUILLE.colRayon,
    BEQUILLE.colLongueur,
    18,
  );

  // Le levier retombe : un bras vertical, puis un retour incliné, chaque
  // articulation arrondie par un cylindre — c'est ce galbe qui fait la
  // différence entre une poignée et un bout de tasseau.
  const zLevier = zCol + BEQUILLE.colLongueur - BEQUILLE.brasProfondeur / 2;
  const yBras = ancrage.yMm - BEQUILLE.brasLongueur / 2;
  ajouterPave(
    maillage,
    { xMm: ancrage.xMm, yMm: yBras, zMm: zLevier },
    { xMm: BEQUILLE.brasSection, yMm: BEQUILLE.brasLongueur, zMm: BEQUILLE.brasProfondeur },
  );
  ajouterCylindre(
    maillage,
    { xMm: ancrage.xMm, yMm: ancrage.yMm, zMm: zLevier },
    'z',
    BEQUILLE.brasSection / 2,
    BEQUILLE.brasProfondeur,
    16,
  );

  const yCoude = ancrage.yMm - BEQUILLE.brasLongueur;
  const angle = sens * BEQUILLE.retourAngle;
  const centreRetour = {
    xMm: ancrage.xMm + (sens * Math.sin(BEQUILLE.retourAngle) * BEQUILLE.retourLongueur) / 2,
    yMm: yCoude - (Math.cos(BEQUILLE.retourAngle) * BEQUILLE.retourLongueur) / 2,
    zMm: zLevier,
  };
  ajouterPaveOriente(
    maillage,
    centreRetour,
    { xMm: BEQUILLE.brasSection * 0.92, yMm: BEQUILLE.retourLongueur, zMm: BEQUILLE.brasProfondeur },
    angle,
  );
  ajouterCylindre(
    maillage,
    { xMm: ancrage.xMm, yMm: yCoude, zMm: zLevier },
    'z',
    BEQUILLE.brasSection / 2,
    BEQUILLE.brasProfondeur,
    14,
  );
  // Le bout, arrondi.
  ajouterCylindre(
    maillage,
    {
      xMm: ancrage.xMm + sens * Math.sin(BEQUILLE.retourAngle) * BEQUILLE.retourLongueur,
      yMm: yCoude - Math.cos(BEQUILLE.retourAngle) * BEQUILLE.retourLongueur,
      zMm: zLevier,
    },
    'z',
    BEQUILLE.brasSection * 0.46,
    BEQUILLE.brasProfondeur,
    14,
  );
}

/**
 * Une paumelle : le fût vertical et ses deux capuchons. Posée à la jonction
 * du dormant et de l'ouvrant, côté intérieur — là où on la voit vraiment.
 */
export function ajouterPaumelle(maillage: Maillage, centre: Point3): void {
  // HUIT SEGMENTS, PAS QUATORZE. Une paumelle fait dix-neuf millimètres de
  // diamètre : à quatorze pans, ses facettes sont déjà sous le pixel à la
  // distance où on la regarde, et le gain d'arrondi est invisible.
  //
  // Ce n'est pas une micro-optimisation : l'abaque de ferrure porte le
  // nombre de paumelles à quatre ou cinq sur les grandes menuiseries, et
  // sur une fenêtre alu quatre vantaux, les paumelles pesaient à elles
  // seules DEUX TIERS du modèle — plus que le dormant, l'ouvrant, le
  // vitrage et les parcloses réunis. Elles faisaient sortir l'export de
  // réalité augmentée de son budget, pour un arrondi que personne ne voit
  // (docs/18 §7.4). Les capuchons, plus petits encore, se contentent de six.
  ajouterCylindre(maillage, centre, 'y', PAUMELLE.rayon, PAUMELLE.hauteur, 8);
  for (const signe of [1, -1]) {
    ajouterCylindre(
      maillage,
      {
        ...centre,
        yMm: centre.yMm + (signe * (PAUMELLE.hauteur + PAUMELLE.capuchonHauteur)) / 2,
      },
      'y',
      PAUMELLE.capuchonRayon,
      PAUMELLE.capuchonHauteur,
      6,
    );
  }
}

/**
 * LE COMPAS d'un oscillo-battant — le bras à ciseaux qui retient le vantail
 * en position soufflet.
 *
 * C'est la SEULE pièce qui distingue un oscillo-battant d'une frappe à
 * l'œil, et elle manquait : un vantail OB s'affichait exactement comme un
 * vantail ordinaire, alors que le client vient de payer quarante à
 * quatre-vingts euros de plus pour lui (docs/18 §3.1, G18).
 *
 * Il court du haut du dormant au haut de l'ouvrant, côté paumelles. Fermé,
 * il est replié dans la feuillure et on ne le voit pas ; ouvert en
 * soufflet, il se déplie et devient l'objet le plus visible de la
 * menuiserie. On le dessine donc TOUJOURS, à sa place : c'est l'angle du
 * vantail qui décide si on le voit.
 *
 * Deux bras articulés, pas un seul : un compas à une branche est une
 * équerre, et il ne se replierait pas.
 */
export function ajouterCompas(
  maillage: Maillage,
  ancrageDormant: Point3,
  ancrageOuvrant: Point3,
): void {
  const largeur = 20;
  const epaisseur = 4;
  // Le coude, à mi-chemin et légèrement décalé : c'est lui qui fait le
  // ciseau, et c'est par lui que le bras se replie.
  const coude = {
    xMm: (ancrageDormant.xMm + ancrageOuvrant.xMm) / 2,
    yMm: (ancrageDormant.yMm + ancrageOuvrant.yMm) / 2 - 18,
    zMm: (ancrageDormant.zMm + ancrageOuvrant.zMm) / 2,
  };
  for (const [de, vers] of [
    [ancrageDormant, coude],
    [coude, ancrageOuvrant],
  ] as Array<[Point3, Point3]>) {
    const longueur = Math.hypot(vers.xMm - de.xMm, vers.yMm - de.yMm, vers.zMm - de.zMm);
    if (longueur < 1) continue;
    ajouterPaveOriente(
      maillage,
      {
        xMm: (de.xMm + vers.xMm) / 2,
        yMm: (de.yMm + vers.yMm) / 2,
        zMm: (de.zMm + vers.zMm) / 2,
      },
      { xMm: longueur, yMm: largeur, zMm: epaisseur },
      Math.atan2(vers.yMm - de.yMm, vers.xMm - de.xMm),
    );
  }
  // Les trois articulations — deux ancrages et le coude. Sans elles, le
  // compas est deux plats qui se croisent.
  for (const point of [ancrageDormant, coude, ancrageOuvrant]) {
    ajouterCylindre(maillage, point, 'z', 5, epaisseur * 2.2, 8);
  }
}

/** Un galet de coulissant — la roue qui porte le vantail dans sa gorge. */
export function ajouterGalet(maillage: Maillage, centre: Point3): void {
  ajouterCylindre(maillage, centre, 'z', GALET.rayon, GALET.epaisseur, 14);
}

/**
 * La barre de tirage d'un coulissant : un tube vertical sur deux
 * entretoises. Rien à voir avec une béquille — un coulissant ne se manœuvre
 * pas au levier, et lui en poser un trahirait le produit.
 */
export function ajouterBarreDeTirage(
  maillage: Maillage,
  ancrage: Point3,
  hauteurDisponible: number,
): void {
  const hauteur = Math.min(
    BARRE.hauteurMax,
    Math.max(BARRE.hauteurMin, hauteurDisponible * BARRE.partDeLaHauteur),
  );
  const zBarre = ancrage.zMm + BARRE.entretoiseLongueur;
  ajouterCylindre(
    maillage,
    { xMm: ancrage.xMm, yMm: ancrage.yMm, zMm: zBarre },
    'y',
    BARRE.rayon,
    hauteur,
    16,
  );
  // Deux entretoises, trois au-delà de 700 mm — comme en atelier, une barre
  // longue fléchit si on ne la reprend pas au milieu.
  const parts = hauteur > 700 ? [-0.5, 0, 0.5] : [-0.5, 0.5];
  for (const part of parts) {
    const decalage = part === 0 ? 0 : Math.sign(part) * (hauteur / 2 - BARRE.rayon * 2.5);
    ajouterCylindre(
      maillage,
      {
        xMm: ancrage.xMm,
        yMm: ancrage.yMm + decalage,
        zMm: ancrage.zMm + BARRE.entretoiseLongueur / 2,
      },
      'z',
      BARRE.entretoiseRayon,
      BARRE.entretoiseLongueur,
      12,
    );
  }
}

/**
 * Le bâton de maréchal : la barre de tirage verticale d'une porte d'entrée,
 * côté EXTÉRIEUR. Une porte d'entrée ne se tire pas à la béquille — celle-ci
 * est côté intérieur, et l'extérieur porte une barre ou une poignée fixe.
 */
export function ajouterBatonDeMarechal(
  maillage: Maillage,
  ancrage: Point3,
  hauteurDisponible: number,
): void {
  const hauteur = Math.min(1200, Math.max(400, hauteurDisponible * 0.55));
  const rayon = 14;
  const entretoise = 46;
  ajouterCylindre(
    maillage,
    { xMm: ancrage.xMm, yMm: ancrage.yMm, zMm: ancrage.zMm - entretoise },
    'y',
    rayon,
    hauteur,
    16,
  );
  for (const signe of [1, -1]) {
    ajouterCylindre(
      maillage,
      {
        xMm: ancrage.xMm,
        yMm: ancrage.yMm + (signe * (hauteur / 2 - rayon * 2.5)),
        zMm: ancrage.zMm - entretoise / 2,
      },
      'z',
      10,
      entretoise,
      12,
    );
  }
}

/**
 * L'entrée de clé : rosace et barillet. C'est la pièce qui dit « cette
 * porte se ferme » — une serrure A2P facturée 190 € doit se voir.
 */
export function ajouterEntreeDeCle(maillage: Maillage, ancrage: Point3, versExterieur: boolean): void {
  const sens = versExterieur ? -1 : 1;
  const zRosace = ancrage.zMm;
  extruder(
    maillage,
    rectangleArrondi(38, 74, 14, 5).map(
      ([u, v]) => [u + ancrage.xMm, v + ancrage.yMm] as [number, number],
    ),
    'z',
    { debut: Math.min(zRosace, zRosace + sens * 8), fin: Math.max(zRosace, zRosace + sens * 8) },
  );
  // Le barillet, en saillie de la rosace.
  ajouterCylindre(
    maillage,
    { xMm: ancrage.xMm, yMm: ancrage.yMm, zMm: zRosace + sens * 12 },
    'z',
    9,
    12,
    14,
  );
}

/**
 * Une grille de ventilation : la fente et ses ailettes, en traverse haute.
 * Réglementairement, c'est elle qui assure le renouvellement d'air d'une
 * pièce quand la menuiserie est étanche.
 */
export function ajouterGrilleVentilation(
  maillage: Maillage,
  centre: Point3,
  largeurMm: number,
): void {
  const largeur = Math.min(largeurMm * 0.55, 420);
  const hauteur = 24;
  const profondeur = 16;
  ajouterPave(maillage, centre, { xMm: largeur, yMm: hauteur, zMm: profondeur });
  // Les ailettes : de fines lames obliques, visibles de près.
  const nombre = Math.max(3, Math.round(largeur / 34));
  for (let index = 0; index < nombre; index++) {
    ajouterPaveOriente(
      maillage,
      {
        xMm: centre.xMm - largeur / 2 + ((index + 0.5) * largeur) / nombre,
        yMm: centre.yMm,
        zMm: centre.zMm + profondeur * 0.35,
      },
      { xMm: 5, yMm: hauteur * 0.78, zMm: 9 },
      0.5,
    );
  }
}

/**
 * La sortie de sangle d'un volet roulant manuel. Un volet sans manœuvre
 * visible laisse croire qu'il est motorisé — et la motorisation se facture.
 */
export function ajouterSortieDeSangle(maillage: Maillage, ancrage: Point3): void {
  extruder(
    maillage,
    rectangleArrondi(52, 120, 10, 4).map(
      ([u, v]) => [u + ancrage.xMm, v + ancrage.yMm] as [number, number],
    ),
    'z',
    { debut: ancrage.zMm, fin: ancrage.zMm + 10 },
  );
  // Le brin de sangle qui pend.
  ajouterPave(
    maillage,
    { xMm: ancrage.xMm, yMm: ancrage.yMm - 120, zMm: ancrage.zMm + 6 },
    { xMm: 15, yMm: 180, zMm: 3 },
  );
}

/**

/**
 * Une moustiquaire : son cadre fin et sa toile, posés côté extérieur. Elle
 * se voit peu — c'est le but — mais son absence totale ferait douter d'une
 * option facturée 95 €.
 */
export function ajouterMoustiquaire(
  maillage: Maillage,
  cadre: { xMm: number; yMm: number; largeurMm: number; hauteurMm: number; zMm: number },
): void {
  ajouterCadreMitre(
    maillage,
    cadre,
    [
      [0, 0],
      [26, 0],
      [26, 18],
      [0, 18],
    ],
  );
  // La toile, très mince, tendue dans le cadre.
  ajouterPave(
    maillage,
    {
      xMm: cadre.xMm + cadre.largeurMm / 2,
      yMm: cadre.yMm + cadre.hauteurMm / 2,
      zMm: cadre.zMm + 9,
    },
    {
      xMm: Math.max(1, cadre.largeurMm - 52),
      yMm: Math.max(1, cadre.hauteurMm - 52),
      zMm: 1.5,
    },
  );
}

/** La hauteur d'une béquille — sert à vérifier qu'elle tient sur l'ouvrant. */
export function encombrementBequille(): { hauteurMm: number; saillieMm: number } {
  return {
    hauteurMm:
      BEQUILLE.plaqueHauteur / 2 +
      BEQUILLE.brasLongueur +
      Math.cos(BEQUILLE.retourAngle) * BEQUILLE.retourLongueur +
      BEQUILLE.brasSection * 0.46,
    saillieMm: BEQUILLE.plaqueEpaisseur + BEQUILLE.colLongueur,
  };
}
