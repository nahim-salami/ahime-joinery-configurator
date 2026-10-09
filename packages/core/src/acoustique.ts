/**
 * Pourquoi ce fichier existe : le bruit est le deuxième argument d'achat
 * après l'isolation thermique, et rien ne le calculait. Un client qui
 * choisit un vitrage phonique payait un supplément sans qu'aucun chiffre
 * ne lui dise ce qu'il achetait — alors que le Uw, lui, est recalculé à
 * chaque geste.
 *
 * Solution écartée : un calcul par bandes de tiers d'octave. C'est ce que
 * fait un laboratoire, avec une courbe de mesure par composition ; un
 * configurateur n'a ni les courbes ni le droit de les inventer. Le modèle
 * retenu est celui du métier — loi de masse, bonus d'asymétrie, bonus de
 * feuilleté acoustique — qui donne le bon ordre de grandeur et, surtout,
 * les bons ÉCARTS entre deux vitrages, qui sont ce qu'on compare.
 *
 * Incident fondateur, et c'est une règle de probité : le TRIPLE VITRAGE
 * N'AMÉLIORE PAS L'ACOUSTIQUE. Trois verres minces et deux lames d'air
 * résonnent ensemble ; un 4/16/4/16/4 rend 32 dB, comme un double. Le
 * laisser croire est une réclamation qui arrive, et ce fichier refuse de
 * la préparer.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { JoineryConfiguration } from './types.ts';
import { DEFAULT_CATALOG, type PricingCatalog } from './catalog.ts';
import { effectiveVitrage } from './structural.ts';

export interface RapportAcoustique {
  /** L'affaiblissement du VITRAGE seul, en dB. */
  rwVitrageDb: number;
  /**
   * L'affaiblissement de la FENÊTRE, en dB — vitrage et menuiserie. Il est
   * toujours inférieur à celui du vitrage : le maillon faible d'une
   * menuiserie est son étanchéité, jamais son verre.
   */
  rwFenetreDb: number;
  /** Ce qui a été compté, pour que le chiffre s'explique. */
  postes: Array<{ libelle: string; deltaDb: number }>;
  /**
   * L'avertissement à afficher, quand il y en a un. Le seul aujourd'hui :
   * le triple vitrage n'apporte rien au bruit.
   */
  avertissement?: string;
}

/**
 * L'affaiblissement acoustique d'une configuration — null pour les familles
 * sans vitrage, où il n'y a rien d'honnête à afficher.
 */
export function computeAcoustique(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): RapportAcoustique | null {
  const vitrage = effectiveVitrage(config, catalog);
  if (!vitrage) return null;

  const postes: Array<{ libelle: string; deltaDb: number }> = [];
  // LA BASE : un double vitrage courant rend 31 dB. C'est la référence du
  // métier, et tout le reste s'y ajoute ou s'en retranche.
  let rw = 31;
  postes.push({ libelle: 'double vitrage courant', deltaDb: 31 });

  let avertissement: string | undefined;
  if (vitrage.base === 'triple') {
    // Le triple ne gagne qu'un décibel — dans le bruit de la mesure. On le
    // compte quand même, pour ne pas laisser croire qu'il fait moins bien.
    rw += 1;
    postes.push({ libelle: 'triple vitrage', deltaDb: 1 });
    avertissement =
      'Le triple vitrage n’améliore pas l’isolation acoustique : trois verres et deux lames d’air résonnent ensemble. Pour le bruit, c’est un vitrage asymétrique ou feuilleté acoustique qu’il faut.';
  }

  if (vitrage.phonique) {
    // L'ASYMÉTRIE : passer une face de 4 à 10 mm désaccorde les deux
    // verres, qui cessent de vibrer ensemble. Trois à quatre décibels, et
    // c'est le levier le moins cher du métier.
    rw += 4;
    postes.push({ libelle: 'vitrage asymétrique (phonique)', deltaDb: 4 });
  }
  if (vitrage.feuillete) {
    // Le FILM PVB amortit. Sur un feuilleté acoustique, trois décibels de
    // plus à masse égale — c'est le film qui travaille, pas l'épaisseur.
    rw += 3;
    postes.push({ libelle: 'feuilleté (film amortissant)', deltaDb: 3 });
  }

  const rwVitrage = rw;

  // LA MENUISERIE EST LE MAILLON FAIBLE. Un vitrage à 38 dB posé dans un
  // dormant mal calfeutré en rend 30 : ce sont les joints, l'entrée d'air
  // et le calfeutrement qui décident, pas le verre. On retranche donc ce
  // que la menuiserie perd — c'est la part la moins flatteuse du calcul,
  // et c'est la plus honnête.
  let perte = 3;
  postes.push({ libelle: 'menuiserie (joints, calfeutrement)', deltaDb: -3 });

  const entreeDAir = (config.options ?? []).some((option) => option.id === 'grille-ventilation');
  if (entreeDAir) {
    // Une entrée d'air est un TROU dans la menuiserie. Elle est
    // réglementaire, elle n'est pas gratuite acoustiquement : les modèles
    // acoustiques limitent la perte à trois décibels, les autres coûtent
    // le double.
    perte += 3;
    postes.push({ libelle: 'entrée d’air', deltaDb: -3 });
  }

  return {
    rwVitrageDb: Math.round(rwVitrage),
    rwFenetreDb: Math.round(rwVitrage - perte),
    postes,
    ...(avertissement ? { avertissement } : {}),
  };
}

/**
 * L'isolement de façade minimal exigé en logement neuf : 30 dB pour
 * `DnT,A,tr`. Ce n'est pas le Rw d'une fenêtre — l'isolement se mesure sur
 * la façade entière — mais c'est le chiffre auquel un client compare, et il
 * a le droit de savoir où il se situe.
 */
export const ISOLEMENT_FACADE_MINIMAL_DB = 30;
