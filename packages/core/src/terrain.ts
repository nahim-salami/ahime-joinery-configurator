
import type { JoineryConfiguration } from './types.ts';
import {
  DEFAULT_CATALOG,
  familleCatalog,
  type PricingCatalog,
} from './catalog.ts';

export interface Troncon {
  longueurMm: number;
  /**
   * L'angle avec le tronçon PRÉCÉDENT, en degrés, compté vers la gauche.
   * Absent ou 0 sur le premier tronçon, et sur tout tronçon aligné.
   */
  angleDeg?: number;
  ouverture?: { largeurMm: number; label: string; depuisDebutMm?: number };
}

/** Le métré d'un ouvrage linéaire — ce que le dépôt doit préparer. */
export interface RapportMetre {
  /** La longueur totale, tous tronçons confondus. */
  longueurMm: number;
  longueurPanneauxMm: number;
  hauteurMm: number;
  /** Le nombre de tronçons droits. */
  troncons: number;
  /** Les poteaux, angles compris. Un poteau d'angle compte UNE fois. */
  poteaux: number;
  /** Les poteaux qui sont des poteaux d'ANGLE — ils coûtent plus cher. */
  poteauxAngle: number;
  /** Les panneaux entiers, plus la coupe éventuelle du dernier. */
  panneaux: number;
  /** Le volume total de béton des massifs de fondation, en litres. */
  betonLitres: number;
}

/** L'entraxe retenu — celui du catalogue, borné par la longueur du panneau. */
function entraxeMm(catalog: PricingCatalog): number {
  return Math.max(500, catalog.cloture.entraxePoteauxMm);
}

/**
 * Les tronçons d'une configuration. Sans terrain déclaré, l'ouvrage est un
 * SEUL tronçon droit de la longueur commandée — le cas plat et aligné, qui
 * couvre la majorité des projets et par lequel il fallait commencer.
 */
export function tronconsDe(config: JoineryConfiguration): Troncon[] {
  const declares = config.terrain?.troncons;
  if (declares && declares.length > 0) return declares;
  return [{ longueurMm: config.widthMm }];
}

/**
 * Le métré. Chaque tronçon commence et finit par un poteau, et deux tronçons
 * consécutifs en PARTAGENT un — celui d'angle. Diviser la longueur totale
 * par l'entraxe donnerait le bon ordre de grandeur et le mauvais compte.
 */
export function computeMetre(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): RapportMetre | null {
  const fam = familleCatalog(catalog, config.famille);
  if (fam.unitePrix !== 'metre-lineaire') return null;

  const troncons = tronconsDe(config);
  const entraxe = entraxeMm(catalog);
  // UN OUVRAGE CONTINU n'a ni poteau ni panneau : c'est un mur, et le
  // premier métré lui comptait onze poteaux et six cents litres de massifs.
  // Sa fondation est une SEMELLE FILANTE, qu'on chiffre au mètre.
  if (fam.ouvrageContinu) {
    const longueur = troncons.reduce((somme, troncon) => somme + troncon.longueurMm, 0);
    return {
      longueurMm: longueur,
      longueurPanneauxMm: longueur,
      hauteurMm: config.heightMm,
      troncons: troncons.length,
      poteaux: 0,
      poteauxAngle: 0,
      panneaux: 0,
      betonLitres: Math.round((longueur / 1000) * catalog.cloture.semelleLitresParMetre),
    };
  }
  let longueurMm = 0;
  let longueurPanneauxMm = 0;
  let poteaux = 0;
  let panneaux = 0;

  for (const troncon of troncons) {
    longueurMm += troncon.longueurMm;
    // remplie de panneaux. L'oublier facturait trois panneaux et demi de
    // trop sur un projet de vingt mètres.
    const remplie = Math.max(0, troncon.longueurMm - (troncon.ouverture?.largeurMm ?? 0));
    longueurPanneauxMm += remplie;
    // Les travées d'un tronçon : au moins une, même très courte.
    const travees = Math.max(1, Math.ceil(remplie / entraxe));
    panneaux += remplie > 0 ? travees : 0;
    // Ce tronçon apporte ses poteaux intermédiaires plus son poteau de FIN.
    // Celui de début appartient au tronçon précédent — ou au projet, et on
    // l'ajoute une seule fois, à la fin.
    poteaux += travees;
  }
  // Le tout premier poteau, celui qui n'est la fin de rien.
  poteaux += 1;
  const poteauxAngle = troncons.filter(
    (troncon, index) => index > 0 && Math.abs(troncon.angleDeg ?? 0) > 1,
  ).length;

  const massif = catalog.cloture.massifLitres;
  return {
    longueurMm,
    longueurPanneauxMm,
    hauteurMm: config.heightMm,
    troncons: troncons.length,
    poteaux,
    poteauxAngle,
    panneaux,
    betonLitres: Math.round(poteaux * massif),
  };
}
