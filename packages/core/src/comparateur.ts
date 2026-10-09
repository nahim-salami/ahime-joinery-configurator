/**
 * Pourquoi ce fichier existe : personne n'offre ce comparateur, et c'est le
 * trou de marché que docs/14 a nommé. Un client qui configure une fenêtre
 * choisit une gamme sans savoir ce que l'autre lui aurait donné : il voit
 * un prix, un Uw, et il tranche au hasard ou au budget. Or les trois
 * réponses existent, elles se calculent avec le moteur qu'on a déjà, et
 * elles se comparent sur quatre nombres.
 *
 * LE QUATRIÈME NOMBRE EST LE PLUS IMPORTANT, et c'est celui que personne
 * n'affiche : LE UW EN EUROS. Un client ne sait pas ce que vaut 0,3 de Uw ;
 * il sait ce que valent quarante euros par an. Le calcul est grossier — il
 * l'assume — mais il transforme un coefficient physique en une décision.
 *
 *   économie = (Uw_avant − Uw_après) × surface × DJU × 24 / 1000 × prix
 *
 * Approximatif et honnête vaut mieux que juste et invisible : les
 * hypothèses voyagent avec le chiffre, et il n'y a pas de chiffre sans
 * elles.
 *
 * Solution écartée : une simulation thermique dynamique du logement. Elle
 * demande l'orientation, l'inertie, le comportement des occupants et une
 * année météo — c'est un bureau d'études, et il facture ce qu'il vaut. Le
 * degré-jour unifié est ce que la filière utilise pour une comparaison
 * AVANT/APRÈS sur un même logement, et c'est exactement l'usage ici : ce
 * qu'on compare, ce sont deux fenêtres au même endroit, et tout ce qui les
 * entoure s'annule.
 *
 * Solution écartée aussi : afficher un temps de retour sur investissement.
 * Il fait vendre, et il est presque toujours faux — il dépend du prix de
 * l'énergie dans quinze ans. On donne l'économie annuelle, avec son prix
 * d'énergie affiché ; qui veut diviser divise.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { Gamme, JoineryConfiguration } from './types.ts';
import { DEFAULT_CATALOG, type PricingCatalog } from './catalog.ts';
import { computeAides, BAREME_2026, type BaremeAides, type ContexteAides, type RapportAides } from './aides.ts';
import { computeAcoustique } from './acoustique.ts';
import { computePrice } from './pricing.ts';
import { computeUw } from './thermal.ts';
import { countErrors, validateConfiguration } from './validate.ts';

/**
 * LE DEGRÉ-JOUR UNIFIÉ de chauffage, moyenne française — environ 2 500 sur
 * une base de 18 °C. Il vaut 1 800 à Nice et 3 200 à Strasbourg ; on prend
 * la moyenne et on l'AFFICHE, parce qu'un client de Nice doit pouvoir
 * corriger de tête.
 */
export const DJU_FRANCE = 2500;

/**
 * Le prix du kilowattheure de chauffage, en euros. Le gaz est autour de
 * 0,11 €, l'électricité de 0,25 € : on retient une valeur mixte, et on la
 * déclare. C'est le paramètre que le marchand ajustera le plus souvent.
 */
export const PRIX_KWH_EUROS = 0.14;

/**
 * Le Uw d'une menuiserie ANCIENNE, simple vitrage bois ou métal — la
 * situation de départ d'une rénovation. Entre 4,5 et 6 selon l'état des
 * joints ; 5,0 est la valeur que la filière retient pour un ordre de
 * grandeur.
 */
export const UW_SIMPLE_VITRAGE = 5.0;

export interface Offre {
  gamme: Gamme;
  /** La configuration exacte de cette offre — fabricable, et vérifiée. */
  config: JoineryConfiguration;
  /** Le prix, en centimes, arrondi comme le devis l'arrondira. */
  prixCents: number;
  uw: number | null;
  sw: number | null;
  /** L'affaiblissement acoustique de la fenêtre entière, en dB. */
  rwDb: number | null;
  aides: RapportAides;
  /**
   * L'ÉCONOMIE DE CHAUFFAGE ANNUELLE, en euros, par rapport à la menuiserie
   * de départ. Elle est nulle quand il n'y a pas de vitrage à comparer.
   */
  economieAnnuelleEuros: number | null;
  /** Ce que l'offre a de bloquant. Vide sur une offre proposable. */
  refus: string[];
  /** Les hypothèses du calcul d'économie — jamais un chiffre nu. */
  hypotheses: string[];
}

export interface Comparatif {
  offres: Offre[];
  /** La menuiserie de départ, celle qu'on remplace. */
  uwAvant: number;
  /** Le prix du kWh et le DJU retenus — affichés, donc corrigeables. */
  prixKwhEuros: number;
  dju: number;
}

/**
 * LES TROIS OFFRES de la même ouverture — éco, confort, performance.
 *
 * Le principe est de ne changer QUE ce qui distingue une gamme : le
 * système de profilé et le vitrage. Les cotes, la famille, l'ouverture, le
 * nombre de vantaux et la couleur restent ceux du client, parce que c'est
 * SA fenêtre qu'on lui montre en trois versions, pas trois fenêtres.
 *
 * Une offre qui ne se fabrique pas est rendue quand même, avec ses refus :
 * la faire disparaître laisserait croire qu'elle n'existe pas, alors qu'elle
 * existe et qu'elle demande autre chose (un vantail de plus, un matériau
 * différent). Un écran peut la griser ; il ne peut pas l'inventer.
 */
export function computeComparatif(
  config: JoineryConfiguration,
  contexte: ContexteAides,
  bareme: BaremeAides = BAREME_2026,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): Comparatif {
  const uwAvant = UW_SIMPLE_VITRAGE;
  const offres = (['standard', 'confort', 'performance'] as Gamme[]).map((gamme) =>
    offreDe(config, gamme, contexte, bareme, catalog, uwAvant),
  );
  return { offres, uwAvant, prixKwhEuros: PRIX_KWH_EUROS, dju: DJU_FRANCE };
}

function offreDe(
  base: JoineryConfiguration,
  gamme: Gamme,
  contexte: ContexteAides,
  bareme: BaremeAides,
  catalog: PricingCatalog,
  uwAvant: number,
): Offre {
  // LE VITRAGE SUIT LA GAMME, et c'est ce qui rend la comparaison honnête :
  // comparer trois profilés sous le même 4/16/4 montrerait des écarts de Uw
  // de quelques centièmes, et donnerait à croire que la gamme ne sert à
  // rien. Ce qu'un marchand vend, c'est un ENSEMBLE cohérent.
  const config: JoineryConfiguration = {
    ...base,
    gamme,
    // Le système nommé du client ne vaut que pour SA gamme : on le retire,
    // et `thermal.ts` retombe alors sur la table par matériau × palier.
    systeme: undefined,
    vitrage: { ...(base.vitrage ?? { base: 'double' }), ...VITRAGE_DE_GAMME[gamme] },
  };

  const issues = validateConfiguration(config, catalog);
  const refus = issues
    .filter((issue) => issue.severite === 'erreur')
    .map((issue) => issue.message);

  const uw = computeUw(config, catalog);
  const acoustique = computeAcoustique(config, catalog);
  const prixCents = countErrors(issues) > 0 ? 0 : computePrice(config, catalog).totalCents;
  const aides = computeAides(config, { ...contexte, prixPoseCents: prixCents }, bareme, catalog);

  const surfaceM2 = (config.widthMm * config.heightMm) / 1_000_000;
  const economieAnnuelleEuros = uw
    ? Math.round(((uwAvant - uw.uw) * surfaceM2 * DJU_FRANCE * 24 * PRIX_KWH_EUROS) / 1000)
    : null;

  return {
    gamme,
    config,
    prixCents,
    uw: uw?.uw ?? null,
    sw: uw?.sw ?? null,
    rwDb: acoustique?.rwFenetreDb ?? null,
    aides,
    economieAnnuelleEuros,
    refus,
    hypotheses: [
      `menuiserie remplacée : simple vitrage, Uw ${uwAvant.toFixed(1).replace('.', ',')}`,
      `${DJU_FRANCE} degrés-jours (moyenne France ; 1 800 à Nice, 3 200 à Strasbourg)`,
      `${PRIX_KWH_EUROS.toFixed(2).replace('.', ',')} € le kWh de chauffage`,
      'déperdition par la seule menuiserie — le mur, la ventilation et les apports solaires ne sont pas comptés',
    ],
  };
}

/**
 * LE VITRAGE QUI VA AVEC LA GAMME. Ce n'est pas une convention arbitraire :
 * c'est ce que la filière associe, et le refuser rendrait la comparaison
 * illisible.
 *
 * Le performance NE PREND PAS le triple par défaut, et c'est délibéré —
 * c'est le double ITR à bord chaud qui tient le meilleur COUPLE Uw/Sw, donc
 * l'éligibilité aux aides. Le triple gagne sur le Uw et perd sur le Sw ;
 * un client qui le veut le demande, et le comparateur ne le lui impose pas
 * en croyant bien faire.
 */
const VITRAGE_DE_GAMME: Record<Gamme, { base: 'double' | 'double-itr' | 'triple'; warmEdge?: boolean }> = {
  standard: { base: 'double' },
  confort: { base: 'double-itr' },
  performance: { base: 'double-itr', warmEdge: true },
};

/**
 * L'ÉCART entre deux offres, dit en une phrase. C'est ce qu'un vendeur dit
 * à l'oral, et ce qu'un configurateur ne dit jamais : « cent quatre-vingts
 * euros de plus, quarante de moins par an, et l'aide passe ».
 */
export function ecartEntre(moins: Offre, plus: Offre): string {
  const surcoutEuros = Math.round((plus.prixCents - moins.prixCents) / 100);
  const morceaux = [`${surcoutEuros >= 0 ? '+' : '−'}${Math.abs(surcoutEuros)} € à l’achat`];

  if (moins.economieAnnuelleEuros !== null && plus.economieAnnuelleEuros !== null) {
    const gain = plus.economieAnnuelleEuros - moins.economieAnnuelleEuros;
    if (gain !== 0) morceaux.push(`${gain > 0 ? '−' : '+'}${Math.abs(gain)} € de chauffage par an`);
  }

  if (moins.rwDb !== null && plus.rwDb !== null && plus.rwDb !== moins.rwDb) {
    morceaux.push(`${plus.rwDb > moins.rwDb ? '+' : '−'}${Math.abs(plus.rwDb - moins.rwDb)} dB`);
  }

  // L'ÉLIGIBILITÉ QUI BASCULE est l'argument le plus fort, et c'est celui
  // qu'on met en dernier parce qu'il se retient.
  const avant = moins.aides.cumulMaxEuros;
  const apres = plus.aides.cumulMaxEuros;
  if (apres > avant) morceaux.push(`jusqu’à ${apres - avant} € d’aides en plus`);

  return morceaux.join(', ');
}
