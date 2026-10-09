/**
 * Pourquoi ce fichier existe : le cœur écrit des phrases que des CLIENTS
 * lisent — les lignes du prix décomposé, les refus de fabricabilité. Ce
 * vocabulaire visible vit ici, en un seul endroit, au lieu d'être recopié
 * dans chaque `template string`.
 *
 * Solution écartée : renvoyer des identifiants et laisser le widget écrire
 * les phrases. Le portage PHP de la phase 4 devrait alors réécrire les mêmes
 * phrases une troisième fois, et le devis PDF une quatrième — quatre copies
 * qui divergeraient. Le cœur écrit la phrase, le widget l'affiche, le PHP la
 * recopie une fois.
 *
 * Incidents fondateurs, tous vus à l'écran : « le pvc admet 900 mm » (un
 * identifiant de catalogue lâché dans une phrase), « Fenêtre 2 vantail(aux) »
 * (une forme administrative sur une ligne de devis) et « 2 vantailx » dans
 * le widget (un pluriel bricolé). Un identifiant n'est pas un mot.
 */

import type { Materiau } from './types.ts';

const MATERIAUX: Record<Materiau, string> = {
  pvc: 'PVC',
  alu: 'aluminium',
  bois: 'bois',
  mixte: 'mixte bois-alu',
};

/** Le matériau tel qu'on le nomme au client — jamais son identifiant. */
export function nommerMateriau(materiau: string): string {
  return MATERIAUX[materiau as Materiau] ?? materiau;
}

/** « 1 vantail », « 2 vantaux » — le pluriel du métier est irrégulier. */
export function nommerVantaux(nombre: number): string {
  return `${nombre} ${nombre > 1 ? 'vantaux' : 'vantail'}`;
}

/**
 * Le nom d'une zone de vent, écrit comme on le lit. L'identifiant, lui, est
 * sans accent — c'est une clé, pas une phrase — et l'écrire tel quel dans un
 * message donnait « en zone exposee », qui se voit tout de suite.
 */
export function nommerZoneVent(zone: 'abritee' | 'normale' | 'exposee'): string {
  if (zone === 'abritee') return 'abritée';
  if (zone === 'exposee') return 'exposée';
  return 'normale';
}
