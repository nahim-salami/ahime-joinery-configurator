/**
 * Pourquoi ce fichier existe : la matrice dimensionnelle est la brique de
 * base du prix menuiserie (docs/04 §1) — un prix par palier de largeur ×
 * hauteur, interpolé linéairement entre paliers, plancher sous le premier
 * palier. `baseFromMatrix()` est LA porte d'entrée du moteur de prix.
 *
 * Solution écartée : l'interpolation en flottants (lerp puis Math.round).
 * Elle marche… sauf aux égalités parfaites (x,5 centimes), où JS et PHP
 * peuvent arrondir un double différemment d'un ulp. Ici tout est entier :
 * numérateur et dénominateur exacts, arrondi « moitié vers le haut » par
 * arithmétique entière — la parité JS↔PHP ne dépend d'aucun IEEE754.
 *
 * Incident fondateur : chez les néons, la règle « centimes entiers partout,
 * jamais de flottants dans un prix » est née d'écarts d'un centime entre le
 * widget et le plugin — indétectables à l'œil, fatals à la confiance.
 */

/** Une matrice de prix : paliers croissants, cellules en centimes entiers. */
export interface PriceMatrix {
  widthsMm: number[];
  heightsMm: number[];
  /** cellsCents[indexHauteur][indexLargeur] — lignes = hauteurs. */
  cellsCents: number[][];
}

/**
 * Division entière arrondie « moitié vers le haut » (num, den >= 0 entiers).
 * floor((2N + D) / 2D) — exact tant que 2N tient dans un double (< 2^53),
 * ce que garantissent des prix < 10 M€ et des paliers < 10 m.
 */
export function roundHalfUpDiv(num: number, den: number): number {
  return Math.floor((2 * num + den) / (2 * den));
}

/** Applique un coefficient exprimé en millièmes (1060 = ×1,06) — entier. */
export function applyCoefMilliemes(cents: number, milliemes: number): number {
  return roundHalfUpDiv(cents * milliemes, 1000);
}

interface Voisins {
  lo: number;
  hi: number;
  /** Position entre lo et hi : num/den, avec 0 <= num <= den, den >= 1. */
  num: number;
  den: number;
}

/**
 * Encadre `x` entre deux paliers. Sous le premier palier : prix plancher
 * (docs/04 §1 — la quincaillerie et la main-d'œuvre sont là). Au-delà du
 * dernier : borné au dernier palier — c'est la validation qui refuse, le
 * prix reste défini pour que l'affichage ne casse jamais.
 */
function voisins(paliers: number[], x: number): Voisins {
  const dernier = paliers.length - 1;
  if (x <= paliers[0]) return { lo: 0, hi: 0, num: 0, den: 1 };
  if (x >= paliers[dernier]) return { lo: dernier, hi: dernier, num: 0, den: 1 };
  let i = 0;
  while (paliers[i + 1] < x) i++;
  if (paliers[i] === x) return { lo: i, hi: i, num: 0, den: 1 };
  return { lo: i, hi: i + 1, num: x - paliers[i], den: paliers[i + 1] - paliers[i] };
}

/**
 * Le prix de base d'une matrice pour des cotes au millimètre — interpolation
 * bilinéaire exacte en arithmétique entière, arrondie au centime.
 */
export function baseFromMatrix(matrix: PriceMatrix, widthMm: number, heightMm: number): number {
  const w = voisins(matrix.widthsMm, widthMm);
  const h = voisins(matrix.heightsMm, heightMm);
  const c = matrix.cellsCents;
  const numerateur =
    c[h.lo][w.lo] * (w.den - w.num) * (h.den - h.num) +
    c[h.lo][w.hi] * w.num * (h.den - h.num) +
    c[h.hi][w.lo] * (w.den - w.num) * h.num +
    c[h.hi][w.hi] * w.num * h.num;
  return roundHalfUpDiv(numerateur, w.den * h.den);
}
