/**
 * Pourquoi ce fichier existe : la porte d'entrée et de sortie des cotes,
 * côté écran. `versMm()` lit ce qu'un humain tape, `depuisMm()` remplit le
 * champ, `formater()` écrit une cote dans une phrase. Trois fonctions, un
 * seul principe : **le millimètre entier est la seule chose qui descend dans
 * la configuration**, et rien ne remonte du champ vers le moteur sans passer
 * par `versMm()`.
 *
 * Solution écartée : réimplémenter la conversion ici. L'arithmétique des
 * seizièmes vit dans `@ahjc/core` (`unites.ts`), parce que l'exportateur
 * SVG — qui est dans le cœur — cote les dessins et doit produire exactement
 * les mêmes chaînes que ce module. Deux implémentations auraient exigé un
 * comparateur (docs/11 §2.6) ; une duplication qu'on peut ne pas écrire vaut
 * mieux qu'une duplication qu'on surveille. Ce fichier n'ajoute donc que ce
 * qui est propre à l'écran : les noms que le plan a retenus, et la lecture
 * de l'unité dans le contexte de l'hôte.
 *
 * Incident fondateur : un seizième de pouce vaut 1,5875 mm — plus gros qu'un
 * millimètre. Un champ qui réécrirait sa valeur à chaque bascule d'unité
 * ferait dériver la menuiserie d'un millimètre par aller-retour (le compte
 * exact est dans `core/test/unites.test.ts` : 37 % des cotes ne reviennent
 * pas). D'où `versMm()` qui rend `null` — et non zéro — sur une saisie en
 * cours : tant que « 47 1 » n'est pas « 47 1/4 », la configuration ne bouge
 * pas, et le dessin non plus.
 */

import { analyserCote, formaterCote, valeurPourChamp, type Unite } from '@ahjc/core';
import type { HostContext } from './host-context.ts';

export type { Unite };

/** L'unité de l'hôte, ou le millimètre — le défaut sûr d'un widget sans contexte. */
export function uniteDuContexte(contexte: HostContext): Unite {
  return contexte.unite === 'pouce' ? 'pouce' : 'mm';
}

/**
 * Ce que le client a tapé, en millimètres entiers — ou `null` si ce n'est
 * pas encore une cote. `null` veut dire « ne touche à rien », jamais zéro.
 */
export function versMm(texte: string, unite: Unite): number | null {
  return analyserCote(texte, unite);
}

/** Ce qu'on met DANS le champ — la valeur nue, sans son symbole d'unité. */
export function depuisMm(valeurMm: number, unite: Unite): string {
  return valeurPourChamp(valeurMm, unite);
}

/** Ce qu'on écrit dans une phrase — la valeur ET son unité : `47 1/4"`. */
export function formater(valeurMm: number, unite: Unite): string {
  return formaterCote(valeurMm, unite);
}

/** L'étiquette d'un champ de cote : « Largeur (mm) » ou « Largeur (pouces) ». */
export function etiquette(nom: string, unite: Unite): string {
  return `${nom} (${unite === 'pouce' ? 'pouces' : 'mm'})`;
}
