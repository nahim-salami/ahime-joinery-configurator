/**
 * Pourquoi ce fichier existe : quarante-cinq pour cent des menuiseries
 * posées en France ne sont plus blanches — elles l'étaient à vingt-six pour
 * cent il y a dix ans. Et ce configurateur proposait « RAL une face » avec
 * UN gris arbitraire codé en dur, sans jamais demander lequel.
 *
 * C'est le manque le plus visible du produit : un client qui veut du
 * 7016 anthracite, la teinte la plus vendue de la décennie, ne pouvait ni
 * le choisir ni le voir. Il voyait un gris qui n'existe pas et payait un
 * supplément « RAL » sans savoir ce qu'il achetait.
 *
 * Ce que ce module rend : le NUANCIER RÉELLEMENT VENDU, et la résolution
 * d'une configuration en deux teintes — intérieur, extérieur.
 *
 * Solution écartée : les 213 teintes du nuancier RAL Classic. Un gammiste
 * n'en laque pas 213 : il en tient une vingtaine en standard et facture le
 * reste en « hors nuancier », avec un délai. Proposer les 213 ferait
 * promettre des délais qu'on ne tient pas, et noierait les quinze qui font
 * quatre-vingt-quinze pour cent des commandes.
 *
 * Solution écartée aussi : laisser le marchand saisir un code hexadécimal
 * libre. Un RAL n'EST PAS une couleur d'écran — c'est une référence de
 * poudre, avec une brillance et une texture. Les hexadécimaux ci-dessous
 * sont des ÉQUIVALENTS D'AFFICHAGE, et le champ qui commande reste le
 * code RAL. Un atelier ne commande pas du « #383E42 », il commande du 7016.
 *
 * LA BRILLANCE COMPTE AUTANT QUE LA TEINTE, et c'est ce que les
 * configurateurs oublient : un laquage MAT et un laquage SATINÉ du même
 * RAL ne se ressemblent pas sur une façade au soleil. Chaque finition
 * porte donc sa rugosité, que la 3D lit directement.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { Couleur, Finition, Materiau } from './types.ts';

export type { Finition };

export interface TeinteRal {
  /** Le code RAL — c'est LUI qu'on commande, jamais l'hexadécimal. */
  code: string;
  nom: string;
  /**
   * L'ÉQUIVALENT D'AFFICHAGE, en hexadécimal sRGB. Approximatif par nature :
   * une poudre de laquage n'a pas de valeur d'écran exacte, et deux
   * laqueurs ne rendent pas tout à fait le même 7016. Il sert à MONTRER,
   * jamais à commander.
   */
  hex: string;
  /**
   * Vrai pour les teintes que les gammistes tiennent en standard. Les
   * autres se laquent à la demande — c'est un délai, et le dire évite une
   * promesse.
   */
  standard: boolean;
}

/**
 * LE NUANCIER RÉELLEMENT VENDU en menuiserie extérieure — les teintes que
 * les gammistes tiennent, dans l'ordre où elles se vendent.
 *
 * Le 7016 est en tête, et c'est un fait de marché : l'anthracite a remplacé
 * le blanc comme teinte par défaut des maisons neuves depuis le milieu des
 * années 2010. Le 9016 « blanc signalisation » suit — c'est le blanc DES
 * MENUISERIES, plus chaud que le 9010 « blanc pur » avec lequel on le
 * confond tout le temps.
 */
export const NUANCIER: TeinteRal[] = [
  { code: '7016', nom: 'Gris anthracite', hex: '#383E42', standard: true },
  { code: '9016', nom: 'Blanc signalisation', hex: '#F1F0EA', standard: true },
  { code: '9005', nom: 'Noir foncé', hex: '#0A0A0A', standard: true },
  { code: '7035', nom: 'Gris clair', hex: '#CBD0CC', standard: true },
  { code: '9007', nom: 'Gris aluminium', hex: '#8F8B85', standard: true },
  { code: '7039', nom: 'Gris quartz', hex: '#6B665F', standard: true },
  { code: '9010', nom: 'Blanc pur', hex: '#F1EDE1', standard: true },
  { code: '8017', nom: 'Brun chocolat', hex: '#442F29', standard: true },
  { code: '6005', nom: 'Vert mousse', hex: '#114232', standard: true },
  { code: '5003', nom: 'Bleu saphir', hex: '#1F3855', standard: true },
  { code: '1015', nom: 'Ivoire clair', hex: '#E6D2B5', standard: true },
  { code: '7001', nom: 'Gris argent', hex: '#8F999F', standard: true },
  { code: '3005', nom: 'Rouge vin', hex: '#59191F', standard: false },
  { code: '6021', nom: 'Vert pâle', hex: '#89AC76', standard: false },
  { code: '1013', nom: 'Blanc perlé', hex: '#EAE6CA', standard: false },
];

/**
 * LES DÉCORS PLAXÉS — un film collé sur le PVC, qui imite un bois ou une
 * teinte texturée. Ce n'est pas de la peinture et ça ne se comporte pas
 * comme elle : un plaxé a un GRAIN, il ne brille jamais, et il chauffe au
 * soleil bien plus qu'un blanc (d'où les limites de dimension que certains
 * gammistes posent sur les décors foncés).
 */
export interface DecorPlaxe {
  id: string;
  nom: string;
  hex: string;
  /** Vrai quand le décor imite un bois — la 3D y pose alors un fil. */
  fil: boolean;
}

export const DECORS_PLAXES: DecorPlaxe[] = [
  { id: 'chene-dore', nom: 'Chêne doré', hex: '#9A6B3A', fil: true },
  { id: 'chene-irlandais', nom: 'Chêne irlandais', hex: '#5E3A21', fil: true },
  { id: 'noyer', nom: 'Noyer', hex: '#4A2F1E', fil: true },
  { id: 'gris-anthracite', nom: 'Gris anthracite texturé', hex: '#3A3F42', fil: false },
  { id: 'gris-basalte', nom: 'Gris basalte', hex: '#4A4E4C', fil: false },
  { id: 'blanc-creme', nom: 'Blanc crème', hex: '#EFE9DC', fil: false },
];

/**
 * LA RUGOSITÉ D'UNE FINITION, pour la 3D. Ce sont des valeurs PBR, et elles
 * disent la vérité d'une surface :
 *
 *   - un laquage BRILLANT réfléchit comme une carrosserie — 0,15 ;
 *   - un SATINÉ, la finition la plus vendue, renvoie un reflet doux — 0,35 ;
 *   - un MAT diffuse presque tout — 0,60 ;
 *   - un TEXTURÉ (« grainé », « sablé ») casse le reflet par sa
 *     micro-géométrie — 0,72.
 *
 * ET AUCUN N'EST MÉTALLIQUE. C'est l'erreur qu'on voit partout : un profilé
 * aluminium LAQUÉ n'est pas du métal nu, c'est du métal peint. Sa surface
 * est une couche de polyester, et elle se comporte comme une carrosserie
 * de voiture — `metalness = 0`. Décrire un alu laqué à `metalness = 1` le
 * rend miroitant et noir dans les zones sans reflet, ce qui ne ressemble à
 * rien de posé sur une façade.
 */
export const RUGOSITE_FINITION: Record<Finition, number> = {
  brillant: 0.15,
  satine: 0.35,
  mat: 0.6,
  texture: 0.72,
};

/**
 * LA COUCHE DE VERNIS — `clearcoat`, au sens PBR.
 *
 * Un laquage poudre est un film transparent sur un pigment : il ajoute un
 * reflet spéculaire NET par-dessus la couleur, exactement comme un vernis
 * de carrosserie. C'est ce qui distingue à l'œil un alu laqué d'un PVC
 * teinté dans la masse, et c'est gratuit à décrire.
 *
 * Le PVC blanc n'en a pas : sa teinte EST sa matière, et sa surface est
 * légèrement satinée sans vernis. Le plaxé non plus — le film a un grain.
 */
export const VERNIS_PAR_MATERIAU: Record<Materiau, number> = {
  alu: 0.55,
  pvc: 0.12,
  bois: 0.35,
  // Le mixte montre son ALUMINIUM à l'extérieur — c'est tout son principe,
  // et c'est la face qu'on voit depuis la rue.
  mixte: 0.5,
};

export interface TeintesResolues {
  /** L'hexadécimal d'affichage de la face intérieure. */
  interieur: string;
  exterieur: string;
  /** Le code RAL commandé pour chaque face, quand il y en a un. */
  codeInterieur?: string;
  codeExterieur?: string;
  /** La finition retenue — elle commande la rugosité en 3D. */
  finition: Finition;
  /** Vrai quand la face porte un décor à fil de bois. */
  filInterieur: boolean;
  filExterieur: boolean;
}

/** Ce qu'une configuration déclare de sa teinte, au-delà du type de finition. */
export interface ChoixTeinte {
  couleur: Couleur;
  materiau: Materiau;
  /** Le code RAL extérieur — ignoré sur une menuiserie blanche. */
  ralExterieur?: string;
  /** Le code RAL intérieur — ne sert qu'en bicoloration. */
  ralInterieur?: string;
  /** Le décor plaxé, quand la finition est « plaxé ». */
  decorPlaxe?: string;
  finition?: Finition;
}

/** Le blanc des menuiseries — RAL 9016, jamais #FFFFFF. */
const BLANC_MENUISERIE = NUANCIER.find((teinte) => teinte.code === '9016')!;

/**
 * LES DEUX FACES D'UNE MENUISERIE, résolues.
 *
 * Cette fonction est le SEUL endroit où une configuration devient des
 * couleurs. Le dessin 2D, la 3D et le devis la lisent tous : une seconde
 * table ferait diverger l'élévation du volume, et le client verrait deux
 * gris différents sur le même écran.
 *
 * Elle rend des FAITS et aucun conseil. Ce qu'un choix de teinte IMPOSE —
 * un délai de laquage hors standard, la dilatation d'un PVC foncé, une
 * bicoloration qui n'en est pas une — vit dans `conseils-teinte.ts`, avec
 * l'écran qui pose la question. Le dessin n'a pas besoin d'avis, et ces
 * phrases sont longues : les garder ici les faisait télécharger par tout
 * visiteur, y compris celui qui reste au blanc.
 */
/**
 * LA LUMINANCE RELATIVE d'une couleur `#rrggbb` — formule WCAG.
 *
 * Elle vit ici et non dans un test : le DESSIN en a besoin pour choisir
 * son encre, et une formule recopiée dans deux endroits diverge. Le
 * comparateur du widget mesure ses jetons avec la même.
 */
export function luminance(hex: string): number {
  const propre = hex.trim();
  const canaux = [1, 3, 5]
    .map((debut) => Number.parseInt(propre.slice(debut, debut + 2), 16) / 255)
    .map((valeur) => (valeur <= 0.03928 ? valeur / 12.92 : ((valeur + 0.055) / 1.055) ** 2.4));
  return 0.2126 * canaux[0] + 0.7152 * canaux[1] + 0.0722 * canaux[2];
}

/** Le rapport de contraste entre deux couleurs — WCAG, de 1 à 21. */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * L'ENCRE SOMBRE et L'ENCRE CLAIRE d'un dessin technique.
 *
 * Ce ne sont ni du noir ni du blanc purs : un trait noir sur un cadre
 * blanc est dur à l'œil et se voit trop, et un blanc pur sur un anthracite
 * fait baver le trait à l'impression. Ces deux-là gardent la couleur de
 * l'encre du dépôt et tiennent leur contraste.
 */
export const ENCRE_SOMBRE = '#2b2f31';
export const ENCRE_CLAIRE = '#f2f4f5';

/**
 * LE CONTRASTE MINIMAL D'UN TRAIT DE DESSIN, et pourquoi 3 et pas 4,5.
 *
 * 4,5:1 est le seuil d'un TEXTE ordinaire (WCAG AA). Un trait de dessin
 * technique est un objet graphique : le seuil qui lui correspond est celui
 * des composants non textuels, 3:1. Le viser plus haut forcerait un blanc
 * pur sur les cadres foncés, et l'on aurait remplacé un défaut par un
 * autre.
 */
export const CONTRASTE_MINIMAL_DU_TRAIT = 3;

export function encreLisibleSur(fond: string): string {
  const sombre = contraste(ENCRE_SOMBRE, fond);
  const claire = contraste(ENCRE_CLAIRE, fond);
  // À égalité, on garde l'encre sombre : c'est celle du papier, celle du
  // PDF, et celle que tout le monde a déjà vue.
  if (sombre >= CONTRASTE_MINIMAL_DU_TRAIT) return ENCRE_SOMBRE;
  if (claire >= CONTRASTE_MINIMAL_DU_TRAIT) return ENCRE_CLAIRE;
  // Aucune des deux ne passe le seuil — un gris moyen, par exemple. On rend
  // LA MEILLEURE, et l'on ne se tait pas : un trait à 2,4:1 se voit encore,
  // un trait à 1,2:1 non.
  return claire > sombre ? ENCRE_CLAIRE : ENCRE_SOMBRE;
}

export function resoudreTeintes(choix: ChoixTeinte): TeintesResolues {
  const finition = choix.finition ?? 'satine';

  const ralDe = (code: string | undefined): TeinteRal | undefined =>
    code ? NUANCIER.find((teinte) => teinte.code === code) : undefined;

  const decor = choix.decorPlaxe
    ? DECORS_PLAXES.find((candidat) => candidat.id === choix.decorPlaxe)
    : undefined;

  switch (choix.couleur) {
    case 'blanc':
      return {
        interieur: BLANC_MENUISERIE.hex,
        exterieur: BLANC_MENUISERIE.hex,
        codeInterieur: BLANC_MENUISERIE.code,
        codeExterieur: BLANC_MENUISERIE.code,
        finition,
        filInterieur: false,
        filExterieur: false,
      };

    case 'plaxe': {
      // LE PLAXÉ EST EXTÉRIEUR. L'intérieur reste blanc dans l'immense
      // majorité des poses : c'est ce qui rend le plaxé abordable, et c'est
      // aussi ce que le client veut — un chêne doré dans un salon blanc
      // assombrit la pièce.
      const retenu = decor ?? DECORS_PLAXES[0];
      return {
        interieur: BLANC_MENUISERIE.hex,
        exterieur: retenu.hex,
        codeInterieur: BLANC_MENUISERIE.code,
        finition: 'texture',
        filInterieur: false,
        filExterieur: retenu.fil,
      };
    }

    case 'ral-1-face': {
      const ral = ralDe(choix.ralExterieur) ?? NUANCIER[0];
      return {
        interieur: BLANC_MENUISERIE.hex,
        exterieur: ral.hex,
        codeInterieur: BLANC_MENUISERIE.code,
        codeExterieur: ral.code,
        finition,
        filInterieur: false,
        filExterieur: false,
      };
    }

    case 'bicolore': {
      const dehors = ralDe(choix.ralExterieur) ?? NUANCIER[0];
      const dedans = ralDe(choix.ralInterieur) ?? BLANC_MENUISERIE;
      return {
        interieur: dedans.hex,
        exterieur: dehors.hex,
        codeInterieur: dedans.code,
        codeExterieur: dehors.code,
        finition,
        filInterieur: false,
        filExterieur: false,
      };
    }
  }
}
