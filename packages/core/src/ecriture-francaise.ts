
/** L'espace INSÉCABLE des milliers (U+00A0), écrite par son code. */
const ESPACE_INSECABLE = ' ';

/**
 * La forme d'une date ISO courte, et rien d'autre.
 *
 * Elle est vérifiée AVANT toute comparaison, parce que la comparaison de
 * deux dates ISO est lexicographique et donc exacte — mais seulement pour
 * elles. Une date écrite « 05/06/2026 » se comparerait sans lever d'erreur
 * et rendrait le mauvais barème, en silence. C'est le genre de faute qu'on
 * ne voit jamais en relecture.
 */
export const FORME_DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Vrai quand la chaîne est une date ISO courte lisible. */
export function estUneDateIso(valeur: string | undefined): valeur is string {
  return valeur !== undefined && FORME_DATE_ISO.test(valeur);
}

/**
 * Un entier, avec l'espace insécable des milliers.
 *
 * Écrit à la main : voir l'en-tête sur `toLocaleString`. Le signe moins est
 * le vrai (U+2212) et non le trait d'union, parce qu'il s'agit d'un nombre.
 */
export function entier(x: number): string {
  const chiffres = String(Math.round(Math.abs(x)));
  let sortie = '';
  for (let i = 0; i < chiffres.length; i += 1) {
    if (i > 0 && (chiffres.length - i) % 3 === 0) sortie += ESPACE_INSECABLE;
    sortie += chiffres[i];
  }
  return x < 0 ? `−${sortie}` : sortie;
}

/**
 * Un nombre à deux décimales au plus : virgule française, milliers espacés,
 * et pas de zéro décimal inutile.
 *
 * `nombre(1200)` rend « 1 200 » et non « 1200 » — c'est la correction que
 * ce fichier généralise. `nombre(43.2)` rend « 43,2 », `nombre(3)` rend
 * « 3 ».
 */
export function nombre(x: number): string {
  const arrondi = Math.round(x * 100) / 100;
  const [avant, apres] = Math.abs(arrondi).toString().split('.');
  const milliers = entier(Number(avant));
  const signe = arrondi < 0 ? '−' : '';
  return apres === undefined ? `${signe}${milliers}` : `${signe}${milliers},${apres}`;
}

/**
 * Des millièmes, écrits en pourcentage. 55 → « 5,5 % », 700 → « 70 % ».
 *
 * L'espace avant le signe est INSÉCABLE, comme la typographie française le
 * demande : un « % » seul en début de ligne est une faute qu'on remarque.
 */
export function pourcentage(milliemes: number): string {
  return `${nombre(milliemes / 10)}${ESPACE_INSECABLE}%`;
}

/** Des centimes entiers, écrits en euros. 3300 → « 33,00 ». */
export function euros(centimes: number): string {
  const signe = centimes < 0 ? '−' : '';
  const absolus = Math.abs(centimes);
  const partieEntiere = entier(Math.floor(absolus / 100));
  const centiemes = String(absolus % 100).padStart(2, '0');
  return `${signe}${partieEntiere},${centiemes}`;
}

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const;

/**
 * Une date ISO écrite en français : « 2026-06-05 » → « 5 juin 2026 ».
 *
 * Le premier du mois s'écrit « 1er », et c'est la seule irrégularité du
 * français en la matière. Une date illisible rend une phrase plutôt qu'une
 * chaîne vide : un écran qui affiche du blanc ne se corrige pas.
 */
export function jourEnFrancais(iso: string | undefined): string {
  if (!estUneDateIso(iso)) return 'une date non précisée';
  const [annee, mois, jour] = iso.split('-');
  const n = Number(jour);
  return `${n === 1 ? '1er' : n} ${MOIS[Number(mois) - 1]} ${annee}`;
}
