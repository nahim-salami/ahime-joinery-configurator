/**
 * Pourquoi ce fichier existe : le catalogue de tarification — matrices par
 * famille et par nombre de vantaux, coefficients, options, bornes, seuils de
 * ferrures, données thermiques. `DEFAULT_CATALOG` est crédible et vendable
 * tel quel (docs/05, phase 1) ; le marchand le remplace ou l'ajuste depuis
 * son back-office, il ne le code jamais.
 *
 * Solution écartée : des montants fixes pour le vitrage, la couleur, la
 * gamme (« +80 € le triple »). Faux aux extrêmes — le triple vitrage d'une
 * baie de 4 m² coûte bien plus que celui d'un châssis de 0,5 m². Les
 * coefficients suivent la surface naturellement puisqu'ils s'appliquent à
 * une base qui en dépend déjà (docs/04 §2). Ils sont stockés en MILLIÈMES
 * entiers (1060 = ×1,06) : l'arithmétique reste entière, la parité JS↔PHP
 * ne compare jamais deux flottants.
 *
 * Incident fondateur : la matrice « fenêtre 2 vantaux » reprend VERBATIM le
 * bloc publié en docs/04 §1, et le coulissant 2 vantaux est construit pour
 * que base(2400, 2150) = 692,00 € pile — les exemples chiffrés de la doc
 * sont rejoués par les golden configs. Une doc qui ment casse la suite de
 * tests : c'est voulu.
 */

import type {
  Couleur,
  FamilleId,
  Gamme,
  Materiau,
  OptionId,
  ModelePorte,
  ModeleVolet,
  AlimentationMoteur,
  RemplissagePortail,
  SecuriteId,
  TypeMoteur,
  ZoneVent,
  ManoeuvreVolet,
  TypeCoffre,
  Ouverture,
  Pose,
  RemplissagePorte,
  AspectVitrage,
  VitrageBase,
  JoineryConfiguration,
} from './types.ts';
import type { OuvertureDeclaree } from './ouverture-declaree.ts';
import type { ZoneNormative } from './zones.ts';
import type { PriceMatrix } from './matrix.ts';
import type { Forme } from './geometrie/formes.ts';
import type { PosteDef } from './prix-a-la-piece.ts';

/**
 * Une GAMME NOMMÉE de profilés — ce que le métier appelle un « système ».
 * Un menuisier ne vend pas « de l'aluminium confort » : il vend une gamme
 * qui porte un nom, une épaisseur, un nombre de chambres et un Uf certifié
 * par son fournisseur.
 *
 * Solution écartée : livrer les gammes réelles du marché (Alupco, Technal,
 * Schüco…) dans le catalogue par défaut. Ce sont des marques déposées, et
 * surtout leurs cotes et leurs Uf changent à chaque millésime : les
 * expédier à 38 000 marchands sans les tenir du fournisseur, c'est
 * promettre un Uw faux — donc une éligibilité aux aides fausse (voir la
 * compétence `thermique-uw`). Le catalogue par défaut décrit donc des
 * systèmes NEUTRES, que le marchand renomme et re-cote depuis le catalogue
 * de SON fournisseur, dans son back-office.
 */
export interface SystemeProfile {
  id: string;
  /** Le nom commercial — celui que le marchand affiche et modifie. */
  nom: string;
  materiau: Materiau;
  /** Le palier tarifaire de rattachement, qui sert de repli. */
  gamme: Gamme;
  epaisseurMm: number;
  chambres: number;
  ruptureThermique: boolean;
  uf: number;
  /** Coefficient propre en millièmes ; à défaut, celui de la gamme. */
  coefMilliemes?: number;
  /** L'argument que le marchand met en avant. */
  argument?: string;
}

/**
 * Ce qu'un TYPE DE POSE emporte. C'est la question que le configurateur ne
 * posait pas, et elle décide de tout : la cote que le client doit relever,
 * le dormant que l'atelier fabrique, les profilés d'habillage qui partent
 * avec, et le clair de jour qui restera.
 *
 * Solution écartée : tarifer ici la dépose, l'évacuation et la reprise de
 * maçonnerie. Ce sont des HEURES DE CHANTIER, et le pied de page du
 * configurateur annonce « pose non comprise » — les facturer sous le nom
 * d'une menuiserie ferait mentir le devis. Ne sont chiffrées que des
 * PIÈCES : la tapée, le couvre-joint, la bavette d'appui — celles que le
 * dossier de fabrication listera et que l'atelier coupera.
 *
 * Incident fondateur : la compétence `prise-de-cotes` §1 donne une ligne
 * de mesure par pose. Elles sont recopiées ci-dessous MOT POUR MOT dans
 * `mesureLargeur` / `mesureHauteur` : le guide affiché au client et la
 * règle qui le valide viennent de la même donnée.
 */
export interface PoseDef {
  id: Pose;
  label: string;
  /**
   * Coefficient sur la base, en millièmes. Seule la rénovation change le
   * profilé FABRIQUÉ (dormant à aile de recouvrement) ; les autres poses
   * coûtent du chantier, pas de l'atelier — d'où 1000 partout ailleurs.
   */
  coefMilliemes: number;
  /** L'aile de recouvrement, par côté (mm) — hors cote saisie. */
  recouvrementMm: number;
  /**
   * La largeur d'ouvrant de la menuiserie DÉPOSÉE, par côté. En rénovation
   * le client mesure l'intérieur du dormant conservé : à cet endroit il y
   * avait déjà un ouvrant, qui masquait déjà cette bande. Ce n'est donc pas
   * une perte nouvelle, et la retrancher est ce qui ramène le clair perdu
   * aux 40–60 mm que le métier annonce (compétence `prise-de-cotes` §1,
   * règle d'or 4) au lieu de la largeur entière du nouveau cadre.
   */
  ouvrantExistantMm: number;
  /** Couvre-joint intérieur, au mètre — posé sur trois côtés, jamais l'appui. */
  couvreJointCentsParMetre: number;
  /** Bavette d'appui aluminium, au mètre de LARGEUR. */
  bavetteCentsParMetre: number;
  /** La tapée d'isolation a-t-elle un sens sur cette pose ? */
  tapee: boolean;
  /** Le guide de cotes, une ligne par axe — compétence `prise-de-cotes` §1. */
  mesureLargeur: string;
  mesureHauteur: string;
  argument: string;
}

/**
 * Une FORME au catalogue. Le coefficient n'est pas décoratif : un profilé
 * cintré passe à la cintreuse, se contrôle au gabarit et se rebute plus
 * souvent — c'est le poste où un menuisier perd de l'argent s'il chiffre à
 * la louche. Le trapèze et le triangle, eux, ne demandent que des coupes
 * biaises : ils coûtent moins.
 */
export interface FormeDef {
  id: Forme;
  label: string;
  coefMilliemes: number;
  /** Les familles où la forme se vend. */
  familles: FamilleId[];
  /**
   * Les ouvertures compatibles. Un œil-de-bœuf ne coulisse pas, et un
   * cintré ne se met pas sur un rail. Absent = toutes.
   */
  ouvertures?: Ouverture[];
  argument: string;
}

/** Une épaisseur de tapée disponible — le doublage qu'elle rattrape. */
export interface TapeeDef {
  epaisseurMm: number;
  centsParMetre: number;
}

/**
 * Le DÉCOR d'un panneau de porte, décrit en données et non en code. Un
 * marchand ajoute un modèle à son catalogue sans qu'une ligne soit écrite :
 * c'est la condition pour que 38 000 menuisiers aient chacun SA gamme de
 * portes.
 *
 * Solution écartée : une fonction de dessin par modèle. Le premier modèle
 * ajouté par un marchand aurait été un panneau uni — le dessin serait alors
 * devenu un mensonge sur le produit vendu, et c'est précisément ce que la
 * règle « le dessin sort du moteur » interdit.
 */
export interface DecorPorte {
  /** Panneaux en creux empilés sur la hauteur pleine. */
  panneaux?: number;
  /** Rainures verticales fraisées dans la masse. */
  rainures?: number;
  /** Moulures : cadres en relief autour de chaque panneau. */
  moulures?: number;
  /** Inserts d'inox horizontaux, en applique. */
  insertsInox?: number;
}

/** Un modèle de porte d'entrée — le dessin du panneau, et son prix. */
export interface ModelePorteDef {
  id: ModelePorte;
  nom: string;
  /** Coefficient sur la base ; 1000 pour le panneau uni de référence. */
  coefMilliemes: number;
  decor: DecorPorte;
  argument: string;
}

/**
 * Ce qui garnit un volet battant. Un volet n'est pas un panneau : c'est un
 * BÂTI de menuisier — deux montants, deux traverses — garni de lames. Ce que
 * le modèle décide, c'est la nature de ce garnissage.
 *
 * Solution écartée : un booléen `plein`. Le volet le plus vendu du Sud n'est
 * ni tout persienné ni tout plein — il est PLEIN EN BAS et persienné en
 * haut : on ferme le bas pour l'intimité et on laisse l'air passer par le
 * haut. Une part de hauteur couvre les trois cas d'un seul nombre.
 */
export interface DecorVolet {
  /**
   * La part de la HAUTEUR occupée par les persiennes, comptée depuis le
   * haut. 1 = tout persienné (le volet que ce catalogue a toujours vendu),
   * 0 = tout plein, 0,55 = mi-plein.
   */
  persiennePart: number;
  /**
   * Les barres horizontales qui tiennent les planches de la partie pleine.
   * Sans elles, des planches jointives se disjoignent au premier hiver —
   * c'est la raison d'être de la barre, pas sa décoration.
   */
  barres?: number;
  /**
   * L'écharpe, la diagonale du « volet à barres et écharpe ». Son SENS
   * n'est pas un choix de style : elle part toujours du bas CÔTÉ GONDS et
   * monte vers le côté libre, de sorte que le volet pèse sur elle en
   * compression. Posée à l'envers, elle travaille en traction, l'assemblage
   * s'ouvre et le volet tombe du nez en deux saisons. Le code la calcule
   * donc depuis le côté des gonds, et un test le vérifie.
   */
  echarpe?: boolean;
}

/** Un modèle de volet battant — le garnissage du bâti, et son prix. */
export interface ModeleVoletDef {
  id: ModeleVolet;
  nom: string;
  /** Coefficient sur la base ; 1000 pour le persienné de référence. */
  coefMilliemes: number;
  decor: DecorVolet;
  argument: string;
}

export interface DecorPortail {
  /** Le sens des lames. Horizontales neuf fois sur dix. */
  lames?: 'horizontales' | 'verticales';
  /** Le pas des lames, en mm. Plus grand que la lame, il fait de l'ajour. */
  pasMm?: number;
  partPleine?: number;
  /** Des barreaux verticaux plutôt que des lames — le fer forgé. */
  barreaux?: boolean;
  /** Un motif découpé dans une tôle : une grille fine, dessinée aux deux sens. */
  decoupe?: boolean;
}

export interface ModelePortailDef {
  id: RemplissagePortail;
  nom: string;
  /** Coefficient sur la base ; 1000 pour l'ajouré de référence. */
  coefMilliemes: number;
  /** La part de VIDE dans la surface du vantail, entre 0 et 1. */
  ajourage: number;
  decor: DecorPortail;
  argument: string;
}

export interface MoteurDef {
  id: TypeMoteur;
  nom: string;
  /** Les familles qu'il sait mouvoir. Une crémaillère ne fait pas un battant. */
  familles: FamilleId[];
  /** L'abaque : au-delà, le moteur force, chauffe et casse le vantail. */
  poidsMaxKg: number;
  largeurVantailMaxMm: number;
  amountCents: number;
  /** Les alimentations proposées pour ce moteur. */
  alimentations: AlimentationMoteur[];
  argument: string;
}

/** Un dispositif de sécurité imposé, et ce qu'il coûte. */
export interface SecuriteDef {
  id: SecuriteId;
  nom: string;
  amountCents: number;
  /** Ce que la norme exige, en une phrase — reprise telle quelle au devis. */
  exigence: string;
}

/** Une option du catalogue — montant fixe, par vantail ou par menuiserie. */
export interface OptionDef {
  id: OptionId;
  label: string;
  amountCents: number;
  unite: 'parVantail' | 'parMenuiserie';
  familles: FamilleId[];
}

/** Bornes de fabrication d'une famille — les maxima viennent des matrices. */
export interface BornesFamille {
  minWidthMm: number;
  minHeightMm: number;
  vantauxMin: number;
  vantauxMax: number;
  vantailMinMm: number;
  /** Largeur maximale d'un vantail, par matériau — absent = indisponible. */
  vantailMaxMm: Partial<Record<Materiau, number>>;
  hauteurMaxMm?: number;
}

/**
 * Poids de VANTAIL admissible (kg) — verre, cadre et ferrure compris.
 *
 * Ces seuils portaient sur le poids de VITRAGE seul (docs/02 §3.2). C'était
 * cohérent tant que le rapport de mesure ne pesait que le verre ; ce ne
 * l'est plus depuis que le lot 1 pèse le vantail complet, et il fallait donc
 * les redire dans la bonne unité — sinon toute menuiserie devenait
 * « renforcée » du jour au lendemain.
 *
 * Les valeurs sont celles des abaques de ferrure du commerce (compétence
 * `quincaillerie-et-ferrage` §1) : ferrure de frappe standard jusqu'à
 * 80-100 kg, renforcée jusqu'à 130-150 ; galets de coulissant 80 kg à deux,
 * bien plus à quatre ; trois paumelles de porte, 120 kg.
 */
export interface SeuilsFerrures {
  standardKg: number;
  renforceKg: number;
}

/**
 * LES CINQ ÉTAGES DE LA CHAÎNE DE COTES, en largeurs vues (mm). Le métier
 * ne connaît pas « la largeur de la fenêtre » : il connaît des cotes
 * emboîtées, et chaque étage se déduit du précédent par une soustraction
 * que la fiche du fournisseur documente (compétence
 * `fabrication-atelier-menuiserie` §1) :
 *
 *   hors-tout → fond de feuillure → cote de vitrage → clair de vitrage
 *
 * Solution écartée : garder « une bande forfaitaire de chaque côté de
 * chaque vantail ». Elle comptait le battement DEUX FOIS au milieu d'un
 * deux-vantaux (230 mm là où le métier en pose 112) et sous-évaluait la
 * surface vitrée de 10 à 61 % selon la taille — d'où un poids de vitrage
 * faux, donc une classe de ferrure fausse, et un Uw qui faisait basculer
 * le seuil d'aide dans le mauvais sens (docs/13 §3).
 *
 * Chaque valeur est une LARGEUR VUE, celle qu'on mesure sur la menuiserie
 * posée. Elles sont calibrées pour que le taux de clair d'une menuiserie
 * courante tombe dans la fourchette du métier (55 à 75 %) — c'est le test
 * de vraisemblance de `structural.test.ts`, et c'est lui qui fait foi
 * quand une fiche fournisseur manque.
 */
export interface DeductionsGamme {
  /** Ce que le dormant montre au-delà de l'ouvrant, par côté. */
  dormantVuMm: number;
  /** Ce que l'ouvrant montre, parclose comprise, par côté. */
  ouvrantVuMm: number;
  /**
   * Le BATTEMENT central, compté UNE FOIS par refend — jamais deux fois un
   * demi-vantail. C'est la correction du lot 0.
   */
  battementMm: number;
  /** Un meneau ou une traverse rapportée, une fois par refend. */
  meneauMm: number;
  /**
   * Ce que la RÉNOVATION retire à la masse vue, par côté.
   *
   * Il vaut ZÉRO par défaut, et c'est une décision : certaines fiches
   * fournisseurs annoncent 4 mm d'écart sur la cote entre un dormant neuf
   * et un dormant de rénovation, mais la lecture de ces tables est
   * ambiguë, et le projet tient un invariant plus solide — « la pose ne
   * déforme jamais les cotes de fabrication » (`pose.test.ts`). Une gamme
   * qui documente vraiment son écart le pose ici ; à défaut, on ne fait
   * pas bouger un clair sur une source qu'on ne sait pas lire.
   */
  renovationEcartMm: number;
  /** Recouvrement de la parclose sur le verre — du clair à la cote de vitrage. */
  priseDeVerreMm: number;
  /** Jeu périphérique NF DTU 39 — de la cote de vitrage au fond de feuillure. */
  jeuVitrageMm: number;
  /**
   * LE RECOUVREMENT de l'ouvrant sur le dormant, par côté — la part de
   * l'ouvrant qui passe DERRIÈRE le dormant et qu'on ne voit pas.
   *
   * Il n'entre dans aucun clair ni dans aucun prix, et c'est pour cela
   * qu'il manquait : la masse vue suffisait à tout ce que le cœur savait
   * faire. Il devient indispensable dès qu'on DÉBITE — une barre d'ouvrant
   * se coupe à la cote EXTÉRIEURE du cadre, recouvrement compris, et
   * l'oublier fait une barre huit millimètres trop courte, c'est-à-dire un
   * rebut par ouvrant.
   *
   * Source : la section PVC 70 de `ressources/donnees/
   * sections-et-quincaillerie.json` donne 8 mm (`recouvrementSurDormantMm`).
   * Les autres matériaux portent la valeur courante du métier, dans
   * l'attente de la fiche technique de la gamme réellement vendue — c'est
   * l'avertissement que porte déjà `profils-gammes.json`, et il vaut ici.
   */
  recouvrementOuvrantMm: number;
}

export interface FamilleCatalog {
  label: string;
  /**
   * Clé = nombre de vantaux (« 1 », « 2 »…) — chaque famille a SES matrices.
   *
   * ABSENTE sur une famille vendue À LA PIÈCE (lot Z0), et c'est le seul
   * cas : son prix est une somme de postes déclarés, pas une cellule. Une
   * matrice dégénérée à une cellule aurait évité ce `?` et menti partout
   * ailleurs — elle se serait fait interpoler, et les refus de largeur
   * auraient lu « de 1000 à 1000 mm ». `catalog.test.ts` vérifie la
   * correspondance dans les DEUX sens.
   */
  matrices?: Record<string, PriceMatrix>;
  bornes: BornesFamille;
  /** Par famille — l'écart alu/PVC n'est pas le même sur un coulissant. */
  coefMateriauMilliemes: Partial<Record<Materiau, number>>;
  libelleMateriau?: string;

  libelleLargeur?: string;

  defauts?: Partial<JoineryConfiguration>;
  /** Ouvertures autorisées ; la première est le défaut. Absent = sans objet. */
  ouvertures?: Ouverture[];
  coefOuvertureMilliemes?: Partial<Record<Ouverture, number>>;
  /** La famille porte-t-elle un vitrage ? (la porte : selon remplissage) */
  vitree: boolean;
  seuilsFerrures?: SeuilsFerrures;
  /** Largeur de profil vue par côté de vantail (mm) — surcharge la globale. */
  frameBandMm?: Partial<Record<Materiau, number>>;
  /**
   * LA CHAÎNE DE COTES de cette famille, par matériau (lot 0). Sa présence
   * dit que la famille se décrit par une chaîne et non par une bande —
   * voir `suitLaChaineDeCotes()`.
   *
   * Elle vit ICI, dans le catalogue de famille, et non au niveau du
   * catalogue global : ces sept nombres par matériau ne servent qu'aux
   * familles vitrées, et le catalogue global est dans le CHARGEMENT
   * INITIAL. Les y laisser coûtait un demi-kilo-octet gzippé à un visiteur
   * venu pour un volet roulant — et le budget du widget l'a dit au premier
   * `verifier:bundle`. Le module de famille les apporte avec lui.
   */
  deductions?: Record<Materiau, DeductionsGamme>;
  /**
   * L'unité de vente. Absente = à la menuiserie, comme tout ce que ce
   * catalogue vendait jusqu'ici. `metre-lineaire` change la lecture de la
   * matrice : sa cellule donne le prix du MÈTRE COURANT à cette hauteur, et
   * `widthMm` est alors une longueur de terrain, pas une largeur de tableau.
   */
  unitePrix?: 'menuiserie' | 'metre-lineaire' | 'piece';
  /**
   * LES POSTES d'une famille vendue à la pièce (lot Z0) — ce que le marchand
   * déclare qu'on peut compter, et à quel prix l'unité. Le catalogue dit ce
   * qui est POSSIBLE, la configuration dit ce qui est PRIS : le patron exact
   * des options.
   */
  postes?: readonly PosteDef[];
  motDeLUnite?: string;
  ouvrageContinu?: boolean;
}

export interface PricingCatalog {
  version: string;
  /**
   * LE MARCHÉ SUR LEQUEL LE MARCHAND VEND — lot 13.
   *
   * Elle vit ICI et non dans la configuration parce que c'est une
   * déclaration du MARCHAND, pas un choix du client : on ne demande pas à
   * un acheteur dans quel pays les normes s'appliquent. Muette, elle vaut
   * « france », si bien qu'aucun catalogue existant ne change.
   *
   * Ce qu'elle décide : quelle classification s'applique (et laquelle le
   * moteur REFUSE d'appliquer hors de son domaine), quelles unités
   * s'affichent, et quels textes se citent. Voir `zones.ts`.
   */
  zoneNormative?: ZoneNormative;
  /**
   * Depuis le lot 0.2, cette table est VIDE à la construction et se remplit
   * quand les modules de famille arrivent (`familles/registre.ts`). Le type
   * reste total parce que, du point de vue d'un appelant légitime, il l'est :
   * on ne demande le prix d'un volet qu'après avoir chargé son module.
   *
   * `familleCatalog()` est le seul accès autorisé, et il REFUSE en nommant
   * l'appel manquant. Un accès direct rendrait `undefined`, qui filerait
   * jusqu'à une matrice et donnerait un prix de zéro euro — le genre de
   * panne qu'aucun test ne voit venir.
   */
  familles: Record<FamilleId, FamilleCatalog>;
  coefGammeMilliemes: Record<Gamme, number>;
  coefVitrageMilliemes: Record<VitrageBase, number>;
  coefPhoniqueMilliemes: number;
  coefFeuilleteMilliemes: number;
  /**
   * L'aspect du verre. `clair` est à 1000 : une configuration muette paie
   * ce qu'elle payait avant que la question existe.
   */
  coefAspectVitrageMilliemes: Record<AspectVitrage, number>;
  /**
   * Le store vénitien intégré. Le supplément le plus lourd du vitrage — un
   * store entre les verres, c'est un vitrage à monter en salle blanche,
   * avec sa commande magnétique ou solaire.
   */
  coefStoreIntegreMilliemes: number;
  /** L'intercalaire à bord chaud. Peu cher, et il se lit sur le Uw. */
  coefWarmEdgeMilliemes: number;
  coefCouleurMilliemes: Record<Couleur, number>;
  /** Porte d'entrée : le remplissage REMPLACE le coefficient de vitrage —
   * le feuilleté réglementaire des faces vitrées y est déjà compté. */
  coefRemplissagePorteMilliemes: Record<RemplissagePorte, number>;
  /**
   * Les gammes nommées. Vide, le configurateur retombe sur les trois
   * paliers abstraits — c'est ce que faisait la version précédente, et
   * c'est ce qui garantit que les prix ne bougent pas d'un centime tant
   * qu'aucune gamme n'est choisie.
   */
  systemes: SystemeProfile[];
  /**
   * Les quatre poses. `neuf-tableau` est la référence à 1000 millièmes :
   * une configuration qui ne dit rien de sa pose paie exactement ce
   * qu'elle payait avant que cette notion existe.
   */
  poses: Record<Pose, PoseDef>;
  /** Les épaisseurs de tapée vendues — pose en applique. */
  tapees: TapeeDef[];
  /**
   * Les modèles de porte d'entrée. Vide, la porte reste un panneau uni —
   * exactement ce qu'elle était, au centime près.
   */
  modelesPorte: ModelePorteDef[];
  /**
   * Les modèles de volet battant. Le persienné y figure à 1000 millièmes :
   * c'est le seul volet que ce catalogue vendait, et une configuration
   * muette continue de le payer au centime près.
   */
  modelesVolet: ModeleVoletDef[];
  modelesPortail: ModelePortailDef[];
  /**
   * LES OUVERTURES QUE CE MARCHAND VEND EN PLUS DES SIX NATIVES (lot MT4a).
   *
   * Vide par défaut : le catalogue de la maison n'en déclare aucune, faute de
   * fiche cotée. Chacune porte sa CINÉMATIQUE — c'est tout ce que le
   * chargement initial a besoin de savoir.
   */
  ouverturesDeclarees: OuvertureDeclaree[];
  moteurs: MoteurDef[];
  /** Les sécurités imposées par l'EN 12453. Vides sans le module. */
  securites: SecuriteDef[];
  /** Le supplément d'alimentation, en millièmes sur le prix du moteur. */
  coefAlimentationMilliemes: Record<AlimentationMoteur, number>;
  /**
   * La pression dynamique de référence par zone de vent, en pascals —
   * Eurocode 1 simplifié. C'est une DONNÉE du catalogue : les tables de vent
   * changent d'un pays à l'autre, et le lot international les remplacera.
   */
  pressionVentPa: Record<ZoneVent, number>;
  /**
   * Les données de l'ouvrage LINÉAIRE — poteaux, panneaux, massifs. Elles
   * décident du métré, donc du nombre de pièces que le dépôt prépare.
   */
  cloture: {
    /** L'entraxe entre deux poteaux. Au-delà, le panneau fléchit. */
    entraxePoteauxMm: number;
    /** La section d'un poteau, vue en plan. */
    sectionPoteauMm: number;
    /** L'épaisseur d'un panneau, vue en plan. */
    epaisseurPanneauMm: number;
    /** Le béton d'un massif de fondation, en litres — ce que le maçon coule. */
    massifLitres: number;
    /** La semelle filante d'un ouvrage CONTINU, en litres par mètre. */
    semelleLitresParMetre: number;
    /** Le prix d'un poteau courant, et le supplément d'un poteau d'angle. */
    poteauCents: number;
    poteauAngleSupplementCents: number;
  };
  masseRemplissageKgParM2: Partial<Record<Materiau, number>>;
  masseCadreKgParMetre: Partial<Record<Materiau, number>>;
  /**
   * Au-delà de cet effort de vent, l'écran le DIT et propose l'ajouré. Ce
   * n'est pas un refus : un client qui veut du plein en bord de mer a le
   * droit, s'il sait ce qu'il paie en piliers.
   */
  seuilPriseAuVentDaN: number;
  /**
   * Les coffres de volet roulant. `exterieur` est à 1000 millièmes : c'est
   * le volet de rénovation, le seul que ce catalogue vendait, et une
   * configuration muette continue de le payer au centime près.
   */
  coffres: Record<TypeCoffre, { label: string; coefMilliemes: number; argument?: string }>;
  /**
   * Les manœuvres manuelles. La sangle est la référence à 1000 millièmes.
   *
   * L'ARGUMENT EST FACULTATIF DEPUIS LE LOT D25, ici comme pour les coffres :
   * la pédagogie du catalogue PAR DÉFAUT vit dans
   * `arguments-de-fermeture.ts`, un module que seul l'écran des fermetures —
   * paresseux — importe. Elle pesait 289 octets gzippés du chargement
   * initial, payés par tout visiteur venu configurer une fenêtre. Ce qui
   * reste ici est la POSSIBILITÉ d'en écrire une : un marchand qui déclare
   * son propre coffre la remplit, et l'écran la préfère à la nôtre.
   */
  manoeuvres: Record<ManoeuvreVolet, { label: string; coefMilliemes: number; argument?: string }>;
  /**
   * Les formes vendues. Le rectangle y figure à 1000 millièmes : c'est le
   * défaut, et une configuration muette paie ce qu'elle payait avant.
   */
  formes: FormeDef[];
  /**
   * Les familles pour lesquelles la question de la pose se pose. Un volet
   * roulant ou un store se posent aussi, mais pas selon ces quatre modes.
   */
  famillesAvecPose: FamilleId[];
  /**
   * LES RÈGLES D'OR de la prise de cotes, quand le marchand veut les
   * SIENNES. Absentes — et elles le sont dans le catalogue par défaut —
   * celles du paquet s'appliquent (`export/guide.ts`).
   *
   * Pourquoi elles ne sont PAS livrées ici : ce catalogue est chargé au
   * premier octet, parce que le PRIX en dépend. Trois phrases de conseil de
   * chantier n'ont rien à y faire, et le budget l'a dit tout seul — les
   * ajouter a fait passer le chargement initial de 94,0 à 94,4 ko. Elles
   * voyagent donc avec le guide, qui est paresseux.
   *
   * Elles restent des DONNÉES, jamais du code : le plan l'exige nommément
   * (« les textes du guide vivent comme contenus traduisibles, pas dans le
   * code du widget », docs/11 lot 7), et elles ne sont pas universelles —
   * le rejingot est une pièce du bâti français.
   */
  guideCotes?: { regles: string[] };
  options: OptionDef[];
  /** Paliers de remise quantité, en millièmes du total (30 = −3 %). */
  remisesQuantite: Array<{ quantiteMin: number; milliemes: number }>;
  /** Supplément ferrures renforcées, en millièmes de la base corrigée. */
  ferruresRenforceesMilliemes: number;
  /** Renfort de coulisse (coulissants) au-delà d'une largeur — au mètre. */
  renfortCoulisse: { auDelaDeMm: number; centsParMetre: number };
  frameBandMm: Record<Materiau, number>;
  /**
   * Les profilés en COUPE — ce qui donne au volume sa troisième dimension
   * et à la coupe technique son dessin. `epaisseurMm` est la profondeur du
   * dormant ; `chambres` vaut 0 là où la notion n'a pas de sens (bois
   * massif, mixte), et le dessin de coupe le dit alors autrement.
   */
  profils: {
    epaisseurMm: Record<Materiau, Record<Gamme, number>>;
    chambres: Record<Materiau, Record<Gamme, number>>;
    ruptureThermique: Record<Materiau, boolean>;
  };
  verre: {
    /** Épaisseur de VERRE cumulée — ce qui pèse (4/16/4 → 8 mm). */
    epaisseurMm: Record<VitrageBase, number>;
    /**
     * L'épaisseur des LAMES D'AIR, cumulée. Un 4/16/4 fait 8 mm de verre
     * ET 16 mm de vide : vingt-quatre au total, et c'est cette cote-là que
     * la feuillure reçoit, que la parclose pince et que la coupe dessine.
     *
     * Elle manquait, et la 3D modélisait donc un double vitrage comme une
     * plaque de 8 mm : trois fois trop mince. On n'y voyait ni les deux
     * verres, ni l'intercalaire entre eux — c'est-à-dire rien de ce qui
     * fait reconnaître un vitrage isolant (docs/18 §3.2, G5). Elle est
     * séparée du verre parce que le vide ne pèse rien : le poids, lui,
     * continue de ne compter que les faces.
     */
    lameAirMm: Record<VitrageBase, number>;
    phoniqueSupplementMm: number;
    feuilleteSupplementMm: number;
    kgParM2ParMm: number;
    /**
     * Ce que le store intégré ajoute à l'épaisseur du vitrage. Un store
     * vénitien ne se glisse pas dans une lame d'air de 16 mm : il lui faut
     * 20 à 27 mm pour que les lames tournent sans toucher le verre.
     */
    storeIntegreSupplementMm: number;
    /** Le poids du store lui-même — lames d'aluminium, rails, commande. */
    storeIntegreKgParM2: number;
  };
  /**
   * LA MASSE LINÉIQUE DES PROFILÉS, en kg par mètre de barre, renfort
   * compris. Elle sert au poids du VANTAIL — verre plus cadre plus
   * ferrure — qui est celui que les abaques de ferrure comparent.
   *
   * Elle manquait, et le poids ne comptait donc que le verre : sur un
   * vantail de porte-fenêtre, le cadre et sa ferrure pèsent huit à quinze
   * kilos de plus, assez pour changer de classe de ferrure. Sous-estimer
   * ce poids n'est pas une imprécision d'affichage, c'est une faute de
   * sécurité (docs/13 §3.1).
   */
  masseLineiqueKgParM: Record<Materiau, number>;
  /** Ce que la ferrure d'un vantail ajoute, forfaitairement. */
  ferrureKgParVantail: number;
  thermique: {
    ufParMateriau: Record<Materiau, Record<Gamme, number>>;
    ugParVitrage: Record<VitrageBase, number>;
    /**
     * Le FACTEUR SOLAIRE du vitrage seul (g). MaPrimeRénov' pose un
     * critère DOUBLE — `Uw ≤ 1,3` ET `Sw ≥ 0,30` — et le second n'était
     * calculé nulle part : une menuiserie pouvait être annoncée éligible
     * sur son seul Uw alors qu'un triple vitrage à contrôle solaire rate
     * le Sw. C'est un litige, pas une imprécision (docs/13 §5).
     */
    gParVitrage: Record<VitrageBase, number>;
    /** La transmission LUMINEUSE du vitrage seul (TL). */
    tlParVitrage: Record<VitrageBase, number>;
    /** Ce qu'un vitrage à contrôle solaire retire au facteur solaire. */
    controleSolaireFacteur: number;
    psiParVitrage: Record<VitrageBase, number>;
    /**
     * Le ψ d'un intercalaire à BORD CHAUD. Il remplace celui de la base —
     * il ne s'y ajoute pas : c'est le même intercalaire, fait d'une autre
     * matière. Valeur du métier : 0,03 à 0,05 contre 0,06 à 0,08 pour
     * l'aluminium (compétence `thermique-uw` §2).
     */
    psiWarmEdge: number;
  };
  /** Allège sous ce seuil → feuilleté 44.2 imposé (fenêtres) — docs/02 §3.3. */
  feuilleteImposeAllegeSousMm: number;
}

export const DEFAULT_CATALOG: PricingCatalog = {
  version: '2026.08-reference',
  // Vide à la construction, et c'est le sujet du lot 0.2 : les familles
  // arrivent par leur MODULE (`familles/registre.ts`), chacun dans son
  // propre morceau téléchargé à la demande. Un catalogue qui embarquerait
  // ses sept familles ferait payer le store banne au visiteur venu pour une
  //
  // Conséquence assumée : `DEFAULT_CATALOG` se REMPLIT à l'exécution. C'est
  // le prix d'un cœur qui reste entièrement SYNCHRONE — `computePrice()`,
  // `validateConfiguration()` et `computeElevation()` n'ont pas changé d'une
  // ligne, et les 41 golden configs les rejouent à l'identique.
  // Le `as` est la seule entorse de tout ce lot, et elle est ici, seule,
  // documentée : à la construction la table est vide, et elle ne le reste
  // pas. La discipline qui la rend sûre est `familleCatalog()`.
  familles: {} as Record<FamilleId, FamilleCatalog>,
  coefGammeMilliemes: { standard: 1000, confort: 1150, performance: 1320 },
  coefVitrageMilliemes: { double: 1000, 'double-itr': 1060, triple: 1220 },
  coefPhoniqueMilliemes: 1150,
  coefFeuilleteMilliemes: 1180,
  coefAspectVitrageMilliemes: { clair: 1000, depoli: 1080, sable: 1160, serigraphie: 1240 },
  coefStoreIntegreMilliemes: 1550,
  coefWarmEdgeMilliemes: 1040,
  coefCouleurMilliemes: { blanc: 1000, plaxe: 1120, 'ral-1-face': 1150, bicolore: 1250 },
  coefRemplissagePorteMilliemes: { pleine: 1000, 'semi-vitree': 1120, vitree: 1220 },
  systemes: [
    // PVC — l'épaisseur et le nombre de chambres font l'isolation.
    { id: 'pvc-70-5', nom: 'PVC 70 — 5 chambres', materiau: 'pvc', gamme: 'standard', epaisseurMm: 70, chambres: 5, ruptureThermique: false, uf: 1.4, argument: 'Le standard du marché, blanc ou plaxé.' },
    { id: 'pvc-76-6', nom: 'PVC 76 — 6 chambres', materiau: 'pvc', gamme: 'confort', epaisseurMm: 76, chambres: 6, ruptureThermique: false, uf: 1.3, argument: 'Un joint de plus, une chambre de plus.' },
    { id: 'pvc-82-7', nom: 'PVC 82 — 7 chambres', materiau: 'pvc', gamme: 'performance', epaisseurMm: 82, chambres: 7, ruptureThermique: false, uf: 1.1, argument: 'Pour viser le triple vitrage et les aides.' },
    { id: 'pvc-86-8', nom: 'PVC 86 — 8 chambres, joint central', materiau: 'pvc', gamme: 'performance', epaisseurMm: 86, chambres: 8, ruptureThermique: false, uf: 1.0, coefMilliemes: 1420, argument: 'Le haut de gamme PVC : trois joints, 8 chambres.' },
    // Aluminium — la rupture de pont thermique fait tout.
    { id: 'alu-55-rpt', nom: 'Alu 55 à rupture', materiau: 'alu', gamme: 'standard', epaisseurMm: 55, chambres: 3, ruptureThermique: true, uf: 2.2, argument: 'Lignes fines, grandes dimensions.' },
    { id: 'alu-65-rpt', nom: 'Alu 65 à rupture renforcée', materiau: 'alu', gamme: 'confort', epaisseurMm: 65, chambres: 4, ruptureThermique: true, uf: 1.8 },
    { id: 'alu-75-rpt', nom: 'Alu 75 haute isolation', materiau: 'alu', gamme: 'performance', epaisseurMm: 75, chambres: 5, ruptureThermique: true, uf: 1.5 },
    { id: 'alu-90-grand', nom: 'Alu 90 grandes dimensions', materiau: 'alu', gamme: 'performance', epaisseurMm: 90, chambres: 5, ruptureThermique: true, uf: 1.6, coefMilliemes: 1560, argument: 'Pour les baies hors normes, vantaux lourds.' },
    // Bois et mixte — le massif ne se compte pas en chambres.
    { id: 'bois-68', nom: 'Chêne 68', materiau: 'bois', gamme: 'standard', epaisseurMm: 68, chambres: 0, ruptureThermique: false, uf: 1.6 },
    { id: 'bois-78', nom: 'Chêne 78 lamellé', materiau: 'bois', gamme: 'confort', epaisseurMm: 78, chambres: 0, ruptureThermique: false, uf: 1.5 },
    { id: 'bois-92', nom: 'Chêne 92 lamellé collé', materiau: 'bois', gamme: 'performance', epaisseurMm: 92, chambres: 0, ruptureThermique: false, uf: 1.3 },
    { id: 'mixte-70', nom: 'Mixte bois-alu 70', materiau: 'mixte', gamme: 'standard', epaisseurMm: 70, chambres: 0, ruptureThermique: true, uf: 1.6, argument: 'Le bois dedans, l’aluminium dehors.' },
    { id: 'mixte-80', nom: 'Mixte bois-alu 80', materiau: 'mixte', gamme: 'confort', epaisseurMm: 80, chambres: 0, ruptureThermique: true, uf: 1.4 },
    { id: 'mixte-90', nom: 'Mixte bois-alu 90', materiau: 'mixte', gamme: 'performance', epaisseurMm: 90, chambres: 0, ruptureThermique: true, uf: 1.2 },
  ],
  // Les quatre poses. Les lignes de mesure sont celles de la compétence
  // `prise-de-cotes` §1 — recopiées, pas réécrites : le guide affiché au
  // client et la donnée qui le tarife ne peuvent pas se contredire.
  poses: {
    'neuf-tableau': {
      id: 'neuf-tableau',
      label: 'Neuf en tableau',
      coefMilliemes: 1000,
      recouvrementMm: 0,
      ouvrantExistantMm: 0,
      couvreJointCentsParMetre: 0,
      bavetteCentsParMetre: 0,
      tapee: false,
      mesureLargeur:
        'Le tableau fini, au plus étroit des trois mesures, jeu de pose déduit (≈ 10 mm).',
      mesureHauteur:
        'Du rejingot au linteau, au plus court des trois mesures, jeu de pose déduit.',
      argument: 'La pose de référence : la menuiserie se loge dans la maçonnerie nue.',
    },
    applique: {
      id: 'applique',
      label: 'Neuf en applique',
      coefMilliemes: 1000,
      recouvrementMm: 0,
      ouvrantExistantMm: 0,
      couvreJointCentsParMetre: 0,
      bavetteCentsParMetre: 0,
      tapee: true,
      mesureLargeur: 'Le tableau, plus le recouvrement du doublage de chaque côté.',
      mesureHauteur: 'Du sol fini (ou du rejingot) au linteau, recouvrement haut compris.',
      argument:
        "Le dormant se plaque sur le doublage isolant ; la tapée rattrape son épaisseur.",
    },
    renovation: {
      id: 'renovation',
      label: 'Rénovation',
      // Le seul coefficient qui ne vaut pas 1000 : le dormant de rénovation
      // est un AUTRE profilé — plus de matière, une aile de recouvrement, un
      // usinage de plus. Cela se fabrique, donc cela se facture.
      coefMilliemes: 1050,
      recouvrementMm: 50,
      ouvrantExistantMm: 55,
      couvreJointCentsParMetre: 1150,
      bavetteCentsParMetre: 2450,
      tapee: false,
      mesureLargeur: "D’un intérieur de dormant existant à l’autre, au plus étroit.",
      mesureHauteur:
        "Du dessus de la pièce d’appui existante au dormant haut, au plus court.",
      argument: "L’ancien dormant reste en place ; le neuf vient s’y loger et le coiffe.",
    },
    'depose-totale': {
      id: 'depose-totale',
      label: 'Dépose totale',
      coefMilliemes: 1000,
      recouvrementMm: 0,
      ouvrantExistantMm: 0,
      couvreJointCentsParMetre: 0,
      bavetteCentsParMetre: 2450,
      tapee: false,
      mesureLargeur: 'Le tableau après dépose — prévoir la reprise de maçonnerie.',
      mesureHauteur: "Du rejingot au linteau, après dépose de l’ancien dormant.",
      argument:
        "On retire tout jusqu’à la maçonnerie : le clair de jour d’origine est retrouvé.",
    },
  },
  // Les épaisseurs de doublage courantes en France. La tapée est facturée au
  // mètre de périmètre : elle fait le tour du dormant.
  tapees: [
    { epaisseurMm: 100, centsParMetre: 1450 },
    { epaisseurMm: 120, centsParMetre: 1620 },
    { epaisseurMm: 140, centsParMetre: 1790 },
    { epaisseurMm: 160, centsParMetre: 1960 },
  ],
  famillesAvecPose: ['fenetre', 'porte-fenetre', 'coulissant', 'porte-entree'],
  // Les formes. Les coefficients disent le VRAI coût d'atelier : le
  // cintrage passe à la cintreuse, se contrôle au gabarit et se rebute ;
  // le rampant et le triangle ne demandent que des coupes biaises.
  formes: [
    {
      id: 'rectangle',
      label: 'Rectangulaire',
      coefMilliemes: 1000,
      familles: ['fenetre', 'porte-fenetre', 'coulissant', 'porte-entree', 'volet-roulant', 'volet-battant', 'store-banne', 'portail-battant', 'portail-coulissant', 'portillon'],
      argument: 'La forme de référence — quatre coupes d’onglet à 45°.',
    },
    {
      id: 'trapeze',
      label: 'Trapèze (rampant)',
      coefMilliemes: 1180,
      familles: ['fenetre', 'porte-fenetre', 'portail-battant', 'portail-coulissant', 'portillon'],
      ouvertures: ['frappe', 'fixe'],
      argument: 'Le comble aménagé : le haut suit la pente du toit.',
    },
    {
      id: 'triangle',
      label: 'Triangle (pignon)',
      coefMilliemes: 1220,
      familles: ['fenetre'],
      ouvertures: ['fixe'],
      argument: 'La pointe du pignon. Fixe : aucune ferrure ne tient une pointe.',
    },
    {
      id: 'surbaisse',
      label: 'Cintre surbaissé',
      coefMilliemes: 1520,
      familles: ['fenetre', 'porte-fenetre', 'porte-entree', 'portail-battant', 'portail-coulissant', 'portillon'],
      ouvertures: ['frappe', 'fixe'],
      argument: 'L’arc doux — la montée se règle, du presque droit au demi-cercle.',
    },
    {
      id: 'anse-de-panier',
      label: 'Anse de panier',
      coefMilliemes: 1620,
      familles: ['fenetre', 'porte-fenetre', 'porte-entree'],
      ouvertures: ['frappe', 'fixe'],
      argument: 'Le tracé à trois centres du bâti ancien — deux rayons, jamais une ellipse.',
    },
    {
      id: 'plein-cintre',
      label: 'Plein cintre',
      coefMilliemes: 1580,
      familles: ['fenetre', 'porte-fenetre', 'porte-entree'],
      ouvertures: ['frappe', 'fixe'],
      argument: 'Le demi-cercle parfait : la montée vaut la demi-largeur.',
    },
    {
      id: 'rond',
      label: 'Œil-de-bœuf',
      coefMilliemes: 1650,
      familles: ['fenetre'],
      ouvertures: ['fixe'],
      argument: 'Un développé sans montant ni traverse — un seul cintrage, fermé sur lui-même.',
    },
    {
      id: 'ovale',
      label: 'Ovale',
      coefMilliemes: 1780,
      familles: ['fenetre'],
      ouvertures: ['fixe'],
      argument: 'Le rayon change tout le long : c’est le cintrage le plus délicat.',
    },
  ],
  // Les modèles de porte. Ils décorent la partie PLEINE ; le vitrage reste
  // commandé par `remplissagePorte`. Aucun nom de marque, pour la même
  // raison que les gammes de profilés : ce sont les catalogues du
  // fournisseur qui font foi, et ils changent chaque millésime.
  coffres: {
    // LEURS ARGUMENTS SONT PARTIS AU LOT D25, dans
    // `arguments-de-fermeture.ts`, et c'est une MESURE qui l'a demandé :
    // ces cinq chaînes ne se lisent que dans `EtapesFermetures.tsx`, un
    // morceau PARESSEUX, et elles pesaient **289 octets gzippés du
    // chargement initial** — payés par tout visiteur venu configurer une
    // fenêtre. Le champ reste FACULTATIF au contrat : un marchand qui
    // déclare son propre coffre écrit son argument avec, et l'écran le
    // préfère au nôtre.
    exterieur: { label: 'Coffre extérieur', coefMilliemes: 1000 },
    tunnel: { label: 'Coffre tunnel', coefMilliemes: 1060 },
    'bloc-baie': { label: 'Bloc-baie', coefMilliemes: 1180 },
  },
  manoeuvres: {
    sangle: { label: 'Sangle', coefMilliemes: 1000 },
    manivelle: { label: 'Manivelle', coefMilliemes: 1035 },
  },
  modelesPortail: [],
  ouverturesDeclarees: [],
  moteurs: [],
  securites: [],
  coefAlimentationMilliemes: { filaire: 1000, solaire: 1340 },
  pressionVentPa: { abritee: 400, normale: 700, exposee: 1100 },
  cloture: {
    entraxePoteauxMm: 2000,
    sectionPoteauMm: 80,
    epaisseurPanneauMm: 40,
    massifLitres: 55,
    semelleLitresParMetre: 48,
    poteauCents: 6800,
    poteauAngleSupplementCents: 2200,
  },
  masseRemplissageKgParM2: { alu: 15, pvc: 13, bois: 26 },
  masseCadreKgParMetre: { alu: 2.6, pvc: 2.2, bois: 4.2 },
  seuilPriseAuVentDaN: 200,
  modelesVolet: [],
  /**
   * Les modeles de porte d'entree. VIDE a la construction : ils arrivent
   * avec le module du groupe `vitrees`, qui vend la porte d'entree.
   */
  modelesPorte: [],
  options: [
    { id: 'oscillo-battant', label: 'Oscillo-battant', amountCents: 6200, unite: 'parVantail', familles: ['fenetre', 'porte-fenetre'] },
    { id: 'poignee-cle', label: 'Poignée à clé', amountCents: 2800, unite: 'parMenuiserie', familles: ['fenetre', 'porte-fenetre', 'coulissant'] },
    { id: 'grille-ventilation', label: 'Grille de ventilation', amountCents: 2400, unite: 'parMenuiserie', familles: ['fenetre', 'porte-fenetre'] },
    { id: 'petits-bois', label: 'Petits-bois intégrés', amountCents: 1800, unite: 'parVantail', familles: ['fenetre', 'porte-fenetre'] },
    { id: 'moustiquaire', label: 'Moustiquaire intégrée', amountCents: 9500, unite: 'parMenuiserie', familles: ['fenetre', 'porte-fenetre', 'coulissant'] },
    { id: 'bloc-baie-manuel', label: 'Volet roulant bloc-baie manuel', amountCents: 26000, unite: 'parMenuiserie', familles: ['fenetre', 'porte-fenetre'] },
    { id: 'motorisation-filaire', label: 'Motorisation filaire', amountCents: 14800, unite: 'parMenuiserie', familles: ['volet-roulant', 'store-banne', 'fenetre', 'porte-fenetre'] },
    { id: 'motorisation-radio', label: 'Motorisation radio io + télécommande', amountCents: 26200, unite: 'parMenuiserie', familles: ['volet-roulant', 'store-banne', 'fenetre', 'porte-fenetre'] },
    { id: 'motorisation-solaire', label: 'Motorisation solaire', amountCents: 38800, unite: 'parMenuiserie', familles: ['volet-roulant', 'store-banne', 'fenetre', 'porte-fenetre'] },
    { id: 'seuil-pmr', label: 'Seuil PMR 20 mm', amountCents: 5500, unite: 'parMenuiserie', familles: ['porte-entree', 'porte-fenetre'] },
    { id: 'serrure-a2p', label: 'Serrure multipoints A2P*', amountCents: 19000, unite: 'parMenuiserie', familles: ['porte-entree'] },
    // `capteur-vent` a rejoint `familles/fermetures/` : seul le store banne
    // le vend, et un groupe apporte les options que lui seul vend.
    // La grille de défense : un cadre d'acier et ses barreaux, scellé dans
    // le tableau. Elle se pose sur toute baie accessible — rez-de-chaussée,
    // sous-sol, porte de service — et se chiffre au cadre, pas au vantail.
    { id: 'grille-defense', label: 'Grille de défense — barreaux droits', amountCents: 21000, unite: 'parMenuiserie', familles: ['fenetre', 'porte-fenetre', 'porte-entree', 'coulissant'] },
    { id: 'grille-horizontale', label: 'Grille de défense — barreaudage horizontal', amountCents: 22500, unite: 'parMenuiserie', familles: ['fenetre', 'porte-fenetre', 'porte-entree', 'coulissant'] },
    { id: 'grille-croisillons', label: 'Grille de défense — croisillons soudés', amountCents: 26500, unite: 'parMenuiserie', familles: ['fenetre', 'porte-fenetre', 'porte-entree', 'coulissant'] },
    // Les accessoires d'une porte d'entrée. Ils étaient absents alors que
    // c'est par eux qu'une porte se reconnaît de la rue — et qu'on lui
    // remet le courrier.
    // UN ID D'OPTION EST UNIQUE, DONC SES FAMILLES SONT COMPLÈTES ICI — et
    // c'est le lot O1 qui l'a mesuré, en cherchant pourquoi
    // `options-vues-en-3d.test.ts` basculait d'une exécution à l'autre.
    //
    // `registre.ts` pousse une option d'un module de groupe SEULEMENT si son
    // id est inconnu : « le premier arrivé gagne ». Ces trois-là étaient
    // déclarées DEUX FOIS — ici pour la porte d'entrée, et dans
    //
    // nommée sans la trouver, et elle n'avait rien à voir avec la 3D.
    //
    // C'ÉTAIT UNE OPTION DE TROP. Celle-ci était déjà déclarée ici pour la
    // le champ : le couple était MUET. Il l'est pour une bonne raison. Trois
    // sa raison d'être — sa profondeur de 300 mm est DÉRIVÉE d'elle (« une
    // plaque de 43 mm ne reçoit aucune boîte aux lettres »), sa matrice est
    // à la pièce parce qu'« une boîte aux lettres ne se facture pas au mètre
    // La facturer à 145 € par-dessus serait la vendre deux fois — la faute du
    // lot D17 dans le sens de l'argent. L'option reste ce que son libellé
    // dit : une boîte INTÉGRÉE AU VANTAIL d'une porte d'entrée, qui est un
    // autre objet.
    { id: 'boite-aux-lettres', label: 'Boîte aux lettres intégrée', amountCents: 14500, unite: 'parMenuiserie', familles: ['porte-entree'] },
    { id: 'interphone', label: 'Interphone deux fils', amountCents: 19500, unite: 'parMenuiserie', familles: ['portail-battant', 'portail-coulissant', 'portillon', 'totem'] },
    { id: 'visiophone', label: 'Visiophone couleur', amountCents: 38000, unite: 'parMenuiserie', familles: ['portail-battant', 'portail-coulissant', 'portillon', 'totem'] },
    { id: 'judas', label: 'Judas optique grand angle', amountCents: 4500, unite: 'parMenuiserie', familles: ['porte-entree'] },
    { id: 'heurtoir', label: 'Heurtoir en fonte', amountCents: 6800, unite: 'parMenuiserie', familles: ['porte-entree'] },
    { id: 'soubassement-inox', label: 'Soubassement inox brossé', amountCents: 11500, unite: 'parMenuiserie', familles: ['porte-entree'] },
    { id: 'grille-ouvragee', label: 'Grille de défense — barreaux ouvragés à volutes', amountCents: 34000, unite: 'parMenuiserie', familles: ['fenetre', 'porte-fenetre', 'porte-entree', 'coulissant'] },
  ],
  remisesQuantite: [
    { quantiteMin: 3, milliemes: 30 },
    { quantiteMin: 5, milliemes: 50 },
    { quantiteMin: 10, milliemes: 80 },
  ],
  ferruresRenforceesMilliemes: 120,
  renfortCoulisse: { auDelaDeMm: 3000, centsParMetre: 2400 },
  // La bande forfaitaire reste le modèle des familles à CADRE PLEIN
  // unique le décrit exactement, et ces valeurs sont celles qu'elles ont
  // toujours eues. Les familles VITRÉES, elles, passent désormais par
  // `deductions` — elles le disent en déclarant ce champ.
  frameBandMm: { pvc: 115, alu: 95, bois: 110, mixte: 105 },
  profils: {
    epaisseurMm: {
      pvc: { standard: 70, confort: 76, performance: 82 },
      alu: { standard: 55, confort: 65, performance: 75 },
      bois: { standard: 68, confort: 78, performance: 92 },
      mixte: { standard: 70, confort: 80, performance: 90 },
    },
    chambres: {
      pvc: { standard: 5, confort: 6, performance: 7 },
      alu: { standard: 3, confort: 4, performance: 5 },
      bois: { standard: 0, confort: 0, performance: 0 },
      mixte: { standard: 0, confort: 0, performance: 0 },
    },
    ruptureThermique: { pvc: false, alu: true, bois: false, mixte: true },
  },
  verre: {
    epaisseurMm: { double: 8, 'double-itr': 8, triple: 12 },
    // 4/16/4 → 24 mm hors tout ; 4/16/4/16/4 → 44 mm, la limite des
    // parcloses du commerce.
    lameAirMm: { double: 16, 'double-itr': 16, triple: 32 },
    phoniqueSupplementMm: 6, // 4/16/4 → 10/16/4
    feuilleteSupplementMm: 4.8, // un 4 mm devient 44.2 (8,8 mm)
    kgParM2ParMm: 2.5,
    storeIntegreSupplementMm: 12,
    storeIntegreKgParM2: 2.4,
  },
  // PVC 70 renforcé ≈ 2,4 kg/m ; l'aluminium à rupture est plus dense mais
  // plus mince ; le chêne lamellé pèse son bois.
  masseLineiqueKgParM: { pvc: 2.4, alu: 2.1, bois: 3.2, mixte: 3.6 },
  ferrureKgParVantail: 1.8,
  thermique: {
    ufParMateriau: {
      pvc: { standard: 1.4, confort: 1.3, performance: 1.1 },
      alu: { standard: 2.2, confort: 1.8, performance: 1.5 },
      bois: { standard: 1.6, confort: 1.5, performance: 1.3 },
      mixte: { standard: 1.6, confort: 1.4, performance: 1.2 },
    },
    ugParVitrage: { double: 1.1, 'double-itr': 1.0, triple: 0.6 },
    // Valeurs de `ressources/donnees/physique-et-normes.json` : un double
    // bas-émissif laisse entrer 60 % de l'énergie solaire, un triple 50 %.
    // C'est ce qui se vend en hiver et se subit en été.
    gParVitrage: { double: 0.76, 'double-itr': 0.6, triple: 0.5 },
    tlParVitrage: { double: 0.81, 'double-itr': 0.8, triple: 0.7 },
    controleSolaireFacteur: 0.5,
    psiParVitrage: { double: 0.06, 'double-itr': 0.05, triple: 0.05 },
    psiWarmEdge: 0.035,
  },
  feuilleteImposeAllegeSousMm: 900,
};

/** Le catalogue d'une famille — lève si la famille est inconnue. */
export function familleCatalog(catalog: PricingCatalog, famille: FamilleId): FamilleCatalog {
  const fam = catalog.familles[famille];
  if (!fam) throw new Error(`Famille inconnue du catalogue : ${famille}`);
  return fam;
}

/**
 * La matrice pour un nombre de vantaux — à défaut, la plus proche : le prix
 * reste défini même quand la validation refuse le nombre de vantaux.
 */
export function matricePourVantaux(fam: FamilleCatalog, vantaux: number): PriceMatrix {
  // UNE FAMILLE À LA PIÈCE N'EN A PAS, et l'appeler ici est une faute
  // d'aiguillage — pas une donnée manquante. Rendre une matrice vide aurait
  // laissé le prix continuer sur une cellule à zéro : le silence exact que
  // ce lot existe pour supprimer.
  if (!fam.matrices) {
    throw new Error(
      `« ${fam.label} » se vend à la pièce : pas de matrice. Son prix est une somme de postes ` +
        'déclarés, et ses bornes sont celles de la fabrication.',
    );
  }
  const exacte = fam.matrices[String(vantaux)];
  if (exacte) return exacte;
  const cles = Object.keys(fam.matrices).map(Number).sort((a, b) => a - b);
  let proche = cles[0];
  for (const cle of cles) {
    if (Math.abs(cle - vantaux) < Math.abs(proche - vantaux)) proche = cle;
  }
  return fam.matrices[String(proche)];
}

/** Vrai pour les ouvrages dont le prix est une somme de postes déclarés. */
export function estALaPiece(catalog: PricingCatalog, famille: FamilleId): boolean {
  return catalog.familles[famille]?.unitePrix === 'piece';
}

/**
 * La gamme nommée d'une configuration — undefined si aucune n'est choisie,
 * ou si celle qui est demandée n'existe pas au catalogue. L'appelant
 * retombe alors sur les tables par matériau × palier, exactement comme
 * avant l'arrivée des gammes nommées.
 */
export function systemeDe(
  catalog: PricingCatalog,
  id: string | undefined,
): SystemeProfile | undefined {
  if (!id) return undefined;
  return catalog.systemes.find((systeme) => systeme.id === id);
}

/**
 * LES DÉDUCTIONS retenues pour une configuration : celles du matériau, que
 * la famille peut surcharger. Un coulissant remplace ainsi son battement
 * par une chicane, sans que le reste du catalogue le sache.
 *
 * Solution écartée : exiger que chaque famille les déclare. Une famille
 * qui les oublie aurait rendu un dessin faux et muet ; ici elle hérite du
 * matériau, et n'écrit que ce qui la distingue.
 */
export function deductionsDe(
  catalog: PricingCatalog,
  famille: FamilleId,
  materiau: Materiau,
): DeductionsGamme | undefined {
  return catalog.familles[famille]?.deductions?.[materiau];
}

/**
 * La masse vue par côté — ce que le dormant et l'ouvrant retirent ENSEMBLE
 * au clair, sur un bord. C'est l'ancienne « bande de profil », désormais
 * calculée depuis la chaîne de cotes au lieu d'être forfaitaire. Le repli
 * sur `frameBandMm` sert les familles à cadre plein, qui n'ont pas de
 * déductions parce que la notion n'a pas de sens chez elles.
 */
export function masseVueMm(
  catalog: PricingCatalog,
  famille: FamilleId,
  materiau: Materiau,
  pose?: { recouvrementMm: number },
): number {
  const d = deductionsDe(catalog, famille, materiau);
  if (!d) {
    const fam = catalog.familles[famille];
    return fam?.frameBandMm?.[materiau] ?? catalog.frameBandMm[materiau] ?? 110;
  }
  // La RÉNOVATION mange moins : le dormant qui se loge dans l'ancien est
  // plus mince que le dormant neuf. Deux millimètres par côté, quatre sur
  // la cote — l'écart que toutes les fiches fournisseurs portent.
  const reno = pose && pose.recouvrementMm > 0 ? d.renovationEcartMm : 0;
  return Math.max(0, d.dormantVuMm + d.ouvrantVuMm - reno);
}


export function systemesDuMateriau(
  catalog: PricingCatalog,
  famille: FamilleId,
  materiau: Materiau,
): SystemeProfile[] {
  if (!deductionsDe(catalog, famille, materiau)) return [];
  return catalog.systemes.filter((systeme) => systeme.materiau === materiau);
}

/** L'option du catalogue portant cet id — undefined si inconnue. */
export function optionDef(catalog: PricingCatalog, id: string): OptionDef | undefined {
  return catalog.options.find((option) => option.id === id);
}

/**
 * La pose d'une configuration — `neuf-tableau` par défaut. C'est CE défaut
 * qui rend la notion additive : une configuration muette paie ce qu'elle
 * payait avant, au centime, et les 41 golden configs ne bougent pas.
 */
export function poseDe(catalog: PricingCatalog, pose: Pose | undefined): PoseDef {
  return catalog.poses[pose ?? 'neuf-tableau'] ?? catalog.poses['neuf-tableau'];
}

/** La question de la pose se pose-t-elle pour cette famille ? */
export function poseApplicable(catalog: PricingCatalog, famille: FamilleId): boolean {
  return catalog.famillesAvecPose.includes(famille);
}

/**
 * La pose EFFECTIVE d'une configuration : celle qu'elle demande si sa
 * famille connaît la question, la référence sinon. Une seule fonction, parce
 * que le prix et le rapport de mesure doivent répondre la même chose — un
 * volet roulant déclaré « en rénovation » ne doit pas être facturé selon un
 * dormant qu'il n'a pas.
 */
export function posePourFamille(
  catalog: PricingCatalog,
  famille: FamilleId,
  pose: Pose | undefined,
): PoseDef {
  return poseApplicable(catalog, famille) ? poseDe(catalog, pose) : catalog.poses['neuf-tableau'];
}

/** La tapée du catalogue à cette épaisseur — undefined si elle n'existe pas. */
export function tapeeDe(catalog: PricingCatalog, mm: number | undefined): TapeeDef | undefined {
  if (mm === undefined) return undefined;
  return catalog.tapees.find((tapee) => tapee.epaisseurMm === mm);
}

/** L'épaisseur de tapée vendue la plus proche — pour l'alternative d'un refus. */
export function tapeeLaPlusProche(catalog: PricingCatalog, mm: number): TapeeDef {
  return catalog.tapees.reduce((proche, tapee) =>
    Math.abs(tapee.epaisseurMm - mm) < Math.abs(proche.epaisseurMm - mm) ? tapee : proche,
  );
}

/**
 * Le périmètre d'habillage (mm) : trois côtés, jamais l'appui. On ne pose
 * pas de couvre-joint sur la pièce d'appui — l'eau doit pouvoir s'en aller.
 */
export function perimetreHabillageMm(widthMm: number, heightMm: number): number {
  return widthMm + 2 * heightMm;
}

/**
 * Le modèle de porte d'une configuration — le panneau uni par défaut, et
 * lui aussi quand la famille n'est pas une porte : c'est ce défaut qui
 * garantit que rien ne bouge tant qu'aucun modèle n'est choisi.
 */
/**
 * Le modèle d'un volet battant. Sans modèle déclaré, on rend le PERSIENNÉ :
 * ce n'est pas un défaut arbitraire, c'est le seul volet que ce catalogue
 * ait jamais vendu, et le rendre explicite est ce qui garde le dessin et le
 * prix identiques à ce qu'ils étaient (docs/11 §2.2).
 *
 * Rend `undefined` hors du volet battant : un store banne n'a pas de
 * garnissage, et lui en prêter un ferait apparaître une ligne de prix que
 * rien ne justifie.
 */
/**
 * Le coffre d'un volet roulant, ou `undefined` ailleurs. Le défaut est le
 * coffre EXTÉRIEUR : c'est le seul que ce catalogue ait jamais dessiné, et
 * le nommer est ce qui garde le prix et le trait identiques (docs/11 §2.2).
 */
export function coffreDe(
  catalog: PricingCatalog,
  famille: FamilleId,
  coffre: TypeCoffre | undefined,
): TypeCoffre | undefined {
  if (famille !== 'volet-roulant') return undefined;
  return coffre && catalog.coffres[coffre] ? coffre : 'exterieur';
}

/** La manœuvre d'un volet roulant, ou `undefined` ailleurs. Défaut : sangle. */
export function manoeuvreDe(
  catalog: PricingCatalog,
  famille: FamilleId,
  manoeuvre: ManoeuvreVolet | undefined,
): ManoeuvreVolet | undefined {
  if (famille !== 'volet-roulant') return undefined;
  return manoeuvre && catalog.manoeuvres[manoeuvre] ? manoeuvre : 'sangle';
}

/** Le moteur choisi, s'il en existe un de ce type au catalogue. */
export function moteurDe(
  catalog: PricingCatalog,
  type: TypeMoteur | undefined,
): MoteurDef | undefined {
  return type ? catalog.moteurs.find((moteur) => moteur.id === type) : undefined;
}

/** Les moteurs qui savent mouvoir cette famille. */
export function aUneCoupeDeProfil(catalog: PricingCatalog, famille: FamilleId): boolean {
  return catalog.familles[famille]?.deductions !== undefined;
}

export function moteursDeLaFamille(catalog: PricingCatalog, famille: FamilleId): MoteurDef[] {
  return catalog.moteurs.filter((moteur) => moteur.familles.includes(famille));
}

export function modelePortailDe(
  catalog: PricingCatalog,
  famille: FamilleId,
  id: RemplissagePortail | undefined,
): ModelePortailDef | undefined {
  if (!estPortail(famille)) return undefined;
  return (
    catalog.modelesPortail.find((modele) => modele.id === id) ?? catalog.modelesPortail[0]
  );
}

/** Vrai pour les ouvrages qui se vendent au mètre courant. */
export function estLineaire(catalog: PricingCatalog, famille: FamilleId): boolean {
  return catalog.familles[famille]?.unitePrix === 'metre-lineaire';
}

export function estPortail(famille: FamilleId): boolean {
  return (
    famille === 'portail-battant' ||
    famille === 'portail-coulissant' ||
    famille === 'portillon'
  );
}

export function modeleVoletDe(
  catalog: PricingCatalog,
  famille: FamilleId,
  id: ModeleVolet | undefined,
): ModeleVoletDef | undefined {
  if (famille !== 'volet-battant') return undefined;
  return (
    catalog.modelesVolet.find((modele) => modele.id === id) ??
    catalog.modelesVolet.find((modele) => modele.decor.persiennePart === 1)
  );
}

export function modelePorteDe(
  catalog: PricingCatalog,
  famille: FamilleId,
  id: ModelePorte | undefined,
): ModelePorteDef | undefined {
  if (famille !== 'porte-entree' || !id) return undefined;
  return catalog.modelesPorte.find((modele) => modele.id === id);
}

/** La forme d'une configuration — le rectangle par défaut, toujours défini. */
export function formeDe(catalog: PricingCatalog, forme: Forme | undefined): FormeDef {
  const cherchee = catalog.formes.find((candidate) => candidate.id === (forme ?? 'rectangle'));
  return cherchee ?? catalog.formes[0];
}

/** Les formes proposées pour une famille, dans l'ordre du catalogue. */
export function formesDeLaFamille(catalog: PricingCatalog, famille: FamilleId): FormeDef[] {
  return catalog.formes.filter((forme) => forme.familles.includes(famille));
}
