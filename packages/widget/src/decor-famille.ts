import { climatDe } from '@ahjc/core/src/zones.ts';

import { FORMES_CLOSES } from '@ahjc/core';
import type { FamilleId, Forme, JoineryConfiguration } from '@ahjc/core';

/**
 * Ce dans quoi l'ouvrage se pose. Six décors, et pas un de plus : chacun
 * répond à une question de pose réellement différente, et aucun n'est là
 * pour faire joli.
 */
export type TypeDecor =
  /** Une BAIE percée dans un mur — jambages, linteau, allège, appui. */
  | 'baie'
  /** Une FAÇADE pleine : l'ouvrage est vissé dessus, rien n'est percé. */
  | 'facade'
  | 'piece'
  /** DEUX PILIERS maçonnés sur le sol, sans rien au-dessus. */
  | 'piliers'
  /**
   * UN PILIER de réception, un RAIL au sol, et le REFOULEMENT — la place
   * qu'il faut à côté du passage pour que le vantail s'efface.
   */
  | 'rail'
  /** LE TERRAIN seul : l'ouvrage y est planté, il porte ses propres poteaux. */
  | 'terrain'
  /** Une DALLE dont l'ouvrage borde la rive — et du vide derrière. */
  | 'dalle'
  /**
   * UN PAN DE COUVERTURE, incliné à la pente du toit, et percé.
   *
   * C'est le seul décor qui ne soit pas vertical, et c'est tout son objet :
   * une fenêtre de toit se pose DANS la pente. Affichée dans un mur — ce
   * qu'elle était — elle montrait une petite fenêtre verticale avec le toit
   * juste au-dessus d'elle, c'est-à-dire précisément le produit qu'elle
   * n'est pas.
   */
  | 'rampant';

/**
 * D'OÙ ON REGARDE l'ouvrage. Ce n'est pas une préférence d'écran : c'est le
 * côté depuis lequel on l'ACHÈTE.
 *
 * On choisit sa fenêtre depuis le salon — c'est de là qu'on la regardera
 * tous les jours, et c'est la lumière qu'elle laisse entrer qu'on juge. On
 * choisit son VOLET et sa PORTE D'ENTRÉE depuis la rue : ce sont eux que
 * les passants voient, et leur face intérieure n'intéresse personne.
 *
 * Le premier jet les traitait tous comme des fenêtres, et proposait donc
 * de juger un volet battant par sa face arrière.
 */
export type VuDepuis = 'dedans' | 'dehors';

/**
 * COMMENT LA MAÇONNERIE SE REFERME SUR LA BAIE.
 *
 * Le décor ne recevait qu'un contour anonyme — une suite de points. Un
 * contour dit la forme du TROU, il ne dit pas ce qu'un maçon fait autour, et
 * ce n'est pas la même chose selon la forme :
 *
 *  · `droit`  — deux piédroits et un linteau. Le mur suffit, rien à ajouter ;
 *  · `arc`    — au-dessus d'un sommet cintré, un maçon ne pose pas un linteau
 *               droit : il monte un ARC, en claveaux impairs autour d'une
 *               clé centrale. L'appui, lui, reste droit ;
 *  · `oculus` — un œil-de-bœuf est un ENCADREMENT CIRCULAIRE, et il n'a PAS
 *               d'appui. C'est d'ailleurs son vrai problème de métier —
 *               l'évacuation de l'eau, qu'on règle par un cochonnet
 *               périphérique et un recul du dormant dans la baie.
 */
export type EncadrementBaie = 'droit' | 'arc' | 'oculus';

export interface DecorFamille {
  type: TypeDecor;
  vuDepuis: VuDepuis;
  /**
   * LA PENTE DU PAN, en degrés — le décor `rampant` et lui seul. Elle vient
   * de la configuration, où la règle de la famille la réclame déjà : sous
   * quinze degrés l'eau stagne, au-delà de quatre-vingt-dix ce n'est plus
   * un toit. Le décor ne l'invente donc pas, il la lit.
   */
  penteToitDeg?: number;
  allegeMm: number;
  /** Ce que le maçon monte autour du trou. */
  encadrement: EncadrementBaie;
  /**
   * LE MUR AU-DESSUS SUIT LA PENTE DU TOIT. Un trapèze et un triangle ne
   * sont pas des fenêtres de séjour : ce sont des baies de PIGNON, dont le
   * bord oblique est parallèle au rampant. Affichées dans une façade plate
   * sous une gouttière horizontale, rien ne disait qu'on est sous un comble.
   */
  rampant: boolean;
}

const DECOR_PAR_FAMILLE: Record<FamilleId, TypeDecor> = {
  // Les menuiseries et leurs fermetures : une baie dans un mur. Un volet,
  // roulant ou battant, est bien devant une baie — c'est ce qu'il ferme.
  fenetre: 'baie',
  'porte-fenetre': 'baie',
  coulissant: 'baie',
  'porte-entree': 'baie',
  'volet-roulant': 'baie',
  'volet-battant': 'baie',
  // Une PORTE DE GARAGE est bien une baie percée dans un mur — c'est même
  // la plus grande de la maison. Ce qui la distingue d'une fenêtre n'est
  // pas son décor mais son ALLÈGE : elle n'en a pas, elle descend au sol.
  'porte-garage': 'baie',
  // Un store banne se visse SUR la façade, au-dessus d'une terrasse. Percer
  // le mur derrière lui ouvrait un trou béant là où il n'y a qu'un mur.
  'store-banne': 'facade',
  'portail-battant': 'piliers',
  // UN COULISSANT NE SE PRÉSENTE PAS COMME UN BATTANT. Deux piliers
  // s'efface sur le côté. Ce qui coûte de l'argent au client, c'est la
  // LONGUEUR DE REFOULEMENT : la place qu'il faut à côté du passage, et
  // qu'on découvre trop tard (c'est l'incident fondateur de la compétence
  'portail-coulissant': 'rail',
  portillon: 'piliers',
  // Les ouvrages LINÉAIRES portent leurs propres poteaux — le métré les
  // compte, la 3D les dessine. Leur décor est le terrain, et rien d'autre.
  cloture: 'terrain',
  claustra: 'terrain',
  muret: 'terrain',
  totem: 'terrain',
  // n'a plus de raison d'être — et son entraxe de barreaux non plus.
  'garde-corps': 'dalle',
  // fixent SUR la façade et posent au sol : le mur reste plein derrière
  // elles. En `baie`, la capture montrait un trou béant dans une maison,
  // avec le jardin au travers — sur un ouvrage dont tout l'argument est
  // qu'il AJOUTE une pièce.
  pergola: 'facade',
  veranda: 'facade',
  // UNE MOUSTIQUAIRE ET UN STORE INTÉRIEUR sont DEVANT une baie : c'est
  // même leur définition. Le décor de la baie est le bon — c'est le point
  // de vue qui change pour le store, voir `vuDepuis`.
  moustiquaire: 'baie',
  'store-interieur': 'baie',
  // UNE FENÊTRE DE TOIT EST DANS LA PENTE. Le décor `rampant` porte le pan
  // de couverture et la perce à son inclinaison ; en `baie`, la capture la
  // montrait verticale dans un mur, avec le toit juste au-dessus d'elle —
  // c'est-à-dire exactement le produit qu'elle n'est pas.
  'fenetre-toit': 'rampant',
  // UN BSO ET UN SCREEN ZIP SONT DEVANT UNE BAIE, pas sur une façade nue.
  // C'est ce qui les distingue du store BANNE, qui se visse au-dessus d'une
  // terrasse : ces deux-là protègent un VITRAGE, et leur intérêt ne se voit
  // qu'avec le vitrage derrière. Un décor `facade` en aurait fait des stores
  // posés sur un mur plein — le contraire de leur usage.
  bso: 'baie',
  'screen-zip': 'baie',
  caisson: 'piece',
  // exactement la surface dont on ignore la nature, celle où la patte
  // anti-basculement se poserait. Le décor `facade` le montre ; un décor
  commode: 'piece',
  // hauteur/profondeur est TOUJOURS au-dessus du seuil (QM1) : le mur
  // derrière elle porte la patte, sans exception de cote.
  armoire: 'piece',
  // le piètement décide du basculement sans que le ratio le voie (lot D4).
  buffet: 'piece',
  // explicitement, dont le ratio ne peut jamais demander la patte (QM1).
  'meuble-tv': 'piece',
  // du dépôt dont une pièce porte une PERSONNE (lot D6).
  'banc-coffre': 'piece',
  // décor de FAÇADE : le vitrage est une porte, pas une baie dans un mur.
  vitrine: 'piece',
  // LES DEUX MENUISERIES D'INTÉRIEUR (lot D9) SONT DES BAIES — et c'est la
  // seule fois du dépôt où « baie » ne désigne pas un trou dans un mur
  // linteau, et pas d'allège ni d'appui, puisqu'on marche au travers. Le décor
  // de FAÇADE serait faux — il montrerait l'ouvrage vissé sur un mur plein,
  // alors que tout le sujet de ces deux familles est CE QU'ON TRAVERSE.
  'bloc-porte': 'baie',
  'galandage-interieur': 'baie',
  // retient de basculer. Le décor `facade` est donc le bon, et il n'est
  // pas décoratif ici : il montre exactement la surface dont on ignore la
  // nature, et sur laquelle la fixation ne se choisit pas.
  bibliotheque: 'piece',
  // rien, et c'est ce qui le rend intéressant : on le pose au milieu d'une
  // allée. En `facade`, il aurait pris l'air d'un auvent collé à la maison,
  'carport-pv': 'terrain',
  // décor, et c'est la SEULE chose que les deux partagent à l'écran. Ce
  // qui les sépare est au-dessus : un toit qui ne s'ouvre jamais.
  'pergola-pv': 'facade',
  // la même raison : montrée verticale sur une façade, elle deviendrait un
  // panneau collé à un mur, c'est-à-dire le produit qu'elle n'est pas.
  'surimposition-pv': 'rampant',
  // mur reste plein derrière eux. En `baie`, la capture aurait montré un
  // trou béant là où il n'y a qu'un mur — la faute déjà payée par le
  'brise-soleil-pv': 'facade',
  'verriere-pv': 'facade',
  // UN CHAMP AU SOL est planté dans le TERRAIN, et il n'est adossé à
  // rien : c'est même sa définition — il est dans le jardin, pas sur le
  // bâtiment.
  'pv-au-sol': 'terrain',
  // mélange —, et celles-là vivent à l'intérieur : le décor `piece` porte le
  // sol qui l'ancre et le mur qui donne l'échelle, et son plafond suit la
  // hauteur de l'ouvrage plutôt qu'une cote fixe.
  //
  // `dalle` aussi, et c'est plus subtil — ce décor est une rive de dalle AVEC
  // famille et une autre question.
};

/**
 * L'ALLÈGE COURANTE D'UNE FENÊTRE, en millimètres — la hauteur d'appui d'une
 * baie de séjour. C'est une convention d'affichage, pas une cote du produit :
 * la cote saisie par le client garde toujours le dernier mot.
 */
const ALLEGE_DE_FENETRE_MM = 900;

const HAUT_DE_BAIE_MM = 2100;

const AU_SOL_DANS_UN_MUR: ReadonlySet<FamilleId> = new Set<FamilleId>([
  // On les TRAVERSE : leur seuil est le sol fini.
  'porte-fenetre',
  'coulissant',
  'porte-entree',
  'porte-garage',
  'bloc-porte',
  'galandage-interieur',
  // Elles POSENT : leur décor est une façade — le mur n'est pas percé —,
  // mais elles ne sont pas accrochées en hauteur pour autant.
  'pergola',
  'veranda',
  'pergola-pv',
  'verriere-pv',
]);

/**
 * CE QUI S'ACCROCHE, ET À QUELLE HAUTEUR. Tout ce qui protège une baie de
 * fenêtre est à hauteur d'appui ; ce qui se pose au-dessus d'une baie est au
 * haut de la baie. Une famille absente des deux listes est un oubli, pas un
 * cas par défaut.
 */
const HAUTEUR_DE_POSE_MM: Partial<Record<FamilleId, number>> = {
  fenetre: ALLEGE_DE_FENETRE_MM,
  'volet-roulant': ALLEGE_DE_FENETRE_MM,
  'volet-battant': ALLEGE_DE_FENETRE_MM,
  moustiquaire: ALLEGE_DE_FENETRE_MM,
  'store-interieur': ALLEGE_DE_FENETRE_MM,
  bso: ALLEGE_DE_FENETRE_MM,
  'screen-zip': ALLEGE_DE_FENETRE_MM,
  'store-banne': HAUT_DE_BAIE_MM,
  'brise-soleil-pv': HAUT_DE_BAIE_MM,
};

export function allegeParDefaut(famille: FamilleId, allegeSaisieMm?: number): number {
  const type = typeDeDecor(famille);
  // AUCUN MUR SOUS L'OUVRAGE, donc aucune allège à représenter — et une cote
  // saisie ne doit pas en créer une. Une fenêtre de toit est dans la PENTE :
  // une allège saisie par erreur la ferait glisser le long du rampant. Une
  // pièce a son sol sous l'ouvrage (lot D10).
  if (type !== 'baie' && type !== 'facade') return 0;
  if (allegeSaisieMm !== undefined && allegeSaisieMm >= 0) return allegeSaisieMm;
  if (AU_SOL_DANS_UN_MUR.has(famille)) return 0;
  // LE DERNIER RECOURS N'EST PLUS UN DÉFAUT SILENCIEUX. Il vaut l'allège
  // d'une fenêtre parce qu'il faut bien rendre un nombre à un appelant qui
  // passerait une chaîne venue d'ailleurs ; pour une famille du manifeste,
  // c'est le comparateur qui refuse l'oubli, pas cette ligne.
  return HAUTEUR_DE_POSE_MM[famille] ?? ALLEGE_DE_FENETRE_MM;
}

/**
 * LES DEUX LISTES, pour le comparateur et pour lui seul.
 *
 * Elles ne sont pas exportées pour être lues par un écran : elles le sont
 * pour qu'une épreuve puisse vérifier que le manifeste entier est classé.
 * C'est la coupure du lot Z17 — l'entrée porte ce qu'il faut pour CALCULER,
 * la déclaration exhaustive vit dans le verrou.
 */
export const CLASSEMENT_DES_ALLEGES = {
  auSol: AU_SOL_DANS_UN_MUR,
  enHauteur: HAUTEUR_DE_POSE_MM,
} as const;

/**
 * Le type de décor d'une famille.
 *
 * IL N'Y A PLUS DE DÉFAUT À INVENTER : le registre est complet et le
 * compilateur le tient. L'ancien défaut `baie` reposait sur un pari — « un
 * décor visiblement faux se remarquera » — qui était juste et qui n'a pas
 * suffi : il demandait que quelqu'un regarde, et cinq familles ont attendu
 * deux lots. Le `?? 'baie'` de secours reste pour l'appelant qui passerait
 * une chaîne venue d'ailleurs, jamais pour une famille du manifeste.
 */
export function typeDeDecor(famille: FamilleId): TypeDecor {
  return DECOR_PAR_FAMILLE[famille] ?? 'baie';
}

/**
 * D'où l'on regarde cette famille.
 *
 * Seules les menuiseries qu'on habite se jugent du dedans. Tout ce qui
 * s'accroche à la façade ou se tient dans le jardin se juge du dehors —
 * c'est là qu'on le voit.
 */
export function vuDepuis(famille: FamilleId): VuDepuis {
  // UN OUVRAGE QUI VIT DEDANS SE REGARDE DU DEDANS, et cette ligne est le
  // DEUXIÈME LECTEUR de `climatDe()` — le premier étant un ternaire qui
  // choisit un adjectif dans un message `info`. Le lot D9 avait mesuré que la
  // notion n'en avait qu'un, et écrit que « le jour où un écran s'en servira,
  // elle vaudra son type ». C'est ce jour-là, et le lecteur n'a pas été
  // rendue de dos.
  //
  // CE QUI ÉTAIT ÉCRIT ICI ÉNUMÉRAIT QUATRE FAMILLES et mettait tout le reste
  // dehors. C'était juste le jour où on l'a écrit, et faux au lot suivant :
  // lot D9, se sont tous rangés dans le « tout le reste ». VU À L'ÉCRAN : une
  if (climatDe(famille) === 'dedans') return 'dedans';
  // ET TROIS MENUISERIES DE FAÇADE SE REGARDENT DU DEDANS malgré leur climat :
  // on choisit sa fenêtre depuis son salon, pas depuis la rue. Ce n'est pas le
  // climat de l'ouvrage qui le dit, c'est celui du CLIENT — et ces trois-là
  // sont nommées parce qu'aucune règle ne les dérive.
  return famille === 'fenetre' || famille === 'porte-fenetre' || famille === 'coulissant'
    ? 'dedans'
    : 'dehors';
}

export function encadrementDeLaForme(forme: Forme | undefined): EncadrementBaie {
  if (!forme) return 'droit';
  if ((FORMES_CLOSES as readonly Forme[]).includes(forme)) return 'oculus';
  return forme === 'plein-cintre' || forme === 'surbaisse' || forme === 'anse-de-panier'
    ? 'arc'
    : 'droit';
}

/** Une baie de PIGNON : son bord oblique suit le rampant du toit. */
export function estBaieDePignon(forme: Forme | undefined): boolean {
  return forme === 'trapeze' || forme === 'triangle';
}

/** Le décor complet d'une configuration. */
export function aDeuxFacesTeintables(type: TypeDecor): boolean {
  return type === 'baie' || type === 'rampant';
}

export function decorDeLaFamille(config: JoineryConfiguration): DecorFamille {
  const type = typeDeDecor(config.famille);
  // en chapeau de gendarme n'a ni arc ni appui : il a deux piliers.
  const forme = type === 'baie' ? config.forme : undefined;
  const encadrement = encadrementDeLaForme(forme);
  return {
    type,
    vuDepuis: vuDepuis(config.famille),
    // TRENTE-CINQ DEGRÉS À DÉFAUT : la pente la plus répandue en France, et
    // celle que la règle de la fenêtre de toit propose quand le client n'a
    // rien déclaré. Zéro donnerait un toit plat, c'est-à-dire le seul cas
    // où cette famille se refuse.
    ...(type === 'rampant' ? { penteToitDeg: config.penteToitureDeg ?? 35 } : {}),
    // UN ŒIL-DE-BŒUF NE SE POSE PAS À HAUTEUR D'APPUI. Il éclaire un comble,
    // 900 mm du sol au-dessus d'un radiateur. La cote saisie garde le dernier
    // mot ; c'est le DÉFAUT qui change.
    allegeMm:
      encadrement === 'oculus' && config.hauteurAllegeMm === undefined
        ? 2000
        : allegeParDefaut(config.famille, config.hauteurAllegeMm),
    encadrement,
    rampant: type === 'baie' && estBaieDePignon(forme),
  };
}
