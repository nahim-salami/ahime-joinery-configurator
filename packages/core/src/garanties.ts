/**
 * Pourquoi ce fichier existe : « Garantie 10 ans » est le badge le plus
 * affiché du marché de la menuiserie, et le plus souvent faux.
 *
 * LE PIÈGE, nommé une fois pour toutes : la décennale, la biennale et la
 * garantie de parfait achèvement sont des garanties de TRAVAUX. Elles
 * naissent de la RÉCEPTION d'un ouvrage, pas de la livraison d'un colis. Un
 * client qui achète en FOURNITURE SEULE et pose lui-même n'en a AUCUNE : il
 * a la garantie légale de conformité (deux ans, sur le bien) et les vices
 * cachés, un point c'est tout. Afficher « 10 ans » sur une vente en
 * fourniture seule n'est pas un raccourci commercial, c'est une promesse
 * que personne ne tiendra le jour où la fenêtre prend l'eau.
 *
 * CE QUE CE MODULE FAIT : il liste, pour UNE configuration et UN mode de
 * pose, les garanties qui s'appliquent VRAIMENT — leur durée, leur point de
 * départ, leur fondement, et ce qu'elles couvrent. Les garanties légales
 * viennent du droit et ne se négocient pas ; les garanties commerciales
 * viennent du fabricant et se DÉCLARENT, comme le TAEG d'une offre ou la
 * façade d'un DP4. Ce module n'en invente aucune.
 *
 * CE QU'IL NE FAIT PAS : dire qui a raison. Il ne tranche pas un litige, il
 * dit quelle garantie couvre quoi et à partir de quand. C'est déjà ce que
 * personne n'écrit sur un devis.
 *
 * Aucune horloge, aucun DOM, aucun aléa. Les durées sont en MOIS et les
 * points de départ sont nommés : c'est l'appelant qui connaît les dates.
 */

import type { JoineryConfiguration } from './types.ts';
import { DEFAULT_CATALOG, estPortail, type PricingCatalog } from './catalog.ts';

/**
 * QUI POSE. C'est la question qui décide de presque tout, et aucun
 * configurateur du marché ne la pose avant d'afficher ses garanties.
 */
export type ModeDeFourniture = 'pose-par-le-pro' | 'fourniture-seule';

export type NatureDeLOuvrage = 'clos-et-couvert' | 'equipement-dissociable' | 'hors-batiment';

const CLOS_ET_COUVERT = new Set([
  'fenetre',
  'porte-fenetre',
  'coulissant',
  'porte-entree',
  'fenetre-toit',
  'porte-garage',
  'veranda',
]);

const HORS_BATIMENT = new Set([
  'portail-battant',
  'portail-coulissant',
  'portillon',
  'cloture',
  'claustra',
  'muret',
  'totem',
  'pergola',
]);

/** La nature de l'ouvrage — ce qui décide de la décennale et de la biennale. */
export function natureDeLOuvrage(config: JoineryConfiguration): NatureDeLOuvrage {
  if (HORS_BATIMENT.has(config.famille)) return 'hors-batiment';
  if (CLOS_ET_COUVERT.has(config.famille)) return 'clos-et-couvert';
  // LE BLOC-BAIE REDEVIENT INDISSOCIABLE : son coffre est solidaire du
  // dormant et maçonné dans le linteau. On ne le démonte pas sans toucher
  // au gros œuvre, et c'est exactement le critère de l'article 1792-3.
  if (config.famille === 'volet-roulant' && config.coffre === 'tunnel') return 'clos-et-couvert';
  // l'ouvrage impropre à sa destination, ce qui est le second membre de
  // l'article 1792. Il n'est pas dans « hors-bâtiment » pour cette raison.
  if (config.famille === 'garde-corps') return 'clos-et-couvert';
  return 'equipement-dissociable';
}

/** D'où part le compteur. Deux dates différentes, jamais interchangeables. */
export type PointDeDepart = 'livraison' | 'reception';

/** La nature d'une garantie — elle décide de qui la doit. */
export type NatureGarantie = 'legale' | 'commerciale';

export interface Garantie {
  code: string;
  label: string;
  nature: NatureGarantie;
  /** La durée, en mois. */
  dureeMois: number;
  depart: PointDeDepart;
  /** Le fondement — un article, ou le nom du fabricant qui l'accorde. */
  fondement: string;
  /** Ce qu'elle couvre, en une phrase qu'un client comprend. */
  couvre: string;
}

/**
 * UNE GARANTIE COMMERCIALE DÉCLARÉE par le fabricant ou le marchand.
 *
 * Elle se déclare parce que ce module ne la connaît pas : dix ans sur le
 * profilé, dix ans contre la buée entre les verres, cinq ans sur le moteur,
 * vingt-cinq ans sur un thermolaquage QUALIMARINE — ce sont des engagements
 * de marque, pas des règles de droit, et ils changent d'une gamme à l'autre.
 */
export interface GarantieCommerciale {
  code: string;
  label: string;
  dureeMois: number;
  fondement: string;
  couvre: string;
  /** Restreinte à certains matériaux — vide = toutes. */
  materiaux?: Array<JoineryConfiguration['materiau']>;
  /** N'a de sens que si l'ouvrage est motorisé. */
  siMotorise?: boolean;
  /** N'a de sens que si l'ouvrage est vitré. */
  siVitre?: boolean;
}

/** Ce que la vente promet en plus du droit — vide tant que rien n'est déclaré. */
export interface EngagementsDuVendeur {
  commerciales: GarantieCommerciale[];
  /**
   * La DURÉE DE DISPONIBILITÉ DES PIÈCES DÉTACHÉES, en mois. Le vendeur
   * DOIT en informer l'acheteur (art. L111-4 du Code de la consommation) et
   * cette information l'ENGAGE. `undefined` n'est pas « aucune » : c'est
   * une obligation d'information non remplie, et le module le dit.
   */
  piecesDetacheesMois?: number;
}

/**
 * LA GARANTIE LÉGALE DE CONFORMITÉ — deux ans sur le BIEN, quel que soit
 * celui qui pose. C'est la seule qui survit à une fourniture seule.
 */
const CONFORMITE: Garantie = {
  code: 'conformite',
  label: 'Garantie légale de conformité',
  nature: 'legale',
  dureeMois: 24,
  depart: 'livraison',
  fondement: 'art. L217-3 et suivants du Code de la consommation',
  couvre:
    'Le bien doit être conforme à ce qui a été vendu. Pendant les deux ans, c’est au VENDEUR de prouver que le défaut n’existait pas à la livraison — pas au client de prouver qu’il existait.',
};

/** LES VICES CACHÉS — deux ans, mais à compter de la DÉCOUVERTE du vice. */
const VICES_CACHES: Garantie = {
  code: 'vices-caches',
  label: 'Garantie des vices cachés',
  nature: 'legale',
  dureeMois: 24,
  depart: 'livraison',
  fondement: 'art. 1641 et 1648 du Code civil',
  couvre:
    'Un défaut caché qui rend la menuiserie impropre à son usage. Les deux ans courent de la DÉCOUVERTE du vice, pas de la livraison — c’est la seule garantie dont le compteur démarre plus tard.',
};

/** LA GARANTIE DE PARFAIT ACHÈVEMENT — un an, et elle vient de la RÉCEPTION. */
const PARFAIT_ACHEVEMENT: Garantie = {
  code: 'parfait-achevement',
  label: 'Garantie de parfait achèvement',
  nature: 'legale',
  dureeMois: 12,
  depart: 'reception',
  fondement: 'art. 1792-6 du Code civil',
  couvre:
    'Tout désordre signalé à la réception ou dans l’année qui suit, quelle qu’en soit la gravité — un joint mal posé comme un vantail qui frotte. C’est l’entreprise qui a posé qui la doit.',
};

/** LA BIENNALE — deux ans sur ce qui se démonte sans abîmer le gros œuvre. */
const BIENNALE: Garantie = {
  code: 'biennale',
  label: 'Garantie de bon fonctionnement (biennale)',
  nature: 'legale',
  dureeMois: 24,
  depart: 'reception',
  fondement: 'art. 1792-3 du Code civil',
  couvre:
    'Les ÉQUIPEMENTS DISSOCIABLES : ceux qu’on démonte sans toucher au gros œuvre — moteur de volet, quincaillerie, crémone, motorisation de portail.',
};

/** LA DÉCENNALE — dix ans, et elle ne couvre pas ce qu'on croit. */
const DECENNALE: Garantie = {
  code: 'decennale',
  label: 'Garantie décennale',
  nature: 'legale',
  dureeMois: 120,
  depart: 'reception',
  fondement: 'art. 1792 du Code civil',
  couvre:
    'Les désordres qui compromettent la SOLIDITÉ de l’ouvrage ou le rendent impropre à sa destination. Une menuiserie participe du clos et du couvert : une infiltration par le dormant en relève. Une rayure, une couleur qui déplaît, une poignée qui grince, non.',
};

/**
 * L'ASSURANCE DOMMAGES-OUVRAGE — pas une garantie, une ASSURANCE, et c'est
 * le MAÎTRE D'OUVRAGE qui doit la souscrire (art. L242-1 du Code des
 * assurances). Elle préfinance les réparations décennales sans attendre
 * qu'un tribunal désigne un responsable. Presque personne ne la souscrit en
 * rénovation, et presque personne ne sait qu'il aurait dû.
 */
export const DOMMAGES_OUVRAGE = {
  label: 'Assurance dommages-ouvrage',
  fondement: 'art. L242-1 du Code des assurances',
  rappel:
    'Elle incombe au MAÎTRE D’OUVRAGE — c’est-à-dire au client — sur des travaux relevant de la décennale. Elle préfinance la réparation sans attendre qu’un juge désigne le responsable. En rénovation, presque personne ne la souscrit ; l’obligation existe pourtant.',
} as const;

/** Ce que ce module rend : les garanties, et ce qu'il refuse de promettre. */
export interface RapportDeGaranties {
  mode: ModeDeFourniture;
  garanties: Garantie[];
  /** Ce qui N'EST PAS couvert, et pourquoi — la moitié utile du rapport. */
  exclusions: string[];
  /** Les rappels qui n'engagent pas le vendeur mais changent la donne. */
  rappels: string[];
  /** La plus longue durée réellement applicable, en mois — pour un badge honnête. */
  dureeMaxMois: number;
}

/** L'ouvrage est-il motorisé ? La biennale ne s'y intéresse que pour ça. */
function estMotorise(config: JoineryConfiguration): boolean {
  return (
    config.motorisation !== undefined ||
    (config.options ?? []).some((option) => option.id.startsWith('motorisation-'))
  );
}

/**
 * LES GARANTIES D'UNE VENTE — celles qui s'appliquent vraiment.
 *
 * Le mode de fourniture décide de tout : posé par un professionnel, la vente
 * est un MARCHÉ DE TRAVAUX et les garanties de construction s'ouvrent à la
 * réception. Livré seul, c'est une VENTE, et il n'en reste que deux.
 */
export function computeGaranties(
  config: JoineryConfiguration,
  mode: ModeDeFourniture,
  engagements: EngagementsDuVendeur = { commerciales: [] },
  catalog: PricingCatalog = DEFAULT_CATALOG,
): RapportDeGaranties {
  const garanties: Garantie[] = [CONFORMITE, VICES_CACHES];
  const exclusions: string[] = [];
  const rappels: string[] = [];
  const motorise = estMotorise(config);
  const vitre = catalog.familles[config.famille]?.vitree === true;

  const nature = natureDeLOuvrage(config);

  if (mode === 'pose-par-le-pro') {
    garanties.push(PARFAIT_ACHEVEMENT);
    if (nature === 'clos-et-couvert') {
      garanties.push(DECENNALE);
    } else if (nature === 'equipement-dissociable') {
      // PAS DE DÉCENNALE SUR UN ÉQUIPEMENT DISSOCIABLE, et c'est le second
      // mensonge du badge « 10 ans ». Un volet, un store, une moustiquaire
      // se démontent sans toucher au gros œuvre : l'article 1792-3 les
      // range sous la BIENNALE, et deux ans ne sont pas dix.
      exclusions.push(
        'Pas de décennale sur cet ouvrage : il est DISSOCIABLE — on le démonte sans toucher au gros œuvre. C’est la garantie de bon fonctionnement, deux ans, qui le couvre (art. 1792-3). Un coffre de volet MAÇONNÉ dans le linteau, lui, change de camp.',
      );
    } else {
      // HORS BÂTIMENT : ni oui ni non, et la condition se dit.
      exclusions.push(
        'La décennale n’est PAS automatique sur cet ouvrage. Elle suppose un ouvrage de construction : fondations, maçonnerie, scellement. Un portail sur piliers maçonnés n’est pas une clôture posée sur platines, et l’attestation du poseur dit lequel des deux il assure.',
      );
    }
    // a aucun : la lui accorder ferait une ligne de plus et zéro protection.
    const aDesEquipements =
      motorise || nature !== 'hors-batiment' || estPortail(config.famille);
    if (aDesEquipements) {
      garanties.push(
        motorise
          ? BIENNALE
          : {
              ...BIENNALE,
              couvre:
                'Les ÉQUIPEMENTS DISSOCIABLES : la quincaillerie, la crémone, les paumelles, la serrure, les gonds — tout ce qui se démonte sans toucher au gros œuvre.',
            },
      );
    }
    if (nature === 'clos-et-couvert') rappels.push(DOMMAGES_OUVRAGE.rappel);
    // La décennale suppose une assurance en cours de validité À LA DATE
    // D'OUVERTURE DU CHANTIER. Une attestation d'il y a trois ans ne prouve
    // rien, et c'est ce que le client doit demander.
    rappels.push(
      'Demandez l’attestation d’assurance décennale du poseur, valable À LA DATE D’OUVERTURE DU CHANTIER. Une attestation périmée ne couvre rien, et elle se vérifie en une minute.',
    );
  } else {
    // LE CŒUR DU FICHIER. Aucun badge « 10 ans » ici.
    exclusions.push(
      'AUCUNE garantie de travaux : ni décennale, ni biennale, ni parfait achèvement. Elles naissent de la RÉCEPTION d’un ouvrage posé par une entreprise — en fourniture seule, il n’y a pas de réception.',
    );
    exclusions.push(
      'Une infiltration due à la POSE ne sera couverte par personne : c’est le client qui a posé, et c’est lui le poseur au sens du droit.',
    );
    if (motorise) {
      exclusions.push(
        'La motorisation perd sa garantie de bon fonctionnement : elle vient de la réception d’un ouvrage, pas d’un colis. Il ne reste que la garantie du fabricant, quand il en accorde une.',
      );
    }
  }

  for (const commerciale of engagements.commerciales) {
    if (commerciale.materiaux && !commerciale.materiaux.includes(config.materiau)) continue;
    if (commerciale.siMotorise && !motorise) continue;
    if (commerciale.siVitre && !vitre) continue;
    garanties.push({
      code: commerciale.code,
      label: commerciale.label,
      nature: 'commerciale',
      dureeMois: commerciale.dureeMois,
      depart: 'livraison',
      fondement: commerciale.fondement,
      couvre: commerciale.couvre,
    });
  }

  if (engagements.piecesDetacheesMois === undefined) {
    // UNE OBLIGATION D'INFORMATION NON REMPLIE, dite comme telle. Se taire
    // ici laisserait croire qu'il n'y a rien à dire.
    exclusions.push(
      'Durée de disponibilité des PIÈCES DÉTACHÉES non déclarée. Le vendeur DOIT en informer l’acheteur (art. L111-4 du Code de la consommation), et cette information l’engage : sans elle, un galet de coulissant introuvable dans huit ans condamne la baie entière.',
    );
  } else {
    rappels.push(
      `Pièces détachées disponibles ${Math.round(engagements.piecesDetacheesMois / 12)} ans après la livraison — le vendeur s’y engage (art. L111-4).`,
    );
  }

  // CE QU'AUCUNE GARANTIE NE COUVRE, et qui fait la moitié des litiges.
  exclusions.push(
    'L’ENTRETIEN n’est couvert par aucune garantie : joints à nettoyer, ferrures à graisser, drainage du dormant à dégager. Un défaut d’entretien documenté fait tomber la garantie commerciale du fabricant.',
  );
  if (estPortail(config.famille) && motorise) {
    exclusions.push(
      'Une motorisation de portail exige une mise en service et un dossier technique conformes à la EN 12453. Sans eux, l’installateur — donc le client qui a posé lui-même — répond des dommages corporels.',
    );
  }

  return {
    mode,
    garanties,
    exclusions,
    rappels,
    dureeMaxMois: Math.max(...garanties.map((garantie) => garantie.dureeMois)),
  };
}

/**
 * LE BADGE HONNÊTE — la phrase qu'on a le droit d'afficher.
 *
 * Elle nomme la durée ET ce qui la porte. « Garantie 10 ans » tout court ne
 * dit pas si c'est le profilé, la pose ou le moteur, et laisse le client
 * croire que c'est tout à la fois.
 */
export function phraseDeGarantie(rapport: RapportDeGaranties): string {
  const plus = rapport.garanties.reduce((haut, garantie) =>
    garantie.dureeMois > haut.dureeMois ? garantie : haut,
  );
  const annees = Math.round(plus.dureeMois / 12);
  const duree = annees >= 1 ? `${annees} an${annees > 1 ? 's' : ''}` : `${plus.dureeMois} mois`;
  return rapport.mode === 'fourniture-seule'
    ? `${plus.label} : ${duree} — ${plus.couvre.split('.')[0]}. En fourniture seule, aucune garantie de travaux ne s’applique.`
    : `${plus.label} : ${duree} à compter de la ${plus.depart === 'reception' ? 'réception des travaux' : 'livraison'}.`;
}
