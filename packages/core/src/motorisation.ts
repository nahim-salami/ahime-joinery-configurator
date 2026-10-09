
import type { JoineryConfiguration, SecuriteId, ZoneVent } from './types.ts';
import {
  DEFAULT_CATALOG,
  estPortail,
  modelePortailDe,
  moteurDe,
  type MoteurDef,
  type PricingCatalog,
  type SecuriteDef,
} from './catalog.ts';

export interface RapportVantail {
  /** Le nombre de vantaux — un coulissant en a toujours un. */
  vantaux: number;
  largeurVantailMm: number;
  hauteurMm: number;
  /** La part de VIDE du remplissage, entre 0 et 1. */
  ajourage: number;
  /** La surface d'un vantail, en m². */
  surfaceM2: number;
  /** Le poids d'UN vantail, arrondi au kilo — cadre compris. */
  poidsKg: number;
}

/** L'effort du vent sur un vantail, et ce qu'il en arrive aux piliers. */
export interface RapportVent {
  zone: ZoneVent;
  pressionPa: number;
  /** La surface qui prend réellement le vent — le plein, pas le vide. */
  surfacePleineM2: number;
  /** L'effort total sur le vantail, en décanewtons (≈ kilos-force). */
  effortDaN: number;
  /**
   * Le même effort si le remplissage était PLEIN. C'est le repère qui rend
   * l'ajourage lisible : « votre choix divise la poussée par deux ».
   */
  effortSiPleinDaN: number;
}

/** Le nombre pi-décimal arrondi au kilo — la précision de la parité. */
function arrondiEntier(x: number): number {
  return Math.round(x);
}

export function computeRapportVantail(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): RapportVantail | null {
  if (!estPortail(config.famille)) return null;
  const vantaux = Math.max(1, Math.round(config.vantaux));
  const largeurVantailMm = Math.round(config.widthMm / vantaux);
  const surfaceM2 = (largeurVantailMm * config.heightMm) / 1_000_000;

  const modele = modelePortailDe(catalog, config.famille, config.remplissagePortail);
  const ajourage = Math.max(0, Math.min(1, modele?.ajourage ?? 0));

  // La masse surfacique du REMPLISSAGE, réduite par l'ajourage — un barreau
  // ne pèse pas ce que pèse la tôle qu'il remplace.
  const masse = catalog.masseRemplissageKgParM2[config.materiau] ?? 12;
  const poidsRemplissage = surfaceM2 * masse * (1 - ajourage);

  // Le CADRE, lui, pèse quel que soit l'ajourage : c'est un tube qui fait le
  // barreaudé — celui-là même qu'on croit léger — et lui faisait passer un
  // moteur qui ne le bougerait pas.
  //
  // Sa masse est LINÉIQUE, en kilos par mètre de périmètre : c'est ainsi
  // qu'un fournisseur de tube la donne. La déduire de la largeur vue du
  // profilé, comme on le faisait d'abord, revenait à prendre un tube pour
  // une plaque pleine.
  const perimetreM = (2 * (largeurVantailMm + config.heightMm)) / 1000;
  const masseCadre = catalog.masseCadreKgParMetre[config.materiau] ?? 2.6;
  const poidsCadre = perimetreM * masseCadre;

  return {
    vantaux,
    largeurVantailMm,
    hauteurMm: config.heightMm,
    ajourage,
    surfaceM2: Math.round(surfaceM2 * 100) / 100,
    poidsKg: arrondiEntier(poidsRemplissage + poidsCadre),
  };
}

/**
 * LA PRISE AU VENT — le calcul que personne n'affiche, et le pendant exact
 * du Uw d'une menuiserie : une valeur physique, recalculée à chaque geste,
 * qui EXPLIQUE un refus au lieu de l'imposer.
 *
 * Un vantail plein de 2 × 1,7 m en zone exposée encaisse près de 380 daN.
 * C'est ce qui arrache les piliers, tord les bras de moteur et fait sauter
 * les gonds — et personne ne le dit au client au moment où il choisit son
 * remplissage.
 */
export function computePriseAuVent(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): RapportVent | null {
  const vantail = computeRapportVantail(config, catalog);
  if (!vantail) return null;
  const zone = config.zoneVent ?? 'normale';
  const pressionPa = catalog.pressionVentPa[zone] ?? catalog.pressionVentPa.normale;
  const surfacePleineM2 = vantail.surfaceM2 * (1 - vantail.ajourage);
  // 1 Pa = 1 N/m² ; on affiche en décanewtons, l'unité du métier — un
  // décanewton pèse à peu près un kilo, et un poseur lit des kilos.
  return {
    zone,
    pressionPa,
    surfacePleineM2: Math.round(surfacePleineM2 * 100) / 100,
    effortDaN: arrondiEntier((surfacePleineM2 * pressionPa) / 10),
    effortSiPleinDaN: arrondiEntier((vantail.surfaceM2 * pressionPa) / 10),
  };
}

/** Ce qu'un moteur peut, et ce que ce vantail lui demande. */
export interface CompatibiliteMoteur {
  moteur: MoteurDef;
  poidsKg: number;
  largeurVantailMm: number;
  /** Vrai quand l'abaque du moteur couvre ce vantail. */
  compatible: boolean;
  /** Ce qui coince — pour que le refus le dise, plutôt que « incompatible ». */
  raison: 'poids' | 'largeur' | 'famille' | null;
}

export function verifierMoteur(
  config: JoineryConfiguration,
  moteur: MoteurDef,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): CompatibiliteMoteur | null {
  const vantail = computeRapportVantail(config, catalog);
  if (!vantail) return null;
  const famille = moteur.familles.includes(config.famille);
  const poids = vantail.poidsKg <= moteur.poidsMaxKg;
  const largeur = vantail.largeurVantailMm <= moteur.largeurVantailMaxMm;
  return {
    moteur,
    poidsKg: vantail.poidsKg,
    largeurVantailMm: vantail.largeurVantailMm,
    compatible: famille && poids && largeur,
    // L'ordre compte : on nomme d'abord ce qui est le plus vite compris.
    raison: !famille ? 'famille' : !poids ? 'poids' : !largeur ? 'largeur' : null,
  };
}

/**
 * Le moteur le MOINS CHER qui sait mouvoir ce vantail — l'alternative que
 * porte le refus. Sans elle, « ce moteur ne convient pas » est un mur ; avec
 * elle, c'est un conseil.
 */
export function moteurCompatibleLePlusProche(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): MoteurDef | undefined {
  const candidats = catalog.moteurs
    .filter((moteur) => verifierMoteur(config, moteur, catalog)?.compatible)
    .sort((a, b) => a.amountCents - b.amountCents);
  return candidats[0];
}

/**
 * Les sécurités IMPOSÉES par l'EN 12453 sur cette installation. Toutes,
 * toujours — ce ne sont pas des options : un client ne choisit pas un
 * limiteur d'effort plus qu'il ne choisit une ceinture de sécurité.
 *
 * La barre palpeuse mérite un mot : elle est exigée dès qu'une zone
 * d'écrasement subsiste malgré le limiteur, ce qui est le cas du bord
 * principal d'un coulissant — et ce qu'un battant à bras évite le plus
 * souvent. Le catalogue par défaut la met partout : sur-protéger se
 * discute avec le poseur, sous-protéger ne se discute pas.
 */
export function securitesImposees(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): SecuriteDef[] {
  if (!estPortail(config.famille) || !config.motorisation) return [];
  return catalog.securites;
}

/** Les sécurités réellement retenues — le jeu imposé, sauf mention contraire. */
export function securitesRetenues(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): SecuriteDef[] {
  const imposees = securitesImposees(config, catalog);
  const demandees = config.motorisation?.securites;
  if (!demandees) return imposees;
  return imposees.filter((securite) => demandees.includes(securite.id));
}

/** Celles qui manquent à l'appel — la matière du refus. */
export function securitesManquantes(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): SecuriteId[] {
  const retenues = new Set(securitesRetenues(config, catalog).map((securite) => securite.id));
  return securitesImposees(config, catalog)
    .map((securite) => securite.id)
    .filter((id) => !retenues.has(id));
}
