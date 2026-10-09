
/** Les trois façons dont un vantail bouge. L'entrée n'en connaît pas d'autre. */
export type Cinematique = 'pivote' | 'glisse' | 'immobile';

export interface OuvertureDeclaree {
  readonly code: string;
  readonly label: string;
  readonly cinematique: Cinematique;
  readonly familles?: readonly string[];
  /** Aucun nombre sans source, et aucune ouverture sans fiche. */
  readonly source: string;
}

/**
 * LA CINÉMATIQUE D'UNE OUVERTURE, native ou déclarée.
 *
 * `null` quand le code n'est ni l'un ni l'autre — et c'est le seul cas où le
 * dessin doit se taire plutôt que de choisir. Les six natives sont écrites
 * ici parce que le cœur les connaît de toute façon ; les déclarées se lisent
 * dans le catalogue.
 */
export function cinematiqueDeclaree(
  code: string,
  declarees: readonly OuvertureDeclaree[],
): Cinematique | undefined {
  return declarees.find((d) => d.code === code)?.cinematique;
}

/**
 * L'OUVERTURE NATIVE QUI SE DESSINE COMME CELLE-CI — la couture même.
 *
 * `sensDesVantaux` ne reçoit jamais le mot « guillotine » : il reçoit
 * « coulissant », parce que c'est ainsi que la guillotine se dessine. Les
 * trois cinématiques se ramènent aux trois natives les plus simples, et
 * c'est ce qui permet à l'entrée de n'apprendre AUCUN nom nouveau.
 *
 * Cette fonction vit HORS du chargement initial : elle est appelée par les
 * modules de famille, qui sont paresseux. Un test refuse qu'`index.ts` la
 * réexporte — la leçon du lot Z0, payée en octets.
 */
export function ouvertureNativeEquivalente(
  code: string | undefined,
  declarees: readonly OuvertureDeclaree[],
): 'frappe' | 'coulissant' | 'fixe' | undefined {
  if (code === undefined) return undefined;
  const cinematique = cinematiqueDeclaree(code, declarees);
  if (cinematique === 'glisse') return 'coulissant';
  if (cinematique === 'immobile') return 'fixe';
  if (cinematique === 'pivote') return 'frappe';
  return undefined;
}

export function cinematiqueDe(
  ouverture: string | undefined,
  declarees: readonly OuvertureDeclaree[] = [],
): Cinematique | null {
  if (ouverture === undefined) return null;
  if (ouverture === 'fixe') return 'immobile';
  if (ouverture === 'frappe' || ouverture === 'soufflet') return 'pivote';
  if (ouverture === 'coulissant' || ouverture === 'galandage' || ouverture === 'levage') {
    return 'glisse';
  }
  return cinematiqueDeclaree(ouverture, declarees) ?? null;
}

/** Le libellé à afficher — le déclaré s'il existe, sinon le code brut. */
export function libelleDOuverture(
  ouverture: string,
  declarees: readonly OuvertureDeclaree[] = [],
): string | null {
  return declarees.find((d) => d.code === ouverture)?.label ?? null;
}

/**
 * CETTE OUVERTURE EST-ELLE VENDUE SUR CETTE FAMILLE ?
 *
 * Une ouverture déclarée sans `familles` vaut partout. Une ouverture inconnue
 * n'est pas « refusée » ici : c'est `refusDOuvertureInconnue` qui le dit, avec
 * ce qui manque.
 */
export function ouvertureAdmise(
  ouverture: string,
  famille: string,
  declarees: readonly OuvertureDeclaree[] = [],
): boolean {
  const declaree = declarees.find((d) => d.code === ouverture);
  if (!declaree) return false;
  return declaree.familles === undefined || declaree.familles.includes(famille);
}

/**
 * CE QU'ON DIT D'UNE OUVERTURE QUE PERSONNE N'A DÉCLARÉE.
 *
 * Ni rien — le vantail se dessinerait au hasard d'un cas attrape-tout, la
 * faute du lot MT1a —, ni un message technique : l'intégrateur qui lit cette
 * phrase a un catalogue à compléter, et elle lui dit quoi y écrire.
 */
export function refusDOuvertureInconnue(ouverture: string): string {
  return (
    `L’ouverture « ${ouverture} » n’est ni l’une des six que le cœur connaît, ni déclarée au ` +
    'catalogue. Une ouverture nouvelle se déclare avec sa CINÉMATIQUE — pivote, glisse ou ' +
    'immobile —, son libellé, les familles qui la vendent et sa source : sans elle, le dessin ' +
    'devrait choisir tout seul comment le vantail bouge, et il choisirait mal.'
  );
}
