/**
 * Pourquoi ce fichier existe : les trois refus qu'un bureau d'études oppose
 * le plus souvent à une menuiserie ne portaient sur rien ici. Le cœur ne
 * connaissait qu'une grandeur physique — le poids du vitrage — alors que
 * les limites réelles sont le VENT (le vantail vrille), la FLÈCHE (la
 * traverse fléchit et l'ouvrant coince) et l'ÉPAISSEUR DE VERRE (le vitrage
 * casse). Un configurateur qui vend une baie de trois mètres sans les avoir
 * regardés vend un sinistre.
 *
 * Solution écartée : le calcul réglementaire complet, aux éléments finis,
 * avec note signée. Hors de portée et hors sujet — un configurateur n'est
 * pas un bureau de contrôle. Le bon niveau est le PRÉ-DIMENSIONNEMENT
 * honnête : des formules fermées, des hypothèses affichées, et un
 * basculement explicite vers l'étude dès qu'on sort du domaine courant.
 *
 * Incident fondateur : la baie de docs/04 §6. Elle imposait des ferrures
 * renforcées sur un seuil de 40 kg qui portait sur le VITRAGE, alors que
 * les abaques du métier portent sur le VANTAIL. Une grandeur physique mal
 * nommée coûte un supplément indu à chaque devis — ou, dans l'autre sens,
 * une ferrure sous-dimensionnée.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { Materiau, ZoneVent } from './types.ts';

/**
 * La RÉGION DE VENT de l'annexe nationale d'EN 1991-1-4 — 1 à 4, de
 * l'intérieur des terres aux côtes atlantiques.
 *
 * Elle ne se confond pas avec la `ZoneVent` du configurateur, qui est
 * QUALITATIVE (abritée, normale, exposée) parce que c'est ce qu'un client
 * sait répondre. Les deux coexistent : le client déclare ce qu'il voit, le
 * calcul travaille sur la région. `regionDepuisZone()` fait le pont, et il
 * est délibérément PESSIMISTE — sur une déclaration approximative, mieux
 * vaut une menuiserie trop tenue qu'une menuiserie qui vrille.
 */
export type RegionVent = 1 | 2 | 3 | 4;

/** Ce qu'une déclaration qualitative vaut en région, du côté sûr. */
export function regionDepuisZone(zone: ZoneVent): RegionVent {
  if (zone === 'abritee') return 1;
  if (zone === 'exposee') return 3;
  return 2;
}

/** La catégorie de terrain d'EN 1991-1-4 — la rugosité de ce qui entoure. */
export type CategorieTerrain = 'mer' | 'rase-campagne' | 'bocage' | 'urbain' | 'ville-dense';

/**
 * La vitesse de référence du vent par région française, en m/s (annexe
 * nationale d'EN 1991-1-4). Les zones cycloniques relèvent d'une
 * cartographie CSTB dédiée : on ne prétend pas les couvrir.
 */
const VITESSE_REFERENCE: Record<RegionVent, number> = { 1: 22, 2: 24, 3: 26, 4: 28 };

/**
 * Le facteur de rugosité par catégorie de terrain, et la hauteur en dessous
 * de laquelle il ne descend plus. Ce sont les paliers d'EN 1991-1-4,
 * simplifiés en un couple (coefficient, hauteur minimale) : la formule
 * logarithmique complète demande `z0` et `kr`, et sa précision n'a de sens
 * qu'avec un `cpe` de rive qu'un configurateur n'a pas.
 */
const TERRAIN: Record<CategorieTerrain, { facteur: number; hauteurMinM: number }> = {
  mer: { facteur: 1.18, hauteurMinM: 1 },
  'rase-campagne': { facteur: 1.0, hauteurMinM: 2 },
  bocage: { facteur: 0.86, hauteurMinM: 5 },
  urbain: { facteur: 0.73, hauteurMinM: 9 },
  'ville-dense': { facteur: 0.62, hauteurMinM: 15 },
};

/** Masse volumique de l'air, kg/m³ — la constante d'EN 1991-1-4. */
const RHO_AIR = 1.25;

export interface ChargeDeVent {
  /** Pression dynamique de pointe, en pascals. */
  qpPa: number;
  /** La classe de pression EN 12210 qu'il faut au minimum (1 à 5). */
  classePression: number;
  /** L'écriture du métier — `V*A2`, `V*C4`. */
  classement: string;
  /** Les hypothèses, à afficher avec le résultat. Jamais un chiffre nu. */
  hypotheses: string[];
}

/**
 * LA CHARGE DE VENT, d'une adresse à des pascals (EN 1991-1-4).
 *
 * On demande trois choses — région, hauteur, environnement — et pas une de
 * plus : c'est ce qu'un client sait répondre. Le coefficient de pression de
 * rive, qui fait vraiment casser les menuiseries, demande un plan de façade
 * et relève de l'étude ; on ne le simule pas, on le dit.
 */
export function chargeDeVent(
  region: RegionVent,
  terrain: CategorieTerrain,
  hauteurM: number,
): ChargeDeVent {
  const { facteur, hauteurMinM } = TERRAIN[terrain];
  const hauteur = Math.max(hauteurMinM, hauteurM);
  // La vitesse moyenne croît avec la hauteur ; la racine cubique approche
  // le profil logarithmique dans le domaine où vivent les maisons et les
  // petits collectifs (3 à 30 m), à quelques pour cent près.
  const vitesse = VITESSE_REFERENCE[region] * facteur * Math.cbrt(hauteur / 10);
  // qp = (1 + 7·Iv) · ½ · ρ · vm² ; l'intensité de turbulence est prise à
  // 0,19, sa valeur en terrain courant.
  const qp = (1 + 7 * 0.19) * 0.5 * RHO_AIR * vitesse * vitesse;
  const qpPa = Math.round(qp);
  const classePression = classeDePression(qpPa);
  return {
    qpPa,
    classePression,
    // La lettre est la RIGIDITÉ, le chiffre la pression. On vise la classe
    // C — flèche sous L/300 — qui est celle qu'un CCTP demande par défaut.
    classement: `V*C${classePression}`,
    hypotheses: [
      `région de vent ${region}, terrain ${terrain}, hauteur ${Math.round(hauteur)} m`,
      'coefficient de pression de rive non pris en compte — relève de l’étude',
      'intensité de turbulence conventionnelle (0,19)',
    ],
  };
}

/** La classe EN 12210 qui couvre une pression : 400, 800, 1200, 1600, 2000 Pa. */
export function classeDePression(qpPa: number): number {
  const paliers = [400, 800, 1200, 1600, 2000];
  for (let index = 0; index < paliers.length; index++) {
    if (qpPa <= paliers[index]) return index + 1;
  }
  // Au-delà de 2 000 Pa, EN 12210 sort de ses classes numérotées et note la
  // valeur d'essai. On rend 6 pour que l'appelant sache qu'on est dehors.
  return 6;
}

/** Module d'Young, en MPa. L'acier de renfort travaille presque seul. */
export const MODULE_YOUNG: Record<Materiau | 'acier', number> = {
  pvc: 2700,
  alu: 70000,
  bois: 11000,
  mixte: 11000,
  acier: 210000,
};

/**
 * L'épaisseur de PAROI d'un profilé, en mm — ce qui porte vraiment.
 *
 * Un dormant PVC n'est pas un bloc : c'est un tube à cloisons de 2,8 mm,
 * la valeur de la « classe A » d'EN 12608 (2,5 mm mesurés, 2,8 nominaux),
 * qui est ce que vend la filière française. L'aluminium descend à 1,8 mm
 * parce qu'il est vingt-cinq fois plus rigide. Le bois, lui, est PLEIN :
 * on le note par une paroi égale à la demi-largeur, ce qui revient à la
 * section pleine, et c'est physiquement exact.
 */
const PAROI_MM: Record<Materiau, number> = {
  pvc: 2.8,
  alu: 1.8,
  bois: 999,
  mixte: 999,
};

/**
 * LE MOMENT QUADRATIQUE d'un montant, en cm⁴, déduit de sa SECTION RÉELLE.
 *
 * Solution écartée : une table `inertieCm4` par gamme dans le catalogue.
 * Elle se serait lue plus vite — et elle aurait été inventée. Aucune des
 * sources rassemblées dans `ressources/` ne donne l'inertie des profilés
 * qu'on vend ; les publier comme des chiffres de catalogue aurait fabriqué
 * une autorité qu'on n'a pas. La section, elle, on la connaît : le
 * catalogue donne la profondeur du système (`epaisseurMm`) et la chaîne de
 * cotes donne la masse vue. Un tube rectangulaire creux se calcule.
 *
 *   I = (b·h³ − (b−2e)·(h−2e)³) / 12
 *
 * où `h` est la PROFONDEUR — la dimension dans le sens du vent, celle qui
 * compte au cube — et `b` la largeur vue. Le résultat est volontairement
 * conservateur : on ignore les cloisons intérieures, qui n'ajoutent presque
 * rien en flexion, et le renfort acier, qui se demande explicitement à
 * `fleche()`.
 */
export function inertieProfilCm4(options: {
  materiau: Materiau;
  /** Profondeur du profilé, en mm — la dimension dans le sens du vent. */
  profondeurMm: number;
  /** Largeur vue du montant, en mm. */
  largeurMm: number;
}): number {
  const h = Math.max(1, options.profondeurMm);
  const b = Math.max(1, options.largeurMm);
  const e = Math.min(PAROI_MM[options.materiau], b / 2, h / 2);
  const creuxB = Math.max(0, b - 2 * e);
  const creuxH = Math.max(0, h - 2 * e);
  const iMm4 = (b * h ** 3 - creuxB * creuxH ** 3) / 12;
  return Math.round((iMm4 / 10_000) * 100) / 100;
}

/**
 * LE MOMENT QUADRATIQUE DU RENFORT ACIER, en cm⁴ — celui du tube, pas celui
 * du profilé qui l'abrite.
 *
 * Incident fondateur, et c'était une faute de modèle : `fleche()` acceptait
 * un drapeau `renforce` qui remplaçait simplement le module d'Young du PVC
 * par celui de l'acier, EN GARDANT l'inertie du profilé PVC. Cela revenait
 * à supposer un montant en acier plein de 70 mm de profondeur — huit fois
 * trop rigide. Un renfort est un TUBE, mince, logé dans la chambre : il a
 * son module ET sa section, et les deux se multiplient.
 *
 * Le tube retenu est le plus gros qui entre : la chambre moins un jeu de
 * pose de 10 mm, en paroi de 2 mm — ce que les gammistes fournissent au
 * catalogue. Le bois n'en reçoit pas : il est plein, il n'a pas de chambre,
 * et le renforcer se fait en augmentant la section.
 */
export function inertieRenfortCm4(materiau: Materiau, profondeurMm: number): number {
  if (materiau === 'bois') return 0;
  const cote = profondeurMm - 2 * PAROI_MM[materiau] - JEU_DE_POSE_RENFORT_MM;
  if (cote < 20) return 0;
  const creux = cote - 2 * PAROI_RENFORT_MM;
  const iMm4 = (cote ** 4 - creux ** 4) / 12;
  return Math.round((iMm4 / 10_000) * 100) / 100;
}

/** Le jeu qu'il faut pour enfiler un renfort dans sa chambre, en mm. */
const JEU_DE_POSE_RENFORT_MM = 10;
/** La paroi d'un tube de renfort galvanisé, en mm — le standard gammiste. */
const PAROI_RENFORT_MM = 2;

export interface Fleche {
  /** La flèche calculée, en mm. */
  flecheMm: number;
  /** Ce que la classe C d'EN 12210 admet : L/300, plafonné à 15 mm. */
  admissibleMm: number;
  /** Vrai quand la flèche dépasse — un renfort est alors obligatoire. */
  renfortRequis: boolean;
  hypotheses: string[];
}

/**
 * LA FLÈCHE d'une traverse ou d'un meneau sous le vent — la formule qui
 * décide d'un renfort.
 *
 * `f = 5·w·L⁴ / (384·E·I)` : appui simple, charge uniforme. C'est le cas de
 * charge d'une menuiserie, et il n'y en a pas d'autre à ce niveau.
 *
 * La règle « renfort au-delà d'un mètre » que le métier applique n'est pas
 * une convention commerciale : c'est cette formule arrondie. Le PVC est
 * quatre-vingts fois moins rigide que l'acier — passé le mètre, c'est le
 * renfort qui travaille, presque seul.
 */
export function fleche(options: {
  /** Pression de vent, en pascals. */
  pressionPa: number;
  /** Portée libre de la barre, en mm. */
  porteeMm: number;
  /** Demi-portée tributaire de chaque côté, en mm — la surface qu'elle reprend. */
  largeurTributaireMm: number;
  materiau: Materiau;
  /** Moment quadratique du PROFILÉ seul, en cm⁴. */
  inertieCm4: number;
  /**
   * Le moment quadratique du RENFORT acier, en cm⁴ — 0 ou absent s'il n'y
   * en a pas. Il ne remplace pas celui du profilé : les deux sections
   * travaillent EN PARALLÈLE, et leurs rigidités s'additionnent.
   */
  renfortCm4?: number;
}): Fleche {
  const { pressionPa, porteeMm, largeurTributaireMm, materiau, inertieCm4 } = options;
  // Charge linéique : la pression (N/mm²) multipliée par la largeur reprise.
  const w = (pressionPa / 1_000_000) * largeurTributaireMm;
  // LA RIGIDITÉ COMPOSITE. Deux barres solidaires qui fléchissent ensemble
  // se comportent comme des ressorts en parallèle : c'est ΣEI qui résiste,
  // pas le plus rigide des deux. Sur un PVC renforcé, l'acier apporte
  // vingt-cinq fois ce que le PVC apporte — mais le PVC est encore là.
  const renfortMm4 = Math.max(0, options.renfortCm4 ?? 0) * 10_000;
  const rigidite =
    MODULE_YOUNG[materiau] * Math.max(0.01, inertieCm4) * 10_000 +
    MODULE_YOUNG.acier * renfortMm4;
  const f = (5 * w * porteeMm ** 4) / (384 * rigidite);
  // Classe C d'EN 12210, plafonnée à 15 mm comme le demandent la plupart
  // des cahiers des charges.
  const admissible = Math.min(15, porteeMm / 300);
  return {
    flecheMm: Math.round(f * 100) / 100,
    admissibleMm: Math.round(admissible * 100) / 100,
    renfortRequis: f > admissible,
    hypotheses: [
      'appui simple, charge uniforme (f = 5wL⁴/384EI)',
      renfortMm4 > 0
        ? `section composite : ${materiau} + renfort acier de ${options.renfortCm4} cm⁴`
        : `section ${materiau} seule, sans renfort`,
      'critère de flèche L/300, plafonné à 15 mm (classe C, EN 12210)',
    ],
  };
}

/**
 * L'ÉPAISSEUR DE VERRE conseillée, en face extérieure (EN 16612, repères de
 * terrain).
 *
 * Ce n'est PAS une note de calcul : c'est le repère qui pré-remplit et qui
 * alerte. La contrainte suit `σ ≈ k·q·(a/t)²` et le vitrage isolant partage
 * la charge entre ses faces ; en tirer une épaisseur demande le petit côté,
 * le rapport de forme et le type de verre. Ici on rend le palier du métier,
 * avec ses hypothèses, et on bascule vers l'étude au-delà.
 */
export function epaisseurVerreConseilleeMm(options: {
  surfaceM2: number;
  pressionPa: number;
}): { faceExterieureMm: number; etudeRequise: boolean; hypotheses: string[] } {
  const { surfaceM2, pressionPa } = options;
  // Une pression forte revient à agrandir : on ramène la surface à une
  // surface équivalente sous 900 Pa, la pression d'une maison courante.
  const equivalente = surfaceM2 * Math.max(1, pressionPa / 900);
  const paliers: Array<[number, number]> = [
    [1.5, 4],
    [2.5, 6],
    [4.0, 8],
  ];
  for (const [limite, epaisseur] of paliers) {
    if (equivalente <= limite) {
      return {
        faceExterieureMm: epaisseur,
        etudeRequise: false,
        hypotheses: [
          'vitrage isolant vertical, appuyé sur ses quatre bords',
          'repères de terrain EN 16612 — ne remplace pas une note de calcul',
        ],
      };
    }
  }
  return {
    faceExterieureMm: 10,
    etudeRequise: true,
    hypotheses: [
      'au-delà de 4 m² équivalents : trempé ou étude de dimensionnement',
      'repères de terrain EN 16612 — ne remplace pas une note de calcul',
    ],
  };
}
