/**
 * Pourquoi ce fichier existe : le Uw affiché à chaque geste est un argument
 * de vente, pas une note de bas de page (docs/02 §2). Formule simplifiée
 * normalisée : Uw = (Af·Uf + Ag·Ug + ψ·Lg) / (Af + Ag) — profilé, vitrage,
 * intercalaire, sur la surface développée. Il alimente aussi l'estimateur
 * d'aides (MaPrimeRénov'/CEE) des phases suivantes.
 *
 * Solution écartée : le calcul réglementaire complet (EN ISO 10077-2, coupes
 * de profilés aux éléments finis). Hors de portée d'un configurateur — et
 * inutile : la valeur simplifiée est honnête à ±0,1 près, et le devis la
 * qualifie de « calcul simplifié ». Les Uf/Ug/ψ sont des données du
 * catalogue, réglables par le marchand, jamais codées en dur ici.
 *
 * Incident fondateur : la règle « pas d'horloge, pas de DOM dans core » des
 * néons — ce module est une fonction pure, testable dans Node, rejouée à
 * l'identique par le portage PHP (le champ `uw` du harnais de parité).
 */

import type { JoineryConfiguration } from './types.ts';
import { DEFAULT_CATALOG, systemeDe, type PricingCatalog } from './catalog.ts';
import { computeMeasureReport, effectiveVitrage, fractionVitree } from './structural.ts';
import { hauteurDeMenuiserieMm } from './structural.ts';

export interface UwReport {
  /** Le coefficient affiché, W/(m²·K), arrondi au centième. */
  uw: number;
  ufProfil: number;
  ugVitrage: number;
  psiIntercalaire: number;
  /** Surface de vitrage, de cadre, périmètre d'intercalaire. */
  agM2: number;
  afM2: number;
  lgM: number;
  /**
   * LE FACTEUR SOLAIRE DE LA FENÊTRE — `Sw = g × Ag / Atot`. C'est la part
   * de l'énergie solaire qui entre, rapportée à la baie entière : le cadre
   * n'en laisse pas passer, donc plus il est large, plus Sw tombe.
   *
   * Il n'était pas calculé, et c'est un manque commercial : MaPrimeRénov'
   * pose un critère DOUBLE — `Uw ≤ 1,3` **et** `Sw ≥ 0,30`. Annoncer
   * l'éligibilité sur le seul Uw, c'est promettre une aide qu'un dossier
   * peut refuser (docs/13 §5).
   */
  sw: number;
  /** La transmission lumineuse de la fenêtre — `TLw = TL × Ag / Atot`. */
  tlw: number;
}

/**
 * LES SEUILS TECHNIQUES des aides à la rénovation, et LEUR DATE.
 *
 * Ils sont ici, dans le module thermique, et pas avec le barème financier —
 * c'est une séparation voulue, et elle a une conséquence de budget autant
 * que de sens :
 *
 *   - le CRITÈRE TECHNIQUE ne dépend que de la menuiserie. Il se vérifie
 *     dès la première seconde, sans rien demander au client, et il se
 *     corrige en changeant de vitrage. Il vit donc dans le chargement
 *     initial, avec le Uw dont il est le voisin ;
 *   - le MONTANT, lui, dépend de la tranche de revenus, de l'ancienneté du
 *     logement et du RGE de l'artisan. Le configurateur ne les connaît pas,
 *     et les supposer, c'est promettre au hasard. Il vit dans `aides.ts`,
 *     chargé par l'écran qui pose les questions.
 *
 * Afficher un montant sans avoir posé les questions serait exactement la
 * demi-promesse que ce projet refuse ; afficher le critère technique, lui,
 * est un FAIT sur le produit.
 */
export const SEUILS_AIDES = { uwMax: 1.3, swMin: 0.3, date: '2026-02' } as const;

/**
 * LES SEUILS D'UNE FENÊTRE DE TOIT, qui ne sont PAS ceux d'une fenêtre.
 *
 * `Uw ≤ 1,5` et `Sw ≥ 0,36` — plus permissif sur la thermique, plus
 * exigeant sur le solaire. Ce n'est pas une faveur : une fenêtre de toit est
 * là pour ÉCLAIRER un comble, et un vitrage à contrôle solaire qui la
 * rendrait sombre manquerait son but.
 *
 * Les confondre se paie dans les DEUX SENS : annoncer une fenêtre de toit
 * non éligible parce qu'elle rate 1,3 fait perdre une vente qui était
 * bonne ; l'annoncer éligible avec un Sw de 0,32 fait promettre une aide
 * qu'un dossier refusera. Le lot « vente » n'avait que le premier barème,
 * et la famille « fenêtre de toit » l'a révélé.
 */
export const SEUILS_AIDES_TOIT = { uwMax: 1.5, swMin: 0.36, date: '2026-02' } as const;

/**
 * Les seuils qui valent pour une FAMILLE. Un seul endroit décide, parce que
 * le badge du prix et l'estimateur d'aides doivent dire la même chose.
 */
export function seuilsAidesDe(famille: string): { uwMax: number; swMin: number; date: string } {
  return famille === 'fenetre-toit' ? SEUILS_AIDES_TOIT : SEUILS_AIDES;
}

export interface CritereAides {
  /** Vrai quand les DEUX seuils sont tenus — jamais un seul. */
  tenu: boolean;
  /** Ce qui manque, nommé et chiffré : « Sw de 0,28 pour 0,30 au moins ». */
  manques: string[];
  /** La date des seuils — elle s'affiche avec le verdict, toujours. */
  date: string;
}

/**
 * LE CRITÈRE TECHNIQUE, et il est DOUBLE : `Uw ≤ 1,3` ET `Sw ≥ 0,30`.
 *
 * C'est le piège que docs/13 §5 avait nommé : un triple vitrage passe le Uw
 * haut la main et peut rater le Sw — trois verres laissent entrer moins de
 * soleil. Une petite fenêtre en triple rend Uw 0,98 et Sw 0,28, et elle se
 * vend tous les jours. N'afficher que le Uw l'annonce éligible.
 */
export function critereTechniqueAides(
  rapport: UwReport | null,
  seuils: { uwMax: number; swMin: number; date: string } = SEUILS_AIDES,
): CritereAides {
  if (!rapport) {
    return {
      tenu: false,
      manques: ['sans vitrage, la menuiserie ne relève pas du geste « parois vitrées »'],
      date: seuils.date,
    };
  }
  const manques: string[] = [];
  if (rapport.uw > seuils.uwMax) {
    manques.push(`Uw de ${virgule(rapport.uw)} pour ${virgule(seuils.uwMax)} au plus`);
  }
  if (rapport.sw < seuils.swMin) {
    manques.push(`Sw de ${virgule(rapport.sw)} pour ${virgule(seuils.swMin)} au moins`);
  }
  return { tenu: manques.length === 0, manques, date: seuils.date };
}

/**
 * La virgule décimale française, deux décimales toujours — c'est ainsi que
 * les seuils sont écrits dans le guide de l'Anah, et un client qui compare
 * son chiffre au seuil doit voir deux nombres de même forme.
 */
function virgule(x: number): string {
  return x.toFixed(2).replace('.', ',');
}

/** Arrondi au centième — la précision d'affichage et de parité du Uw. */
function arrondiCentieme(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Le Uw simplifié d'une configuration — null pour les familles sans vitrage
 * (volets, stores, porte pleine) : il n'y a rien d'honnête à afficher.
 */
export function computeUw(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): UwReport | null {
  const vitrage = effectiveVitrage(config, catalog);
  if (!vitrage) return null;

  const mesure = computeMeasureReport(config, catalog);
  if (!mesure.clairVitrage) return null;

  // L'AIRE DE RÉFÉRENCE EST CELLE DE LA MENUISERIE, pas de la cote commandée
  // — lot O10. Un bloc-baie prend une part de la hauteur pour son coffre, et
  // ce coffre n'est pas une paroi de fenêtre : il a son PROPRE Up, que
  // `bloc-baie.ts` pondère depuis le lot MT5 (« le coffre isolé AMÉLIORE
  // l'Uw »). L'inclure dans l'aire du cadre faisait payer deux fois la même
  // surface — une fois en dormant, une fois en coffre — et l'Uw décrivait un
  // ouvrage qui n'existe pas.
  const totalM2 = (config.widthMm * hauteurDeMenuiserieMm(config)) / 1_000_000;
  if (totalM2 <= 0) return null;

  // Une porte semi-vitrée ne vitre qu'une fraction du clair ; le rectangle
  // équivalent garde les proportions (côtés × racine de la fraction).
  const clairM2ParVantail = (mesure.clairVitrage.widthMm * mesure.clairVitrage.heightMm) / 1_000_000;
  const fraction = fractionVitree(config);
  const echelle = Math.sqrt(fraction);

  const agM2 = mesure.vantaux * clairM2ParVantail * fraction;
  const afM2 = Math.max(0, totalM2 - agM2);
  const lgM =
    mesure.vantaux *
    2 *
    ((mesure.clairVitrage.widthMm / 1000 + mesure.clairVitrage.heightMm / 1000) * echelle);

  // Le Uf d'une gamme nommée vient du fournisseur, et prime sur la table
  // par matériau × palier : c'est LUI qui décide de l'éligibilité aux aides.
  const systeme = systemeDe(catalog, config.systeme);
  const ufProfil = systeme?.uf ?? catalog.thermique.ufParMateriau[config.materiau][config.gamme];
  const ugVitrage = catalog.thermique.ugParVitrage[vitrage.base];
  // L'INTERCALAIRE. Le bord chaud REMPLACE celui de la base — c'est le
  // même profilé, fait d'une autre matière —, il ne s'y ajoute pas. C'est
  // le seul poste du Uw qu'on améliore sans toucher ni au verre ni au
  // profilé, et sur une petite fenêtre il pèse plus qu'on ne croit : le
  // périmètre de vitrage y est grand devant la surface.
  const psiIntercalaire = vitrage.warmEdge
    ? catalog.thermique.psiWarmEdge
    : catalog.thermique.psiParVitrage[vitrage.base];

  const uw = (afM2 * ufProfil + agM2 * ugVitrage + lgM * psiIntercalaire) / totalM2;
  // Sw et TLw : le vitrage ne laisse passer que sur SA surface. Le rapport
  // Ag/Atot est donc le même facteur pour les deux — c'est la définition
  // simplifiée du métier, et elle suffit à trancher un seuil d'aide.
  const partVitree = agM2 / totalM2;
  const controleSolaire = vitrage.controleSolaire === true;
  const g =
    catalog.thermique.gParVitrage[vitrage.base] *
    (controleSolaire ? catalog.thermique.controleSolaireFacteur : 1);
  return {
    uw: arrondiCentieme(uw),
    ufProfil,
    ugVitrage,
    psiIntercalaire,
    agM2: arrondiCentieme(agM2),
    afM2: arrondiCentieme(afM2),
    lgM: arrondiCentieme(lgM),
    sw: arrondiCentieme(g * partVitree),
    tlw: arrondiCentieme(catalog.thermique.tlParVitrage[vitrage.base] * partVitree),
  };
}
