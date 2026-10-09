/**
 * Pourquoi ce fichier existe : le cœur mesure en **millimètres entiers**, et
 * cela ne changera pas — `widthMm` est ce que le harnais de parité compare,
 * ce que la matrice interpole, ce que l'atelier coupe. Mais un client
 * britannique ou nord-américain saisit et lit des **pouces**. Ce module est
 * la seule frontière entre les deux : il convertit pour l'ŒIL et pour le
 * CLAVIER, jamais pour le calcul.
 *
 * Solution écartée : porter l'unité dans `JoineryConfiguration` et convertir
 * au moment du prix. C'était introduire un flottant (25,4) dans la chaîne
 * qui produit des centimes — exactement l'interdit de docs/11 §2.3 — et
 * faire dépendre un montant d'un réglage d'affichage. Ici, l'unité ne figure
 * NULLE PART dans la configuration : elle vit dans le contexte de l'hôte, et
 * le moteur ne la voit jamais. Basculer l'affichage ne peut pas déplacer un
 * centime, par construction et pas par vigilance.
 *
 * Solution écartée n° 2 : mettre ces fonctions dans le widget, où se fait la
 * saisie. Mais `export/svg.ts` est dans le cœur et doit coter ses dessins
 * dans l'unité du client — il aurait fallu une seconde implémentation, donc
 * un comparateur (docs/11 §2.6). Une duplication qu'on peut ne pas écrire
 * vaut mieux qu'une duplication qu'on surveille : l'arithmétique vit ici, le
 * widget n'ajoute que la lecture de ce qu'un humain tape.
 *
 * Incident fondateur, et c'est le vrai enseignement de ce module : **un
 * seizième de pouce vaut 1,5875 mm — il est PLUS GROS que le millimètre.**
 * Aucune bascule mm → pouce → mm ne peut donc être l'identité : il y a plus
 * de millimètres distincts que de seizièmes dans n'importe quelle plage. Un
 * champ qui réécrirait la cote à chaque changement d'unité ferait dériver la
 * menuiserie d'un millimètre par aller-retour. D'où la règle : **la valeur
 * en millimètres n'est réécrite que lorsqu'un humain saisit**. Changer
 * d'unité ne fait que changer la façon de lire le même nombre.
 *
 * Aucune horloge, aucun DOM, aucun aléa — testable dans Node.
 */

/** L'unité d'affichage et de saisie. Le stockage, lui, est toujours en mm. */
export type Unite = 'mm' | 'pouce';

/** La définition internationale du pouce depuis 1959 — exacte, pas approchée. */
export const POUCE_MM = 25.4;

/**
 * La finesse de lecture en pouces. Le métier de la menuiserie anglo-saxonne
 * cote au seizième ; le huitième perdrait de la cote utile, le trente-deuxième
 * afficherait une précision que l'atelier ne tient pas (± 1 mm, compétence
 * `prise-de-cotes` §2).
 */
export const SEIZIEMES_PAR_POUCE = 16;

const MM_PAR_SEIZIEME = POUCE_MM / SEIZIEMES_PAR_POUCE; // 1,5875 mm

/**
 * Des millimètres vers un nombre ENTIER de seizièmes de pouce. C'est une
 * lecture : elle perd forcément quelque chose, puisque le seizième est plus
 * grossier que le millimètre. L'écart est borné par un demi-seizième, soit
 * 0,79 mm — moins d'un millimètre, ce que `unites.test.ts` prouve sur toute
 * la plage de fabrication.
 */
export function mmVersSeiziemes(valeurMm: number): number {
  return Math.round(valeurMm / MM_PAR_SEIZIEME);
}

/** Des seizièmes de pouce vers des millimètres entiers — ce que le cœur stocke. */
export function seiziemesVersMm(seiziemes: number): number {
  return Math.round(seiziemes * MM_PAR_SEIZIEME);
}

/** Le plus grand diviseur commun — pour réduire 4/16 en 1/4. */
function pgcd(a: number, b: number): number {
  return b === 0 ? a : pgcd(b, a % b);
}

/**
 * Un nombre de seizièmes écrit comme un menuisier l'écrit : `47 1/4"`,
 * `36"`, `3/4"`. La fraction est réduite — `47 4/16"` ferait amateur, et
 * surtout ne se retrouve sur aucun mètre ruban.
 */
export function formaterSeiziemes(seiziemes: number): string {
  const signe = seiziemes < 0 ? '−' : '';
  const absolu = Math.abs(Math.round(seiziemes));
  const entier = Math.floor(absolu / SEIZIEMES_PAR_POUCE);
  const reste = absolu % SEIZIEMES_PAR_POUCE;
  if (reste === 0) return `${signe}${entier}"`;
  const diviseur = pgcd(reste, SEIZIEMES_PAR_POUCE);
  const fraction = `${reste / diviseur}/${SEIZIEMES_PAR_POUCE / diviseur}`;
  return entier === 0 ? `${signe}${fraction}"` : `${signe}${entier} ${fraction}"`;
}

/**
 * Une cote, écrite dans l'unité demandée, prête à s'afficher : `1200 mm` ou
 * `47 1/4"`. C'est la fonction que la cote d'un dessin, le pied de vue et le
 * résumé d'étape appellent — un seul endroit décide de la forme d'une cote.
 */
export function formaterCote(valeurMm: number, unite: Unite = 'mm'): string {
  if (unite === 'pouce') return formaterSeiziemes(mmVersSeiziemes(valeurMm));
  return `${Math.round(valeurMm)} mm`;
}

/**
 * La valeur SEULE, sans son unité — ce qu'on met dans un champ de saisie.
 * Le symbole `"` reste hors du champ : il gêne la retouche au clavier, et
 * l'étiquette du champ dit déjà l'unité.
 */
export function valeurPourChamp(valeurMm: number, unite: Unite = 'mm'): string {
  if (unite === 'pouce') return formaterSeiziemes(mmVersSeiziemes(valeurMm)).replace('"', '');
  return String(Math.round(valeurMm));
}

/**
 * Ce qu'un humain tape, en seizièmes de pouce — ou `null` si ce n'est pas
 * (encore) une cote. Sont acceptés, parce qu'on les rencontre tous :
 * `47`, `47"`, `47.25`, `47,25`, `47 1/4`, `47-1/4`, `47 1/4"`, `1/4`.
 *
 * Rendre `null` plutôt que 0 sur une saisie incomplète n'est pas un détail :
 * pendant que le client tape « 47 1 », le champ ne doit pas décider que la
 * menuiserie fait 47 pouces et redessiner sous ses doigts.
 */
export function analyserSeiziemes(texte: string): number | null {
  const nettoye = texte
    .trim()
    .replace(/[""″]/g, '"')
    .replace(/\s*(?:"|''|in|inch(?:es)?)\s*$/i, '')
    .replace(',', '.')
    .trim();
  if (nettoye === '') return null;

  // « 47-1/4 » : le tiret des catalogues anglo-saxons sépare l'entier de sa
  // fraction, il ne soustrait pas. Il ne devient un séparateur que s'il
  // reste un « / » derrière lui — sinon « -3 » cesserait d'être négatif.
  const avecEspace = nettoye.replace(/^(-?\d+)-(\d+\/\d+)$/, '$1 $2');

  const entierEtFraction = avecEspace.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (entierEtFraction) {
    const [, entier, numerateur, denominateur] = entierEtFraction;
    if (Number(denominateur) === 0) return null;
    const signe = entier.startsWith('-') ? -1 : 1;
    const seiziemes =
      Math.abs(Number(entier)) * SEIZIEMES_PAR_POUCE +
      (Number(numerateur) * SEIZIEMES_PAR_POUCE) / Number(denominateur);
    return signe * Math.round(seiziemes);
  }

  const fractionSeule = avecEspace.match(/^(-?\d+)\/(\d+)$/);
  if (fractionSeule) {
    const [, numerateur, denominateur] = fractionSeule;
    if (Number(denominateur) === 0) return null;
    return Math.round((Number(numerateur) * SEIZIEMES_PAR_POUCE) / Number(denominateur));
  }

  const decimal = avecEspace.match(/^-?\d+(?:\.\d+)?$/);
  if (decimal) return Math.round(Number(avecEspace) * SEIZIEMES_PAR_POUCE);

  return null;
}

/**
 * Ce qu'un humain tape, en millimètres entiers — ou `null`. C'est LA porte
 * d'entrée : tout ce qui remonte au cœur passe par elle, et en ressort
 * entier.
 */
export function analyserCote(texte: string, unite: Unite = 'mm'): number | null {
  if (unite === 'pouce') {
    const seiziemes = analyserSeiziemes(texte);
    return seiziemes === null ? null : seiziemesVersMm(seiziemes);
  }
  const nettoye = texte.trim().replace(',', '.').replace(/\s*mm\s*$/i, '').trim();
  if (nettoye === '' || !/^-?\d+(?:\.\d+)?$/.test(nettoye)) return null;
  return Math.round(Number(nettoye));
}
