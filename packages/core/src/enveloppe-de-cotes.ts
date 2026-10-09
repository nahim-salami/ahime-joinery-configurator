/**
 * Pourquoi ce fichier existe : le lot MT1a, et une faute mesurée avant
 * d'être écrite.
 *
 * Schüco publie pour le coulissant à levage ASE 80.HI un vantail « jusqu'à
 * 3 500 × 3 200 mm ou 3 200 × 3 500 mm ». La façon évidente de ranger cela
 * dans un catalogue est un couple de maxima — `largeurMax: 3500,
 * hauteurMax: 3500` —, et elle est FAUSSE : ce couple accepte
 * 3 400 × 3 400, qui n'est dans AUCUN des deux rectangles publiés.
 *
 * MESURÉ SUR LE MOTEUR DE CE DÉPÔT, en triple vitrage : les deux cotes
 * publiées pèsent 344 et 345 kg — même surface, 11,20 m², à un kilo près.
 * Le coin ajouté par la paire de maxima, lui, pèse **355 kg**. Le point que
 * personne n'a publié est exactement le plus LOURD de l'enveloppe.
 *
 * La conclusion est la raison d'être du fichier : **une cote maximale de
 * fabricant n'est pas une limite de fabrication, c'est une limite de FERRURE
 * écrite en millimètres** — parce que le millimètre est ce qu'un client sait
 * mesurer. Et donc : **une enveloppe déclarée est une LISTE de rectangles,
 * jamais leur rectangle englobant.**
 *
 * C'est la leçon du lot Z8 en deux dimensions. « ≤ 2 450 → 5 paumelles » ne
 * veut pas dire que tout ce qui dépasse vaut 5 ; « 3 500 × 3 200 ou
 * 3 200 × 3 500 » ne veut pas dire « ≤ 3 500 dans les deux sens ».
 *
 * SOLUTION ÉCARTÉE : ne garder que la surface (11,20 m²), puisque c'est elle
 * qui décide de la masse. Elle accepterait un vantail de 5 000 × 2 240 — même
 * surface, hors de tout chariot, hors de tout rail, et impossible à porter à
 * deux. Une surface n'est pas une enveloppe : la ferrure limite la MASSE, et
 * le châssis limite l'ÉLANCEMENT. Les deux rectangles disent les deux à la
 * fois, et c'est pour cela que le fabricant en publie deux plutôt qu'une
 * formule.
 *
 * Ce module ne connaît AUCUN produit : il compare des cotes à des rectangles
 * déclarés. Les rectangles vivent dans le catalogue, avec leur source.
 *
 * Il vit hors du chargement initial — `index.ts` ne le réexporte pas, la
 * marge d'entrée est de 32 octets gzippés depuis le lot Z17.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import { entier } from './ecriture-francaise.ts';

/** Un rectangle PUBLIÉ, tel que le fabricant l'écrit. */
export interface RectangleAdmis {
  readonly largeurMaxMm: number;
  readonly hauteurMaxMm: number;
  /** Ce qui s'affiche — « 3 500 × 3 200 ». */
  readonly libelle?: string;
}

/** L'enveloppe d'un ouvrage : la liste de ce qui est publié, et sa source. */
export interface EnveloppeDeCotes {
  readonly code: string;
  readonly libelle: string;
  readonly rectangles: readonly RectangleAdmis[];
  /** Aucun nombre sans source. */
  readonly source: string;
}

/** Pourquoi une cote est hors enveloppe. Les deux ne se corrigent pas pareil. */
export type MotifDEnveloppe =
  | 'hors-enveloppe'
  | 'enveloppe-vide';

export interface RefusDEnveloppe {
  readonly motif: MotifDEnveloppe;
  /** La phrase : le rectangle le plus proche, et la cote à rendre. */
  readonly message: string;
  /** Le rectangle qui accepterait si l'on rendait quelque chose. */
  readonly leplusProche?: RectangleAdmis;
  /** Ce qu'il faut rendre, en millimètres, sur chaque côté. */
  readonly aRendre?: { readonly largeurMm: number; readonly hauteurMm: number };
}

/** Le libellé d'un rectangle, écrit s'il ne l'est pas. */
function ecrire(rectangle: RectangleAdmis): string {
  return rectangle.libelle ?? `${entier(rectangle.largeurMaxMm)} × ${entier(rectangle.hauteurMaxMm)} mm`;
}

/**
 * CE QU'IL FAUDRAIT RENDRE POUR ENTRER DANS UN RECTANGLE.
 *
 * Zéro sur un côté veut dire que ce côté passe déjà. On rend les deux, parce
 * qu'un client qui ne peut pas réduire la hauteur veut savoir combien il lui
 * reste à céder sur la largeur.
 */
function aRendre(
  rectangle: RectangleAdmis,
  largeurMm: number,
  hauteurMm: number,
): { largeurMm: number; hauteurMm: number } {
  return {
    largeurMm: Math.max(0, largeurMm - rectangle.largeurMaxMm),
    hauteurMm: Math.max(0, hauteurMm - rectangle.hauteurMaxMm),
  };
}

/** Le rectangle est-il tenu ? */
export function dansLeRectangle(
  rectangle: RectangleAdmis,
  largeurMm: number,
  hauteurMm: number,
): boolean {
  return largeurMm <= rectangle.largeurMaxMm && hauteurMm <= rectangle.hauteurMaxMm;
}

/**
 * CES COTES SONT-ELLES DANS L'ENVELOPPE ?
 *
 * Rend `null` quand elles le sont — un refus ou rien, comme partout dans ce
 * cœur.
 *
 * LE REFUS NOMME LE RECTANGLE LE PLUS PROCHE, et « le plus proche » est
 * celui qui demande de rendre le MOINS de millimètres en tout. Trier sur le
 * premier côté qui dépasse ferait dépendre le conseil de l'ordre dans lequel
 * les rectangles ont été écrits, et deux catalogues du même produit
 * donneraient deux conseils — c'est la faute que le lot Z9 a corrigée sur
 * les critères d'un catalogue fermé.
 *
 * ET QUAND DEUX RECTANGLES SONT À ÉGALITÉ, ON LES NOMME TOUS LES DEUX :
 * « rendez 200 mm de large OU 200 mm de haut » est un choix qui appartient
 * au client, pas au moteur (règle du lot Z9, retrouvée au lot Z15).
 */
export function horsEnveloppe(
  enveloppe: EnveloppeDeCotes,
  largeurMm: number,
  hauteurMm: number,
): RefusDEnveloppe | null {
  if (enveloppe.rectangles.length === 0) {
    return {
      motif: 'enveloppe-vide',
      message:
        `« ${enveloppe.libelle} » ne déclare aucune cote admise (${enveloppe.source}). Une ` +
        'enveloppe vide n’accepte rien : elle se déclare, rectangle par rectangle, comme le ' +
        'fabricant les publie.',
    };
  }

  if (enveloppe.rectangles.some((r) => dansLeRectangle(r, largeurMm, hauteurMm))) return null;

  const chiffres = enveloppe.rectangles.map((rectangle) => {
    const reste = aRendre(rectangle, largeurMm, hauteurMm);
    return { rectangle, reste, total: reste.largeurMm + reste.hauteurMm };
  });
  const moindre = Math.min(...chiffres.map((c) => c.total));
  const proches = chiffres.filter((c) => c.total === moindre);

  const conseils = proches
    .map(({ rectangle, reste }) => {
      const cotes: string[] = [];
      if (reste.largeurMm > 0) cotes.push(`${entier(reste.largeurMm)} mm de large`);
      if (reste.hauteurMm > 0) cotes.push(`${entier(reste.hauteurMm)} mm de haut`);
      return `${ecrire(rectangle)} (rendre ${cotes.join(' et ')})`;
    })
    .join(', ou ');

  return {
    motif: 'hors-enveloppe',
    message:
      `${entier(largeurMm)} × ${entier(hauteurMm)} mm n’est dans aucune cote publiée de « ${enveloppe.libelle} » : ` +
      `${enveloppe.rectangles.map(ecrire).join(' ou ')} (${enveloppe.source}). ` +
      `Le plus proche : ${conseils}.`,
    leplusProche: proches[0].rectangle,
    aRendre: proches[0].reste,
  };
}

/**
 * LE RECTANGLE ENGLOBANT — écrit pour être REFUSÉ, pas pour servir.
 *
 * Il existe uniquement pour que `enveloppe-de-cotes.test.ts` puisse montrer,
 * sur les vraies cotes de l'ASE 80.HI, que le raccourci accepte un vantail
 * que le fabricant n'a jamais publié — et que ce vantail est le plus lourd
 * de tous. Aucun code de production ne l'appelle, et un comparateur le
 * vérifie.
 */
export function rectangleEnglobant(enveloppe: EnveloppeDeCotes): RectangleAdmis {
  return {
    largeurMaxMm: Math.max(...enveloppe.rectangles.map((r) => r.largeurMaxMm)),
    hauteurMaxMm: Math.max(...enveloppe.rectangles.map((r) => r.hauteurMaxMm)),
    libelle: 'rectangle englobant — LE RACCOURCI QU’ON REFUSE',
  };
}
