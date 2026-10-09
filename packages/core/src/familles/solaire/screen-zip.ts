/**
 * Pourquoi ce fichier existe : le store vertical à coulisses ZIP est ce qui
 * a rendu la protection solaire extérieure vendable sur une grande baie. Le
 * catalogue connaissait la toile du store BANNE, qui pend sur des bras et se
 * replie ; il ne connaissait pas une toile TENDUE dans deux coulisses.
 *
 * SA LISTE DE DIFFÉRENCES avec les trois stores déjà présents :
 *
 *   1. SA TOILE EST UN CONSOMMABLE EN LAIZE. Elle arrive en rouleaux de
 *      largeur fixe — 1 770 ou 2 670 mm sur la référence relevée. Un store
 *      plus large que la laize demande une COUTURE, qui se voit, qui coûte,
 *      et qui est le premier reproche du client. Aucune autre famille de ce
 *      catalogue n'a de matière dont la largeur borne le produit.
 *   2. LE ZIP EST CE QUI TIENT AU VENT. Une bordure soudée sur les deux
 *      rives court dans une coulisse fermée : la toile ne sort pas, et le
 *      store tient une classe qu'une toile libre n'atteint pas. Sans zip,
 *      la classe tombe.
 *   3. IL RELÈVE D'EN 13561, comme le banne — quatre classes, 0 à 3, en
 *      PLAGES de vitesse. Le BSO, lui, relève d'EN 13659 et monte à 6. Les
 *      deux échelles ne se convertissent pas, et un « classe 3 » ne veut pas
 *      dire la même chose sur les deux produits.
 *   4. IL NE FAIT PAS D'OMBRE, IL FILTRE. Son facteur d'ouverture dit
 *      quelle part de la toile est un trou. À 4 %, on voit dehors et le
 *      soleil est arrêté ; à 0 %, c'est un occultant qui chauffe et bat au
 *      vent. Ce nombre est la première question à poser, et personne ne la
 *      pose.
 *   5. SON gtot N'EST PAS UNE PROPRIÉTÉ DE SA TOILE. C'est une propriété du
 *      COUPLE toile + vitrage, et il change avec la face exposée. Ce module
 *      n'en affiche aucun sans vitrage nommé — voir le refus plus bas.
 *
 * Source : `ressources/donnees/protections-solaires.json`, relevé le
 * 6 septembre 2026 sur la brochure technique Serge Ferrari Soltis Perform 92
 * et sur la lecture fabricant d'EN 13561 — voir docs/36.
 *
 * Solution écartée : traiter la toile comme une simple option de couleur,
 * avec un supplément au mètre carré. C'est ce que fait le marché, et cela
 * perd les trois choses qui décident : la laize (donc la couture), le
 * facteur d'ouverture (donc ce que le client verra) et la masse (donc le
 * couple moteur). Un store screen dont on ne connaît que la couleur n'est
 * pas configuré.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { FamilleCatalog, PricingCatalog } from '../../catalog.ts';
import type { JoineryConfiguration, ValidationIssue } from '../../types.ts';
import { masseLisible, rapportTablier, verdictMoteurTubulaire } from '../../moteur-tubulaire.ts';
import { nombre } from '../../ecriture-francaise.ts';

/**
 * LES CLASSES DE VENT D'EN 13561 — et ce sont des PLAGES.
 *
 * Une version antérieure de la compétence donnait « 1 = 28, 2 = 38,
 * 3 = 49 km/h ». Ce sont les bornes HAUTES. Un store de classe 2 ne « tient
 * pas jusqu'à 38 km/h » : il est classé pour 29–38, et la différence compte
 * au moment où l'on refuse.
 *
 * L'échelle s'arrête à 3. Elle n'a ni classe 4, ni 5, ni 6 — celles-là
 * appartiennent à EN 13659, qui régit le BSO et le volet roulant.
 *
 * Ce qui NE voyage PAS jusqu'au navigateur : la force Beaufort et
 * l'indicateur visuel de chaque classe (« les arbustes commencent à
 * balancer »). Ils sont dans
 * `ressources/donnees/protections-solaires.json` et dans la compétence,
 * parce qu'aucune règle de ce module ne s'en sert — et qu'un morceau de
 * famille se paie par tout visiteur qui ouvre un volet.
 */
export const PLAGES_EN_13561: ReadonlyArray<{ classe: number; kmhMin: number; kmhMax: number }> = [
  { classe: 1, kmhMin: 20, kmhMax: 28 },
  { classe: 2, kmhMin: 29, kmhMax: 38 },
  { classe: 3, kmhMin: 39, kmhMax: 49 },
];

/** La classe 0 existe : elle dit « non contrôlé », donc « non adapté ». */
export const CLASSE_NON_DEFINIE = 0;

/* --------------------------------------------------------------------- *
 * LE GUIDAGE (lot MT1b) — ce qui retient la toile, et donc la classe
 * --------------------------------------------------------------------- */

/**
 * LE STORE VERTICAL EST LE MÊME PRODUIT SANS ZIP.
 *
 * La taxonomie le dit en une phrase : « c'est le screen du projet SANS zip
 * (toile libre guidée par câbles ou coulisses) — classe de vent inférieure
 * (1–2 contre 3+ en zip) ; à traiter comme variante du screen avec une classe
 * de vent déclarée plus basse » (§3.5). Le coffre, la toile, la laize, la
 * couture et le moteur sont identiques ; seul change ce qui tient les rives.
 */
export type GuidageDeToile = 'zip' | 'cables';

/**
 * LA CLASSE DÉCLARÉE PAR GUIDAGE.
 *
 * DÉCLARÉE, et pas calculée : une classe de vent se constate en soufflerie
 * (EN 1932), jamais dans un configurateur. Ce sont les valeurs du relevé —
 * 3 en zip, 1 sans — et un marchand qui a fait essayer son produit les
 * remplace.
 */
export const CLASSE_PAR_GUIDAGE: Readonly<Record<GuidageDeToile, number>> = {
  zip: 3,
  cables: 1,
};

/** Le guidage d'une configuration. Muet vaut `zip` — aucun devis ne bouge. */
export function guidageDe(config: { guidageDeToile?: GuidageDeToile }): GuidageDeToile {
  return config.guidageDeToile ?? 'zip';
}

/**
 * LA PRESSION AU BORD HAUT D'UNE CLASSE, en pascals entiers.
 *
 * q = ½ ρ v², avec ρ = 1,225 kg/m³ et v en m/s. On prend la borne HAUTE de
 * la plage : c'est elle que la classe promet.
 *
 * POURQUOI CE NOMBRE EXISTE, alors que la classe suffirait à l'écran : parce
 * que le NUMÉRO DE CLASSE EST LINÉAIRE ET LA FORCE NE L'EST PAS. Passer de
 * la classe 3 à la classe 1, c'est ×1,75 en vitesse et ÷3,06 en PRESSION.
 * « Une classe de moins » se lit comme une nuance ; c'est un tiers de la
 * force, et il n'y a que le rapport de pressions pour le dire.
 */
export function pressionDeClassePa(classe: number): number | null {
  const plage = PLAGES_EN_13561.find((p) => p.classe === classe);
  if (!plage) return null;
  const vitesseMs = plage.kmhMax / 3.6;
  return Math.round(0.5 * 1.225 * vitesseMs * vitesseMs);
}

/**
 * COMBIEN DE FOIS UNE CLASSE TIENT-ELLE CE QU'UNE AUTRE TIENT, en millièmes.
 *
 * 3 060 se lit « 3,06 fois ». `null` si l'une des deux classes n'existe pas —
 * l'échelle s'arrête à 3, et une classe 4 appartient à EN 13659.
 */
export function rapportDeClassesEnMilliemes(forte: number, faible: number): number | null {
  const haut = PLAGES_EN_13561.find((p) => p.classe === forte);
  const bas = PLAGES_EN_13561.find((p) => p.classe === faible);
  if (!haut || !bas) return null;
  // LE RAPPORT SE PREND SUR LES VITESSES, PAS SUR LES PRESSIONS ARRONDIES.
  // Une première rédaction divisait 113 par 37 et rendait 3 054 ; le rapport
  // exact est (49/28)² = 3 063. Neuf millièmes d'écart, sans conséquence à
  // l'écran — mais un rapport tiré de deux nombres déjà arrondis DÉRIVE, et
  // la dérive grandit avec les classes voisines. Les pressions restent
  // arrondies pour l'affichage ; le rapport ne l'est qu'une fois.
  return Math.round((haut.kmhMax / bas.kmhMax) ** 2 * 1000);
}

/**
 * CE QU'UNE CLASSE EN 13561 NE DIT PAS, et c'est le piège du lot.
 *
 * Elle classe le store EN SERVICE : au-delà de sa classe, il se REMONTE.
 * Elle ne dit rien de ce que la structure encaisse volet fermé.
 *
 * MESURÉ sur ce moteur : `chargeDeVent` (EN 1991-1-4) rend 449 Pa en zone de
 * vent 1 — la plus douce de France — à 8 m en rase campagne, quand le haut
 * de la classe 3 vaut 114 Pa. Un configurateur qui comparerait les deux
 * refuserait TOUS les stores de France, y compris le screen zip classe 3 que
 * tout le marché vend. Les deux nombres sont justes ; ils ne répondent pas à
 * la même question — comme le classement A/E/V et l'EN 13241 au lot Z17.
 */
export const LA_CLASSE_N_EST_PAS_UNE_CHARGE =
  'La classe de vent EN 13561 dit jusqu’à quel vent le store peut rester DÉPLOYÉ — au-delà, il se ' +
  'remonte. Elle ne dit pas ce que la structure encaisse fermée, et elle ne se compare pas à la ' +
  'pression de l’Eurocode : ce sont deux questions différentes.';

/**
 * LES TOILES SCREEN et ce qui les distingue vraiment.
 *
 * `facteurOuverturePourCent` est la part de la toile qui est un TROU. Il
 * décide de ce que le client verra, et il n'a pas d'autre substitut : deux
 * toiles de la même couleur et de facteurs différents ne font pas le même
 * produit.
 *
 * `laizesMm` est la largeur des rouleaux. C'est le nombre qui borne le
 * store sans couture, et il n'apparaît sur aucune fiche commerciale.
 */
export const TOILES_SCREEN = {
  'soltis-92': {
    nom: 'Screen 4 % — Soltis Perform 92',
    facteurOuverturePourCent: 4,
    masseSurfaciqueGM2: 420,
    epaisseurMm: 0.45,
    laizesMm: [1770, 2670],
    euroclasseFeu: 'B-s2,d0',
    argument:
      'Quatre pour cent d’ouverture : le soleil est arrêté et l’on voit encore dehors. C’est le screen du bureau et du séjour.',
  },
} as const;

export type ToileScreen = keyof typeof TOILES_SCREEN;

/**
 * LA LAIZE MAXIMALE UTILE, une fois retirée la place des deux bordures zip.
 *
 * La bordure soudée sur chaque rive court dans la coulisse : elle est prise
 * sur la laize, pas ajoutée. Vingt-cinq millimètres par rive est ce que le
 * métier réserve — c'est une valeur d'atelier, déclarée ici comme telle et
 * pas relevée sur un document. Elle est nommée pour pouvoir être corrigée.
 */
export const BORDURE_ZIP_PAR_RIVE_MM = 25;

/** La laize utile la plus large d'une toile, bordures déduites. */
export function laizeUtileMaxMm(toile: ToileScreen): number {
  const laizes = TOILES_SCREEN[toile].laizesMm;
  return Math.max(...laizes) - 2 * BORDURE_ZIP_PAR_RIVE_MM;
}

/**
 * Le nombre de LÉS nécessaires pour une largeur donnée — et donc le nombre
 * de coutures, qui vaut ce nombre moins un.
 *
 * Un lé est une bande de toile pleine laize. Deux lés font une couture ; la
 * couture se voit à contre-jour, et c'est exactement la position d'un store
 * de fenêtre.
 */
export function nombreDeLes(toile: ToileScreen, largeurMm: number): number {
  const utile = laizeUtileMaxMm(toile);
  return Math.max(1, Math.ceil(largeurMm / utile));
}

/** Les bornes d'un screen zip, toutes matières confondues. */
export const BORNES_SCREEN_ZIP = {
  largeurMinMm: 600,
  largeurMaxMm: 6000,
  hauteurMinMm: 500,
  hauteurMaxMm: 4000,
  /**
   * Le plafond de surface au-delà duquel le zip lui-même ne suffit plus.
   * Dix-huit mètres carrés est ce que le métier annonce pour un screen zip
   * en classe 3 ; c'est une valeur de MÉTIER, pas un relevé de fabricant, et
   * elle est nommée pour être remplacée par la table d'un gammiste déclaré.
   */
  surfaceMaxM2: 18,
} as const;

/**
 * LA SURFACE MAXIMALE D'UN STORE, SELON SON GUIDAGE — DÉRIVÉE, jamais
 * saisie.
 *
 * Aucun fabricant ne publie la borne d'une toile guidée par câbles. On ne
 * l'invente donc pas : c'est la FORCE sur la toile qui borne la surface, et
 * le rapport des pressions entre deux classes est exact. 18 m² en classe 3,
 * divisés par 3,06, donnent 5,8 m² en classe 1.
 *
 * Le 18 est déclaré (valeur de métier, voir ci-dessus), le rapport est
 * calculé, et le résultat se recalcule si l'un des deux bouge. C'est la règle
 * « un dérivé ne se saisit pas », appliquée à une borne plutôt qu'à un prix.
 */
export function surfaceMaxM2Pour(guidage: GuidageDeToile): number {
  const classe = CLASSE_PAR_GUIDAGE[guidage];
  const rapport = rapportDeClassesEnMilliemes(CLASSE_PAR_GUIDAGE.zip, classe);
  if (rapport === null || rapport <= 0) return BORNES_SCREEN_ZIP.surfaceMaxM2;
  // Au dixième de mètre carré : une borne au centième serait une précision
  // que ni le 18 ni la classe ne portent.
  return Math.round((BORNES_SCREEN_ZIP.surfaceMaxM2 * 1000 * 10) / rapport) / 10;
}

/**
 * LA MÊME BORNE, DÉJÀ ÉCRITE EN FRANÇAIS.
 *
 * Elle existe parce que la faute a été commise SIX FOIS dans ce dépôt — le
 * guide de VS2 (« 2500 × 5000 mm »), celui de VS3, celui de VS4, la trémie du
 * lot Z6, le vantail du lot MT1a (« 60.1 kg »), et cette tuile-ci
 * (« 5.9 m² »). Chaque fois, un nombre juste traverse une interpolation et
 * arrive à l'écran avec un point décimal.
 *
 * Corriger l'appelant ne suffit pas : le suivant recommencera. Le module rend
 * donc la CHAÎNE, et l'écran n'a plus de nombre à mettre en forme.
 */
export function surfaceMaxEcrite(guidage: GuidageDeToile): string {
  return `${nombre(surfaceMaxM2Pour(guidage))} m²`;
}

export const CATALOGUE_SCREEN_ZIP: FamilleCatalog = {
  label: 'Screen vertical à coulisses zip',
  matrices: {
    '1': {
      widthsMm: [1000, 1500, 2500, 4000, 6000],
      heightsMm: [1000, 1500, 2500, 4000],
      cellsCents: [
        [31000, 40000, 61000, 92000, 132000],
        [38000, 49000, 75000, 113000, 162000],
        [52000, 68000, 104000, 157000, 225000],
        [71000, 92000, 141000, 213000, 305000],
      ],
    },
  },
  bornes: {
    minWidthMm: BORNES_SCREEN_ZIP.largeurMinMm,
    minHeightMm: BORNES_SCREEN_ZIP.hauteurMinMm,
    vantauxMin: 1,
    vantauxMax: 1,
    vantailMinMm: BORNES_SCREEN_ZIP.largeurMinMm,
    // Un seul matériau borné, comme un seul matériau tarifé.
    vantailMaxMm: { alu: BORNES_SCREEN_ZIP.largeurMaxMm },
  },
  // Le coffre et les deux coulisses sont en ALUMINIUM, et rien d'autre ne
  // tient une toile tendue. Un seul matériau déclaré — voir la note du même
  // champ dans `bso.ts`, qu'une épreuve du catalogue a corrigée.
  coefMateriauMilliemes: { alu: 1000 },
  vitree: false,
  frameBandMm: { alu: 25, bois: 25, pvc: 25 },
};

/**
 * LES REMARQUES ET LES REFUS D'UN SCREEN ZIP.
 *
 * Le refus central n'est pas dimensionnel : c'est la COUTURE. Un store
 * livré avec une couture qui n'avait pas été annoncée revient, et il revient
 * après la pose.
 */
export function reglesScreenZip(contexte: {
  config: JoineryConfiguration;
  catalog: PricingCatalog;
}): ValidationIssue[] {
  const { config } = contexte;
  if (config.famille !== 'screen-zip') return [];
  const issues: ValidationIssue[] = [];

  const toile: ToileScreen = config.toileScreen ?? 'soltis-92';
  const fiche = TOILES_SCREEN[toile];

  // --- LA MATIÈRE. Coffre et coulisses en aluminium.
  if (config.materiau !== 'alu') {
    issues.push({
      code: 'screen-aluminium-seul',
      severite: 'erreur',
      message:
        `Un screen à coulisses zip a un coffre et deux coulisses en ALUMINIUM : c’est ce qui ` +
        `tient la toile tendue. Matière demandée : ${config.materiau}.`,
      alternative: { label: 'Passer en aluminium', patch: { materiau: 'alu' } },
    });
  }

  // --- LA COUTURE. Le refus qui n'existe nulle part ailleurs dans ce
  // catalogue : une matière dont la LARGEUR borne le produit.
  const utileMm = laizeUtileMaxMm(toile);
  const les = nombreDeLes(toile, config.widthMm);
  if (les > 1) {
    issues.push({
      code: 'screen-couture-de-toile',
      severite: 'avertissement',
      message:
        `${config.widthMm} mm de large pour une laize utile de ${utileMm} mm : ce store demande ` +
        `${les} lés, donc ${les - 1} couture${les > 2 ? 's' : ''}. ` +
        `Une couture de toile SE VOIT à contre-jour, et un store de fenêtre est toujours à ` +
        `contre-jour. Ce n’est pas un défaut, c’est une conséquence de la largeur — mais elle ` +
        `se dit avant, pas à la pose.`,
      alternative: {
        label: `Rester sous ${utileMm} mm, sans couture`,
        patch: { widthMm: utileMm },
      },
    });
  }

  // --- LE GUIDAGE (lot MT1b) et la CLASSE qu'il donne.
  //
  // Le store vertical est le même produit sans zip. Ce qui change n'est pas
  // une nuance : le numéro de classe est linéaire, la force ne l'est pas.
  const guidage = guidageDe(config);
  const classe = CLASSE_PAR_GUIDAGE[guidage];
  if (guidage !== 'zip') {
    const rapport = rapportDeClassesEnMilliemes(CLASSE_PAR_GUIDAGE.zip, classe);
    issues.push({
      code: 'screen-guidage-sans-zip',
      severite: 'info',
      message:
        `Toile guidée par câbles : classe de vent ${classe} (EN 13561), contre ` +
        `${CLASSE_PAR_GUIDAGE.zip} avec le zip. Une classe de moins se lit comme une nuance — ` +
        `c'est ${rapport === null ? 'davantage' : `${nombre(rapport / 1000)} fois`} moins de ` +
        `pression admissible : ${pressionDeClassePa(classe)} Pa contre ` +
        `${pressionDeClassePa(CLASSE_PAR_GUIDAGE.zip)} Pa. ${LA_CLASSE_N_EST_PAS_UNE_CHARGE}`,
    });
  }

  // --- LA SURFACE. Le zip repousse la limite ; il ne la supprime pas.
  const surfaceM2 = (config.widthMm / 1000) * (config.heightMm / 1000);
  const surfaceMax = surfaceMaxM2Pour(guidage);
  if (surfaceM2 > surfaceMax) {
    issues.push({
      code: 'screen-surface-hors-borne',
      severite: 'erreur',
      message:
        `${nombre(surfaceM2)} m² : au-delà de ` +
        `${nombre(surfaceMax)} m², la toile prend trop au vent pour que ` +
        (guidage === 'zip'
          ? 'les coulisses la retiennent — le zip repousse la limite, il ne la supprime pas. '
          : `les câbles la retiennent. Cette borne se DÉRIVE de celle du zip ` +
            `(${BORNES_SCREEN_ZIP.surfaceMaxM2} m² en classe ${CLASSE_PAR_GUIDAGE.zip}) par le ` +
            `rapport des pressions de classe — aucun fabricant ne la publie. `) +
        (guidage === 'zip'
          ? `Deux stores accouplés tiennent ce que celui-ci ne tient pas.`
          : // LA PHRASE SUIT LE BOUTON. Une première rédaction finissait les
            // deux branches par « deux stores accouplés » pendant que
            // l'alternative proposait le zip : la phrase et le bouton ne
            // disaient pas la même chose, et c'est le client qui arbitre.
            // Vu à l'écran, pas dans une assertion.
            `Les coulisses zip rendent ${surfaceMaxEcrite('zip')} sur le même store.`),
      alternative:
        guidage === 'zip'
          ? {
              label: 'Partager en deux stores accouplés',
              patch: { widthMm: Math.floor(config.widthMm / 2 / 10) * 10 },
            }
          : {
              label: 'Passer aux coulisses zip',
              patch: { guidageDeToile: 'zip' as const },
            },
    });
  }

  if (config.widthMm > BORNES_SCREEN_ZIP.largeurMaxMm) {
    issues.push({
      code: 'screen-largeur-hors-borne',
      severite: 'erreur',
      message: `${config.widthMm} mm de large : ce store s’arrête à ${BORNES_SCREEN_ZIP.largeurMaxMm} mm.`,
      alternative: {
        label: `Ramener à ${BORNES_SCREEN_ZIP.largeurMaxMm} mm`,
        patch: { widthMm: BORNES_SCREEN_ZIP.largeurMaxMm },
      },
    });
  }
  if (config.heightMm > BORNES_SCREEN_ZIP.hauteurMaxMm) {
    issues.push({
      code: 'screen-hauteur-hors-borne',
      severite: 'erreur',
      message: `${config.heightMm} mm de haut : ce store s’arrête à ${BORNES_SCREEN_ZIP.hauteurMaxMm} mm.`,
      alternative: {
        label: `Ramener à ${BORNES_SCREEN_ZIP.hauteurMaxMm} mm`,
        patch: { heightMm: BORNES_SCREEN_ZIP.hauteurMaxMm },
      },
    });
  }

  // --- CE QUE LE FACTEUR D'OUVERTURE VEUT DIRE. La question que personne ne
  // pose, et la première déception quand on ne l'a pas posée.
  issues.push({
    code: 'screen-facteur-d-ouverture',
    severite: 'info',
    message:
      `${fiche.nom} : ${fiche.facteurOuverturePourCent} % d’ouverture. ` +
      `Ce n’est PAS un occultant — on voit dehors, et un peu de lumière passe. ` +
      `${fiche.argument} Toile de ${fiche.masseSurfaciqueGM2} g/m², ` +
      // LA MASSE VIENT DU MODULE, et non d'un calcul recopié ici. Elle est
      // écrite deux fois — dans ce message et dans le verdict de
      // motorisation — et une épreuve vérifie que les deux disent le même
      // nombre. C'est la règle de la maison : chaque duplication a son
      // comparateur, jamais un commentaire.
      `soit ${masseLisible(rapportTablier(config, fiche.masseSurfaciqueGM2)?.masseG ?? null) ?? '?'}` +
      ' kg de toile pour ce store.',
  });

  // --- LA MOTORISATION. Ce que le cœur SAIT (la masse) et ce qu'il REFUSE
  // de dire (le couple). Il est ici, dans une remarque, et non dans l'écran
  // du widget : `moteur-tubulaire.ts` est du CALCUL, et le widget ne décide
  // rien. La première écriture le mettait dans le composant React, et deux
  // choses en sont sorties — la règle « le cœur décide, l'écran montre »
  // était enfreinte, et le vérificateur de bundle a vu les tables de la
  // famille partir dans un morceau partagé, donc comptées à la session.
  const verdict = verdictMoteurTubulaire(config, fiche.masseSurfaciqueGM2);
  if (verdict) {
    issues.push({
      code: 'screen-motorisation-tubulaire',
      severite: 'info',
      message:
        `Tablier de ${masseLisible(verdict.masseG)} kg. ${verdict.pourquoiPasDeCalcul} ` +
        `Il manque : ${verdict.manque.join(' ; ')}.`,
    });
  }

  // --- LE gtot QUI NE S'AFFICHE PAS SEUL. Le refus le plus subtil de ce
  // module, et celui qu'un configurateur concurrent ne fait pas.
  if (config.gtotDemande === true) {
    issues.push({
      code: 'screen-gtot-sans-vitrage',
      severite: 'erreur',
      message:
        `Le facteur solaire gtot ne se donne pas pour une toile seule : c’est une propriété du ` +
        `COUPLE toile + vitrage, et il change avec la face exposée et le côté de pose. ` +
        `Le fabricant publie ses tableaux pour des vitrages de référence nommés. ` +
        `Annoncer un gtot sans dire devant quel vitrage serait un nombre juste devant un ` +
        `vitrage et faux devant tous les autres.`,
    });
  }

  return issues;
}
