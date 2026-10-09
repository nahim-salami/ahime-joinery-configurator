
import type { FamilleCatalog } from '../../catalog.ts';
import type { JoineryConfiguration, ValidationIssue } from '../../types.ts';
import type { LigneNomenclature } from '../../export/nomenclature.ts';
import type { PricingCatalog } from '../../catalog.ts';
import { CADRE_MM, SECTIONNELLE } from './cotes-de-sectionnelle.ts';

// Les deux déclarations vivent dans `cotes-de-sectionnelle.ts` (lot C13b) :
// `geometry3d.ts` les lit, et les importer d'ici tirait ce module entier chez
// tout visiteur qui ouvre la 3D. Elles sont réexportées pour ses lecteurs.
export { CADRE_MM, SECTIONNELLE };

export function hauteurTablierMm(hauteurMm: number): number {
  return Math.max(0, hauteurMm - CADRE_MM);
}

/**
 * LE NOMBRE DE PANNEAUX, déduit et jamais choisi.
 *
 * Arrondi vers le HAUT : un tablier de 2 065 mm ne fait pas 4,13 panneaux,
 * il en fait cinq, dont le plus bas est recoupé. C'est ainsi que le
 * gammiste le fabrique, et c'est ce qu'on voit sur une porte posée — le
 * panneau du bas est plus court que les autres.
 *
 * Il prend la hauteur de TABLIER, pas celle de la porte : c'est le leurre
 * qui a failli passer. Voir `hauteurTablierMm`.
 */
export function nombreDePanneaux(hauteurTablier: number): number {
  return Math.max(1, Math.ceil(hauteurTablier / SECTIONNELLE.panneauHauteurMm));
}

/**
 * LA LARGEUR RÉELLEMENT FABRIQUÉE, sur le pas du gammiste.
 *
 * On arrondit vers le BAS et pas au plus proche : une porte plus large que
 * le passage ne se pose pas, tandis qu'une porte plus étroite se comble au
 * couvre-joint. C'est le même arbitrage que pour la cote de débit — mieux
 * vaut trop peu que trop, quand le trop ne se rattrape pas.
 */
export function largeurFabriquee(largeurMm: number): number {
  const pas = SECTIONNELLE.pasLargeurMm;
  return Math.max(SECTIONNELLE.largeurMinMm, Math.floor(largeurMm / pas) * pas);
}

/** L'épaisseur de panneau retenue — 67 mm dès qu'on demande l'isolation. */
export function epaisseurPanneauMm(config: JoineryConfiguration): 42 | 67 {
  return (config.options ?? []).some((option) => option.id === 'garage-panneau-isole') ? 67 : 42;
}

/** La retombée de linteau qu'il faut, selon la ferrure et le panneau. */
export function retombeeRequiseMm(config: JoineryConfiguration): number {
  const reduite = (config.options ?? []).some((option) => option.id === 'garage-ferrure-reduite');
  if (reduite) return SECTIONNELLE.retombeeLinteauMm.reduite;
  return epaisseurPanneauMm(config) === 67
    ? SECTIONNELLE.retombeeLinteauMm.isolee
    : SECTIONNELLE.retombeeLinteauMm.standard;
}

/** Le Ud de la porte — un coefficient de PORTE, pas un Uw pondéré. */
export function udPorteGarage(config: JoineryConfiguration): number {
  return SECTIONNELLE.ud[epaisseurPanneauMm(config)];
}

export const CATALOGUE_PORTE_GARAGE: FamilleCatalog = {
  label: 'Porte de garage',
  matrices: {
    // UNE SEULE MATRICE, et pas une par « vantail » : les panneaux ne sont
    // pas des vantaux, et indexer par leur nombre ferait croire qu'on les
    // choisit.
    '1': {
      widthsMm: [2000, 2500, 3000, 4000, 5000],
      heightsMm: [2000, 2125, 2250, 3000],
      cellsCents: [
        [118000, 132000, 148000, 189000, 231000],
        [122000, 136000, 153000, 195000, 238000],
        [126000, 141000, 158000, 201000, 246000],
        [141000, 158000, 177000, 225000, 275000],
      ],
    },
  },
  bornes: {
    // `BornesFamille` ne porte pas de MAXIMUM de hors-tout : les maxima
    // vivent dans `vantailMaxMm`, par matériau, et une sectionnelle n'ayant
    // qu'un « vantail », les deux se confondent. C'est la convention du
    // catalogue, pas une omission.
    minWidthMm: SECTIONNELLE.largeurMinMm,
    minHeightMm: 1800,
    // UN SEUL « VANTAIL », et c'est une convention forcée par le modèle
    // commun : une sectionnelle est un tablier d'un seul tenant. Les
    // PANNEAUX se déduisent de la hauteur (`nombreDePanneaux`).
    vantauxMin: 1,
    vantauxMax: 1,
    vantailMinMm: SECTIONNELLE.largeurMinMm,
    vantailMaxMm: { alu: SECTIONNELLE.largeurMaxMm, pvc: 4000 },
  },
  coefMateriauMilliemes: { alu: 1000, pvc: 920 },
  vitree: false,
  frameBandMm: { alu: 60, pvc: 70 },
};

/**
 * LES REFUS D'UNE PORTE DE GARAGE, et ils portent tous sur le MUR.
 *
 * C'est ce qui les rend particuliers : ailleurs, on refuse une menuiserie
 * parce qu'elle ne se fabrique pas. Ici on la refuse parce qu'elle ne
 * S'INSTALLE pas — et le client ne s'en apercevrait que le jour de la pose,
 * avec la porte dans le camion.
 */
export function reglesPorteGarage(contexte: {
  config: JoineryConfiguration;
  catalog: PricingCatalog;
}): ValidationIssue[] {
  const { config } = contexte;
  if (config.famille !== 'porte-garage') return [];
  const issues: ValidationIssue[] = [];

  const requise = retombeeRequiseMm(config);
  const declaree = config.retombeeLinteauMm;

  // --- LA RETOMBÉE DE LINTEAU. Le refus qui évite une porte dans un camion.
  if (declaree !== undefined && declaree < requise) {
    const reduiteSuffit = declaree >= SECTIONNELLE.retombeeLinteauMm.reduite;
    issues.push({
      code: 'linteau-insuffisant',
      severite: 'erreur',
      message:
        `Retombée de linteau de ${declaree} mm : cette ferrure en demande ${requise}. ` +
        'Sans cette place, l’axe, les ressorts et la courbe des rails ne se logent pas — ' +
        'la porte ne se pose pas, quelle que soit sa qualité.',
      ...(reduiteSuffit
        ? {
            alternative: {
              label: `Passer en ferrure à retombée réduite (${SECTIONNELLE.retombeeLinteauMm.reduite} mm)`,
              patch: {
                options: [
                  ...(config.options ?? []),
                  { id: 'garage-ferrure-reduite' as const },
                ],
              },
            },
          }
        : {}),
    });
  } else if (declaree === undefined) {
    // On ne REFUSE pas une retombée non mesurée — on la demande. Refuser
    // ferait abandonner un client qui n'a pas encore sorti son mètre ;
    // taire la question ferait livrer une porte qui n'entre pas.
    issues.push({
      code: 'linteau-a-mesurer',
      severite: 'avertissement',
      message:
        `Retombée de linteau non mesurée. Cette porte en demande ${requise} mm au-dessus du ` +
        'passage — mesurez avant de commander : c’est la cote qui décide si elle entre.',
    });
  }

  // --- LES ÉCOINÇONS. Les rails verticaux montent de chaque côté.
  const ecoincon = config.ecoinconMm;
  if (ecoincon !== undefined && ecoincon < SECTIONNELLE.ecoinconMinMm) {
    issues.push({
      code: 'ecoincon-insuffisant',
      severite: 'erreur',
      message:
        `Écoinçon de ${ecoincon} mm : il en faut ${SECTIONNELLE.ecoinconMinMm} de chaque côté ` +
        'pour les rails verticaux. Un mur qui revient trop près empêche la porte de coulisser.',
    });
  }

  // --- LA PROFONDEUR. Les rails horizontaux filent sous le plafond.
  const profondeurRequise = config.heightMm + SECTIONNELLE.profondeurSupplementaireMm;
  if (config.profondeurGarageMm !== undefined && config.profondeurGarageMm < profondeurRequise) {
    issues.push({
      code: 'garage-trop-court',
      severite: 'erreur',
      message:
        `Garage de ${config.profondeurGarageMm} mm de profondeur : une sectionnelle de ` +
        `${config.heightMm} mm en demande ${profondeurRequise} — la hauteur de porte plus ` +
        '500 mm de rails horizontaux. En deçà, il faut une porte enroulable ou battante.',
    });
  }

  // --- LA LARGEUR FABRIQUÉE. Le gammiste travaille au pas de 125.
  const fabriquee = largeurFabriquee(config.widthMm);
  if (fabriquee !== config.widthMm) {
    issues.push({
      code: 'largeur-au-pas-de-fabrication',
      severite: 'info',
      message:
        `Largeur fabriquée : ${fabriquee} mm au lieu de ${config.widthMm}. Une porte de garage ` +
        `se fabrique par pas de ${SECTIONNELLE.pasLargeurMm} mm, et l’arrondi se fait vers le BAS — ` +
        'une porte plus large que le passage ne se pose pas, une plus étroite se comble au couvre-joint.',
    });
  }

  // --- LES PANNEAUX. Ils se déduisent, et le dire évite qu'on les cherche.
  const tablier = hauteurTablierMm(config.heightMm);
  const panneaux = nombreDePanneaux(tablier);
  issues.push({
    code: 'garage-panneaux',
    severite: 'info',
    message:
      `${panneaux} panneaux de ${SECTIONNELLE.panneauHauteurMm} mm, dont le plus bas est recoupé ` +
      `à ${tablier - (panneaux - 1) * SECTIONNELLE.panneauHauteurMm} mm. ` +
      `Ud ${udPorteGarage(config).toFixed(1).replace('.', ',')} W/(m²·K) — un coefficient de PORTE, ` +
      'pas un Uw : il n’y a pas de vitrage à pondérer.',
  });

  return issues;
}

export function nomenclaturePorteDeGarage(contexte: {
  config: JoineryConfiguration;
  repere: string;
}): { lignes: LigneNomenclature[]; lacunes: string[] } | null {
  const { config } = contexte;
  if (config.famille !== 'porte-garage') return null;

  const lignes: LigneNomenclature[] = [];
  const lacunes: string[] = [];
  const teinte = config.couleur;
  const gamme = `garage-${config.materiau}`;

  // LA LARGEUR SE RAMÈNE AU PAS DU GAMMISTE, vers le BAS : une porte plus
  // large que le passage ne se pose pas, tandis qu'une porte plus étroite se
  // comble au couvre-joint.
  const largeurMm = largeurFabriquee(config.widthMm);
  const hauteurMm = Math.round(config.heightMm);
  const tablierMm = hauteurTablierMm(hauteurMm);
  const panneaux = nombreDePanneaux(tablierMm);
  const epaisseurMm = epaisseurPanneauMm(config);

  // --- LE CADRE. Deux montants et un linteau, en cornières galvanisées. Il
  // n'y a PAS de traverse basse : le sol en tient lieu.
  lignes.push({
    categorie: 'profil',
    reference: `${gamme}-cadre-mnt`,
    designation: `Cadre — montant, cornière ${CADRE_MM} mm`,
    quantite: 2,
    unite: 'piece',
    longueurMm: hauteurMm,
    coupesDeg: [90, 90],
    teinte,
    regle: 'hauteur de passage — le cadre monte du sol au linteau',
  });
  lignes.push({
    categorie: 'profil',
    reference: `${gamme}-cadre-linteau`,
    designation: `Cadre — linteau, cornière ${CADRE_MM} mm`,
    quantite: 1,
    unite: 'piece',
    longueurMm: largeurMm,
    coupesDeg: [90, 90],
    teinte,
    regle: `largeur ramenée au pas de ${SECTIONNELLE.pasLargeurMm} mm, vers le bas`,
  });

  // --- LES PANNEAUX. Leur nombre se DÉDUIT du tablier ; le plus bas est
  // recoupé, et c'est ce qu'on voit sur une porte posée.
  lignes.push({
    categorie: 'profil',
    reference: `${gamme}-panneau-${epaisseurMm}`,
    designation:
      `Panneau ${SECTIONNELLE.panneauHauteurMm} × ${epaisseurMm} mm, ` +
      (epaisseurMm === 67 ? 'acier double paroi, âme mousse PU isolée' : 'acier double paroi'),
    quantite: panneaux,
    unite: 'piece',
    longueurMm: largeurMm,
    coupesDeg: [90, 90],
    teinte,
    regle:
      `tablier de ${tablierMm} mm divisé par le panneau de ` +
      `${SECTIONNELLE.panneauHauteurMm} mm, arrondi au SUPÉRIEUR — le panneau du bas est recoupé`,
  });

  // --- CE QUI ARTICULE LES PANNEAUX. Deux charnières latérales par JOINT
  // entre panneaux, plus les galets qui courent dans le rail. Compter par
  // panneau au lieu de par joint en donnerait deux de trop.
  const joints = Math.max(0, panneaux - 1);
  lignes.push({
    categorie: 'quincaillerie',
    reference: `${gamme}-charniere`,
    designation: 'Charnière latérale à galet, et charnières intermédiaires',
    quantite: 2 * joints + 2,
    unite: 'piece',
    regle: `deux par joint entre panneaux (${joints} joints), plus deux en tête de tablier`,
  });

  // --- LES RAILS, en JEU. Voir l'en-tête : on ne les débite pas.
  lignes.push({
    categorie: 'accessoire',
    reference: `${gamme}-rails-${hauteurMm}`,
    designation: 'Jeu de rails — verticaux, courbe et horizontaux, avec suspentes',
    quantite: 1,
    unite: 'piece',
    regle:
      `appairé à la hauteur (${hauteurMm} mm) et à la retombée de linteau ; ` +
      `profondeur libre nécessaire : ${hauteurMm + SECTIONNELLE.profondeurSupplementaireMm} mm`,
  });

  // --- L'ÉQUILIBRAGE, et la lacune qui va avec.
  lacunes.push(
    'ressorts de torsion : ils s’apparient au POIDS DU TABLIER et au nombre de cycles, ' +
      'sur une table que ce dépôt ne possède pas — ni la masse au m² du panneau, ni ' +
      'l’appairage. Un ressort sous-dimensionné casse et le tablier tombe ' +
      '(voir docs/23-nomenclatures-manquantes.md)',
  );
  lignes.push({
    categorie: 'quincaillerie',
    reference: `${gamme}-axe`,
    designation: 'Axe d’équilibrage, tambours et câbles',
    quantite: 1,
    unite: 'piece',
    longueurMm: largeurMm,
    regle: 'au-dessus du linteau — les ressorts se montent dessus, et se choisissent au poids',
  });

  // --- L'ÉTANCHÉITÉ. Elle fait le tour, plus le seuil.
  lignes.push({
    categorie: 'joint',
    reference: `${gamme}-joint`,
    designation: 'Joints périphériques et joint de seuil',
    quantite: Math.round(((2 * hauteurMm + 2 * largeurMm) / 1000) * 10) / 10,
    unite: 'm',
    regle: 'périmètre de la porte — seuil compris, c’est par là que l’eau entre',
  });

  // --- LA MANŒUVRE.
  const motorise =
    config.motorisation !== undefined ||
    (config.options ?? []).some((option) => String(option.id).startsWith('motorisation-'));
  lignes.push({
    categorie: 'quincaillerie',
    reference: motorise ? `${gamme}-moteur` : `${gamme}-serrure`,
    designation: motorise
      ? 'Motorisation — rail de plafond, chariot et bras de liaison'
      : 'Serrure à clé, poignée et verrous latéraux',
    quantite: 1,
    unite: 'piece',
    regle: motorise
      ? 'une par porte — le rail de plafond est en plus du jeu de rails du tablier'
      : 'une par porte',
  });

  return { lignes, lacunes };
}
