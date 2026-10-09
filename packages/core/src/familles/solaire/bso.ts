/**
 * Pourquoi ce fichier existe : le brise-soleil orientable est la protection
 * solaire du tertiaire et de la maison contemporaine, et ce catalogue ne
 * connaissait que deux stores — le BANNE, qui se replie au-dessus d'une
 * terrasse, et l'INTÉRIEUR, qui est dedans. Le BSO est dehors et NE SE
 * REPLIE PAS.
 *
 * SA LISTE DE DIFFÉRENCES avec les deux stores déjà présents :
 *
 *   1. SA CLASSE DE VENT BAISSE QUAND SA LARGEUR MONTE. C'est le fait
 *      central de cette famille, et il n'existe nulle part ailleurs dans le
 *      dépôt. Un BSO de 1 500 mm tient la classe 6 ; le MÊME produit à
 *      4 500 mm tombe à la classe 3, et à 5 000 mm il n'a plus de classe du
 *      tout. Une largeur seule ne dit rien. Toutes les autres familles
 *      bornent une largeur ; celle-ci borne un COUPLE largeur-classe.
 *   2. IL A UN PLAFOND DE SURFACE SÉPARÉ DE SES COTES. Ses cotes maximales
 *      autoriseraient 4,5 × 4,3 = 19,35 m² ; il s'arrête à 10 m². Un moteur
 *      qui ne vérifierait que largeur et hauteur en vendrait le double.
 *   3. IL EXIGE UNE RÉSERVATION DANS LE MUR. Son paquet de lames s'empile
 *      en haut, dans une niche de linteau dont la hauteur DÉPEND de la
 *      hauteur du store. C'est une cote du BÂTIMENT, pas du produit — le
 *      même piège que la retombée de linteau d'une porte de garage, et pour
 *      la même raison : elle décide si l'ouvrage se pose.
 *   4. IL RELÈVE D'EN 13659, PAS D'EN 13561. Deux échelles de vent
 *      différentes, qui ne se convertissent pas : EN 13561 s'arrête à la
 *      classe 3, EN 13659 monte à 6. Un BSO « classe 3 » n'est pas un store
 *      banne « classe 3 ».
 *   5. IL RESTE EXPOSÉ. C'est son argument commercial face au banne : dans
 *      sa classe, il n'a pas à être rentré. La contrepartie est qu'il n'a
 *      aucun repli pour se sauver, et donc que le refus doit être ferme.
 *
 * Source : `ressources/donnees/protections-solaires.json`, relevé le
 * 6 septembre 2026 sur la documentation Griesser Lamisol (article 183016,
 * révision 20240911) — voir docs/36. Les nombres de ce fichier viennent de
 * là et de nulle part ailleurs.
 *
 * Solution écartée : borner la largeur à 4 500 mm et s'arrêter là. C'est ce
 * que fait un catalogue, et cela laisse vendre un BSO de 4 400 mm en zone
 * exposée sans dire qu'il n'y tient plus qu'en classe 3. La borne
 * dimensionnelle est la conséquence de la table de vent, pas l'inverse.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { FamilleCatalog, PricingCatalog } from '../../catalog.ts';
import type { JoineryConfiguration, ValidationIssue } from '../../types.ts';
import {
  LA_NORME_S_ARRETE_A,
  phraseDeClasseHorsEchelle,
} from '../../classes-de-vent-en-13659.ts';

/**
 * LES CLASSES DE VENT D'EN 13659, en vitesses de réglage de capteur.
 *
 * Ce ne sont pas des pressions : ce sont les vitesses auxquelles le poseur
 * règle le capteur monté sur le produit. Deux colonnes chez le gammiste, m/s
 * et km/h, arrondies séparément ; SEUL le km/h voyage jusqu'au navigateur,
 * parce que c'est la seule des deux qui s'affiche. Les m/s, la force
 * Beaufort et les indicateurs visuels restent dans
 * `ressources/donnees/protections-solaires.json`, où ils servent à
 * quelqu'un — un morceau de famille n'est pas un ouvrage de référence, et
 * le budget de `verifier-bundle.mjs` l'a rappelé au premier pesage.
 *
 * `LA_NORME_S_ARRETE_A` vaut 6. Les classes 7 et 8 existent chez ce
 * gammiste et pas dans la norme produit ; les afficher sans le dire
 * vendrait une classe qui n'en est pas une.
 */
export const VITESSE_DE_CLASSE_KMH: Readonly<Record<number, number>> = {
  1: 32.5,
  2: 38.5,
  3: 46,
  4: 60,
  5: 76,
  6: 92,
  7: 105,
  8: 120,
};

// LA BORNE DE LA NORME EST PARTAGÉE — lot MT2b. Le volet coulissant est la
// SECONDE famille à rencontrer une « classe 8 » chez son gammiste ; deux
// copies d'une même borne de norme, ce sont deux vérités le jour où l'une est
// corrigée. Elle vit dans `classes-de-vent-en-13659.ts`, avec la phrase.
// La table de VITESSES ci-dessus, elle, ne remonte PAS : le volet coulissant
// publie des PRESSIONS D'ESSAI, et la classe 6 y vaut 600 Pa quand le réglage
// de capteur du BSO en vaut 400. Même numéro, deux grandeurs.
export { LA_NORME_S_ARRETE_A } from '../../classes-de-vent-en-13659.ts';

/** Les trois modèles relevés, par largeur de lame. */
export type ModeleBso = 'lamisol-70' | 'lamisol-90' | 'lamisol-vento';

export const MODELES_BSO: Array<{
  id: ModeleBso;
  nom: string;
  largeurLameMm: number;
  argument: string;
}> = [
  {
    id: 'lamisol-70',
    nom: 'Lame 69 mm',
    largeurLameMm: 69,
    argument:
      'La lame étroite : elle s’empile bas, donc elle demande moins de linteau. C’est le modèle de la rénovation.',
  },
  {
    id: 'lamisol-90',
    nom: 'Lame 93 mm',
    largeurLameMm: 93,
    argument:
      'La lame large : moins de lames pour la même hauteur, et une classe de vent qui tient une largeur de plus.',
  },
  {
    id: 'lamisol-vento',
    nom: 'Lame 69 mm renforcée vent',
    largeurLameMm: 69,
    argument:
      'Conçu pour le vent : il monte au-delà de la classe 6 — mais il s’arrête à 3 000 mm de large et 9 m².',
  },
];

/**
 * LA TABLE QUI DÉCIDE DE TOUT — classe de vent admissible par largeur.
 *
 * `null` ne veut pas dire « non testé » : il veut dire QU'IL N'Y A PAS DE
 * CLASSE selon la norme produit, c'est-à-dire hors domaine. Le store ne se
 * vend pas à cette largeur.
 *
 * On lit la classe à la largeur immédiatement SUPÉRIEURE ou égale : un store
 * de 2 600 mm est classé comme un 3 000, pas comme un 2 500. Prendre le
 * palier inférieur annoncerait une classe que le produit n'a pas.
 */
export const LARGEURS_DE_TABLE_MM = [1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000] as const;

export const CLASSE_PAR_LARGEUR: Record<ModeleBso, ReadonlyArray<number | null>> = {
  'lamisol-70': [6, 6, 5, 4, 4, 4, 3, null],
  'lamisol-90': [6, 6, 6, 5, 5, 5, 3, null],
  'lamisol-vento': [8, 7, 7, 6, null, null, null, null],
};

/** Les bornes de chaque modèle — cotes ET plafond de surface. */
export const BORNES_BSO: Record<
  ModeleBso,
  { largeurMinMm: number; largeurMaxMm: number; hauteurMinMm: number; hauteurMaxMm: number; surfaceMaxM2: number }
> = {
  'lamisol-70': { largeurMinMm: 590, largeurMaxMm: 4500, hauteurMinMm: 400, hauteurMaxMm: 4300, surfaceMaxM2: 10 },
  'lamisol-90': { largeurMinMm: 590, largeurMaxMm: 4500, hauteurMinMm: 400, hauteurMaxMm: 4300, surfaceMaxM2: 10 },
  'lamisol-vento': { largeurMinMm: 695, largeurMaxMm: 3000, hauteurMinMm: 400, hauteurMaxMm: 3000, surfaceMaxM2: 9 },
};

/**
 * LA RÉSERVATION DE LINTEAU, palier par palier.
 *
 * `hs` est la hauteur de niche nécessaire au-dessus du store, pour que le
 * paquet de lames s'y range. Elle croît avec la hauteur du store, parce
 * qu'un store plus haut a plus de lames à empiler.
 *
 * Les paliers s'enchaînent sans trou : la borne haute de l'un est la borne
 * basse du suivant moins un millimètre. Une épreuve le vérifie sur la donnée
 * source, une autre ici sur la copie — c'est la duplication et son
 * comparateur.
 */
export const LINTEAU_PAR_HAUTEUR: Record<ModeleBso, ReadonlyArray<{ hauteurMaxMm: number; linteauMm: number }>> = {
  'lamisol-70': [
    { hauteurMaxMm: 1250, linteauMm: 205 },
    { hauteurMaxMm: 1500, linteauMm: 220 },
    { hauteurMaxMm: 1750, linteauMm: 235 },
    { hauteurMaxMm: 2000, linteauMm: 250 },
    { hauteurMaxMm: 2250, linteauMm: 265 },
    { hauteurMaxMm: 2500, linteauMm: 285 },
    { hauteurMaxMm: 2750, linteauMm: 300 },
    { hauteurMaxMm: 3000, linteauMm: 315 },
    { hauteurMaxMm: 3250, linteauMm: 335 },
    { hauteurMaxMm: 3500, linteauMm: 350 },
    { hauteurMaxMm: 3750, linteauMm: 365 },
    { hauteurMaxMm: 4000, linteauMm: 385 },
    { hauteurMaxMm: 4250, linteauMm: 400 },
    { hauteurMaxMm: 4300, linteauMm: 405 },
  ],
  'lamisol-90': [
    { hauteurMaxMm: 1750, linteauMm: 225 },
    { hauteurMaxMm: 2000, linteauMm: 235 },
    { hauteurMaxMm: 2250, linteauMm: 250 },
    { hauteurMaxMm: 2500, linteauMm: 260 },
    { hauteurMaxMm: 2750, linteauMm: 275 },
    { hauteurMaxMm: 3000, linteauMm: 290 },
    { hauteurMaxMm: 3250, linteauMm: 305 },
    { hauteurMaxMm: 3500, linteauMm: 320 },
    { hauteurMaxMm: 3750, linteauMm: 330 },
    { hauteurMaxMm: 4000, linteauMm: 350 },
    { hauteurMaxMm: 4250, linteauMm: 360 },
    { hauteurMaxMm: 4300, linteauMm: 365 },
  ],
  'lamisol-vento': [
    { hauteurMaxMm: 1800, linteauMm: 225 },
    { hauteurMaxMm: 2000, linteauMm: 235 },
    { hauteurMaxMm: 2250, linteauMm: 250 },
    { hauteurMaxMm: 2500, linteauMm: 260 },
    { hauteurMaxMm: 2750, linteauMm: 275 },
    { hauteurMaxMm: 3000, linteauMm: 290 },
  ],
};

/** Profondeur de niche et dégagement latéral minimaux, par modèle. */
export const ENCOMBREMENT_BSO: Record<ModeleBso, { profondeurNicheMm: number; degagementLateralMm: number }> = {
  'lamisol-70': { profondeurNicheMm: 100, degagementLateralMm: 50 },
  'lamisol-90': { profondeurNicheMm: 130, degagementLateralMm: 65 },
  'lamisol-vento': { profondeurNicheMm: 130, degagementLateralMm: 65 },
};

/**
 * La classe de vent admissible d'un BSO, ou `null` s'il est hors domaine.
 *
 * On lit au palier SUPÉRIEUR ou égal. Au-delà de la dernière largeur de la
 * table, il n'y a pas de classe — et c'est un `null`, pas une extrapolation.
 */
export function classeDeVent(modele: ModeleBso, largeurMm: number): number | null {
  const classes = CLASSE_PAR_LARGEUR[modele];
  for (let i = 0; i < LARGEURS_DE_TABLE_MM.length; i += 1) {
    if (largeurMm <= LARGEURS_DE_TABLE_MM[i]) return classes[i];
  }
  return null;
}

/** La hauteur de linteau nécessaire, ou `null` hors domaine du modèle. */
export function linteauNecessaireMm(modele: ModeleBso, hauteurMm: number): number | null {
  for (const palier of LINTEAU_PAR_HAUTEUR[modele]) {
    if (hauteurMm <= palier.hauteurMaxMm) return palier.linteauMm;
  }
  return null;
}

/** La vitesse de vent que porte une classe, en km/h. */
export function vitesseDeClasseKmh(classe: number): number | null {
  return VITESSE_DE_CLASSE_KMH[classe] ?? null;
}

export const CATALOGUE_BSO: FamilleCatalog = {
  label: 'Brise-soleil orientable',
  matrices: {
    '1': {
      widthsMm: [1000, 1500, 2000, 3000, 4000],
      heightsMm: [1000, 1500, 2000, 3000],
      cellsCents: [
        [48000, 62000, 79000, 112000, 146000],
        [58000, 75000, 96000, 136000, 178000],
        [69000, 89000, 114000, 162000, 212000],
        [88000, 114000, 146000, 208000, 272000],
      ],
    },
  },
  bornes: {
    // La borne BASSE de la gamme la plus permissive. Les bornes par MODÈLE
    // sont plus serrées, et c'est `reglesBso` qui les fait respecter : le
    // catalogue ne sait pas quel modèle a été choisi.
    minWidthMm: 590,
    minHeightMm: 400,
    vantauxMin: 1,
    vantauxMax: 1,
    vantailMinMm: 590,
    // 4 500 mm est la borne de la TABLE de classe de vent, pas un choix de
    // catalogue : au-delà, le produit n'a plus de classe. Un seul matériau
    // ici, comme dans `coefMateriauMilliemes` — une épreuve du catalogue
    // exige que les deux listes coïncident, et elle a raison : un matériau
    // borné mais non tarifé est un matériau qu'on croit vendre.
    vantailMaxMm: { alu: 4500 },
  },
  // UN SEUL MATÉRIAU DÉCLARÉ, et c'est le fond du sujet : un BSO est en
  // ALUMINIUM. Ses lames sont profilées, son tablier reste dehors, et il
  // n'existe ni BSO PVC ni BSO bois.
  //
  // Première écriture, corrigée par une épreuve : les trois matériaux
  // portaient 1 000, « pour ne pas déformer un prix de toute façon refusé ».
  // `catalog.test.ts` l'a refusé, et il avait raison — la matrice donne le
  // prix d'UN matériau de référence, et d'un seul. Trois coefficients à
  // 1 000 ne disent pas « alu seulement », ils disent « les trois coûtent
  // pareil », ce qui est faux et ce qui est invérifiable. Le champ est
  // partiel : on n'en déclare qu'un, et c'est la vérité.
  coefMateriauMilliemes: { alu: 1000 },
  // PAS DE VITRAGE : un BSO est DEVANT le vitrage, il n'en est pas un.
  vitree: false,
  frameBandMm: { alu: 30, bois: 30, pvc: 30 },
};

/**
 * LES REFUS D'UN BSO. Ils sont fermes, et c'est délibéré : ce store NE SE
 * REPLIE PAS. Un store banne trop exposé se rentre ; un BSO trop exposé
 * casse. Il n'y a pas de repli de secours à proposer à la place.
 */
export function reglesBso(contexte: {
  config: JoineryConfiguration;
  catalog: PricingCatalog;
}): ValidationIssue[] {
  const { config } = contexte;
  if (config.famille !== 'bso') return [];
  const issues: ValidationIssue[] = [];

  const modele = config.modeleBso ?? 'lamisol-90';
  const bornes = BORNES_BSO[modele];
  const nom = MODELES_BSO.find((candidat) => candidat.id === modele)?.nom ?? modele;

  // --- LA MATIÈRE. Un BSO est en aluminium, et il n'y a pas d'alternative
  // dans une autre matière : c'est un refus qui n'a pas de patch.
  if (config.materiau !== 'alu') {
    issues.push({
      code: 'bso-aluminium-seul',
      severite: 'erreur',
      message:
        `Un brise-soleil orientable se fait en ALUMINIUM. Ses lames sont profilées et son ` +
        `tablier reste dehors toute l’année : ni le PVC ni le bois ne tiennent ce rôle. ` +
        `Matière demandée : ${config.materiau}.`,
      alternative: { label: 'Passer en aluminium', patch: { materiau: 'alu' } },
    });
  }

  // --- LA LARGEUR HORS TABLE. C'est le premier refus, parce qu'il rend tous
  // les autres sans objet : hors table, il n'y a pas de classe de vent.
  const classe = classeDeVent(modele, config.widthMm);
  if (config.widthMm > bornes.largeurMaxMm || classe === null) {
    issues.push({
      code: 'bso-largeur-hors-table',
      severite: 'erreur',
      message:
        `${config.widthMm} mm de large : au-delà de ${bornes.largeurMaxMm} mm, ce modèle ` +
        `n’a PLUS DE CLASSE DE RÉSISTANCE AU VENT selon EN 13659 — ce n’est pas « non testé », ` +
        `c’est hors domaine. Le tablier reste dehors et ne se replie pas : il n’y a pas de ` +
        `repli de secours à proposer.`,
      alternative:
        modele === 'lamisol-vento'
          ? { label: 'Passer en lame 93 mm, qui va jusqu’à 4 500 mm', patch: { modeleBso: 'lamisol-90' } }
          : { label: `Ramener à ${bornes.largeurMaxMm} mm`, patch: { widthMm: bornes.largeurMaxMm } },
    });
  } else if (classe <= 3) {
    // --- LA CLASSE QUI TOMBE. Ce n'est pas un refus : le produit existe et
    // se vend. C'est l'avertissement que personne ne donne, et qui explique
    // pourquoi le même modèle « ne tient pas » chez le voisin.
    const kmh = vitesseDeClasseKmh(classe);
    issues.push({
      code: 'bso-classe-de-vent-basse',
      severite: 'avertissement',
      message:
        `À ${config.widthMm} mm de large, ce brise-soleil descend en CLASSE ${classe} ` +
        `(EN 13659${kmh === null ? '' : `, capteur à régler vers ${kmh} km/h`}). ` +
        `Le même produit tient la classe 6 à 2 000 mm : c’est la LARGEUR qui fait tomber la ` +
        `classe, pas la qualité. En façade exposée, deux stores accouplés valent mieux qu’un large.`,
      alternative:
        modele === 'lamisol-70'
          ? { label: 'Passer en lame 93 mm, qui tient une largeur de plus', patch: { modeleBso: 'lamisol-90' } }
          : undefined,
    });
  }

  // --- LE PLAFOND DE SURFACE. Séparé des cotes, et il mord bien avant elles.
  const surfaceM2 = (config.widthMm / 1000) * (config.heightMm / 1000);
  if (surfaceM2 > bornes.surfaceMaxM2) {
    const largeurAdmiseMm = Math.floor(((bornes.surfaceMaxM2 * 1_000_000) / config.heightMm) / 10) * 10;
    issues.push({
      code: 'bso-surface-hors-borne',
      severite: 'erreur',
      message:
        `${surfaceM2.toFixed(2).replace('.', ',')} m² : ${nom} s’arrête à ${bornes.surfaceMaxM2} m². ` +
        `Ce plafond est SÉPARÉ des cotes — les cotes maximales de ce modèle autoriseraient ` +
        `${((bornes.largeurMaxMm / 1000) * (bornes.hauteurMaxMm / 1000)).toFixed(2).replace('.', ',')} m², ` +
        `et le tablier n’y monterait pas. C’est le poids du paquet de lames qui borne, pas l’encombrement.`,
      alternative: {
        label: `Ramener la largeur à ${largeurAdmiseMm} mm`,
        patch: { widthMm: largeurAdmiseMm },
      },
    });
  }

  // --- LA HAUTEUR HORS GAMME.
  if (config.heightMm > bornes.hauteurMaxMm) {
    issues.push({
      code: 'bso-hauteur-hors-borne',
      severite: 'erreur',
      message:
        `${config.heightMm} mm de haut : ${nom} s’arrête à ${bornes.hauteurMaxMm} mm.`,
      alternative: { label: `Ramener à ${bornes.hauteurMaxMm} mm`, patch: { heightMm: bornes.hauteurMaxMm } },
    });
  }

  // --- LA RÉSERVATION DE LINTEAU. La cote du BÂTIMENT, pas du produit.
  const linteauMm = linteauNecessaireMm(modele, Math.min(config.heightMm, bornes.hauteurMaxMm));
  if (linteauMm !== null) {
    const declare = config.linteauDisponibleMm;
    if (declare === undefined) {
      issues.push({
        code: 'bso-linteau-a-declarer',
        severite: 'info',
        message:
          `Ce store demande ${linteauMm} mm de LINTEAU au-dessus du tableau pour empiler ses ` +
          `lames, et ${ENCOMBREMENT_BSO[modele].profondeurNicheMm} mm de profondeur de niche. ` +
          `C’est une cote du bâtiment : personne ne l’a encore mesurée. Tant qu’elle n’est pas ` +
          `déclarée, on ne sait pas si ce store se pose.`,
      });
    } else if (declare < linteauMm) {
      issues.push({
        code: 'bso-linteau-insuffisant',
        severite: 'erreur',
        message:
          `${declare} mm de linteau déclarés, ${linteauMm} mm nécessaires pour un store de ` +
          `${config.heightMm} mm en ${nom.toLowerCase()}. Le paquet de lames ne rentre pas : ` +
          `il resterait ${linteauMm - declare} mm de tablier en travers du vitrage, ouvert comme fermé.`,
        alternative:
          modele === 'lamisol-90'
            ? {
                label: 'Passer en lame 69 mm, qui s’empile plus bas',
                patch: { modeleBso: 'lamisol-70' },
              }
            : undefined,
      });
    } else {
      issues.push({
        code: 'bso-linteau-suffisant',
        severite: 'info',
        message:
          `${linteauMm} mm de linteau nécessaires, ${declare} mm déclarés — le paquet de lames ` +
          `se range. Prévoir aussi ${ENCOMBREMENT_BSO[modele].degagementLateralMm} mm de dégagement ` +
          `de chaque côté pour les coulisses.`,
      });
    }
  }

  // --- LA CLASSE HORS NORME. Le Vento monte au-delà de 6, et ce n'est plus
  // la norme produit qui parle. On le dit plutôt que de laisser croire.
  if (classe !== null && classe > LA_NORME_S_ARRETE_A) {
    issues.push({
      code: 'bso-classe-hors-norme',
      severite: 'info',
      message: phraseDeClasseHorsEchelle(classe),
    });
  }

  return issues;
}
