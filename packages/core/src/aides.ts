/**
 * Pourquoi ce fichier existe : l'aide décide de l'achat. Une fenêtre à
 * 900 € dont 180 € reviennent se vend, la même à 900 € nus se reporte à
 * l'an prochain. Et pourtant rien ne la calculait — le configurateur
 * affichait un Uw sans jamais dire ce qu'il ouvre.
 *
 * VERSIONNÉ DÈS SA NAISSANCE, et ce n'est pas une précaution de style :
 * MaPrimeRénov' a été SUSPENDUE du 1er janvier au 23 février 2026, puis
 * reprise recentrée. Un configurateur qui aurait codé ses montants en dur
 * aurait annoncé pendant sept semaines une aide qui n'existait pas. Le
 * barème vit donc dans une donnée datée, l'état du dispositif est un champ,
 * et tout affichage cite sa date.
 *
 * LA FORMULATION EST UNE RÈGLE, pas un goût : « peut ouvrir droit à »,
 * jamais « vous toucherez ». Ce module n'instruit pas de dossier, il ne
 * connaît ni les revenus réels, ni l'ancienneté du logement, ni le RGE de
 * l'artisan. Annoncer un montant au futur de l'indicatif, c'est promettre à
 * la place de l'Anah — et c'est le marchand qui répond de la promesse.
 * `estimation.test.ts` vérifie qu'aucun libellé de ce fichier ne contient
 * de formulation contractuelle.
 *
 * LE CRITÈRE EST DOUBLE, et c'est le piège que le lot 0 avait signalé :
 * `Uw ≤ 1,3` ET `Sw ≥ 0,30`. Un triple vitrage peut passer le Uw haut la
 * main et rater le Sw — trois verres laissent entrer moins de soleil. Un
 * configurateur qui n'affiche que le Uw annonce éligible une menuiserie
 * qu'un dossier refusera, et le client l'apprendra après avoir signé.
 *
 * Aucune horloge, aucun DOM, aucun aléa. La DATE du barème est une donnée
 * d'entrée, jamais `Date.now()` : un devis rejoué six mois plus tard doit
 * rendre exactement ce qu'il rendait.
 */

import type { JoineryConfiguration } from './types.ts';
import { DEFAULT_CATALOG, type PricingCatalog } from './catalog.ts';
import { computeUw, critereTechniqueAides, seuilsAidesDe } from './thermal.ts';

/**
 * LA TRANCHE DE REVENUS de l'Anah. Elle décide du montant ET du plafond
 * d'écrêtement. `superieurs` n'ouvre aucun droit au geste isolé depuis le
 * recentrage — ce n'est pas un oubli, c'est le barème.
 */
export type TrancheRevenus = 'tres-modestes' | 'modestes' | 'intermediaires' | 'superieurs';

/**
 * L'ÉTAT DU DISPOSITIF. `suspendu` n'est pas `inconnu` : suspendu veut dire
 * qu'on SAIT qu'il ne verse rien, inconnu qu'on ne sait pas. Les deux
 * s'affichent différemment — l'un dit « pas en ce moment », l'autre
 * « vérifiez ».
 */
export type EtatDispositif = 'actif' | 'suspendu' | 'inconnu';

/**
 * LE BARÈME, tel qu'il est à une DATE donnée. C'est une donnée d'entrée du
 * calcul, jamais une constante compilée : voir l'en-tête.
 */
export interface BaremeAides {
  /** La date de validité, en ISO — elle s'affiche avec chaque montant. */
  date: string;
  /** La version du fichier de données dont il est tiré. */
  version: string;
  maPrimeRenov: {
    etat: EtatDispositif;
    /** Le montant par équipement, en euros. `null` = pas de droit. */
    parEquipementEuros: Record<TrancheRevenus, number | null>;
    /** Le plafond de dépense éligible PAR équipement, en euros. */
    plafondDepenseEuros: number;
    /** Le critère technique, et il est DOUBLE. */
    uwMax: number;
    swMin: number;
  };
  cee: {
    etat: EtatDispositif;
    /** La fourchette par menuiserie — elle dépend de l'opérateur. */
    minEuros: number;
    maxEuros: number;
  };
  /** Le taux de TVA réduite applicable à la fourniture posée. */
  tvaReduite: number;
  /**
   * L'ÉCRÊTEMENT : la part maximale de la dépense que le cumul des aides
   * peut couvrir. Sans lui, on annoncerait des cumuls impossibles.
   */
  ecretement: Record<TrancheRevenus, number>;
}

/**
 * LE BARÈME 2026, tiré de `ressources/donnees/marche-et-aides.json` v1.0.0
 * (Anah, Guide des aides financières 2026, édition février 2026).
 *
 * Il est ici en TypeScript et pas lu depuis le JSON à l'exécution : le
 * cœur n'a pas de système de fichiers, il tourne aussi bien dans un
 * navigateur, et le portage PHP le recopie. La donnée reste la source, ce
 * bloc en est la transcription — et sa `version` dit laquelle.
 *
 * `etat: 'actif'` décrit la situation à la DATE portée ci-dessous. Un
 * marchand qui déploie plus tard passe son propre barème : c'est
 * exactement pourquoi `computeAides()` en prend un en paramètre.
 */
export const BAREME_2026: BaremeAides = {
  date: '2026-02',
  version: '1.0.0',
  maPrimeRenov: {
    etat: 'actif',
    parEquipementEuros: {
      'tres-modestes': 100,
      modestes: 80,
      intermediaires: 40,
      // Le recentrage de 2026 a sorti les revenus supérieurs du geste
      // isolé. `null` et non `0` : l'un dit « pas de droit », l'autre
      // « un droit qui vaut zéro », et l'affichage ne les dit pas pareil.
      superieurs: null,
    },
    plafondDepenseEuros: 1000,
    uwMax: 1.3,
    swMin: 0.3,
  },
  cee: { etat: 'actif', minEuros: 30, maxEuros: 100 },
  tvaReduite: 0.055,
  ecretement: {
    'tres-modestes': 0.9,
    modestes: 0.75,
    intermediaires: 0.6,
    // Sans droit à MaPrimeRénov', il n'y a pas de cumul à écrêter : le
    // plafond ne mord pas, et 1 le dit sans cas particulier.
    superieurs: 1,
  },
};

export interface LigneAide {
  /** Le dispositif — « MaPrimeRénov' », « CEE ». */
  dispositif: string;
  /** La fourchette en euros. Les deux bornes sont égales quand c'est fixe. */
  minEuros: number;
  maxEuros: number;
  /** Ce qui a rendu ce droit possible, ou ce qui le bloque. */
  motif: string;
  /** Vrai quand le droit est ouvert ; faux quand la ligne EXPLIQUE un refus. */
  ouvert: boolean;
}

export interface RapportAides {
  /** La date du barème — elle s'affiche AVEC les montants, toujours. */
  dateBareme: string;
  versionBareme: string;
  lignes: LigneAide[];
  /** Le cumul, écrêtement appliqué. Zéro quand rien n'est ouvert. */
  cumulMinEuros: number;
  cumulMaxEuros: number;
  /** Vrai si l'écrêtement a mordu — le dire évite un « pourquoi si peu ? ». */
  ecrete: boolean;
  /**
   * LA PHRASE à afficher, déjà écrite. Elle est ici et pas dans l'interface
   * pour que la règle de formulation tienne en UN endroit vérifiable :
   * « peut ouvrir droit à », jamais « vous toucherez ».
   */
  phrase: string;
  /** Le taux de TVA applicable — réduit si le contexte le permet. */
  tauxTva: number;
}

/** Ce que le client déclare, et que le configurateur ne peut pas deviner. */
export interface ContexteAides {
  tranche: TrancheRevenus;
  /** Le logement a-t-il plus de quinze ans ? Condition de MaPrimeRénov'. */
  logementDePlusDe15Ans?: boolean;
  /** Remplace-t-on du simple vitrage ? Condition du geste isolé. */
  remplaceSimpleVitrage?: boolean;
  /** L'artisan est-il RGE ? Sans lui, aucune aide n'est mobilisable. */
  artisanRge?: boolean;
  /** Le prix de la fourniture posée, en centimes — pour le plafond. */
  prixPoseCents?: number;
}

/**
 * CE QUE CETTE MENUISERIE PEUT OUVRIR — jamais ce qu'elle rapportera.
 *
 * Rend TOUJOURS un rapport, même quand rien n'est ouvert : les lignes
 * fermées portent leur motif, et c'est ce qui permet à un écran de dire
 * « il vous manque ceci » plutôt que de n'afficher rien du tout. Un silence
 * ne se corrige pas.
 */
export function computeAides(
  config: JoineryConfiguration,
  contexte: ContexteAides,
  bareme: BaremeAides = BAREME_2026,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): RapportAides {
  const lignes: LigneAide[] = [];
  const uw = computeUw(config, catalog);
  const mpr = bareme.maPrimeRenov;

  // --- MaPrimeRénov'
  const montant = mpr.parEquipementEuros[contexte.tranche];
  const conditions = conditionsManquantes(contexte);

  if (mpr.etat === 'suspendu') {
    // LE CAS DE 2026, et il doit s'afficher. Sept semaines de suspension
    // pendant lesquelles un configurateur silencieux aurait vendu sur une
    // aide inexistante.
    lignes.push({
      dispositif: 'MaPrimeRénov’',
      minEuros: 0,
      maxEuros: 0,
      motif: `Dispositif suspendu à la date du barème (${bareme.date}) — le prix affiché ne compte aucune aide.`,
      ouvert: false,
    });
  } else if (mpr.etat === 'inconnu') {
    lignes.push({
      dispositif: 'MaPrimeRénov’',
      minEuros: 0,
      maxEuros: 0,
      motif: 'État du dispositif non vérifié à cette date — à confirmer auprès de l’Anah.',
      ouvert: false,
    });
  } else if (!uw) {
    lignes.push({
      dispositif: 'MaPrimeRénov’',
      minEuros: 0,
      maxEuros: 0,
      motif: 'Sans vitrage, la menuiserie ne relève pas du geste « parois vitrées ».',
      ouvert: false,
    });
  } else if (montant === null) {
    lignes.push({
      dispositif: 'MaPrimeRénov’',
      minEuros: 0,
      maxEuros: 0,
      motif: 'Le geste isolé ne vise plus les revenus supérieurs depuis le recentrage de 2026.',
      ouvert: false,
    });
  } else {
    // LE CRITÈRE DOUBLE — calculé par `thermal.ts`, et pas ici. Il vit
    // là-bas parce qu'il ne dépend que de la menuiserie et qu'il s'affiche
    // dès la première seconde, alors que le MONTANT demande des réponses.
    // Deux implémentations du même seuil finiraient par diverger, et c'est
    // sur un seuil d'aide que la divergence se paierait le plus cher.
    // LES SEUILS DE LA FAMILLE, et pas ceux du barème général : une fenêtre
    // de toit demande 1,5 et 0,36 là où une fenêtre verticale demande 1,3
    // et 0,30. Le barème porte les seuils de la fenêtre courante ; la
    // famille les remplace quand elle en a d'autres.
    const seuilsFamille = seuilsAidesDe(config.famille);
    const critere = critereTechniqueAides(uw, {
      uwMax: config.famille === 'fenetre-toit' ? seuilsFamille.uwMax : mpr.uwMax,
      swMin: config.famille === 'fenetre-toit' ? seuilsFamille.swMin : mpr.swMin,
      date: bareme.date,
    });
    if (!critere.tenu) {
      lignes.push({
        dispositif: 'MaPrimeRénov’',
        minEuros: 0,
        maxEuros: 0,
        motif: `Critère technique non atteint : ${critere.manques.join(' et ')}.`,
        ouvert: false,
      });
    } else if (conditions.length > 0) {
      lignes.push({
        dispositif: 'MaPrimeRénov’',
        minEuros: 0,
        maxEuros: 0,
        motif: `Critère technique atteint (Uw ${virgule(uw.uw)}, Sw ${virgule(uw.sw)}), mais ${conditions.join(', ')}.`,
        ouvert: false,
      });
    } else {
      // LE PLAFOND DE DÉPENSE. Il mord sur les menuiseries bon marché : une
      // fenêtre posée à 700 € plafonne l'assiette à 700, pas à 1 000.
      const assietteEuros =
        contexte.prixPoseCents !== undefined
          ? Math.min(mpr.plafondDepenseEuros, contexte.prixPoseCents / 100)
          : mpr.plafondDepenseEuros;
      // Le montant du geste isolé est FORFAITAIRE par équipement, dans la
      // limite de l'assiette. Il ne se proratise pas.
      const verse = Math.min(montant, assietteEuros);
      lignes.push({
        dispositif: 'MaPrimeRénov’',
        minEuros: verse,
        maxEuros: verse,
        motif: `Uw ${virgule(uw.uw)} ≤ ${virgule(mpr.uwMax)} et Sw ${virgule(uw.sw)} ≥ ${virgule(mpr.swMin)} — les deux critères sont tenus.`,
        ouvert: true,
      });
    }
  }

  // --- CEE. Ils ne posent pas de critère technique propre au niveau où on
  // travaille, mais ils dépendent de l'opérateur, de la zone climatique et
  // des revenus : la fourchette est LARGE, et l'annoncer étroite serait
  // mentir. Trois fois plus haut d'un opérateur à l'autre, c'est le genre
  // d'écart qui fait changer de fournisseur.
  if (bareme.cee.etat === 'actif' && uw && conditions.length === 0) {
    lignes.push({
      dispositif: 'CEE',
      minEuros: bareme.cee.minEuros,
      maxEuros: bareme.cee.maxEuros,
      motif: 'Montant variable selon l’opérateur, la zone climatique et les revenus — à faire chiffrer.',
      ouvert: true,
    });
  } else if (bareme.cee.etat !== 'actif') {
    lignes.push({
      dispositif: 'CEE',
      minEuros: 0,
      maxEuros: 0,
      motif: `Dispositif ${bareme.cee.etat} à la date du barème (${bareme.date}).`,
      ouvert: false,
    });
  }

  // --- L'ÉCRÊTEMENT. Le cumul ne peut pas dépasser une part de la dépense.
  const brutMin = lignes.reduce((somme, ligne) => somme + ligne.minEuros, 0);
  const brutMax = lignes.reduce((somme, ligne) => somme + ligne.maxEuros, 0);
  const depenseEuros = contexte.prixPoseCents !== undefined ? contexte.prixPoseCents / 100 : null;
  const plafondCumul =
    depenseEuros !== null ? depenseEuros * bareme.ecretement[contexte.tranche] : Infinity;
  const cumulMinEuros = Math.round(Math.min(brutMin, plafondCumul));
  const cumulMaxEuros = Math.round(Math.min(brutMax, plafondCumul));
  const ecrete = brutMax > plafondCumul;

  return {
    dateBareme: bareme.date,
    versionBareme: bareme.version,
    lignes,
    cumulMinEuros,
    cumulMaxEuros,
    ecrete,
    phrase: phraseDe(cumulMinEuros, cumulMaxEuros, bareme.date, ecrete),
    tauxTva: tvaApplicable(contexte, bareme),
  };
}

/**
 * LA PHRASE, écrite ici et nulle part ailleurs.
 *
 * « Peut ouvrir droit à », au conditionnel de possibilité. Jamais « vous
 * toucherez », jamais « vous recevrez », jamais « aide déduite ». Et
 * toujours la date : un montant d'aide sans sa date est faux six mois plus
 * tard, et il aura l'air vrai.
 */
function phraseDe(minEuros: number, maxEuros: number, date: string, ecrete: boolean): string {
  if (maxEuros <= 0) {
    return `Cette configuration n’ouvre pas de droit aux aides au barème de ${date}.`;
  }
  const montant =
    minEuros === maxEuros ? `${minEuros} €` : `${minEuros} à ${maxEuros} €`;
  const suffixe = ecrete
    ? ' Le cumul est plafonné par l’écrêtement réglementaire.'
    : '';
  return (
    `Cette configuration peut ouvrir droit à ${montant} d’aides, ` +
    `sous conditions et au barème de ${date}. Montant à confirmer lors de l’instruction du dossier.${suffixe}`
  );
}

/** Les conditions déclaratives qui manquent — nommées, pour se corriger. */
function conditionsManquantes(contexte: ContexteAides): string[] {
  const manques: string[] = [];
  if (contexte.logementDePlusDe15Ans === false) manques.push('le logement a moins de quinze ans');
  if (contexte.remplaceSimpleVitrage === false) manques.push('il ne s’agit pas d’un remplacement de simple vitrage');
  if (contexte.artisanRge === false) manques.push('la pose n’est pas confiée à un artisan RGE');
  return manques;
}

/**
 * LE TAUX DE TVA. Réduit dès que le logement a plus de deux ans et que la
 * pose est confiée à un professionnel — c'est-à-dire dans le cas courant de
 * la rénovation. Il ne dépend PAS des revenus, contrairement à ce qu'on lit
 * souvent : c'est un taux de travaux, pas une aide.
 */
function tvaApplicable(contexte: ContexteAides, bareme: BaremeAides): number {
  if (contexte.logementDePlusDe15Ans === false) return 0.2;
  if (contexte.artisanRge === false) return 0.2;
  return bareme.tvaReduite;
}

/**
 * La virgule décimale française — un Uw s'écrit 1,30 et jamais 1.3.
 *
 * Deux décimales toujours, y compris les zéros : c'est ainsi que les
 * seuils sont écrits dans le guide de l'Anah, et un client qui compare son
 * chiffre au seuil doit voir deux nombres de même forme.
 */
function virgule(x: number): string {
  return x.toFixed(2).replace('.', ',');
}
