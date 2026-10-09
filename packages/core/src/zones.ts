/**
 * Pourquoi ce fichier existe : jusqu'ici, ce configurateur classait TOUT LE
 * MONDE à la française. Une fenêtre vendue à Manchester recevait un
 * classement A*E*V d'EN 12207/12208/12210, calculé sur une zone de vent
 * française — et le marchand le recopiait sur son devis. Le nombre était
 * juste ; il ne voulait rien dire là-bas.
 *
 * C'EST LE MÊME DÉFAUT QUE LE MOT « SOLAIRE » (docs/39) : quelque chose qui
 * a l'air juste et qui ne l'est pas, et que rien ne signale — ni une
 * exception, ni un test, ni un écran. Le lot 13 de docs/11 nomme les six
 * zones ; ce fichier en est la première pièce, et il ne prétend pas être la
 * dernière.
 *
 * CE QU'IL FAIT, ET C'EST TOUT CE QU'IL PEUT FAIRE HONNÊTEMENT :
 *
 *   1. IL REFUSE D'APPLIQUER UNE CLASSIFICATION HORS DE SON DOMAINE. Le
 *      classement A/E/V est EUROPÉEN. En Amérique du Nord, c'est NAFS ; en
 *      Australie, AS 2047. Le module ne les CALCULE pas — il n'a pas leurs
 *      tables — mais il refuse de faire passer l'un pour l'autre, et il
 *      nomme celui qui s'applique.
 *   2. IL CONVERTIT CE QUI SE CONVERTIT PAR DÉFINITION. Un U-factor
 *      américain n'est pas une autre grandeur que l'Uw : c'est la même,
 *      dans d'autres unités, et le facteur se DÉRIVE de trois conversions
 *      exactes plutôt que d'être recopié. Un nombre dérivé se vérifie ; un
 *      nombre recopié se croit.
 *   3. IL NOMME LES TEXTES QUI S'APPLIQUENT, par zone et par famille — ils
 *      sont relevés dans docs/29 §3, daté du 5 septembre 2026.
 *   4. IL DIT CE QU'IL LUI MANQUE pour classer vraiment. Une zone ouverte
 *      sans ses tables est une zone où l'on vend sans classer, et il vaut
 *      mieux le dire que de laisser croire le contraire.
 *
 * CE QU'IL NE FAIT PAS, ET QUI EST LE RESTE DU LOT 13 : calculer une classe
 * NAFS, une pression de calcul australienne, ou un Uw suisse. Ces tables
 * sont dans des textes qui ne sont pas au dépôt. Les inventer donnerait des
 * classes plausibles et fausses — exactement ce que docs/37 interdit.
 *
 * LA ZONE VIT DANS LE CATALOGUE, et non dans la configuration : c'est une
 * déclaration du MARCHAND — le marché sur lequel il vend —, pas un choix du
 * client. Un catalogue muet vaut « france », si bien qu'aucun devis existant
 * ne change d'un centime ni d'une ligne.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { FamilleId, JoineryConfiguration, ValidationIssue } from './types.ts';
import { groupeDe } from './familles/registre.ts';

/** Les sept zones du lot 13, plus la France qui est le défaut. */
export type ZoneNormative =
  | 'france'
  | 'belgique'
  | 'suisse'
  | 'allemagne'
  | 'royaume-uni'
  | 'amerique-du-nord'
  | 'australie';

/* --------------------------------------------------------------------- *
 * LES UNITÉS — ce qui se convertit par DÉFINITION
 * --------------------------------------------------------------------- */

/**
 * LES TROIS CONVERSIONS EXACTES dont tout le reste se déduit.
 *
 * Elles sont écrites séparément, et le facteur composé est CALCULÉ à partir
 * d'elles. Recopier « 0,1761 » aurait donné un nombre que personne ne peut
 * vérifier sans chercher ailleurs ; ici, la vérification tient dans la
 * ligne d'en dessous.
 */
export const CONVERSIONS_EXACTES = {
  /** 1 W = 3,412142 BTU/h (défini). */
  wattVersBtuParHeure: 3.412142,
  /** 1 m² = 10,763910 ft² (défini : 1 ft = 0,3048 m, exactement). */
  metreCarreVersPiedCarre: 10.76391,
  /** 1 K vaut 1,8 °F d'écart (défini). */
  kelvinVersFahrenheitEcart: 1.8,
} as const;

/**
 * Le facteur qui mène de W/(m²·K) à BTU/(h·ft²·°F).
 *
 * DÉRIVÉ, jamais recopié : les watts montent, les mètres carrés et les
 * degrés descendent. Une épreuve vérifie qu'il tombe bien sur la valeur
 * publiée (≈ 0,1761), ce qui est le seul usage honnête d'un nombre
 * mémorisé — servir de contrôle, pas de source.
 */
export const W_M2K_VERS_BTU_H_FT2_F =
  CONVERSIONS_EXACTES.wattVersBtuParHeure /
  CONVERSIONS_EXACTES.metreCarreVersPiedCarre /
  CONVERSIONS_EXACTES.kelvinVersFahrenheitEcart;

/**
 * L'Uw européen, en U-factor nord-américain.
 *
 * CE N'EST PAS UNE AUTRE GRANDEUR, et c'est ce qu'il faut retenir : c'est
 * la même, dans d'autres unités. En revanche, la MÉTHODE de mesure diffère
 * — NFRC 100 n'est pas EN ISO 10077 —, et deux fenêtres identiques peuvent
 * donc porter deux nombres qui ne se convertissent pas exactement l'un dans
 * l'autre. La conversion dit « voici votre Uw en unités d'ici » ; elle ne
 * dit jamais « voici votre U-factor NFRC ».
 */
export function uwVersUFactor(uw: number): number {
  return uw * W_M2K_VERS_BTU_H_FT2_F;
}

export const LA_CONVERSION_N_EST_PAS_UNE_CERTIFICATION =
  'Ce nombre est votre Uw converti en unités nord-américaines. Ce n’est PAS un U-factor NFRC : ' +
  'NFRC 100 mesure autrement qu’EN ISO 10077, et seule une mesure NFRC donne une valeur ' +
  'opposable là-bas.';

/* --------------------------------------------------------------------- *
 * LES ZONES — ce qui s'applique, et ce qui manque pour l'appliquer
 * --------------------------------------------------------------------- */

/* --------------------------------------------------------------------- *
 * CE QUI DÉCIDE — et rien de plus, parce que c'est dans l'ENTRÉE
 * --------------------------------------------------------------------- */

/**
 * OÙ LE CLASSEMENT EUROPÉEN A COURS.
 *
 * Sept booléens, et c'est TOUT ce que le chargement initial paie. Le
 * tableau complet — textes, lacunes, systèmes locaux — vit dans
 * `zones/textes.ts`, qui n'est importé que par ce qui l'affiche.
 *
 * POURQUOI CETTE SÉPARATION, mesurée : la première écriture mettait les
 * sept zones et leurs vingt-cinq références de normes dans `zones.ts`, que
 * `validate.ts` importe — donc dans l'entrée. Le budget est passé de 87,8 à
 * 90,2 ko pour 90, et le verrou a refusé. Il avait raison : un visiteur
 * français ne doit pas télécharger les Approved Documents britanniques.
 */
export const CLASSEMENT_EUROPEEN: Readonly<Record<ZoneNormative, boolean>> = {
  france: true,
  belgique: true,
  suisse: true,
  allemagne: true,
  'royaume-uni': false,
  'amerique-du-nord': false,
  australie: false,
};

/** Le système qui classe là où l'européen n'a pas cours. */
export const CLASSEMENT_LOCAL: Readonly<Partial<Record<ZoneNormative, string>>> = {
  'royaume-uni': 'BS 6375-1 / -2 / -3',
  'amerique-du-nord': 'NAFS — AAMA/WDMA/CSA 101/I.S.2/A440 (classes R, LC, CW, AW)',
  australie: 'AS 2047',
};

/** Les zones qui lisent en pouces et en BTU. */
export const UNITES_IMPERIALES: ReadonlyArray<ZoneNormative> = ['amerique-du-nord'];

/** Le nom d'une zone, tel qu'il s'affiche. */
export const NOM_DE_ZONE: Readonly<Record<ZoneNormative, string>> = {
  france: 'France',
  belgique: 'Belgique',
  suisse: 'Suisse',
  allemagne: 'Allemagne',
  'royaume-uni': 'Royaume-Uni',
  'amerique-du-nord': 'Amérique du Nord',
  australie: 'Australie',
};

/** La zone d'un catalogue. Muette vaut France — aucun devis existant ne bouge. */
export function zoneDe(catalogue: { zoneNormative?: ZoneNormative }): ZoneNormative {
  return catalogue.zoneNormative ?? 'france';
}

/** Le classement européen a-t-il cours dans la zone de ce catalogue ? */
export function classementEuropeenApplicable(catalogue: {
  zoneNormative?: ZoneNormative;
}): boolean {
  return CLASSEMENT_EUROPEEN[zoneDe(catalogue)];
}

/* --------------------------------------------------------------------- *
 * LE CLIMAT D'UN OUVRAGE (lot Z17) — le second axe du domaine
 * --------------------------------------------------------------------- */

export type ClimatDeLOuvrage =
  /** Dehors : il affronte le temps, quoi qu'il ferme ou ne ferme pas. */
  | 'dehors'
  /** Derrière le clos : ni vent, ni A/E/V, ni Uw. */
  | 'dedans';

export const GROUPES_DEDANS = [] as string[];
export const DEDANS_HORS_GROUPE: ReadonlyArray<FamilleId> = ['store-interieur'];

export const OUVRAGES_CLASSES_AEV: ReadonlyArray<FamilleId> = [
  'fenetre',
  'porte-fenetre',
  'coulissant',
  'porte-entree',
  'fenetre-toit',
];

/**
 * LE CLIMAT D'UNE FAMILLE. Le défaut est `dehors` — la valeur qui n'accorde
 * rien de plus, puisque c'est la LISTE qui accorde le classement.
 */
export function climatDe(famille: FamilleId): ClimatDeLOuvrage {
  return (GROUPES_DEDANS as readonly string[]).includes(groupeDe(famille)) ||
    DEDANS_HORS_GROUPE.includes(famille)
    ? 'dedans'
    : 'dehors';
}

/** Cet ouvrage reçoit-il un classement A/E/V ? La zone décide aussi (lot 13). */
export function classementAevApplicable(
  famille: FamilleId,
  catalogue: { zoneNormative?: ZoneNormative },
): boolean {
  return OUVRAGES_CLASSES_AEV.includes(famille) && classementEuropeenApplicable(catalogue);
}

export function expositionSansEmploi(famille: FamilleId): ValidationIssue | null {
  if (OUVRAGES_CLASSES_AEV.includes(famille)) return null;
  return {
    code: 'exposition-sans-emploi',
    severite: 'info',
    message: `Ouvrage ${
      climatDe(famille) === 'dedans' ? 'd’intérieur' : 'sans classement A/E/V'
    } : l’exposition déclarée n’a pas servi.`,
  };
}

export function reglesDeZone(contexte: {
  config: JoineryConfiguration;
  catalogue: { zoneNormative?: ZoneNormative };
}): ValidationIssue[] {
  const zone = zoneDe(contexte.catalogue);
  if (zone === 'france') return [];

  const issues: ValidationIssue[] = [];
  const nom = NOM_DE_ZONE[zone];

  // --- LE CLASSEMENT. Le refus qui justifie tout ce fichier.
  if (!CLASSEMENT_EUROPEEN[zone] && OUVRAGES_CLASSES_AEV.includes(contexte.config.famille)) {
    issues.push({
      code: 'zone-classement-non-applicable',
      severite: 'avertissement',
      // LA PHRASE A ÉTÉ RACCOURCIE AU LOT Z17, et c'est ce que ce lot a RENDU
      // pour tenir la borne d'entrée. Rien de ce que `zones-normatives.test.ts`
      // exige n'a bougé — le système local, « NE CALCULE PAS », « juste et hors
      // sujet » —, et l'explication entière vit dans `zones/textes.ts` et dans
      // le guide du site, lus par qui décide du marché.
      message:
        `Marché déclaré : ${nom}. Le classement A/E/V (EN 12207 / 12208 / 12210) est EUROPÉEN — ` +
        `c’est ${CLASSEMENT_LOCAL[zone]} qui classe. Ce configurateur NE CALCULE PAS cette ` +
        `classification : ses tables ne sont pas au dépôt, et un classement recopié serait juste ` +
        `et hors sujet.`,
    });
  }

  // --- LES UNITÉS. Dire l'unité qui s'affiche là-bas, et ce qu'elle n'est
  // pas.
  if (UNITES_IMPERIALES.includes(zone)) {
    issues.push({
      code: 'zone-unites-imperiales',
      severite: 'info',
      message:
        `${nom} lit les cotes en pouces et la transmission thermique en BTU/h·ft²·°F. La ` +
        `conversion de l’Uw se fait par définition ` +
        `(× ${W_M2K_VERS_BTU_H_FT2_F.toFixed(4).replace('.', ',')}). ` +
        LA_CONVERSION_N_EST_PAS_UNE_CERTIFICATION,
    });
  }

  // --- CE QUI MANQUE. Le détail est dans `zones/textes.ts` ; ce qui doit
  // partir jusqu'au client, c'est qu'il MANQUE quelque chose.
  issues.push({
    code: 'zone-hors-domaine-francais',
    severite: 'info',
    message:
      `Ce moteur calcule pour la FRANCE. Sur le marché ${nom}, certaines de ses règles — jeux ` +
      `de pose, seuils thermiques, épaisseurs de verre, cotes de garde-corps — restent ` +
      `françaises faute d’avoir les tables locales. Le détail, texte par texte, est dans le ` +
      `tableau des zones (docs/29 §3, relevé le 5 septembre 2026).`,
  });

  return issues;
}
