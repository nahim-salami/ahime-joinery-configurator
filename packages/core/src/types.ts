/**
 * Pourquoi ce fichier existe : le vocabulaire commun du configurateur —
 * la configuration d'une menuiserie, le prix décomposé, le refus expliqué,
 * le rapport de mesure. Tout le reste du cœur (et plus tard le widget, le
 * plugin PHP, le dashboard) parle CE langage et aucun autre.
 *
 * Solution écartée : des types par module (un type « config » pour le prix,
 * un autre pour la validation). Chez les néons, la moindre divergence entre
 * deux copies d'un registre a toujours fini en bug de production — d'où la
 * règle : une seule définition, des tests qui comparent les copies.
 *
 * Incident fondateur : le champ `errorCount` du harnais de parité JS↔PHP des
 * néons compare le NOMBRE d'erreurs, jamais les messages — les libellés ont
 * le droit de différer entre langages, « la configuration passe ou non »
 * n'a pas ce droit. Les types ci-dessous séparent donc le code (stable,
 * comparé) du message (libre, traduit).
 */

import type { Forme as FormeMenuiserie } from './geometrie/formes.ts';
import type { PosteChoisi } from './prix-a-la-piece.ts';

/** Les sept familles de produits — docs/02 §1. */
export type FamilleId =
  | 'armoire'
  | 'banc-coffre'
  | 'buffet'
  | 'meuble-tv'
  | 'vitrine'
  /**
   * LES MENUISERIES D'INTÉRIEUR (lot D9), et leurs noms sont contraints.
   *
   * `galandage` est DÉJÀ une valeur d'`Ouverture` — celle d'une baie
   * coulissante qui rentre dans le mur. Deux noms qui se ressemblent ne sont
   * pas deux valeurs de la même chose (lot MT7a) : le suffixe dit de quel
   * métier on parle.
   *
   * LA VERRIÈRE D'ATELIER N'Y EST PAS, ET C'EST MESURÉ. Elle est en ACIER
   * SOUDÉ — son module du lot MT7b le dit sept fois — et le type `Materiau` ne
   * porte que pvc, alu, bois et mixte. Voir `familles/interieur.ts`.
   */
  | 'bloc-porte'
  | 'galandage-interieur'
  | 'commode'
  | 'fenetre'
  | 'porte-fenetre'
  | 'coulissant'
  | 'porte-entree'
  /**
   * LA FENÊTRE DE TOIT. Elle est vitrée comme une fenêtre, et c'est à peu
   * près tout ce qu'elles partagent : ses dimensions sont des CODES et non
   * des millimètres, elle se pose dans une PENTE, elle ne ferme pas sans
   * son RACCORD d'étanchéité, et son critère d'aide n'est pas le même.
   * Voir la liste de différences en tête de
   * `familles/vitrees/fenetre-toit.ts`.
   */
  | 'fenetre-toit'
  | 'volet-roulant'
  | 'volet-battant'
  | 'store-banne'
  /**
   * LA MOUSTIQUAIRE, en tant que PRODUIT. Elle reste aussi une option sur
   * une menuiserie neuve — ce n'est pas une redondance, c'est la différence
   * entre un accessoire coché avec le reste et un ouvrage qu'on mesure, qu'on
   * choisit et qu'on pose sur l'existant. Les deux moitiés du marché.
   */
  | 'moustiquaire'
  /**
   * LE STORE INTÉRIEUR. Il partage un mot avec le store BANNE et rien
   * d'autre : il est DEDANS. Pas de vent, pas de capteur, pas de bras, pas
   * d'avancée — toutes les règles du banne n'ont aucun sens ici. Voir sa
   * liste de différences en tête de `familles/fermetures/store-interieur.ts`.
   */
  | 'store-interieur'
  /**
   * LE BRISE-SOLEIL ORIENTABLE. Il est dehors comme le banne, et il NE SE
   * REPLIE PAS — c'est son argument et sa contrainte. Sa particularité n'a
   * d'équivalent nulle part ailleurs dans ce catalogue : SA CLASSE DE VENT
   * BAISSE QUAND SA LARGEUR MONTE, et au-delà d'une largeur il n'a plus de
   * classe du tout. Il relève d'EN 13659, pas d'EN 13561. Voir sa liste de
   * différences en tête de `familles/solaire/bso.ts`.
   */
  | 'bso'
  /**
   * LE SCREEN VERTICAL À COULISSES ZIP. Sa toile est un CONSOMMABLE EN
   * LAIZE : au-delà de la largeur du rouleau, il faut une couture, qui se
   * voit à contre-jour. Aucune autre famille de ce catalogue n'a de matière
   * dont la largeur borne le produit. Voir sa liste de différences en tête
   * de `familles/solaire/screen-zip.ts`.
   */
  | 'screen-zip'
  /**
   * LA PORTE DE GARAGE. Elle est rangée avec les fermetures parce que c'est
   * le même client et le même artisan — et elle ne leur ressemble en rien :
   * pas de vantaux mais des PANNEAUX déduits de la hauteur, pas de rotation
   * mais une translation puis une courbe, et une cote décisive qui n'est pas
   * la sienne mais celle du MUR (la retombée de linteau). Voir la liste de
   * différences en tête de `familles/fermetures/porte-garage.ts`.
   */
  | 'porte-garage'
  | 'portail-battant'
  | 'portail-coulissant'
  | 'portillon'
  | 'cloture'
  | 'claustra'
  | 'muret'
  | 'garde-corps'
  | 'totem'
  | 'pergola'
  | 'veranda'
  | 'caisson'
  | 'bibliotheque'
  | 'carport-pv'
  | 'pergola-pv'
  | 'surimposition-pv'
  | 'brise-soleil-pv'
  | 'verriere-pv'
  | 'pv-au-sol'
  ;

export type Materiau = 'pvc' | 'alu' | 'bois' | 'mixte';

/** La gamme de profilé — épaisseur, chambres, rupture de pont thermique. */
export type Gamme = 'standard' | 'confort' | 'performance';

/**
 * Le type d'ouverture. L'oscillo-battant n'y figure pas : c'est une OPTION
 * par vantail (docs/04 §3) qui se greffe sur une ouverture à la française.
 *
 * `levage` est le coulissant À LEVAGE (lift & slide, lot MT1a) : la poignée
 * soulève le vantail de 5 à 10 mm avant de le laisser glisser, et il
 * redescend sur ses joints à l'arrêt. C'est une OUVERTURE et non une famille
 * (complexité 2 au relevé) — ce qui change est la ferrure, les cotes, le
 * seuil et le prix, pas le produit. Voir sa liste de différences en tête de
 * `familles/vitrees/levage.ts`, et surtout : ses cotes maximales sont une
 * limite de FERRURE écrite en millimètres.
 */
export type Ouverture = 'frappe' | 'fixe' | 'soufflet' | 'coulissant' | 'galandage' | 'levage';

/**
 * Le type de pose. Ce n'est pas une mention de devis : il commande CE QU'ON
 * MESURE (compétence `prise-de-cotes` §1), le dormant que l'atelier
 * fabrique, et les pièces d'habillage qui l'accompagnent. Une cote prise
 * pour une pose et fabriquée pour une autre donne une menuiserie qui ne
 * rentre pas — c'est le risque n° 3 du projet (docs/00 §6).
 */
export type Pose = 'neuf-tableau' | 'applique' | 'renovation' | 'depose-totale';

/** Sens d'ouverture, vue intérieure — la convention normalisée du métier. */
export type Sens = 'gauche' | 'droite';

export type VitrageBase = 'double' | 'double-itr' | 'triple';

/**
 * Le vitrage combine une base et des traitements cumulables — les
 * coefficients se multiplient (docs/04 §2, « triple + feuilleté »).
 */
export interface Vitrage {
  base: VitrageBase;
  /** Vitrage asymétrique 10/16/4 — affaiblissement acoustique. */
  phonique?: boolean;
  /** Feuilleté 44.2 — choisi, ou imposé par la règle (allège basse, porte). */
  feuillete?: boolean;
  /**
   * L'ASPECT du verre — le seul choix de vitrage qui SE VOIT. Les trois
   * autres (base, phonique, feuilleté) sont des arguments qu'il faut croire
   * sur parole ; celui-ci, le client le regarde. Absent = clair, et rien ne
   * bouge.
   */
  aspect?: AspectVitrage;
  /**
   * Un store vénitien intégré ENTRE LES VERRES. Ni poussière, ni entretien,
   * ni cordon qui pend — et rien à poser au mur. Il épaissit le vitrage,
   * l'alourdit, et se paie cher.
   */
  storeIntegre?: boolean;
  /**
   * L'intercalaire à BORD CHAUD (warm edge). Le profilé qui sépare les
   * verres en rive est le pont thermique du vitrage : en aluminium il
   * conduit, en polymère chargé il conduit deux fois moins. Il se voit —
   * c'est une rive noire ou grise au lieu d'une rive brillante — et il
   * change le ψ, donc le Uw.
   */
  warmEdge?: boolean;
  /**
   * Un vitrage à CONTRÔLE SOLAIRE — une couche qui renvoie une partie du
   * rayonnement. Il évite la surchauffe d'été d'une baie plein sud, et il
   * coûte le facteur solaire d'hiver : c'est un arbitrage, jamais un
   * progrès net. Il compte parce qu'il peut faire perdre l'éligibilité à
   * MaPrimeRénov', dont le critère `Sw ≥ 0,30` est un PLANCHER.
   */
  controleSolaire?: boolean;
}

/**
 * Ce qu'on fait à la face du verre pour qu'elle cesse d'être transparente.
 * Trois procédés, trois prix, et trois rendus que le client distingue :
 *
 * — `depoli` : acidé sur toute la face, translucide et lisse au toucher ;
 * — `sable` : projeté au jet, plus granuleux, plus opaque, plus cher ;
 * — `serigraphie` : un motif d'émail cuit dans le verre — le seul qui se
 *   dessine, et le seul qui ne se raye pas.
 */
export type AspectVitrage = 'clair' | 'depoli' | 'sable' | 'serigraphie';

export type Couleur = 'blanc' | 'plaxe' | 'ral-1-face' | 'bicolore';

/**
 * La FINITION d'un laquage. Elle ne change pas la teinte, elle change le
 * REFLET — et sur une façade au soleil, un 7016 mat et un 7016 satiné ne se
 * ressemblent pas. Voir `teintes.ts`.
 */
export type Finition = 'mat' | 'satine' | 'texture' | 'brillant';

/** Remplissage d'une porte d'entrée — pilote le coefficient dédié. */
export type RemplissagePorte = 'pleine' | 'semi-vitree' | 'vitree';

/**
 * Le MODÈLE d'une porte d'entrée — le dessin de son panneau. C'est ce qui
 * se choisit avec les yeux et ce qui fait la vente : deux portes de mêmes
 * cotes, même matériau et même vitrage n'ont pas le même prix ni le même
 * client selon qu'elles sont unies, à moulures ou à inserts d'inox.
 *
 * Il ne touche pas au vitrage : le clair reste commandé par
 * `remplissagePorte`. Le modèle décore la partie PLEINE.
 */
export type ModelePorte = string;

/**
 * Le MODÈLE d'un volet battant — persienné, plein, mi-plein. C'est le
 * pendant exact de `ModelePorte`, et pour la même raison : deux volets de
 * mêmes cotes et même bois ne se vendent pas au même client selon qu'ils
 * sont à persiennes provençales ou pleins à barres et écharpe.
 *
 * Le volet n'existait jusqu'ici qu'en PERSIENNÉ, et le catalogue ne posait
 * pas la question. Le modèle par défaut reste donc le persienné, à 1000
 * millièmes : une configuration muette paie ce qu'elle payait avant.
 */
export type ModeleVolet = string;

export type RemplissagePortail = string;

export type SensRefoulement = 'gauche' | 'droite';

export type TypeMoteur = 'bras' | 'verin' | 'enterre' | 'roue' | 'cremaillere';

/** Ce qui l'alimente. La batterie n'est pas une alimentation, c'est un secours. */
export type AlimentationMoteur = 'filaire' | 'solaire';

export type SecuriteId =
  | 'cellules'
  | 'limiteur-effort'
  | 'barre-palpeuse'
  | 'deverrouillage-manuel'
  | 'feu-orange';

export interface Motorisation {
  type: TypeMoteur;
  alimentation: AlimentationMoteur;
  /**
   * Les sécurités retenues. ABSENT = le jeu imposé au complet, et c'est le
   * cas normal. Ce champ n'existe que pour qu'un hôte puisse en retirer une
   * — et se faire refuser.
   */
  securites?: SecuriteId[];
}

/**
 * La zone de vent, au sens de l'Eurocode 1 simplifié. C'est elle qui décide
 * de la pression que le vantail encaisse, donc de l'effort sur les gonds,
 * les piliers et le moteur.
 */
export type ZoneVent = 'abritee' | 'normale' | 'exposee';

/**
 * CE QU'ON VOIT DU TOIT DEPUIS CETTE FAÇADE — et non la forme du toit.
 *
 * La distinction n'est pas une subtilité de dessinateur : une maison à deux
 * pentes montre un TRIANGLE sur ses pignons et une BANDE sur ses longs
 * côtés, et c'est le même toit. En projection orthogonale, le faîtage —
 * plus haut, plus loin — se rabat sur une horizontale au-dessus de l'égout ;
 * la couverture occupe la bande entre les deux. Un DP4 dessiné en oubliant
 * cela met un pignon sur la façade de la rue, et l'instructeur le voit.
 *
 * — `pignon` : le triangle, faîtage au milieu ;
 * — `gouttiere` : la bande, faîtage rabattu au-dessus de l'égout ;
 * — `monopente` : une seule pente, montant vers la droite ;
 * — `terrasse` : pas de pente ; ce qui dépasse est l'acrotère.
 */
export type ToitureVue = 'pignon' | 'gouttiere' | 'monopente' | 'terrasse';

/** L'orientation d'une façade, telle qu'un DP4 la nomme. */
export type OrientationFacade = 'nord' | 'sud' | 'est' | 'ouest';

/**
 * LA FAÇADE DÉCLARÉE — la pièce DP4 d'une déclaration préalable.
 *
 * Elle est DÉCLARÉE et jamais devinée, et c'est la seule décision qui
 * compte ici. Un configurateur sait tout de la menuiserie et RIEN du mur
 * qui la reçoit : sa largeur, sa hauteur à l'égout, ce qu'on voit de son
 * toit. Les inventer produirait un dessin plausible et faux — et un DP4
 * faux n'est pas un dessin raté, c'est une déclaration inexacte déposée en
 * mairie. `computePlanDeFacade()` rend donc `null` tant que la façade n'est
 * pas déclarée, et `planDeFacadeManquant()` dit ce qui manque.
 *
 * Ce qu'elle ne porte PAS, volontairement : l'allège. Elle est déjà déclarée
 * sur la configuration (`hauteurAllegeMm`), où la règle du feuilleté la lit.
 * Deux champs pour une hauteur, c'est un jour où ils se contredisent.
 */
export interface FacadeDeclaree {
  /** La largeur de la façade dessinée, en mm. */
  largeurMm: number;
  /** Du terrain naturel à l'ÉGOUT — la première des deux cotes d'un DP4. */
  hauteurEgoutMm: number;
  /**
   * Du terrain naturel au FAÎTAGE — la cote que le PLU plafonne. Sur un
   * pignon ou une monopente, elle se DÉDUIT de la pente et de la largeur ;
   * côté gouttière elle dépend de la PROFONDEUR du bâtiment, que ce
   * configurateur ne connaît pas — il faut alors la déclarer.
   */
  hauteurFaitageMm?: number;
  toiture: ToitureVue;
  /** Du bord GAUCHE de la façade au bord gauche de l'ouvrage, en mm. */
  implantationXMm?: number;
  /** Le débord de toiture, par côté. Absent = 300 mm, le courant. */
  debordToitureMm?: number;
  orientation?: OrientationFacade;
}

/**
 * Le TYPE DE COFFRE d'un volet roulant — la question que le poseur pose en
 * premier, parce qu'elle décide de ce qui est visible et de ce qu'il faut
 * casser :
 *
 * — `exterieur` : le coffre apparent, posé en applique au-dessus de la
 *   fenêtre. C'est le volet de RÉNOVATION, celui qu'on ajoute sur une baie
 *   existante, et il mange le haut du tableau ;
 * — `tunnel` : le coffre maçonné DANS le linteau. Invisible de la rue et de
 *   la pièce, il ne prend rien au clair de jour — mais il se prévoit à la
 *   construction, pas après ;
 * — `bloc-baie` : le coffre solidaire du dormant de la menuiserie, livré
 *   monobloc. Ce n'est pas un volet qu'on achète, c'est une FENÊTRE : le
 *   configurateur le refuse sur un volet seul et propose l'option qui va
 *   bien sur la menuiserie.
 */
export type TypeCoffre = 'exterieur' | 'tunnel' | 'bloc-baie';

/**
 * La MANŒUVRE d'un volet roulant non motorisé. La sangle est le défaut du
 * catalogue depuis toujours ; la manivelle — une tringle oscillante sortant
 * du caisson — se vend là où la sangle ne passe pas : derrière un plan de
 * travail, sur une baie large, en étage.
 */
export type ManoeuvreVolet = 'sangle' | 'manivelle';

/**
 * La FORME d'une menuiserie. C'est ce qui change le plus d'un pays à
 * l'autre — bien plus que la quincaillerie : le plein cintre du bâti
 * ancien, le rampant de comble, l'œil-de-bœuf. Le type est défini avec les
 * contours qu'il produit, dans `geometrie/formes.ts`, et réexporté ici.
 */
export type { Forme } from './geometrie/formes.ts';

/**
 * La composition des petits-bois. Le prix ne change pas — c'est la même
 * baguette, le même travail — mais le dessin, lui, change du tout au tout :
 * une grille droite ne dit pas la même maison qu'un losange normand ou
 * qu'une croisée impériale.
 */
export type CompositionPetitsBois = 'droits' | 'losanges' | 'imperiale';

/** Les options à montant fixe — docs/04 §3. */
export type OptionId =
  | 'tiroir-sortie-totale'
  | 'oscillo-battant'
  | 'poignee-cle'
  | 'grille-ventilation'
  | 'petits-bois'
  | 'moustiquaire'
  | 'bloc-baie-manuel'
  | 'motorisation-filaire'
  | 'motorisation-radio'
  | 'motorisation-solaire'
  | 'seuil-pmr'
  | 'serrure-a2p'
  | 'capteur-vent'
  /**
   * Le verrou automatique anti-relevage d'un volet roulant. Il ne se
   * DESSINE pas — deux crochets dans le coffre, invisibles du dehors comme
   * du dedans —, et c'est assumé : on ne fabrique pas un rendu pour une
   * pièce que le client ne verra jamais.
   */
  | 'verrou-automatique'
  /**
   * Les accessoires d'une installation motorisée. Ceux-là sont bien des
   * OPTIONS — on vit sans clavier à code, on ne vit pas sans limiteur
   * d'effort. La différence n'est pas de degré, elle est de nature.
   */
  | 'telecommande'
  | 'clavier-code'
  | 'lecteur-badge'
  | 'interphone'
  | 'visiophone'
  | 'gache-electrique'
  /**
   * LES DEUX OPTIONS D'UNE PORTE DE GARAGE, et elles ne sont pas du confort :
   * elles décident si la porte ENTRE.
   *
   * Le panneau ISOLÉ de 67 mm gagne trois dixièmes de Ud — et demande cinq
   * millimètres de retombée de linteau en plus. La ferrure à RETOMBÉE
   * RÉDUITE, elle, descend de 100 à 55 mm : c'est ce qu'on propose à un
   * garage dont le linteau est bas, et c'est la seule alternative qui
   * existe avant de changer de type de porte.
   */
  | 'garage-panneau-isole'
  | 'garage-ferrure-reduite'
  /**
   * Les grilles de défense. Quatre dessins, quatre prix : le barreaudage
   * droit est le plus simple à forger, la grille ouvragée demande des
   * volutes cintrées une à une. Ce sont des options DISTINCTES et non un
   * réglage, parce que le prix change avec le modèle — et parce qu'on n'en
   * pose jamais deux sur la même baie.
   */
  | 'grille-defense'
  | 'grille-horizontale'
  | 'grille-croisillons'
  | 'grille-ouvragee'
  /**
   * Les accessoires d'une porte d'entrée. Ils manquaient tous : c'est
   * pourtant par eux qu'une porte se reconnaît de la rue — et qu'on lui
   * remet le courrier.
   */
  | 'boite-aux-lettres'
  | 'judas'
  | 'heurtoir'
  | 'soubassement-inox';

/**
 * Une option choisie. `quantite` ne sert qu'aux options « par vantail »
 * (défaut 1 : l'oscillo-battant équipe UN vantail sauf demande contraire —
 * c'est l'exemple chiffré de docs/04 §6, ×1 sur une fenêtre 2 vantaux).
 */
export interface OptionChoisie {
  id: OptionId;
  quantite?: number;
}

/** Exposition déclarée — alimente la règle AEV (docs/02 §3.4). */
export interface Exposition {
  /** Zone de vent 1 (abritée) à 4 (très exposée). */
  zoneVent: 1 | 2 | 3 | 4;
  /** Au-dessus du 2e étage — la pression de vent monte avec la hauteur. */
  etageEleve: boolean;
}

/**
 * LA configuration — ce que le client final compose, ce que le widget
 * transporte, ce que le plugin PHP recalcule. Dimensions au millimètre,
 * `widthMm`/`heightMm` sont les noms comparés par le harnais de parité.
 */
export interface JoineryConfiguration {
  famille: FamilleId;
  widthMm: number;
  heightMm: number;
  vantaux: number;
  /** Absente = ouverture par défaut de la famille (frappe, coulissant…). */
  ouverture?: Ouverture;
  /**
   * UNE OUVERTURE DÉCLARÉE AU CATALOGUE (lot MT4a) — italienne, basculante,
   * translation, pliante, guillotine, et toutes celles à venir.
   *
   * Elle est un CHAMP À PART et non une valeur de plus dans `Ouverture`,
   * parce que chaque nom ajouté au type coûtait dix-huit octets de
   * chargement initial : cinq d'un coup ont été construits et pesés, 84
   * octets au-dessus de la borne. Le cœur ne connaît donc que sa
   * CINÉMATIQUE, lue dans le catalogue. Voir `ouverture-declaree.ts`.
   */
  ouvertureDeclaree?: string;
  /**
   * La forme du contour. Absente = rectangle, et rien ne change : ni le
   * prix, ni le dessin, ni le volume.
   */
  forme?: FormeMenuiserie;
  /**
   * La MONTÉE d'un arc, la CHUTE d'un rampant, la hauteur des montants
   * sous une pointe — le sens dépend de la forme, et chaque cas est dit
   * dans `geometrie/formes.ts`. Absente, la forme prend sa valeur d'usage.
   */
  flecheMm?: number;
  /** Le côté BAS d'un trapèze — sans objet pour les autres formes. */
  formeCoteBas?: Sens;
  sens?: Sens;
  materiau: Materiau;
  gamme: Gamme;
  /**
   * La gamme NOMMÉE de profilés, quand le marchand en propose. Absente, le
   * configurateur s'en tient aux trois paliers ci-dessus — et les prix ne
   * bougent pas d'un centime.
   */
  systeme?: string;
  /** Absent sur les familles non vitrées (volets, stores, porte pleine). */
  vitrage?: Vitrage;
  couleur: Couleur;
  /**
   * LE CODE RAL de la face extérieure — « 7016 », « 9005 ».
   *
   * Il n'a de sens qu'avec `couleur: 'ral-1-face'` ou `'bicolore'`, et son
   * absence retombe sur l'anthracite, qui est la teinte la plus vendue.
   * C'est un CODE et pas un hexadécimal : un atelier ne commande pas du
   * « #383E42 », il commande du 7016 — l'hexadécimal n'est qu'un
   * équivalent d'affichage (voir `teintes.ts`).
   */
  ralExterieur?: string;
  /** Le code RAL intérieur — il ne sert qu'en bicoloration. */
  ralInterieur?: string;
  /** Le décor plaxé, quand `couleur` vaut `plaxe`. */
  decorPlaxe?: string;
  /** La brillance du laquage. Absente = satiné, la plus vendue. */
  finition?: Finition;
  /** Porte d'entrée seulement — défaut « pleine ». */
  remplissagePorte?: RemplissagePorte;
  /**
   * Le modèle de panneau d'une porte d'entrée. Absent = panneau uni, et le
   * prix ne bouge pas : le catalogue des modèles est additif comme celui
   * des gammes nommées.
   */
  modelePorte?: ModelePorte;
  /**
   * Le modèle d'un volet battant. Absent = persienné, ce que le catalogue
   * a toujours vendu, et le prix ne bouge pas d'un centime.
   */
  modeleVolet?: ModeleVolet;
  remplissagePortail?: RemplissagePortail;
  refoulementMm?: number;
  motorisation?: Motorisation;
  usage?: 'prive' | 'public';
  stationnementPrecaire?: boolean;
  /**
   * LES TROIS COTES DU MUR d'une porte de garage. Elles ne décrivent PAS
   * l'ouvrage — elles décrivent ce qui l'entoure, et c'est ce qui décide si
   * la porte entre. Aucune autre famille n'a cette contrainte.
   *
   *   `retombeeLinteauMm`   la place AU-DESSUS du passage, pour l'axe, les
   *                         ressorts et la courbe des rails ;
   *   `ecoinconMm`          la place de CHAQUE CÔTÉ, pour les rails
   *                         verticaux ;
   *   `profondeurGarageMm`  la place DEVANT, pour les rails horizontaux
   *                         sous le plafond.
   *
   * Absentes, elles ne bloquent pas : elles se demandent. Refuser une cote
   * non mesurée ferait abandonner un client qui n'a pas encore sorti son
   * mètre ; taire la question ferait livrer une porte qui n'entre pas.
   */
  /**
   * LA PENTE DE LA TOITURE, en degrés — une cote du TOIT, pas de l'ouvrage.
   * Elle décide de l'étanchéité : sous quinze degrés, l'eau stagne.
   */
  remplissageCloture?: 'lames' | 'panneau-rigide' | 'grillage-souple';
  occultation?: boolean;
  remplissageGardeCorps?: 'barreaux' | 'cables' | 'verre' | 'tole-perforee';
  compositionVerreGardeCorps?: string;
  fixationGardeCorps?: 'francaise' | 'anglaise';
  /**
   * LE TYPE DE MOUSTIQUAIRE. Ce ne sont pas cinq finitions, ce sont cinq
   * PRODUITS : une enroulable a un coffre et des coulisses, un cadre fixe
   * se clipse, une plissée se replie en accordéon.
   */
  /** Le mécanisme d'un store intérieur — quatre produits, pas quatre finitions. */
  typeStoreInterieur?: 'venitien' | 'enrouleur' | 'californien' | 'plisse';
  /**
   * La toile d'un enrouleur. Le `screen` est le piège : il filtre et
   * N'OCCULTE PAS, et c'est la première réclamation du métier.
   */
  toileStore?: 'occultant' | 'tamisant' | 'screen';
  /** La largeur de lame d'un vénitien, en mm — 15, 16, 25 ou 50. */
  lameStoreMm?: number;
  /**
   * Le modèle de brise-soleil orientable. Ce n'est pas une finition : c'est
   * lui qui décide de la table de classe de vent, du plafond de surface et
   * de la réservation de linteau.
   */
  modeleBso?: 'lamisol-70' | 'lamisol-90' | 'lamisol-vento';
  /**
   * Le LINTEAU disponible au-dessus du tableau, en mm. C'est une cote du
   * BÂTIMENT, pas du produit — comme la retombée de linteau d'une porte de
   * garage. Sans elle, on ne sait pas si un BSO se pose ; l'écran le dit
   * plutôt que de supposer.
   */
  linteauDisponibleMm?: number;
  /**
   * La toile d'un screen zip. Elle porte son facteur d'ouverture et ses
   * LAIZES — c'est la laize qui décide s'il faudra une couture.
   */
  toileScreen?: 'soltis-92';
  /**
   * LA TEINTE DE LA TOILE — lot O9b, et c'est le premier poste de décision
   * d'un store banne.
   *
   * Elle NE SE CONFOND PAS avec `toileScreen`, qui est une RÉFÉRENCE
   * technique — un facteur d'ouverture de 4 %, une laize, une euroclasse au
   * feu. Deux toiles de la même couleur et de facteurs différents ne font pas
   * le même produit (`TOILES_SCREEN`), et deux toiles du même facteur et de
   * couleurs différentes ne se vendent pas au même client. Ce sont deux
   * champs parce que ce sont deux grandeurs.
   *
   * Les douze teintes sont déclarées dans `toiles-de-store.ts` ; absente, la
   * toile garde le vert d'eau que le dessin et la scène 3D portaient en dur.
   */
  teinteToile?: string;
  /**
   * CE QUI RETIENT LA TOILE D'UN SCREEN (lot MT1b) — et donc sa classe de
   * vent. `zip` est le produit du lot S1 ; `cables` est le STORE VERTICAL,
   * la même mécanique avec une toile guidée par câbles. Muet vaut `zip` :
   * aucun devis existant ne change. Voir `familles/solaire/screen-zip.ts`.
   */
  guidageDeToile?: 'zip' | 'cables';
  implantationPortail?: 'entre-piliers' | 'en-tableau';
  /** L'épaisseur du panneau d'un caisson, en mm — 18 ou 25. */
  epaisseurPanneauMm?: number;
  profondeurMeubleMm?: number;
  /** Le nombre d'étagères d'un caisson. */
  etageres?: number;
  /**
   * Les montants intermédiaires d'un caisson. C'est le levier le plus
   * efficace contre la flèche : un montant divise la portée par deux, donc
   * la flèche par SEIZE. Épaissir le panneau ne la divise que par trois.
   */
  montantsIntermediaires?: number;
  facadeCaisson?: 'battante' | 'coulissante' | 'ouvert';
  /** Le nombre de vantaux d'une façade — deux le plus souvent. */
  vantauxFacade?: number;
  /**
   * Vrai quand le décor du panneau n'a PAS de fil — un uni, une couleur.
   * Le défaut est FAUX : le mélaminé le plus vendu est une imitation bois,
   * et supposer l'uni serait supposer le cas favorable.
   */
  decorSansFil?: boolean;
  /** Hauteur du piètement, comprise dans `heightMm` — 150 à 250 au relevé. */
  hauteurDePiedMm?: number;
  /** De combien le pied recule sous la face avant. Il coûte DEUX FOIS (Z16). */
  retraitDuPiedMm?: number;
  /** De combien le plateau déborde. Il ne coûte RIEN, et c'est le sujet du lot. */
  debordDuPlateauMm?: number;
  /** Combien de colonnes portent des tiroirs plutôt qu'une porte. */
  colonnesDeTiroirsDuBuffet?: number;
  partDeNicheEnMilliemes?: number;
  usageEnfant?: boolean;
  /**
   * LE VITRAGE D'UNE VITRINE (lot D8), tous deux DÉCLARÉS.
   *
   * L'EN 14749 exige un verre de SÉCURITÉ quand le vitrage est accessible —
   * et une vitrine de séjour l'est toujours, d'où le défaut à `true`. La
   * composition, elle, est un code de `COMPOSITIONS_DE_VERRE` : un nombre de
   * millimètres ne dit pas si un verre est trempé ou feuilleté.
   */
  ameDeVantail?: string;
  /**
   * L'ÉPAISSEUR DE LA CLOISON, en millimètres — celle du MUR, pas de la porte.
   *
   * C'est elle qui choisit l'huisserie (68 / 72 / 90 / 100), et le lot MT7a a
   * relevé que ces quatre nombres se lisent comme des largeurs par qui ne les
   * attend pas : deux nombres qui se ressemblent ne sont pas deux valeurs de la
   * même chose. Le champ le nomme pour qu'aucun écran ne les confonde.
   */
  epaisseurDeCloisonMm?: number;
  /**
   * LE CHÂSSIS D'UN GALANDAGE (lot D9), en millimètres : 100 ou 125.
   *
   * C'est lui qui décide de l'ÉPAISSEUR de la cloison finie, donc de ce que la
   * pièce perd — pas de la largeur du passage. Deux grandeurs, deux champs.
   */
  chassisDeGalandageMm?: number;
  /**
   * LE RECOUVREMENT DU VANTAIL dans le châssis, DÉCLARÉ par le marchand.
   *
   * Ni Eclisse ni Scrigno ne le publient (lot MT7c). Sans lui on emploie celui
   * du relevé, et on le DIT : le mur nécessaire se recalcule avec celui du
   * marchand, et il ne se rattrape pas une fois la cloison montée.
   */
  recouvrementDeVantailMm?: number;
  /**
   * LA LONGUEUR DE MUR ININTERROMPU dont on dispose, en millimètres.
   *
   * La cote qui refuse un galandage n'est pas celle de l'ouvrage, c'est celle
   * de ce qu'il y a À CÔTÉ — et seul le client l'a mesurée. Absente, elle n'est
   * pas « suffisante » : elle est NON MESURÉE (lot Z10).
   */
  murDisponibleMm?: number;
  compositionDeVerre?: string;
  vitrageAccessible?: boolean;
  releveDeNiche?: {
    largeursMm: [number, number, number];
    hauteursMm: [number, number, number];
    profondeursMm: [number, number, number];
    denivelleeSolMm?: number;
    rampant?: { hauteurBasseMm: number; angleDeg: number; monteVers: 'gauche' | 'droite' | 'fond' };
  };
  /**
   * La charge d'une étagère, en kg par mètre courant, DÉCLARÉE par celui
   * qui range. Du linge plié pèse quinze kilos au mètre, des livres reliés
   * le double ou le triple — et personne ne le devine à sa place.
   */
  chargeEtagereKgParM?: number;
  /**
   * Le client (ou le CCTP) demande le facteur solaire gtot. Il est ici pour
   * pouvoir être REFUSÉ proprement : un gtot n'est pas une propriété de la
   * toile mais du couple toile + vitrage.
   */
  gtotDemande?: boolean;
  typeMoustiquaire?:
    | 'enroulable-verticale'
    | 'enroulable-laterale'
    | 'cadre-fixe'
    | 'plissee'
    | 'coulissante';
  /**
   * La menuiserie protégée s'ouvre-t-elle vers l'EXTÉRIEUR ? Une
   * moustiquaire est devant : un ouvrant qui sort viendrait buter dedans.
   * C'est le refus qu'aucun configurateur n'oppose, et il se découvre à la
   * première ouverture.
   */
  ouvrantProtegeSort?: boolean;
  remplissageToiture?: 'polycarbonate' | 'sandwich' | 'vitrage';
  zoneNeige?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'D' | 'E';
  /**
   * L'ALTITUDE du chantier, en mètres. Elle n'est pas un détail de zone :
   * la table d'EN 1991-1-3 donne les charges au SOL à basse altitude, et
   * au-delà de 200 m la charge monte vite sans qu'aucune règle simple ne la
   * donne. Absente, on ne suppose pas la plaine — on le dit.
   */
  altitudeM?: number;
  formatModulePv?: 'module-courant' | 'module-grand-format';
  /**
   * Le retrait imposé sur chaque rive par le guide de montage du système de
   * fixation. Absent, le calepinage SURESTIME le nombre de modules et le
   * dit — les zones de rive voient une surpression de vent.
   */
  retraitDeRiveMm?: number;
  puissanceOnduleurW?: number;
  /** Une borne de recharge est-elle demandée ? Comptée, jamais dimensionnée. */
  borneDeRecharge?: boolean;
  /** Une batterie de stockage est-elle demandée ? Même règle. */
  batterieStockage?: boolean;
  hauteurPassageMm?: number;
  /**
   * L'ENTRAXE DES CHEVRONS d'une toiture, en millimètres. LA cote du lot
   * V2 : un crochet se visse DANS un chevron, et sans savoir où ils sont on
   * ne compte pas des crochets, on les devine. Elle ne se lit pas depuis le
   * sol — quelqu'un monte la mesurer, ou il n'y a pas de devis.
   */
  entraxeChevronsMm?: number;
  /**
   * LA SECTION d'un chevron. L'entraxe dit OÙ visser ; la section dit si le
   * chevron tient la charge ajoutée — et ce configurateur ne le calcule pas,
   * il le signale.
   */
  sectionChevronMm?: { largeurMm: number; hauteurMm: number };
  /**
   * L'ORIENTATION du pan, en degrés de BOUSSOLE — 0 au nord, 180 plein sud.
   * C'est la convention d'un téléphone, parce que c'est l'appareil avec
   * lequel la cote se relève.
   */
  azimutPanDeg?: number;
  /**
   * LES OBSTACLES du pan — cheminée, fenêtre de toit, sortie de VMC —, cotés
   * depuis l'angle bas-gauche : `x` le long de l'égout, `y` vers le faîtage.
   * C'est l'ordre dans lequel un métreur les relève.
   */
  obstaclesToiture?: Array<{
    nom: string;
    xMm: number;
    yMm: number;
    largeurMm: number;
    hauteurMm: number;
  }>;
  opaciteModuleMilliemes?: number;
  adossee?: boolean;
  commandeLames?: 'manuelle' | 'electrique';
  /**
   * LA TAILLE DE LAME D'UN VOLET ROULANT, en mm — lot O5.
   *
   * Trois tailles déclarées avec leur source dans
   * `familles/fermetures/lames-de-volet.ts` : 37, 41 et 55. Absente = 41, la
   * courante, et c'est la valeur que ce dépôt employait en dur.
   *
   * ELLE NE DÉCIDE PAS DU COFFRE, et c'est mesuré : sur les six hauteurs du
   * tarif, 37 et 41 rendent le même. Ce qui enroule est l'ÉPAISSEUR de la
   * bande, et elle ne bascule qu'au-delà de 50 mm de hauteur de lame. Elle
   * décide en revanche du NOMBRE de lames — donc du débit, du poids et du
   * trait.
   */
  lameVoletMm?: 37 | 41 | 55;
  /**
   * LE CÔTÉ DE LA MANŒUVRE — lot O5, et sa CONVENTION est dans son nom.
   *
   * « À droite » ou « à gauche » ne veut rien dire sans le point de vue : le
   * relevé de Fenetre24 écrit « vu de l'intérieur », et c'est aussi la
   * convention de toute élévation de ce cœur — on regarde la fenêtre depuis
   * la pièce. Les deux coïncident, et le dire évite la faute du lot C0, où
   * « 60° » ne disait pas quel angle.
   *
   * Absent = à droite, le montage courant d'un droitier ; le déclarer met le
   * symbole de manœuvre de l'autre côté du dessin, et il ne s'y mettait
   * jamais.
   *
   * ET LE MOTEUR SOLAIRE LE CONTRAINT : le panneau se monte toujours à
   * GAUCHE vu de l'intérieur, ce qui fait de ce champ et de l'option une
   * paire incompatible — le refus le nomme.
   */
  coteManoeuvre?: 'gauche' | 'droite';
  sensOuvertureLames?: 'avant' | 'arriere';
  penteToitureDeg?: number;
  /**
   * LA COUVERTURE du toit. Elle commande le KIT DE RACCORDEMENT, sans
   * lequel une fenêtre de toit fuit — ce n'est pas une option, c'est la
   * moitié du produit.
   */
  couverture?: 'tuiles' | 'ardoises' | 'bac-acier';
  retombeeLinteauMm?: number;
  ecoinconMm?: number;
  profondeurGarageMm?: number;
  /** La zone de vent du chantier. Absente = normale. */
  zoneVent?: ZoneVent;
  /**
   * Le TERRAIN d'un ouvrage linéaire : ses tronçons et leurs angles. Absent,
   * l'ouvrage est un seul tronçon droit de la longueur commandée — le cas
   * plat et aligné, qui couvre la majorité des projets et par lequel il
   * fallait commencer.
   *
   * Sur une famille linéaire, `widthMm` est la LONGUEUR développée. C'est
   * volontaire : le harnais de parité compare `widthMm`, le devis l'affiche,
   * et lui inventer un champ jumeau aurait fait deux cotes à tenir d'accord.
   */
  terrain?: {
    troncons: Array<{
      longueurMm: number;
      angleDeg?: number;
      ouverture?: { largeurMm: number; label: string; depuisDebutMm?: number };
    }>;
  };
  /** Le côté du refoulement. Absent = droite. */
  sensRefoulement?: SensRefoulement;
  /**
   * Le coffre d'un volet roulant. Absent = coffre extérieur, le volet de
   * rénovation que ce catalogue a toujours vendu, et le prix ne bouge pas.
   */
  coffre?: TypeCoffre;
  /**
   * La manœuvre d'un volet roulant non motorisé. Absent = sangle, ce que le
   * volume dessinait déjà quand aucune motorisation n'était choisie.
   */
  manoeuvre?: ManoeuvreVolet;
  /**
   * Le type de pose. Absent = neuf en tableau, la pose de référence : tant
   * que le marchand ne pose pas la question, le prix ne bouge pas d'un
   * centime et le dessin reste celui d'avant.
   */
  pose?: Pose;
  /**
   * L'épaisseur du doublage que la tapée doit rattraper (100 à 160 mm) —
   * pose en applique seulement. C'est une PIÈCE : elle part à l'atelier.
   */
  tapeeMm?: number;
  /** Fenêtre seulement : hauteur du sol au bas du vitrage (règle des 90 cm). */
  hauteurAllegeMm?: number;
  /**
   * LA FAÇADE qui reçoit l'ouvrage — la pièce DP4. Absente, il n'y a pas de
   * plan de façade : on ne dessine pas un mur qu'on n'a pas mesuré.
   */
  facade?: FacadeDeclaree;
  /** Partie haute fixe — retranchée de la hauteur d'ouvrant. */
  imposteHauteurMm?: number;
  options?: OptionChoisie[];
  /**
   * LES POSTES D'UN OUVRAGE VENDU À LA PIÈCE (lot Z0) — sans effet sur une
   * famille vendue au tableau ou au mètre, où la validation les refuse.
   * Quantités en millièmes de l'unité de base : 412,5 kg s'écrit 412 500.
   */
  postes?: PosteChoisi[];
  /** La composition des petits-bois — sans effet si l'option est absente. */
  compositionPetitsBois?: CompositionPetitsBois;
  exposition?: Exposition;
  /** Nombre de menuiseries identiques — déclenche la remise quantité. */
  quantite?: number;
}

/** Nature d'une ligne de prix — l'affichage décompose, le total additionne. */
export type PriceLineType = 'base' | 'coefficient' | 'supplement' | 'option' | 'remise';

/**
 * Une ligne du prix décomposé. Pour un coefficient, `amountCents` porte le
 * DELTA appliqué (après − avant) : la somme des lignes fait le total.
 */
export interface PriceLine {
  code: string;
  label: string;
  type: PriceLineType;
  amountCents: number;
}

/** Le prix d'UNE menuiserie — centimes entiers de bout en bout. */
export interface PriceResult {
  lines: PriceLine[];
  /** La sortie brute de la matrice dimensionnelle, avant tout coefficient. */
  baseCents: number;
  /** Le total exact au centime — celui que la parité JS↔PHP compare. */
  totalCents: number;
  /** L'arrondi commercial (au dixième d'euro) — le seul montant affiché. */
  displayTotalCents: number;
  currency: 'EUR';
}

export type Severite = 'erreur' | 'avertissement' | 'info';

/**
 * Un refus (ou une remarque) de fabricabilité. Chaque erreur porte un code
 * stable, un message qui dit la norme ou la contrainte d'atelier, ET
 * l'alternative la plus proche — jamais un refus sec (docs/02 §3).
 */
export interface ValidationIssue {
  code: string;
  severite: Severite;
  message: string;
  alternative?: {
    label: string;
    patch: Partial<JoineryConfiguration>;
  };
}

/**
 * Le rapport de mesure — les cotes calculées qui font foi pour l'atelier.
 * La 3D et le SVG n'en sont que des projections (règle des néons : le
 * manifeste fait foi, jamais le maillage).
 */
export interface MeasureReport {
  widthMm: number;
  heightMm: number;
  vantaux: number;
  /** Cotes d'un vantail (largeur totale / vantaux, imposte déduite). */
  vantail: { widthMm: number; heightMm: number };
  /** La pose retenue — elle dit ce que le client aurait dû mesurer. */
  pose: Pose;
  /**
   * L'aile de recouvrement du dormant de rénovation, par côté : elle coiffe
   * l'ancien cadre par l'extérieur, HORS cote saisie. 0 sur les autres poses.
   */
  recouvrementMm: number;
  /**
   * Ce que le client perd en clair de jour par rapport à sa menuiserie
   * ACTUELLE, par côté : le nouveau cadre vient se loger dans l'ancien. 0
   * hors rénovation — ailleurs il n'y a pas d'existant à comparer.
   */
  clairPerduParCoteMm: number;
  /** La tapée fabriquée, en profondeur (mm) — 0 s'il n'y en a pas. */
  tapeeMm: number;
  /**
   * LA CHAÎNE DE COTES, étage par étage — ce que l'atelier lit (lot 0).
   * Toutes ces cotes valent pour UN vantail, sauf la dimension de
   * fabrication qui est le hors-tout du dormant.
   *
   *   hors-tout → fond de feuillure → cote de vitrage → clair de vitrage
   *
   * `null` quand la famille n'est pas vitrée : il n'y a alors ni feuillure
   * ni verre, et inventer des cotes serait pire que ne rien dire.
   *
   * Elle vit DANS le rapport de mesure, et pas dans une fonction à part
   * qu'on chargerait à la demande : essayé, cela n'a rendu que 0,1 ko et
   * cela cassait la règle qui tient tout le projet — « le rapport de
   * mesure fait foi ». Une cote de fabrication qui vit ailleurs que dans
   * le rapport de mesure est une seconde vérité.
   */
  chaineDeCotes: {
    /** Le hors-tout du dormant — ce qui se commande. */
    dimensionFabrication: { widthMm: number; heightMm: number };
    /**
     * LE CADRE DE L'OUVRANT, hors tout, par vantail — la cote de DÉBIT.
     *
     * Elle manquait, et son absence était un rebut différé : une barre
     * d'ouvrant se coupe à la cote extérieure du cadre, RECOUVREMENT
     * COMPRIS, et non au fond de feuillure. Débiter au fond de feuillure
     * donnait un ouvrant de trente-deux millimètres trop petit sur une
     * fenêtre PVC — c'est-à-dire quatre barres à jeter par vantail.
     *
     * `null` sur une famille sans ouvrant manœuvrant (châssis fixe) :
     * il n'y a alors rien à débiter, et inventer une cote serait pire.
     */
    ouvrant: { widthMm: number; heightMm: number } | null;
    /** Le logement où le vitrage descend, par vantail. */
    fondDeFeuillure: { widthMm: number; heightMm: number };
    /** Ce qu'on commande au verrier, par vantail (fond de feuillure − 2 jeux). */
    coteVitrage: { widthMm: number; heightMm: number };
    /** Le refend compté, une fois par intervalle : battement ou chicane. */
    battementMm: number;
    /** La masse vue retenue par côté — dormant + ouvrant, rénovation déduite. */
    masseVueMm: number;
  } | null;
  /** Clair de vitrage d'un vantail — null si la famille n'est pas vitrée. */
  clairVitrage: { widthMm: number; heightMm: number } | null;
  /** Épaisseur de verre cumulée du vitrage effectif (mm) — 0 si non vitré. */
  verreMm: number;
  /** Poids de vitrage par vantail, arrondi au dixième de kg. */
  glassWeightKgParVantail: number;
  /** Poids de vitrage total — le champ comparé par la parité. */
  glassWeightKg: number;
  /**
   * LE POIDS DU VANTAIL COMPLET — verre, cadre et ferrure — en kg.
   *
   * C'est lui que les abaques de ferrure comparent : une paumelle porte un
   * ouvrant, pas une vitre. Le poids de vitrage seul sous-estimait de huit
   * à quinze kilos sur une porte-fenêtre, assez pour annoncer une ferrure
   * standard là où le métier en pose une renforcée.
   */
  poidsVantailKg: number;
}
