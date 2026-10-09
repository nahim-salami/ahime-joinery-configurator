/**
 * Pourquoi ce fichier existe : c'est la pièce que le payeur achète. Tout le
 * reste — le prix, le dessin, la 3D — sert à décider ; le manifeste sert à
 * FABRIQUER. Il est le seul document du projet qui parte à l'atelier, et
 * c'est pour cela qu'il est le seul à porter un VERROU.
 *
 * LE VERROU, et il n'est pas négociable : le manifeste refuse de s'émettre
 * tant que les cotes ne sont pas VALIDÉES. Trois états, et ils ne se valent
 * pas :
 *
 *   - `declaree` — le client a saisi des chiffres. Il a mesuré au mètre
 *     ruban, entre deux tapisseries, sans savoir si son tableau est
 *     d'équerre. C'est une INTENTION, pas une cote.
 *   - `confirmee` — quelqu'un du métier a relu. Les cotes sont plausibles,
 *     la pose est cohérente, mais personne n'est allé sur place.
 *   - `validee` — un métreur a pris les cotes lui-même, sur le chantier,
 *     et il en répond.
 *
 * Fabriquer sur une cote `declaree` est le rebut le plus cher du métier :
 * la menuiserie est faite, laquée, vitrée, livrée — et elle n'entre pas.
 * Personne ne la reprend, et c'est le marchand qui la paie. Le
 * configurateur peut donc TOUT faire sur une cote déclarée : chiffrer,
 * dessiner, montrer en volume, éditer un devis. Tout, sauf émettre l'ordre
 * de fabrication.
 *
 * Solution écartée : un avertissement, et l'émission quand même. C'est ce
 * que font la plupart des outils, et c'est ce qui explique le taux de rebut
 * du métier. Un avertissement qu'on peut ignorer est ignoré — pas par
 * négligence, mais parce que la personne qui clique n'est jamais celle qui
 * paie le rebut. Le refus, lui, oblige à une décision tracée.
 *
 * Solution écartée aussi : rendre un manifeste partiel, marqué « brouillon ».
 * Un fichier JSON qui existe finit dans une machine — le format ne porte pas
 * son propre avertissement jusqu'à la commande numérique.
 *
 * DÉTERMINISME : mêmes entrées, même octet. C'est ce qui permet de comparer
 * deux manifestes, de détecter une dérive de catalogue, et de rejouer une
 * commande six mois plus tard. Aucune date, aucun identifiant tiré au sort,
 * aucun ordre de clé qui dépende de l'insertion — les clés sont écrites
 * dans l'ordre où ce fichier les écrit, et les tableaux dans l'ordre où
 * leurs producteurs les rendent.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { JoineryConfiguration, ValidationIssue } from '../types.ts';
import { DEFAULT_CATALOG, type PricingCatalog } from '../catalog.ts';
import { computeMeasureReport } from '../structural.ts';
import { validateConfiguration } from '../validate.ts';
import { computeNomenclature, type LigneNomenclature } from './nomenclature.ts';

/**
 * L'ÉTAT D'UNE COTE — qui l'a prise, et qui en répond. Voir l'en-tête : ce
 * n'est pas une nuance de vocabulaire, c'est ce qui décide si l'atelier a le
 * droit de couper.
 */
export type EtatDesCotes = 'declaree' | 'confirmee' | 'validee';

/** Le schéma du manifeste. Il VERSIONNE : une machine doit pouvoir refuser. */
export const SCHEMA_MANIFESTE = 'ahjc-fabrication/1';

export interface Manifeste {
  schema: typeof SCHEMA_MANIFESTE;
  /** La version du catalogue qui a produit ces cotes — jamais implicite. */
  versionCatalogue: string;
  /** Le repère de l'ouvrage dans son chantier : M1, M2… */
  repere: string;
  etatDesCotes: EtatDesCotes;
  /** Ce que le client a choisi, tel quel — la source de tout le reste. */
  configuration: JoineryConfiguration;
  /**
   * LA CHAÎNE DE COTES, étage par étage. C'est le cœur du document : chaque
   * étage se déduit du précédent par une opération écrite, et l'atelier peut
   * refaire la descente de tête.
   */
  cotes: {
    /** Ce que le client a mesuré dans son mur. */
    tableau: { widthMm: number; heightMm: number };
    /** Le hors-tout du dormant — ce qui se commande. */
    fabrication: { widthMm: number; heightMm: number };
    /** Le cadre d'ouvrant hors tout, par vantail — la cote de débit. */
    ouvrant: { widthMm: number; heightMm: number } | null;
    /** Le logement du vitrage, par vantail. */
    fondDeFeuillure: { widthMm: number; heightMm: number } | null;
    /** Ce qu'on commande au verrier, par vantail. */
    vitrage: { widthMm: number; heightMm: number } | null;
    /** Le clair réellement vu, par vantail — ce que le client regarde. */
    clair: { widthMm: number; heightMm: number } | null;
    /** Le refend compté une fois par intervalle. */
    battementMm: number;
    /** La masse vue retenue par côté. */
    masseVueMm: number;
  };
  /** La nomenclature, ligne à ligne, chacune avec sa règle. */
  pieces: LigneNomenclature[];
  /** Les poids, pour la manutention et pour le transporteur. */
  poids: { vantailKg: number; vitrageKg: number };
  /**
   * LES CONTRÔLES à faire avant expédition, avec leur tolérance. Ils sont
   * dans le manifeste et pas dans une procédure à part, pour la même raison
   * que la règle est dans chaque ligne de nomenclature : un contrôle qu'il
   * faut aller chercher ailleurs n'est pas fait.
   */
  controles: {
    /** Écart maximal entre les deux diagonales, en mm — NF DTU 36.5. */
    equerrageMaxMm: number;
    /** Tolérance sur le hors-tout, en mm. */
    horsToutMm: number;
    /** Tolérance sur la cote de vitrage — le verrier ne reprend pas. */
    vitrageMm: number;
  };
}

/**
 * LE REFUS. Il n'est pas une erreur technique : c'est une décision du
 * document, et elle se lit.
 */
export interface RefusManifeste {
  /** Ce qui bloque, en une phrase adressée à qui peut le débloquer. */
  motif: string;
  /** Le code, pour qu'une interface sache quoi proposer. */
  code: 'cotes-non-validees' | 'configuration-invalide' | 'nomenclature-incomplete';
  /** Le détail — les refus de validation, les lacunes de nomenclature. */
  details: string[];
}

export type ResultatManifeste =
  | { emis: true; manifeste: Manifeste }
  | { emis: false; refus: RefusManifeste };

/**
 * LES TOLÉRANCES d'atelier, en mm. Elles viennent de NF DTU 36.5 pour
 * l'équerrage et des usages de la filière pour le reste. Un vitrage est la
 * cote la plus serrée : le verrier coupe à ±1 mm et ne reprend pas une
 * erreur de commande.
 */
const CONTROLES = { equerrageMaxMm: 3, horsToutMm: 2.5, vitrageMm: 1 } as const;

/**
 * LE MANIFESTE DE FABRICATION, ou le refus qui dit pourquoi.
 *
 * Il n'y a pas de troisième issue, et pas de version dégradée : voir
 * l'en-tête. Un appelant qui veut montrer quelque chose à l'écran avant la
 * validation dispose déjà de tout — le rapport de mesure, la nomenclature,
 * la fiche de débit. Ce qu'il n'a pas, c'est l'ordre de couper.
 */
export function computeManifeste(
  config: JoineryConfiguration,
  options: {
    etatDesCotes: EtatDesCotes;
    repere?: string;
    /** La version du catalogue, telle que le marchand la nomme. */
    versionCatalogue?: string;
  },
  catalog: PricingCatalog = DEFAULT_CATALOG,
): ResultatManifeste {
  // LE VERROU, en premier. Avant de calculer quoi que ce soit : un manifeste
  // refusé ne doit pas laisser croire, par le temps qu'il a mis, qu'il a
  // presque abouti.
  if (options.etatDesCotes !== 'validee') {
    return {
      emis: false,
      refus: {
        code: 'cotes-non-validees',
        motif:
          options.etatDesCotes === 'declaree'
            ? 'Les cotes sont DÉCLARÉES par le client : personne du métier ne les a vérifiées. ' +
              'Un métré est nécessaire avant de lancer la fabrication.'
            : 'Les cotes sont CONFIRMÉES sur plan, mais personne n’est allé mesurer sur place. ' +
              'Un métré contradictoire est nécessaire avant de lancer la fabrication.',
        details: [
          'La fabrication sur cote non validée est le rebut le plus cher du métier : ' +
            'la menuiserie est faite, laquée, vitrée, livrée — et elle n’entre pas.',
        ],
      },
    };
  }

  // LES REFUS DE FABRICABILITÉ. Une configuration qu'on refuse de vendre ne
  // se fabrique pas davantage.
  const issues = validateConfiguration(config, catalog);
  const erreurs = issues.filter((issue: ValidationIssue) => issue.severite === 'erreur');
  if (erreurs.length > 0) {
    return {
      emis: false,
      refus: {
        code: 'configuration-invalide',
        motif: `${erreurs.length} refus de fabricabilité — la configuration n’est pas fabricable en l’état.`,
        details: erreurs.map((issue) => `${issue.code} : ${issue.message}`),
      },
    };
  }

  const repere = options.repere ?? '';
  const nomenclature = computeNomenclature(config, catalog, { repere });
  // L'INVARIANT DE LA NOMENCLATURE. Une liste incomplète qui se présente
  // comme complète fait fabriquer un ouvrage auquel il manque une pièce, et
  // l'atelier ne s'en aperçoit qu'au montage.
  if (nomenclature.lacunes.length > 0) {
    return {
      emis: false,
      refus: {
        code: 'nomenclature-incomplete',
        motif:
          `La nomenclature ne sait pas produire ${nomenclature.lacunes.length} élément(s) : ` +
          'l’atelier recevrait une liste incomplète sans le savoir.',
        details: nomenclature.lacunes,
      },
    };
  }

  const mesure = computeMeasureReport(config, catalog);
  const chaine = mesure.chaineDeCotes;

  return {
    emis: true,
    manifeste: {
      schema: SCHEMA_MANIFESTE,
      versionCatalogue: options.versionCatalogue ?? catalog.version,
      repere,
      etatDesCotes: options.etatDesCotes,
      configuration: config,
      cotes: {
        // LE TABLEAU est la cote du MUR, et elle n'est pas celle de la
        // fabrication : en rénovation, le dormant se loge dans l'ancien
        // cadre. `computeMeasureReport` a déjà fait cette conversion, et le
        // manifeste ne la refait pas — une seconde conversion serait une
        // seconde vérité.
        tableau: { widthMm: mesure.widthMm, heightMm: mesure.heightMm },
        fabrication: chaine?.dimensionFabrication ?? {
          widthMm: mesure.widthMm,
          heightMm: mesure.heightMm,
        },
        ouvrant: chaine?.ouvrant ?? null,
        fondDeFeuillure: chaine?.fondDeFeuillure ?? null,
        vitrage: chaine?.coteVitrage ?? null,
        clair: mesure.clairVitrage,
        battementMm: chaine?.battementMm ?? 0,
        masseVueMm: chaine?.masseVueMm ?? 0,
      },
      pieces: nomenclature.lignes,
      poids: {
        vantailKg: mesure.poidsVantailKg,
        vitrageKg: mesure.glassWeightKg,
      },
      controles: { ...CONTROLES },
    },
  };
}

/**
 * LE MANIFESTE EN JSON, avec un ordre de clés STABLE.
 *
 * `JSON.stringify` suit l'ordre d'insertion, qui est celui de ce fichier —
 * donc déterministe tant que personne ne construit un manifeste autrement.
 * Le remplaçant trie explicitement les clés d'objet, ce qui rend le
 * document comparable même si l'ordre d'insertion changeait un jour.
 * Deux entrées identiques doivent produire le MÊME OCTET : c'est ce qui
 * permet de détecter une dérive de catalogue entre deux commandes.
 */
export function manifesteVersJson(manifeste: Manifeste): string {
  return JSON.stringify(manifeste, cleTriee, 2);
}

function cleTriee(_cle: string, valeur: unknown): unknown {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return valeur;
  const objet = valeur as Record<string, unknown>;
  const trie: Record<string, unknown> = {};
  for (const cle of Object.keys(objet).sort()) trie[cle] = objet[cle];
  return trie;
}
