/**
 * Pourquoi ce fichier existe : l'élévation de face, CALCULÉE — dormant,
 * ouvrants, clairs de vitrage, petits-bois, symboles d'ouverture normalisés,
 * poignées, cotes. Une seule source de dessin alimente trois sorties : le
 * SVG du widget, le schéma du devis PDF et l'élévation du DXF (docs/03 §2).
 * « Ce que le client a vu est ce que l'atelier lit » (docs/08, règle 7).
 *
 * Solution écartée : dessiner dans le widget à partir des champs de la
 * configuration. Le dessin aurait alors sa propre idée des cotes, et
 * divergerait du prix comme du manifeste — la règle des néons est absolue :
 * les cotes viennent du rapport de mesure, le dessin n'en est qu'une vue.
 * Les cellules de vantail sont donc construites pour que le clair dessiné
 * soit, au millimètre, celui que `computeMeasureReport()` a pesé.
 *
 * Incident fondateur : le sens d'ouverture. Tout le métier le note **vue
 * intérieure**, la pointe du V désignant le côté des paumelles ; un dessin
 * qui inverse la convention fait fabriquer une fenêtre à l'envers. La
 * convention est ici encodée une fois, testée, et jamais réinterprétée en
 * aval (voir la compétence `metier-menuiserie`).
 */

import type { Couleur, JoineryConfiguration, Materiau, Ouverture } from './types.ts';
import {
  DEFAULT_CATALOG,
  deductionsDe,
  estPortail,
  familleCatalog,
  masseVueMm,
  modelePorteDe,
  posePourFamille,
  type DecorPorte,
  type PricingCatalog,
} from './catalog.ts';
import {
  boiteContour,
  couperSegment,
  intersecterBoite,
  offsetContour,
} from './geometrie/formes.ts';
import { effectiveVitrage } from './structural.ts';
import { resoudreTeintes } from './teintes.ts';
import { moduleDe, refusFamilleNonChargee } from './familles/registre.ts';

/** Une surface pleine de l'élévation, en millimètres, origine en haut à gauche. */
export interface ElevationRect {
  /**
   * LA TEINTE DE CETTE SURFACE, en hexadécimal d'affichage — lot O9b.
   *
   * Elle est ABSENTE par défaut, et c'est la feuille de style qui décide :
   * `.ahjc-toile` prend `--ahjc-couleur-toile`, `.ahjc-dormant` prend la teinte
   * du cadre. Ce champ existe pour les surfaces dont la couleur est un CHOIX
   * DU CLIENT que la feuille ne peut pas connaître — la toile d'un store, qui
   * fait 79 à 85 % de l'image (lot D17).
   *
   * POURQUOI SUR LE RECT ET NON SUR `couleurs` : le module de famille est le
   * seul à savoir quelle toile a été choisie, et il ne peut pas écrire dans
   * `couleurs`, que `computeElevation` construit. Le porter ici coûte au
   * chargement initial le seul aiguillage de l'exportateur — la TABLE des
   * teintes, elle, reste dans le morceau paresseux de la famille.
   */
  teinte?: string;
  role:
    | 'recouvrement'
    | 'dormant'
    | 'ouvrant'
    /** Un panneau en creux d'une porte — le décor du modèle. */
    | 'panneau'
    /** Une moulure en relief autour d'un panneau. */
    | 'moulure'
    /** Un insert d'inox, ou tout accessoire plat en applique. */
    | 'insert'
    | 'clair'
    | 'coffre'
    | 'tablier'
    | 'coulisse'
    | 'toile'
    | 'lambrequin'
    /** Une barre de volet plein — la traverse qui tient les planches. */
    | 'barre'
    /** La lame finale d'un volet roulant — celle qui porte les butées. */
    | 'lame-finale'
    /** Un poteau, vu de dessus sur le plan de masse. */
    | 'poteau'
    /** LA COUVERTURE, sur un plan de façade — la pièce DP4 le nomme aussi. */
    | 'toiture'
    | 'module-pv'
    /** La MAÇONNERIE, en coupe — jambage, linteau, appui du guide de cotes. */
    | 'maconnerie'
    /** Le DOUBLAGE isolant intérieur, en coupe — pose en applique. */
    | 'doublage'
    /** Une menuiserie DÉPOSÉE ou conservée — l'ancien dormant, en rénovation. */
    | 'existant'
    | 'virole'
    /**
     * LA PORTE D'HOMME. Elle est dessinée EN CREUX sur la virole, et elle est
     * DEBOUT : sur un cylindre la hauteur est gratuite et la circonférence est
     * comptée, si bien que l'orientation décide si la porte se fabrique
     * (lot C3a — le rapport de percement passe de 0,390 à 0,537 en la
     * couchant).
     */
    | 'trou-d-homme';
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  /** Index du vantail (0 = le plus à gauche) — absent sur le dormant. */
  vantail?: number;
  /** Vrai pour un remplissage fixe (imposte, semi-fixe, panneau de porte). */
  fixe?: boolean;
}

/** Un trait de l'élévation — symboles, petits-bois, lames, attaches de cote. */
export interface ElevationLine {
  role:
    | 'symbole'
    | 'petit-bois'
    | 'lame'
    | 'ligne-de-coupe'
    | 'barreau'
    | 'rainure'
    /** L'écharpe d'un volet plein — la diagonale qui l'empêche de tomber du nez. */
    | 'echarpe'
    /** Une lame de store vénitien intégré, ou une strie de sérigraphie. */
    | 'store-integre'
    /** La tringle d'espagnolette d'un volet battant. */
    | 'espagnolette'
    | 'troncon'
    /**
     * LE TERRAIN NATUREL, sur un plan de façade. Ce n'est pas un décor :
     * les deux cotes qu'un instructeur d'urbanisme lit en premier — la
     * hauteur à l'égout et celle au faîtage — se mesurent depuis lui.
     */
    | 'terrain'
    /**
     * LE PROFIL D'UN SOLIDE DE RÉVOLUTION (lot C11b) — la silhouette d'un
     * fond conique ou bombé, vue de côté.
     *
     * C'est le seul trait de ce dépôt qui ne soit ni un symbole ni un décor :
     * il est le CONTOUR DE L'OUVRAGE, et il porte donc l'épaisseur de trait
     * d'un dormant. Il vient point par point du profil que le volume et le
     * calcul de contenance lisent aussi (lot Z3) : trois lectures d'une même
     * fonction, jamais trois tracés.
     */
    | 'profil';
  x1Mm: number;
  y1Mm: number;
  x2Mm: number;
  y2Mm: number;
  vantail?: number;
}

/** Une cote portée sur le dessin — la ligne, ses attaches et son libellé. */
export interface ElevationCote {
  code: string;
  label: string;
  /**
   * La valeur mesurée, en millimètres — la SOURCE du libellé, pas sa copie.
   * Le cœur cote en millimètres et ne connaît que ça ; c'est l'exportateur
   * SVG qui réécrit la cote en pouces quand le marchand vend au pouce
   * (docs/11, décision 0.1). Sans ce champ, il aurait fallu redécouper une
   * chaîne déjà formatée pour en retrouver le nombre.
   */
  valeurMm: number;
  /** Ce qui précède la valeur — « coffre », « avancée ». Vide le plus souvent. */
  prefixe?: string;
  orientation: 'horizontale' | 'verticale';
  x1Mm: number;
  y1Mm: number;
  x2Mm: number;
  y2Mm: number;
  textXMm: number;
  textYMm: number;
}

/** Une poignée posée sur un ouvrant — cercle plein + tige. */
export interface ElevationPoignee {
  xMm: number;
  yMm: number;
  cote: 'gauche' | 'droite';
  vantail: number;
}

/**
 * Une pièce à contour LIBRE — le dormant, l'ouvrant ou le clair d'une
 * menuiserie qui n'est pas rectangulaire. Le dessin rectangulaire reste
 * calculé comme avant ; les contours en sont l'intersection avec la forme,
 * chacun décalé de sa propre bande de profilé.
 */
export interface ElevationContour {
  role: 'dormant' | 'ouvrant' | 'clair' | 'toiture';
  points: Array<[number, number]>;
  vantail?: number;
  fixe?: boolean;
}

/**
 * Un accessoire rond posé sur un ouvrant — judas, heurtoir. Le rectangle
 * ne convient pas : un judas carré n'existe pas, et le dessiner ainsi
 * ferait douter de tout le reste du plan.
 */
export interface ElevationDisque {
  role: 'judas' | 'heurtoir';
  xMm: number;
  yMm: number;
  rayonMm: number;
  vantail: number;
}

export interface Elevation {
  famille: JoineryConfiguration['famille'];
  widthMm: number;
  heightMm: number;
  /** Le cadre de rendu, marges de cotation comprises (unités : mm). */
  viewBox: { xMm: number; yMm: number; widthMm: number; heightMm: number };
  rects: ElevationRect[];
  /**
   * Les pièces à contour libre. Vide sur une menuiserie rectangulaire —
   * c'est ce qui rend les formes ADDITIVES : un dessin sans forme est
   * exactement celui d'avant, au trait près.
   */
  contours: ElevationContour[];
  lines: ElevationLine[];
  cotes: ElevationCote[];
  poignees: ElevationPoignee[];
  /** Judas et heurtoir — vides partout ailleurs que sur une porte. */
  disques: ElevationDisque[];
  /** Teintes indicatives — les packs les surchargent par CSS (docs/03 §8). */
  couleurs: { cadreInterieur: string; cadreExterieur: string; vitrage: string };
}

/**
 * Le sens d'ouverture d'un vantail, **vue intérieure** :
 * — `gauche` / `droite` : côté des paumelles (la pointe du V) ;
 * — `bas` : soufflet (bascule sur l'axe bas) ;
 * — `coulisse-gauche` / `coulisse-droite` : sens de refoulement ;
 * — `null` : dormant fixe, aucun symbole.
 */
export type SensVantail = 'gauche' | 'droite' | 'bas' | 'coulisse-gauche' | 'coulisse-droite' | null;

/**
 * Quel vantail s'ouvre comment. Les vantaux extérieurs prennent leurs
 * paumelles du côté extérieur (le battement se retrouve au centre) ; un
 * monovantail suit le sens déclaré, à défaut tirant droit.
 */
export function sensDesVantaux(
  config: JoineryConfiguration,
  vantaux: number,
  forcee?: Ouverture,
): SensVantail[] {
  // `forcee` EST LA COUTURE DES OUVERTURES DÉCLARÉES (lot MT4a), et elle
  // tient en un paramètre. Le chargement initial n'apprend AUCUN mot
  // nouveau : c'est le module de famille — paresseux, donc gratuit ici — qui
  // lit la cinématique déclarée au catalogue et la ramène à l'une des six
  // ouvertures que ces branches connaissent déjà. Mesuré : nommer les cinq
  // ouvertures ici coûtait 84 octets d'entrée pour une marge de six, et
  // résoudre la cinématique ici en coûtait encore 45. Un paramètre en coûte
  // quelques-uns, et il rend la PROCHAINE ouverture gratuite.
  const ouverture =
    forcee ?? config.ouverture ?? DEFAULT_CATALOG.familles[config.famille]?.ouvertures?.[0];
  if (ouverture === 'fixe') return Array.from({ length: vantaux }, () => null);
  if (ouverture === 'soufflet') return Array.from({ length: vantaux }, () => 'bas' as const);
  if (ouverture === 'coulissant' || ouverture === 'levage') {
    // Un coulissant classique refoule vers le centre : les vantaux se
    // croisent devant le battement.
    //
    // LE LEVAGE GLISSE PAREIL (lot MT1a), et ne pas le nommer ici ne levait
    // AUCUNE erreur : il tombait dans la branche de la frappe et se dessinait
    // avec des V de battant et des poignées de fenêtre. Une ouverture
    // nouvelle qu'aucune branche ne nomme ne casse rien — elle DESSINE FAUX,
    // ce qui est la faute la plus difficile à voir. `dessin.test.ts` refuse
    // désormais toute ouverture qui n'est nommée dans aucune branche.
    return Array.from({ length: vantaux }, (_, i) =>
      i < vantaux / 2 ? ('coulisse-droite' as const) : ('coulisse-gauche' as const),
    );
  }
  if (ouverture === 'galandage') {
    // Un galandage refoule vers l'EXTÉRIEUR : chaque vantail disparaît dans
    // son caisson, dans le mur. Le faire glisser vers le centre, comme un
    // coulissant ordinaire, revenait à nier ce qu'on facture 45 % plus cher.
    return Array.from({ length: vantaux }, (_, i) =>
      i < vantaux / 2 ? ('coulisse-gauche' as const) : ('coulisse-droite' as const),
    );
  }
  if (vantaux === 1) return [config.sens ?? 'droite'];
  return Array.from({ length: vantaux }, (_, i) =>
    i < vantaux / 2 ? ('gauche' as const) : ('droite' as const),
  );
}

/**
 * Le côté des GONDS d'un battant de volet, vue intérieure. C'est la
 * jumelle de `sensDesVantaux()` : la même question — de quel côté pivote
 * cet ouvrant ? — posée sur l'autre produit.
 *
 * Une paire de volets s'ouvre en grand : chaque battant pivote sur le bord
 * EXTÉRIEUR de la baie, jamais au milieu. Sur un battant seul, c'est le
 * sens déclaré qui décide.
 *
 * Elle vit ICI, dans le cœur commun, et non dans le module des fermetures
 * où elle est née : le VOLUME en a besoin autant que le DESSIN, et
 * `geometry3d.ts` qui l'importait du module de famille faisait entrer les
 * fermetures dans le chemin de chargement d'une fenêtre. Le parcours qui
 * surveille le réseau l'a dit au premier essai. Une règle partagée par deux
 * modules paresseux appartient à ce qui les précède — pas à l'un des deux.
 */
export function coteGondsVolet(
  config: JoineryConfiguration,
  index: number,
  vantaux: number,
): 'gauche' | 'droite' {
  if (vantaux <= 1) return config.sens ?? 'gauche';
  return index === 0 ? 'gauche' : 'droite';
}

/**
 * La teinte du verre. Plus l'aspect est opaque, plus elle est laiteuse :
 * un dépoli laisse passer la lumière et pas le regard, un sablé encore
 * moins. Le triple garde sa nuance légèrement plus verte — trois faces de
 * verre, ça se voit en rive comme au travers.
 */
function teinteVitrage(vitrage: { base: string; aspect?: string } | null | undefined): string {
  switch (vitrage?.aspect) {
    case 'depoli':
      return '#e6eeef';
    case 'sable':
      return '#edf1f1';
    case 'serigraphie':
      return '#dfebed';
    default:
      return vitrage?.base === 'triple' ? '#cfe0e6' : '#d9e8ec';
  }
}

// LA TABLE DE TEINTES A DISPARU D'ICI, et c'était une correction : elle
// donnait UN gris pour « RAL une face », le même pour tout le monde, alors
// que quarante-cinq pour cent des poses sont colorées et qu'un client qui
// paie un supplément RAL veut choisir LEQUEL.
//
// Elle vit maintenant dans `teintes.ts`, avec le nuancier réellement vendu,
// les décors plaxés et ce qu'une teinte foncée fait à un profilé PVC. Le
// dessin, la 3D et le devis y lisent tous : une seconde table ferait
// diverger l'élévation du volume, et le client verrait deux gris
// différents sur le même écran.

/**
 * Épaisseur du dormant au dessin — la moitié de la bande de profil.
 * Exportée depuis le lot 0.2 : le trait des vitrées vit désormais dans son
 * module de famille, et il a besoin de la même règle que la passe de forme.
 * Une seconde copie aurait fait diverger le dormant d'un plein cintre de
 * celui d'un rectangle, sur la moitié d'un millimètre.
 */
export function dormantMm(bandeMm: number): number {
  return Math.round(bandeMm / 2);
}



/**
 * La passe de FORME. Le dessin rectangulaire est calculé d'abord, tel
 * qu'il l'a toujours été — dormant, imposte, vantaux, clairs, symboles,
 * options, bloc-baie. Ensuite seulement, chaque pièce est intersectée avec
 * le contour de la forme, décalé de la bande qui lui revient : rien pour
 * le dormant, la bande de dormant pour un ouvrant, la bande de profil
 * complète pour un clair.
 *
 * Solution écartée : réécrire tout `elevationVitree()` en géométrie libre.
 * Deux chemins auraient coexisté — un pour le rectangle, un pour le reste —
 * et le premier bug de l'un n'aurait pas été celui de l'autre. Ici il n'y a
 * qu'un seul dessin, et la forme le taille.
 *
 * Les traits — symboles d'ouverture, petits-bois, barreaux — sont coupés au
 * contour du clair de leur vantail. Sans cela, les petits-bois d'un plein
 * cintre sortaient par le haut de l'arc et se dessinaient sur le dormant.
 */
function appliquerForme(
  config: JoineryConfiguration,
  tracer: NonNullable<import('./familles/registre.ts').ModuleFamille['contourDeForme']>,
  bandeMm: number,
  dormantVuMm: number,
  rects: ElevationRect[],
  lines: ElevationLine[],
  contours: ElevationContour[],
  decalageYMm: number,
): void {
  const forme = config.forme ?? 'rectangle';
  if (forme === 'rectangle') return;

  const base = tracer(
    forme,
    config.widthMm,
    config.heightMm,
    config.flecheMm,
    config.formeCoteBas ?? 'gauche',
  ).map(([x, y]) => [x, y + decalageYMm] as [number, number]);

  const dormant = dormantVuMm;
  // la même question — de combien la garniture rentre-t-elle dans son
  // panneau rectangulaire, qui dépassait de l'arc par les épaules.
  const decalageDuRole: Record<string, number> = {
    dormant: 0,
    // est le contour lui-même. L'inscrire en retrait, comme un ouvrant de
    // fenêtre dans son dormant, lui volait trente millimètres sur chaque
    // côté — un chapeau de gendarme de 1 600 mm sortait à 1 540, et le
    ouvrant: estPortail(config.famille) ? 0 : dormant,
    clair: bandeMm,
    tablier: bandeMm,
  };
  const globaux = new Map<string, Array<[number, number]>>();
  for (const [role, decalage] of Object.entries(decalageDuRole)) {
    globaux.set(role, decalage === 0 ? base : offsetContour(base, decalage));
  }

  // Les clairs, gardés pour couper les traits qui les traversent.
  const clairsParVantail = new Map<number | 'fixe', Array<[number, number]>>();

  for (let index = rects.length - 1; index >= 0; index--) {
    const rect = rects[index];
    const global = globaux.get(rect.role);
    if (!global || global.length < 3) {
      // La bande mange la forme : la pièce n'existe pas. On la retire
      // plutôt que de tracer un polygone retourné.
      if (globaux.has(rect.role)) rects.splice(index, 1);
      continue;
    }
    const taille = intersecterBoite(global, rect);
    rects.splice(index, 1);
    if (taille.length < 3) continue;
    const contour: ElevationContour = {
      role: rect.role as ElevationContour['role'],
      points: taille,
      vantail: rect.vantail,
      fixe: rect.fixe,
    };
    contours.unshift(contour);
    if (rect.role === 'clair' || rect.role === 'tablier') {
      clairsParVantail.set(rect.vantail ?? 'fixe', taille);
    }
  }

  for (let index = lines.length - 1; index >= 0; index--) {
    const ligne = lines[index];
    const clair = clairsParVantail.get(ligne.vantail ?? 'fixe') ?? clairsParVantail.get('fixe');
    // Un barreau de grille se scelle dans le TABLEAU : il suit la forme du
    // dormant, pas celle d'un clair de vantail.
    const contour = ligne.role === 'barreau' ? globaux.get('dormant') : clair;
    if (!contour || contour.length < 3) continue;
    const coupe = couperSegment(
      contour,
      [ligne.x1Mm, ligne.y1Mm],
      [ligne.x2Mm, ligne.y2Mm],
    );
    if (!coupe) {
      lines.splice(index, 1);
      continue;
    }
    lines[index] = {
      ...ligne,
      x1Mm: coupe[0][0],
      y1Mm: coupe[0][1],
      x2Mm: coupe[1][0],
      y2Mm: coupe[1][1],
    };
  }
}

/**
 * L'élévation complète d'une configuration — une branche par nature de
 * produit, convergence sur les cotes et le cadre de rendu.
 */
export function computeElevation(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): Elevation {
  const fam = familleCatalog(catalog, config.famille);
  // LA CHAÎNE DE COTES (lot 0). La masse vue vient de la même fonction que
  // le rapport de mesure — c'est ce qui garantit que le dessin montre
  // exactement le clair qui a été pesé, et le test le vérifie.
  const pose = posePourFamille(catalog, config.famille, config.pose);
  const bandeMm = masseVueMm(catalog, config.famille, config.materiau, pose);
  const ded = deductionsDe(catalog, config.famille, config.materiau);
  // Sur une famille à cadre plein, le partage dormant/ouvrant n'a pas de
  // sens : on garde la moitié de la bande, comme avant le lot 0.
  const dormantVuMm = ded
    ? Math.max(0, ded.dormantVuMm - (pose.recouvrementMm > 0 ? ded.renovationEcartMm : 0))
    : dormantMm(bandeMm);
  const battementMm = ded ? ded.battementMm : 0;
  const rects: ElevationRect[] = [];
  const lines: ElevationLine[] = [];
  const poignees: ElevationPoignee[] = [];
  const disques: ElevationDisque[] = [];

  // Le trait vient du MODULE de la famille (docs/11, décision 0.2). Le
  // cœur garde ce qui ne dépend pas d'elle : la passe de forme, les cotes,
  // le cadre de rendu, les teintes. Sans module chargé, on refuse en disant
  // quel appel manque — jamais un dessin vide qui ressemblerait à un bogue.
  const module = moduleDe(config.famille);
  if (!module) throw refusFamilleNonChargee(config.famille);
  module.dessin({ config, catalog, bandeMm, dormantVuMm, battementMm, rects, lines, poignees, disques });

  // La hauteur dessinée peut différer de la hauteur saisie (store : l'avancée
  // se cote à part) — le cadre de rendu suit le dessin, les cotes la saisie.
  // La forme, appliquée au dessin rectangulaire déjà complet. Le décalage
  // en y est celui du coffre : un bloc-baie pose son caisson AU-DESSUS de
  // la menuiserie, et la forme ne concerne que la menuiserie.
  const contours: ElevationContour[] = [];
  const coffreMm = rects.find((rect) => rect.role === 'coffre')?.heightMm ?? 0;
  // LE TRACÉ D'UNE FORME vient du MODULE de la famille (lot 1) : les onze
  // formes pesaient deux kilo-octets et demi dans le chargement initial,
  // que toute menuiserie rectangulaire payait sans les lire. Un module qui
  // ne vend pas de formes n'en apporte pas, et sa configuration est
  // nécessairement droite.
  if (module.contourDeForme) {
    appliquerForme(config, module.contourDeForme, bandeMm, dormantVuMm, rects, lines, contours, coffreMm);
  }

  // L'enveloppe du dessin ignore l'aile de recouvrement : elle lape sur
  // l'existant, elle n'agrandit pas la menuiserie commandée. Sans cette
  // exclusion, le volume 3D se décentrait de la moitié de l'aile et la cote
  const corps = rects.filter((rect) => rect.role !== 'recouvrement');
  // Sur une menuiserie de forme, le dormant a quitté `rects` pour
  // `contours` : l'enveloppe doit lire les deux, sans quoi le cadre de
  // rendu se calait sur le seul coffre restant et le dessin sortait vide.
  let dessinH = corps.reduce((max, rect) => Math.max(max, rect.yMm + rect.heightMm), 0);
  let dessinW = corps.reduce((max, rect) => Math.max(max, rect.xMm + rect.widthMm), 0);
  for (const contour of contours) {
    for (const [x, y] of contour.points) {
      dessinW = Math.max(dessinW, x);
      dessinH = Math.max(dessinH, y);
    }
  }
  // ET LES TRAITS, depuis le lot C11b — parce qu'ils peuvent être le CONTOUR.
  //
  // Les deux lignes ci-dessus portaient déjà leur propre commentaire : « sans
  // cette lecture le cadre se calait sur le seul coffre restant et le dessin
  // sortait vide ». La correction avait alors énuméré les DEUX sources qu'on
  // connaissait — rectangles et contours — et laissé les traits dehors. C'était
  // vrai des trente-neuf familles de menuiserie : leurs traits sont des
  // SYMBOLES (diagonale d'ouverture), des petits-bois, des lames, des
  // espagnolettes — tous DEDANS.
  //
  // conique et la calotte bombée sont des polylignes, et la virole est le seul
  // rectangle. Le cadre se calait donc sur la virole, et **le cône sortait du
  // dessin** — vu à l'écran, pas dans une assertion. C'est la faute du lot MT5,
  // à nouveau : un garde-fou qui ne regarde que ce dont on s'était méfié.
  //
  // SEUL LE RÔLE `profil` AGRANDIT L'ENVELOPPE, et c'est un critère et non une
  // exception. Un trait de rôle `profil` EST le contour de l'ouvrage ; tous les
  // autres montrent quelque chose SUR l'ouvrage (petit-bois, lame, symbole,
  // espagnolette) ou AUTOUR de lui (tronçon, terrain, ligne de coupe).
  //
  // coulissant descend à 1 690 mm quand ses rectangles s'arrêtent à 1 600. Le
  // prendre dans l'enveloppe aurait déplacé de quatre-vingt-dix millimètres la
  // cote de largeur d'un dessin LIVRÉ — un changement que ce lot n'a pas
  // demandé, sur une famille qu'il ne touche pas. Le rail reste donc où il est,
  // dans la marge, et c'est ce qu'il a toujours fait.
  //
  // Ce n'est QUE le maximum : l'origine du cadre reste `-marge`, et un trait
  // posé en x négatif (le refoulement d'un galandage) garde le comportement
  // qu'il avait. Une épreuve mesure que les trente-neuf autres familles ne
  // bougent pas d'un millimètre.
  for (const ligne of lines) {
    if (ligne.role !== 'profil') continue;
    dessinW = Math.max(dessinW, ligne.x1Mm, ligne.x2Mm);
    dessinH = Math.max(dessinH, ligne.y1Mm, ligne.y2Mm);
  }
  const marge = Math.max(160, Math.round(Math.max(dessinW, dessinH) * 0.09));

  // La cote de hauteur mesure la MENUISERIE, pas ce qu'on lui ajoute : un
  // coffre de volet posé au-dessus ne fait pas grandir la fenêtre commandée.
  // La cote de hauteur mesure le DORMANT — qu'il soit rectangle ou contour.
  const contourDormant = contours.find((contour) => contour.role === 'dormant');
  const rectDormant = rects.find((rect) => rect.role === 'dormant');
  const boiteDormant = contourDormant
    ? boiteContour(contourDormant.points)
    : rectDormant
      ? { yMm: rectDormant.yMm, heightMm: rectDormant.heightMm }
      : null;
  // LE COFFRE D'UN BLOC-BAIE ENTRE DANS LA COTE — lot O10, et c'est une
  // conséquence du même changement de convention. La cote mesure le DORMANT
  // parce que rien d'autre ne porte la hauteur commandée ; mais depuis que le
  // coffre est DEDANS, le dormant n'en porte plus qu'une partie. La cote
  // partirait du haut du dormant et afficherait la cote totale : le trait et
  // son étiquette ne diraient plus la même chose — exactement la faute que ce
  // choix évitait quand le coffre s'ajoutait par-dessus.
  const coffreDeLaCote = rects.find((rect) => rect.role === 'coffre' && rect.yMm === 0);
  const hautMenuiserie = (boiteDormant?.yMm ?? 0) - (coffreDeLaCote?.heightMm ?? 0);
  const basMenuiserie = boiteDormant ? boiteDormant.yMm + boiteDormant.heightMm : dessinH;

  const cotes: ElevationCote[] = [
    {
      code: 'largeur',
      label: `${config.widthMm} mm`,
      valeurMm: config.widthMm,
      orientation: 'horizontale',
      x1Mm: 0,
      y1Mm: dessinH + marge * 0.55,
      x2Mm: dessinW,
      y2Mm: dessinH + marge * 0.55,
      textXMm: dessinW / 2,
      textYMm: dessinH + marge * 0.55,
    },
    {
      code: 'hauteur',
      label: `${config.heightMm} mm`,
      valeurMm: config.heightMm,
      orientation: 'verticale',
      x1Mm: -marge * 0.55,
      y1Mm: hautMenuiserie,
      x2Mm: -marge * 0.55,
      y2Mm: basMenuiserie,
      textXMm: -marge * 0.55,
      textYMm: (hautMenuiserie + basMenuiserie) / 2,
    },
  ];

  // Le coffre, quand il y en a un, porte sa propre cote : le client doit
  // savoir combien de hauteur l'ensemble occupe réellement au tableau.
  const rectCoffre = rects.find((rect) => rect.role === 'coffre');
  if (rectCoffre && hautMenuiserie > 0) {
    cotes.push({
      code: 'coffre',
      label: `coffre ${Math.round(rectCoffre.heightMm)} mm`,
      valeurMm: Math.round(rectCoffre.heightMm),
      prefixe: 'coffre ',
      orientation: 'verticale',
      x1Mm: -marge * 0.55,
      y1Mm: rectCoffre.yMm,
      x2Mm: -marge * 0.55,
      y2Mm: rectCoffre.yMm + rectCoffre.heightMm,
      textXMm: -marge * 0.55,
      textYMm: rectCoffre.yMm + rectCoffre.heightMm / 2,
    });
  }
  // LES COTES D'UNE FAMILLE qui ne se cote pas comme une menuiserie — la
  module.cotes?.({ config, cotes, dessinW, dessinH, marge });

  const teinte = resoudreTeintes({
    couleur: config.couleur,
    materiau: config.materiau,
    ralExterieur: config.ralExterieur,
    ralInterieur: config.ralInterieur,
    decorPlaxe: config.decorPlaxe,
    finition: config.finition,
  });
  const vitrage = effectiveVitrage(config, catalog);
  return {
    famille: config.famille,
    widthMm: config.widthMm,
    heightMm: config.heightMm,
    viewBox: {
      xMm: -marge,
      yMm: -marge * 0.35,
      widthMm: dessinW + marge * 1.35,
      heightMm: dessinH + marge * 1.2,
    },
    rects,
    contours,
    lines,
    cotes,
    poignees,
    disques,
    couleurs: {
      cadreInterieur: teinte.interieur,
      cadreExterieur: teinte.exterieur,
      // La teinte du VERRE suit son aspect. C'est un seul champ, et il
      // sert deux vues : le SVG le pose en ligne sur sa racine, et la
      // scène 3D le reçoit tel quel du widget. Un verre dépoli qui
      // resterait transparent en volume trahirait la seule chose que le
      // client achète en le choisissant — ne plus être vu.
      vitrage: teinteVitrage(vitrage),
    },
  };
}

/** Les teintes indicatives d'un matériau — repli quand la couleur manque. */
export function teinteParDefaut(materiau: Materiau): string {
  return materiau === 'bois' ? '#8a5a2b' : materiau === 'alu' ? '#5d6265' : '#f4f4f1';
}
