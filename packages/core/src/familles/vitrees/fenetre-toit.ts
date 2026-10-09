/**
 * Pourquoi ce fichier existe : la fenêtre de toit est la famille que tout
 * comble aménagé porte, et elle commence par sa LISTE DE DIFFÉRENCES.
 * « Une fenêtre de toit est une fenêtre inclinée » est faux de six façons,
 * et chacune coûte quelque chose :
 *
 *   1. SES DIMENSIONS SONT DES CODES, pas des millimètres. On ne commande
 *      pas « 780 × 1178 », on commande un MK06. Le client choisit un code,
 *      les cotes suivent — et une cote intermédiaire n'existe pas, quelle
 *      que soit la taille du trou dans le toit.
 *   2. ELLE SE POSE DANS UNE PENTE, entre 15° et 90°. Sous quinze degrés,
 *      l'eau ne s'évacue pas et la neige s'accumule : aucun fabricant ne
 *      garantit. La pente n'est pas un détail de pose, c'est une condition.
 *   3. ELLE NE FERME PAS SANS SON RACCORD. Le kit d'étanchéité dépend de la
 *      COUVERTURE — tuiles ou ardoises, plates ou à relief — et sans lui la
 *      fenêtre fuit. Ce n'est pas une option : c'est la moitié du produit,
 *      et c'est ce qu'on oublie de commander.
 *   4. ELLE S'OUVRE PAR ROTATION autour d'un axe CENTRAL, et sa barre de
 *      manœuvre est EN HAUT. Non par élégance : on ne peut pas atteindre le
 *      bas d'une fenêtre posée dans un rampant.
 *   5. ELLE DEMANDE UN CHEVÊTRE — une trémie dans la charpente. Un
 *      configurateur qui l'ignore vend une fenêtre qu'un charpentier devra
 *      venir rendre posable.
 *   6. SON CRITÈRE D'AIDE N'EST PAS CELUI D'UNE FENÊTRE : `Uw ≤ 1,5` et
 *      `Sw ≥ 0,36`, là où une fenêtre verticale demande 1,3 et 0,30. Plus
 *      permissif sur la thermique, plus exigeant sur le solaire — parce
 *      qu'une fenêtre de toit est là pour éclairer.
 *
 * Source : `ressources/donnees/familles-a-venir.json` (VELUX, fiche
 * technique GGL VF 6126, téléchargée ; tableaux de dimensions publics ;
 * Anah pour les seuils d'aide).
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { FamilleCatalog, PricingCatalog } from '../../catalog.ts';
import type { ElevationLine, ElevationPoignee, ElevationRect } from '../../drawing.ts';
import type { JoineryConfiguration, ValidationIssue } from '../../types.ts';
import type { LigneNomenclature } from '../../export/nomenclature.ts';

/**
 * LES CODES DE DIMENSION, tels qu'on les commande.
 *
 * Deux lettres pour la largeur, deux chiffres pour la hauteur : CK01, MK06,
 * SK08. C'est la nomenclature de toute la filière, et un client qui a déjà
 * une fenêtre de toit lit son code sur la plaque de son ouvrant.
 */
export interface CodeFenetreDeToit {
  code: string;
  largeurMm: number;
  hauteurMm: number;
}

export const CODES_FENETRE_DE_TOIT: CodeFenetreDeToit[] = [
  { code: 'CK01', largeurMm: 550, hauteurMm: 698 },
  { code: 'CK02', largeurMm: 550, hauteurMm: 778 },
  { code: 'CK04', largeurMm: 550, hauteurMm: 978 },
  { code: 'FK04', largeurMm: 660, hauteurMm: 978 },
  { code: 'FK06', largeurMm: 660, hauteurMm: 1178 },
  { code: 'MK04', largeurMm: 780, hauteurMm: 978 },
  { code: 'MK06', largeurMm: 780, hauteurMm: 1178 },
  { code: 'MK08', largeurMm: 780, hauteurMm: 1398 },
  { code: 'SK06', largeurMm: 1140, hauteurMm: 1178 },
  { code: 'SK08', largeurMm: 1140, hauteurMm: 1398 },
  { code: 'UK04', largeurMm: 1340, hauteurMm: 978 },
];

/**
 * LA PENTE DE TOITURE ADMISSIBLE, en degrés.
 *
 * Sous quinze degrés, l'eau stagne sur le vitrage et la neige s'accumule
 * contre la traverse haute : aucun fabricant ne garantit l'étanchéité, et
 * le raccord standard n'est pas conçu pour. Au-delà de quatre-vingt-dix,
 * ce n'est plus un toit, c'est un mur — et c'est une fenêtre verticale
 * qu'il faut.
 */
export const PENTE_DEG = { min: 15, max: 90 } as const;

/**
 * LES SEUILS D'AIDE PROPRES À LA FENÊTRE DE TOIT.
 *
 * `Uw ≤ 1,5` et `Sw ≥ 0,36` — plus permissif que la fenêtre verticale sur
 * la thermique (1,3), plus exigeant sur le solaire (0,30). Ce n'est pas une
 * faveur : une fenêtre de toit est là pour ÉCLAIRER un comble, et un
 * vitrage à contrôle solaire qui la rendrait sombre manquerait son but.
 *
 * Les confondre est une erreur qui se paie dans les deux sens : annoncer
 * une fenêtre de toit non éligible parce qu'elle rate 1,3, ou l'annoncer
 * éligible avec un Sw de 0,32 qu'un dossier refusera.
 */
export const SEUILS_AIDES_TOIT = { uwMax: 1.5, swMin: 0.36, date: '2026-02' } as const;

/** Le kit de raccordement, par type de couverture. Sans lui, ça fuit. */
export type Couverture = 'tuiles' | 'ardoises' | 'bac-acier';

export const RACCORDS: Record<Couverture, { kit: string; nom: string }> = {
  // EDW : tuiles à relief, jusqu'à 120 mm d'épaisseur de couverture.
  tuiles: { kit: 'EDW', nom: 'tuiles à relief' },
  // EDL : matériaux PLATS — ardoises, shingle, zinc à joint debout.
  ardoises: { kit: 'EDL', nom: 'ardoises et matériaux plats' },
  'bac-acier': { kit: 'EDJ', nom: 'bac acier et couverture nervurée' },
};

/** Le code qui correspond à des cotes, ou celui qui s'en approche le mieux. */
export function codeLePlusProche(largeurMm: number, hauteurMm: number): CodeFenetreDeToit {
  return CODES_FENETRE_DE_TOIT.reduce((meilleur, candidat) => {
    const ecart = (c: CodeFenetreDeToit) =>
      Math.abs(c.largeurMm - largeurMm) + Math.abs(c.hauteurMm - hauteurMm);
    return ecart(candidat) < ecart(meilleur) ? candidat : meilleur;
  }, CODES_FENETRE_DE_TOIT[0]);
}

/** Le code exact, s'il existe — `undefined` sur une cote intermédiaire. */
export function codeExact(largeurMm: number, hauteurMm: number): CodeFenetreDeToit | undefined {
  return CODES_FENETRE_DE_TOIT.find(
    (candidat) => candidat.largeurMm === largeurMm && candidat.hauteurMm === hauteurMm,
  );
}

/** La barre de manœuvre, en tête d'ouvrant : hauteur vue, en mm. */
export const BARRE_DE_MANOEUVRE_MM = 60;

// L'angle d'ouverture courant vit dans `rotation-de-fenetre-de-toit.ts` (lot
// C13b) : `geometry3d.ts` le lit, et l'importer d'ici tirait ce module entier
// chez tout visiteur qui ouvre la 3D.
export { ROTATION_COURANTE_DEG } from './rotation-de-fenetre-de-toit.ts';

/**
 * CE QUI FAIT QU'UNE FENÊTRE DE TOIT N'EST PAS UNE FENÊTRE COUCHÉE — et
 * qu'aucun dessin générique ne peut le deviner.
 *
 * Le tracé commun aux familles vitrées la sortait en FRAPPE : un V pointé
 * sur un montant, une poignée à mi-hauteur sur le côté, des paumelles le
 * long de l'autre montant. Une fenêtre de toit n'a rien de tout cela.
 *
 *   1. ELLE PIVOTE SUR UN AXE HORIZONTAL MÉDIAN. Le haut du vantail rentre
 *      pendant que le bas sort. C'est ce qui permet de la manœuvrer sans se
 *      pencher dehors, et de la retourner pour la nettoyer.
 *   2. SA COMMANDE EST UNE BARRE, en tête d'ouvrant, sur toute la largeur.
 *      Elle est en haut parce que la fenêtre est en hauteur : une poignée
 *      basse obligerait à monter sur une chaise, et une poignée latérale
 *      serait hors de portée sous un rampant.
 *   3. ELLE N'A PAS DE PAUMELLES DE MONTANT. Ses pivots sont deux tourillons
 *      pris dans les montants, à mi-hauteur, invisibles fenêtre fermée.
 *
 * Cette fonction CORRIGE le tracé commun plutôt que d'en écrire un second :
 * le dormant, l'ouvrant, le clair et le vitrage sont les mêmes, et les
 * recalculer aurait fait deux chaînes de cotes à tenir d'accord.
 */
export function corrigerLeDessinDeLaFenetreDeToit(contexte: {
  rects: ElevationRect[];
  lines: ElevationLine[];
  poignees: ElevationPoignee[];
}): void {
  const { rects, lines, poignees } = contexte;

  // LE V DE FRAPPE S'EN VA. Sa pointe désigne des paumelles qui n'existent
  // pas — et c'est lui, en 3D, qui décide du côté des pivots et de la
  // poignée : le retirer suffit à retirer les trois.
  for (let index = lines.length - 1; index >= 0; index--) {
    if (lines[index].role === 'symbole') lines.splice(index, 1);
  }
  poignees.length = 0;

  const ouvrant = rects.find((rect) => rect.role === 'ouvrant');
  if (!ouvrant) return;

  // L'AXE DE ROTATION, en trait mixte : c'est la convention du dessin
  // technique pour un axe, et c'est bien ce que c'est.
  lines.push({
    role: 'ligne-de-coupe',
    x1Mm: ouvrant.xMm,
    y1Mm: ouvrant.yMm + ouvrant.heightMm / 2,
    x2Mm: ouvrant.xMm + ouvrant.widthMm,
    y2Mm: ouvrant.yMm + ouvrant.heightMm / 2,
    vantail: ouvrant.vantail,
  });

  // LA BARRE DE MANŒUVRE, en tête d'ouvrant et sur toute sa largeur.
  rects.push({
    role: 'barre',
    xMm: ouvrant.xMm,
    yMm: ouvrant.yMm,
    widthMm: ouvrant.widthMm,
    heightMm: Math.min(BARRE_DE_MANOEUVRE_MM, ouvrant.heightMm / 4),
    vantail: ouvrant.vantail,
  });
}

export const CATALOGUE_FENETRE_TOIT: FamilleCatalog = {
  label: 'Fenêtre de toit',
  matrices: {
    '1': {
      widthsMm: [550, 660, 780, 1140, 1340],
      heightsMm: [698, 978, 1178, 1398],
      cellsCents: [
        [39500, 43800, 48200, 61500, 69800],
        [44200, 48900, 53600, 68300, 77400],
        [48600, 53700, 58900, 75100, 85100],
        [53100, 58600, 64300, 82000, 92900],
      ],
    },
  },
  bornes: {
    minWidthMm: 550,
    minHeightMm: 698,
    // UN SEUL OUVRANT, et c'est structurel : une fenêtre de toit à deux
    // vantaux n'existe pas. Deux fenêtres côte à côte, oui — et elles se
    // commandent alors comme deux ouvrages, avec deux chevêtres.
    vantauxMin: 1,
    vantauxMax: 1,
    vantailMinMm: 550,
    vantailMaxMm: { bois: 1340, pvc: 1140 },
  },
  coefMateriauMilliemes: { bois: 1000, pvc: 960 },
  vitree: true,
  frameBandMm: { bois: 90, pvc: 95 },
  /**
   * LA FERRURE D'UNE FENÊTRE DE TOIT est un PIVOT À FRICTION, pas une
   * paumelle : l'ouvrant bascule autour de son axe central et doit tenir
   * dans toutes les positions, y compris à l'horizontale pendant qu'on
   * lave le verre. Les seuils sont donc plus bas qu'en vertical — une
   * paumelle porte, un pivot RETIENT.
   */
  seuilsFerrures: { standardKg: 45, renforceKg: 75 },
};

/**
 * LES REFUS D'UNE FENÊTRE DE TOIT. Ils portent sur le TOIT autant que sur
 * la fenêtre — comme ceux d'une porte de garage portent sur le mur.
 */
export function reglesFenetreDeToit(contexte: {
  config: JoineryConfiguration;
  catalog: PricingCatalog;
}): ValidationIssue[] {
  const { config } = contexte;
  if (config.famille !== 'fenetre-toit') return [];
  const issues: ValidationIssue[] = [];

  // --- LE CODE. On ne commande pas des millimètres.
  const exact = codeExact(config.widthMm, config.heightMm);
  if (!exact) {
    const proche = codeLePlusProche(config.widthMm, config.heightMm);
    issues.push({
      code: 'code-fenetre-de-toit',
      severite: 'erreur',
      message:
        `${config.widthMm} × ${config.heightMm} mm ne correspond à aucun code. Une fenêtre de ` +
        `toit se commande par son CODE — le plus proche est ${proche.code} ` +
        `(${proche.largeurMm} × ${proche.hauteurMm} mm). Une cote intermédiaire n’existe pas, ` +
        'quelle que soit la taille du trou dans le toit : c’est le chevêtre qu’on adapte.',
      alternative: {
        label: `Passer en ${proche.code}`,
        patch: { widthMm: proche.largeurMm, heightMm: proche.hauteurMm },
      },
    });
  } else {
    issues.push({
      code: 'code-fenetre-de-toit-retenu',
      severite: 'info',
      message: `Code ${exact.code} — c’est lui qui part à la commande, pas les millimètres.`,
    });
  }

  // --- LA PENTE. Elle décide si la fenêtre est étanche.
  const pente = config.penteToitureDeg;
  if (pente === undefined) {
    issues.push({
      code: 'pente-a-mesurer',
      severite: 'avertissement',
      message:
        `Pente de toiture non renseignée. Une fenêtre de toit se pose entre ${PENTE_DEG.min}° et ` +
        `${PENTE_DEG.max}° — sous ${PENTE_DEG.min}°, l’eau stagne et la neige s’accumule contre la ` +
        'traverse haute, et aucun fabricant ne garantit l’étanchéité.',
    });
  } else if (pente < PENTE_DEG.min) {
    issues.push({
      code: 'pente-insuffisante',
      severite: 'erreur',
      message:
        `Pente de ${pente}° : il en faut ${PENTE_DEG.min} au moins. En deçà, l’eau ne s’évacue pas ` +
        'et le raccord standard n’est pas conçu pour — il existe des châssis de toit plat, qui ' +
        'sont un autre produit.',
    });
  } else if (pente > PENTE_DEG.max) {
    issues.push({
      code: 'pente-excessive',
      severite: 'erreur',
      message: `Pente de ${pente}° : au-delà de ${PENTE_DEG.max}°, ce n’est plus un toit mais un mur — c’est une fenêtre verticale qu’il faut.`,
    });
  }

  // --- LE RACCORD. Ce n'est pas une option, c'est la moitié du produit.
  const couverture = config.couverture;
  if (!couverture) {
    // ON LE DEMANDE, on ne le refuse pas — la même règle que la retombée de
    // linteau d'une porte de garage. Refuser ferait ouvrir la famille sur
    // un refus, et un produit dont la configuration par défaut est invalide
    // est un produit qu'on n'essaie pas. Ce qui refuse vraiment, c'est le
    // MANIFESTE : on ne fabrique pas sans savoir sur quoi on pose.
    issues.push({
      code: 'raccord-manquant',
      severite: 'avertissement',
      message:
        'Aucune couverture déclarée : sans son kit de raccordement, une fenêtre de toit FUIT. ' +
        'Le kit dépend du matériau du toit — tuiles à relief, ardoises, bac acier — et il se ' +
        'commande AVEC la fenêtre, jamais après.',
    });
  } else {
    const raccord = RACCORDS[couverture];
    issues.push({
      code: 'raccord-retenu',
      severite: 'info',
      message: `Kit de raccordement ${raccord.kit} — ${raccord.nom}. Il fait partie de la commande.`,
    });
  }

  // --- LE CHEVÊTRE. Un charpentier, pas un menuisier.
  issues.push({
    code: 'chevetre-a-prevoir',
    severite: 'info',
    message:
      `Chevêtre à ouvrir dans la charpente : ${config.widthMm + 40} × ${config.heightMm + 40} mm ` +
      'entre chevrons, soit vingt millimètres de jeu par côté. C’est un travail de charpentier — ' +
      'et il se fait AVANT la livraison de la fenêtre.',
  });

  return issues;
}

/**
 * LES COTES D'HABILLAGE, tabulées par code — largeur et hauteur séparément.
 *
 * Elles viennent de la fiche technique VELUX GGL (`familles-a-venir.json`,
 * `cotesGGL`) et NE SE CALCULENT PAS : le dormant perd 84 mm en largeur
 * entre l'extérieur et l'intérieur, l'ouvrant 179 de plus, mais l'habillage
 * suit un pas qui lui est propre. Les déduire aurait donné des cotes fausses
 * de quelques millimètres — assez pour qu'un habillage ne rentre pas.
 *
 * La clé est le PRÉFIXE du code pour la largeur (CK, FK, MK, SK, UK) et son
 * SUFFIXE pour la hauteur (01, 02, 04, 06, 08).
 */
const HABILLAGE_LARGEUR_MM: Record<string, number> = {
  CK: 495,
  FK: 605,
  MK: 725,
  SK: 1085,
  UK: 1285,
};

const HABILLAGE_HAUTEUR_MM: Record<string, number> = {
  '01': 639,
  '02': 719,
  '04': 919,
  '06': 1119,
  '08': 1339,
};

/**
 * LE KIT DE RACCORDEMENT, par couverture. C'est la pièce qui rend la
 * fenêtre étanche, et elle DÉPEND DU TOIT, pas de la fenêtre : la même
 * MK04 reçoit un EDW sur des tuiles et un EDL sur des ardoises.
 *
 * L'oublier est l'erreur de commande la plus fréquente sur ce produit —
 * la fenêtre arrive, le couvreur monte, et il n'a rien pour la raccorder.
 */
const KIT_RACCORDEMENT: Partial<Record<string, { code: string; nom: string }>> = {
  tuiles: { code: 'EDW', nom: 'Kit de raccordement EDW — tuiles à relief' },
  ardoises: { code: 'EDL', nom: 'Kit de raccordement EDL — ardoises et couvertures plates' },
};

/**
 * LA NOMENCLATURE D'UNE FENÊTRE DE TOIT — une LISTE D'ACHAT, pas une liste
 * de débit.
 *
 * C'est ce qui la distingue de toutes les autres familles de ce catalogue,
 * et c'est pour cela que le modèle générique ne pouvait pas marcher : une
 * fenêtre de toit NE SE FABRIQUE PAS. Elle se commande par son code, chez
 * un gammiste qui en fait douze tailles, et l'atelier ne coupe rien. Lui
 * demander un cadre d'ouvrant à quatre barres d'onglet n'avait aucun sens :
 * l'ouvrant arrive monté, avec son vitrage et sa barre de manœuvre.
 *
 * Les trois lignes qu'elle porte sont donc trois RÉFÉRENCES à commander :
 * la fenêtre, le raccord d'étanchéité qui dépend de la couverture, et
 * l'habillage intérieur qui referme la trémie. Le chevêtre, lui, n'y est
 * pas — il est en charpente, et c'est le couvreur qui le fait.
 */
export function nomenclatureFenetreDeToit(contexte: {
  config: JoineryConfiguration;
  repere: string;
}): { lignes: LigneNomenclature[]; lacunes: string[] } | null {
  const { config } = contexte;
  if (config.famille !== 'fenetre-toit') return null;

  const lignes: LigneNomenclature[] = [];
  const lacunes: string[] = [];
  const code = codeExact(config.widthMm, config.heightMm);
  if (!code) {
    // Le refus existe déjà dans les règles de la famille ; ici il devient
    // une lacune, parce qu'une fenêtre de toit sans code n'a pas de
    // référence à commander — et une nomenclature sans référence n'en est
    // pas une.
    const proche = codeLePlusProche(config.widthMm, config.heightMm);
    lacunes.push(
      `${config.widthMm} × ${config.heightMm} mm ne correspond à aucun code : ` +
        `une fenêtre de toit se commande par code, et le plus proche est ${proche.code} ` +
        `(${proche.largeurMm} × ${proche.hauteurMm} mm)`,
    );
    return { lignes, lacunes };
  }

  // LE MODÈLE EST GGL — la rotation à axe central, et le configurateur n'en
  // propose pas d'autre.
  //
  // Ce n'est pas un défaut de cette fonction, c'est un fait sur la famille :
  // elle ne déclare AUCUNE ouverture au catalogue, et son dessin porte un
  // pivot médian. La projection (GPL, poignée en bas) est une autre
  // référence, avec sa propre cinématique — le jour où l'écran la proposera,
  // c'est ici qu'elle changera la ligne, et pas ailleurs.
  const modele = 'GGL';
  lignes.push({
    categorie: 'accessoire',
    reference: `${modele}-${code.code}-${config.materiau}`,
    designation:
      `Fenêtre de toit ${modele} ${code.code} — ${code.largeurMm} × ${code.hauteurMm} mm, ` +
      'rotation axe central, ' +
      'dormant bois et capotage aluminium',
    quantite: 1,
    unite: 'piece',
    teinte: config.couleur,
    regle: 'une fenêtre de toit se commande PAR CODE — elle ne se fabrique pas sur mesure',
  });

  // LE RACCORD D'ÉTANCHÉITÉ dépend de la COUVERTURE, pas de la fenêtre.
  const couverture = config.couverture;
  if (!couverture) {
    lacunes.push(
      'la couverture n’est pas déclarée : le kit de raccordement en dépend ' +
        '(EDW sur tuiles, EDL sur ardoises), et sans lui la fenêtre arrive sans de quoi l’étancher',
    );
  } else {
    const kit = KIT_RACCORDEMENT[couverture];
    if (!kit) {
      lacunes.push(
        `couverture « ${couverture} » : ce dépôt ne source que les kits EDW (tuiles) ` +
          'et EDL (ardoises) — le raccord d’un bac acier se demande au gammiste',
      );
    } else {
      lignes.push({
        categorie: 'accessoire',
        reference: `${kit.code}-${code.code}`,
        designation: kit.nom,
        quantite: 1,
        unite: 'piece',
        regle: 'imposé par la couverture du toit — c’est l’oubli de commande le plus fréquent',
      });
    }
  }

  // L'HABILLAGE INTÉRIEUR, à ses cotes tabulées. Il referme la trémie entre
  // le dormant et le plafond ; sans lui, on voit la charpente.
  const prefixe = code.code.slice(0, 2);
  const suffixe = code.code.slice(2);
  const largeurHabillage = HABILLAGE_LARGEUR_MM[prefixe];
  const hauteurHabillage = HABILLAGE_HAUTEUR_MM[suffixe];
  if (largeurHabillage === undefined || hauteurHabillage === undefined) {
    lacunes.push(
      `code ${code.code} : la cote d’habillage n’est pas tabulée pour ce format — ` +
        'elle se lit sur la fiche du gammiste, elle ne se déduit pas',
    );
  } else {
    lignes.push({
      categorie: 'accessoire',
      reference: `LSB-${code.code}`,
      designation: `Habillage intérieur — ${largeurHabillage} × ${hauteurHabillage} mm`,
      quantite: 1,
      unite: 'piece',
      teinte: config.couleur,
      regle: 'cote d’habillage TABULÉE par code — elle ne se déduit pas des déductions de dormant',
    });
  }

  return { lignes, lacunes };
}
