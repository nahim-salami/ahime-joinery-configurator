/**
 * Pourquoi ce fichier existe : LE COFFRE D'UN BLOC-BAIE MANGE LA HAUTEUR
 * COMMANDÉE, ET PERSONNE NE LE DISAIT — lot O10.
 *
 * MESURÉ avant d'écrire une ligne, sur une fenêtre 1 200 × 1 450 :
 *
 * | | sans l'option | avec l'option |
 * |---|---|---|
 * | bas du dessin | 1 450 | **1 630** |
 * | hauteur de vantail | 1 450 | **1 450** |
 * | clair de vitrage | 1 280 | **1 280** |
 * | masse de vitrage | 23,6 kg | **23,6 kg** |
 *
 * Le coffre s'ajoutait PAR-DESSUS la cote saisie — **180 mm, 12,4 % de la
 * hauteur** — et la mesure l'ignorait entièrement : le vantail, le clair, la
 * masse de vitrage et l'Uw étaient identiques avec et sans. L'ouvrage livré ne
 * rentrait pas dans le trou mesuré, et rien ne le disait.
 *
 * LA COTE SAISIE EST CELLE DU TABLEAU, et le catalogue l'écrit mot pour mot :
 * « du rejingot au linteau, au plus court des trois mesures, jeu de pose
 * déduit ». Un bloc-baie est un MONOBLOC — son coffre est solidaire du
 * dormant et entre dans le trou AVEC lui, ce que l'argument du catalogue dit
 * aussi : « une seule pose, aucun pont thermique au raccord ». Le relevé de
 * Fenetre24 (docs/51 §4.1) tranche dans le même sens et le répète deux fois
 * sur sa page : « la hauteur du caisson est comprise dans la hauteur totale
 * de la fenêtre ».
 *
 * C'EST UN JEU DE COTES À LETTRES (lot Z6) : une cote saisie que des choix
 * ULTÉRIEURS mangent. Le relevé nomme trois accessoires de ce genre — le
 * coffre, le profilé de raccord d'un appui et l'élargisseur de dormant — et
 * met un avertissement sur chacun. Celui-ci est le seul que ce catalogue
 * vend ; les deux autres attendent un prix déclaré.
 *
 * CE QUE LA RÈGLE FAIT, ET CE QU'ELLE NE FAIT PAS : elle DIT la cote qui
 * reste, en `info`. Ce n'est pas un refus — la configuration est parfaitement
 * fabricable —, et ce n'est pas une alternative : augmenter la hauteur
 * commandée ferait dépasser le tableau, et retirer l'option est un choix de
 * produit que le client fait lui-même. « Chaque état vide enseigne », et
 * celui-ci n'est pas vide : c'est une cote qu'on lui doit.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import { coffreDuBlocBaieMm, hauteurDeMenuiserieMm } from '../../structural.ts';
import { entier } from '../../ecriture-francaise.ts';
import type { JoineryConfiguration, ValidationIssue } from '../../types.ts';

/** La remarque du bloc-baie : ce que le coffre prend, et ce qu'il reste. */
export function reglesDuBlocBaie(contexte: { config: JoineryConfiguration }): ValidationIssue[] {
  const { config } = contexte;
  const coffre = coffreDuBlocBaieMm(config);
  if (coffre <= 0) return [];
  return [
    {
      // LE CODE COMMENCE PAR `option-`, ET CE N'EST PAS UN DÉTAIL DE NOM :
      // c'est lui qui range la remarque à l'étape des OPTIONS — là où le
      // client vient de cocher le bloc-baie —, sans une ligne de rangement.
      // Leçon du lot O5, où un refus rangé sous l'écran du coffre restait
      // invisible : l'accordéon n'affiche que le corps ouvert.
      code: 'option-bloc-baie-hauteur',
      severite: 'info',
      message:
        `Bloc-baie : le coffre prend ${entier(coffre)} mm sur la hauteur commandée — il reste ` +
        `${entier(hauteurDeMenuiserieMm(config))} mm de menuiserie. C’est un monobloc : le coffre ` +
        'entre dans le tableau AVEC le dormant, et la cote que vous avez mesurée va du rejingot ' +
        'au linteau.',
    },
  ];
}
