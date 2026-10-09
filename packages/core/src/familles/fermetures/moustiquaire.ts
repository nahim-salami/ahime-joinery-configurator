/**
 * Pourquoi ce fichier existe : la moustiquaire était une OPTION — quatre-
 * vingt-quinze euros cochés sur une fenêtre neuve — et c'est la moitié du
 * marché. L'autre moitié s'achète SEULE, pour une fenêtre qu'on a déjà, et
 * ce catalogue ne savait pas la vendre.
 *
 * Elle reste une option là où elle en est une : sur une menuiserie qu'on
 * configure, cochée avec le reste. Elle devient une FAMILLE là où elle est
 * un produit : un ouvrage qu'on mesure, qu'on choisit et qu'on pose sur
 * l'existant. Les deux coexistent, et ce n'est pas une redondance — c'est
 * la différence entre un accessoire et un achat.
 *
 * SA LISTE DE DIFFÉRENCES, parce qu'une moustiquaire n'est pas un petit
 * volet roulant :
 *
 *   1. ELLE SE MESURE EN TABLEAU, pas en menuiserie. On la pose DANS
 *      l'embrasure ou EN APPLIQUE sur le dormant existant — et les deux
 *      cotes ne sont pas les mêmes. C'est la première cause de retour.
 *   2. SA TOILE N'EST PAS UN VITRAGE. Fibre de verre enduite PVC, maille de
 *      1,2 à 1,5 mm ; elle ne se calcule ni en Uw, ni en poids, ni en
 *      classe de ferrure. Lui appliquer les règles d'une menuiserie vitrée
 *      donnerait des refus qui n'ont aucun sens.
 *   3. SON TYPE DÉCIDE DE TOUT. Une enroulable verticale a un coffre et
 *      deux coulisses ; un cadre fixe n'a ni l'un ni l'autre et se clipse ;
 *      une plissée se replie en accordéon. Ce ne sont pas des finitions,
 *      ce sont trois produits.
 *   4. ELLE A UNE HAUTEUR MAXIMALE PAR COFFRE. Un coffre de 40 mm enroule
 *      1 800 mm de toile, pas plus : au-delà le rouleau ne rentre plus, et
 *      c'est un coffre de 55 qu'il faut. Le client ne le devine pas.
 *   5. ELLE NE SE POSE PAS SUR UN OUVRANT QUI S'OUVRE VERS L'EXTÉRIEUR.
 *      Une moustiquaire est DEVANT ; un ouvrant à la française qui sort
 *      viendrait buter dedans. C'est le refus qu'aucun configurateur
 *      n'oppose, et il se découvre à la première ouverture.
 *
 * Source : `ressources/donnees/familles-a-venir.json` — coffres 36 à 55 mm,
 * coulisses 22-25, tube 25, toile fibre de verre enduite PVC.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { FamilleCatalog, PricingCatalog } from '../../catalog.ts';
import type { JoineryConfiguration, ValidationIssue } from '../../types.ts';
import type { LigneNomenclature } from '../../export/nomenclature.ts';

// LE TYPE ET SA LISTE ONT REMONTÉ au lot O9a, dans
// `types-de-moustiquaire-et-de-store.ts` : l'écran qui les montre est PARTAGÉ
// aurait fait descendre tout le groupe `fermetures` chez qui vient poser une
export {
  TYPES_MOUSTIQUAIRE,
  type TypeMoustiquaire,
} from '../../types-de-moustiquaire-et-de-store.ts';
import type { TypeMoustiquaire } from '../../types-de-moustiquaire-et-de-store.ts';

/**
 * LES COFFRES D'ENROULEUR et la hauteur de toile qu'ils avalent.
 *
 * Le rouleau grossit en spirale : c'est le même calcul que le coffre d'un
 * volet roulant, en plus petit. Un coffre de 40 mm ne prend pas 1 900 mm de
 * toile parce qu'on le souhaite — le tube fait 25 mm, et ce qui reste
 * autour est fini.
 */
export const COFFRES = [
  { hauteurCoffreMm: 36, toileMaxMm: 1400 },
  { hauteurCoffreMm: 40, toileMaxMm: 1800 },
  { hauteurCoffreMm: 42, toileMaxMm: 2100 },
  { hauteurCoffreMm: 55, toileMaxMm: 3000 },
] as const;

/** Le plus petit coffre qui avale cette hauteur — `undefined` au-delà. */
export function coffrePourHauteur(hauteurMm: number) {
  return COFFRES.find((coffre) => hauteurMm <= coffre.toileMaxMm);
}

/**
 * LA COULISSE, en mm — 25 de large, 40 de profond, brosse comprise.
 *
 * Les deux largeurs du commerce sont 22 et 25 ; on retient la seconde, qui
 * est celle des gammes courantes et la seule qui accepte une toile de plus
 * de deux mètres sans battre au vent.
 */
export const COULISSE_LARGEUR_MM = 25;
export const COULISSE_PROFONDEUR_MM = 40;

/** La maille, en mm. 1,2 arrête les moucherons ; 1,5 laisse passer l'air. */
export const MAILLE_MM = { fine: 1.2, standard: 1.5 } as const;

export const CATALOGUE_MOUSTIQUAIRE: FamilleCatalog = {
  label: 'Moustiquaire',
  matrices: {
    '1': {
      widthsMm: [600, 900, 1200, 1600, 2000],
      heightsMm: [800, 1200, 1600, 2200],
      cellsCents: [
        [7900, 9200, 10800, 13600, 16200],
        [8800, 10300, 12100, 15200, 18100],
        [9800, 11500, 13500, 16900, 20200],
        [11200, 13100, 15400, 19300, 23000],
      ],
    },
  },
  bornes: {
    minWidthMm: 400,
    minHeightMm: 400,
    vantauxMin: 1,
    vantauxMax: 1,
    vantailMinMm: 400,
    vantailMaxMm: { alu: 2400, pvc: 1600 },
  },
  coefMateriauMilliemes: { alu: 1000, pvc: 880 },
  // ELLE N'EST PAS VITRÉE, et c'est ce qui la sauve de trente règles qui
  // n'ont aucun sens pour elle : pas de Uw, pas de poids de vitrage, pas de
  // classe de ferrure. Une toile de fibre de verre ne se calcule pas comme
  // un double vitrage.
  vitree: false,
  frameBandMm: { alu: 25, pvc: 30 },
};

/**
 * LES REFUS D'UNE MOUSTIQUAIRE. Deux d'entre eux n'existent nulle part
 * ailleurs : le coffre qui n'avale pas la toile, et l'ouvrant qui viendrait
 * buter dedans.
 */
export function reglesMoustiquaire(contexte: {
  config: JoineryConfiguration;
  catalog: PricingCatalog;
}): ValidationIssue[] {
  const { config } = contexte;
  if (config.famille !== 'moustiquaire') return [];
  const issues: ValidationIssue[] = [];

  const type = config.typeMoustiquaire ?? 'enroulable-verticale';
  const enroulable = type === 'enroulable-verticale' || type === 'enroulable-laterale';

  // --- LE COFFRE. Le rouleau grossit en spirale, et le coffre est fini.
  if (enroulable) {
    // Sur une latérale, c'est la LARGEUR qui s'enroule.
    const toileMm = type === 'enroulable-laterale' ? config.widthMm : config.heightMm;
    const coffre = coffrePourHauteur(toileMm);
    if (!coffre) {
      const plusGrand = COFFRES[COFFRES.length - 1];
      issues.push({
        code: 'coffre-moustiquaire-insuffisant',
        severite: 'erreur',
        message:
          `${toileMm} mm de toile à enrouler : le plus grand coffre en avale ` +
          `${plusGrand.toileMaxMm}. Au-delà, le rouleau ne rentre plus — c’est une PLISSÉE qu’il ` +
          'faut, qui se replie en accordéon au lieu de s’enrouler.',
        alternative: { label: 'Passer en plissée', patch: { typeMoustiquaire: 'plissee' } },
      });
    } else {
      issues.push({
        code: 'coffre-moustiquaire',
        severite: 'info',
        message:
          `Coffre de ${coffre.hauteurCoffreMm} mm — il avale ${coffre.toileMaxMm} mm de toile. ` +
          'Le rouleau grossit en spirale : c’est lui qui décide, pas la place disponible.',
      });
    }
  }

  // --- L'OUVRANT QUI SORT. Le refus qu'aucun configurateur n'oppose.
  if (config.ouvrantProtegeSort === true && type !== 'cadre-fixe') {
    issues.push({
      code: 'moustiquaire-devant-ouvrant-sortant',
      severite: 'avertissement',
      message:
        'La menuiserie protégée s’ouvre vers l’EXTÉRIEUR : la moustiquaire est devant, et ' +
        'l’ouvrant viendra buter dedans. Il faut alors la poser en TABLEAU, derrière le ' +
        'dormant — ou choisir un cadre fixe démontable, qu’on retire pour ouvrir.',
      alternative: { label: 'Passer en cadre fixe', patch: { typeMoustiquaire: 'cadre-fixe' } },
    });
  }

  // --- LA POSE. Deux cotes différentes, et c'est la première cause de retour.
  issues.push({
    code: 'moustiquaire-cote-de-pose',
    severite: 'info',
    message:
      config.pose === 'renovation'
        ? 'Cote relevée EN APPLIQUE, sur le dormant existant : mesurez le dormant d’un bord ' +
          'extérieur à l’autre, pas le passage.'
        : 'Cote relevée EN TABLEAU, dans l’embrasure : mesurez le passage libre, pas le dormant. ' +
          'Confondre les deux est la première cause de retour sur ce produit.',
  });

  return issues;
}

/**
 * LA NOMENCLATURE D'UNE MOUSTIQUAIRE — ses pièces, et pas celles d'une
 * fenêtre.
 *
 * `computeNomenclature` a été écrite pour la fenêtre : un dormant de quatre
 * barres d'onglet, un ouvrant de quatre autres, un vitrage dans la
 * feuillure. Une moustiquaire n'a rien de tout cela. Elle a un COFFRE, deux
 * COULISSES, une TOILE et une BARRE DE TIRAGE — et sa toile se commande au
 * mètre carré, pas au verrier.
 *
 * TOUTES LES COTES D'ICI VIENNENT DU MODULE OU DE `familles-a-venir.json`,
 * et aucune n'est inventée : le coffre sort de `coffrePourHauteur()`, qui
 * calcule la spirale d'enroulement ; la coulisse fait 25 × 40 ; le tube
 * Ø 25 ; le cadre fixe 17 × 25. Une nomenclature dont un seul nombre serait
 * choisi au jugé ferait débiter dessus.
 *
 * DEUX ANATOMIES, pas une. L'enroulable a un coffre et un tube ; le cadre
 * fixe, la plissée et la coulissante ont quatre barres et pas de rouleau.
 * Les confondre aurait fait commander un coffre pour une moustiquaire qui
 * se clipse.
 */
export function nomenclatureMoustiquaire(contexte: {
  config: JoineryConfiguration;
  mesure: { widthMm: number; heightMm: number };
  repere: string;
}): { lignes: LigneNomenclature[]; lacunes: string[] } | null {
  const { config } = contexte;
  if (config.famille !== 'moustiquaire') return null;

  const lignes: LigneNomenclature[] = [];
  const lacunes: string[] = [];
  const L = Math.round(config.widthMm);
  const H = Math.round(config.heightMm);
  const teinte = config.couleur;
  const gamme = `moust-${config.materiau}`;
  const type = config.typeMoustiquaire ?? 'enroulable-verticale';
  const enroulable = type === 'enroulable-verticale' || type === 'enroulable-laterale';
  // LA TOILE S'ENROULE DANS LE SENS DE LA MANŒUVRE : verticalement sur une
  // fenêtre, HORIZONTALEMENT sur une porte. C'est la même distinction que
  // fait le refus de coffre, et l'oublier mettait un coffre de 55 sur une
  // latérale de deux mètres de large qui n'en demandait que 36.
  const toileMm = type === 'enroulable-laterale' ? L : H;

  if (enroulable) {
    // LE SENS DE L'ENROULEMENT COMMANDE TOUTE LA GÉOMÉTRIE, et le confondre
    // était le défaut de la première écriture — le même piège que le projet
    // rencontre à chaque famille : une pièce reconnue à son NOM et non à son
    // SENS.
    //
    // Une VERTICALE a son coffre EN HAUT, horizontal, long de la largeur ;
    // ses deux coulisses sont verticales. Une LATÉRALE — celle d'une porte —
    // a son coffre SUR LE CÔTÉ, vertical, long de la HAUTEUR ; ses deux
    // coulisses sont horizontales, en haut et en bas. Le premier jet donnait
    // à la latérale un coffre large de 1 200 mm et des coulisses de 1 600 :
    // exactement l'inverse de ce qu'on pose.
    const laterale = type === 'enroulable-laterale';
    const coffreLongueurMm = laterale ? H : L;
    const traverseeMm = laterale ? L : H;

    const coffre = coffrePourHauteur(toileMm);
    if (!coffre) {
      // Le refus existe déjà dans les règles de la famille ; ici il devient
      // une LACUNE, parce qu'une nomenclature sans coffre est une caisse de
      // pièces qu'on ne peut pas monter.
      lacunes.push(
        `toile de ${toileMm} mm : aucun coffre du catalogue ne l’enroule ` +
          `(le plus grand avale ${COFFRES[COFFRES.length - 1].toileMaxMm} mm)`,
      );
    } else {
      lignes.push({
        categorie: 'profil',
        reference: `${gamme}-coffre-${coffre.hauteurCoffreMm}`,
        designation: `Coffre d’enrouleur ${coffre.hauteurCoffreMm} mm`,
        quantite: 1,
        unite: 'piece',
        longueurMm: coffreLongueurMm,
        coupesDeg: [90, 90],
        teinte,
        regle: laterale
          ? `hauteur hors tout — le coffre d’une latérale est vertical ; plus petit coffre qui avale ${toileMm} mm de toile`
          : `largeur hors tout ; plus petit coffre qui avale ${toileMm} mm de toile`,
      });
      lignes.push({
        categorie: 'accessoire',
        reference: `${gamme}-tube-25`,
        designation: 'Tube d’enroulement Ø 25 mm, ressort de rappel intégré',
        quantite: 1,
        unite: 'piece',
        longueurMm: Math.max(0, coffreLongueurMm - 2 * COULISSE_LARGEUR_MM),
        teinte,
        regle: 'longueur du coffre moins les deux joues',
      });
    }
    lignes.push({
      categorie: 'profil',
      reference: `${gamme}-coulisse-${COULISSE_LARGEUR_MM}x${COULISSE_PROFONDEUR_MM}`,
      designation: `Coulisse ${COULISSE_LARGEUR_MM} × ${COULISSE_PROFONDEUR_MM} mm, brosse intégrée`,
      quantite: 2,
      unite: 'piece',
      longueurMm: Math.max(0, traverseeMm - (coffrePourHauteur(toileMm)?.hauteurCoffreMm ?? 0)),
      coupesDeg: [90, 90],
      teinte,
      regle: laterale
        ? 'largeur hors tout moins le coffre — les coulisses d’une latérale sont en haut et en bas'
        : 'hauteur hors tout moins le coffre',
    });
    lignes.push({
      categorie: 'accessoire',
      reference: `${gamme}-barre-tirage`,
      designation: 'Barre de tirage avec poignée et aimant de verrouillage',
      quantite: 1,
      unite: 'piece',
      longueurMm: Math.max(0, coffreLongueurMm - 2 * COULISSE_LARGEUR_MM),
      teinte,
      regle: 'même longueur que le tube — elle court d’une coulisse à l’autre',
    });
  } else {
    // LE CADRE FIXE, LA PLISSÉE, LA COULISSANTE : quatre barres, pas de
    // rouleau. Le profil est plat — 17 × 25 —, coupé d'onglet aux quatre
    // angles comme un cadre de tableau.
    lignes.push({
      categorie: 'profil',
      reference: `${gamme}-cadre-17x25`,
      designation: 'Cadre — montant, profil 17 × 25 mm',
      quantite: 2,
      unite: 'piece',
      longueurMm: H,
      coupesDeg: [45, 45],
      teinte,
      regle: 'hauteur hors tout, coupée en onglet aux deux bouts',
    });
    lignes.push({
      categorie: 'profil',
      reference: `${gamme}-cadre-17x25`,
      designation: 'Cadre — traverse, profil 17 × 25 mm',
      quantite: 2,
      unite: 'piece',
      longueurMm: L,
      coupesDeg: [45, 45],
      teinte,
      regle: 'largeur hors tout, coupée en onglet aux deux bouts',
    });
    lignes.push({
      categorie: 'quincaillerie',
      reference: `${gamme}-fixation`,
      designation: 'Jeu de fixation — clips, aimants ou équerres',
      quantite: 4,
      unite: 'piece',
      regle: 'une par angle',
    });
  }

  // LA TOILE, au mètre carré. Sa MAILLE est ce que le client achète : 1,2 mm
  // arrête les moucherons et coupe l'air ; 1,5 laisse respirer et laisse
  // entrer les plus petits. Le débit la porte, parce que deux toiles de
  // maille différente ne se remplacent pas l'une l'autre.
  // LA MAILLE STANDARD, et le configurateur ne la propose pas encore.
  // 1,5 mm est ce que la filière vend par défaut : elle laisse respirer.
  // La fine — 1,2 — arrête les moucherons et coupe l'air, et c'est un choix
  // que le client doit pouvoir faire ; le jour où l'écran le posera, cette
  // ligne lira sa réponse au lieu de la supposer.
  const maille = MAILLE_MM.standard;
  lignes.push({
    categorie: 'accessoire',
    reference: `toile-fibre-${String(maille).replace('.', ',')}`,
    designation: `Toile fibre de verre enduite PVC, maille ${String(maille).replace('.', ',')} mm`,
    quantite: Math.round(((L * H) / 1_000_000) * 100) / 100,
    unite: 'm2',
    regle: 'largeur × hauteur hors tout — la toile se coupe au cadre, sans chute récupérable',
  });

  return { lignes, lacunes };
}
