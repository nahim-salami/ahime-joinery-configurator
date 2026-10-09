/**
 * Pourquoi ce fichier existe : le lot 2 a posé un verrou — le manifeste
 * refuse de s'émettre tant que les cotes ne sont pas VALIDÉES. Il manquait
 * ce qui permet d'y arriver. Un verrou qu'on ne peut jamais ouvrir n'est
 * pas un garde-fou, c'est une impasse.
 *
 * Ce que ce module rend : LE RELEVÉ AUX TROIS POINTS, celui que tout
 * métreur fait et qu'aucun configurateur ne demande. Trois largeurs — en
 * haut, au milieu, en bas —, trois hauteurs — à gauche, au milieu, à
 * droite —, et les deux diagonales. Six mesures au lieu de deux, et elles
 * disent des choses différentes :
 *
 *   - LA PLUS PETITE des trois largeurs est la seule qui compte. Une
 *     menuiserie ne rentre pas dans la moyenne d'un tableau : elle rentre
 *     dans son point le plus étroit, ou elle ne rentre pas.
 *   - L'ÉCART ENTRE LES DIAGONALES dit le FAUX ÉQUERRAGE. Un tableau dont
 *     les diagonales diffèrent de vingt millimètres n'est pas un
 *     rectangle : poser un dormant rectangulaire dedans laisse un jour
 *     triangulaire qu'aucun joint ne rattrape.
 *
 * Solution écartée : demander une largeur et une hauteur, et prévenir en
 * petits caractères qu'il faut mesurer en trois points. C'est ce que font
 * les configurateurs en ligne, et c'est la première cause de rebut à la
 * pose. Un conseil qu'on peut ignorer est ignoré ; six champs à remplir ne
 * s'ignorent pas.
 *
 * Solution écartée aussi : refuser tout relevé imparfait. Un tableau de
 * rénovation est TOUJOURS imparfait — c'est un mur de 1970 qui a bougé.
 * Ce module ne refuse presque rien : il MESURE le défaut, il dit ce qu'il
 * impose (un rattrapage, une bavette, un contre-métré), et il laisse
 * décider. Ce qu'il refuse, c'est de laisser croire qu'un tableau tordu est
 * droit.
 *
 * LES TROIS ÉTATS, et ce qu'ils engagent :
 *
 *   `declaree`  — le client a saisi deux nombres. Une intention.
 *   `confirmee` — un relevé aux trois points existe et se tient. Quelqu'un
 *                 a mesuré pour de bon, mais depuis chez lui.
 *   `validee`   — un professionnel a relevé SUR PLACE et en répond. C'est
 *                 le seul état qui autorise le manifeste.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { EtatDesCotes } from './export/manifeste.ts';

export interface ReleveTroisPoints {
  /** Les trois largeurs, en mm : haut, milieu, bas. */
  largeursMm: [number, number, number];
  /** Les trois hauteurs, en mm : gauche, milieu, droite. */
  hauteursMm: [number, number, number];
  /**
   * Les deux diagonales, en mm. Optionnelles : elles demandent un mètre à
   * deux personnes ou un télémètre, et un relevé sans elles vaut mieux
   * qu'un relevé pas fait. Leur absence empêche seulement de conclure sur
   * l'équerrage — et le rapport le DIT.
   */
  diagonalesMm?: [number, number];
  /**
   * Vrai quand un professionnel a relevé SUR PLACE. C'est ce qui sépare
   * `confirmee` de `validee`, et c'est une déclaration de responsabilité,
   * pas une mesure de plus.
   */
  releveSurPlace?: boolean;
}

export interface RapportMetrage {
  /** La cote à retenir — la plus petite, jamais la moyenne. */
  largeurRetenueMm: number;
  hauteurRetenueMm: number;
  /** L'écart entre la plus grande et la plus petite mesure, par axe. */
  ecartLargeurMm: number;
  ecartHauteurMm: number;
  /**
   * L'écart entre les deux diagonales, en mm — le FAUX ÉQUERRAGE.
   * `null` quand elles n'ont pas été relevées.
   */
  ecartDiagonaleMm: number | null;
  /** L'état auquel ce relevé donne droit. */
  etat: EtatDesCotes;
  /** Ce que le relevé impose, en clair. Vide quand le tableau est sain. */
  consignes: string[];
  /** Ce qui empêche de monter d'un état. Vide quand rien n'empêche. */
  blocages: string[];
}

/**
 * LES SEUILS, et ils viennent du terrain plus que d'une norme.
 *
 * NF DTU 36.5 fixe les tolérances de POSE — le jeu périphérique, l'aplomb
 * du dormant fini. Ce qu'il ne fixe pas, c'est à partir de quand un
 * TABLEAU EXISTANT est trop tordu pour qu'on y pose sans précaution : ça,
 * c'est le métier qui le dit, et les valeurs ci-dessous sont celles qu'un
 * poseur applique.
 */
export const SEUILS_METRAGE = {
  /** Au-delà, l'écart entre les trois mesures d'un axe demande un rattrapage. */
  ecartAxeMm: 10,
  /** Au-delà, le faux équerrage impose un contre-métré sur place. */
  ecartDiagonaleMm: 15,
  /** En deçà, un écart de diagonale est celui d'un tableau ordinaire. */
  ecartDiagonaleAcceptableMm: 8,
} as const;

/**
 * CE QUE VAUT UN RELEVÉ — la cote à retenir, le défaut mesuré, et l'état
 * auquel il donne droit.
 *
 * Il ne refuse pas un tableau tordu : il le DÉCRIT. Le seul refus est celui
 * d'un relevé incohérent — trois largeurs dont l'une est le double de
 * l'autre n'est pas un tableau, c'est une faute de frappe, et la laisser
 * passer ferait fabriquer sur elle.
 */
export function computeMetrage(releve: ReleveTroisPoints): RapportMetrage {
  const consignes: string[] = [];
  const blocages: string[] = [];

  const largeurs = releve.largeursMm;
  const hauteurs = releve.hauteursMm;
  const largeurRetenueMm = Math.min(...largeurs);
  const hauteurRetenueMm = Math.min(...hauteurs);
  const ecartLargeurMm = Math.max(...largeurs) - largeurRetenueMm;
  const ecartHauteurMm = Math.max(...hauteurs) - hauteurRetenueMm;

  // LA FAUTE DE FRAPPE. Un écart de plus d'un dixième entre deux mesures du
  // même axe n'est pas un mur qui a bougé : c'est un chiffre saisi de
  // travers, ou deux points mesurés qui ne sont pas les mêmes. Fabriquer
  // dessus coûte une menuiserie entière.
  const suspect = (retenue: number, ecart: number) => retenue > 0 && ecart > retenue * 0.1;
  if (suspect(largeurRetenueMm, ecartLargeurMm)) {
    blocages.push(
      `Les trois largeurs varient de ${ecartLargeurMm} mm sur ${largeurRetenueMm} — ` +
        'un tableau ne se déforme pas autant. Vérifiez la saisie ou reprenez le relevé.',
    );
  }
  if (suspect(hauteurRetenueMm, ecartHauteurMm)) {
    blocages.push(
      `Les trois hauteurs varient de ${ecartHauteurMm} mm sur ${hauteurRetenueMm} — ` +
        'vérifiez la saisie ou reprenez le relevé.',
    );
  }
  if (largeurs.some((mm) => mm <= 0) || hauteurs.some((mm) => mm <= 0)) {
    blocages.push('Une cote nulle ou négative : le relevé est incomplet.');
  }

  // LA PLUS PETITE COTE, dite explicitement — c'est le point où beaucoup se
  // trompent en prenant la moyenne, et l'écart se paie à la pose.
  if (estUneDeclarationDeguisee(releve) && !releve.releveSurPlace) {
    consignes.push(
      'Les trois mesures sont identiques au millimètre sur les deux axes. Un mur enduit ' +
        'varie toujours de deux ou trois millimètres sur un mètre : reprenez le relevé aux ' +
        'trois points, ou faites-le confirmer sur place.',
    );
  }
  if (ecartLargeurMm > 0 || ecartHauteurMm > 0) {
    consignes.push(
      `Cote retenue : ${largeurRetenueMm} × ${hauteurRetenueMm} mm — la plus PETITE des trois, ` +
        'jamais la moyenne : une menuiserie entre par son point le plus étroit.',
    );
  }

  if (ecartLargeurMm > SEUILS_METRAGE.ecartAxeMm) {
    consignes.push(
      `${ecartLargeurMm} mm d’écart entre les trois largeurs : le tableau se resserre. ` +
        'Prévoyez un rattrapage (couvre-joint ou élargisseur) du côté le plus large.',
    );
  }
  if (ecartHauteurMm > SEUILS_METRAGE.ecartAxeMm) {
    consignes.push(
      `${ecartHauteurMm} mm d’écart entre les trois hauteurs : prévoyez un rattrapage en traverse haute.`,
    );
  }

  // L'ÉQUERRAGE. C'est la mesure la plus utile du relevé et la plus souvent
  // omise : deux diagonales égales disent qu'on peut poser un rectangle,
  // et rien d'autre ne le dit.
  let ecartDiagonaleMm: number | null = null;
  if (releve.diagonalesMm) {
    const [a, b] = releve.diagonalesMm;
    ecartDiagonaleMm = Math.abs(a - b);
    if (ecartDiagonaleMm > SEUILS_METRAGE.ecartDiagonaleMm) {
      consignes.push(
        `${ecartDiagonaleMm} mm entre les deux diagonales : le tableau n’est pas d’équerre. ` +
          'Un dormant rectangulaire y laissera un jour triangulaire — un contre-métré sur place est nécessaire.',
      );
      // Ce n'est PAS un blocage du relevé : le relevé est bon, c'est le mur
      // qui est tordu. Ce qu'il bloque, c'est le passage à `validee` sans
      // que quelqu'un soit allé voir.
      blocages.push(
        `Faux équerrage de ${ecartDiagonaleMm} mm : au-delà de ${SEUILS_METRAGE.ecartDiagonaleMm} mm, ` +
          'seul un relevé sur place peut valider les cotes.',
      );
    } else if (ecartDiagonaleMm > SEUILS_METRAGE.ecartDiagonaleAcceptableMm) {
      consignes.push(
        `${ecartDiagonaleMm} mm entre les diagonales — un tableau ordinaire. ` +
          'Le jeu de pose l’absorbe, à condition de caler le dormant d’aplomb et non parallèle au mur.',
      );
    }
  } else {
    consignes.push(
      'Diagonales non relevées : l’équerrage du tableau reste inconnu. ' +
        'Deux mesures de plus, et on saura si un dormant rectangulaire y entre.',
    );
  }

  return {
    largeurRetenueMm,
    hauteurRetenueMm,
    ecartLargeurMm,
    ecartHauteurMm,
    ecartDiagonaleMm,
    etat: etatDe(releve, blocages),
    consignes,
    blocages,
  };
}

/**
 * L'ÉTAT auquel un relevé donne droit.
 *
 * `validee` demande DEUX choses ensemble : un relevé sur place, et rien qui
 * bloque. Le relevé sur place seul ne suffit pas — un métreur qui trouve un
 * faux équerrage de trente millimètres ne valide pas, il signale.
 *
 * `confirmee` demande que le relevé en soit un. Trois nombres identiques
 * sur les deux axes ne se distinguent pas d'une saisie recopiée, et on ne
 * peut pas monter d'état sur quelque chose qu'on ne sait pas distinguer
 * d'une déclaration. Un métreur SUR PLACE, lui, engage sa responsabilité :
 * s'il annonce trois fois la même cote, c'est qu'il l'a trouvée trois fois,
 * et c'est sa signature qui répond, pas la forme des chiffres.
 */
function etatDe(releve: ReleveTroisPoints, blocages: string[]): EtatDesCotes {
  if (blocages.length > 0) return 'declaree';
  if (releve.releveSurPlace) return 'validee';
  if (estUneDeclarationDeguisee(releve)) return 'declaree';
  return 'confirmee';
}

/**
 * LE RELEVÉ D'UNE COTE DÉCLARÉE — deux nombres, répétés trois fois.
 *
 * Il sert à une seule chose, et elle compte : permettre au reste du code de
 * traiter uniformément une saisie sommaire et un vrai relevé. L'état qu'il
 * rend est `declaree`, et il le restera — ce n'est pas parce qu'on écrit le
 * même nombre trois fois qu'on a mesuré trois fois.
 */
export function releveDeclare(largeurMm: number, hauteurMm: number): ReleveTroisPoints {
  return {
    largeursMm: [largeurMm, largeurMm, largeurMm],
    hauteursMm: [hauteurMm, hauteurMm, hauteurMm],
  };
}

/**
 * Vrai quand ce relevé n'est qu'une déclaration déguisée : trois mesures
 * rigoureusement identiques sur les deux axes.
 *
 * Un vrai tableau n'a jamais trois largeurs au millimètre près — un mur
 * enduit varie de deux ou trois millimètres sur un mètre, toujours. Trois
 * nombres identiques veulent donc dire « j'ai mesuré une fois et j'ai
 * recopié », et le relevé ne peut pas prétendre à `confirmee`.
 */
export function estUneDeclarationDeguisee(releve: ReleveTroisPoints): boolean {
  const identiques = (trio: [number, number, number]) => trio[0] === trio[1] && trio[1] === trio[2];
  return identiques(releve.largeursMm) && identiques(releve.hauteursMm);
}
