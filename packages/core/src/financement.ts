/**
 * Pourquoi ce fichier existe : une fenêtre à 900 € se compare ; huit
 * fenêtres à 7 200 € se FINANCENT. Le particulier ne demande pas le prix,
 * il demande la mensualité — et c'est là que tout le marché dérape.
 *
 * LE DÉRAPAGE, nommé : « à partir de 49 €/mois ». Trois mots, aucun taux,
 * aucune durée, aucun coût total. C'est ce qu'affichent la moitié des sites
 * de menuiserie, et le Code de la consommation l'interdit : dès qu'une
 * publicité montre un CHIFFRE — mensualité, taux, durée —, elle doit porter
 * un exemple représentatif complet (art. L312-6 et suivants) et la mention
 * « Un crédit vous engage et doit être remboursé. Vérifiez vos capacités de
 * remboursement avant de vous engager. » Ce module refuse donc de produire
 * une mensualité seule : il rend l'exemple entier, ou il rend un refus qui
 * dit ce qui manque.
 *
 * LE TAEG EST CALCULÉ, PAS RECOPIÉ. Un prêteur le déclare ; ce module le
 * RECALCULE depuis les flux réels — capital reçu, frais de dossier retenus,
 * mensualités versées, assurance comprise — et compare. Un écart signale
 * une offre mal saisie, et c'est le genre d'erreur qui se propage jusqu'au
 * contrat. Le taux mensuel se trouve par dichotomie sur les flux, puis
 * s'annualise ACTUARIELLEMENT : (1 + i)¹² − 1, et non 12 × i. Les deux
 * diffèrent de trente points de base à 5 %, et c'est le TAEG qui fait foi.
 *
 * L'ÉCO-PTZ N'EST PAS MAPRIMERÉNOV', et confondre les deux coûte cher au
 * client : l'éco-PTZ sur les parois vitrées n'est ouvert QU'EN REMPLACEMENT
 * DE SIMPLE VITRAGE. Un client qui remplace du double par du double
 * performant peut toucher MaPrimeRénov' et se voir refuser l'éco-PTZ pour
 * la même fenêtre. Le module le dit avant la signature, pas après.
 *
 * Aucune horloge, aucun DOM, aucun aléa. La DATE du barème est une donnée
 * d'entrée, jamais `Date.now()` : un devis rejoué six mois plus tard doit
 * rendre exactement ce qu'il rendait — même règle que `aides.ts`.
 */

import type { JoineryConfiguration } from './types.ts';
import { DEFAULT_CATALOG, type PricingCatalog } from './catalog.ts';
import { computeUw, critereTechniqueAides, seuilsAidesDe } from './thermal.ts';

/**
 * LA MENTION LÉGALE, mot pour mot. Elle n'est pas négociable et elle ne se
 * reformule pas : le Code de la consommation en fixe les termes.
 */
export const MENTION_LEGALE =
  'Un crédit vous engage et doit être remboursé. Vérifiez vos capacités de remboursement avant de vous engager.';

/**
 * LE DÉLAI DE RÉTRACTATION d'un crédit à la consommation, en jours. Quatorze,
 * et il court à la signature de l'offre — pas à la livraison.
 */
export const RETRACTATION_JOURS = 14;

/**
 * LA PHRASE DU DÉLAI, à côté de la mention légale et pour la même raison.
 *
 * Elle NE PASSE PAS PAR LE DICTIONNAIRE, comme `MENTION_LEGALE` : ces deux
 * textes disent un droit français à un client français, et un marchand qui
 * les traduirait librement dirait autre chose que la loi. Rendre les deux
 * de la même façon évite qu'on se demande, dans six mois, pourquoi l'une
 * se traduit et l'autre non.
 *
 * ELLE NOMME LE POINT DE DÉPART, parce que c'est ce qui trompe : le délai
 * court à la SIGNATURE DE L'OFFRE, et un client qui compte à partir de la
 * pose a laissé passer son droit depuis des semaines.
 */
export const MENTION_RETRACTATION = `Vous disposez de ${RETRACTATION_JOURS} jours pour vous rétracter, à compter de la signature de l’offre de crédit — pas de la livraison du chantier.`;

/**
 * UNE OFFRE DE CRÉDIT, telle que le marchand la DÉCLARE. Rien ici n'est
 * deviné : ce module ne connaît ni le partenaire financier du marchand, ni
 * ses conditions du trimestre. Comme la façade d'un DP4, l'offre se déclare
 * ou il n'y a pas de mensualité.
 */
export interface OffreDeCredit {
  /** Le nom de l'offre, tel qu'il apparaîtra sur l'exemple représentatif. */
  label: string;
  /**
   * Le TAUX DÉBITEUR annuel fixe, en millièmes (5,90 % → 59). C'est lui qui
   * fabrique la mensualité ; le TAEG, lui, se calcule ensuite.
   */
  tauxDebiteurMilliemes: number;
  /** La durée de remboursement, en mois. */
  dureeMois: number;
  /** Les frais de dossier, en centimes. Ils entrent dans le TAEG. */
  fraisDossierCents?: number;
  /**
   * L'assurance emprunteur, en centimes par mois. FACULTATIVE en crédit à
   * la consommation — mais si elle est exigée pour obtenir le crédit, elle
   * entre dans le TAEG, et c'est le cas le plus fréquent.
   */
  assuranceMensuelleCents?: number;
  /** Vrai quand l'assurance conditionne l'octroi : elle entre alors au TAEG. */
  assuranceObligatoire?: boolean;
  /** Le TAEG annoncé par le prêteur, en millièmes — pour le comparer au calcul. */
  taegAnnonceMilliemes?: number;
  /** L'apport versé comptant, en centimes. Il ne se finance pas. */
  apportCents?: number;
}

/**
 * LE TAUX D'USURE — le plafond légal, publié CHAQUE TRIMESTRE par la Banque
 * de France, et différent selon le montant emprunté.
 *
 * Il est une donnée d'entrée DATÉE, jamais une constante compilée : il
 * change tous les trois mois, et un configurateur qui l'aurait figé aurait
 * validé pendant un trimestre des offres devenues illégales. Absent, le
 * module ne valide RIEN et le dit — il ne suppose pas que l'offre est
 * légale.
 */
export interface BaremeFinancement {
  /** La date de validité, en ISO — elle s'affiche avec chaque chiffre. */
  date: string;
  /** D'où viennent ces chiffres, en clair. */
  source: string;
  /**
   * Les seuils de l'usure par tranche de capital, en millièmes. Chaque
   * entrée vaut « jusqu'à ce montant emprunté, ce taux ». Vide = inconnu.
   */
  usure: Array<{ jusquACents: number; tauxMilliemes: number }>;
  ecoPtz: {
    /** L'état du dispositif — même vocabulaire que `aides.ts`. */
    etat: 'actif' | 'suspendu' | 'inconnu';
    /** La date de fin du dispositif, en ISO. */
    jusquAu: string;
    /** Le plafond pour une action SEULE sur parois vitrées, en euros. */
    plafondParoisVitreesEuros: number;
    /** Les plafonds des bouquets, par nombre d'actions. */
    plafondBouquetEuros: Record<'deux' | 'trois-et-plus' | 'performance-globale', number>;
    /** La durée maximale de remboursement, en mois. */
    dureeMaxMois: number;
  };
}

/**
 * LE BARÈME RELEVÉ. Il porte sa date parce qu'il se périme : les seuils de
 * l'usure changent chaque trimestre, et l'éco-PTZ a une date de fin.
 *
 * Le tableau de l'usure est VIDE, et c'est délibéré. Le publier figé
 * reviendrait à valider des offres avec un chiffre du trimestre passé —
 * exactement l'erreur que l'en-tête reproche aux montants codés en dur. Le
 * marchand renseigne le trimestre courant ; tant qu'il ne l'a pas fait,
 * `computeFinancement` dit qu'il ne peut pas vérifier la légalité du taux
 * au lieu de laisser croire qu'il l'a vérifiée.
 */
export const BAREME_FINANCEMENT_2026: BaremeFinancement = {
  date: '2026-01-01',
  source:
    'Éco-PTZ : art. 244 quater U du CGI, prorogé au 31 décembre 2027 par la loi de finances pour 2024 (art. 71). ' +
    'Usure : seuils publiés chaque trimestre par la Banque de France — à renseigner par le marchand.',
  usure: [],
  ecoPtz: {
    etat: 'actif',
    jusquAu: '2027-12-31',
    plafondParoisVitreesEuros: 7000,
    plafondBouquetEuros: { deux: 25000, 'trois-et-plus': 30000, 'performance-globale': 50000 },
    dureeMaxMois: 180,
  },
};

/** Le taux mensuel proportionnel, tel que le contrat le pratique. */
function tauxMensuel(tauxAnnuelMilliemes: number): number {
  return tauxAnnuelMilliemes / 1000 / 12;
}

/**
 * LA MENSUALITÉ d'un prêt amortissable à taux fixe, en centimes entiers.
 *
 * m = C × i / (1 − (1 + i)^−n), avec i le taux mensuel proportionnel. À taux
 * nul, l'amortissement est linéaire et la formule se réduit à C / n — c'est
 * le cas de l'éco-PTZ, et il n'a rien d'exotique : diviser par zéro, si.
 */
export function mensualiteCents(
  capitalCents: number,
  tauxDebiteurMilliemes: number,
  dureeMois: number,
): number {
  if (dureeMois <= 0) return 0;
  const i = tauxMensuel(tauxDebiteurMilliemes);
  if (i === 0) return Math.round(capitalCents / dureeMois);
  return Math.round((capitalCents * i) / (1 - Math.pow(1 + i, -dureeMois)));
}

/**
 * LE TAEG, calculé depuis les flux — et non recopié de l'offre.
 *
 * On cherche le taux mensuel `i` qui annule la valeur actuelle nette :
 * le capital REÇU (capital emprunté moins les frais retenus) doit égaler la
 * somme des mensualités actualisées. La dichotomie suffit : la fonction est
 * strictement décroissante en `i`, et cinquante itérations donnent mieux
 * que le millionième — bien au-delà de la décimale qu'un contrat affiche.
 *
 * L'ANNUALISATION EST ACTUARIELLE : (1 + i)¹² − 1. Le taux « nominal »
 * 12 × i est un autre nombre, plus petit, et c'est celui que les publicités
 * confondent volontiers avec le TAEG. À 5,90 % débiteur, le TAEG hors frais
 * vaut 6,06 % — l'écart n'est pas une erreur d'arrondi.
 */
export function taegMilliemes(
  capitalCents: number,
  mensualiteCents: number,
  dureeMois: number,
  fraisRetenusCents = 0,
): number {
  const recu = capitalCents - fraisRetenusCents;
  if (recu <= 0 || dureeMois <= 0 || mensualiteCents <= 0) return 0;
  const valeurActuelle = (i: number): number => {
    if (i === 0) return mensualiteCents * dureeMois - recu;
    return (mensualiteCents * (1 - Math.pow(1 + i, -dureeMois))) / i - recu;
  };
  // Le total remboursé est-il seulement supérieur au capital reçu ? Sinon
  // le taux est négatif, et ce n'est plus un crédit — c'est une subvention.
  if (valeurActuelle(0) <= 0) return 0;
  let bas = 0;
  let haut = 1; // 100 % par MOIS : aucune offre légale n'en approche.
  for (let pas = 0; pas < 60; pas++) {
    const milieu = (bas + haut) / 2;
    if (valeurActuelle(milieu) > 0) bas = milieu;
    else haut = milieu;
  }
  const mensuel = (bas + haut) / 2;
  return Math.round((Math.pow(1 + mensuel, 12) - 1) * 1000 * 10) / 10;
}

/** Ce qui empêche d'afficher une mensualité — le refus, et sa raison. */
export interface RefusDeFinancement {
  code: string;
  message: string;
}

/** L'exemple représentatif — tout ce qu'une publicité chiffrée doit porter. */
export interface Financement {
  label: string;
  /** Le capital effectivement emprunté, apport déduit. */
  capitalEmprunteCents: number;
  mensualiteCents: number;
  /** L'assurance, à part : elle s'ajoute à la mensualité quand elle existe. */
  assuranceMensuelleCents: number;
  /** Ce que le client verse chaque mois, assurance comprise. */
  mensualiteTotaleCents: number;
  dureeMois: number;
  tauxDebiteurMilliemes: number;
  /** Le TAEG RECALCULÉ depuis les flux. */
  taegMilliemes: number;
  /** Le coût total du crédit — intérêts, frais et assurance comprise. */
  coutDuCreditCents: number;
  /** Le montant total dû par l'emprunteur. */
  montantTotalDuCents: number;
  /** La mention légale, mot pour mot. */
  mention: string;
  /** Les avertissements — écart de TAEG, usure invérifiable, durée longue. */
  avertissements: string[];
  /** La date du barème qui a servi, telle qu'elle doit s'afficher. */
  date: string;
}

/**
 * LE FINANCEMENT, ou le refus de l'afficher.
 *
 * Il rend l'exemple représentatif COMPLET ou rien : une mensualité seule
 * n'est pas une information incomplète, c'est une publicité illicite.
 */
export function computeFinancement(
  totalCents: number,
  offre: OffreDeCredit,
  bareme: BaremeFinancement = BAREME_FINANCEMENT_2026,
): Financement | RefusDeFinancement {
  const apport = Math.max(0, offre.apportCents ?? 0);
  const capital = totalCents - apport;
  if (capital <= 0) {
    return {
      code: 'rien-a-financer',
      message: 'L’apport couvre la totalité : il n’y a rien à financer, et donc rien à afficher.',
    };
  }
  if (!(offre.dureeMois > 0)) {
    return {
      code: 'duree-manquante',
      message:
        'Durée de remboursement manquante. Une mensualité sans durée ne veut rien dire — et une publicité qui montre l’une doit montrer l’autre (art. L312-6 du Code de la consommation).',
    };
  }
  if (offre.tauxDebiteurMilliemes < 0) {
    return {
      code: 'taux-negatif',
      message: 'Un taux débiteur négatif n’est pas un crédit. Vérifiez la saisie de l’offre.',
    };
  }

  const frais = Math.max(0, offre.fraisDossierCents ?? 0);
  const assurance =
    offre.assuranceObligatoire === false ? 0 : Math.max(0, offre.assuranceMensuelleCents ?? 0);
  const mensualite = mensualiteCents(capital, offre.tauxDebiteurMilliemes, offre.dureeMois);
  // LES FRAIS ET L'ASSURANCE OBLIGATOIRE ENTRENT DANS LE TAEG. C'est toute
  // la différence entre le taux débiteur, qui ne mesure que l'argent prêté,
  // et le TAEG, qui mesure ce que le crédit coûte vraiment.
  const taeg = taegMilliemes(capital, mensualite + assurance, offre.dureeMois, frais);
  const totalVerse = (mensualite + assurance) * offre.dureeMois + frais;
  const avertissements: string[] = [];

  const plafond = bareme.usure.find((tranche) => capital <= tranche.jusquACents);
  if (bareme.usure.length === 0) {
    // ON NE VALIDE PAS CE QU'ON N'A PAS VÉRIFIÉ. Se taire ici laisserait
    // croire que le taux a passé le contrôle de l'usure ; il n'a rien passé.
    avertissements.push(
      `Le taux d’usure n’est pas renseigné : la légalité du taux n’a PAS été vérifiée. Les seuils sont publiés chaque trimestre par la Banque de France (barème du ${bareme.date}).`,
    );
  } else if (plafond && taeg > plafond.tauxMilliemes) {
    return {
      code: 'usure-depassee',
      message: `TAEG de ${(taeg / 10).toFixed(2).replace('.', ',')} % pour un plafond d’usure à ${(plafond.tauxMilliemes / 10).toFixed(2).replace('.', ',')} % : cette offre ne peut pas être proposée. Le taux d’usure est un plafond légal, pas un objectif.`,
    };
  }

  if (offre.taegAnnonceMilliemes !== undefined) {
    const ecart = Math.abs(offre.taegAnnonceMilliemes - taeg);
    // Un dixième de point : au-delà, l'offre est mal saisie, et l'écart se
    // retrouverait sur le contrat.
    if (ecart > 1) {
      avertissements.push(
        `TAEG annoncé ${(offre.taegAnnonceMilliemes / 10).toFixed(2).replace('.', ',')} %, TAEG calculé sur les flux ${(taeg / 10).toFixed(2).replace('.', ',')} %. L’un des deux est faux — vérifiez les frais et l’assurance saisis.`,
      );
    }
  }

  if (offre.assuranceMensuelleCents && offre.assuranceObligatoire === false) {
    avertissements.push(
      'L’assurance emprunteur est FACULTATIVE ici : elle n’entre donc pas dans le TAEG, et elle s’ajoute à la mensualité si le client la souscrit.',
    );
  }

  return {
    label: offre.label,
    capitalEmprunteCents: capital,
    mensualiteCents: mensualite,
    assuranceMensuelleCents: assurance,
    mensualiteTotaleCents: mensualite + assurance,
    dureeMois: offre.dureeMois,
    tauxDebiteurMilliemes: offre.tauxDebiteurMilliemes,
    taegMilliemes: taeg,
    coutDuCreditCents: totalVerse - capital,
    montantTotalDuCents: totalVerse,
    mention: MENTION_LEGALE,
    avertissements,
    date: bareme.date,
  };
}

/** Ce que l'éco-PTZ dit d'une menuiserie — droit possible, ou raison du non. */
export interface Ecopret {
  /**
   * Le droit est-il OUVERT — même mot que `aides.ts`, et pour la même
   * raison. « Éligible » dirait que le client l'aura ; ouvert dit que rien
   * de ce qu'on a pu vérifier ne s'y oppose, et `conditionsNonVerifiees`
   * nomme le reste.
   */
  ouvert: boolean;
  /** Le plafond de prêt applicable, en euros. Zéro si non éligible. */
  plafondEuros: number;
  dureeMaxMois: number;
  /** La phrase à afficher — « peut ouvrir droit à », jamais « vous aurez ». */
  phrase: string;
  /** Les conditions que ce module ne peut PAS vérifier, nommées une à une. */
  conditionsNonVerifiees: string[];
  date: string;
}

/**
 * L'ÉCO-PTZ SUR LES PAROIS VITRÉES — et le piège qui coûte cher.
 *
 * Il n'est ouvert QU'EN REMPLACEMENT DE SIMPLE VITRAGE. Un client qui
 * remplace du double par du double performant peut toucher MaPrimeRénov' et
 * se voir refuser l'éco-PTZ pour la même fenêtre : les deux dispositifs ne
 * posent pas la même question. Le dire avant la signature est tout l'objet
 * de cette fonction.
 *
 * `remplaceDuSimpleVitrage` est DÉCLARÉ, parce que le configurateur ne
 * connaît que la fenêtre neuve. Absent, on ne suppose rien : la condition
 * part dans `conditionsNonVerifiees` et la phrase reste au conditionnel.
 */
export function ecoPret(
  config: JoineryConfiguration,
  contexte: {
    remplaceDuSimpleVitrage?: boolean;
    nombreDActions?: number;
    /**
     * La PERFORMANCE GLOBALE : un autre régime, pas un bouquet plus gros.
     * Elle suppose une étude énergétique du logement entier et vise un gain
     * chiffré — d'où son plafond à part, qu'aucun compte d'actions
     * n'atteint.
     */
    performanceGlobale?: boolean;
  } = {},
  catalog: PricingCatalog = DEFAULT_CATALOG,
  bareme: BaremeFinancement = BAREME_FINANCEMENT_2026,
): Ecopret {
  const uw = computeUw(config, catalog);
  // LES SEUILS DE LA FAMILLE, comme dans `aides.ts` : une fenêtre de toit
  // demande 1,5 et 0,36 là où une fenêtre verticale demande 1,3 et 0,30.
  const critere = critereTechniqueAides(uw, seuilsAidesDe(config.famille));
  const actions = contexte.nombreDActions ?? 1;
  const plafond = contexte.performanceGlobale
    ? bareme.ecoPtz.plafondBouquetEuros['performance-globale']
    : actions >= 3
      ? bareme.ecoPtz.plafondBouquetEuros['trois-et-plus']
      : actions === 2
        ? bareme.ecoPtz.plafondBouquetEuros.deux
        : bareme.ecoPtz.plafondParoisVitreesEuros;

  const refus = (phrase: string): Ecopret => ({
    ouvert: false,
    plafondEuros: 0,
    dureeMaxMois: bareme.ecoPtz.dureeMaxMois,
    phrase,
    conditionsNonVerifiees: [],
    date: bareme.date,
  });

  if (bareme.ecoPtz.etat === 'suspendu') {
    return refus(`L’éco-PTZ est suspendu à la date du barème (${bareme.date}).`);
  }
  if (!uw) {
    return refus(
      'L’éco-PTZ ne concerne pas cet ouvrage : il finance des travaux d’économie d’énergie, et celui-ci n’a pas de performance thermique à améliorer.',
    );
  }
  if (!critere.tenu) {
    return refus(
      `Cette menuiserie ne passe pas le critère technique : ${critere.manques.join(' et ')}. L’éco-PTZ demande la même performance que MaPrimeRénov’.`,
    );
  }
  if (contexte.remplaceDuSimpleVitrage === false) {
    // LE PIÈGE, dit en toutes lettres.
    return refus(
      'L’éco-PTZ sur les parois vitrées n’est ouvert QU’EN REMPLACEMENT DE SIMPLE VITRAGE. Remplacer du double par du double, même bien meilleur, n’y donne pas droit — alors que MaPrimeRénov’, elle, peut l’accepter.',
    );
  }

  const conditions = [
    'logement achevé depuis plus de deux ans et occupé en résidence principale',
    'travaux réalisés par un professionnel RGE',
    'demande déposée auprès d’une banque ayant signé la convention avec l’État',
  ];
  if (contexte.remplaceDuSimpleVitrage === undefined) {
    conditions.unshift(
      'remplacement de SIMPLE vitrage — la condition propre à l’éco-PTZ, et la plus souvent ratée',
    );
  }

  return {
    ouvert: true,
    plafondEuros: plafond,
    dureeMaxMois: bareme.ecoPtz.dureeMaxMois,
    phrase:
      `Ces travaux peuvent ouvrir droit à un éco-prêt à taux zéro, plafonné à ${plafond} € sur ` +
      `${Math.round(bareme.ecoPtz.dureeMaxMois / 12)} ans au plus, sans intérêts ni frais de dossier ` +
      `(dispositif ouvert jusqu’au ${bareme.ecoPtz.jusquAu}, barème du ${bareme.date}).`,
    conditionsNonVerifiees: conditions,
    date: bareme.date,
  };
}
