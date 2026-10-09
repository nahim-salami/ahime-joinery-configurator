
import type { EtatDesCotes } from './export/manifeste.ts';
import type { Couleur, JoineryConfiguration, Materiau, ValidationIssue } from './types.ts';
import { DEFAULT_CATALOG, familleCatalog, type PricingCatalog } from './catalog.ts';
import { arrondiCommercialCents, computePrice } from './pricing.ts';
import { computeMetre } from './terrain.ts';

/** Une ligne de projet : une configuration, et combien on en veut. */
export interface LigneProjet {
  config: JoineryConfiguration;
  quantite: number;
  /**
   * LA PIÈCE où va cet ouvrage — « cuisine », « chambre nord ».
   *
   * Elle n'entre dans aucun calcul et c'est justement ce qui la rend
   * indispensable : un chantier de rénovation compte douze menuiseries, et
   * le poseur qui déballe a besoin de savoir laquelle monte à l'étage. Le
   * repère (M1, M2…) dit LAQUELLE ; la pièce dit .
   *
   * Vide sur un achat à l'unité, où la question ne se pose pas.
   */
  piece?: string;
  /**
   * L'ÉTAT DES COTES de cette ligne. Il vit ICI et pas dans la
   * configuration : la configuration décrit un PRODUIT, l'état des cotes
   * décrit ce qu'on sait du MUR. Deux menuiseries identiques peuvent être
   * l'une relevée sur place et l'autre déclarée au téléphone.
   *
   * Absent = `declaree`. C'est le défaut prudent : on ne fabrique pas sur
   * un silence.
   */
  etatDesCotes?: EtatDesCotes;
  /**
   * LE REPÈRE IMPOSÉ — celui qui est déjà sur un plan.
   *
   * Par défaut le repère se DÉRIVE de la position (M1, M2…), et c'est ce
   * qu'il faut quand le projet naît dans le configurateur. Mais un lot de
   * bailleur arrive avec ses propres repères — B12, ESC-04, PIG-2 — qui
   * sont écrits sur les plans, dans le DPGF et sur les portes. Les
   * renommer M1…Mn romprait le seul lien entre l'offre et le dessin, et
   * c'est ce lien que le maître d'ouvrage achète.
   *
   * Il n'entre dans aucun calcul : c'est une étiquette, et elle voyage
   * jusqu'au colis.
   */
  repere?: string;
}

/**
 * DUPLIQUER une ligne — le geste le plus fréquent d'un chantier, et celui
 * qu'aucun configurateur n'offre.
 *
 * Une maison a rarement douze menuiseries différentes : elle en a trois
 * modèles posés quatre fois. Refaire la configuration à chaque fois est la
 * raison pour laquelle les professionnels retournent à leur tableur.
 *
 * Ce qui se copie : la configuration entière, la quantité, la pièce.
 * Ce qui NE se copie PAS : l'état des cotes. Une cote relevée sur place
 * dans la cuisine ne dit rien de la chambre, et la copier ferait fabriquer
 * la seconde sur la mesure de la première — le rebut exact que le verrou du
 * manifeste existe pour empêcher.
 *
 * NI LE REPÈRE. Deux ouvrages qui portent le même repère sont deux colis
 * qu'on ne sait plus distinguer : la copie reprend le repérage dérivé, et
 * le projet signale la collision si elle survient autrement.
 */
export function dupliquer(lignes: LigneProjet[], index: number): LigneProjet[] {
  const source = lignes[index];
  if (!source) return lignes;
  const copie: LigneProjet = {
    config: { ...source.config },
    quantite: source.quantite,
    ...(source.piece ? { piece: source.piece } : {}),
  };
  return [...lignes.slice(0, index + 1), copie, ...lignes.slice(index + 1)];
}

/** Le récapitulatif d'une pièce — ce qu'un poseur monte en un voyage. */
export interface RecapPiece {
  piece: string;
  /** Les repères des ouvrages de cette pièce, dans l'ordre du projet. */
  reperes: string[];
  ouvrages: number;
  totalCents: number;
}

/**
 * LE RÉCAPITULATIF PAR PIÈCE — ce qu'on imprime et qu'on emporte.
 *
 * Les lignes sans pièce sont regroupées sous un libellé explicite plutôt
 * qu'ignorées : un ouvrage qui n'apparaît nulle part est un ouvrage qu'on
 * oublie dans le camion.
 */
export function recapParPiece(
  lignes: LigneProjet[],
  catalog: PricingCatalog = DEFAULT_CATALOG,
): RecapPiece[] {
  const reperes = reperesDuProjet(lignes);
  const parPiece = new Map<string, RecapPiece>();
  lignes.forEach((ligne, index) => {
    const piece = ligne.piece?.trim() || SANS_PIECE;
    let recap = parPiece.get(piece);
    if (!recap) {
      recap = { piece, reperes: [], ouvrages: 0, totalCents: 0 };
      parPiece.set(piece, recap);
    }
    recap.reperes.push(...reperes[index]);
    recap.ouvrages += ligne.quantite;
    // La MÊME formule que `computeProjet` : le montant AFFICHÉ, multiplié
    // par la quantité. Un récapitulatif par pièce dont les totaux ne
    // s'additionnent pas au total du projet ferait douter des deux.
    const quantite = Math.max(1, Math.round(ligne.quantite));
    recap.totalCents +=
      computePrice({ ...ligne.config, quantite }, catalog).displayTotalCents * quantite;
  });
  return [...parPiece.values()];
}

/** Le libellé des ouvrages dont personne n'a dit où ils vont. */
export const SANS_PIECE = 'Pièce non précisée';

/** Ce que le projet partage — ou pourrait partager. */
export interface ParametresProjet {
  couleur?: Couleur;
  materiau?: Materiau;
}

/** Le métré consolidé de tous les ouvrages linéaires d'un projet. */
export interface MetreProjet {
  longueurMm: number;
  poteaux: number;
  poteauxAngle: number;
  panneaux: number;
  betonLitres: number;
  /** Le nombre d'ouvrages linéaires — zéro sur un projet de menuiseries. */
  ouvrages: number;
}

export interface RapportProjet {
  /** Le nombre de lignes, et le nombre d'ouvrages tous exemplaires compris. */
  lignes: number;
  ouvrages: number;
  /** Le total, additionné sur les montants AFFICHÉS — celui que le client refait. */
  totalCents: number;
  /** Le métré linéaire consolidé, s'il y a des ouvrages au mètre. */
  metre: MetreProjet | null;
  /** Les teintes et matériaux réellement présents, dans l'ordre d'apparition. */
  couleurs: Couleur[];
  materiaux: Materiau[];
  /** Ce que le projet a de discordant — jamais une erreur, toujours une remarque. */
  remarques: ValidationIssue[];
  /**
   * LES REPÈRES, une liste par ligne — `[['M1'], ['M2.1', 'M2.2']]`. Ils
   * voyagent avec le rapport parce que le devis, le plan, le manifeste et
   * l'étiquette doivent tous porter LE MÊME, et qu'un repère recalculé
   * séparément par quatre écrans finit par diverger.
   */
  reperes: string[][];
}

/**
 * LE REPÉRAGE M1…Mn — le fil qui relie tout.
 *
 * Un chantier de huit fenêtres produit huit devis, huit manifestes, huit
 * étiquettes et un plan de masse. Sans repère, personne ne sait quelle
 * étiquette va sur quel colis ni quel colis va dans quelle pièce, et le
 * poseur déballe tout pour chercher. Le repère est ce qui rend un lot de
 * menuiseries MANIPULABLE.
 *
 * Il se dérive de la POSITION DANS LA LISTE, et de rien d'autre. C'est
 * délibéré, et c'est ce qui le rend stable : un repère tiré d'un identifiant
 * aléatoire changerait à chaque régénération, et un repère dérivé de la
 * configuration (« F1200x1400 ») donnerait le même à deux fenêtres
 * identiques posées dans deux pièces différentes — ce qui est précisément
 * le cas où le repère sert.
 *
 * Les EXEMPLAIRES d'une même ligne portent le même repère suivi d'un rang :
 * `M3.1`, `M3.2`. Trois fenêtres identiques sont trois colis, et le poseur
 * doit pouvoir cocher la troisième.
 *
 * SAUF si la ligne porte le sien. Un lot importé d'un bordereau arrive
 * repéré depuis les plans, et ces repères-là font foi (voir `bordereau.ts`).
 */
export function reperesDuProjet(lignes: LigneProjet[]): string[][] {
  return lignes.map((ligne, index) => repereDeLigne(ligne, index));
}

function repereDeLigne(ligne: LigneProjet, index: number): string[] {
  const base = ligne.repere?.trim() || `M${index + 1}`;
  if (ligne.quantite <= 1) return [base];
  return Array.from({ length: ligne.quantite }, (_, rang) => `${base}.${rang + 1}`);
}

/**
 * Le repère d'UN exemplaire — la même règle, pour qui n'a qu'une ligne en
 * main. `rang` compte à partir de zéro ; `impose` est le repère du plan,
 * quand il y en a un.
 */
export function repereDe(indexLigne: number, quantite: number, rang = 0, impose?: string): string {
  const base = impose?.trim() || `M${indexLigne + 1}`;
  return quantite <= 1 ? base : `${base}.${rang + 1}`;
}

/** Ce que valent, ensemble, les lignes d'un projet. */
export function computeProjet(
  lignes: LigneProjet[],
  catalog: PricingCatalog = DEFAULT_CATALOG,
): RapportProjet {
  const couleurs: Couleur[] = [];
  const materiaux: Materiau[] = [];
  let totalCents = 0;
  let ouvrages = 0;

  const metre: MetreProjet = {
    longueurMm: 0,
    poteaux: 0,
    poteauxAngle: 0,
    panneaux: 0,
    betonLitres: 0,
    ouvrages: 0,
  };

  for (const ligne of lignes) {
    const quantite = Math.max(1, Math.round(ligne.quantite));
    ouvrages += quantite;
    // Le total additionne ce que le client LIT, et il MULTIPLIE par la
    // quantité. `computePrice()` rend le prix d'UNE menuiserie, remise
    // quantité comprise — c'est son contrat, et les golden configs le
    // figent ainsi. L'oublier faisait payer quatre fenêtres le prix d'une.
    totalCents += computePrice({ ...ligne.config, quantite }, catalog).displayTotalCents * quantite;

    if (!couleurs.includes(ligne.config.couleur)) couleurs.push(ligne.config.couleur);
    if (!materiaux.includes(ligne.config.materiau)) materiaux.push(ligne.config.materiau);

    const rapport = computeMetre(ligne.config, catalog);
    if (rapport) {
      metre.ouvrages += quantite;
      metre.longueurMm += rapport.longueurMm * quantite;
      metre.poteaux += rapport.poteaux * quantite;
      metre.poteauxAngle += rapport.poteauxAngle * quantite;
      metre.panneaux += rapport.panneaux * quantite;
      metre.betonLitres += rapport.betonLitres * quantite;
    }
  }

  return {
    lignes: lignes.length,
    ouvrages,
    totalCents: arrondiCommercialCents(totalCents),
    metre: metre.ouvrages > 0 ? metre : null,
    couleurs,
    materiaux,
    remarques: remarquesDeProjet(lignes, couleurs, materiaux, catalog),
    reperes: reperesDuProjet(lignes),
  };
}

function remarquesDeProjet(
  lignes: LigneProjet[],
  couleurs: Couleur[],
  materiaux: Materiau[],
  catalog: PricingCatalog,
): ValidationIssue[] {
  const remarques: ValidationIssue[] = [];
  if (lignes.length < 2) return remarques;

  if (couleurs.length > 1) {
    remarques.push({
      code: 'projet-teintes-multiples',
      severite: 'avertissement',
      message: `Ce projet mélange ${couleurs.length} teintes. C'est possible — mais deux ouvrages posés côte à côte se comparent à l'œil, et un écart de RAL ne se rattrape pas après la laque.`,
      alternative: { label: `Tout passer en ${couleurs[0]}`, patch: { couleur: couleurs[0] } },
    });
  }
  if (materiaux.length > 1) {
    remarques.push({
      code: 'projet-materiaux-multiples',
      severite: 'avertissement',
      message: `Ce projet mélange ${materiaux.length} matériaux. Ils ne vieillissent pas ensemble : un bois grisonne, un alu thermolaqué ne bouge pas.`,
      alternative: { label: `Tout passer en ${materiaux[0]}`, patch: { materiau: materiaux[0] } },
    });
  }

  // DEUX FOIS LE MÊME REPÈRE — la faute d'un bordereau recopié à la main,
  // et celle qui coûte le plus cher. Le repère est le seul lien entre
  // l'offre, le plan, l'étiquette et le colis ; deux ouvrages qui le
  // partagent sont deux colis qu'on ne sait plus distinguer à la
  // livraison, et l'erreur ne se découvre qu'une fois le camion reparti.
  const vus = new Map<string, number>();
  const doubles: string[] = [];
  lignes.forEach((ligne, index) => {
    const base = ligne.repere?.trim() || `M${index + 1}`;
    const compte = (vus.get(base) ?? 0) + 1;
    vus.set(base, compte);
    if (compte === 2) doubles.push(base);
  });
  if (doubles.length > 0) {
    remarques.push({
      code: 'projet-reperes-en-double',
      severite: 'avertissement',
      message: `${doubles.length === 1 ? 'Le repère' : 'Les repères'} ${doubles.join(', ')} ${doubles.length === 1 ? 'désigne' : 'désignent'} plusieurs lignes. Le repère est ce qui relie le devis au plan, l'étiquette au colis et le colis à la pièce : deux ouvrages qui le partagent ne se distinguent plus à la livraison.`,
    });
  }

  // LE COUP QUE PERSONNE NE PEUT JOUER : les fenêtres de la maison et la
  // cas, on le DIT — c'est l'argument de vente, et il faut qu'il se voie.
  const familles = lignes.map((ligne) => familleCatalog(catalog, ligne.config.famille));
  const aDuLineaire = lignes.some((ligne) => computeMetre(ligne.config, catalog) !== null);
  const aDeLaMenuiserie = familles.some((fam) => fam.vitree);
  if (aDuLineaire && aDeLaMenuiserie && couleurs.length === 1) {
    remarques.push({
      code: 'projet-maison-entiere',
      severite: 'info',
      message: `Menuiseries et clôture dans le même projet, en ${couleurs[0]}, sur un seul devis — c'est la même laque et la même livraison.`,
    });
  }
  return remarques;
}

export function harmoniser(
  lignes: LigneProjet[],
  parametres: ParametresProjet,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): LigneProjet[] {
  return lignes.map((ligne) => {
    const fam = familleCatalog(catalog, ligne.config.famille);
    const config = { ...ligne.config };
    if (parametres.couleur && catalog.coefCouleurMilliemes[parametres.couleur] !== undefined) {
      config.couleur = parametres.couleur;
    }
    // aluminium le sortirait de son catalogue et rendrait son prix
    // indéfini — le geste doit être sûr, sinon personne ne l'utilise.
    if (parametres.materiau && fam.coefMateriauMilliemes[parametres.materiau] !== undefined) {
      config.materiau = parametres.materiau;
    }
    return { ...ligne, config };
  });
}
