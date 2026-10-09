
import type { ManoeuvreVolet, TypeCoffre } from './types.ts';

/** Ce qu'un coffre change pour le client — et il ne le voit pas sur le prix. */
export const ARGUMENTS_DE_COFFRE: Record<TypeCoffre, string> = {
  exterieur:
    'Posé en applique au-dessus de la fenêtre — le volet de rénovation. Il se voit, et il prend le haut du tableau.',
  tunnel:
    'Maçonné dans le linteau : invisible de la rue comme de la pièce, et il ne prend rien au clair de jour. Se prévoit à la construction.',
  'bloc-baie':
    'Coffre solidaire du dormant, livré monobloc avec la menuiserie — une seule pose, aucun pont thermique au raccord.',
};

/** Ce qu'une manœuvre change pour la main qui l'emploie. */
export const ARGUMENTS_DE_MANOEUVRE: Record<ManoeuvreVolet, string> = {
  sangle: 'L’enrouleur encastré dans le tableau — la manœuvre la plus répandue et la moins chère.',
  manivelle:
    'Une tringle oscillante sort du caisson : elle passe là où la sangle ne passe pas — derrière un plan de travail, sur une baie large.',
};
