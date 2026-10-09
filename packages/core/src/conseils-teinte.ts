/**
 * Pourquoi ce fichier existe : `resoudreTeintes` rend des FAITS — deux
 * hexadécimaux, deux codes RAL, une brillance. Ce qu'un choix de teinte
 * IMPOSE est autre chose, et c'est bien plus long à écrire : un délai de
 * laquage hors standard, la dilatation d'un PVC foncé, une bicoloration
 * qui n'en est pas une.
 *
 * Les deux se séparent parce qu'ils ne servent pas au même moment. Le
 * DESSIN a besoin des faits dès la première seconde ; les CONSEILS ne
 * servent qu'à l'écran qui pose la question, et cet écran ne s'ouvre que
 * si le client quitte le blanc. Les garder ensemble faisait télécharger
 * quatre paragraphes de français à tout visiteur, y compris celui qui ne
 * changera jamais de couleur.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { Materiau } from './types.ts';
import { DECORS_PLAXES, NUANCIER, type ChoixTeinte, type TeinteRal } from './teintes.ts';

/**
 * CE QUE LE CHOIX DE TEINTE IMPOSE, en clair. Vide quand il n'y a rien à
 * signaler — et c'est le cas le plus fréquent, celui du blanc.
 */
export function conseilsDeTeinte(choix: ChoixTeinte): string[] {
  const conseils: string[] = [];
  const ralDe = (code: string | undefined): TeinteRal | undefined =>
    code ? NUANCIER.find((teinte) => teinte.code === code) : undefined;

  if (choix.couleur === 'plaxe') {
    const decor = choix.decorPlaxe
      ? DECORS_PLAXES.find((candidat) => candidat.id === choix.decorPlaxe)
      : undefined;
    if (!decor && choix.decorPlaxe) {
      conseils.push(
        `Décor « ${choix.decorPlaxe} » inconnu — ${DECORS_PLAXES[0].nom} retenu.`,
      );
    }
    if (choix.materiau !== 'pvc') {
      conseils.push(
        'Le plaxage est un film collé sur du PVC. Sur un autre matériau, ' +
          'c’est un laquage ou une lasure qu’il faut demander.',
      );
    }
    return conseils;
  }

  if (choix.couleur === 'ral-1-face' || choix.couleur === 'bicolore') {
    const demande = ralDe(choix.ralExterieur);
    const dehors = demande ?? NUANCIER[0];
    if (!demande && choix.ralExterieur) {
      conseils.push(
        `RAL ${choix.ralExterieur} hors nuancier courant — ${dehors.code} ` +
          `${dehors.nom.toLowerCase()} retenu. Un hors-nuancier se laque à la demande, avec un délai.`,
      );
    } else if (!dehors.standard) {
      conseils.push(
        `RAL ${dehors.code} n’est pas tenu en standard : comptez un délai de laquage supplémentaire.`,
      );
    }
    if (choix.couleur === 'bicolore') {
      const dedans = ralDe(choix.ralInterieur) ?? NUANCIER.find((t) => t.code === '9016')!;
      if (dedans.code === dehors.code) {
        // LA PERTE DE MARGE VOLONTAIRE. Deux faces de la même teinte, c'est
        // une teinte UNE FACE, et elle coûte moins cher. Le dire coûte
        // immédiatement et rapporte en confiance ; ce projet a déjà tranché
        // dans ce sens sur le triple vitrage acoustique.
        conseils.push(
          'Les deux faces portent la même teinte : une menuiserie « une face » suffit, et coûte moins cher.',
        );
      }
    }
    conseils.push(...conseilsDeChaleur(dehors, choix.materiau));
  }
  return conseils;
}

/**
 * CE QU'UNE TEINTE FONCÉE FAIT AU PROFILÉ, et personne ne le dit au client.
 *
 * Un dormant PVC anthracite atteint 70 °C au soleil d'été là où un blanc
 * plafonne à 40. Le PVC se dilate, et les gammistes limitent en
 * conséquence : dimensions maximales réduites, renforts imposés, garantie
 * parfois restreinte sur les grandes largeurs plein sud. C'est la remarque
 * la plus utile qu'un configurateur puisse faire sur une couleur, et c'est
 * celle qu'on ne trouve nulle part.
 *
 * L'aluminium, lui, s'en moque : il conduit, il ne fond pas, et il se
 * dilate huit fois moins que le PVC.
 */
function conseilsDeChaleur(ral: TeinteRal, materiau: Materiau): string[] {
  if (materiau !== 'pvc' || !estFoncee(ral.hex)) return [];
  return [
    `Teinte foncée sur du PVC : un dormant ${ral.nom.toLowerCase()} monte à 70 °C au soleil ` +
      'contre 40 pour un blanc. Le PVC se dilate — les grandes largeurs plein sud demandent ' +
      'des renforts, et certains gammistes y limitent leur garantie.',
  ];
}

/**
 * Une teinte est « foncée » quand sa luminance relative est basse. On
 * calcule la vraie luminance perceptuelle et pas une moyenne des canaux :
 * le vert pèse pour les deux tiers dans ce que l'œil appelle clair, et un
 * vert mousse RAL 6005 doit être compté foncé alors qu'une moyenne le
 * classerait moyen.
 */
function estFoncee(hex: string): boolean {
  const valeur = Number.parseInt(hex.slice(1), 16);
  const r = ((valeur >> 16) & 255) / 255;
  const v = ((valeur >> 8) & 255) / 255;
  const b = (valeur & 255) / 255;
  return 0.2126 * r + 0.7152 * v + 0.0722 * b < 0.4;
}
