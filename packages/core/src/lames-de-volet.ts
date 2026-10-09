
import type { JoineryConfiguration } from './types.ts';
import { hauteurCoffreMm, LAME_VOLET_ROULANT_MM } from './enroulement-du-tablier.ts';

/**
 * LES TROIS TAILLES DÉCLARÉES, avec leur source — aucun nombre sans source.
 *
 * La 41 est celle que ce dépôt porte depuis toujours dans
 * `geometrie/profils.ts`, « la lame courante du PVC comme de l'aluminium
 * domestique » ; la 37 vient du relevé de Fenetre24, qui la donne comme la
 * SEULE valeur en PVC chez lui ; la 55 est nommée par le même commentaire de
 * `profils.ts` (« les grandes lames de 55 existent »). La 77 n'y est PAS :
 * c'est une lame de porte de garage enroulable, pas d'un volet de fenêtre —
 * et la nommer ici l'aurait vendue.
 */
export const LAMES_DE_VOLET = [
  {
    mm: 37 as const,
    label: 'Lame de 37 mm',
    argument: 'la fine — le tablier compte plus de lames, et le coffre ne bouge pas',
  },
  {
    mm: LAME_VOLET_ROULANT_MM as 41,
    label: 'Lame de 41 mm',
    argument: 'la courante, en PVC comme en aluminium domestique',
  },
  {
    mm: 55 as const,
    label: 'Lame de 55 mm',
    argument: 'la grande — plus rigide, et plus épaisse : elle enroule plus gros',
  },
] as const;

/** La taille de lame retenue — 41 mm quand rien n'est déclaré. */
export function lameDuVoletMm(config: JoineryConfiguration): 37 | 41 | 55 {
  return config.lameVoletMm ?? LAME_VOLET_ROULANT_MM;
}

/**
 * LA HAUTEUR DE COFFRE DÉRIVÉE de la configuration — un seul appelant possible
 * pour le dessin, la nomenclature et l'écran.
 *
 * Elle existe parce que les trois la calculaient chacun de leur côté en
 * passant `config.heightMm` : le jour où la lame se choisit, l'un des trois
 * aurait oublié de la passer, et le dessin aurait montré un coffre que le
 * débit ne commande pas.
 */
export function coffreDuVoletMm(config: JoineryConfiguration): number {
  return hauteurCoffreMm(config.heightMm, { lameMm: lameDuVoletMm(config) });
}
