
import { createContext, useContext } from 'react';

/** Un dictionnaire : texte français → texte traduit. */
export type Dictionnaire = Readonly<Record<string, string>>;

/**
 * Traduire. Le second argument remplace les `{marqueurs}` — la seule
 * interpolation admise, parce qu'un libellé qui a besoin de plus est un
 * libellé à couper en deux.
 */
export type Traducteur = (cle: string, valeurs?: Record<string, string | number>) => string;

/** Les langues dont le paquet porte un dictionnaire — voir la décision ci-dessus. */
export const LANGUES_LIVREES = ['en'] as const;

/**
 * Les langues qui s'écrivent de droite à gauche.
 *
 * Aucune n'est livrée, et c'est justement pourquoi la liste existe : un
 * marchand qui passe un dictionnaire arabe par le contexte doit obtenir un
 * widget retourné, pas un widget anglais à l'envers. « RTL prévu »
 * (docs/03 §8) ne veut rien dire si la première traduction arabe oblige à
 * rouvrir le code.
 */
const LANGUES_RTL = ['ar', 'fa', 'he', 'ur', 'yi'];

/** `fr-BE`, `EN_us`, `en` → `fr`, `en`, `en`. */
export function codeLangue(brut: string | null | undefined): string {
  if (!brut) return 'fr';
  const code = brut.trim().toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(code) ? code : 'fr';
}

/** Le sens d'écriture d'une langue — `dir` du composant, rien de plus. */
export function sensDeLecture(langue: string): 'ltr' | 'rtl' {
  return LANGUES_RTL.includes(codeLangue(langue)) ? 'rtl' : 'ltr';
}

/**
 * Fabriquer un traducteur à partir des dictionnaires empilés.
 *
 * L'ordre est celui des étages : le dernier gagne. Un marchand qui corrige
 * un seul libellé passe un dictionnaire d'une entrée, et les autres
 * continuent de venir du paquet.
 */
export function traducteur(...etages: (Dictionnaire | undefined)[]): Traducteur {
  const table: Record<string, string> = {};
  for (const etage of etages) if (etage) Object.assign(table, etage);
  return (cle, valeurs) => {
    // La clé EST le texte français : sans traduction, on rend la clé.
    const texte = table[cle] ?? cle;
    if (!valeurs) return texte;
    return texte.replace(/\{(\w+)\}/g, (marqueur, nom: string) =>
      // Un marqueur sans valeur reste visible : c'est un bug de traduction,
      // et un trou silencieux serait pire qu'une accolade à l'écran.
      nom in valeurs ? String(valeurs[nom]) : marqueur,
    );
  };
}

/**
 * Le dictionnaire livré pour une langue, ou rien.
 *
 * L'`import()` est LITTÉRAL par langue : Rollup ne sait pas découper un
 * chemin calculé, et un `import(\`./langues/${code}.ts\`)` avalerait toutes
 * les langues dans un seul morceau — la leçon du registre de familles
 * (lot 0.2), payée une fois, pas deux.
 */
export async function chargerLangue(brut: string | null | undefined): Promise<Dictionnaire | undefined> {
  const code = codeLangue(brut);
  if (code === 'en') return (await import('./langues/en.ts')).default;
  // Le français n'a pas de dictionnaire : la clé EST le français. Toute
  // autre langue s'apporte par `contexte.traductions`.
  return undefined;
}

/* ------------------------------------------------------------------ React */

/**
 * Le traducteur descend par un contexte React, pas par les props.
 *
 * `Panneau` compte une quinzaine de composants imbriqués ; faire passer `t`
 * de main en main aurait ajouté un paramètre à chacun, et un oubli quelque
 * part aurait laissé une île de français au milieu d'un écran traduit. Le
 * contexte rend l'oubli impossible : `useT()` marche partout ou nulle part.
 *
 * Son défaut est un traducteur qui rend ses clés — un composant monté hors
 * fournisseur (un test unitaire, une vignette) affiche donc du français
 * correct, jamais une erreur.
 */
export const ContexteTraduction = createContext<Traducteur>(traducteur());

/** Traduire, depuis n'importe quel composant du widget. */
export function useT(): Traducteur {
  return useContext(ContexteTraduction);
}

/**
 * Marquer une chaîne comme à traduire, sans la traduire ici.
 *
 * Elle ne fait rien — elle rend son argument. Son seul rôle est d'être
 * VISIBLE par l'extracteur (`scripts/extraire-traductions.mjs`), pour les
 * libellés déclarés loin de l'endroit où ils s'affichent : les tables
 * `LIBELLE_MATERIAU`, `LIBELLE_COULEUR` et leurs sœurs. Sans ce marqueur, un
 * dictionnaire complet ne traduirait pas « Aluminium », et personne ne
 * saurait pourquoi.
 *
 * C'est le `N_()` de gettext, avec un nom qu'on ne confond pas avec `t()`.
 */
export function aTraduire(cle: string): string {
  return cle;
}

/**
 * CE QUE CE TRADUCTEUR TRADUIT, et où s'arrête sa responsabilité.
 *
 * Il traduit ce que le WIDGET écrit : titres d'étapes, libellés de champs,
 * aides, boutons, états. Les libellés du CATALOGUE — noms de gammes, de
 * modèles, de couleurs du marchand — le traversent aussi, puisque `Tuile` et
 * `Etape` traduisent ce qu'elles reçoivent ; mais sans entrée au
 * dictionnaire ils ressortent tels quels, ce qui est le comportement voulu :
 * un marchand belge peut vouloir « Chêne » en français sur une page
 * néerlandaise. S'il veut l'inverse, rien ne l'en empêche — c'est une
 * entrée de plus dans son dictionnaire, pas une modification du widget.
 *
 * CE QUE CELA IMPLIQUE POUR LE CATALOGUE PAR DÉFAUT, et il faut le dire
 * franchement : sa prose reste en français — libellés de poses, arguments,
 * phrases de mesure, règles d'or du guide de cotes. Ce n'est pas un oubli.
 * `DEFAULT_CATALOG` est un catalogue FRANÇAIS : il chiffre en euros, cite
 * le NF DTU 39 et l'EN 12453, et connaît les zones de vent de l'Hexagone.
 * Un marchand qui vend ailleurs apporte son catalogue — c'est précisément
 * ce que `contexte.pricing` permet — ou verse ces phrases-là dans son
 * dictionnaire, ce qui marche aussi puisqu'elles passent par `t()`. Le
 * catalogue INTERNATIONAL est un lot à lui seul (docs/11, lot 13).
 */
