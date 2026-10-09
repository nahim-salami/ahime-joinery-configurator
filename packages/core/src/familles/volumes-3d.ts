
import type { Elevation, ElevationRect } from '../drawing.ts';
import type { JoineryConfiguration } from '../types.ts';
import type { PricingCatalog } from '../catalog.ts';
import type { CotesProfils } from '../geometrie/profils.ts';
import type { Ouvrant } from '../geometry3d.ts';
import type { AtelierVolume, GroupeFamilles } from './registre.ts';

/**
 * UN RECTANGLE DE L'ÉLÉVATION PLACÉ DANS LE REPÈRE DU MONDE — x recentré sur
 * le milieu de l'ouvrage, y compté depuis le sol et non depuis le haut du
 * dessin.
 *
 * Le type vit ICI depuis le lot D16, et pas dans `geometry3d.ts` : c'est la
 * monnaie de la couture, et un morceau de groupe ne peut pas importer le
 * fichier dont on vient de le sortir.
 */
export interface CadreDuMonde {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface ContexteVolume {
  atelier: AtelierVolume;
  config: JoineryConfiguration;
  elevation: Elevation;
  /**
   * Un rectangle du dessin porté dans le repère du monde. Un POINT s'y porte
   * aussi, en rectangle nul — c'est ainsi que les ferrures d'un volet relisent
   * les traits de l'écharpe et de l'espagnolette (lot D16c).
   */
  monde: (rect: Pick<ElevationRect, 'xMm' | 'yMm' | 'widthMm' | 'heightMm'>) => CadreDuMonde;
  /**
   * L'ENCOMBREMENT DU DESSIN ENTIER, en mm — lot D16b.
   *
   * Ni l'un ni l'autre ne se lit sur un rectangle : la largeur est l'écart
   * entre le plus à gauche et le plus à droite, TRAITS COMPRIS, et la hauteur
   * la plus basse arête du dessin. `computeGeometry3D` les calcule avant
   * d'aiguiller ; les recopier dans un module de groupe aurait dupliqué un
   * balayage sans comparateur.
   *
   * Le store banne est le premier à en avoir besoin, et pour une raison qui
   * dit ce qu'il est : il n'a pas de dormant dont hériter son cadre.
   */
  dessin: { largeurMm: number; hauteurMm: number };
}

/**
 * CE QU'UN GROUPE SAIT MONTER — il rend `true` quand il a posé quelque chose,
 * pour que l'appelant sache s'il doit poursuivre son chemin générique.
 */
export type VolumeDeGroupe = (contexte: ContexteVolume) => boolean;

const VOLUMES = new Map<GroupeFamilles, VolumeDeGroupe>();

/**
 * ENREGISTRER LE VOLUME D'UN GROUPE.
 *
 * Appelé au chargement du module de volume, et par lui seul. Il n'est pas
 * idempotent par hasard : un module chargé deux fois — une fois par le thunk du
 * navigateur, une fois par `familles-node.ts` — doit rendre le même registre.
 */
export function enregistrerVolume3d(groupe: GroupeFamilles, volume: VolumeDeGroupe): void {
  VOLUMES.set(groupe, volume);
}

export function volume3dDuGroupe(groupe: GroupeFamilles): VolumeDeGroupe | undefined {
  return VOLUMES.get(groupe);
}

/** Les groupes qui ont déclaré un volume — lu par le comparateur. */
export function groupesAvecVolume3d(): GroupeFamilles[] {
  return [...VOLUMES.keys()];
}

/**
 * LES DEUX MOMENTS OÙ UN GROUPE COMPLÈTE LE CHEMIN GÉNÉRIQUE — lot D16c.
 *
 * Le lot D16b l'avait nommé : la porte de garage et le volet battant « ne sont
 * PAS des remplacements, ils s'exécutent après le cadre générique et le
 * complètent. Les sortir demande un point de couture NOUVEAU ». Le voici, et il
 * a DEUX moments et non un, parce que l'ordre des pièces d'un volume est ce que
 * la vue éclatée et l'export lisent :
 *
 * - `apres-le-dormant` — juste après le cadre, avant ce que la POSE ajoute
 *   (aile, tapée). La sectionnelle y posait son cadre à trois côtés.
 * - `ferrures` — après les tabliers et les garnissages, avant la grille de
 *   défense. Les pentures d'un volet battant se posent sur un battant déjà
 *   garni.
 *
 * Un seul moment « après le cadre » aurait déplacé les ferrures AVANT le
 * tablier du volet, et l'épingle du lot l'aurait refusé.
 */
// `apres-la-grille` (lot D16e) : le bloc-baie d'une fenêtre se posait APRÈS la grille de
// `decor` et `par-rectangle` (lot D16f) : le décor d'une porte, et ce qui se pose
// rectangle par rectangle dans la boucle des volets — un crochet qui rend `true` a posé.
export type MomentDuComplement = 'apres-le-dormant' | 'ferrures' | 'apres-la-grille' | 'decor' | 'par-rectangle';

/**
 * CE QU'UN COMPLÉMENT REÇOIT DE PLUS qu'un volume : la profondeur du profilé
 * et les rectangles EFFECTIFS — ceux du dessin plus la boîte de chaque contour
 * d'une menuiserie de forme. Deux lectures encore, calculées avant l'appel.
 */
export interface ContexteComplement extends ContexteVolume {
  profondeur: number;
  rects: readonly ElevationRect[];
  catalog: PricingCatalog;
  ouvrants: Ouvrant[];
  /** Les cotes de profilé du chemin générique — une serrure, un store intégré s'y lisent (lot D16e). */
  cotes: CotesProfils;
  /** La face de l'ouvrant, en z. */
  zOuvrant: number;
  /** Le dormant du dessin, s'il y en a un. */
  rectDormant?: ElevationRect;
  /** Les identifiants des options commandées. */
  optionsIds: readonly string[];
  /** Le nombre de vantaux mesuré. */
  vantaux: number;
  /** Le rectangle en cours, pour le moment `par-rectangle`. */
  rect?: ElevationRect;
}

export type ComplementDeGroupe = (contexte: ContexteComplement) => void | boolean;

const COMPLEMENTS = new Map<string, ComplementDeGroupe>();

/** ENREGISTRER UN COMPLÉMENT — au chargement du module de volume, et par lui seul. */
export function enregistrerComplement3d(
  groupe: GroupeFamilles,
  moment: MomentDuComplement,
  complement: ComplementDeGroupe,
): void {
  COMPLEMENTS.set(`${groupe}:${moment}`, complement);
}

/**
 * LE COMPLÉMENT D'UN GROUPE À UN MOMENT, ou `undefined`. Le piège est celui de
 * `volume3dDuGroupe` : un complément non chargé ne casse rien, il OUBLIE des
 * pièces — une porte de garage sans panneaux, un volet sans pentures.
 */
export function complement3dDuGroupe(
  groupe: GroupeFamilles,
  moment: MomentDuComplement,
): ComplementDeGroupe | undefined {
  return COMPLEMENTS.get(`${groupe}:${moment}`);
}
