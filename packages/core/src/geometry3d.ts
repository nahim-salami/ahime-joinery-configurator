/**
 * Pourquoi ce fichier existe : la menuiserie EN VOLUME — l'assemblage des
 * pièces réelles, et les axes d'ouverture de ses vantaux. Elle alimente
 * deux consommateurs qui ne se parlent pas : la scène Three.js du widget et
 * les écrivains GLB/USDZ de la réalité augmentée. Les deux lisent les mêmes
 * triangles, donc montrent la même menuiserie.
 *
 * Solution écartée, et corrigée : modéliser en PAVÉS. La première version
 * empilait des boîtes ; le vitrage se noyait dans la masse, aucune arête ne
 * captait la lumière, et la poignée était un parallélépipède. Ce qui fait
 * une menuiserie crédible, ce sont les FEUILLURES (la marche qui reçoit
 * l'ouvrant, celle qui reçoit le verre), les COUPES D'ONGLET aux angles,
 * les PARCLOSES qui pincent le vitrage, le JET D'EAU en bas d'ouvrant, les
 * RAILS à gorges d'un coulissant, et une quincaillerie aux cotes du
 * commerce. Tout cela est construit ici, à partir des sections de
 * `geometrie/profils.ts` et des pièces de `geometrie/quincaillerie.ts`.
 *
 * Solution écartée aussi : modéliser en 3D à partir de la configuration.
 * La 2D le fait déjà, et deux modélisations divergeraient au premier
 * changement de bande de profil. La 3D reste **l'extrusion de l'élévation**
 * — chaque rectangle du dessin devient un ou plusieurs volumes, et la
 * cohérence 2D/3D est vraie par construction.
 *
 * Incident fondateur : la règle des néons — « le manifeste de mesures fait
 * foi, jamais le maillage ». Rien ici n'invente une cote : la profondeur
 * vient du catalogue, le clair de l'élévation, l'épaisseur du verre du
 * rapport de mesure. Aucune dépendance à three.js : ce module se teste
 * dans Node.
 */

import { complement3dDuGroupe, volume3dDuGroupe, type CadreDuMonde, type ContexteComplement } from './familles/volumes-3d.ts';
import type { JoineryConfiguration } from './types.ts';
import { offsetAligne } from './geometrie/formes.ts';
import { ROTATION_COURANTE_DEG } from './familles/vitrees/rotation-de-fenetre-de-toit.ts';

/**
 * LE PAS D'UNE LAME DE VOLET ROULANT DANS LE VOLUME, en millimètres.
 *
 * Il valait 88, et ce nombre ne venait de NULLE PART : la lame réelle fait
 * 41 (`LAME_VOLET_ROULANT_MM`), et l'élévation la dessine au DOUBLE — 82 —
 * en le disant, « à cette échelle, 41 mm donnent un peigne ». Trois pas pour
 * un même tablier, dont un sans source (docs/45 §4.2).
 *
 * Le volume adopte la convention DÉCLARÉE du trait plutôt que d'en inventer
 * une troisième : les deux vues montrent désormais le même nombre de lames,
 * et la cote réelle reste la seule source des deux.
 */
const PAS_LAME_VOLET_VUE_MM = 2 * LAME_VOLET_ROULANT_MM;

/**
 * L'ÉPAISSEUR D'UNE LAME DE STORE INTÉRIEUR, en mm, et L'ANGLE auquel le
 * volume la montre.
 *
 * L'épaisseur est celle d'une lame d'aluminium laqué. L'angle, lui, est une
 * CONVENTION DE VUE et non une cote : à plat, les lames se referment en une
 * surface pleine et redonnent l'enrouleur dont la fiche du produit prend
 * soin de les distinguer. Vingt degrés suffisent à ce qu'on voie qu'elles
 * s'orientent — ce qui EST l'argument du vénitien : régler la lumière sans
 * fermer.
 */

/**
 * LES SECTIONS D'UN OUVRAGE LINÉAIRE, en mm. Elles viennent des tables de
 * `ressources/donnees/familles-a-venir.json` (NF P01-012) : main courante
 * 40 × 40, poteaux 50 × 50, lisses 40 × 20. Ce sont les sections les plus
 * vendues, pas des valeurs choisies pour le dessin.
 */
/** L'épaisseur d'une lame, en mm. */

import {
  DEFAULT_CATALOG,
  coffreDe,
  estLineaire,
  estPortail,
  familleCatalog,
  modelePorteDe,
  deductionsDe,
  masseVueMm,
  posePourFamille,
  systemeDe,
  type PricingCatalog,
} from './catalog.ts';
import { computeElevation, coteGondsVolet, type ElevationRect } from './drawing.ts';
import { computeMeasureReport, vitrageEpaisseurMm, effectiveVitrage } from './structural.ts';
import {
  ajouterCadreDroit,
  ajouterCadreMitre,
  ajouterCylindreEntre,
  ajouterPave,
  ajouterPrisme,
  balayerContour,
  ajouterPaveOriente,
  boiteEnglobante,
  compterTriangles,
  deduplique,
  extruder,
  maillageVide,
  type Maillage,
  type Point2,
  type Point3,
} from './geometrie/maillage.ts';
import {
  cotesProfils,
  facesDuVitrage,
  profilPlat,
  profilAileRecouvrement,
  profilBarreauPortail,
  profilBarreVolet,
  profilBattement,
  profilCadreVolet,
  profilCapot,
  profilCoffre,
  profilDormant,
  profilJetDEau,
  profilLamePortail,
  profilLameVoletRoulant,
  LAME_VOLET_ROULANT_MM,
  profilOuvrant,
  profilParclose,
  profilRail,
  profilTapee,
  profilTubePortail,
  type CotesProfils,
} from './geometrie/profils.ts';
import {
  ajouterBarreDeTirage,
  ajouterCompas,
  ajouterBequille,
  ajouterGalet,
  ajouterPaumelle,
} from './geometrie/quincaillerie.ts';


// famille. Deux `moduleDe` dans un même fichier, c'est une confusion qui
// se paie une fois.
import { groupeDe, moduleDe as moduleDeFamille } from './familles/registre.ts';

export type { Point3 } from './geometrie/maillage.ts';

/**
 * Le repère : **x** vers la droite, **y** vers le haut, **z** vers
 * l'intérieur du logement. L'origine est au MILIEU DU SEUIL (x centré,
 * y = 0 en bas, z = 0 au nu extérieur du dormant) — une menuiserie posée en
 * réalité augmentée se plante ainsi dans le mur, à sa hauteur réelle, sans
 * conversion.
 */
export type Matiere3D =
  | 'cadre'
  | 'ouvrant'
  /** La peau extérieure d'une menuiserie bicolore — plaxage ou capot alu. */
  | 'cadre-exterieur'
  | 'vitrage'
  | 'panneau'
  | 'quincaillerie'
  /**
   * LES LISERÉS — joints de frappe, joint de vitrage, intercalaire. Ils ne
   * sont ni du cadre ni de la quincaillerie : ce sont des pièces SOMBRES et
   * MATES, et c'est leur teinte qui les fait lire comme des lignes plutôt
   * que comme du profilé. Sans eux, une fenêtre blanche sur un mur clair
   * est un bloc (docs/18 §3.2, G4-G5).
   */
  | 'joint'
  | 'toile'
  | 'module-pv'
  | 'maconnerie'
  | 'inox';

export type RolePiece =
  | 'dormant'
  | 'ouvrant'
  | 'battement'
  | 'parclose'
  | 'vitrage'
  | 'panneau'
  | 'jet-eau'
  | 'petit-bois'
  | 'poignee'
  | 'paumelle'
  | 'galet'
  | 'rail'
  | 'coffre'
  | 'coulisse'
  | 'lame'
  | 'toile'
  | 'lambrequin'
  | 'capot'
  | 'serrure'
  | 'grille'
  | 'moustiquaire'
  | 'seuil'
  | 'manoeuvre'
  | 'bras'
  | 'barre-de-charge'
  | 'capteur'
  | 'caisson'
  | 'barreau'
  | 'poteau'
  /** La butée de lame finale d'un volet roulant. */
  | 'butee'
  | 'moteur'
  /** Une lame de store vénitien intégré, entre les verres. */
  | 'store-integre'
  /** Les ferrures d'un volet battant. */
  | 'penture'
  | 'gond'
  | 'espagnolette'
  | 'tringle'
  | 'pied'
  /** Le montant intermédiaire qui divise une portée (lots D5, QM1). */
  | 'montant'
  | 'platine'
  | 'mur'
  | 'virole'
  
  | 'jaquette'
  | 'trou-d-homme'
  | 'piquage'
  | 'arret-volet'
  | 'barre'
  | 'echarpe'
  /** Le décor d'un panneau de porte, et ses accessoires. */
  | 'moulure'
  | 'insert'
  | 'judas'
  | 'heurtoir'
  /** Les liserés : le double joint de frappe, le joint de vitrage, l'intercalaire. */
  | 'joint-frappe'
  | 'joint-vitrage'
  | 'intercalaire'
  /** Le bras à ciseaux qui retient un vantail en soufflet. */
  | 'compas'
  | 'module-pv'
  | 'tablette'
  | 'joue'
  | 'fond'
  | 'socle';

/** Une pièce de l'assemblage : son maillage, sa matière, son vantail. */
export interface Piece {
  nom: string;
  role: RolePiece;
  matiere: Matiere3D;
  maillage: Maillage;
  /** Le vantail auquel la pièce appartient — absente si elle est fixe. */
  vantail?: number;
}

export type ModeOuvrant = 'frappe' | 'soufflet' | 'coulissant';

/**
 * Un vantail qui bouge. Le pivot est posé SUR l'axe de rotation (le milieu
 * du montant des paumelles) : la scène 3D place l'origine du groupe dessus
 * et n'a plus qu'un angle à animer — aucune matrice à recomposer par image.
 */
export interface Ouvrant {
  vantail: number;
  mode: ModeOuvrant;
  pivotMm: Point3;
  /** Rotation autour de `y` (frappe) ou de `x` (soufflet) ; sinon absente. */
  axe?: 'x' | 'y';
  /** +1 ou −1 — le sens dans lequel l'angle ouvre vers l'intérieur. */
  sens: 1 | -1;
  /** L'ouverture complète, en degrés (rotation) ou en mm (coulissant). */
  angleMaxDeg?: number;
  courseMm?: number;
}

export interface Geometry3D {
  pieces: Piece[];
  ouvrants: Ouvrant[];
  /** L'encombrement total, en millimètres. */
  horsToutMm: Point3;
  /**
   * Le contour du DORMANT dans le plan de la façade, en coordonnées du
   * monde — absent quand la menuiserie est rectangulaire. Le décor s'en
   * sert pour percer le mur à la bonne forme : sans lui, un plein cintre
   * flottait dans un trou carré, avec deux triangles de vide aux épaules.
   */
  contourDormantMm?: Array<[number, number]>;
  hauteurAuxBordsMm: number;
  /** La profondeur de profilé retenue — la même que la coupe technique. */
  epaisseurProfilMm: number;
  /** Les cotes d'atelier retenues — utiles aux tests et au dossier. */
  cotes: CotesProfils;
  /** Le nombre de triangles — le budget de la scène se surveille. */
  triangles: number;
}

/** Un atelier : on y dépose des pièces, il rend la liste. */
class Atelier {
  readonly pieces: Piece[] = [];

  poser(nom: string, role: RolePiece, matiere: Matiere3D, vantail?: number): Maillage {
    const maillage = maillageVide();
    this.pieces.push({ nom, role, matiere, maillage, ...(vantail === undefined ? {} : { vantail }) });
    return maillage;
  }
}

/** Les cotes d'un rectangle d'élévation, converties dans le repère du monde. */
/**
 * IL EST DÉCLARÉ DANS `familles/volumes-3d.ts` DEPUIS LE LOT D16 : c'est la
 * monnaie de la couture, et un morceau de groupe ne peut pas importer le
 * fichier dont on vient de le sortir. Le nom local reste, pour que les
 * quarante lectures de ce fichier ne bougent pas ; deux déclarations du même
 * cadre auraient demandé un comparateur qu'on n'était pas obligé de créer
 * (leçon du lot MT2b).
 */
type CadreMonde = CadreDuMonde;

/**
 * `centreXMm` est l'ABSCISSE DU MILIEU de l'ouvrage dans le dessin — et non
 * la moitié de sa largeur. Les deux se confondent tant que le dessin
 * commence à x = 0, ce qui est le cas de toutes les formes ouvertes. Un
 * ŒIL-DE-BŒUF, lui, ne commence pas à zéro : commandé en 1600 × 1350, c'est
 * un cercle de Ø 1350 qui va de 125 à 1475. Recentrer sur la moitié de
 * l'extrémité droite le poussait de 62,5 mm hors de sa propre baie, et le
 * mur montrait une bande morte de 125 mm à gauche, à gauche seulement.
 */
function auMonde(
  rect: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  centreXMm: number,
  hauteurDessin: number,
): CadreMonde {
  return {
    x: rect.xMm - centreXMm,
    y: hauteurDessin - rect.yMm - rect.heightMm,
    largeur: rect.widthMm,
    hauteur: rect.heightMm,
  };
}

/**
 * Le panneau d'une porte, rainures comprises. Une rainure est un CREUX :
 * le panneau sort en bandes pleines séparées par des bandes moins
 * profondes. Une rainure posée EN APPLIQUE par-dessus un panneau plein ne
 * serait pas une rainure, ce serait une baguette — et l'inverse exact de
 * ce que le modèle vend.
 */
function ajouterPanneauPorte(
  maillage: Maillage,
  centre: Point3,
  taille: Point3,
  rainures: number,
): void {
  if (rainures <= 0) {
    ajouterPave(maillage, centre, taille);
    return;
  }
  const largeurRainure = Math.min(30, taille.xMm / (rainures * 4 + 2));
  const creux = Math.min(taille.zMm * 0.45, 13);
  const pas = taille.xMm / (rainures + 1);
  const gauche = centre.xMm - taille.xMm / 2;
  let curseur = gauche;
  for (let index = 1; index <= rainures + 1; index++) {
    const finBande =
      index <= rainures ? gauche + pas * index - largeurRainure / 2 : gauche + taille.xMm;
    if (finBande - curseur > 0.5) {
      ajouterPave(
        maillage,
        { xMm: (curseur + finBande) / 2, yMm: centre.yMm, zMm: centre.zMm },
        { xMm: finBande - curseur, yMm: taille.yMm, zMm: taille.zMm },
      );
    }
    if (index > rainures) break;
    const finCreux = finBande + largeurRainure;
    // Le fond de rainure : même face intérieure, face extérieure reculée.
    ajouterPave(
      maillage,
      { xMm: (finBande + finCreux) / 2, yMm: centre.yMm, zMm: centre.zMm + creux / 2 },
      { xMm: largeurRainure, yMm: taille.yMm, zMm: Math.max(2, taille.zMm - creux) },
    );
    curseur = finCreux;
  }
}

/** La boîte d'un contour, en coordonnées d'élévation. */
function boiteDuContour(points: Array<[number, number]>): {
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
  return { xMm: xMin, yMm: yMin, widthMm: xMax - xMin, heightMm: yMax - yMin };
}

/** Le sens d'ouverture lu sur le symbole 2D — la pointe du V aux paumelles. */
function cotePaumelles(
  symboles: Array<{ x2Mm: number }>,
  cadre: CadreMonde,
  centreXMm: number,
): 'gauche' | 'droite' {
  const pointeX = symboles[0].x2Mm - centreXMm;
  return pointeX < cadre.x + cadre.largeur / 2 ? 'gauche' : 'droite';
}

/**
 * La géométrie en volume. Les coordonnées de l'élévation (origine en haut à
 * gauche, y vers le bas) sont converties une seule fois, ici, vers le repère
 * du monde (origine au milieu du seuil, y vers le haut).
 */
export function computeGeometry3D(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): Geometry3D {
  const elevation = computeElevation(config, catalog);
  const mesure = computeMeasureReport(config, catalog);
  // `familleCatalog()` plutôt qu'un accès direct : depuis le lot 0.2, une
  // famille n'est au catalogue qu'une fois son module chargé, et le refus
  // doit nommer l'appel manquant plutôt que laisser un `undefined` filer
  // jusqu'à une bande de profil.
  const fam = familleCatalog(catalog, config.famille);
  // La profondeur du profilé vient de la gamme NOMMÉE quand il y en a une :
  // c'est elle qui donne au volume sa troisième dimension, et deux systèmes
  // d'un même palier tarifaire n'ont pas la même épaisseur.
  const systeme = systemeDe(catalog, config.systeme);
  const profondeur =
    systeme?.epaisseurMm ?? catalog.profils.epaisseurMm[config.materiau]?.[config.gamme] ?? 70;
  // LA MASSE VUE ET SON PARTAGE viennent de la chaîne de cotes (lot 0),
  // par la même fonction que le rapport de mesure et que le trait : le
  // profilé dessiné s'arrête donc exactement là où le verre commence.
  const pose = posePourFamille(catalog, config.famille, config.pose);
  const bande = masseVueMm(catalog, config.famille, config.materiau, pose);
  const ded = deductionsDe(catalog, config.famille, config.materiau);
  const vitrage = effectiveVitrage(config, catalog);
  // L'épaisseur HORS TOUT — verre plus lames d'air. C'est elle que la
  // feuillure reçoit et que le volume dessine ; le poids, lui, ne compte
  // que les faces (voir `vitrageEpaisseurMm`).
  const verreMm = vitrage ? vitrageEpaisseurMm(vitrage, catalog) : 0;
  const cotes = cotesProfils({
    // tube : on garde le partage de moitié d'avant le lot 0, qui vaut ce
    // qu'il vaut pour un profilé sans feuillure.
    dormantVuMm: ded ? ded.dormantVuMm : bande * 0.5,
    ouvrantVuMm: ded ? ded.ouvrantVuMm : bande * 0.5,
    profondeurMm: profondeur,
    vitrageMm: verreMm,
    priseDeVerreMm: ded?.priseDeVerreMm,
  });

  // L'aile de recouvrement d'un dormant de rénovation déborde de la cote
  // saisie, des deux côtés. La compter dans l'enveloppe décentrerait tout le
  // modèle de la moitié de l'aile — `auMonde()` centre sur le milieu du dessin.
  const corps = elevation.rects.filter((rect) => rect.role !== 'recouvrement');
  // LE HORS-TOUT EST UNE BOÎTE, pas une distance à l'origine. Le premier jet
  // ne relevait que le MAXIMUM — ce qui revient à supposer que tout dessin
  // commence à x = 0. C'est vrai de toutes les formes ouvertes, dont le
  // dormant part du bord gauche ; c'est faux d'une forme CLOSE, qui est
  // inscrite dans la cote commandée et n'en touche pas les côtés dès que la
  // largeur et la hauteur diffèrent.
  let hauteurDessin = 0;
  let gaucheDessin = Infinity;
  let droiteDessin = -Infinity;
  for (const r of corps) {
    hauteurDessin = Math.max(hauteurDessin, r.yMm + r.heightMm);
    gaucheDessin = Math.min(gaucheDessin, r.xMm);
    droiteDessin = Math.max(droiteDessin, r.xMm + r.widthMm);
  }
  for (const contour of elevation.contours) {
    for (const [x, y] of contour.points) {
      gaucheDessin = Math.min(gaucheDessin, x);
      droiteDessin = Math.max(droiteDessin, x);
      hauteurDessin = Math.max(hauteurDessin, y);
    }
  }
  if (!Number.isFinite(gaucheDessin)) gaucheDessin = 0;
  if (!Number.isFinite(droiteDessin)) droiteDessin = 0;
  const largeurDessin = droiteDessin - gaucheDessin;
  /** Le MILIEU de l'ouvrage dans le dessin — voir `auMonde()`. */
  const centreXMm = gaucheDessin + largeurDessin / 2;
  const monde = (rect: Pick<ElevationRect, 'xMm' | 'yMm' | 'widthMm' | 'heightMm'>) =>
    auMonde(rect, centreXMm, hauteurDessin);
  // Un contour d'élévation dans le repère du monde : x recentré, y retourné.
  const contourMonde = (points: Array<[number, number]>): Point2[] =>
    points.map(([x, y]) => [x - centreXMm, hauteurDessin - y] as Point2);

  // L'ANGLE SUIT LE MATÉRIAU (lot 3D-B, G9). Le PVC se soude en onglet,
  // l'aluminium se sertit en onglet, le bois s'assemble à JOINT DROIT :
  // montants sur toute la hauteur, traverses entre eux. Un seul aiguillage
  // ici, pour que pas un cadre du fichier ne puisse l'oublier.
  const jointDroit = config.materiau === 'bois';
  const cadreDuMateriau = (
    maillage: Maillage,
    boite: { xMm: number; yMm: number; largeurMm: number; hauteurMm: number; zMm: number },
    profil: Point2[],
    largeurMontantMm: number,
  ) => {
    if (jointDroit) ajouterCadreDroit(maillage, boite, profil, largeurMontantMm);
    else ajouterCadreMitre(maillage, boite, profil);
  };

  const atelier = new Atelier();

  // LES FAMILLES QUI APPORTENT LEUR PROPRE VOLUME SORTENT ICI, avant tout
  // le reste, et c'est le seul endroit de ce fichier qui court-circuite le
  // chemin générique. Le volume vient du MODULE DE LA FAMILLE, comme le
  // tracé d'une forme (`contourDeForme`) : il ne se télécharge qu'avec
  // elle, et une session qui configure une fenêtre n'en lit pas un octet.
  //
  // dessine un PLAN vu de dessus, où `y` est la PROJECTION et non une
  // hauteur. Tout ce qui suit — `monde()`, `contourMonde()`, la boucle des
  // chemin aurait dressé son damier à la verticale : un MUR de panneaux,
  // juste dans ses cotes et faux dans sa nature. C'est la règle §7.1 de la
  // compétence `geometrie-menuiserie-3d`.
  // élévation ne porte QU'UN rect — le caisson —, ses étagères étant des
  // TRAITS. Le chemin générique n'extrude pas les traits ; il rendait donc
  // une caisse pleine sans une seule étagère, ce qui est le contraire du
  // PROFONDEUR, que la façade ne dit pas.
  // LE CONTEXTE PORTE L'ÉLÉVATION ET LE REPÈRE depuis le lot D16 : la
  // manquait pour sortir son volume d'ici. Les deux sont des LECTURES — le
  // dessin est déjà calculé quand l'aiguillage a lieu.
  if (
    volume3dDuGroupe(groupeDe(config.famille))?.({
      atelier,
      config,
      elevation,
      monde,
      dessin: { largeurMm: largeurDessin, hauteurMm: hauteurDessin },
    }) === true
  ) {
    const pieces = atelier.pieces.map((piece) => ({
      ...piece,
      maillage: deduplique(piece.maillage),
    }));
    const triangles = pieces.reduce(
      (somme, piece) => somme + compterTriangles(piece.maillage),
      0,
    );
    // LE HORS-TOUT SE MESURE SUR LE VOLUME, pas sur le dessin. Le plan ne
    // apporte —, et le cadrage de la caméra la demande.
    let hautMm = 0;
    // LA PROFONDEUR EST UNE ÉTENDUE, PAS UN RAYON — relevé au lot D1.
    //
    // Elle se lisait en `max(|z|)`, ce qui suppose que l'ouvrage tient d'un
    // tiroir OUVERT devant elle. Son maillage s'étend de −450 (le fond) à
    // +356 (la façade sortie), soit 806 mm — et `max(|z|)` en annonçait 450.
    //
    // Or c'est cette boîte que la scène CADRE. Le volume est la seule vue
    // qui montre ce que la coulisse coûte au sol, et il la montrait hors
    // champ : la caméra coupait exactement le tiroir qui fait l'intérêt de
    // la vue. Pour tout ouvrage qui tient d'un côté de l'origine, l'étendue
    // vaut l'ancien `max(|z|)`, et rien ne bouge.
    let zMini = 0;
    let zMaxi = 0;
    // D15. Elle valait `config.widthMm`, ce qui suppose que le maillage
    // lui-même de son emprise :
    //
    //     d'affichage que le trait emploie aussi — et le hors-tout en
    //     annonçait vingt : la caméra cadrait quatorze mètres de vide ;
    //   · un GALANDAGE porte son REFOULEMENT à gauche du zéro, et c'est le
    //     sujet du lot MT7c : 1 785 mm dessinés pour 1 000 commandés ;
    //   · un CHAMP AU SOL ne remplit pas la largeur déclarée — les modules
    //     ne se coupent pas, et 8 000 commandés en occupent 7 048.
    //
    // Le chemin GÉNÉRIQUE, lui, garde la cote commandée : son maillage sort
    // de l'élévation, qui est cotée, et la mesurer n'y changerait rien.
    let xMini = 0;
    let xMaxi = 0;
    for (const piece of pieces) {
      for (let i = 0; i < piece.maillage.positions.length; i += 3) {
        hautMm = Math.max(hautMm, piece.maillage.positions[i + 1]);
        const x = piece.maillage.positions[i];
        if (x < xMini) xMini = x;
        if (x > xMaxi) xMaxi = x;
        const z = piece.maillage.positions[i + 2];
        if (z < zMini) zMini = z;
        if (z > zMaxi) zMaxi = z;
      }
    }
    const profondMm = zMaxi - zMini;
    const largeMm = Math.max(xMaxi - xMini, 1);
    return {
      pieces,
      // c'est une propriété, pas un manque : une famille sans ouvrant ne
      // porte aucune animation, et la scène ne cherche pas de charnière.
      ouvrants: [],
      horsToutMm: { xMm: largeMm, yMm: hautMm, zMm: profondMm },
      hauteurAuxBordsMm: hautMm,
      epaisseurProfilMm: profondeur,
      cotes,
      triangles,
    };
  }

  // plus bas. Deux listes évitent d'avoir à déplacer la boucle existante.
  const ouvrantsPortail: Ouvrant[] = [];
  const coulissant =
    config.ouverture === 'coulissant' ||
    config.ouverture === 'galandage' ||
    // Le LEVAGE glisse comme un coulissant (lot MT1a) — son levage de 5 à
    // 10 mm ne se voit pas à cette échelle, et l'omettre le faisait pivoter.
    config.ouverture === 'levage';

  // Une menuiserie de FORME a déplacé son dormant, ses ouvrants et ses
  // clairs dans `contours`. Tout le reste du module — quincaillerie, jet
  // d'eau, options, bloc-baie — raisonne en rectangles et n'a aucune raison
  // de changer : on lui donne la BOÎTE de chaque contour, et on garde le
  // contour à part pour ce qui doit vraiment épouser la forme.
  const contourParPiece = new Map<string, Array<[number, number]>>();
  const cle = (role: string, vantail: number | undefined) => `${role}:${vantail ?? 'fixe'}`;
  const rectsEffectifs: ElevationRect[] = [...elevation.rects];
  for (const contour of elevation.contours) {
    const boite = boiteDuContour(contour.points);
    rectsEffectifs.push({ role: contour.role, ...boite, vantail: contour.vantail, fixe: contour.fixe });
    contourParPiece.set(cle(contour.role, contour.vantail), contour.points);
  }
  const formee = elevation.contours.length > 0;

  const clairs = new Map<number | 'fixe', ElevationRect>();
  for (const rect of rectsEffectifs) {
    if (rect.role === 'clair') clairs.set(rect.vantail ?? 'fixe', rect);
  }
  const ouvrantsRects = rectsEffectifs.filter((rect) => rect.role === 'ouvrant');

  // ---- Le dormant, cadre à coupe d'onglet ----
  const rectDormant = rectsEffectifs.find((rect) => rect.role === 'dormant');
  if (rectDormant && ouvrantsRects.length > 0) {
    const contourDormant = contourParPiece.get(cle('dormant', undefined));
    if (contourDormant) {
      // Une menuiserie de forme n'a plus quatre barres coupées d'onglet :
      // elle a UN développé continu, celui que le cintreur produit.
      balayerContour(
        atelier.poser('dormant', 'dormant', 'cadre'),
        contourMonde(contourDormant),
        profilDormant(cotes),
        0,
        offsetAligne,
      );
    } else {
      const cadre = monde(rectDormant);
      cadreDuMateriau(
        atelier.poser('dormant', 'dormant', 'cadre'),
        { xMm: cadre.x, yMm: cadre.y, largeurMm: cadre.largeur, hauteurMm: cadre.hauteur, zMm: 0 },
        profilDormant(cotes),
        cotes.dormantLargeur,
      );
    }
  }

  // ---- CE QUE LE GROUPE AJOUTE APRÈS LE CADRE — lot D16c ----
  //
  // La porte de garage sectionnelle et les ferrures du volet battant vivaient
  // ici, dans le morceau que tire tout visiteur qui ouvre la 3D. Elles ne
  // REMPLACENT pas le chemin générique, comme le store banne (lot D16b) : elles
  // le COMPLÈTENT, à deux moments précis. Le groupe les pose désormais par
  // `complement3dDuGroupe`, à la place exacte où elles étaient — l'ordre des
  // pièces est épinglé, et `volume-des-fermetures-epingle.test.ts` le compare.
  const groupe = groupeDe(config.famille);
  const zOuvrant = cotes.dormantProfondeur - cotes.ouvrantProfondeur;
  const optionsIds = (config.options ?? []).map((option) => option.id);
  const contexteComplement: ContexteComplement = {
    atelier,
    config,
    elevation,
    monde,
    dessin: { largeurMm: largeurDessin, hauteurMm: hauteurDessin },
    profondeur,
    rects: rectsEffectifs,
    catalog,
    ouvrants: ouvrantsPortail,
    cotes,
    zOuvrant,
    rectDormant,
    optionsIds,
    vantaux: mesure.vantaux,
  };
  complement3dDuGroupe(groupe, 'apres-le-dormant')?.(contexteComplement);

  // ---- Ce que la POSE ajoute au dormant ----
  // Deux pièces, deux directions opposées : l'aile de recouvrement part vers
  // l'EXTÉRIEUR coiffer l'ancien cadre ; la tapée part vers l'INTÉRIEUR
  // rattraper le doublage. Toutes deux sont facturées — elles doivent donc
  // se voir, sans quoi le client paie un profilé qui n'existe qu'au devis.
  const rectRecouvrement = elevation.rects.find((rect) => rect.role === 'recouvrement');
  if (rectRecouvrement && rectDormant) {
    const cadre = monde(rectRecouvrement);
    const epaisseur = 6;
    const retour = Math.min(9, pose.recouvrementMm * 0.3);
    ajouterCadreMitre(
      // La matière est celle de la peau EXTÉRIEURE : cette aile ne se voit
      // que de la rue. Sur une menuiserie unie les deux teintes sont la
      // même et rien ne change ; sur une RAL une face, l'aile serait sortie
      // blanche au milieu d'une façade grise.
      atelier.poser('aile-recouvrement', 'dormant', 'cadre-exterieur'),
      {
        xMm: cadre.x,
        yMm: cadre.y,
        largeurMm: cadre.largeur,
        hauteurMm: cadre.hauteur,
        // L'aile affleure la face extérieure du dormant : sa lèvre s'arrête
        // à z = 0, elle ne flotte pas devant.
        zMm: -(epaisseur + retour),
      },
      profilAileRecouvrement(pose.recouvrementMm, cotes.dormantLargeur * 0.5, epaisseur),
    );
  }
  if (mesure.tapeeMm > 0 && rectDormant) {
    const cadre = monde(rectDormant);
    ajouterCadreMitre(
      atelier.poser('tapee', 'dormant', 'cadre'),
      {
        xMm: cadre.x,
        yMm: cadre.y,
        largeurMm: cadre.largeur,
        hauteurMm: cadre.hauteur,
        // Elle prend le relais exactement où le dormant s'arrête.
        zMm: cotes.dormantProfondeur,
      },
      profilTapee(cotes.dormantLargeur, mesure.tapeeMm),
    );
  }

  // ---- Les rails d'un coulissant : le seuil et le guide haut ----
  if (coulissant && rectDormant) {
    const cadre = monde(rectDormant);
    const gorgeLargeur = cotes.ouvrantProfondeur * 0.42;
    const jeu = cotes.dormantProfondeur * 0.08;
    const gorges = [
      { depart: jeu, largeur: gorgeLargeur, profondeur: 12 },
      { depart: cotes.dormantProfondeur - jeu - gorgeLargeur, largeur: gorgeLargeur, profondeur: 12 },
    ];
    const hauteurRail = 30;
    const maillageBas = atelier.poser('rail-bas', 'rail', 'cadre');
    extruder(
      maillageBas,
      profilRail(hauteurRail, cotes.dormantProfondeur, gorges, true).map(
        ([u, v]) => [cadre.y + cotes.dormantLargeur * 0.5 + u, v] as Point2,
      ),
      'x',
      {
        debut: cadre.x + cotes.dormantLargeur,
        fin: cadre.x + cadre.largeur - cotes.dormantLargeur,
      },
    );
    const maillageHaut = atelier.poser('rail-haut', 'rail', 'cadre');
    extruder(
      maillageHaut,
      profilRail(hauteurRail, cotes.dormantProfondeur, gorges, false).map(
        ([u, v]) =>
          [cadre.y + cadre.hauteur - cotes.dormantLargeur * 0.5 - hauteurRail + u, v] as Point2,
      ),
      'x',
      {
        debut: cadre.x + cotes.dormantLargeur,
        fin: cadre.x + cadre.largeur - cotes.dormantLargeur,
      },
    );
  }

  // La cote où commence l'ouvrant : il se loge DANS le dormant, sa face
  // intérieure venant affleurer.

  // ---- Le caisson de galandage : le fourreau qui avale le vantail ----
  // C'est lui qu'on paie 45 % de plus, et il n'existait pas : le vantail
  // glissait dans le vide. Il se prolonge de part et d'autre de la baie,
  // dans l'épaisseur du mur, sur la largeur d'un vantail.
  if (config.ouverture === 'galandage' && rectDormant) {
    const cadre = monde(rectDormant);
    const largeurVantail = cadre.largeur / Math.max(1, mesure.vantaux);
    const caisson = atelier.poser('caisson', 'caisson', 'cadre');
    const epaisseur = cotes.dormantProfondeur * 1.25;
    for (const signe of [-1, 1]) {
      // Les deux joues du fourreau, dessus et dessous, laissent le passage
      // du vantail entre elles — un caisson plein n'avalerait rien.
      for (const face of [-1, 1]) {
        ajouterPave(caisson, {
          xMm: signe * (cadre.largeur / 2 + largeurVantail / 2),
          yMm: cadre.y + cadre.hauteur / 2,
          zMm: zOuvrant + cotes.ouvrantProfondeur / 2 + face * (epaisseur / 2 + 14),
        }, {
          xMm: largeurVantail,
          yMm: cadre.hauteur,
          zMm: 26,
        });
      }
      // Le fond du fourreau, côté opposé à la baie.
      ajouterPave(caisson, {
        xMm: signe * (cadre.largeur / 2 + largeurVantail + 13),
        yMm: cadre.y + cadre.hauteur / 2,
        zMm: zOuvrant + cotes.ouvrantProfondeur / 2,
      }, {
        xMm: 26,
        yMm: cadre.hauteur,
        zMm: epaisseur + 54,
      });
    }
  }

  // ---- Les ouvrants, leurs vitrages, leurs parcloses ----
  const remplissage = config.remplissagePorte ?? 'pleine';
  const modele = modelePorteDe(catalog, config.famille, config.modelePorte);
  const rainuresModele = Math.max(0, Math.round(modele?.decor.rainures ?? 0));
  const petitsBois = optionsIds.includes('petits-bois');

  for (const rect of ouvrantsRects) {
    const cadre = monde(rect);
    const vantail = rect.vantail;
    const clair = clairs.get(vantail ?? 'fixe');
    // UNE IMPOSTE EST LA PARTIE FIXE D'UNE MENUISERIE VITRÉE — le châssis
    // ils n'ont qu'une partie fixe, qui est tout l'ouvrage. Le nom part
    // dans le GLB que le client télécharge et dans le nom du maillage de la
    const nom =
      vantail === undefined ? (fam.vitree ? 'imposte' : 'partie-fixe') : `vantail-${vantail}`;

    if (!clair) {
      // Un volet battant est un CADRE garni de lames — pas un panneau. En
      // pavé plein, il recouvrait ses propres persiennes et se rendait en
      // dalle de bois : deux planches sans une ligne.
      // dans le panneau de porte : une dalle pleine de 3,50 m, sans le
      // moindre ajour — c'est-à-dire l'inverse exact du produit, et un
      // taux d'ajourage démenti par le dessin.
      if (estPortail(config.famille)) {
        const tube = profilTubePortail(bande, profondeur * 0.6);
        const contourVantail = contourParPiece.get(cle('ouvrant', vantail));
        if (contourVantail) {
          // est un développé continu, comme celui d'une fenêtre cintrée.
          balayerContour(
            atelier.poser(nom, 'ouvrant', 'ouvrant', vantail),
            contourMonde(contourVantail),
            tube,
            0,
            offsetAligne,
          );
        } else {
          ajouterCadreMitre(
            atelier.poser(nom, 'ouvrant', 'ouvrant', vantail),
            { xMm: cadre.x, yMm: cadre.y, largeurMm: cadre.largeur, hauteurMm: cadre.hauteur, zMm: 0 },
            tube,
          );
        }
        continue;
      }
      if (config.famille === 'volet-battant') {
        ajouterCadreMitre(
          atelier.poser(nom, 'ouvrant', 'ouvrant', vantail),
          {
            xMm: cadre.x,
            yMm: cadre.y,
            largeurMm: cadre.largeur,
            hauteurMm: cadre.hauteur,
            zMm: 0,
          },
          profilCadreVolet(70, profondeur * 0.55),
        );
        continue;
      }
      // Sinon : un panneau plein (porte pleine), rainuré si le modèle le veut.
      ajouterPanneauPorte(
        atelier.poser(nom, 'panneau', 'panneau', vantail),
        {
          xMm: cadre.x + cadre.largeur / 2,
          yMm: cadre.y + cadre.hauteur / 2,
          zMm: zOuvrant + cotes.ouvrantProfondeur / 2,
        },
        { xMm: cadre.largeur, yMm: cadre.hauteur, zMm: cotes.ouvrantProfondeur },
        rainuresModele,
      );
      continue;
    }

    const profilCadre =
      coulissant && vantail !== undefined ? profilBattement(cotes) : profilOuvrant(cotes);
    const contourOuvrant = contourParPiece.get(cle('ouvrant', vantail));
    const maillageOuvrant = atelier.poser(
      nom,
      coulissant && vantail !== undefined ? 'battement' : 'ouvrant',
      'ouvrant',
      vantail,
    );
    if (contourOuvrant) {
      balayerContour(maillageOuvrant, contourMonde(contourOuvrant), profilCadre, zOuvrant, offsetAligne);
    } else {
      cadreDuMateriau(
        maillageOuvrant,
        { xMm: cadre.x, yMm: cadre.y, largeurMm: cadre.largeur, hauteurMm: cadre.hauteur, zMm: zOuvrant },
        profilCadre,
        cotes.ouvrantLargeur,
      );
    }

    const clairMonde = monde(clair);
    const contourClair = contourParPiece.get(cle('clair', vantail));
    // Le vitrage, logé dans sa feuillure — l'épaisseur est celle du verre
    // effectif, feuilleté imposé compris.
    const zVerre = zOuvrant + cotes.ouvrantProfondeur - cotes.vitrageEpaisseur - cotes.parcloseLargeur * 0.55;
    const maillageVitrage = atelier.poser(`${nom}-vitrage`, 'vitrage', 'vitrage', vantail);
    // UN VITRAGE ISOLANT, C'EST DEUX VERRES ET DE L'AIR — pas un bloc de
    // vingt-quatre millimètres. La différence se voit : deux surfaces
    // réfléchissent le ciel avec un léger décalage, et c'est ce reflet
    // dédoublé qui dit « double vitrage » à l'œil. Un bloc plein, lui,
    // renvoie un seul reflet et ressemble à du plexiglas.
    //
    // Les faces gardent l'épaisseur du CATALOGUE ; c'est la lame d'air au
    // milieu qui est du vide, et c'est elle qu'on ne modélise pas.
    const faces = facesDuVitrage(cotes.vitrageEpaisseur);
    if (contourClair) {
      // Le verre d'un cintré est une PLAQUE DÉCOUPÉE, pas un rectangle
      // rogné : le prisme épouse le contour, jusqu'à la corde de l'arc.
      for (const face of faces) {
        ajouterPrisme(
          maillageVitrage,
          contourMonde(contourClair),
          zVerre + face.debut,
          zVerre + face.debut + face.epaisseur,
        );
      }
    } else {
      for (const face of faces) {
        ajouterPave(
          maillageVitrage,
          {
            xMm: clairMonde.x + clairMonde.largeur / 2,
            yMm: clairMonde.y + clairMonde.hauteur / 2,
            zMm: zVerre + face.debut + face.epaisseur / 2,
          },
          { xMm: clairMonde.largeur, yMm: clairMonde.hauteur, zMm: face.epaisseur },
        );
      }
    }

    // L'INTERCALAIRE — la bande qui sépare les deux verres et scelle la
    // lame d'air. Deux à trois millimètres de noir qui bordent tout le
    // clair : c'est le détail que tout le monde reconnaît sans savoir le
    // nommer, et son absence est ce qui faisait du vitrage un film de
    // couleur. Il est EN RETRAIT du bord du verre — la parclose en
    // recouvre une partie, et le reste se voit.
    if (!contourClair && faces.length > 1) {
      const retrait = Math.min(9, cotes.parcloseLargeur * 0.7);
      const largeur = Math.max(6, cotes.vitrageEpaisseur * 0.6);
      const zEntreDeux = zVerre + faces[0].epaisseur;
      const epaisseurLame = faces[1].debut - faces[0].epaisseur;
      ajouterCadreMitre(
        atelier.poser(`${nom}-intercalaire`, 'intercalaire', 'joint', vantail),
        {
          xMm: clairMonde.x + retrait,
          yMm: clairMonde.y + retrait,
          largeurMm: Math.max(0, clairMonde.largeur - 2 * retrait),
          hauteurMm: Math.max(0, clairMonde.hauteur - 2 * retrait),
          zMm: zEntreDeux,
        },
        profilPlat(largeur, Math.max(1, epaisseurLame)),
      );
    }

    // LE JOINT DE VITRAGE — le liseré souple entre la parclose et le
    // verre. Cinq à sept millimètres, gris ou noir selon la gamme, sur
    // tout le pourtour. Sans lui, le verre semble encastré dans la masse.
    if (!contourClair) {
      const jointVitrage = Math.min(6, cotes.parcloseLargeur * 0.5);
      ajouterCadreMitre(
        atelier.poser(`${nom}-joint-vitrage`, 'joint-vitrage', 'joint', vantail),
        {
          xMm: clairMonde.x - jointVitrage,
          yMm: clairMonde.y - jointVitrage,
          largeurMm: clairMonde.largeur + 2 * jointVitrage,
          hauteurMm: clairMonde.hauteur + 2 * jointVitrage,
          zMm: zVerre + cotes.vitrageEpaisseur,
        },
        profilPlat(jointVitrage, 3),
      );
    }

    // La parclose : la baguette qui pince le verre côté intérieur.
    const pl = cotes.parcloseLargeur;
    const maillageParclose = atelier.poser(`${nom}-parclose`, 'parclose', 'ouvrant', vantail);
    if (contourClair) {
      // Elle suit le clair, débordée de sa propre largeur : c'est ce
      // débord qui vient recouvrir la tranche du verre.
      balayerContour(
        maillageParclose,
        offsetAligne(contourMonde(contourClair), -pl),
        profilParclose(cotes),
        zVerre + cotes.vitrageEpaisseur,
        offsetAligne,
      );
    } else {
      ajouterCadreMitre(
        maillageParclose,
        {
          xMm: clairMonde.x - pl,
          yMm: clairMonde.y - pl,
          largeurMm: clairMonde.largeur + 2 * pl,
          hauteurMm: clairMonde.hauteur + 2 * pl,
          zMm: zVerre + cotes.vitrageEpaisseur,
        },
        profilParclose(cotes),
      );
    }

    // Les petits-bois sont INTÉGRÉS : ils vivent entre les deux vitres.
    if (petitsBois) {
      const lignes = elevation.lines.filter(
        (ligne) => ligne.role === 'petit-bois' && ligne.vantail === vantail,
      );
      if (lignes.length > 0) {
        const maillage = atelier.poser(`${nom}-petits-bois`, 'petit-bois', 'ouvrant', vantail);
        for (const ligne of lignes) {
          // Un barreau se pose le long de SA droite, quelle qu'en soit
          // l'inclinaison : une composition en losanges n'a ni horizontale
          // ni verticale, et la traiter comme un rectangle aligné donnait
          // des croix là où il fallait des obliques.
          const longueur = Math.hypot(ligne.x2Mm - ligne.x1Mm, ligne.y2Mm - ligne.y1Mm);
          if (longueur < 1) continue;
          const milieu = auMonde(
            {
              xMm: (ligne.x1Mm + ligne.x2Mm) / 2,
              yMm: (ligne.y1Mm + ligne.y2Mm) / 2,
              widthMm: 0,
              heightMm: 0,
            },
            centreXMm,
            hauteurDessin,
          );
          // L'élévation compte ses ordonnées vers le BAS : l'angle change de
          // signe en passant dans le repère du monde.
          const angle = -Math.atan2(ligne.y2Mm - ligne.y1Mm, ligne.x2Mm - ligne.x1Mm);
          ajouterPaveOriente(
            maillage,
            { xMm: milieu.x, yMm: milieu.y, zMm: zVerre + cotes.vitrageEpaisseur / 2 },
            { xMm: longueur, yMm: 20, zMm: cotes.vitrageEpaisseur * 0.55 },
            angle,
          );
        }
      }
    }

    // Une porte semi-vitrée garde du panneau sous son clair.
    if (config.famille === 'porte-entree' && remplissage !== 'pleine') {
      const basPanneau = cadre.y + cotes.ouvrantLargeur;
      const hautPanneau = clairMonde.y;
      if (hautPanneau - basPanneau > 1) {
        ajouterPanneauPorte(
          atelier.poser(`${nom}-panneau`, 'panneau', 'panneau', vantail),
          {
            xMm: cadre.x + cadre.largeur / 2,
            yMm: (basPanneau + hautPanneau) / 2,
            zMm: zOuvrant + cotes.ouvrantProfondeur / 2,
          },
          {
            xMm: cadre.largeur - 2 * cotes.ouvrantLargeur,
            yMm: hautPanneau - basPanneau,
            zMm: cotes.ouvrantProfondeur * 0.7,
          },
          rainuresModele,
        );
      }
    }

    // LE JOINT DE FRAPPE, à la jonction du dormant et de l'ouvrant.
    //
    // Vu de l'intérieur, la face du dormant et celle de l'ouvrant sont
    // presque COPLANAIRES — c'est ainsi qu'une menuiserie est faite. Rien
    // ne les séparait donc à l'écran, et le cadre se lisait comme un seul
    // bloc blanc, même de très près (docs/18 §2.2). Ce qui les sépare
    // dans la réalité est un LISERÉ SOMBRE de quatre à six millimètres :
    // le joint, posé en creux dans sa rainure.
    //
    // On le pose sur le pourtour de l'ouvrant, LÉGÈREMENT EN RETRAIT en
    // profondeur : c'est ce retrait qui lui donne son ombre et qui fait
    // qu'on lit une rainure, pas une bande peinte.
    if (!contourOuvrant) {
      const jointMm = Math.min(6, Math.max(4, cotes.ouvrantLargeur * 0.1));
      const creux = 2.5;
      ajouterCadreMitre(
        atelier.poser(`${nom}-joint-frappe`, 'joint-frappe', 'joint', vantail),
        {
          xMm: cadre.x,
          yMm: cadre.y,
          largeurMm: cadre.largeur,
          hauteurMm: cadre.hauteur,
          zMm: zOuvrant + cotes.ouvrantProfondeur - creux,
        },
        profilPlat(jointMm, creux),
      );
      // Le SECOND joint — celui du dormant, côté extérieur. Une menuiserie
      // courante en a deux, qui délimitent la chambre de décompression, et
      // le second se voit de la rue exactement comme le premier se voit du
      // salon.
      ajouterCadreMitre(
        atelier.poser(`${nom}-joint-frappe-ext`, 'joint-frappe', 'joint', vantail),
        {
          xMm: cadre.x,
          yMm: cadre.y,
          largeurMm: cadre.largeur,
          hauteurMm: cadre.hauteur,
          zMm: zOuvrant - creux,
        },
        profilPlat(jointMm, creux),
      );
    }

    // Le jet d'eau : la lèvre qui rejette la pluie, en bas d'ouvrant.
    if (!coulissant && vantail !== undefined && !rect.fixe) {
      const maillage = atelier.poser(`${nom}-jet-eau`, 'jet-eau', 'ouvrant', vantail);
      extruder(
        maillage,
        profilJetDEau(cotes).map(([u, v]) => [cadre.y + u, v] as Point2),
        'x',
        { debut: cadre.x + 4, fin: cadre.x + cadre.largeur - 4 },
      );
    }
  }

  // ---- LE DÉCOR DU PANNEAU D'UNE PORTE — plates-bandes, moulures, inserts, judas,
  // heurtoir — se pose dans le volume des vitrées, au moment `decor` (lot D16f). ----
  complement3dDuGroupe(groupe, 'decor')?.(contexteComplement);

  // ---- La peau extérieure : bicoloration et RAL une face ----
  // Elle se vend +25 % et ne se voyait pas : la face extérieure gardait la
  // teinte intérieure. Un capot mince, posé devant chaque cadre, porte la
  // seconde couleur — c'est le plaxage du PVC, la coque de l'aluminium.
  //
  // La RAL UNE FACE relève du même geste, et manquait : le catalogue lui
  // donne bien deux teintes (blanc dedans, RAL dehors), mais seule la
  // bicoloration posait un capot. Une menuiserie « RAL une face » sortait
  // donc blanche vue de la rue — exactement ce que le client a payé pour
  // ne pas avoir.
  const peauExterieure = config.couleur === 'bicolore' || config.couleur === 'ral-1-face';
  //
  // ET IL SUIT LA FORME, comme tout le reste. Le premier jet posait le capot
  // sur la BOÎTE du cadre, quatre barres coupées d'onglet, quelle que soit
  // la menuiserie. Un œil-de-bœuf alu « RAL une face » sortait donc avec un
  // panneau rectangulaire sombre plaqué autour de son cercle — la forme
  // était juste partout ailleurs, et fausse sur la seule pièce que le
  // client regarde de la rue.
  if (peauExterieure && rectDormant && ouvrantsRects.length > 0) {
    const capot = atelier.poser('capot-exterieur', 'capot', 'cadre-exterieur');
    const contourDormant = contourParPiece.get(cle('dormant', undefined));
    if (contourDormant) {
      balayerContour(capot, contourMonde(contourDormant), profilCapot(cotes.dormantLargeur, 13), 0, offsetAligne);
    } else {
      const cadreDormant = monde(rectDormant);
      ajouterCadreMitre(
        capot,
        {
          xMm: cadreDormant.x,
          yMm: cadreDormant.y,
          largeurMm: cadreDormant.largeur,
          hauteurMm: cadreDormant.hauteur,
          zMm: 0,
        },
        profilCapot(cotes.dormantLargeur, 13),
      );
    }
    for (const rect of ouvrantsRects) {
      const maillageCapot = atelier.poser(
        `capot-${rect.vantail ?? 'imposte'}`,
        'capot',
        'cadre-exterieur',
        rect.vantail,
      );
      const contourVantail = contourParPiece.get(cle('ouvrant', rect.vantail));
      if (contourVantail) {
        balayerContour(
          maillageCapot,
          contourMonde(contourVantail),
          profilCapot(cotes.ouvrantLargeur, 12),
          zOuvrant,
          offsetAligne,
        );
        continue;
      }
      const cadre = monde(rect);
      ajouterCadreMitre(
        maillageCapot,
        { xMm: cadre.x, yMm: cadre.y, largeurMm: cadre.largeur, hauteurMm: cadre.hauteur, zMm: zOuvrant },
        profilCapot(cotes.ouvrantLargeur, 12),
      );
    }
  }

  // ---- La quincaillerie ----
  const sens = rectsEffectifs
    .filter((rect) => rect.role === 'ouvrant' && !rect.fixe && rect.vantail !== undefined)
    .map((rect) => rect.vantail!);

  for (const poignee of elevation.poignees) {
    const rect = ouvrantsRects.find((candidate) => candidate.vantail === poignee.vantail);
    if (!rect) continue;
    const cadre = monde(rect);
    const maillage = atelier.poser(`poignee-${poignee.vantail}`, 'poignee', 'quincaillerie', poignee.vantail);
    const xPoignee = poignee.cote === 'gauche'
      ? cadre.x + cotes.ouvrantLargeur / 2
      : cadre.x + cadre.largeur - cotes.ouvrantLargeur / 2;

    if (coulissant) {
      // Un coulissant se manœuvre à la barre de tirage, jamais au levier.
      ajouterBarreDeTirage(
        maillage,
        { xMm: xPoignee, yMm: cadre.y + cadre.hauteur / 2, zMm: zOuvrant + cotes.ouvrantProfondeur },
        cadre.hauteur,
      );
    } else {
      ajouterBequille(
        maillage,
        { xMm: xPoignee, yMm: cadre.y + cadre.hauteur * 0.42, zMm: zOuvrant + cotes.ouvrantProfondeur },
        poignee.cote === 'gauche' ? -1 : 1,
      );
    }
  }

  // Les paumelles, côté charnières, à la jonction dormant/ouvrant.
  if (!coulissant) {
    for (const vantail of sens) {
      const rect = ouvrantsRects.find((candidate) => candidate.vantail === vantail);
      const symboles = elevation.lines.filter(
        (ligne) => ligne.role === 'symbole' && ligne.vantail === vantail,
      );
      if (!rect || symboles.length === 0) continue;
      const cadre = monde(rect);
      const cote = cotePaumelles(symboles, cadre, centreXMm);
      const xGond = cote === 'gauche' ? cadre.x : cadre.x + cadre.largeur;
      const maillage = atelier.poser(`paumelles-${vantail}`, 'paumelle', 'quincaillerie', vantail);
      // LE NOMBRE VIENT DE L'ABAQUE, pas d'un seuil rond : deux fiches
      // jusqu'à 844 mm de hauteur en feuillure, trois jusqu'à 1 444,
      // quatre jusqu'à 2 044, cinq au-delà (compétence
      // `quincaillerie-et-ferrage` §1).
      const nombre =
        cadre.hauteur <= 844 ? 2 : cadre.hauteur <= 1444 ? 3 : cadre.hauteur <= 2044 ? 4 : 5;
      // LA FERRURE MODERNE EST CACHÉE — et c'était l'inverse à l'écran.
      //
      // Sur une menuiserie PVC ou aluminium, on ne voit RIEN de la ferrure
      // quand le vantail est fermé : elle vit dans la feuillure, entre le
      // dormant et l'ouvrant. C'est même un argument de vente. Le bois,
      // lui, montre ses paumelles vissées sur la face — et c'est aussi un
      // argument, l'autre. Les poser au même endroit pour les deux donnait
      // à une fenêtre PVC des charnières apparentes qu'elle n'a pas, et à
      // une fenêtre bois une ferrure invisible qu'elle n'a pas non plus
      // (docs/18 §2.1, §2.4, G7).
      //
      // La cote de profondeur fait tout : au quart de l'épaisseur de
      // l'ouvrant, la paumelle est prise dans le recouvrement et
      // disparaît ; aux trois quarts, elle est en applique sur la face
      // intérieure et se voit.
      const zPaumelle = jointDroit
        ? zOuvrant + cotes.ouvrantProfondeur * 0.78
        : zOuvrant + cotes.ouvrantProfondeur * 0.22;
      for (let index = 0; index < nombre; index++) {
        // Réparties, jamais collées aux angles : le bout d'un profilé ne
        // tient pas une vis.
        const part = 0.12 + (index * 0.76) / Math.max(1, nombre - 1);
        ajouterPaumelle(maillage, {
          xMm: xGond,
          yMm: cadre.y + cadre.hauteur * part,
          zMm: zPaumelle,
        });
      }
    }
  }

  // LE COMPAS d'un oscillo-battant. Il se pose sur les vantaux ÉQUIPÉS —
  // l'option se compte en vantaux, et le catalogue équipe le vantail de
  // service en premier, comme le fait le dessin.
  const obQuantiteVolume = config.options?.find((option) => option.id === 'oscillo-battant')?.quantite ?? 0;
  if (obQuantiteVolume > 0 && !coulissant) {
    for (const rect of ouvrantsRects) {
      const vantail = rect.vantail;
      if (vantail === undefined || rect.fixe) continue;
      if (vantail < mesure.vantaux - obQuantiteVolume) continue;
      const cadre = monde(rect);
      const symboles = elevation.lines.filter(
        (ligne) => ligne.role === 'symbole' && ligne.vantail === vantail,
      );
      if (symboles.length === 0) continue;
      const cote = cotePaumelles(symboles, cadre, centreXMm);
      // Le compas court le long de la traverse HAUTE, du dormant vers
      // l'ouvrant, côté paumelles : c'est là qu'il retient le vantail
      // quand il bascule.
      const xDormant = cote === 'gauche' ? cadre.x : cadre.x + cadre.largeur;
      const signe = cote === 'gauche' ? 1 : -1;
      const y = cadre.y + cadre.hauteur - cotes.ouvrantLargeur * 0.5;
      ajouterCompas(
        atelier.poser(`compas-${vantail}`, 'compas', 'quincaillerie', vantail),
        { xMm: xDormant, yMm: y, zMm: zOuvrant + cotes.ouvrantProfondeur * 0.22 },
        {
          xMm: xDormant + signe * Math.min(360, cadre.largeur * 0.42),
          yMm: y,
          zMm: zOuvrant + cotes.ouvrantProfondeur * 0.22,
        },
      );
    }
  }

  // Les galets d'un coulissant, dans la gorge du seuil.
  if (coulissant) {
    for (const vantail of sens) {
      const rect = ouvrantsRects.find((candidate) => candidate.vantail === vantail);
      if (!rect) continue;
      const cadre = monde(rect);
      const maillage = atelier.poser(`galets-${vantail}`, 'galet', 'quincaillerie', vantail);
      for (const part of [0.16, 0.84]) {
        ajouterGalet(maillage, {
          xMm: cadre.x + cadre.largeur * part,
          yMm: cadre.y - 4,
          zMm: zOuvrant + cotes.ouvrantProfondeur / 2,
        });
      }
    }
  }

  // ---- LES OPTIONS QUI SE VOIENT, LA SERRURE D'UNE PORTE, LA MANŒUVRE D'UN VOLET, LES
  // LAMES D'UN STORE ET LE STORE INTÉGRÉ ONT QUITTÉ CE FICHIER — lot D16e. Ils vivent
  // dans le volume de leur groupe, posés au moment `ferrures`, à la place exacte où
  // ils étaient ; `volume-des-options-epingle.test.ts` compare l'ordre des pièces. ----
  const cadreDormantMonde = rectDormant ? monde(rectDormant) : null;

  //
  // Leur volume — la poutre-chéneau, les poteaux, les lames orientables, le
  // élargie : un `ContexteVolume` porte désormais l'ÉLÉVATION et le repère
  // `monde()`, les deux lectures que le lot D15 avait nommées comme
  // l'obstacle.
  //
  // Ce fichier est un morceau PARTAGÉ : il arrive dès qu'un client ouvre
  // l'onglet 3D, quelle que soit sa famille. Un visiteur venu regarder une
  // bioclimatique.

  // LE STORE À LAMES — vénitien, californien, BSO — se pose dans le volume des
  // fermetures (lot D16e) ; le chemin générique n'a plus besoin que de savoir
  // qu'il en est un, pour ne pas y poser de tablier.
  const typeStore = config.famille === 'store-interieur' ? (config.typeStoreInterieur ?? 'venitien') : null;
  const storeALames = typeStore === 'venitien' || typeStore === 'californien' || config.famille === 'bso';

  // ---- Les ferrures d'un volet battant (lot D16c), les ouvrants, le moteur et le
  // posés par le groupe, à la place où ils vivaient. ----
  complement3dDuGroupe(groupe, 'ferrures')?.(contexteComplement);

  // ---- La grille de défense : le barreaudage, côté rue ----
  // Elle se scelle dans le tableau, DEVANT la menuiserie. Ses barreaux sont
  // des ronds d'acier — un barreau carré se dessine plus vite mais ne
  // ressemble à rien : c'est le rond qu'on voit sur toutes les façades.
  // dans un tableau : ils viennent d'être posés ci-dessus, dans le plan du
  // cadre. Les repasser ici les aurait doublés, en ronds d'acier, soixante-
  const lignesBarreaux = estPortail(config.famille)
    ? []
    : elevation.lines.filter((ligne) => ligne.role === 'barreau');
  if (lignesBarreaux.length > 0) {
    // UNE GRILLE DE DÉFENSE se pose DEVANT une fenêtre, en applique — d'où
    // le décalage de soixante-dix millimètres vers l'extérieur. Les
    // les reculer les faisait flotter cinquante millimètres derrière, et on
    // le voyait à la première capture.
    const gardeCorps = config.famille === 'garde-corps';
    const maillage = atelier.poser(
      gardeCorps ? 'barreaudage' : 'grille-defense',
      'barreau',
      gardeCorps ? 'cadre' : 'quincaillerie',
    );
    const zGrille = gardeCorps ? 0 : -70;
    const point = (xMm: number, yMm: number) =>
      auMonde({ xMm, yMm, widthMm: 0, heightMm: 0 }, centreXMm, hauteurDessin);
    for (const ligne of lignesBarreaux) {
      const vertical = Math.abs(ligne.x1Mm - ligne.x2Mm) < 0.5;
      if (Math.hypot(ligne.x2Mm - ligne.x1Mm, ligne.y2Mm - ligne.y1Mm) < 1) continue;
      const a = point(ligne.x1Mm, ligne.y1Mm);
      const b = point(ligne.x2Mm, ligne.y2Mm);
      // Un fer se pose le long de SA droite, quelle qu'en soit
      // l'inclinaison : les diagonales d'un treillis et les cordes d'une
      // volute sortaient en tirets épars quand on les forçait sur un axe.
      // Les traverses passent devant les barreaux, comme au fer forgé.
      const z = vertical ? zGrille : zGrille - 18;
      ajouterCylindreEntre(
        maillage,
        { xMm: a.x, yMm: a.y, zMm: z },
        { xMm: b.x, yMm: b.y, zMm: z },
        vertical ? 8 : 7,
        10,
      );
    }
  }

  // ---- Le store banne : la seule menuiserie qui PROJETTE ----
  // Le dessin de façade ne peut pas montrer l'avancée : c'est la troisième
  // dimension. Trois pavés plaqués au mur donnaient un panneau ; il faut le
  // coffre, la toile en pente, la barre de charge et les bras articulés.
  // LE STORE BANNE A QUITTÉ CE FICHIER — lot D16b. Son volume remplaçait
  // l'algorithme entier (ni dormant, ni ouvrant, ni vitrage : un coffre, une
  // toile en pente, une barre de charge, un lambrequin et deux bras), et il
  // descendait donc dans la base de la session chez tout visiteur venu
  // regarder une fenêtre en volume. Il vit dans
  // `familles/fermetures/volume.ts`, et le crochet du lot D16 le consulte
  // avant tout travail générique — c'est pourquoi rien ne reste ici.

  // ---- Le bloc-baie : ses coulisses et son tablier se posent dans le volume des
  // vitrées, au moment `apres-la-grille` (lot D16e). ----
  const blocBaie = elevation.rects.some((rect) => rect.role === 'coffre') && cadreDormantMonde !== null;
  complement3dDuGroupe(groupe, 'apres-la-grille')?.(contexteComplement);

  // ---- Les familles sans ouvrant : volets ----
  for (const rect of config.famille === 'store-banne' ? [] : elevation.rects) {
    // LE TABLIER D'UN VOLET BATTANT ET LA LAME FINALE se posent dans le volume des
    // fermetures, rectangle par rectangle, pour garder l'ordre des pièces (lot D16f).
    if (complement3dDuGroupe(groupe, 'par-rectangle')?.({ ...contexteComplement, rect })) continue;
    if (rect.role === 'coffre' || rect.role === 'coulisse' || rect.role === 'lambrequin') {
      const cadre = monde(rect);
      const profondeurRole = rect.role === 'coffre' ? profondeur * 2.4 : profondeur * 0.5;
      // Un coffre de bloc-baie se pose sur la façade EXTÉRIEURE ; celui d'un
      // volet roulant seul EST le produit et occupe toute la profondeur.
      const zCentre = blocBaie ? -profondeurRole / 2 + 10 : profondeurRole / 2;
      ajouterPave(
        atelier.poser(rect.role, rect.role, rect.role === 'lambrequin' ? 'toile' : 'cadre'),
        {
          xMm: cadre.x + cadre.largeur / 2,
          yMm: cadre.y + cadre.hauteur / 2,
          zMm: zCentre,
        },
        { xMm: cadre.largeur, yMm: cadre.hauteur, zMm: profondeurRole },
      );
    }
    if (rect.role === 'toile') {
      // PAS DE TOILE SOUS DES LAMES : le champ d'un vénitien EST fait de
      // lames, et le panneau plein qu'on posait derrière les cachait
      // toutes. C'est la même faute que le tablier de volet roulant collé
      if (storeALames) continue;
      const cadre = monde(rect);
      ajouterPave(
        atelier.poser('toile', 'toile', 'toile'),
        { xMm: cadre.x + cadre.largeur / 2, yMm: cadre.y + cadre.hauteur / 2, zMm: 4 },
        { xMm: cadre.largeur, yMm: cadre.hauteur, zMm: 8 },
      );
    }
    if (rect.role === 'tablier') {
      // été posé plus haut, lame par lame, depuis les traits de
      // l'élévation. Le repasser ici lui aurait collé un tablier de volet
      // roulant par-dessus.
      if (estPortail(config.famille)) continue;
      // rideau enroulable. Ses lames, ses barreaux et ses poteaux sont
      // posés plus haut, et lui coller des lames de volet par-dessus
      // de ce que NF P01-012 demande.
      if (estLineaire(catalog, config.famille)) continue;
      // NI une porte de garage : ses panneaux ont été posés plus haut, avec
      // leur cadre. Le repasser ici lui aurait collé un tablier de volet
      // roulant par-dessus — ce qu'elle était avant cette branche.
      // NI UN STORE À LAMES ORIENTABLES. Ses lames sont posées plus haut,
      // inclinées, au pas du modèle ; lui coller un tablier de volet roulant
      // par-dessus redonnait la plaque pleine qu'on vient de retirer — et
      // c'est littéralement ce qui se passait : le BSO sortait avec les
      // deux, 420 triangles de tablier au-dessus de ses lames.
      if (config.famille === 'porte-garage' || storeALames) continue;
      // Le tablier d'un volet est fait de LAMES, et chaque lame a son
      // profil : c'est le chanfrein qui creuse la ligne d'ombre, pas le jeu.
      const cadre = monde(rect);
      const maillage = atelier.poser('tablier', 'lame', 'cadre', rect.vantail);
      const lameMm = PAS_LAME_VOLET_VUE_MM;
      const nombre = Math.max(1, Math.round(cadre.hauteur / lameMm));
      const hauteurLame = cadre.hauteur / nombre;
      for (let index = 0; index < nombre; index++) {
        const yLame = cadre.y + hauteurLame * index;
        const section = profilLameVoletRoulant(hauteurLame, profondeur * 0.3).map(
          ([u, v]) => [yLame + u, v] as Point2,
        );
        extruder(maillage, section, 'x', {
          debut: cadre.x,
          fin: cadre.x + cadre.largeur,
        });
      }
    }

    // --- Les barres du volet plein, sur la face intérieure ---
    if (rect.role === 'barre') {
      const cadre = monde(rect);
      const section = profilBarreVolet(cadre.hauteur, 26).map(
        ([u, v]) => [cadre.y + u, profondeur * 0.34 + v] as Point2,
      );
      extruder(atelier.poser('barre', 'barre', 'cadre', rect.vantail), section, 'x', {
        debut: cadre.x,
        fin: cadre.x + cadre.largeur,
      });
    }
  }

  // ---- Les axes d'ouverture ----
  const ouvrants: Ouvrant[] = [...ouvrantsPortail];
  for (const rect of rectsEffectifs.filter(
    (candidate) => candidate.role === 'ouvrant' && !candidate.fixe && candidate.vantail !== undefined,
  )) {
    const vantail = rect.vantail!;
    const symboles = elevation.lines.filter(
      (ligne) => ligne.role === 'symbole' && ligne.vantail === vantail,
    );
    // LE SYMBOLE COMMANDE — sauf pour une fenêtre de toit, qui n'en a pas.
    //
    // Le V de frappe est ce qui dit, partout ailleurs, qu'un vantail
    // s'ouvre et de quel côté. Une fenêtre de toit n'en porte aucun : elle
    // pivote sur un axe horizontal médian, et son dessin porte cet AXE à la
    // place. Sans cette exception, elle est sortie fixe — un châssis mort
    // dans un toit, alors que tout son intérêt est de s'ouvrir.
    const surLeToit = config.famille === 'fenetre-toit';
    if (symboles.length === 0 && !surLeToit) continue;
    const cadre = monde(rect);
    const ouverture = config.ouverture ?? fam.ouvertures?.[0];

    if (ouverture === 'coulissant' || ouverture === 'galandage' || ouverture === 'levage') {
      // Le galandage refoule vers l'extérieur, et sur TOUTE la largeur du
      // vantail : il disparaît dans son caisson. Le coulissant, lui, se
      // range devant son voisin et garde son recouvrement.
      const versLeCentre = vantail < mesure.vantaux / 2 ? 1 : -1;
      ouvrants.push({
        vantail,
        mode: 'coulissant',
        pivotMm: { xMm: cadre.x, yMm: cadre.y, zMm: zOuvrant },
        sens: ouverture === 'galandage' ? (-versLeCentre as 1 | -1) : versLeCentre,
        // LA COURSE D'UN COULISSANT n'est pas un pourcentage : le vantail
        // s'efface de sa largeur MOINS la chicane, parce que les deux
        // montants centraux s'emboîtent et que celui de rive vient buter
        // contre le dormant. Un galandage, lui, disparaît en entier dans
        // son caisson (compétence `cinematique-des-ouvrants` §3).
        courseMm:
          ouverture === 'galandage'
            ? cadre.largeur
            : Math.max(0, cadre.largeur - (ded?.battementMm ?? cadre.largeur * 0.08)),
      });
      continue;
    }
    if (ouverture === 'soufflet') {
      ouvrants.push({
        vantail,
        mode: 'soufflet',
        pivotMm: { xMm: cadre.x + cadre.largeur / 2, yMm: cadre.y, zMm: zOuvrant },
        axe: 'x',
        sens: 1,
        angleMaxDeg: 10,
      });
      continue;
    }
    // UNE FENÊTRE DE TOIT PIVOTE SUR UN AXE HORIZONTAL MÉDIAN : le haut
    // rentre pendant que le bas sort. C'est ce qui permet de la manœuvrer
    // sans se pencher dehors — et de la retourner pour la nettoyer, qui est
    // l'argument de vente du produit. En frappe, elle s'ouvrait sur un
    // montant comme une fenêtre de salon, ce qu'aucune n'a jamais fait.
    if (surLeToit) {
      ouvrants.push({
        vantail,
        mode: 'soufflet',
        pivotMm: {
          xMm: cadre.x + cadre.largeur / 2,
          yMm: cadre.y + cadre.hauteur / 2,
          zMm: zOuvrant,
        },
        axe: 'x',
        sens: 1,
        angleMaxDeg: ROTATION_COURANTE_DEG,
      });
      continue;
    }
    const cote = cotePaumelles(symboles, cadre, centreXMm);
    ouvrants.push({
      vantail,
      mode: 'frappe',
      pivotMm: {
        xMm: cote === 'gauche' ? cadre.x : cadre.x + cadre.largeur,
        yMm: cadre.y + cadre.hauteur / 2,
        zMm: zOuvrant,
      },
      axe: 'y',
      sens: cote === 'gauche' ? 1 : -1,
      angleMaxDeg: 95,
    });
  }

  // Les faces plates sont émises en quads : deux triangles qui partagent
  // deux sommets. Les fusionner retire un tiers des sommets, donc un tiers
  // du poids des fichiers de réalité augmentée, sans toucher au dessin.
  const pieces = atelier.pieces.map((piece) => ({ ...piece, maillage: deduplique(piece.maillage) }));
  const triangles = pieces.reduce((somme, piece) => somme + compterTriangles(piece.maillage), 0);
  return {
    pieces,
    ouvrants,
    // LE HORS-TOUT, et sa TROISIÈME dimension : sur ce chemin-ci elle vaut
    // l'épaisseur du profilé — c'est ce qu'une fenêtre avance dans le mur.
    //
    // drapeau posé ici ; leur volume vit désormais dans son groupe, et les
    // COURTS-CIRCUITS mesurent leur hors-tout sur le MAILLAGE — ce qui rend
    // le même nombre sans nommer de famille. C'est cette boîte que la scène
    // comme une plaque, et le client ne voyait pas la cote qu'il paie.
    horsToutMm: {
      xMm: largeurDessin,
      yMm: hauteurDessin,
      zMm: profondeur,
    },
    hauteurAuxBordsMm: (() => {
      // On lit la hauteur SUR LES BORDS du dessin, là où le pilier se
      // tient. Sans contour — donc sur une forme droite — l'ouvrage y monte
      // à sa hauteur hors-tout, et il n'y a rien à chercher.
      let sommet = 0;
      for (const contour of elevation.contours) {
        for (const [x, y] of contour.points) {
          if (Math.abs(x - gaucheDessin) > 0.5 && Math.abs(x - droiteDessin) > 0.5) continue;
          sommet = Math.max(sommet, hauteurDessin - y);
        }
      }
      return sommet > 0 ? sommet : hauteurDessin;
    })(),
    contourDormantMm: (() => {
      const contour = contourParPiece.get(cle('dormant', undefined));
      if (!contour) return undefined;
      // Le décor raisonne en (x centré, y depuis le seuil) comme la scène.
      return contour.map(([x, y]) => [x - centreXMm, hauteurDessin - y] as [number, number]);
    })(),
    epaisseurProfilMm: profondeur,
    cotes,
    triangles,
  };
}

/** Les bornes du volume — utile aux tests et au cadrage de la scène. */
export function encombrement(geometrie: Geometry3D): { min: Point3; max: Point3 } | null {
  const tout = maillageVide();
  for (const piece of geometrie.pieces) {
    tout.positions.push(...piece.maillage.positions);
  }
  return boiteEnglobante(tout);
}
